let encryptedPayload = null;
let dashboardData = null;
let allProducts = [];
let cart = new Map();

const els = {};

document.addEventListener("DOMContentLoaded", () => {
  bindElements();
  bindEvents();
  loadEncryptedPayload();
});

function bindElements() {
  for (const id of [
    "unlockPanel", "unlockForm", "passwordInput", "unlockError", "dashboard",
    "statusText", "lastUpdated", "statProducts", "statVariants", "statAvailable", "statCartQty",
    "searchInput", "variantFilter", "sortSelect", "availableOnly", "reloadButton",
    "eurJpyInput", "fedexInput", "dutyInput", "vatInput", "clearCartButton",
    "sumQty", "sumWeight", "sumGoods", "sumShipping", "sumAllIn",
    "exportCsvButton", "copySummaryButton", "productTable", "visibleCount"
  ]) {
    els[id] = document.getElementById(id);
  }
}

function bindEvents() {
  els.unlockForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await unlockData();
  });

  for (const el of [els.searchInput, els.variantFilter, els.sortSelect, els.availableOnly]) {
    el.addEventListener("input", renderProducts);
    el.addEventListener("change", renderProducts);
  }

  for (const el of [els.eurJpyInput, els.fedexInput, els.dutyInput, els.vatInput]) {
    el.addEventListener("input", () => {
      updateCartSummary();
      renderProducts();
    });
  }

  els.reloadButton.addEventListener("click", async () => {
    if (!dashboardData) return;
    await loadEncryptedPayload(true);
    els.statusText.textContent = "neu geladen";
  });

  els.clearCartButton.addEventListener("click", () => {
    cart.clear();
    updateCartSummary();
    renderProducts();
  });

  els.exportCsvButton.addEventListener("click", exportCartCsv);
  els.copySummaryButton.addEventListener("click", copyCartSummary);
}

async function loadEncryptedPayload(force = false) {
  const url = `data/products.enc.json${force ? `?t=${Date.now()}` : ""}`;

  try {
    const res = await fetch(url, { cache: force ? "no-store" : "default" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    encryptedPayload = await res.json();
    els.statusText.textContent = "bereit";
  } catch (error) {
    els.statusText.textContent = "keine Daten";
    els.unlockError.textContent = `Daten konnten nicht geladen werden: ${error.message}`;
  }
}

async function unlockData() {
  els.unlockError.textContent = "";
  const password = els.passwordInput.value;

  if (!password) {
    els.unlockError.textContent = "Bitte Passwort eingeben.";
    return;
  }

  try {
    const decrypted = await decryptPayload(encryptedPayload, password);
    dashboardData = decrypted;
    allProducts = normalizeProducts(decrypted.products || []);
    els.unlockPanel.classList.add("hidden");
    els.dashboard.classList.remove("hidden");
    renderMeta();
    renderProducts();
    updateCartSummary();
  } catch (error) {
    els.unlockError.textContent = "Entsperren fehlgeschlagen. Passwort oder Daten prüfen.";
    console.error(error);
  }
}

async function decryptPayload(payload, password) {
  if (!payload || !payload.ciphertext) {
    throw new Error("Verschlüsselte Datei ist leer oder ungültig.");
  }

  const enc = new TextEncoder();
  const passKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  const salt = base64ToBytes(payload.salt);
  const iv = base64ToBytes(payload.nonce);

  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: payload.iterations || 200000,
      hash: "SHA-256"
    },
    passKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    base64ToBytes(payload.ciphertext)
  );

  return JSON.parse(new TextDecoder().decode(decrypted));
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function normalizeProducts(products) {
  return products.map((p, index) => {
    const variantType = classifyVariant(`${p.product_name || ""} ${p.variant || ""}`);

    return {
      id: p.id || `${p.product_name}|${p.variant}|${index}`,
      product_name: p.product_name || "",
      product_code: p.product_code || "",
      variant: p.variant || "-",
      variant_type: variantType,
      yen_price: Number(p.yen_price || 0),
      stock: Number(p.stock || 0),
      weight_grams: Number(p.weight_grams || 320),
      url: p.url || "",
      scraped_at: p.scraped_at || ""
    };
  });
}

function classifyVariant(text) {
  const value = String(text).toLowerCase();

  if (value.includes("case")) return "case";
  if (value.includes("pack")) return "pack";
  if (value.includes("no shrink") || value.includes("noshrink")) return "no_shrink";
  if (value.includes("damaged")) return "damaged";
  return "box";
}

function renderMeta() {
  const meta = dashboardData.meta || {};
  const uniqueProducts = new Set(allProducts.map(p => p.product_name)).size;
  const available = allProducts.filter(p => p.stock > 0 && !String(p.variant).toLowerCase().includes("sold out")).length;

  els.statProducts.textContent = uniqueProducts;
  els.statVariants.textContent = allProducts.length;
  els.statAvailable.textContent = available;
  els.statusText.textContent = "entsperrt";
  els.lastUpdated.textContent = meta.generated_at ? `Stand: ${meta.generated_at}` : "Stand geladen";
}

function getFilteredProducts() {
  const search = els.searchInput.value.trim().toLowerCase();
  const variant = els.variantFilter.value;
  const availableOnly = els.availableOnly.checked;

  let items = allProducts.filter(p => {
    const haystack = `${p.product_name} ${p.product_code} ${p.variant}`.toLowerCase();

    if (search && !haystack.includes(search)) return false;
    if (variant !== "all" && p.variant_type !== variant) return false;
    if (availableOnly && (p.stock <= 0 || String(p.variant).toLowerCase().includes("sold out"))) return false;

    return true;
  });

  const sort = els.sortSelect.value;

  items.sort((a, b) => {
    if (sort === "priceAsc") return a.yen_price - b.yen_price;
    if (sort === "priceDesc") return b.yen_price - a.yen_price;
    if (sort === "stockDesc") return b.stock - a.stock;
    if (sort === "weightAsc") return a.weight_grams - b.weight_grams;
    return a.product_name.localeCompare(b.product_name);
  });

  return items;
}

function renderProducts() {
  const tbody = els.productTable;
  tbody.innerHTML = "";

  const products = getFilteredProducts();
  els.visibleCount.textContent = `${products.length} Einträge sichtbar`;

  const fragment = document.createDocumentFragment();
  const template = document.getElementById("rowTemplate");

  const costs = calculateCartCosts();

  for (const product of products) {
    const row = template.content.firstElementChild.cloneNode(true);

    const qtyInput = row.querySelector(".qty-input");
    const link = row.querySelector(".product-link");
    const code = row.querySelector(".product-code");
    const pill = row.querySelector(".variant-pill");

    qtyInput.value = cart.get(product.id) || 0;
    qtyInput.addEventListener("input", () => {
      const qty = Math.max(0, Number(qtyInput.value || 0));

      if (qty > 0) cart.set(product.id, qty);
      else cart.delete(product.id);

      updateCartSummary();
      renderProducts();
    });

    link.textContent = product.product_name;
    link.href = product.url || "#";
    code.textContent = product.product_code || "ohne Code";

    pill.textContent = product.variant;
    pill.classList.add(`variant-${product.variant_type}`);

    row.querySelector(".price-cell").textContent = formatYen(product.yen_price);
    row.querySelector(".stock-cell").textContent = `${product.stock} pcs`;
    row.querySelector(".weight-cell").textContent = `${product.weight_grams} g`;

    const cost = costs.lines.get(product.id);
    row.querySelector(".unit-cost-cell").textContent = cost ? formatEuro(cost.allInPerUnit) : "-";

    const note = row.querySelector(".note-cell");
    note.textContent = getLineNote(product, cart.get(product.id) || 0);
    note.className = `note-cell ${note.textContent === "OK" ? "note-ok" : note.textContent ? "note-warn" : ""}`;

    fragment.appendChild(row);
  }

  tbody.appendChild(fragment);
}

function getInputs() {
  return {
    eurJpy: Math.max(1, Number(els.eurJpyInput.value || 170)),
    fedex: Math.max(0, Number(els.fedexInput.value || 30)),
    duty: Math.max(0, Number(els.dutyInput.value || 2.7)) / 100,
    vat: Math.max(0, Number(els.vatInput.value || 19)) / 100
  };
}

function calculateCartCosts() {
  const inputs = getInputs();
  const selected = allProducts
    .map(p => ({ product: p, qty: Number(cart.get(p.id) || 0) }))
    .filter(x => x.qty > 0);

  const lines = new Map();

  const totalQty = selected.reduce((sum, x) => sum + x.qty, 0);
  const totalWeightKg = selected.reduce((sum, x) => sum + (x.product.weight_grams * x.qty) / 1000, 0);
  const totalGoodsYen = selected.reduce((sum, x) => sum + x.product.yen_price * x.qty, 0);
  const shippingYen = findShippingYen(totalWeightKg);
  const shippingEur = shippingYen / inputs.eurJpy;

  let allInTotal = 0;

  for (const item of selected) {
    const p = item.product;
    const qty = item.qty;
    const lineWeightKg = (p.weight_grams * qty) / 1000;
    const goodsYenLine = p.yen_price * qty;
    const goodsEurLine = goodsYenLine / inputs.eurJpy;

    const weightShare = totalWeightKg > 0 ? lineWeightKg / totalWeightKg : 0;
    const qtyShare = totalQty > 0 ? qty / totalQty : 0;

    const shippingEurLine = shippingEur * weightShare;
    const fedexEurLine = inputs.fedex * qtyShare;
    const dutyEurLine = (goodsEurLine + shippingEurLine) * inputs.duty;
    const vatEurLine = (goodsEurLine + shippingEurLine) * inputs.vat;

    const allInLine = goodsEurLine + shippingEurLine + fedexEurLine + dutyEurLine + vatEurLine;
    allInTotal += allInLine;

    lines.set(p.id, {
      qty,
      goodsYenLine,
      lineWeightKg,
      goodsPerUnit: goodsEurLine / qty,
      shippingPerUnit: shippingEurLine / qty,
      fedexPerUnit: fedexEurLine / qty,
      dutyPerUnit: dutyEurLine / qty,
      vatPerUnit: vatEurLine / qty,
      allInPerUnit: allInLine / qty,
      allInLine
    });
  }

  return {
    totalQty,
    totalWeightKg,
    totalGoodsYen,
    shippingYen,
    shippingEur,
    allInTotal,
    lines
  };
}

function updateCartSummary() {
  const costs = calculateCartCosts();

  els.statCartQty.textContent = costs.totalQty;
  els.sumQty.textContent = `${costs.totalQty}`;
  els.sumWeight.textContent = `${costs.totalWeightKg.toFixed(3)} kg`;
  els.sumGoods.textContent = formatYen(costs.totalGoodsYen);
  els.sumShipping.textContent = formatYen(costs.shippingYen);
  els.sumAllIn.textContent = formatEuro(costs.allInTotal);
}

function findShippingYen(weightKg) {
  const shipping = (dashboardData && dashboardData.shipping) || [];

  if (!weightKg || weightKg <= 0) return 0;

  const sorted = [...shipping].sort((a, b) => Number(a.max_weight_kg) - Number(b.max_weight_kg));
  const match = sorted.find(row => Number(row.max_weight_kg) >= weightKg);

  return match ? Number(match.shipping_yen) : 0;
}

function getLineNote(product, qty) {
  if (!qty) return "";

  if (qty > product.stock) return "Menge größer als Bestand";
  if (product.variant_type === "case") return "Case prüfen";
  if (product.variant_type === "pack") return "Pack/Stream";
  if (product.variant_type === "no_shrink") return "No-Shrink";
  if (product.variant_type === "damaged") return "Damaged";
  return "OK";
}

function exportCartCsv() {
  const costs = calculateCartCosts();
  const rows = [[
    "qty", "product_name", "variant", "yen_price", "stock", "weight_grams",
    "goods_eur_per_unit", "shipping_eur_per_unit", "fedex_eur_per_unit",
    "duty_eur_per_unit", "vat_eur_per_unit", "all_in_cost_per_unit_eur", "url"
  ]];

  for (const product of allProducts) {
    const line = costs.lines.get(product.id);
    if (!line) continue;

    rows.push([
      line.qty,
      product.product_name,
      product.variant,
      product.yen_price,
      product.stock,
      product.weight_grams,
      round2(line.goodsPerUnit),
      round2(line.shippingPerUnit),
      round2(line.fedexPerUnit),
      round2(line.dutyPerUnit),
      round2(line.vatPerUnit),
      round2(line.allInPerUnit),
      product.url
    ]);
  }

  const csv = rows.map(row => row.map(csvEscape).join(";")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = `otakuya-cart-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();

  URL.revokeObjectURL(url);
}

async function copyCartSummary() {
  const costs = calculateCartCosts();
  const text = [
    "Otakuya Warenkorb",
    `Menge: ${costs.totalQty}`,
    `Gewicht: ${costs.totalWeightKg.toFixed(3)} kg`,
    `Warenwert: ${formatYen(costs.totalGoodsYen)}`,
    `Versand: ${formatYen(costs.shippingYen)}`,
    `All-in: ${formatEuro(costs.allInTotal)}`
  ].join("\n");

  await navigator.clipboard.writeText(text);
  els.copySummaryButton.textContent = "kopiert";
  setTimeout(() => els.copySummaryButton.textContent = "Kurzfazit kopieren", 1400);
}

function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function formatYen(value) {
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatEuro(value) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Number(value || 0));
}

function round2(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}
