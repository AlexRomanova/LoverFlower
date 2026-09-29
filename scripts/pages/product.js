import { PRODUCTS, productsById, loadProducts, productLabel, formatMoney, CATEGORY_LABELS, FORMAT_LABELS, RECIPIENT_LABELS, FLOWER_LABELS, createProductCard } from "../features/products.js";
import { MAX_QUANTITY } from "../features/cart-store.js";
import { initializeReviews } from "../features/reviews.js";

const status = document.querySelector("[data-product-status]");
const hero = document.querySelector(".product-hero");
const recommendations = document.querySelector(".recommendations__grid");

function catalogLink(filters) {
  const url = new URL("../../pages/catalog.html", import.meta.url);
  url.search = new URLSearchParams(filters).toString();
  return url.href;
}

function renderMetadata(product) {
  const floral = product.category === "bouquets";
  const category = hero.querySelector('[data-field="category"]');
  category.textContent = CATEGORY_LABELS[product.category] || "Товары";
  category.href = catalogLink({ category: product.category });
  const breadcrumb = document.querySelector("[data-product-category-breadcrumb]");
  breadcrumb.textContent = category.textContent;
  breadcrumb.href = category.href;
  const setLink = (field, label, filters) => {
    const link = hero.querySelector(`[data-field="${field}"]`);
    link.closest("[data-floral-metadata]").hidden = !floral || !label;
    link.textContent = label || "";
    link.href = catalogLink({ category: "bouquets", ...filters });
  };
  setLink("bouquet-type", { mono: "Монобукет", mixed: "Сборный букет" }[product.bouquetType], { bouquetType: product.bouquetType || "" });
  setLink("format", FORMAT_LABELS[product.format], { format: product.format || "" });
  const setTags = (selector, values, labels, filter) => {
    const container = hero.querySelector(selector);
    const keys = Array.isArray(values) ? [...new Set(values)].filter((key) => labels[key]) : [];
    container.closest("[data-floral-metadata]").hidden = !floral || !keys.length;
    container.replaceChildren(...keys.map((key) => {
      const link = document.createElement("a");
      link.className = "product-info__tag";
      link.textContent = labels[key];
      link.href = catalogLink({ category: "bouquets", [filter]: key });
      return link;
    }));
  };
  setTags("[data-product-flowers]", product.flowers, FLOWER_LABELS, "flowers");
  setTags("[data-product-recipients]", product.recipients, RECIPIENT_LABELS, "recipients");
  hero.querySelector("[data-composition-label]").textContent = floral ? "Состав:" : "Комплектация:";
  document.querySelectorAll("[data-floral-extra]").forEach((element) => { element.hidden = !floral; });
  document.querySelector(".product-extra__grid").toggleAttribute("data-accessory", !floral);
}

function recommendedProducts(product) {
  const candidates = PRODUCTS.filter((item) => item.id !== product.id && item.stock > 0);
  const similarity = (item) => Number(item.bouquetType === product.bouquetType) + Number(item.format === product.format);
  const sameCategory = candidates.filter((item) => item.category === product.category).sort((a, b) => similarity(b) - similarity(a));
  const extraCategories = product.category === "bouquets" ? ["cards", "balloons", "toys", "packaging"] : ["bouquets", "cards", "balloons", "toys", "packaging"];
  const extras = extraCategories.filter((category) => category !== product.category).map((category) => candidates.find((item) => item.category === category)).filter(Boolean);
  const result = [...sameCategory.slice(0, 2), ...extras.slice(0, 2)];
  for (const item of [...sameCategory, ...extras, ...candidates]) {
    if (result.length >= 4) break;
    if (!result.some((entry) => entry.id === item.id)) result.push(item);
  }
  return result;
}

async function initialize() {
  status.textContent = "Загружаем товар…";
  try {
    await loadProducts();
    const id = new URLSearchParams(location.search).get("id") || "home-1";
    const product = productsById.get(id);
    if (!product) {
      status.textContent = "Такого товара нет в каталоге. Выберите другой товар.";
      document.querySelector("[data-product-content]").hidden = true;
      return;
    }
    document.title = `${productLabel(product)} — Lover Flower`;
    hero.setAttribute("aria-label", productLabel(product));
    hero.querySelector(".product-info").dataset.productId = product.id;
    for (const [field, value] of Object.entries({ title: productLabel(product), price: formatMoney(product.priceMinor), composition: product.composition || product.description || "Описание уточняется.", description: product.description || "", stock: product.stock ? `В наличии: ${product.stock} шт.` : "Нет в наличии" })) {
      hero.querySelector(`[data-field="${field}"]`).textContent = value;
    }
    renderMetadata(product);
    const oldPrice = hero.querySelector('[data-field="old-price"]');
    oldPrice.hidden = !(product.oldPriceMinor > product.priceMinor);
    oldPrice.textContent = formatMoney(product.oldPriceMinor || product.priceMinor);
    document.querySelector("[data-product-breadcrumb]").textContent = productLabel(product);
    const image = hero.querySelector("[data-product-image]");
    image.src = product.image;
    image.alt = productLabel(product);
    recommendations.replaceChildren(...recommendedProducts(product).map((item) => createProductCard(item, "recommendation")));
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
    initializeReviews(product.id);
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
