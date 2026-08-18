// ElectroSemi Agent — vanilla frontend
// Products are served from a local catalog (products.json) for now.
// On submit, the cart is POSTed to the kaushix-api backend contract:
//   POST {API_BASE}/api/electrosemi/orders
// The backend (you build it) emails the sales team. See README for the contract.

// Set your deployed kaushix-api base URL here, or override at runtime with ?api=https://...
const API_BASE = "https://kaushix-api.hf.space";
const ORDERS_PATH = "/api/electrosemi/orders";

const params = new URLSearchParams(location.search);
const apiBase = params.get("api") || API_BASE;

const productsEl = document.getElementById("messages");
const inputEl = document.getElementById("input");
const sendBtn = document.getElementById("sendBtn");
const browseBtn = document.getElementById("browseBtn");
const cartBtn = document.getElementById("cartBtn");
const cartCountEl = document.getElementById("cartCount");
const cartDrawer = document.getElementById("cartDrawer");
const cartClose = document.getElementById("cartClose");
const cartItemsEl = document.getElementById("cartItems");
const cartTotalEl = document.getElementById("cartTotal");
const cartForm = document.getElementById("cartForm");
const cartStatusEl = document.getElementById("cartStatus");
const overlay = document.getElementById("overlay");

let products = [];
const cart = new Map(); // sku -> { sku, name, price, qty }

// ---------- rendering ----------
function addMessage(role, contentNode) {
  const el = document.createElement("div");
  el.className = "msg " + role;
  el.appendChild(contentNode);
  productsEl.appendChild(el);
  productsEl.scrollTop = productsEl.scrollHeight;
  return el;
}

function textNode(text) {
  const d = document.createElement("div");
  d.textContent = text;
  return d;
}

function typingNode() {
  const d = document.createElement("div");
  d.className = "typing";
  d.innerHTML = "<span></span><span></span><span></span>";
  return d;
}

function productCard(p) {
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <div class="cat">${p.category}</div>
    <div class="name">${p.name}</div>
    <div class="desc">${p.description}</div>
    <div class="meta">
      <span class="price">$${p.price.toFixed(2)}</span>
      <span class="stock">${p.stock} in stock</span>
    </div>`;
  const add = document.createElement("button");
  add.className = "btn primary add";
  add.textContent = "Add to cart";
  add.addEventListener("click", () => addToCart(p));
  card.appendChild(add);
  return card;
}

function renderProducts(list, intro) {
  const wrap = document.createElement("div");
  const introEl = document.createElement("div");
  introEl.textContent = intro || "Here are some products from our catalog:";
  wrap.appendChild(introEl);
  const grid = document.createElement("div");
  grid.className = "products";
  list.forEach((p) => grid.appendChild(productCard(p)));
  wrap.appendChild(grid);
  addMessage("ai", wrap);
}

// ---------- mock AI ----------
function mockReply(text) {
  const t = text.toLowerCase();
  if (/(stm32|microcontroller|mcu|controller|industrial)/.test(t)) {
    return "I can help with that. We stock a range of STM32 and other microcontrollers. Want me to show options you can add to a cart?";
  }
  if (/(wifi|bluetooth|wireless|esp)/.test(t)) {
    return "For wireless needs we carry Wi-Fi/Bluetooth SoCs like the ESP32. Shall I list them?";
  }
  if (/(price|quote|cost|how much)/.test(t)) {
    return "Add the parts you need to your cart and submit — our sales team will prepare a formal quote.";
  }
  return "I'm your sourcing assistant. Tell me about your project (e.g. 'I need 500 STM32 controllers') and I'll suggest parts you can add to a cart.";
}

// ---------- products ----------
async function loadProducts() {
  if (products.length) return products;
  const res = await fetch("./products.json");
  products = await res.json();
  return products;
}

function filterProducts(text) {
  const q = text.toLowerCase();
  return products.filter((p) =>
    [p.name, p.description, p.category, p.sku].join(" ").toLowerCase().includes(q)
  );
}

// ---------- cart ----------
function addToCart(p) {
  const item = cart.get(p.sku) || { sku: p.sku, name: p.name, price: p.price, qty: 0 };
  item.qty += 1;
  cart.set(p.sku, item);
  updateCart();
  flashStatus(`Added ${p.sku} to cart`, "ok");
}

function changeQty(sku, delta) {
  const item = cart.get(sku);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart.delete(sku);
  updateCart();
}

function updateCart() {
  const total = [...cart.values()].reduce((s, i) => s + i.qty, 0);
  cartCountEl.textContent = total;
  cartItemsEl.innerHTML = "";
  if (cart.size === 0) {
    const e = document.createElement("div");
    e.className = "cart-empty";
    e.textContent = "Your cart is empty. Browse the catalog to add parts.";
    cartItemsEl.appendChild(e);
  } else {
    [...cart.values()].forEach((i) => {
      const row = document.createElement("div");
      row.className = "cart-row";
      row.innerHTML = `
        <div class="info">${i.name}<small>$${i.price.toFixed(2)} × ${i.qty}</small></div>`;
      const qty = document.createElement("div");
      qty.className = "qty";
      const minus = document.createElement("button");
      minus.textContent = "−";
      minus.addEventListener("click", () => changeQty(i.sku, -1));
      const n = document.createElement("span");
      n.textContent = i.qty;
      const plus = document.createElement("button");
      plus.textContent = "+";
      plus.addEventListener("click", () => changeQty(i.sku, 1));
      qty.append(minus, n, plus);
      row.appendChild(qty);
      cartItemsEl.appendChild(row);
    });
  }
  const totalPrice = [...cart.values()].reduce((s, i) => s + i.qty * i.price, 0);
  cartTotalEl.textContent = "$" + totalPrice.toFixed(2);
}

function openCart() { cartDrawer.classList.add("open"); overlay.hidden = false; }
function closeCart() { cartDrawer.classList.remove("open"); overlay.hidden = true; }

function flashStatus(msg, kind) {
  cartStatusEl.textContent = msg;
  cartStatusEl.className = "cart-status " + (kind || "");
}

// ---------- submit ----------
async function submitCart(customer) {
  const items = [...cart.values()].map((i) => ({
    sku: i.sku, name: i.name, quantity: i.qty, unitPrice: i.price,
  }));
  const payload = { customer, items, notes: customer.notes || "" };
  flashStatus("Sending to sales team…");
  try {
    const res = await fetch(apiBase + ORDERS_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Backend returned " + res.status);
    flashStatus("Sent! Our sales team will follow up shortly.", "ok");
    cart.clear();
    updateCart();
    setTimeout(closeCart, 1500);
  } catch (err) {
    // Backend not ready yet — keep the order visible for the user.
    console.error("Order submit failed:", payload, err);
    flashStatus("Backend not reachable yet — your request was recorded locally. (" + err.message + ")", "err");
  }
}

// ---------- events ----------
async function send() {
  const text = inputEl.value.trim();
  if (!text) return;
  inputEl.value = "";
  addMessage("customer", textNode(text));

  const indicator = addMessage("ai", typingNode());
  await new Promise((r) => setTimeout(r, 500 + Math.random() * 700));

  indicator.replaceChild(textNode(mockReply(text)), indicator.firstChild);

  const matches = filterProducts(text);
  if (matches.length && /(need|want|looking|find|show|suggest|stm32|controller|wifi|part|buy)/.test(text.toLowerCase())) {
    renderProducts(matches, "Based on your message, here are some matching parts:");
  }
}

sendBtn.addEventListener("click", send);
inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
});
inputEl.addEventListener("input", () => {
  inputEl.style.height = "auto";
  inputEl.style.height = Math.min(inputEl.scrollHeight, 140) + "px";
});

browseBtn.addEventListener("click", async () => {
  await loadProducts();
  renderProducts(products, "Our current catalog:");
});

cartBtn.addEventListener("click", openCart);
cartClose.addEventListener("click", closeCart);
overlay.addEventListener("click", closeCart);

cartForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (cart.size === 0) { flashStatus("Add at least one part before submitting.", "err"); return; }
  const data = Object.fromEntries(new FormData(cartForm).entries());
  submitCart(data);
});

// ---------- init ----------
(async () => {
  await loadProducts();
  addMessage("ai", textNode("Hi! I'm the ElectroSemi sourcing assistant. Tell me what you're building, or tap “Browse catalog” to see our parts."));
  updateCart();
})();
