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
function initClickCollect() {
  const items = document.querySelectorAll(".cc-item");
  if (!items.length) return;

  const cartListEl = document.getElementById("ccCartList");
  const subtotalEl = document.getElementById("ccSubtotal");
  const discountEl = document.getElementById("ccDiscount");
  const totalEl = document.getElementById("ccTotal");
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

  function renderCart() {
    const cart = getCart();
    const subtotal = getTotal(cart);
    const discount = subtotal * DISCOUNT_RATE;
    const total = subtotal - discount;

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

  renderCart();
}

initClickCollect();
