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
    const products = data.map((product) => ({ ...product, image: new URL(`../../${product.image}`, import.meta.url).href }));
    PRODUCTS.splice(0, PRODUCTS.length, ...products);
    productsById.clear();
    PRODUCTS.forEach((product) => productsById.set(product.id, product));
    return PRODUCTS;
  }).finally(() => { loading = null; });
  return loading;
}
export const productLabel = (product) => `${product.name}${product.variant ? `, ${product.variant.toLowerCase()}` : ""}`;
const money = new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB" });
export const formatMoney = (minor) => money.format(minor / 100);

