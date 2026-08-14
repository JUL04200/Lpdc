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
// Client ID PayPal SANDBOX (mode test, aucun vrai paiement n'est débité).
// Une fois les tests validés, remplacez-le par le Client ID LIVE
// (developer.paypal.com > Apps & Credentials > bascule "Live") pour
// encaisser de vrais paiements.
const PAYPAL_CLIENT_ID = "AbNVuwB-OpkZeIkBuv_1go_e5ltbGtuMZERcAHVckSGhMHPYV6YBsGD86ge1Z2g3w5bNKCI-hDavAk7C";
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

  // Paiement en ligne uniquement : tant que paypalReady() est vrai, l'envoi
  // de la commande est bloqué jusqu'à un paiement PayPal confirmé.
  let paid = false;

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

  function updateActionButtons(cart) {
    const hasItems = cart.length > 0;
    sendBtn.disabled = !(hasItems && (paid || !paypalReady()));
    copyBtn.disabled = !hasItems;
  }

  function renderCart() {
    const cart = getCart();
    const total = getTotal(cart);

    cartListEl.innerHTML = cart.length
      ? cart
          .map(
            (i) =>
              `<li><span>${i.qty}× ${i.name}${i.flavor ? ` (${i.flavor})` : ""}</span><span>${formatEuro(i.price * i.qty)}</span></li>`
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

    item.querySelectorAll(".cc-flavor").forEach((el) => el.addEventListener("change", renderCart));
  });

  function buildOrderText() {
    const cart = getCart();
    const total = getTotal(cart);
    const lines = [`Commande Click & Collect - ${SHOP_NAME}`];

    if (nameInput.value.trim()) lines.push(`Prénom : ${nameInput.value.trim()}`);
    if (timeInput.value.trim()) lines.push(`Retrait souhaité : ${timeInput.value.trim()}`);
    lines.push("");
    cart.forEach((i) => lines.push(`- ${i.qty}x ${i.name}${i.flavor ? ` (${i.flavor})` : ""}`));
    lines.push("");
    lines.push(`Total : ${formatEuro(total)}`);
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
                  description: cart
                    .map((i) => `${i.qty}x ${i.name}${i.flavor ? ` (${i.flavor})` : ""}`)
                    .join(", ")
                    .slice(0, 120),
                },
              ],
            });
          },
          onApprove: (data, actions) =>
            actions.order.capture().then(() => {
              paid = true;
              updateActionButtons(getCart());
              noticeEl.textContent =
                "✅ Paiement confirmé, merci ! Votre application SMS va s'ouvrir avec votre commande prête à envoyer à la boulangerie — il ne vous reste plus qu'à appuyer sur \"Envoyer\".";
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
