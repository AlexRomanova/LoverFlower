import { translateText } from "./i18n.js";
export const FILTER_FIELDS = ["light", "color", "format", "flowers"];
const normalize = (value) => String(value || "").toLocaleLowerCase("ru").replaceAll("ё", "е").trim();
const aliases = { "розы": "roses", "букеты роз": "roses", "пионы": "peonies", "сборные букеты": "mixed", "популярное": "popular", "монобукеты": "mono" };
export const normalizeCategory = (value) => aliases[normalize(value)] || value || "";

// В одной группе фильтров — ИЛИ, между разными группами — И.
export function selectProducts(products, state = {}) {
  const query = normalize(state.q);
  const category = normalizeCategory(state.category);
  const result = products.filter((product) => {
    if (category === "mono" && product.category === "mixed") return false;
    if (category && !["mono", "popular"].includes(category) && product.category !== category) return false;
    if (category === "popular" && product.popularity < 85) return false;
    const fields = [product.name, product.variant, product.description, product.composition];
    const text = normalize([...fields, ...fields.map((value) => translateText(value || "", "en"))].join(" "));
    if (query && !query.split(/\s+/).every((word) => text.includes(word))) return false;
    if (Number.isFinite(state.minPrice) && product.priceMinor < state.minPrice) return false;
    if (Number.isFinite(state.maxPrice) && product.priceMinor > state.maxPrice) return false;
    return FILTER_FIELDS.every((field) => !state[field]?.length || state[field].some((value) =>
      Array.isArray(product[field]) ? product[field].includes(value) : product[field] === value));
  });
  const comparators = {
    "price-asc": (a, b) => a.priceMinor - b.priceMinor,
    "price-desc": (a, b) => b.priceMinor - a.priceMinor,
    new: (a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")),
    popular: (a, b) => b.popularity - a.popularity,
  };
  return result.sort(comparators[state.sort] || comparators.popular);
}

export function paginateProducts(products, requestedPage = 1, pageSize = 12) {
  const pages = Math.max(1, Math.ceil(products.length / pageSize));
  const page = Math.min(pages, Math.max(1, Math.trunc(Number(requestedPage)) || 1));
  return { items: products.slice((page - 1) * pageSize, page * pageSize), page, pages, total: products.length };
}

export function readCatalogState(params) {
  const price = (name) => {
    const value = params.get(name);
    return value !== null && value.trim() !== "" && Number.isFinite(Number(value)) && Number(value) >= 0
      ? Math.round(Number(value) * 100) : undefined;
  };
  return {
    q: params.get("q") || "", category: normalizeCategory(params.get("category")),
    sort: params.get("sort") || "popular", page: params.get("page") || 1,
    minPrice: price("price-min"), maxPrice: price("price-max"),
    ...Object.fromEntries(FILTER_FIELDS.map((field) => [field, params.getAll(field)])),
  };
}
