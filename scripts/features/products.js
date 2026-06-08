// Товары, подключённые к корзине. Цены храним целыми копейками.
const image = (file) => new URL(`../../media/home-mobile/${file}`, import.meta.url).href;

export const PRODUCTS = Object.freeze([
  { id: "home-1", name: "Лучший день", variant: "Вариант 1", priceMinor: 16700, image: image("popular-1.webp") },
  { id: "home-2", name: "Лучший день", variant: "Вариант 2", priceMinor: 16700, image: image("popular-2.webp") },
  { id: "home-3", name: "Лучший день", variant: "Вариант 3", priceMinor: 16700, image: image("popular-3.webp") },
].map(Object.freeze));

export const productsById = new Map(PRODUCTS.map((product) => [product.id, product]));
export const productLabel = (product) => `${product.name}, ${product.variant.toLowerCase()}`;
const money = new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB" });
export const formatMoney = (minor) => money.format(minor / 100);
