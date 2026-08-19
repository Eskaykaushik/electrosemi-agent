// ElectroSemi Agent — vanilla frontend
// Products are served from a local catalog (products.json) for now.
// Chat messages are sent to the kaushix-api backend which routes them
// through the ElectroSemi agent. The cart submit also hits the backend
// to email the sales team. See README for the contract.

const API_BASE = "https://kaushix-api-service.onrender.com";

const params = new URLSearchParams(location.search);
const apiBase = params.get("api") || API_BASE;

// Wake up Render free-tier dyno + prime backend cache on page load
fetch(apiBase + "/api/electrosemi", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ message: "What products do you have?", history: [] }),
}).catch(() => {});

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
const scrollIndicator = document.getElementById("scrollIndicator");
const scrollBtn = document.getElementById("scrollBtn");
const srAnnounce = document.getElementById("srAnnounce");
const catalogDrawer = document.getElementById("catalogDrawer");
const catalogClose = document.getElementById("catalogClose");
const catalogGrid = document.getElementById("catalogGrid");
const catalogEmpty = document.getElementById("catalogEmpty");
const catalogSearch = document.getElementById("catalogSearch");
const catalogTabs = document.getElementById("catalogTabs");

let products = [];
const cart = new Map();
const chatHistory = [];
const cardButtons = new Map();
let previousScrollHeight = 0;
let isUserNearBottom = true;
let chatStarted = false;
let lastMsgRole = null;
let typingAbort = null;
let catalogActiveCategory = "all";
let catalogSearchQuery = "";
const intentCache = new Map();

// ---------- markdown ----------
function renderMarkdown(text) {
  if (typeof marked !== "undefined") {
    return marked.parse(text);
  }
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

function markdownNode(text) {
  var d = document.createElement("div");
  d.className = "md-content";
  d.innerHTML = renderMarkdown(text);
  return d;
}

// ---------- typing effect ----------
function typeText(el, fullText, opts) {
  opts = opts || {};
  var charsPerTick = opts.fast ? 4 : 1;
  var delay = opts.fast ? 10 : 22;
  var i = 0;
  var done = false;
  var aborted = false;

  function tick() {
    if (aborted) return;
    i = Math.min(i + charsPerTick, fullText.length);
    el.innerHTML = renderMarkdown(fullText.slice(0, i));
    checkAutoScroll();
    if (i < fullText.length) {
      typingTimeout = setTimeout(tick, delay);
    } else {
      done = true;
    }
  }

  var typingTimeout = setTimeout(tick, delay);

  return {
    skip: function () {
      aborted = true;
      clearTimeout(typingTimeout);
      el.innerHTML = renderMarkdown(fullText);
      checkAutoScroll();
      done = true;
    },
    isDone: function () { return done; },
  };
}

// ---------- helpers ----------
function announce(text) {
  srAnnounce.textContent = "";
  requestAnimationFrame(function () { srAnnounce.textContent = text; });
}

function formatTime() {
  var now = new Date();
  var h = now.getHours();
  var m = now.getMinutes();
  var ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return h + ":" + (m < 10 ? "0" : "") + m + " " + ampm;
}

function getCategoryColor(cat) {
  var c = (cat || "").toLowerCase();
  if (c.indexOf("micro") !== -1) return "Microcontroller";
  if (c.indexOf("wireless") !== -1 || c.indexOf("wifi") !== -1) return "Wireless";
  if (c.indexOf("sbc") !== -1 || c.indexOf("raspberry") !== -1) return "SBC";
  return "default";
}

function getStockClass(stock) {
  if (stock <= 0) return "out";
  if (stock < 200) return "low";
  return "ok";
}

function getStockLabel(stock) {
  if (stock <= 0) return "Out of stock";
  if (stock < 200) return stock + " left";
  return stock + " in stock";
}

// ---------- scroll management ----------
function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

messagesEl.addEventListener("scroll", function () {
  var diff = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight;
  isUserNearBottom = diff < 80;
  if (isUserNearBottom) {
    scrollIndicator.hidden = true;
  }
});

scrollBtn.addEventListener("click", function () {
  scrollToBottom();
  scrollIndicator.hidden = true;
  inputEl.focus();
});

function checkAutoScroll() {
  if (isUserNearBottom) {
    scrollToBottom();
  } else {
    scrollIndicator.hidden = false;
  }
}

// ---------- rendering ----------
function addMessage(role, contentNode, opts) {
  opts = opts || {};
  var el = document.createElement("div");
  el.className = "msg " + role;

  if (opts.grouped) {
    el.classList.add("msg-grouped");
  }

  el.appendChild(contentNode);

  if (opts.time !== false) {
    var timeEl = document.createElement("div");
    timeEl.className = "msg-time";
    timeEl.textContent = formatTime();
    el.appendChild(timeEl);
  }

  messagesEl.appendChild(el);
  checkAutoScroll();
  return el;
}

function textNode(text) {
  var d = document.createElement("div");
  d.textContent = text;
  return d;
}

function typingNode() {
  var d = document.createElement("div");
  d.className = "typing";
  d.innerHTML = "<span></span><span></span><span></span>";
  return d;
}

function mdContainer() {
  var d = document.createElement("div");
  d.className = "md-content";
  return d;
}

// ---------- suggestion chips ----------
function createChip(text, icon) {
  var chip = document.createElement("button");
  chip.type = "button";
  chip.className = "chip";
  if (icon) {
    var iconSpan = document.createElement("span");
    iconSpan.className = "chip-icon";
    iconSpan.textContent = icon;
    chip.appendChild(iconSpan);
  }
  chip.appendChild(document.createTextNode(text));
  chip.addEventListener("click", function () {
    inputEl.value = text;
    send();
  });
  return chip;
}

function renderChips(chips) {
  var wrap = document.createElement("div");
  wrap.className = "welcome-chips";
  chips.forEach(function (c) {
    wrap.appendChild(createChip(c.text, c.icon));
  });
  return wrap;
}

// ---------- inline follow-up chips ----------
function renderInlineChips(chips) {
  var wrap = document.createElement("div");
  wrap.className = "inline-chips";
  chips.forEach(function (c) {
    var chip = document.createElement("button");
    chip.type = "button";
    chip.className = "inline-chip";
    chip.textContent = c;
    chip.addEventListener("click", function () {
      inputEl.value = c;
      send();
    });
    wrap.appendChild(chip);
  });
  return wrap;
}

// ---------- post-reply suggestions ----------
function addSuggestions(msgEl, context) {
  var chips;
  if (context === "cart") {
    chips = ["View cart", "Continue shopping", "Submit order"];
  } else if (context === "catalog") {
    chips = ["Add to cart", "Show more", "Get a quote"];
  } else if (context === "empty") {
    chips = ["Browse catalog", "What's in stock?"];
  } else {
    chips = ["Browse catalog", "Add to cart", "Get a quote"];
  }
  msgEl.appendChild(renderInlineChips(chips));
}

// ---------- welcome screen ----------
function renderWelcome() {
  var welcome = document.createElement("div");
  welcome.className = "welcome";
  welcome.id = "welcomeScreen";

  var icon = document.createElement("div");
  icon.className = "welcome-icon";
  icon.textContent = "\u26A1";

  var h2 = document.createElement("h2");
  h2.textContent = "ElectroSemi";

  var p = document.createElement("p");
  p.textContent = "Your AI-powered electronics sourcing assistant. Tell me what you\u2019re building, or pick a topic below.";

  var chips = renderChips([
    { text: "Browse catalog", icon: "\uD83D\uDCCB" },
    { text: "I need STM32 controllers", icon: "\uD83E\uDDE0" },
    { text: "Show wireless modules", icon: "\uD83D\uDCE1" },
    { text: "I need a quote", icon: "\uD83D\uDCC8" },
    { text: "What\u2019s in stock?", icon: "\uD83D\uDCE6" },
  ]);

  welcome.append(icon, h2, p, chips);
  messagesEl.appendChild(welcome);
}

function removeWelcome() {
  var w = document.getElementById("welcomeScreen");
  if (w) w.remove();
  chatStarted = true;
}

function newChat() {
  if (typingAbort && !typingAbort.isDone()) typingAbort.skip();
  chatHistory.length = 0;
  messagesEl.innerHTML = "";
  chatStarted = false;
  lastMsgRole = null;
  renderWelcome();
  closeCart();
  closeCatalog();
  announce("New chat started");
}

// ---------- catalog drawer ----------
function openCatalog(skusToHighlight) {
  catalogDrawer.classList.add("open");
  catalogDrawer.setAttribute("aria-hidden", "false");
  overlay.hidden = false;
  catalogClose.focus();
  document.addEventListener("keydown", trapCatalogFocus);
  renderCatalogGrid();
  if (skusToHighlight && skusToHighlight.length) {
    setTimeout(function () {
      skusToHighlight.forEach(function (sku) {
        var card = catalogGrid.querySelector('[data-sku="' + sku + '"]');
        if (card) {
          card.classList.add("highlight");
          card.scrollIntoView({ behavior: "smooth", block: "center" });
          setTimeout(function () { card.classList.remove("highlight"); }, 2000);
        }
      });
    }, 100);
  }
  announce("Catalog opened");
}

function closeCatalog() {
  catalogDrawer.classList.remove("open");
  catalogDrawer.setAttribute("aria-hidden", "true");
  overlay.hidden = true;
  document.removeEventListener("keydown", trapCatalogFocus);
  announce("Catalog closed");
}

function trapCatalogFocus(e) {
  if (e.key === "Escape") { closeCatalog(); return; }
  if (e.key !== "Tab") return;
  var focusable = catalogDrawer.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (!focusable.length) return;
  var first = focusable[0];
  var last = focusable[focusable.length - 1];
  if (e.shiftKey) {
    if (document.activeElement === first) { e.preventDefault(); last.focus(); }
  } else {
    if (document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
}

function getCatalogFiltered() {
  return products.filter(function (p) {
    var catMatch = catalogActiveCategory === "all" || getCategoryColor(p.category).toLowerCase() === catalogActiveCategory.toLowerCase();
    if (!catMatch) return false;
    if (!catalogSearchQuery) return true;
    var q = catalogSearchQuery.toLowerCase();
    return [p.name, p.description, p.category, p.sku].join(" ").toLowerCase().indexOf(q) !== -1;
  });
}

function renderCatalogGrid() {
  catalogGrid.innerHTML = "";
  var list = getCatalogFiltered();
  if (!list.length) {
    catalogEmpty.hidden = false;
    catalogGrid.style.display = "none";
    return;
  }
  catalogEmpty.hidden = true;
  catalogGrid.style.display = "";
  list.forEach(function (p) {
    var catColor = getCategoryColor(p.category);
    var stockCls = getStockClass(p.stock);
    var card = document.createElement("div");
    card.className = "catalog-card";
    card.setAttribute("data-sku", p.sku);
    card.innerHTML =
      '<div class="card-top">' +
        '<span class="name">' + p.name + '</span>' +
        '<span class="cat" data-cat="' + catColor + '">' + p.category + '</span>' +
      '</div>' +
      '<div class="desc">' + p.description + '</div>' +
      '<div class="meta">' +
        '<span class="price">$' + p.price.toFixed(2) + '</span>' +
        '<span class="stock ' + stockCls + '">' + getStockLabel(p.stock) + '</span>' +
      '</div>';
    var add = document.createElement("button");
    add.className = "btn add";
    var inCart = cart.get(p.sku);
    if (inCart && inCart.qty > 0) {
      add.textContent = "In cart (\u00B7 " + inCart.qty + ")";
      add.classList.add("in-cart");
    } else {
      add.textContent = "Add to cart";
    }
    add.setAttribute("aria-label", "Add " + p.name + " to cart");
    add.addEventListener("click", function () {
      addToCart(p);
      renderCatalogGrid();
      var newBtn = catalogGrid.querySelector('[data-sku="' + p.sku + '"] .btn.add');
      if (newBtn) { newBtn.classList.add("flash"); }
    });
    cardButtons.set(p.sku, add);
    card.appendChild(add);
    catalogGrid.appendChild(card);
  });
  announce(list.length + " products shown in catalog");
}

function initCatalogTabs() {
  var cats = ["all"];
  products.forEach(function (p) {
    var c = getCategoryColor(p.category);
    if (cats.indexOf(c) === -1) cats.push(c);
  });
  catalogTabs.innerHTML = "";
  cats.forEach(function (c) {
    var btn = document.createElement("button");
    btn.className = "catalog-tab" + (c === catalogActiveCategory ? " active" : "");
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", c === catalogActiveCategory ? "true" : "false");
    btn.setAttribute("data-cat", c);
    btn.textContent = c === "all" ? "All" : c;
    btn.addEventListener("click", function () {
      catalogActiveCategory = c;
      catalogTabs.querySelectorAll(".catalog-tab").forEach(function (t) {
        t.classList.toggle("active", t.getAttribute("data-cat") === c);
        t.setAttribute("aria-selected", t.getAttribute("data-cat") === c ? "true" : "false");
      });
      renderCatalogGrid();
    });
    catalogTabs.appendChild(btn);
  });
}

catalogSearch.addEventListener("input", function () {
  catalogSearchQuery = catalogSearch.value.trim();
  renderCatalogGrid();
});

catalogClose.addEventListener("click", closeCatalog);

// ---------- skeleton loading ----------
function showSkeletons(count) {
  for (var i = 0; i < (count || 4); i++) {
    var card = document.createElement("div");
    card.className = "skeleton-card";
    card.innerHTML =
      '<div class="skeleton-line w40"></div>' +
      '<div class="skeleton-line w80"></div>' +
      '<div class="skeleton-line w60"></div>' +
      '<div class="skeleton-line btn"></div>';
    catalogGrid.appendChild(card);
  }
  catalogEmpty.hidden = true;
  catalogGrid.style.display = "";
}

function removeSkeletons() {
  catalogGrid.querySelectorAll(".skeleton-card").forEach(function (el) { el.remove(); });
}

// ---------- fallback mock ----------
function mockReply(text) {
  var t = text.toLowerCase();
  if (/(stm32|microcontroller|mcu|controller|industrial)/.test(t)) {
    return "I can help with that. We stock a range of STM32 and other microcontrollers. Want me to show options you can add to a cart?";
  }
  if (/(wifi|bluetooth|wireless|esp)/.test(t)) {
    return "For wireless needs we carry Wi-Fi/Bluetooth SoCs like the ESP32. Shall I list them?";
  }
  if (/(price|quote|cost|how much)/.test(t)) {
    return "Add the parts you need to your cart and submit \u2014 our sales team will prepare a formal quote.";
  }
  return "I\u2019m your sourcing assistant. Tell me about your project (e.g. \u2018I need 500 STM32 controllers\u2019) and I\u2019ll suggest parts you can add to a cart.";
}

// ---------- chat with backend ----------
async function chatWithBackend(message) {
  var res = await fetch(apiBase + "/api/electrosemi", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: message, history: chatHistory }),
  });
  if (!res.ok) throw new Error("Backend returned " + res.status);
  var data = await res.json();
  return { text: data.response || "", toolCalls: data.tool_calls || [] };
}

// ---------- products ----------
async function loadProducts() {
  if (products.length) return products;
  var res = await fetch("./products.json");
  products = await res.json();
  return products;
}

function filterProducts(text) {
  var q = text.toLowerCase();
  return products.filter(function (p) {
    return [p.name, p.description, p.category, p.sku].join(" ").toLowerCase().indexOf(q) !== -1;
  });
}

// ---------- intent cache ----------
function clearCartCache() {
  for (var key of intentCache.keys()) {
    if (key.startsWith("cart:")) intentCache.delete(key);
  }
}

// ---------- cart ----------
function addToCart(p) {
  var item = cart.get(p.sku) || { sku: p.sku, name: p.name, price: p.price, qty: 0 };
  item.qty += 1;
  cart.set(p.sku, item);
  clearCartCache();
  updateCardButtons();
  updateCart();
  flashStatus("Added " + p.sku + " to cart", "ok");
  announce(p.name + " added to cart. Quantity: " + item.qty);
}

function changeQty(sku, delta) {
  var item = cart.get(sku);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart.delete(sku);
  clearCartCache();
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
      btn.setAttribute("aria-label", btn.getAttribute("aria-label").replace("Add ", "Add ") + " (already in cart, qty " + item.qty + ")");
    } else {
      btn.textContent = "Add to cart";
      btn.classList.remove("in-cart");
    }
  }
}

function updateCart() {
  var totalQty = 0;
  cart.forEach(function (i) { totalQty += i.qty; });
  var prevCount = parseInt(cartCountEl.textContent) || 0;
  cartCountEl.textContent = totalQty;

  if (totalQty > prevCount) {
    cartCountEl.classList.remove("pop");
    void cartCountEl.offsetWidth;
    cartCountEl.classList.add("pop");
  }

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
      minus.setAttribute("aria-label", "Decrease quantity of " + i.name);
      minus.addEventListener("click", (function (sku) { return function () { changeQty(sku, -1); }; })(i.sku));
      var n = document.createElement("span");
      n.textContent = i.qty;
      n.setAttribute("aria-label", "Quantity: " + i.qty);
      var plus = document.createElement("button");
      plus.textContent = "+";
      plus.setAttribute("aria-label", "Increase quantity of " + i.name);
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

// ---------- drawer focus trap ----------
var lastFocusedElement = null;

function openCart() {
  lastFocusedElement = document.activeElement;
  cartDrawer.classList.add("open");
  cartDrawer.setAttribute("aria-hidden", "false");
  overlay.hidden = false;
  cartClose.focus();
  document.addEventListener("keydown", trapFocus);
  announce("Cart opened");
}

function closeCart() {
  cartDrawer.classList.remove("open");
  cartDrawer.setAttribute("aria-hidden", "true");
  overlay.hidden = true;
  document.removeEventListener("keydown", trapFocus);
  if (lastFocusedElement) lastFocusedElement.focus();
  announce("Cart closed");
}

function trapFocus(e) {
  if (e.key === "Escape") {
    closeCart();
    return;
  }
  if (e.key !== "Tab") return;
  var focusable = cartDrawer.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (!focusable.length) return;
  var first = focusable[0];
  var last = focusable[focusable.length - 1];
  if (e.shiftKey) {
    if (document.activeElement === first) { e.preventDefault(); last.focus(); }
  } else {
    if (document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
}

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
    announce("Order submitted successfully");
    cart.clear();
    updateCardButtons();
    updateCart();
    setTimeout(closeCart, 1500);
  } catch (err) {
    console.error("Order submit failed:", order, err);
    flashStatus("Backend not reachable yet \u2014 your request was recorded locally. (" + err.message + ")", "err");
    announce("Order submission failed: " + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = origText;
  }
}

// ---------- tool call handling ----------
function handleToolCalls(toolCalls) {
  toolCalls.forEach(function (tc) {
    if (tc.name === "add_to_cart") {
      var items = (tc.arguments && tc.arguments.items) || [];
      items.forEach(function (item) {
        var product = products.find(function (p) { return p.sku === item.sku; });
        if (!product) {
          console.warn("Unknown SKU from agent:", item.sku);
          return;
        }
        var qty = parseInt(item.quantity, 10) || 1;
        var existing = cart.get(product.sku) || { sku: product.sku, name: product.name, price: product.price, qty: 0 };
        existing.qty += qty;
        cart.set(product.sku, existing);
        announce(product.name + " added to cart. Quantity: " + existing.qty);
      });
      updateCardButtons();
      updateCart();
      if (items.length) {
        flashStatus("Added " + items.length + " item(s) to cart", "ok");
      }
    }
    if (tc.name === "send_order_email") {
      cart.clear();
      updateCardButtons();
      updateCart();
    }
  });
}

// ---------- local intent detection ----------
function handleLocalIntent(text) {
  var t = text.toLowerCase();
  // Cart queries
  if (/(check|show|view|open).*(cart|crat|basket|bag|bagn|order|oder)|what.*(in|is).*(cart|crat|basket|bag|bagn|order|oder)/.test(t)) {
    var items = [];
    var total = 0;
    cart.forEach(function (i) {
      items.push("- " + i.name + " x" + i.qty + " ($" + (i.price * i.qty).toFixed(2) + ")");
      total += i.price * i.qty;
    });
    var reply;
    if (items.length === 0) {
      reply = "Your cart is empty. Want to browse the catalog?";
    } else {
      reply = "Here's your cart:\n\n" + items.join("\n") + "\n\n**Total: $" + total.toFixed(2) + "**";
    }
    openCart();
    return { reply: reply, context: "cart" };
  }
  // Stock/catalog queries
  if (/(what.*(in stock|available|catalog|catalogue|catelog|have)|show.*(catalog|catalogue|catelog)|browse.*(catalog|catalogue|catelog|product))/.test(t)) {
    var lines = products.map(function (p) {
      var stockInfo = p.stock <= 0 ? "Out of stock" : p.stock + " in stock";
      return "- **" + p.name + "** — $" + p.price.toFixed(2) + " (" + stockInfo + ")";
    });
    var reply = "Here's what we have in stock:\n\n" + lines.join("\n");
    openCatalog();
    return { reply: reply, context: "catalog" };
  }
  return null;
}

// ---------- events ----------
async function send() {
  var text = inputEl.value.trim();
  if (!text) return;
  if (typingAbort && !typingAbort.isDone()) typingAbort.skip();
  inputEl.value = "";
  inputEl.style.height = "auto";
  removeWelcome();

  var grouped = lastMsgRole === "customer";
  addMessage("customer", textNode(text), { grouped: grouped });
  lastMsgRole = "customer";

  chatHistory.push({ role: "user", content: text });

  // Check for local intents (cart / catalog) — show instantly, fire backend in background
  var localResult = handleLocalIntent(text);
  if (localResult) {
    var cacheKey = localResult.context + ":" + text;
    var cached = intentCache.get(cacheKey);
    var reply = cached ? cached.reply : localResult.reply;
    var context = cached ? cached.context : localResult.context;

    if (!cached) {
      intentCache.set(cacheKey, { reply: reply, context: context });
    }

    chatHistory.push({ role: "assistant", content: reply });
    var indicator = addMessage("ai", mdContainer());
    typingAbort = typeText(indicator.querySelector(".md-content"), reply, { fast: true });
    addSuggestions(indicator, context);
    lastMsgRole = "ai";
    sendBtn.disabled = false;
    inputEl.disabled = false;

    // Fire backend in background, replace bubble if it responds
    chatWithBackend(text).then(function (result) {
      if (result.text && result.text.trim()) {
        var newReply = result.text.trim();
        var mdEl = indicator.querySelector(".md-content");
        if (mdEl) {
          mdEl.innerHTML = renderMarkdown(newReply);
          chatHistory[chatHistory.length - 1].content = newReply;
          intentCache.set(cacheKey, { reply: newReply, context: context });
          checkAutoScroll();
        }
      }
    }).catch(function () {});

    return;
  }

  var indicator = addMessage("ai", typingNode());

  sendBtn.disabled = true;
  inputEl.disabled = true;

  try {
    var result = await chatWithBackend(text);
    var reply = (result.text || "").trim();
    var suggestionContext;
    if (!reply) {
      reply = "Sorry, I didn't quite catch that. Could you rephrase?";
      suggestionContext = "empty";
    }
    chatHistory.push({ role: "assistant", content: reply });
    var contentEl = mdContainer();
    indicator.replaceChild(contentEl, indicator.firstChild);
    typingAbort = typeText(contentEl, reply, {
      fast: reply.length > 200,
    });
    indicator.addEventListener("click", function handler() {
      if (typingAbort && !typingAbort.isDone()) typingAbort.skip();
      indicator.removeEventListener("click", handler);
    });
    addSuggestions(indicator, suggestionContext);
    if (result.toolCalls.length) {
      handleToolCalls(result.toolCalls);
    }
  } catch (err) {
    console.warn("Backend unreachable, using mock reply:", err);
    var fallback = mockReply(text);
    chatHistory.push({ role: "assistant", content: fallback });
    var contentEl = mdContainer();
    indicator.replaceChild(contentEl, indicator.firstChild);
    typingAbort = typeText(contentEl, fallback, {
      fast: fallback.length > 200,
    });
    indicator.addEventListener("click", function handler() {
      if (typingAbort && !typingAbort.isDone()) typingAbort.skip();
      indicator.removeEventListener("click", handler);
    });
    addSuggestions(indicator);
  } finally {
    sendBtn.disabled = false;
    inputEl.disabled = false;
    inputEl.focus();
  }

  lastMsgRole = "ai";

  var matches = filterProducts(text);
  if (matches.length && /(need|want|looking|find|show|suggest|stm32|controller|wifi|part|buy)/.test(text.toLowerCase())) {
    var skus = matches.map(function (p) { return p.sku; });
    setTimeout(function () { openCatalog(skus); }, 600);
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
  removeWelcome();
  showSkeletons(4);
  openCatalog();
  try {
    await loadProducts();
    removeSkeletons();
    initCatalogTabs();
    renderCatalogGrid();
  } catch (err) {
    console.error("Failed to load catalog:", err);
    removeSkeletons();
    catalogGrid.innerHTML = "";
    catalogEmpty.hidden = false;
    catalogEmpty.textContent = "Failed to load catalog. Please try again later.";
    catalogGrid.style.display = "none";
  } finally {
    browseBtn.disabled = false;
    browseBtn.textContent = "Catalog";
  }
});

cartBtn.addEventListener("click", openCart);
cartClose.addEventListener("click", closeCart);
overlay.addEventListener("click", function () {
  if (!cartDrawer.classList.contains("open")) closeCatalog();
  else closeCart();
});

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
  renderWelcome();
  updateCart();
})();

document.querySelector(".brand").addEventListener("click", newChat);

// ---------- iOS keyboard handling ----------
// On iOS Safari, 100dvh includes the area behind the URL bar and virtual
// keyboard. Listening to visualViewport events lets us resize the app
// container to match the actual visible area so the composer stays visible.
(function () {
  var vv = window.visualViewport;
  if (!vv) return;
  var app = document.querySelector(".app");

  function syncHeight() {
    app.style.height = vv.height + "px";
  }

  vv.addEventListener("resize", syncHeight);
  vv.addEventListener("scroll", syncHeight);
  syncHeight();
})();
