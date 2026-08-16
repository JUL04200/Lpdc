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

function buildOrderEmailMessage(cart, subtotal, discount, total) {
  const lines = ["Nouvelle commande Click & Collect - Le Pain de la Cité", ""];
  cart.forEach((i) => lines.push(`- ${i.qty}x ${i.name}${i.flavor ? ` (${i.flavor})` : ""}`));
  lines.push("");
  lines.push(`Sous-total : ${formatEuroGlobal(subtotal)}`);
  lines.push(`Réduction Click & Collect (-5%) : -${formatEuroGlobal(discount)}`);
  lines.push(`Total payé : ${formatEuroGlobal(total)}`);
  return lines.join("\n");
}

function sendOrderEmail(cart, subtotal, discount, total) {
  if (!window.emailjs) return Promise.reject(new Error("EmailJS non chargé"));
  return emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
    message: buildOrderEmailMessage(cart, subtotal, discount, total),
  });
}

function initClickCollect() {
  const items = document.querySelectorAll(".cc-item");
  if (!items.length) return;

  const cartListEl = document.getElementById("ccCartList");
  const subtotalEl = document.getElementById("ccSubtotal");
  const discountEl = document.getElementById("ccDiscount");
  const totalEl = document.getElementById("ccTotal");
  const testPayBtn = document.getElementById("ccTestPay");
  const testNoticeEl = document.getElementById("ccTestNotice");
  const DISCOUNT_RATE = 0.05;

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
    testPayBtn.disabled = cart.length === 0;
    testNoticeEl.textContent = "";
  }

  testPayBtn.addEventListener("click", () => {
    testPayBtn.disabled = true;
    testPayBtn.textContent = "Envoi en cours…";
    sendOrderEmail(currentCart, currentSubtotal, currentDiscount, currentTotal)
      .then(() => {
        testNoticeEl.textContent = "✅ Email de test envoyé à lpdc63@gmail.com — vérifie ta boîte de réception.";
        testNoticeEl.style.color = "#7FA65C";
      })
      .catch((err) => {
        const reason = (err && (err.text || err.message)) || String(err);
        testNoticeEl.textContent = "❌ Échec de l'envoi : " + reason;
        testNoticeEl.style.color = "#E23B3B";
      })
      .finally(() => {
        testPayBtn.disabled = false;
        testPayBtn.textContent = "🧪 TEST — Payer (envoie l'email)";
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

initClickCollect();
