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
// Remplacez cette valeur par votre Client ID PayPal (developer.paypal.com,
// section "Apps & Credentials" de votre compte PayPal Business), une fois
// que vous l'aurez créé. Tant qu'elle n'est pas remplacée, le paiement en
// ligne reste désactivé et les clients peuvent tout de même composer et
// envoyer leur commande par SMS (règlement sur place).
const PAYPAL_CLIENT_ID = "REMPLACER_PAR_VOTRE_CLIENT_ID_PAYPAL";
const SHOP_PHONE = "0699738605";
const SHOP_NAME = "Le Pain de la Cité";

function initClickCollect() {
  const items = document.querySelectorAll(".cc-item");
  if (!items.length) return;

  const cartListEl = document.getElementById("ccCartList");
  const totalEl = document.getElementById("ccTotal");
  const sendBtn = document.getElementById("ccSendSms");
  const copyBtn = document.getElementById("ccCopyOrder");
  const nameInput = document.getElementById("ccName");
  const timeInput = document.getElementById("ccTime");
  const noticeEl = document.getElementById("ccPaypalNotice");

  const paypalReady = () =>
    Boolean(PAYPAL_CLIENT_ID) && !PAYPAL_CLIENT_ID.startsWith("REMPLACER");

  let paid = false;

  function getCart() {
    const cart = [];
    items.forEach((item) => {
      const qty = parseInt(item.dataset.qty || "0", 10);
      if (qty > 0) {
        cart.push({
          name: item.dataset.name,
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
    return n.toFixed(2).replace(".", ",") + " €";
  }

  function updateActionButtons(cart) {
    const hasItems = cart.length > 0;
    const canSend = hasItems && (paid || !paypalReady());
    sendBtn.disabled = !canSend;
    copyBtn.disabled = !hasItems;
  }

  function renderCart() {
    const cart = getCart();
    const total = getTotal(cart);

    cartListEl.innerHTML = cart.length
      ? cart
          .map(
            (i) =>
              `<li><span>${i.qty}× ${i.name}</span><span>${formatEuro(i.price * i.qty)}</span></li>`
          )
          .join("")
      : '<li class="cc-empty">Aucun article sélectionné</li>';

    totalEl.textContent = formatEuro(total);
    paid = false;
    updateActionButtons(cart);
  }

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
  });

  function buildOrderText() {
    const cart = getCart();
    const total = getTotal(cart);
    const lines = [`Commande Click & Collect - ${SHOP_NAME}`];

    if (nameInput.value.trim()) lines.push(`Prénom : ${nameInput.value.trim()}`);
    if (timeInput.value.trim()) lines.push(`Retrait souhaité : ${timeInput.value.trim()}`);
    lines.push("");
    cart.forEach((i) => lines.push(`- ${i.qty}x ${i.name}`));
    lines.push("");
    lines.push(`Total : ${formatEuro(total).replace(" ", " ")}`);
    lines.push(paid ? "Réglé via PayPal" : "À régler sur place");

    return lines.join("\n");
  }

  function sendOrderBySms() {
    const url = `sms:${SHOP_PHONE}?body=${encodeURIComponent(buildOrderText())}`;
    window.location.href = url;
  }

  sendBtn.addEventListener("click", sendOrderBySms);

  copyBtn.addEventListener("click", async () => {
    const text = buildOrderText();
    try {
      await navigator.clipboard.writeText(text);
      const original = copyBtn.textContent;
      copyBtn.textContent = "✅ Copié !";
      setTimeout(() => (copyBtn.textContent = original), 2000);
    } catch {
      window.prompt("Copiez votre commande ci-dessous :", text);
    }
  });

  if (paypalReady()) {
    const sdk = document.createElement("script");
    sdk.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&currency=EUR&intent=capture`;
    sdk.onload = () => {
      window.paypal
        .Buttons({
          style: { layout: "vertical", color: "gold", shape: "pill", label: "paypal" },
          createOrder: (data, actions) => {
            const cart = getCart();
            const total = getTotal(cart);
            return actions.order.create({
              purchase_units: [
                {
                  amount: { value: total.toFixed(2), currency_code: "EUR" },
                  description: cart.map((i) => `${i.qty}x ${i.name}`).join(", ").slice(0, 120),
                },
              ],
            });
          },
          onApprove: (data, actions) =>
            actions.order.capture().then(() => {
              paid = true;
              updateActionButtons(getCart());
              noticeEl.textContent = "✅ Paiement confirmé ! Envoi du récapitulatif par SMS…";
              sendOrderBySms();
            }),
          onError: () => {
            noticeEl.textContent = "Une erreur est survenue avec PayPal. Réessayez ou appelez-nous.";
          },
        })
        .render("#paypal-button-container");
    };
    document.body.appendChild(sdk);
  } else {
    noticeEl.textContent =
      "Paiement en ligne bientôt disponible. En attendant, composez votre commande et envoyez-la par SMS — vous réglerez sur place.";
  }

  renderCart();
}

initClickCollect();
