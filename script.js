document.getElementById("year").textContent = new Date().getFullYear();

const toggle = document.querySelector(".nav-toggle");
const nav = document.querySelector(".nav");

toggle.addEventListener("click", () => {
  const isOpen = nav.classList.toggle("nav-open");
  toggle.setAttribute("aria-expanded", String(isOpen));
});

nav.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    nav.classList.remove("nav-open");
    toggle.setAttribute("aria-expanded", "false");
  });
});

// ---- Click & Collect ----
// Paiement en ligne (CB + titre-restaurant via Monext/Conecs) pas encore
// disponible : le panier est consultable, mais aucune commande ne peut
// être finalisée pour l'instant. Voir les boutons désactivés dans le HTML.

// Notification automatique par email (EmailJS) une fois la commande payée.
// Remplace le SMS manuel : dès qu'un paiement Monext aboutit, appeler
// sendOrderEmail(cart, subtotal, discount, total) depuis le futur
// gestionnaire de succès de paiement.
const EMAILJS_SERVICE_ID = "service_carcj63";
const EMAILJS_TEMPLATE_ID = "template_uic83b7";
const EMAILJS_PUBLIC_KEY = "py6_7IyPbRAmN4CJz";

if (window.emailjs) {
  emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
}

function formatEuroGlobal(n) {
  return n.toFixed(2).replace(".", ",") + " €";
}

function generateOrderNumber() {
  const digits = Math.floor(100000 + Math.random() * 900000);
  return `LPC-${digits}`;
}

function buildOrderEmailMessage(cart, subtotal, discount, total, name, pickupTime, orderNumber) {
  const lines = ["Nouvelle commande Click & Collect - Le Pain de la Cité", ""];
  lines.push(`Numéro de commande : ${orderNumber}`);
  lines.push(`Nom : ${name}`);
  lines.push(`Heure de retrait souhaitée : ${pickupTime}`);
  lines.push("");
  cart.forEach((i) => lines.push(`- ${i.qty}x ${i.name}${i.flavor ? ` (${i.flavor})` : ""}`));
  lines.push("");
  lines.push(`Sous-total : ${formatEuroGlobal(subtotal)}`);
  lines.push(`Réduction Click & Collect (-5%) : -${formatEuroGlobal(discount)}`);
  lines.push(`Total payé : ${formatEuroGlobal(total)}`);
  return lines.join("\n");
}

function sendOrderEmail(cart, subtotal, discount, total, name, pickupTime, orderNumber) {
  if (!window.emailjs) return Promise.reject(new Error("EmailJS non chargé"));
  return emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
    message: buildOrderEmailMessage(cart, subtotal, discount, total, name, pickupTime, orderNumber),
  });
}

// DÉMO EN COURS : horaires désactivés temporairement pour montrer le
// Click & Collect à quelqu'un. Remettre à false pour réactiver le blocage
// du lundi-vendredi avant 10h30.
const DEMO_DISABLE_HOURS = true;

// Vrai/faux selon l'heure de Paris : commandes acceptées du lundi au
// vendredi, avant 10h30 (indépendant du fuseau horaire du visiteur).
function isClickCollectOpen() {
  if (DEMO_DISABLE_HOURS) return true;

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .formatToParts(new Date())
    .reduce((acc, p) => ((acc[p.type] = p.value), acc), {});

  const isWeekday = !["Sat", "Sun"].includes(parts.weekday);
  const beforeCutoff =
    parseInt(parts.hour, 10) < 10 ||
    (parseInt(parts.hour, 10) === 10 && parseInt(parts.minute, 10) < 30);

  return isWeekday && beforeCutoff;
}

// Prix, visibilité des articles à la carte et liste des desserts pilotés
// depuis data/menu.json, éditable via l'admin (Decap CMS) sans toucher au
// code. Un article "masqué" (visible: false) reste dans la page (qty à 0,
// juste caché avec [hidden]) : le repasser à visible: true dans le CMS le
// fait réapparaître immédiatement, sans rien recréer.
function loadMenuData() {
  return fetch("data/menu.json")
    .then((res) => (res.ok ? res.json() : null))
    .catch(() => null);
}

// Construit un article "à la carte" simple (nom, prix, +/-, pas de choix
// de saveur) pour un article ajouté depuis l'admin qui n'a pas encore de
// case correspondante toute faite sur la page.
function createAlacarteItem(entry) {
  const item = document.createElement("div");
  item.className = "cc-item";
  item.dataset.name = entry.name;
  item.dataset.price = String(entry.price);
  item.dataset.qty = "0";

  const info = document.createElement("div");
  info.className = "cc-item-info";
  const nameEl = document.createElement("span");
  nameEl.className = "cc-item-name";
  nameEl.textContent = entry.name;
  const priceEl = document.createElement("span");
  priceEl.className = "cc-item-price";
  priceEl.textContent = formatEuroGlobal(entry.price);
  info.append(nameEl, priceEl);

  const qty = document.createElement("div");
  qty.className = "cc-qty";
  const dec = document.createElement("button");
  dec.type = "button";
  dec.className = "cc-qty-btn";
  dec.dataset.action = "dec";
  dec.setAttribute("aria-label", `Retirer un ${entry.name}`);
  dec.textContent = "−";
  const value = document.createElement("span");
  value.className = "cc-qty-value";
  value.textContent = "0";
  const inc = document.createElement("button");
  inc.type = "button";
  inc.className = "cc-qty-btn";
  inc.dataset.action = "inc";
  inc.setAttribute("aria-label", `Ajouter un ${entry.name}`);
  inc.textContent = "+";
  qty.append(dec, value, inc);

  item.append(info, qty);
  return item;
}

function applyMenuData(data) {
  if (!data) return;

  if (Array.isArray(data.alacarte)) {
    const picker = document.querySelector(".cc-picker");
    data.alacarte.forEach((entry) => {
      let item = document.querySelector(`.cc-item[data-name="${CSS.escape(entry.name)}"]`);
      if (!item && picker && typeof entry.price === "number") {
        item = createAlacarteItem(entry);
        picker.appendChild(item);
      }
      if (!item) return;
      if (typeof entry.price === "number") {
        item.dataset.price = String(entry.price);
        const priceEl = item.querySelector(".cc-item-price");
        if (priceEl) priceEl.textContent = formatEuroGlobal(entry.price);
      }
      item.hidden = entry.visible === false;

      // Un article à la carte peut être lié à une formule du midi qui sert
      // le même plat (ex. Pâtes -> Menu Pâtes) : masquer l'un masque
      // l'autre, un seul interrupteur "Visible" suffit pour les deux.
      if (entry.linkedMenu) {
        const linked = document.querySelector(`.cc-item[data-name="${CSS.escape(entry.linkedMenu)}"]`);
        if (linked) linked.hidden = entry.visible === false;
      }
    });
  }

  // Les articles à la carte marqués "dessertOption" alimentent aussi la
  // liste des desserts des formules, avec le même prix/visibilité que
  // l'article à la carte : un seul interrupteur "Visible" dans le CMS
  // suffit désormais pour gérer un dessert aux deux endroits.
  const dessertOptions = Array.isArray(data.alacarte)
    ? data.alacarte
        .filter((entry) => entry.dessertOption && entry.visible !== false)
        .map((entry) => ({
          value: entry.name,
          label: entry.name.toLowerCase().replace(/\bmilka\b/i, "Milka"),
        }))
    : [];

  document.querySelectorAll('select.cc-flavor[data-dessert-group="sucre"]').forEach((select) => {
    const current = select.value;
    select.innerHTML = dessertOptions
      .map((d) => `<option value="${d.value}">Dessert : ${d.label}</option>`)
      .join("");
    if (dessertOptions.some((d) => d.value === current)) select.value = current;
  });
}

function initClickCollect() {
  const items = document.querySelectorAll(".cc-item");
  if (!items.length) return;

  const layoutEl = document.getElementById("ccLayout");
  const closedEl = document.getElementById("ccClosedNotice");

  function applyOpenState() {
    const open = isClickCollectOpen();
    layoutEl.hidden = !open;
    closedEl.hidden = open;
  }

  applyOpenState();
  setInterval(applyOpenState, 60000);

  const cartListEl = document.getElementById("ccCartList");
  const subtotalEl = document.getElementById("ccSubtotal");
  const discountEl = document.getElementById("ccDiscount");
  const totalEl = document.getElementById("ccTotal");
  const payDemoBtn = document.getElementById("ccPayDemo");
  const payDemoNoticeEl = document.getElementById("ccPayDemoNotice");
  const nameInput = document.getElementById("ccName");
  const timeInput = document.getElementById("ccTime");
  const orderModal = document.getElementById("ccOrderModal");
  const orderNumberEl = document.getElementById("ccOrderNumber");
  const orderModalCloseBtn = document.getElementById("ccOrderModalClose");
  const DISCOUNT_RATE = 0.05;

  function fieldsFilled() {
    return Boolean(nameInput.value.trim() && timeInput.value.trim());
  }

  orderModalCloseBtn.addEventListener("click", () => {
    orderModal.hidden = true;
  });

  function getCart() {
    const cart = [];
    items.forEach((item) => {
      const qty = parseInt(item.dataset.qty || "0", 10);
      if (qty > 0) {
        const choices = Array.from(item.querySelectorAll(".cc-flavor")).map((el) => el.value);
        cart.push({
          name: item.dataset.name,
          flavor: choices.length ? choices.join(", ") : null,
          price: parseFloat(item.dataset.price),
          qty,
        });
      }
    });
    return cart;
  }

  function getTotal(cart) {
    return cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  }

  function formatEuro(n) {
    return n.toFixed(2).replace(".", ",") + " €";
  }

  let currentCart = [];
  let currentSubtotal = 0;
  let currentDiscount = 0;
  let currentTotal = 0;

  function renderCart() {
    const cart = getCart();
    const subtotal = getTotal(cart);
    const discount = subtotal * DISCOUNT_RATE;
    const total = subtotal - discount;
    currentCart = cart;
    currentSubtotal = subtotal;
    currentDiscount = discount;
    currentTotal = total;

    cartListEl.innerHTML = cart.length
      ? cart
          .map(
            (i) =>
              `<li><span>${i.qty}× ${i.name}${i.flavor ? ` (${i.flavor})` : ""}</span><span>${formatEuro(i.price * i.qty)}</span></li>`
          )
          .join("")
      : '<li class="cc-empty">Aucun article sélectionné</li>';

    subtotalEl.textContent = formatEuro(subtotal);
    discountEl.textContent = "-" + formatEuro(discount);
    totalEl.textContent = formatEuro(total);
    payDemoBtn.disabled = cart.length === 0 || !fieldsFilled();
    payDemoNoticeEl.textContent = "";
  }

  [nameInput, timeInput].forEach((el) =>
    el.addEventListener("input", () => {
      payDemoBtn.disabled = currentCart.length === 0 || !fieldsFilled();
    })
  );

  payDemoBtn.addEventListener("click", () => {
    if (!fieldsFilled()) {
      payDemoNoticeEl.textContent = "⚠️ Merci de renseigner le nom et l'heure de retrait.";
      payDemoNoticeEl.style.color = "#E23B3B";
      return;
    }
    payDemoBtn.disabled = true;
    payDemoBtn.textContent = "Envoi en cours…";
    const orderNumber = generateOrderNumber();
    sendOrderEmail(
      currentCart,
      currentSubtotal,
      currentDiscount,
      currentTotal,
      nameInput.value.trim(),
      timeInput.value.trim(),
      orderNumber
    )
      .then(() => {
        payDemoNoticeEl.textContent = "";
        orderNumberEl.textContent = orderNumber;
        orderModal.hidden = false;
      })
      .catch((err) => {
        const reason = (err && (err.text || err.message)) || String(err);
        payDemoNoticeEl.textContent = "❌ Échec de l'envoi : " + reason;
        payDemoNoticeEl.style.color = "#E23B3B";
      })
      .finally(() => {
        payDemoBtn.disabled = currentCart.length === 0 || !fieldsFilled();
        payDemoBtn.textContent = "💳 Payer";
      });
  });

  items.forEach((item) => {
    const dec = item.querySelector('[data-action="dec"]');
    const inc = item.querySelector('[data-action="inc"]');
    const valueEl = item.querySelector(".cc-qty-value");

    function setQty(q) {
      q = Math.max(0, Math.min(20, q));
      item.dataset.qty = String(q);
      valueEl.textContent = String(q);
      renderCart();
    }

    dec.addEventListener("click", () => setQty(parseInt(item.dataset.qty || "0", 10) - 1));
    inc.addEventListener("click", () => setQty(parseInt(item.dataset.qty || "0", 10) + 1));

    item.querySelectorAll(".cc-flavor").forEach((el) => el.addEventListener("change", renderCart));
  });

  renderCart();
}

loadMenuData()
  .then(applyMenuData)
  .finally(initClickCollect);
