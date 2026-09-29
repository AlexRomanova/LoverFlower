import { api } from "./api.js";

// Единственный источник товаров — JSON API; суммы храним целыми копейками.
export const PRODUCTS = [];
export const productsById = new Map();
let loading;
export function loadProducts({ force = false, request = api } = {}) {
  if (!force && PRODUCTS.length) return Promise.resolve(PRODUCTS);
  if (loading) return loading;
  loading = request("products").then((data) => {
    if (!Array.isArray(data)) throw new Error("Не удалось прочитать каталог.");
    const products = data.map((product) => ({ ...product, image: new URL(product.image, new URL("../../", import.meta.url)).href }));
    PRODUCTS.splice(0, PRODUCTS.length, ...products);
    productsById.clear();
    PRODUCTS.forEach((product) => productsById.set(product.id, product));
    return PRODUCTS;
  }).finally(() => { loading = null; });
  return loading;
}
export const productLabel = (product) => product.name || "Товар";
const money = new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB" });
export const formatMoney = (minor) => money.format(minor / 100);

export const CATEGORY_LABELS = {
  bouquets: "Букеты", balloons: "Шары", toys: "Игрушки", cards: "Открытки", packaging: "Упаковка",
};
export const BOUQUET_TYPE_LABELS = { mono: "Монобукеты", mixed: "Сборные букеты" };
export const FORMAT_LABELS = {
  bouquet: "В упаковке", box: "В коробке", vase: "В вазе", basket: "В корзине",
  envelope: "В конверте", crate: "В ящике", bag: "В сумке",
};
export const RECIPIENT_LABELS = {
  girlfriend: "Для девушки", man: "Для мужчины", wife: "Для жены", mom: "Для мамы",
  colleague: "Для коллеги", boss: "Для начальника", daughter: "Для дочки", children: "Для детей", woman: "Для женщины",
};
export const FLOWER_LABELS = {
  rose: "Розы", peony: "Пионы", gypsophila: "Гипсофила", chrysanthemum: "Хризантемы", daisy: "Ромашки",
  hydrangea: "Гортензии", tulip: "Тюльпаны", eustoma: "Эустомы", carnation: "Гвоздики", orchid: "Орхидеи",
  gerbera: "Герберы", alstroemeria: "Альстромерии", matthiola: "Маттиола", cornflower: "Васильки",
  limonium: "Лимониум", eryngium: "Эрингиум", brunia: "Бруния", dried: "Сухоцветы",
};

// Общая карточка для каталога, рекомендаций и карусели; данные не вставляются в HTML.
export function createProductCard(product, style = "catalog-product") {
  const card = document.createElement("article");
  card.className = style;
  card.dataset.productId = product.id;
  const link = document.createElement("a");
  link.className = `${style}__image`;
  link.href = new URL(`../../pages/productCard.html?id=${encodeURIComponent(product.id)}`, import.meta.url).href;
  const image = document.createElement("img");
  image.src = product.image;
  image.alt = productLabel(product);
  image.loading = "lazy";
  image.width = 255;
  image.height = 335;
  link.append(image);
  const title = document.createElement("h3");
  const titleLink = link.cloneNode(false);
  titleLink.removeAttribute("class");
  titleLink.textContent = productLabel(product);
  title.append(titleLink);
  const price = document.createElement("p");
  price.className = `${style}__price`;
  price.textContent = formatMoney(product.priceMinor);
  if (product.oldPriceMinor > product.priceMinor) {
    const oldPrice = document.createElement("del");
    oldPrice.textContent = formatMoney(product.oldPriceMinor);
    price.append(" ", oldPrice);
  }
  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn btn--outline";
  button.dataset.addToCart = "";
  button.disabled = true; // Компонент корзины разрешает покупку после загрузки аккаунта.
  button.textContent = product.stock ? "В корзину" : "Нет в наличии";
  card.append(link, title, price, button);
  return card;
}

