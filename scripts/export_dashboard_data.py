import base64
import json
import os
import secrets
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


def derive_item_type(product_name, variant):
    text = f"{product_name or ''} {variant or ''}".lower()
    if "case" in text:
        return "case"
    if "pack" in text:
        return "pack"
    if "no shrink" in text or "noshrink" in text:
        return "no_shrink"
    if "damaged" in text:
        return "damaged"
    return "box"


def build_payload():
    input_file = find_latest_raw_export()
    df = pd.read_excel(input_file)

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

    products = []
    for _, row in df.iterrows():
        product_name = clean_value(row.get("product_name"))
        variant = clean_value(row.get("variant"))
        if not product_name:
            continue
        yen_price = clean_value(row.get("yen_price"))
        stock = clean_value(row.get("stock"))
        weight_grams = clean_value(row.get("weight_grams"))

        products.append({
            "product_order": int(clean_value(row.get("product_order")) or 999999),
            "variant_order": int(clean_value(row.get("variant_order")) or 999999),
            "supplier": "Otakuya",
            "product_name": product_name,
            "product_code": clean_value(row.get("product_code")),
            "variant": variant or "-",
            "variant_value": clean_value(row.get("variant_value")),
            "variant_sold_out_label": bool(clean_value(row.get("variant_sold_out_label"))),
            "item_type": derive_item_type(product_name, variant or ""),
            "yen_price": int(yen_price) if yen_price is not None else None,
            "stock": int(stock) if stock is not None else None,
            "weight_grams": int(weight_grams) if weight_grams is not None else None,
            "url": clean_value(row.get("url")),
            "scraped_at": clean_value(row.get("scraped_at")),
        })

    products.sort(key=lambda x: (x["product_order"], x["variant_order"]))
    unique = {}
    for item in products:
        unique[f"{item['product_name']}|{item.get('url') or ''}"] = True

    return {
        "meta": {
            "supplier": "Otakuya",
            "source_file": input_file.name,
            "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "variant_count": len(products),
            "product_count": len(unique),
            "note": "Encrypted dashboard data. Product order follows Otakuya quick-order page order."
        },
        "products": products
    }


def derive_key(password: str, salt: bytes) -> bytes:
    kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=250000)
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


if __name__ == "__main__":
    main()
