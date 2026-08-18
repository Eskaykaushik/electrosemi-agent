// ElectroSemi Agent — vanilla frontend
// Products are served from a local catalog (products.json) for now.
// Chat messages are sent to the kaushix-api backend which routes them
// through the ElectroSemi agent. The cart submit also hits the backend
// to email the sales team. See README for the contract.

const API_BASE = "https://kaushix-api-service.onrender.com";

const params = new URLSearchParams(location.search);
const apiBase = params.get("api") || API_BASE;

fetch(apiBase, { method: "GET" }).catch(() => {});

const messagesEl = document.getElementById("messages");
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
const cart = new Map();
const chatHistory = [];
const cardButtons = new Map();

// ---------- rendering ----------
function addMessage(role, contentNode) {
  const el = document.createElement("div");
  el.className = "msg " + role;
  el.appendChild(contentNode);
  messagesEl.appendChild(el);
  messagesEl.scrollTop = messagesEl.scrollHeight;
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
  card.innerHTML =
    '<div class="card-top">' +
      '<span class="sku">' + p.sku + '</span>' +
      '<span class="cat">' + p.category + '</span>' +
    '</div>' +
    '<div class="name">' + p.name + '</div>' +
    '<div class="desc">' + p.description + '</div>' +
    '<div class="card-bottom">' +
      '<div class="meta">' +
        '<span class="price">$' + p.price.toFixed(2) + '</span>' +
        '<span class="stock">' + p.stock + ' in stock</span>' +
      '</div>' +
    '</div>';
  var add = document.createElement("button");
  add.className = "btn add";
  add.textContent = "Add to cart";
  add.addEventListener("click", function () { addToCart(p); });
  cardButtons.set(p.sku, add);
  card.appendChild(add);
  return card;
}

function renderProducts(list, intro) {
  const wrap = document.createElement("div");
  const introEl = document.createElement("div");
  introEl.className = "products-intro";
  introEl.textContent = intro || "Here are some products from our catalog:";
  wrap.appendChild(introEl);
  const grid = document.createElement("div");
  grid.className = "products";
  list.forEach(function (p) { grid.appendChild(productCard(p)); });
  wrap.appendChild(grid);
  addMessage("ai", wrap);
}

// ---------- fallback mock ----------
function mockReply(text) {
  const t = text.toLowerCase();
  if (/(stm32|microcontroller|mcu|controller|industrial)/.test(t)) {
    return "I can help with that. We stock a range of STM32 and other microcontrollers. Want me to show options you can add to a cart?";
  }
  if (/(wifi|bluetooth|wireless|esp)/.test(t)) {
    return "For wireless needs we carry Wi-Fi/Bluetooth SoCs like the ESP32. Shall I list them?";
  }
  if (/(price|quote|cost|how much)/.test(t)) {
    return "Add the parts you need to your cart and submit \u2014 our sales team will prepare a formal quote.";
  }
  return "I'm your sourcing assistant. Tell me about your project (e.g. 'I need 500 STM32 controllers') and I'll suggest parts you can add to a cart.";
}

// ---------- chat with backend ----------
async function chatWithBackend(message) {
  const res = await fetch(apiBase + "/api/electrosemi", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: message, history: chatHistory }),
  });
  if (!res.ok) throw new Error("Backend returned " + res.status);
  const data = await res.json();
  return data.response || "";
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
  return products.filter(function (p) {
    return [p.name, p.description, p.category, p.sku].join(" ").toLowerCase().includes(q);
  });
}

// ---------- cart ----------
function addToCart(p) {
  const item = cart.get(p.sku) || { sku: p.sku, name: p.name, price: p.price, qty: 0 };
  item.qty += 1;
  cart.set(p.sku, item);
  updateCardButtons();
  updateCart();
  flashStatus("Added " + p.sku + " to cart", "ok");
}

function changeQty(sku, delta) {
  const item = cart.get(sku);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart.delete(sku);
  updateCardButtons();
  updateCart();
}

function updateCardButtons() {
  for (var entry of cardButtons) {
    var sku = entry[0], btn = entry[1];
    var item = cart.get(sku);
    if (item && item.qty > 0) {
      btn.textContent = "In cart (\u00B7 " + item.qty + ")";
      btn.classList.add("in-cart");
    } else {
      btn.textContent = "Add to cart";
      btn.classList.remove("in-cart");
    }
  }
}

function updateCart() {
  var totalQty = 0;
  cart.forEach(function (i) { totalQty += i.qty; });
  cartCountEl.textContent = totalQty;
  cartItemsEl.innerHTML = "";
  if (cart.size === 0) {
    var e = document.createElement("div");
    e.className = "cart-empty";
    e.textContent = "Your cart is empty. Browse the catalog to add parts.";
    cartItemsEl.appendChild(e);
  } else {
    cart.forEach(function (i) {
      var row = document.createElement("div");
      row.className = "cart-row";
      var info = document.createElement("div");
      info.className = "info";
      info.textContent = i.name;
      var small = document.createElement("small");
      small.textContent = "$" + i.price.toFixed(2) + " \u00D7 " + i.qty;
      info.appendChild(small);
      var qty = document.createElement("div");
      qty.className = "qty";
      var minus = document.createElement("button");
      minus.textContent = "\u2212";
      minus.addEventListener("click", (function (sku) { return function () { changeQty(sku, -1); }; })(i.sku));
      var n = document.createElement("span");
      n.textContent = i.qty;
      var plus = document.createElement("button");
      plus.textContent = "+";
      plus.addEventListener("click", (function (sku) { return function () { changeQty(sku, 1); }; })(i.sku));
      qty.append(minus, n, plus);
      row.append(info, qty);
      cartItemsEl.appendChild(row);
    });
  }
  var totalPrice = 0;
  cart.forEach(function (i) { totalPrice += i.qty * i.price; });
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
  var items = [];
  cart.forEach(function (i) {
    items.push({ sku: i.sku, name: i.name, quantity: i.qty, unitPrice: i.price });
  });
  var order = { customer: customer, items: items, notes: customer.notes || "" };
  var message =
    "A customer submitted a new order. Call the send_order_email tool with " +
    "these exact details:\n" + JSON.stringify(order);

  var submitBtn = cartForm.querySelector('button[type="submit"]');
  var origText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = "Sending\u2026";
  flashStatus("Sending to sales team\u2026");

  try {
    var res = await fetch(apiBase + "/api/electrosemi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: message, history: [] }),
    });
    if (!res.ok) throw new Error("Backend returned " + res.status);
    var data = await res.json();
    flashStatus(data.response || "Sent! Our sales team will follow up shortly.", "ok");
    cart.clear();
    updateCardButtons();
    updateCart();
    setTimeout(closeCart, 1500);
  } catch (err) {
    console.error("Order submit failed:", order, err);
    flashStatus("Backend not reachable yet \u2014 your request was recorded locally. (" + err.message + ")", "err");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = origText;
  }
}

// ---------- events ----------
async function send() {
  var text = inputEl.value.trim();
  if (!text) return;
  inputEl.value = "";
  addMessage("customer", textNode(text));

  chatHistory.push({ role: "user", content: text });

  var indicator = addMessage("ai", typingNode());

  sendBtn.disabled = true;
  inputEl.disabled = true;

  try {
    var reply = await chatWithBackend(text);
    chatHistory.push({ role: "assistant", content: reply });
    indicator.replaceChild(textNode(reply), indicator.firstChild);
  } catch (err) {
    console.warn("Backend unreachable, using mock reply:", err);
    var fallback = mockReply(text);
    chatHistory.push({ role: "assistant", content: fallback });
    indicator.replaceChild(textNode(fallback), indicator.firstChild);
  } finally {
    sendBtn.disabled = false;
    inputEl.disabled = false;
    inputEl.focus();
  }

  var matches = filterProducts(text);
  if (matches.length && /(need|want|looking|find|show|suggest|stm32|controller|wifi|part|buy)/.test(text.toLowerCase())) {
    renderProducts(matches, "Based on your message, here are some matching parts:");
  }
}

sendBtn.addEventListener("click", send);
inputEl.addEventListener("keydown", function (e) {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
});
inputEl.addEventListener("input", function () {
  inputEl.style.height = "auto";
  inputEl.style.height = Math.min(inputEl.scrollHeight, 140) + "px";
});

browseBtn.addEventListener("click", async function () {
  browseBtn.disabled = true;
  browseBtn.textContent = "Loading\u2026";
  try {
    await loadProducts();
    renderProducts(products, "Our current catalog:");
  } catch (err) {
    console.error("Failed to load catalog:", err);
    renderProducts([], "Failed to load catalog. Please try again later.");
  } finally {
    browseBtn.disabled = false;
    browseBtn.textContent = "Browse catalog";
  }
});

cartBtn.addEventListener("click", openCart);
cartClose.addEventListener("click", closeCart);
overlay.addEventListener("click", closeCart);

cartForm.addEventListener("submit", function (e) {
  e.preventDefault();
  if (cart.size === 0) { flashStatus("Add at least one part before submitting.", "err"); return; }
  var data = {};
  new FormData(cartForm).forEach(function (v, k) { data[k] = v; });
  submitCart(data);
});

// ---------- init ----------
(async function () {
  await loadProducts();
  addMessage("ai", textNode("Hi! I'm the ElectroSemi sourcing assistant. Tell me what you're building, or tap \u201cBrowse catalog\u201d to see our parts."));
  updateCart();
})();
