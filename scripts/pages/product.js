import { PRODUCTS, productsById, loadProducts, productLabel, formatMoney, CATEGORY_LABELS, createProductCard } from "../features/products.js";
import { MAX_QUANTITY } from "../features/cart-store.js";

const status = document.querySelector("[data-product-status]");
const hero = document.querySelector(".product-hero");
const recommendations = document.querySelector(".recommendations__grid");
async function initialize() {
  status.textContent = "Загружаем букет…";
  try {
    await loadProducts();
    const id = new URLSearchParams(location.search).get("id") || "home-1";
    const product = productsById.get(id);
    if (!product) {
      status.textContent = "Такого букета нет в каталоге. Выберите другой букет.";
      document.querySelector("[data-product-content]").hidden = true;
      return;
    }
    document.title = `${productLabel(product)} — Lover Flower`;
    hero.setAttribute("aria-label", productLabel(product));
    hero.querySelector(".product-info").dataset.productId = product.id;
    for (const [field, value] of Object.entries({ title: productLabel(product), price: formatMoney(product.priceMinor), composition: product.composition, description: product.description, category: CATEGORY_LABELS[product.category] || product.category, stock: product.stock ? `В наличии: ${product.stock} шт.` : "Нет в наличии" })) {
      hero.querySelector(`[data-field="${field}"]`).textContent = value || "Уточняется у флориста";
    }
    const oldPrice = hero.querySelector('[data-field="old-price"]');
    oldPrice.hidden = !(product.oldPriceMinor > product.priceMinor);
    oldPrice.textContent = formatMoney(product.oldPriceMinor || product.priceMinor);
    document.querySelector("[data-product-breadcrumb]").textContent = productLabel(product);
    const image = hero.querySelector("[data-product-image]");
    image.src = product.image;
    image.alt = productLabel(product);
    recommendations.replaceChildren(...PRODUCTS.filter((p) => p.id !== id).sort((a, b) => Number(b.category === product.category) - Number(a.category === product.category)).slice(0, 4).map((p) => createProductCard(p, "recommendation")));
    const input = hero.querySelector("[data-product-quantity]");
    input.max = Math.min(MAX_QUANTITY, product.stock);
    const validateQuantity = () => {
      const valid = input.validity.valid && Number.isInteger(Number(input.value)) && Number(input.value) >= 1 && Number(input.value) <= Math.min(MAX_QUANTITY, product.stock);
      const button = hero.querySelector("[data-add-to-cart]");
      button.dataset.invalidQuantity = String(!valid);
      hero.querySelector("[data-quantity-error]").textContent = valid || !product.stock ? "" : `Введите целое количество от 1 до ${input.max}.`;
      input.setAttribute("aria-invalid", String(!valid));
      document.dispatchEvent(new Event("products-rendered"));
    };
    input.disabled = !product.stock;
    input.addEventListener("input", validateQuantity);
    document.querySelector("[data-product-content]").hidden = false;
    validateQuantity();
    status.textContent = "";
    document.querySelector("[data-product-retry]").hidden = true;
    const cart = document.querySelector("app-cart-modal");
    if (cart?.initialized && !cart.storageAvailable) cart.initialize();
  } catch (error) {
    status.textContent = error.message;
    document.querySelector("[data-product-retry]").hidden = false;
  }
}
document.querySelector("[data-product-retry]").addEventListener("click", initialize);
initialize();
