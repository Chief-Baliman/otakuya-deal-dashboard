import base64
import hashlib
import json
import os
import secrets
import sqlite3
from datetime import datetime
from pathlib import Path

import pandas as pd
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from dotenv import load_dotenv
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

BASE_DIR = Path("/opt/japan-deal-watcher")
EXPORT_DIR = BASE_DIR / "exports"
DASHBOARD_DIR = BASE_DIR / "dashboard"
DATA_DIR = DASHBOARD_DIR / "data"
ENV_FILE = BASE_DIR / ".env"
DB_FILE = BASE_DIR / "data" / "otakuya_history.sqlite3"

load_dotenv(ENV_FILE)


def find_latest_raw_export():
    files = sorted(EXPORT_DIR.glob("otakuya_raw_variants_jpy_*.xlsx"))
    if not files:
        raise FileNotFoundError("Keine Otakuya-JPY-Rohdaten in exports gefunden.")
    return files[-1]


def clean_value(value):
    if pd.isna(value):
        return None
    if hasattr(value, "item"):
        return value.item()
    return value


def clean_int(value):
    if value is None or pd.isna(value):
        return None
    try:
        return int(float(value))
    except Exception:
        return None


def make_variant_key_from_values(product_name, variant, variant_value, url):
    raw = "|".join([
        str(product_name or ""),
        str(variant or ""),
        str(variant_value or ""),
        str(url or ""),
    ])
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()


def make_variant_key(row):
    return make_variant_key_from_values(
        row.get("product_name"),
        row.get("variant"),
        row.get("variant_value"),
        row.get("url"),
    )


def derive_item_type(product_name, variant):
    text = f"{product_name} {variant}".lower()
    if "case" in text:
        return "case"
    if "pack" in text:
        return "pack"
    if "no shrink" in text or "noshrink" in text:
        return "no_shrink"
    if "damaged" in text:
        return "damaged"
    return "box"


def load_history_context():
    if not DB_FILE.exists():
        return {}, None, None

    try:
        with sqlite3.connect(DB_FILE) as conn:
            snapshots = conn.execute("""
                SELECT DISTINCT snapshot_at
                FROM variant_snapshots
                ORDER BY snapshot_at DESC
                LIMIT 2
            """).fetchall()

            if not snapshots:
                return {}, None, None

            current_at = snapshots[0][0]
            previous_at = snapshots[1][0] if len(snapshots) > 1 else None

            history = {}

            if previous_at:
                rows = conn.execute("""
                    SELECT
                        variant_key,
                        yen_price,
                        stock
                    FROM variant_snapshots
                    WHERE snapshot_at = ?
                """, (previous_at,)).fetchall()

                for variant_key, yen_price, stock in rows:
                    history[variant_key] = {
                        "previous_yen_price": yen_price,
                        "previous_stock": stock
                    }

            return history, current_at, previous_at
    except Exception as e:
        print("Historie konnte nicht geladen werden:", e)
        return {}, None, None


def add_order_columns_if_missing(df):
    if "product_order" not in df.columns:
        product_map = {}
        next_order = 1
        orders = []

        for _, row in df.iterrows():
            key = f"{row.get('product_name', '')}|{row.get('url', '')}"
            if key not in product_map:
                product_map[key] = next_order
                next_order += 1
            orders.append(product_map[key])

        df["product_order"] = orders

    if "variant_order" not in df.columns:
        df["variant_order"] = df.groupby(["product_name", "url"]).cumcount() + 1

    return df


def trend_label(current, previous):
    if current is None or previous is None:
        return "unknown"

    if current < previous:
        return "down"

    if current > previous:
        return "up"

    return "flat"


def build_payload():
    input_file = find_latest_raw_export()
    df = pd.read_excel(input_file)
    df = add_order_columns_if_missing(df)

    history, current_snapshot, previous_snapshot = load_history_context()

    products = []

    for _, row in df.iterrows():
        product_name = clean_value(row.get("product_name"))
        variant = clean_value(row.get("variant"))
        variant_value = clean_value(row.get("variant_value"))
        url = clean_value(row.get("url"))

        if not product_name:
            continue

        variant_key = make_variant_key(row)
        hist = history.get(variant_key, {})

        yen_price = clean_int(row.get("yen_price"))
        stock = clean_int(row.get("stock"))
        weight_grams = clean_int(row.get("weight_grams"))

        previous_yen_price = hist.get("previous_yen_price")
        previous_stock = hist.get("previous_stock")

        item = {
            "variant_key": variant_key,
            "product_order": int(clean_int(row.get("product_order")) or 999999),
            "variant_order": int(clean_int(row.get("variant_order")) or 999999),
            "supplier": "Otakuya",
            "product_name": product_name,
            "product_code": clean_value(row.get("product_code")),
            "variant": variant or "-",
            "variant_value": variant_value,
            "variant_sold_out_label": bool(clean_value(row.get("variant_sold_out_label"))),
            "item_type": derive_item_type(product_name, variant or ""),
            "yen_price": yen_price,
            "previous_yen_price": previous_yen_price,
            "price_trend": trend_label(yen_price, previous_yen_price),
            "price_change_yen": (yen_price - previous_yen_price) if yen_price is not None and previous_yen_price is not None else None,
            "stock": stock,
            "previous_stock": previous_stock,
            "stock_trend": trend_label(stock, previous_stock),
            "stock_change": (stock - previous_stock) if stock is not None and previous_stock is not None else None,
            "weight_grams": weight_grams,
            "url": url,
            "scraped_at": clean_value(row.get("scraped_at")),
        }

        products.append(item)

    products.sort(key=lambda x: (x["product_order"], x["variant_order"]))

    unique_products = {}
    for item in products:
        key = f"{item['product_name']}|{item.get('url') or ''}"
        unique_products[key] = True

    payload = {
        "meta": {
            "supplier": "Otakuya",
            "source_file": input_file.name,
            "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "variant_count": len(products),
            "product_count": len(unique_products),
            "history_current_snapshot": current_snapshot,
            "history_previous_snapshot": previous_snapshot,
            "note": "Encrypted dashboard data with Otakuya trend context."
        },
        "products": products
    }

    return payload


def derive_key(password: str, salt: bytes) -> bytes:
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=250000,
    )
    return kdf.derive(password.encode("utf-8"))


def encrypt_payload(payload, password):
    salt = secrets.token_bytes(16)
    nonce = secrets.token_bytes(12)
    key = derive_key(password, salt)
    aesgcm = AESGCM(key)

    plaintext = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    ciphertext = aesgcm.encrypt(nonce, plaintext, None)

    return {
        "version": 1,
        "kdf": "PBKDF2-HMAC-SHA256",
        "iterations": 250000,
        "salt": base64.b64encode(salt).decode("ascii"),
        "nonce": base64.b64encode(nonce).decode("ascii"),
        "ciphertext": base64.b64encode(ciphertext).decode("ascii"),
    }


def main():
    password = os.getenv("DASHBOARD_PASSWORD", "").strip()
    if not password:
        raise SystemExit("DASHBOARD_PASSWORD fehlt in .env")

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    payload = build_payload()
    encrypted = encrypt_payload(payload, password)

    out = DATA_DIR / "products.enc.json"
    out.write_text(json.dumps(encrypted, ensure_ascii=False, indent=2), encoding="utf-8")

    print("Dashboard-Daten erzeugt:", out)
    print("Produkte:", payload["meta"]["product_count"])
    print("Varianten:", payload["meta"]["variant_count"])
    print("Quelle:", payload["meta"]["source_file"])
    print("History aktuell:", payload["meta"]["history_current_snapshot"])
    print("History vorher:", payload["meta"]["history_previous_snapshot"])


if __name__ == "__main__":
    main()
