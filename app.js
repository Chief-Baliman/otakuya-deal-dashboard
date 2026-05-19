const state={payload:null,products:[],cart:new Map(),search:"",typeFilter:"all",availableOnly:false,sort:"page_order",eurJpy:170,fedex:30,dutyRate:.027,vatRate:.19};
const scenarios=[1,2,5,10,12,24,48];
const shippingTable=[[1,4500],[2,4500],[2.5,5500],[3,6100],[3.5,6700],[4,7300],[4.5,7900],[5,8400],[5.5,9900],[6,10400],[6.5,10800],[7,11300],[7.5,11800],[8,12200],[8.5,12700],[9,13200],[9.5,14900],[10,15400],[10.5,15700],[11,16100],[11.5,16500],[12,16900],[12.5,18500],[13,18900],[13.5,19300],[14,19800],[14.5,20200],[15,20600],[15.5,21000],[16,22900],[16.5,23300],[17,23800],[17.5,24200],[18,24600],[18.5,25100],[19,25500],[19.5,25900],[20,26300],[20.5,26800],[21,27700],[21.5,29000],[22,29000],[22.5,30100],[23,30100],[23.5,31600],[24,31600],[24.5,32900],[25,32900],[25.5,38900],[26,38900],[26.5,40200],[27,40200],[27.5,41500],[28,41500],[28.5,42800],[29,42800],[29.5,44100],[30,44100],[30.5,45400],[31,45400],[31.5,46800],[32,46800],[32.5,48100],[33,48100],[33.5,49400],[34,49400],[34.5,50700],[35,50700],[35.5,52000],[36,52000],[36.5,53300],[37,53300],[37.5,54700],[38,54700],[38.5,56000],[39,56000],[39.5,56800],[40,56800],[40.5,57000],[41,57000],[41.5,57200],[42,57200],[42.5,57400],[43,57400],[43.5,57700],[44,57700],[44.5,61500],[45,61500],[45.5,62800],[46,62800],[46.5,64100],[47,64100],[47.5,65300],[48,65300],[48.5,66600],[49,66600],[49.5,67800],[50,67800],[50.5,69100],[51,69100],[51.5,70400],[52,70400],[52.5,71500],[53,71500],[53.5,72900],[54,72900],[54.5,74200],[55,74200],[55.5,75400],[56,75400],[56.5,76700],[57,76700],[57.5,77900],[58,77900],[58.5,79200],[59,79200],[59.5,80500],[60,80500],[60.5,81700],[61,81700],[61.5,83000],[62,83000],[62.5,84300],[63,84300],[63.5,85500],[64,85500],[64.5,86800],[65,86800],[65.5,88100],[66,88100],[66.5,89300],[67,89300],[67.5,90600],[68,90600],[68.5,92600],[69,92600],[69.5,93900],[70,93900],[70.5,95300],[71,95300],[71.5,96600],[72,96600],[72.5,98000],[73,98000],[73.5,99300],[74,99300],[74.5,100600],[75,100600],[75.5,102000],[76,102000],[76.5,103300],[77,103300],[77.5,104700],[78,104700],[78.5,106000],[79,106000],[79.5,107400],[80,107400],[80.5,108700],[81,108700],[81.5,110000],[82,110000],[82.5,111400],[83,111400],[83.5,112700],[84,112700],[84.5,114100],[85,114100],[85.5,115400],[86,115400],[86.5,116700],[87,116700],[87.5,118100],[88,118100]];
const $=id=>document.getElementById(id);
function b64ToBytes(b64){return Uint8Array.from(atob(b64),c=>c.charCodeAt(0))}
async function deriveKey(password,salt,iterations){const enc=new TextEncoder();const baseKey=await crypto.subtle.importKey("raw",enc.encode(password),"PBKDF2",false,["deriveKey"]);return crypto.subtle.deriveKey({name:"PBKDF2",salt,iterations,hash:"SHA-256"},baseKey,{name:"AES-GCM",length:256},false,["decrypt"])}
async function decryptData(password){const res=await fetch(`data/products.enc.json?t=${Date.now()}`,{cache:"no-store"});const encrypted=await res.json();const salt=b64ToBytes(encrypted.salt);const nonce=b64ToBytes(encrypted.nonce);const ciphertext=b64ToBytes(encrypted.ciphertext);const key=await deriveKey(password,salt,encrypted.iterations||250000);const plain=await crypto.subtle.decrypt({name:"AES-GCM",iv:nonce},key,ciphertext);return JSON.parse(new TextDecoder().decode(plain))}
async function fetchFxRate(){const info=$("fxInfo");try{const res=await fetch("https://api.frankfurter.dev/v2/rates?base=EUR&quotes=JPY",{cache:"no-store"});if(!res.ok)throw new Error("FX HTTP "+res.status);const data=await res.json();const rate=data?.rates?.JPY;if(!rate)throw new Error("JPY missing");state.eurJpy=Number(rate);$("eurJpy").value=Number(rate).toFixed(4);info.textContent=`Automatisch geladen: ${Number(rate).toFixed(4)} JPY je EUR · ${data.date||""}`;renderProducts()}catch(e){info.textContent="Automatischer Kurs nicht erreichbar. Manuell prüfen."}}
function money(v){if(v==null||Number.isNaN(v))return"-";return new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(v)}
function yen(v){if(v==null||Number.isNaN(v))return"-";return`¥${new Intl.NumberFormat("de-DE").format(Math.round(v))}`}
function productKey(i){return`${i.product_name}||${i.url||""}`}
function variantKey(i){return`${i.product_name}||${i.variant}||${i.variant_value||""}||${i.url||""}`}
function isAvailable(i){return Number(i.stock||0)>0&&!String(i.variant||"").toLowerCase().includes("sold out")}
function deriveItemType(n,v){const t=`${n||""} ${v||""}`.toLowerCase();if(t.includes("case"))return"case";if(t.includes("pack"))return"pack";if(t.includes("no shrink")||t.includes("noshrink"))return"no_shrink";if(t.includes("damaged"))return"damaged";return"box"}
function normalizeProducts(products){return(products||[]).map((i,idx)=>({...i,product_order:Number(i.product_order||999999),variant_order:Number(i.variant_order||idx),yen_price:Number(i.yen_price||0),stock:Number(i.stock||0),weight_grams:Number(i.weight_grams||320),item_type:i.item_type||deriveItemType(i.product_name,i.variant)}))}
function filteredProducts(){let rows=[...state.products];if(state.search.trim()){const q=state.search.trim().toLowerCase();rows=rows.filter(x=>`${x.product_name} ${x.product_code||""} ${x.variant||""}`.toLowerCase().includes(q))}if(state.typeFilter!=="all")rows=rows.filter(x=>x.item_type===state.typeFilter);if(state.availableOnly)rows=rows.filter(isAvailable);if(state.sort==="page_order")rows.sort((a,b)=>(a.product_order-b.product_order)||(a.variant_order-b.variant_order));if(state.sort==="price_asc")rows.sort((a,b)=>(a.yen_price||0)-(b.yen_price||0));if(state.sort==="price_desc")rows.sort((a,b)=>(b.yen_price||0)-(a.yen_price||0));if(state.sort==="stock_desc")rows.sort((a,b)=>(b.stock||0)-(a.stock||0));if(state.sort==="name_asc")rows.sort((a,b)=>String(a.product_name).localeCompare(String(b.product_name)));return rows}
function groupRows(rows){const map=new Map();for(const item of rows){const key=productKey(item);if(!map.has(key))map.set(key,{product_order:item.product_order,product_name:item.product_name,product_code:item.product_code,url:item.url,variants:[]});map.get(key).variants.push(item)}const groups=[...map.values()];groups.sort((a,b)=>a.product_order-b.product_order);for(const g of groups)g.variants.sort((a,b)=>a.variant_order-b.variant_order);return groups}
function renderStats(rows){$("statLoadedProducts").textContent=new Set(state.products.map(productKey)).size;$("statLoadedVariants").textContent=state.products.length;$("statVisibleProducts").textContent=new Set(rows.map(productKey)).size;$("statVisibleVariants").textContent=rows.length;const m=state.payload?.meta||{};$("metaLine").textContent=`Letzter Export: ${m.generated_at||"-"} · Quelle: ${m.source_file||"-"} · Händler-Reihenfolge aktiv`}
function getShippingYen(kg){for(const [max,price] of shippingTable){if(kg<=max)return price}return null}
function singleScenarioCost(item,qty){const rate=Number(state.eurJpy||170),fedex=Number(state.fedex||30),dutyRate=Number(state.dutyRate||.027),vatRate=Number(state.vatRate||.19);const goodsYen=(item.yen_price||0)*qty,goodsEur=goodsYen/rate,weightKg=((item.weight_grams||320)*qty)/1000,shippingYen=getShippingYen(weightKg);if(!shippingYen)return null;const shippingEur=shippingYen/rate,dutyBase=goodsEur+shippingEur,duty=dutyBase*dutyRate,vat=dutyBase*vatRate,total=goodsEur+shippingEur+fedex+duty+vat;return total/qty}
function renderPreview(item){return scenarios.map(q=>{const c=singleScenarioCost(item,q);return`<div class="preview-pill"><span>${q}x</span><strong>${c?money(c):"-"}</strong></div>`}).join("")}
function renderProducts(){const rows=filteredProducts();renderStats(rows);const groups=groupRows(rows),container=$("productList");container.innerHTML="";for(const g of groups){const card=document.createElement("section");card.className="product-group";card.innerHTML=`<div class="product-header"><div><div class="product-order">#${g.product_order}</div><h3>${escapeHtml(g.product_name)}</h3><p>${escapeHtml(g.product_code||"")}</p></div><a href="${g.url||"#"}" target="_blank" rel="noopener">Otakuya öffnen</a></div><div class="variant-table"><div class="variant-row variant-head"><div>Menge</div><div>Variante</div><div>Preis</div><div>Bestand</div><div>Gewicht</div><div>Schnellvorschau All-in pro Stück</div></div>${g.variants.map(variantRow).join("")}</div>`;container.appendChild(card)}document.querySelectorAll(".qty-input").forEach(input=>input.addEventListener("input",e=>{const key=e.target.dataset.key,qty=Math.max(0,Number(e.target.value||0));if(qty>0)state.cart.set(key,qty);else state.cart.delete(key);renderCart()}));renderCart()}
function variantRow(item){const key=variantKey(item),qty=state.cart.get(key)||0,soldOut=!isAvailable(item);return`<div class="variant-row ${soldOut?"sold-out":""}"><div><input class="qty-input" inputmode="numeric" type="number" min="0" value="${qty}" data-key="${escapeAttr(key)}"/></div><div class="variant-title"><strong>${escapeHtml(item.variant||"-")}</strong><span class="badge ${escapeAttr(item.item_type)}">${escapeHtml(typeLabel(item.item_type))}</span>${soldOut?`<span class="badge sold">sold out</span>`:""}</div><div class="price">${yen(item.yen_price)}</div><div class="stock ${soldOut?"empty":"ok"}">${item.stock??"-"} pcs</div><div>${item.weight_grams??"-"} g</div><div class="preview">${renderPreview(item)}</div></div>`}
function typeLabel(t){return({box:"Box",case:"Case",pack:"Pack",no_shrink:"No Shrink",damaged:"Damaged"})[t]||t||"Box"}
function calculateCart(){const selected=[],byKey=new Map(state.products.map(x=>[variantKey(x),x]));for(const [key,qty]of state.cart.entries()){const item=byKey.get(key);if(item&&qty>0)selected.push({...item,qty})}if(!selected.length)return null;const rate=Number(state.eurJpy||170),fedex=Number(state.fedex||30),dutyRate=Number(state.dutyRate||.027),vatRate=Number(state.vatRate||.19);const totalQty=selected.reduce((s,x)=>s+x.qty,0),totalYen=selected.reduce((s,x)=>s+x.qty*(x.yen_price||0),0),totalWeightKg=selected.reduce((s,x)=>s+(x.qty*(x.weight_grams||320))/1000,0),shippingYen=getShippingYen(totalWeightKg);if(!shippingYen)return{selected,error:"Kein Versandwert für dieses Gewicht gefunden."};const shippingEur=shippingYen/rate;const lines=selected.map(item=>{const lineYen=item.qty*(item.yen_price||0),lineWeightKg=(item.qty*(item.weight_grams||320))/1000,weightShare=lineWeightKg/totalWeightKg,qtyShare=item.qty/totalQty,lineGoodsEur=lineYen/rate,lineShippingEur=shippingEur*weightShare,lineFedexEur=fedex*qtyShare,dutyBase=lineGoodsEur+lineShippingEur,duty=dutyBase*dutyRate,vat=dutyBase*vatRate,allInLine=lineGoodsEur+lineShippingEur+lineFedexEur+duty+vat,allInUnit=allInLine/item.qty;return{...item,lineYen,lineWeightKg,lineGoodsEur,lineShippingEur,lineFedexEur,duty,vat,allInLine,allInUnit}});return{selected,lines,totalQty,totalYen,totalWeightKg,shippingYen,shippingEur,allInTotal:lines.reduce((s,x)=>s+x.allInLine,0)}}
function renderCart(){state.eurJpy=Number($("eurJpy").value||170);state.fedex=Number($("fedex").value||30);state.dutyRate=Number($("dutyRate").value||.027);state.vatRate=Number($("vatRate").value||.19);const r=calculateCart(),box=$("cartBox");if(!r){box.innerHTML=`<p class="muted">Noch keine Mengen ausgewählt.</p>`;return}if(r.error){box.innerHTML=`<p class="error">${escapeHtml(r.error)}</p>`;return}box.innerHTML=`<div class="cart-summary-grid"><div><span>Menge</span><strong>${r.totalQty}</strong></div><div><span>Gewicht</span><strong>${r.totalWeightKg.toFixed(3)} kg</strong></div><div><span>Warenwert</span><strong>${yen(r.totalYen)}</strong></div><div><span>Versand</span><strong>${yen(r.shippingYen)}</strong></div><div><span>All-in gesamt</span><strong>${money(r.allInTotal)}</strong></div></div><div class="cart-lines">${r.lines.map(line=>`<div class="cart-line"><div><strong>${escapeHtml(line.product_name)}</strong><span>${escapeHtml(line.variant)} · ${line.qty}x · ${yen(line.yen_price)}</span></div><div><strong>${money(line.allInUnit)}</strong><span>pro Stück all-in</span></div></div>`).join("")}</div>`}
function exportCartCsv(){const r=calculateCart();if(!r||r.error)return;const header=["qty","product_name","variant","yen_price","stock","weight_grams","all_in_unit_eur","line_total_eur","url"];const lines=r.lines.map(x=>[x.qty,x.product_name,x.variant,x.yen_price,x.stock,x.weight_grams,x.allInUnit.toFixed(2),x.allInLine.toFixed(2),x.url||""]);const csv=[header,...lines].map(row=>row.map(cell=>`"${String(cell??"").replaceAll('"','""')}"`).join(",")).join("\n");const blob=new Blob([csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="otakuya_cart.csv";a.click();URL.revokeObjectURL(url)}
async function copySummary(){const r=calculateCart();if(!r||r.error)return;const text=[`Otakuya Warenkorb`,`Menge: ${r.totalQty}`,`Gewicht: ${r.totalWeightKg.toFixed(3)} kg`,`Warenwert: ${yen(r.totalYen)}`,`Versand: ${yen(r.shippingYen)}`,`All-in gesamt: ${money(r.allInTotal)}`].join("\n");await navigator.clipboard.writeText(text)}
function escapeHtml(t){return String(t??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function escapeAttr(t){return escapeHtml(t).replace(/"/g,"&quot;")}
function bindControls(){$("unlockBtn").addEventListener("click",async()=>{const pw=$("password").value;$("unlockError").textContent="";try{const payload=await decryptData(pw);state.payload=payload;state.products=normalizeProducts(payload.products);$("lockScreen").classList.add("hidden");$("dashboard").classList.remove("hidden");await fetchFxRate();renderProducts()}catch(e){$("unlockError").textContent="Passwort falsch oder Daten konnten nicht entschlüsselt werden.";console.error(e)}});$("password").addEventListener("keydown",e=>{if(e.key==="Enter")$("unlockBtn").click()});$("search").addEventListener("input",e=>{state.search=e.target.value;renderProducts()});$("typeFilter").addEventListener("change",e=>{state.typeFilter=e.target.value;renderProducts()});$("availableOnly").addEventListener("change",e=>{state.availableOnly=e.target.checked;renderProducts()});$("sort").addEventListener("change",e=>{state.sort=e.target.value;renderProducts()});["eurJpy","fedex","dutyRate","vatRate"].forEach(id=>$(id).addEventListener("input",()=>{renderProducts();renderCart()}));$("refreshBtn").addEventListener("click",()=>location.reload());$("clearCartBtn").addEventListener("click",()=>{state.cart.clear();renderProducts()});$("exportCsvBtn").addEventListener("click",exportCartCsv);$("copySummaryBtn").addEventListener("click",copySummary)}
document.addEventListener("DOMContentLoaded",bindControls);

/* Quick Filters added for ChiefCards workflow */

state.quickFilter = "all";

function isSoldOutVariant(item) {
  return String(item.variant || "").toLowerCase().includes("sold out") || Number(item.stock || 0) <= 0;
}

function isCleanSealedVariant(item) {
  const variant = String(item.variant || "").toLowerCase();
  return (
    variant === "sealed" ||
    variant === "sealed." ||
    variant === "unopened" ||
    variant === "good"
  );
}

function isLikelyBoosterDisplay(item) {
  const name = String(item.product_name || "").toLowerCase();
  const variant = String(item.variant || "").toLowerCase();
  const weight = Number(item.weight_grams || 0);

  const blockedWords = [
    "deck",
    "starter",
    "special box",
    "file",
    "collection",
    "trainer box",
    "promo",
    "attache",
    "jumbo",
    "golden box",
    "card set",
    "set mega",
    "premium trainer",
    "battle collection"
  ];

  const hasBlockedWord = blockedWords.some(word => name.includes(word));

  return (
    !hasBlockedWord &&
    isCleanSealedVariant(item) &&
    !variant.includes("case") &&
    !variant.includes("pack") &&
    !variant.includes("no shrink") &&
    !variant.includes("noshrink") &&
    !variant.includes("damaged") &&
    weight >= 190 &&
    weight <= 450
  );
}

function applyQuickFilter(rows) {
  if (state.quickFilter === "all") return rows;

  if (state.quickFilter === "sealed_displays") {
    return rows.filter(isLikelyBoosterDisplay);
  }

  if (state.quickFilter === "available_sealed_displays") {
    return rows.filter(item => isLikelyBoosterDisplay(item) && !isSoldOutVariant(item));
  }

  if (state.quickFilter === "cases") {
    return rows.filter(item => String(item.variant || "").toLowerCase().includes("case"));
  }

  if (state.quickFilter === "no_shrink") {
    return rows.filter(item => {
      const v = String(item.variant || "").toLowerCase();
      return v.includes("no shrink") || v.includes("noshrink");
    });
  }

  if (state.quickFilter === "damaged") {
    return rows.filter(item => String(item.variant || "").toLowerCase().includes("damaged"));
  }

  if (state.quickFilter === "packs") {
    return rows.filter(item => String(item.variant || "").toLowerCase().includes("pack"));
  }

  if (state.quickFilter === "other_sealed") {
    return rows.filter(item => {
      const name = String(item.product_name || "").toLowerCase();
      const v = String(item.variant || "").toLowerCase();
      const likelyOther = [
        "deck",
        "starter",
        "special box",
        "file",
        "collection",
        "trainer box",
        "promo",
        "attache",
        "jumbo",
        "golden box",
        "card set",
        "premium trainer"
      ].some(word => name.includes(word));

      return likelyOther && !v.includes("damaged") && !v.includes("sold out");
    });
  }

  return rows;
}

const originalFilteredProducts = filteredProducts;

filteredProducts = function () {
  return applyQuickFilter(originalFilteredProducts());
};

function renderQuickFilters() {
  if (document.getElementById("quickFilterBar")) return;

  const productTitle = Array.from(document.querySelectorAll("h1,h2"))
    .find(el => String(el.textContent || "").toLowerCase().includes("live-produkte"));

  const target = productTitle?.parentElement || document.getElementById("productList")?.parentElement || document.body;

  const bar = document.createElement("div");
  bar.id = "quickFilterBar";
  bar.className = "quick-filter-bar";
  bar.innerHTML = `
    <button data-qf="all">Alle</button>
    <button data-qf="sealed_displays">Nur sealed Displays</button>
    <button data-qf="available_sealed_displays">Verfügbare sealed Displays</button>
    <button data-qf="cases">Cases</button>
    <button data-qf="no_shrink">No Shrink</button>
    <button data-qf="damaged">Beschädigt</button>
    <button data-qf="packs">Packs</button>
    <button data-qf="other_sealed">Boxen / Sets</button>
  `;

  target.insertBefore(bar, productTitle ? productTitle.nextSibling : target.firstChild);

  bar.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      state.quickFilter = btn.dataset.qf;
      bar.querySelectorAll("button").forEach(x => x.classList.remove("active"));
      btn.classList.add("active");
      renderProducts();
    });
  });

  bar.querySelector('[data-qf="all"]').classList.add("active");
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(renderQuickFilters, 400);
});

/* Germany comparison workflow */

state.compareFilter = "all";

function getCompareStore() {
  try {
    return JSON.parse(localStorage.getItem("chiefcards_de_compare") || "{}");
  } catch {
    return {};
  }
}

function saveCompareStore(store) {
  localStorage.setItem("chiefcards_de_compare", JSON.stringify(store));
}

function getCompareEntry(key) {
  const store = getCompareStore();
  return store[key] || { dePrice: "", source: "", note: "" };
}

function setCompareEntry(key, patch) {
  const store = getCompareStore();
  store[key] = { ...(store[key] || {}), ...patch, updatedAt: new Date().toISOString() };
  saveCompareStore(store);
}

function buildSearchUrl(source, item) {
  const q = encodeURIComponent(`${item.product_name} ${item.variant || ""} Pokemon`);
  if (source === "tcgcheck") return `https://www.tcgcheck.de/search?q=${q}`;
  if (source === "cardmarket") return `https://www.cardmarket.com/de/Pokemon/Products/Search?searchString=${q}`;
  if (source === "ebay") return `https://www.ebay.de/sch/i.html?_nkw=${q}`;
  return `https://www.google.com/search?q=${q}`;
}

function bestPreviewCost(item) {
  const qty = Number(item._selectedPreviewQty || 12);
  const rate = Number(state.eurJpy || 170);
  const fedex = Number(state.fedex || 30);
  const weight = Number(item.weight_grams || 320);
  const yenPrice = Number(item.yen_price || 0);

  const totalWeightKg = (weight * qty) / 1000;
  const shippingYen = getShippingYen(totalWeightKg);

  if (!shippingYen || !yenPrice) return null;

  const goodsEurTotal = (yenPrice * qty) / rate;
  const shippingEurTotal = shippingYen / rate;
  const fedexEurPerUnit = fedex / qty;

  const dutyBase = goodsEurTotal + shippingEurTotal;
  const dutyTotal = dutyBase * Number(state.dutyRate || 0.027);
  const vatTotal = dutyBase * Number(state.vatRate || 0.19);

  return (goodsEurTotal + shippingEurTotal + dutyTotal + vatTotal + fedex) / qty;
}

function compareStatus(item, dePrice) {
  const japanCost = bestPreviewCost(item);

  if (!japanCost || !dePrice) {
    return { label: "-", cls: "neutral", diff: null, pct: null, japanCost };
  }

  const diff = Number(dePrice) - japanCost;
  const pct = diff / Number(dePrice);

  if (pct >= 0.20) return { label: "Japan stark", cls: "good", diff, pct, japanCost };
  if (pct >= 0.10) return { label: "Japan interessant", cls: "okay", diff, pct, japanCost };
  if (pct >= 0.05) return { label: "knapp prüfen", cls: "watch", diff, pct, japanCost };
  if (diff > 0) return { label: "zu knapp", cls: "weak", diff, pct, japanCost };
  return { label: "DE günstiger", cls: "bad", diff, pct, japanCost };
}

const originalRenderProductsForCompare = renderProducts;

renderProducts = function () {
  originalRenderProductsForCompare();
  injectCompareTools();
};

function injectCompareTools() {
  document.querySelectorAll(".variant-row:not(.variant-head)").forEach(row => {
    if (row.querySelector(".de-compare-box")) return;

    const qtyInput = row.querySelector(".qty-input");
    if (!qtyInput) return;

    const key = qtyInput.dataset.key;
    const item = state.products.find(x => variantKey(x) === key);
    if (!item) return;

    const entry = getCompareEntry(key);
    const dePrice = Number(String(entry.dePrice || "").replace(",", "."));
    const status = compareStatus(item, dePrice);

    const box = document.createElement("div");
    box.className = "de-compare-box";
    box.innerHTML = `
      <div class="de-compare-title">DE-Vergleich</div>
      <div class="de-compare-grid">
        <input class="de-price-input" type="number" min="0" step="0.01" placeholder="DE €" value="${entry.dePrice || ""}">
        <select class="de-source-select">
          <option value="">Quelle</option>
          <option value="tcgcheck">TCGCheck</option>
          <option value="cardmarket">Cardmarket</option>
          <option value="ebay">eBay</option>
          <option value="google">Google</option>
          <option value="shop">DE-Shop</option>
          <option value="wholesale">DE-Großhandel</option>
        </select>
        <button class="de-search-btn">Suchen</button>
      </div>
      <div class="de-compare-result ${status.cls}">
        <span>JP 12x: ${status.japanCost ? money(status.japanCost) : "-"}</span>
        <strong>${status.label}</strong>
        <span>${status.diff !== null ? `${money(status.diff)} / ${(status.pct * 100).toFixed(1)} %` : ""}</span>
      </div>
    `;

    const sourceSelect = box.querySelector(".de-source-select");
    sourceSelect.value = entry.source || "";

    box.querySelector(".de-price-input").addEventListener("input", e => {
      setCompareEntry(key, { dePrice: e.target.value });
      injectCompareRefresh();
    });

    sourceSelect.addEventListener("change", e => {
      setCompareEntry(key, { source: e.target.value });
    });

    box.querySelector(".de-search-btn").addEventListener("click", () => {
      const source = sourceSelect.value || "google";
      window.open(buildSearchUrl(source, item), "_blank", "noopener");
    });

    row.appendChild(box);
  });
}

function injectCompareRefresh() {
  renderCart();
}

function renderCompareFilter() {
  if (document.getElementById("compareFilterBar")) return;

  const quickBar = document.getElementById("quickFilterBar");
  if (!quickBar) return;

  const bar = document.createElement("div");
  bar.id = "compareFilterBar";
  bar.className = "quick-filter-bar compare-filter-bar";
  bar.innerHTML = `
    <button data-cf="all" class="active">Vergleich: Alle</button>
    <button data-cf="japan_good">Japan lohnt sich</button>
    <button data-cf="de_filled">DE-Preis eingetragen</button>
    <button data-cf="de_missing">DE-Preis fehlt</button>
  `;

  quickBar.parentElement.insertBefore(bar, quickBar.nextSibling);

  bar.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      state.compareFilter = btn.dataset.cf;
      bar.querySelectorAll("button").forEach(x => x.classList.remove("active"));
      btn.classList.add("active");
      applyCompareVisibility();
    });
  });
}

function applyCompareVisibility() {
  document.querySelectorAll(".variant-row:not(.variant-head)").forEach(row => {
    const qtyInput = row.querySelector(".qty-input");
    if (!qtyInput) return;

    const key = qtyInput.dataset.key;
    const item = state.products.find(x => variantKey(x) === key);
    const entry = getCompareEntry(key);
    const dePrice = Number(String(entry.dePrice || "").replace(",", "."));
    const status = item ? compareStatus(item, dePrice) : null;

    let show = true;

    if (state.compareFilter === "de_filled") show = !!dePrice;
    if (state.compareFilter === "de_missing") show = !dePrice;
    if (state.compareFilter === "japan_good") {
      show = !!dePrice && status && ["good", "okay"].includes(status.cls);
    }

    row.style.display = show ? "" : "none";
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    renderCompareFilter();
    injectCompareTools();
  }, 900);
});

/* Firebase DE price sync, no source field, 12x basis */

state.dePricesRemote = {};
state.firebaseReady = false;

function firebaseSafeKey(key) {
  try {
    const decoded = decodeURIComponent(String(key || ""));
    return encodeURIComponent(decoded)
      .replaceAll(".", "%2E")
      .replaceAll("#", "%23")
      .replaceAll("$", "%24")
      .replaceAll("[", "%5B")
      .replaceAll("]", "%5D")
      .replaceAll("/", "%2F");
  } catch {
    return encodeURIComponent(String(key || ""))
      .replaceAll(".", "%2E")
      .replaceAll("#", "%23")
      .replaceAll("$", "%24")
      .replaceAll("[", "%5B")
      .replaceAll("]", "%5D")
      .replaceAll("/", "%2F");
  }
}

function sanitizeCompareStore(store) {
  const out = {};

  for (const [key, value] of Object.entries(store || {})) {
    const safeKey = firebaseSafeKey(key);
    const current = out[safeKey];

    if (!current) {
      out[safeKey] = value;
      continue;
    }

    const currentTime = Date.parse(current.updatedAt || 0) || 0;
    const nextTime = Date.parse(value.updatedAt || 0) || 0;
    out[safeKey] = nextTime >= currentTime ? value : current;
  }

  return out;
}

function initDePriceFirebaseSync() {
  try {
    if (!window.firebase || !window.CHIEF_FIREBASE_CONFIG) {
      console.warn("Firebase SDK oder Config fehlt.");
      return;
    }

    if (!firebase.apps.length) {
      firebase.initializeApp(window.CHIEF_FIREBASE_CONFIG);
    }

    state.firebaseDb = firebase.database();
    state.firebaseReady = true;

    state.firebaseDb.ref("otakuyaDePrices").on("value", snap => {
      state.dePricesRemote = snap.val() || {};

      try {
        localStorage.setItem("chiefcards_de_compare_cache", JSON.stringify(state.dePricesRemote));
      } catch {}

      if (state.products && state.products.length) {
        renderProducts();
      }
    });

    console.log("Firebase DE-Preis-Sync aktiv.");
  } catch (e) {
    console.warn("Firebase Sync konnte nicht gestartet werden:", e);
  }
}

function getCompareStore() {
  if (state.dePricesRemote && Object.keys(state.dePricesRemote).length) {
    return state.dePricesRemote;
  }

  try {
    return JSON.parse(localStorage.getItem("chiefcards_de_compare_cache") || "{}");
  } catch {
    return {};
  }
}

function getCompareEntry(key) {
  const store = getCompareStore();
  return store[firebaseSafeKey(key)] || { dePrice: "", updatedAt: "" };
}

let dePriceSaveTimers = {};

function setCompareEntry(key, patch) {
  const safeKey = firebaseSafeKey(key);
  const current = getCompareEntry(key);

  const entry = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString()
  };

  state.dePricesRemote[safeKey] = entry;

  try {
    localStorage.setItem("chiefcards_de_compare_cache", JSON.stringify(state.dePricesRemote));
  } catch {}

  if (dePriceSaveTimers[safeKey]) {
    clearTimeout(dePriceSaveTimers[safeKey]);
  }

  dePriceSaveTimers[safeKey] = setTimeout(() => {
    if (!state.firebaseReady || !state.firebaseDb) {
      console.warn("Firebase noch nicht bereit, DE-Preis nur lokal gespeichert.");
      return;
    }

    state.firebaseDb.ref("otakuyaDePrices/" + safeKey).set(entry).catch(err => {
      console.warn("DE-Preis konnte nicht in Firebase gespeichert werden:", err);
    });
  }, 450);
}

function formatDateTime(value) {
  if (!value) return "Noch kein DE-Preis gespeichert";

  try {
    return "Zuletzt geändert: " + new Intl.DateTimeFormat("de-DE", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(new Date(value));
  } catch {
    return "Zuletzt geändert: " + value;
  }
}

function buildSearchUrl(source, item) {
  const q = encodeURIComponent(`${item.product_name} ${item.variant || ""} Pokemon`);
  if (source === "tcgcheck") return `https://www.tcgcheck.de/search?q=${q}`;
  if (source === "cardmarket") return `https://www.cardmarket.com/de/Pokemon/Products/Search?searchString=${q}`;
  if (source === "ebay") return `https://www.ebay.de/sch/i.html?_nkw=${q}`;
  return `https://www.google.com/search?q=${q}`;
}

function bestPreviewCost(item) {
  const qty = 12;
  const rate = Number(state.eurJpy || 170);
  const fedex = Number(state.fedex || 30);
  const weight = Number(item.weight_grams || 320);
  const yenPrice = Number(item.yen_price || 0);

  const totalWeightKg = (weight * qty) / 1000;
  const shippingYen = getShippingYen(totalWeightKg);

  if (!shippingYen || !yenPrice) return null;

  const goodsEurTotal = (yenPrice * qty) / rate;
  const shippingEurTotal = shippingYen / rate;
  const dutyBase = goodsEurTotal + shippingEurTotal;
  const dutyTotal = dutyBase * Number(state.dutyRate || 0.027);
  const vatTotal = dutyBase * Number(state.vatRate || 0.19);

  return (goodsEurTotal + shippingEurTotal + dutyTotal + vatTotal + fedex) / qty;
}

function compareStatus(item, dePrice) {
  const japanCost = bestPreviewCost(item);

  if (!japanCost || !dePrice) {
    return { label: "-", cls: "neutral", diff: null, pct: null, japanCost };
  }

  const diff = Number(dePrice) - japanCost;
  const pct = diff / Number(dePrice);

  if (pct >= 0.20) return { label: "Japan stark", cls: "good", diff, pct, japanCost };
  if (pct >= 0.10) return { label: "Japan interessant", cls: "okay", diff, pct, japanCost };
  if (pct >= 0.05) return { label: "knapp prüfen", cls: "watch", diff, pct, japanCost };
  if (diff > 0) return { label: "zu knapp", cls: "weak", diff, pct, japanCost };
  return { label: "DE günstiger", cls: "bad", diff, pct, japanCost };
}

function injectCompareTools() {
  document.querySelectorAll(".variant-row:not(.variant-head)").forEach(row => {
    const oldBox = row.querySelector(".de-compare-box");
    if (oldBox) oldBox.remove();

    const qtyInput = row.querySelector(".qty-input");
    if (!qtyInput) return;

    const key = qtyInput.dataset.key;
    const item = state.products.find(x => variantKey(x) === key);
    if (!item) return;

    const entry = getCompareEntry(key);
    const dePrice = Number(String(entry.dePrice || "").replace(",", "."));
    const status = compareStatus(item, dePrice);

    const box = document.createElement("div");
    box.className = "de-compare-box";
    box.innerHTML = `
      <div class="de-compare-title">DE-Vergleich</div>
      <div class="de-compare-grid no-source">
        <input class="de-price-input" type="number" min="0" step="0.01" placeholder="DE €" value="${entry.dePrice || ""}">
        <button class="de-search-btn" data-search="tcgcheck">TCGCheck</button>
        <button class="de-search-btn" data-search="cardmarket">Cardmarket</button>
        <button class="de-search-btn" data-search="ebay">eBay</button>
      </div>
      <div class="de-price-updated">${formatDateTime(entry.updatedAt)}</div>
      <div class="de-compare-result ${status.cls}">
        <span>JP 12x: ${status.japanCost ? money(status.japanCost) : "-"}</span>
        <strong>${status.label}</strong>
        <span>${status.diff !== null ? `${money(status.diff)} / ${(status.pct * 100).toFixed(1)} %` : ""}</span>
      </div>
    `;

    box.querySelector(".de-price-input").addEventListener("input", e => {
      setCompareEntry(key, { dePrice: e.target.value });
      const newEntry = getCompareEntry(key);
      box.querySelector(".de-price-updated").textContent = formatDateTime(newEntry.updatedAt);

      const newStatus = compareStatus(item, Number(String(e.target.value || "").replace(",", ".")));
      const result = box.querySelector(".de-compare-result");
      result.className = "de-compare-result " + newStatus.cls;
      result.innerHTML = `
        <span>JP 12x: ${newStatus.japanCost ? money(newStatus.japanCost) : "-"}</span>
        <strong>${newStatus.label}</strong>
        <span>${newStatus.diff !== null ? `${money(newStatus.diff)} / ${(newStatus.pct * 100).toFixed(1)} %` : ""}</span>
      `;
    });

    box.querySelectorAll(".de-search-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        window.open(buildSearchUrl(btn.dataset.search, item), "_blank", "noopener");
      });
    });

    row.appendChild(box);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(initDePriceFirebaseSync, 300);
});

/* Cleaner search terms for TCGCheck/Cardmarket/eBay */

function cleanSetSearchName(item) {
  let name = String(item.product_name || "");

  const removeParts = [
    /\bbox\b/gi,
    /\bdisplay\b/gi,
    /\bsealed\b/gi,
    /\bunopened\b/gi,
    /\bcase\b/gi,
    /\bpack\b/gi,
    /\bno shrink\b/gi,
    /\bnoshrink\b/gi,
    /\bdamaged\b/gi,
    /\bsold out\b/gi,
    /\(\s*sealed\s*\)/gi,
    /\(\s*sold out\s*\)/gi
  ];

  for (const pattern of removeParts) {
    name = name.replace(pattern, " ");
  }

  // Set-Codes am Ende entfernen, z. B. M1S, M1L, M2a, sv11b, s10a, SM9
  name = name.replace(/\b(M\d+[a-z]?|SV\d+[a-z]?|S\d+[a-z]?|SM\d+[a-z]?|M\d+[A-Z]?)\b/gi, " ");

  // Klammern und doppelte Leerzeichen bereinigen
  name = name.replace(/[()]/g, " ");
  name = name.replace(/\s+/g, " ").trim();

  return name;
}

function isDisplaySearch(item) {
  const variant = String(item.variant || "").toLowerCase();
  const weight = Number(item.weight_grams || 0);
  const type = String(item.item_type || "").toLowerCase();

  if (variant.includes("case")) return false;
  if (variant.includes("pack")) return false;
  if (variant.includes("damaged")) return false;

  // typische JP-Boosterbox-Gewichte
  if (weight >= 190 && weight <= 450) return true;

  return type === "box";
}

function buildCleanSearchTerm(item, source) {
  const setName = cleanSetSearchName(item);

  if (isDisplaySearch(item)) {
    return `${setName} Booster Box`;
  }

  return `${setName} Pokemon`;
}

buildSearchUrl = function (source, item) {
  const q = encodeURIComponent(buildCleanSearchTerm(item, source));

  if (source === "tcgcheck") {
    return `https://www.tcgcheck.de/search?q=${q}`;
  }

  if (source === "cardmarket") {
    return `https://www.cardmarket.com/de/Pokemon/Products/Search?searchString=${q}`;
  }

  if (source === "ebay") {
    return `https://www.ebay.de/sch/i.html?_nkw=${q}`;
  }

  return `https://www.google.com/search?q=${q}`;
};

/* Robust DE price sync fix */

function mergeCompareStores(localStore, remoteStore) {
  const merged = { ...(localStore || {}) };

  for (const [key, remoteEntry] of Object.entries(remoteStore || {})) {
    const localEntry = merged[key];

    if (!localEntry) {
      merged[key] = remoteEntry;
      continue;
    }

    const localTime = Date.parse(localEntry.updatedAt || 0) || 0;
    const remoteTime = Date.parse(remoteEntry.updatedAt || 0) || 0;

    merged[key] = remoteTime >= localTime ? remoteEntry : localEntry;
  }

  return merged;
}

function readLocalCompareCache() {
  try {
    return JSON.parse(localStorage.getItem("chiefcards_de_compare_cache") || "{}");
  } catch {
    return {};
  }
}

function writeLocalCompareCache(store) {
  try {
    localStorage.setItem("chiefcards_de_compare_cache", JSON.stringify(store || {}));
  } catch (e) {
    console.warn("LocalStorage konnte nicht geschrieben werden:", e);
  }
}

function uploadLocalDePricesToFirebase(force = false) {
  try {
    if (!state.firebaseReady || !state.firebaseDb) {
      console.warn("Firebase nicht bereit. Upload der DE-Preise nicht möglich.");
      return Promise.resolve(false);
    }

    const localStore = readLocalCompareCache();
    const remoteStore = state.dePricesRemote || {};
    const merged = mergeCompareStores(localStore, remoteStore);
    const localCount = Object.keys(localStore || {}).length;
    const remoteCount = Object.keys(remoteStore || {}).length;
    const mergedCount = Object.keys(merged || {}).length;

    if (!force && (!localCount || remoteCount >= mergedCount)) {
      console.log("Kein DE-Preis-Upload nötig.", { localCount, remoteCount, mergedCount });
      return Promise.resolve(false);
    }

    state.dePricesRemote = merged;
    writeLocalCompareCache(merged);

    return state.firebaseDb.ref("otakuyaDePrices").set(merged).then(() => {
      console.log("DE-Preise nach Firebase hochgeladen.", { localCount, remoteCount, mergedCount });
      const el = document.getElementById("dePriceSyncStatus");
      if (el) el.textContent = `DE-Preise synchronisiert: ${mergedCount}`;
      return true;
    }).catch(err => {
      console.warn("DE-Preise konnten nicht hochgeladen werden:", err);
      const el = document.getElementById("dePriceSyncStatus");
      if (el) el.textContent = "DE-Preis-Sync Fehler";
      return false;
    });
  } catch (e) {
    console.warn("Upload-Funktion für DE-Preise fehlgeschlagen:", e);
    return Promise.resolve(false);
  }
}

getCompareStore = function () {
  const localStore = sanitizeCompareStore(readLocalCompareCache());
  const remoteStore = sanitizeCompareStore(state.dePricesRemote || {});
  return sanitizeCompareStore(mergeCompareStores(localStore, remoteStore));
};

getCompareEntry = function (key) {
  const store = getCompareStore();
  return store[firebaseSafeKey(key)] || { dePrice: "", updatedAt: "" };
};

setCompareEntry = function (key, patch) {
  const safeKey = firebaseSafeKey(key);
  const store = getCompareStore();

  const entry = {
    ...(store[safeKey] || {}),
    ...patch,
    updatedAt: new Date().toISOString()
  };

  store[safeKey] = entry;
  state.dePricesRemote = store;

  writeLocalCompareCache(store);

  if (dePriceSaveTimers[safeKey]) {
    clearTimeout(dePriceSaveTimers[safeKey]);
  }

  dePriceSaveTimers[safeKey] = setTimeout(() => {
    if (!state.firebaseReady || !state.firebaseDb) {
      console.warn("Firebase nicht bereit. DE-Preis bleibt lokal gespeichert.");
      return;
    }

    state.firebaseDb.ref("otakuyaDePrices/" + safeKey).set(entry)
      .then(() => console.log("DE-Preis in Firebase gespeichert:", safeKey))
      .catch(err => console.warn("DE-Preis konnte nicht in Firebase gespeichert werden:", err));
  }, 500);
};

initDePriceFirebaseSync = function () {
  try {
    if (!window.firebase || !window.CHIEF_FIREBASE_CONFIG) {
      console.warn("Firebase SDK oder Config fehlt.");
      return;
    }

    if (!firebase.apps.length) {
      firebase.initializeApp(window.CHIEF_FIREBASE_CONFIG);
    }

    state.firebaseDb = firebase.database();
    state.firebaseReady = true;

    state.firebaseDb.ref("otakuyaDePrices").on("value", snap => {
      const remoteStore = sanitizeCompareStore(snap.val() || {});
      const localStore = sanitizeCompareStore(readLocalCompareCache());
      const merged = sanitizeCompareStore(mergeCompareStores(localStore, remoteStore));

      state.dePricesRemote = merged;
      writeLocalCompareCache(merged);

      const localCount = Object.keys(localStore || {}).length;
      const remoteCount = Object.keys(remoteStore || {}).length;
      const mergedCount = Object.keys(merged || {}).length;

      const statusEl = document.getElementById("dePriceSyncStatus");
      if (statusEl) {
        statusEl.textContent = `DE-Preise: lokal ${localCount} | Firebase ${remoteCount} | aktiv ${mergedCount}`;
      }

      if (localCount > 0 && remoteCount < mergedCount) {
        uploadLocalDePricesToFirebase(false);
      }

      if (state.products && state.products.length) {
        renderProducts();
      }
    });

    console.log("Firebase DE-Preis-Sync aktiv.");
  } catch (e) {
    console.warn("Firebase Sync konnte nicht gestartet werden:", e);
  }
};

/* Smart Japan buying recommendation */

function trendText(item) {
  const parts = [];

  if (item.price_trend === "down") {
    parts.push(`JP-Preis fällt (${yen(item.price_change_yen)})`);
  } else if (item.price_trend === "up") {
    parts.push(`JP-Preis steigt (+${yen(item.price_change_yen)})`);
  } else if (item.price_trend === "flat") {
    parts.push("JP-Preis stabil");
  }

  if (item.stock_trend === "down") {
    parts.push(`Bestand sinkt (${item.stock_change})`);
  } else if (item.stock_trend === "up") {
    parts.push(`Bestand steigt (+${item.stock_change})`);
  } else if (item.stock_trend === "flat") {
    parts.push("Bestand stabil");
  }

  return parts.join(" · ") || "Noch kein Trend";
}

function smartRecommendationForDisplay(item) {
  const key = variantKey(item);
  const entry = getCompareEntry(key);
  const dePrice = Number(String(entry.dePrice || "").replace(",", "."));
  const japanCost = bestPreviewCost(item);

  if (!dePrice || !japanCost) {
    return {
      recommendation: "DE-Preis fehlt",
      cls: "missing",
      score: -999,
      reason: "Noch keinen deutschen Vergleichspreis eingetragen.",
      dePrice,
      japanCost,
      diff: null,
      pct: null
    };
  }

  const diff = dePrice - japanCost;
  const pct = diff / dePrice;
  let score = 0;
  const reasons = [];

  if (pct >= 0.20) {
    score += 5;
    reasons.push("deutlicher Vorteil gegenüber DE");
  } else if (pct >= 0.10) {
    score += 3;
    reasons.push("spürbarer Vorteil gegenüber DE");
  } else if (pct >= 0.05) {
    score += 1;
    reasons.push("kleiner Vorteil gegenüber DE");
  } else if (diff > 0) {
    score -= 1;
    reasons.push("Vorteil zu knapp");
  } else {
    score -= 5;
    reasons.push("DE ist günstiger oder gleichauf");
  }

  if (item.price_trend === "down") {
    score += 1;
    reasons.push("Japan-Preis fällt");
  }

  if (item.price_trend === "up") {
    score -= 2;
    reasons.push("Japan-Preis steigt");
  }

  if (item.stock_trend === "down") {
    if (Number(item.stock || 0) > 0) {
      score += 1;
      reasons.push("Bestand sinkt, ggf. zeitkritisch");
    }
  }

  if (item.stock_trend === "up") {
    score -= 0.5;
    reasons.push("Bestand steigt, kein akuter Druck");
  }

  if (Number(item.stock || 0) <= 0) {
    score -= 100;
    reasons.push("nicht verfügbar");
  } else if (Number(item.stock || 0) <= 5) {
    score += 0.5;
    reasons.push("niedriger Bestand");
  }

  let recommendation = "Beobachten";
  let cls = "watch";

  if (score >= 5) {
    recommendation = "Japan bestellen";
    cls = "buy";
  } else if (score >= 2.5) {
    recommendation = "Japan prüfen";
    cls = "check";
  } else if (score >= 0) {
    recommendation = "Beobachten";
    cls = "watch";
  } else {
    recommendation = "Nicht in Japan bestellen";
    cls = "no";
  }

  return {
    recommendation,
    cls,
    score,
    reason: reasons.join(" · "),
    dePrice,
    japanCost,
    diff,
    pct
  };
}

function getSmartDisplayRows() {
  if (!state.products || !state.products.length) return [];

  return state.products
    .filter(item => {
      if (typeof isLikelyBoosterDisplay === "function") return isLikelyBoosterDisplay(item);

      const variant = String(item.variant || "").toLowerCase();
      const weight = Number(item.weight_grams || 0);
      return variant === "sealed" && weight >= 190 && weight <= 450;
    })
    .map(item => ({
      item,
      rec: smartRecommendationForDisplay(item)
    }))
    .sort((a, b) => {
      if (b.rec.score !== a.rec.score) return b.rec.score - a.rec.score;
      return (b.rec.pct || -999) - (a.rec.pct || -999);
    });
}

function renderSmartRecommendationBox() {
  const rows = getSmartDisplayRows();
  const evaluated = rows.filter(r => r.rec.dePrice && r.rec.japanCost);
  const buy = evaluated.filter(r => r.rec.cls === "buy");
  const check = evaluated.filter(r => r.rec.cls === "check");
  const watch = evaluated.filter(r => r.rec.cls === "watch");
  const no = evaluated.filter(r => r.rec.cls === "no");
  const missing = rows.filter(r => !r.rec.dePrice);

  const priceDown = rows.filter(r => r.item.price_trend === "down").length;
  const priceUp = rows.filter(r => r.item.price_trend === "up").length;
  const stockDown = rows.filter(r => r.item.stock_trend === "down").length;

  let box = document.getElementById("smartRecommendationBox");

  if (!box) {
    box = document.createElement("section");
    box.id = "smartRecommendationBox";
    box.className = "smart-recommendation-box";

    const productList = document.getElementById("productList");
    if (productList && productList.parentElement) {
      productList.parentElement.insertBefore(box, productList);
    } else {
      const dashboard = document.getElementById("dashboard") || document.body;
      dashboard.prepend(box);
    }
  }

  let overall = "Keine klare Kaufempfehlung";
  let overallCls = "watch";
  let overallReason = "Trage zuerst für relevante Displays deutsche Vergleichspreise ein.";

  if (evaluated.length) {
    if (buy.length >= 1) {
      overall = "Japan-Bestellung lohnt sich für ausgewählte Displays";
      overallCls = "buy";
      overallReason = `${buy.length} Display(s) mit starker Empfehlung. Fokus auf Top-Deals, nicht pauschal alles bestellen.`;
    } else if (check.length >= 1) {
      overall = "Japan-Bestellung selektiv prüfen";
      overallCls = "check";
      overallReason = `${check.length} Display(s) wirken interessant, aber der Puffer ist nicht bei allem stark.`;
    } else if (no.length > evaluated.length / 2) {
      overall = "Aktuell eher nicht in Japan bestellen";
      overallCls = "no";
      overallReason = "Bei den bewerteten Displays ist der deutsche Preis oft gleich gut oder besser.";
    } else {
      overall = "Beobachten";
      overallCls = "watch";
      overallReason = "Noch kein ausreichender Preisvorteil oder zu wenige bewertete Displays.";
    }
  }

  const topRows = rows
    .filter(r => r.rec.cls !== "missing")
    .slice(0, 8);

  box.innerHTML = `
    <div class="smart-head ${overallCls}">
      <div>
        <span class="smart-label">Einkaufsempfehlung</span>
        <h2>${overall}</h2>
        <p>${overallReason}</p>
      </div>
      <button id="smartRefreshBtn">Neu bewerten</button>
    </div>

    <div class="smart-kpis">
      <div><span>Bewertet</span><strong>${evaluated.length}</strong></div>
      <div><span>Japan bestellen</span><strong>${buy.length}</strong></div>
      <div><span>Japan prüfen</span><strong>${check.length}</strong></div>
      <div><span>Nicht kaufen</span><strong>${no.length}</strong></div>
      <div><span>DE-Preis fehlt</span><strong>${missing.length}</strong></div>
    </div>

    <div class="smart-trends">
      <span>Japan-Trends:</span>
      <strong>${priceDown}</strong> Preis fällt
      <strong>${priceUp}</strong> Preis steigt
      <strong>${stockDown}</strong> Bestand sinkt
    </div>

    <div class="smart-table">
      ${topRows.map((r, index) => `
        <div class="smart-row ${r.rec.cls}">
          <div class="smart-rank">#${index + 1}</div>
          <div class="smart-product">
            <strong>${escapeHtml(r.item.product_name)}</strong>
            <span>${escapeHtml(r.item.variant)} · Bestand ${r.item.stock ?? "-"} · ${trendText(r.item)}</span>
          </div>
          <div class="smart-num">
            <span>JP 12x</span>
            <strong>${money(r.rec.japanCost)}</strong>
          </div>
          <div class="smart-num">
            <span>DE</span>
            <strong>${money(r.rec.dePrice)}</strong>
          </div>
          <div class="smart-num">
            <span>Vorteil</span>
            <strong>${money(r.rec.diff)}</strong>
            <small>${(r.rec.pct * 100).toFixed(1)} %</small>
          </div>
          <div class="smart-status ${r.rec.cls}">
            <strong>${r.rec.recommendation}</strong>
            <small>${escapeHtml(r.rec.reason)}</small>
          </div>
        </div>
      `).join("") || `<p class="muted">Noch keine bewerteten Displays.</p>`}
    </div>
  `;

  const btn = document.getElementById("smartRefreshBtn");
  if (btn) btn.addEventListener("click", renderSmartRecommendationBox);
}

const renderProductsBeforeSmartRecommendation = renderProducts;

renderProducts = function () {
  renderProductsBeforeSmartRecommendation();
  setTimeout(renderSmartRecommendationBox, 200);
};

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(renderSmartRecommendationBox, 1800);
});

document.addEventListener("input", (event) => {
  if (event.target && event.target.classList && event.target.classList.contains("de-price-input")) {
    clearTimeout(window.__smartRecommendationUpdateTimer);
    window.__smartRecommendationUpdateTimer = setTimeout(renderSmartRecommendationBox, 900);
  }
});


window.forceUploadDePrices = function () {
  try {
    console.log("Starte manuellen DE-Preis-Sync...");

    if (!window.firebase || !window.CHIEF_FIREBASE_CONFIG) {
      alert("Firebase SDK oder Config fehlt. Bitte Seite hart neu laden.");
      return;
    }

    if (!firebase.apps.length) {
      firebase.initializeApp(window.CHIEF_FIREBASE_CONFIG);
    }

    const db = firebase.database();
    state.firebaseDb = db;
    state.firebaseReady = true;

    const raw = localStorage.getItem("chiefcards_de_compare_cache") || "{}";
    let localStore = {};

    try {
      localStore = sanitizeCompareStore(JSON.parse(raw));
    } catch (e) {
      console.warn("LocalStorage JSON kaputt:", e, raw);
      alert("Lokale DE-Preise konnten nicht gelesen werden. JSON ist ungültig.");
      return;
    }

    const localCount = Object.keys(localStore || {}).length;

    if (!localCount) {
      alert("Keine lokalen DE-Preise gefunden. Bitte prüfe, ob du im selben Browser bist, in dem du die DE-Preise eingetragen hast.");
      return;
    }

    db.ref("otakuyaDePrices").once("value").then(snap => {
      const remoteStore = sanitizeCompareStore(snap.val() || {});
      const remoteCount = Object.keys(remoteStore || {}).length;

      const merged = typeof mergeCompareStores === "function"
        ? sanitizeCompareStore(mergeCompareStores(localStore, remoteStore))
        : sanitizeCompareStore({ ...remoteStore, ...localStore });

      const mergedCount = Object.keys(merged || {}).length;

      state.dePricesRemote = merged;
      localStorage.setItem("chiefcards_de_compare_cache", JSON.stringify(merged));

      console.log("DE-Preis-Sync Daten:", { localCount, remoteCount, mergedCount, merged });

      return db.ref("otakuyaDePrices").set(merged).then(() => {
        const el = document.getElementById("dePriceSyncStatus");
        if (el) el.textContent = "DE-Preise synchronisiert: " + mergedCount;
        alert("DE-Preise synchronisiert: " + mergedCount);
      });
    }).catch(err => {
      console.error("Firebase DE-Preis-Sync Fehler:", err);
      alert("Firebase-Sync fehlgeschlagen: " + (err && err.message ? err.message : String(err)));
    });

  } catch (e) {
    console.error("forceUploadDePrices Fehler:", e);
    alert("DE-Preis-Sync Fehler: " + (e && e.message ? e.message : String(e)));
  }
};




/* Shared price radar feed for JP Watchlist */

function buildOtakuyaPriceRadarFeed() {
  try {
    if (typeof getSmartDisplayRows !== "function") return {};

    const rows = getSmartDisplayRows();
    const out = {};
    const now = new Date().toISOString();

    rows.forEach(({ item, rec }) => {
      if (!item || !rec) return;

      const variant = String(item.variant || "").trim().toLowerCase();

      // Standard für die Watchlist: nur sealed Display-Varianten
      if (variant !== "sealed") return;

      const keyRaw = typeof variantKey === "function"
        ? variantKey(item)
        : `${item.product_name || ""}||${item.variant || ""}||${item.url || ""}`;

      const safeKey = typeof firebaseSafeKey === "function"
        ? firebaseSafeKey(keyRaw)
        : encodeURIComponent(keyRaw).replaceAll(".", "%2E");

      out[safeKey] = {
        key: safeKey,
        rawKey: keyRaw,

        product_name: item.product_name || "",
        product_code: item.product_code || "",
        variant: item.variant || "",
        url: item.url || "",

        stock: Number(item.stock || 0),
        weight_grams: Number(item.weight_grams || 0),

        dePrice: rec.dePrice || null,
        japanCost: rec.japanCost || null,
        diff: rec.diff || null,
        pct: rec.pct || null,

        recommendation: rec.recommendation || "",
        cls: rec.cls || "",
        score: rec.score || 0,
        reason: rec.reason || "",

        price_trend: item.price_trend || "",
        price_change_yen: item.price_change_yen || null,
        stock_trend: item.stock_trend || "",
        stock_change: item.stock_change || null,

        updatedAt: now
      };
    });

    return out;
  } catch (e) {
    console.warn("Preisradar-Feed konnte nicht gebaut werden:", e);
    return {};
  }
}

let priceRadarFeedTimer = null;

function uploadOtakuyaPriceRadarFeed(force = false) {
  try {
    if (!state.firebaseReady || !state.firebaseDb) {
      if (force) alert("Firebase ist noch nicht bereit.");
      return Promise.resolve(false);
    }

    const feed = buildOtakuyaPriceRadarFeed();
    const count = Object.keys(feed || {}).length;

    if (!count) {
      if (force) alert("Kein Preisradar-Feed erzeugt. Prüfe, ob Produkte geladen sind.");
      return Promise.resolve(false);
    }

    return state.firebaseDb.ref("otakuyaPriceRadar").set(feed).then(() => {
      console.log("Otakuya Preisradar-Feed synchronisiert:", count);

      const el = document.getElementById("dePriceSyncStatus");
      if (el) {
        const base = String(el.textContent || "").split(" | Preisradar:")[0];
        el.textContent = base + ` | Preisradar: ${count}`;
      }

      if (force) alert("Preisradar synchronisiert: " + count);
      return true;
    }).catch(err => {
      console.warn("Preisradar konnte nicht synchronisiert werden:", err);
      if (force) alert("Preisradar-Sync fehlgeschlagen: " + (err && err.message ? err.message : String(err)));
      return false;
    });
  } catch (e) {
    console.warn("Preisradar-Sync Fehler:", e);
    if (force) alert("Preisradar-Sync Fehler: " + (e && e.message ? e.message : String(e)));
    return Promise.resolve(false);
  }
}

function scheduleOtakuyaPriceRadarFeedUpload() {
  clearTimeout(priceRadarFeedTimer);
  priceRadarFeedTimer = setTimeout(() => {
    uploadOtakuyaPriceRadarFeed(false);
  }, 1400);
}

window.forceUploadPriceRadar = function () {
  uploadOtakuyaPriceRadarFeed(true);
};

if (typeof renderSmartRecommendationBox === "function" && !window.__priceRadarFeedWrapperInstalled) {
  window.__priceRadarFeedWrapperInstalled = true;

  const originalRenderSmartRecommendationBox = renderSmartRecommendationBox;

  renderSmartRecommendationBox = function () {
    const result = originalRenderSmartRecommendationBox.apply(this, arguments);
    scheduleOtakuyaPriceRadarFeedUpload();
    return result;
  };

  console.log("Preisradar-Feed Wrapper aktiv.");
}

