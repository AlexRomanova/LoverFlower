import { translateText } from "./i18n.js";

export const FILTER_FIELDS = ["bouquetType", "format", "recipients", "flowers", "light", "color"];
export const FLORAL_FILTER_FIELDS = ["bouquetType", "format", "flowers"];
export const PRODUCT_CATEGORIES = ["bouquets", "balloons", "toys", "cards", "packaging"];
const containerFormats = ["box", "vase", "basket", "envelope", "crate", "bag"];
const normalize = (value) => String(value || "").toLocaleLowerCase("ru").replaceAll("ё", "е").trim();
const aliases = {
  "букеты": "bouquets", "цветы": "bouquets", "букеты и композиции": "bouquets",
  "шары": "balloons", "игрушки": "toys", "открытки": "cards", "упаковка": "packaging",
  "розы": "roses", "букеты роз": "roses", "пионы": "peonies", "сборные букеты": "mixed",
  "популярное": "popular", "монобукеты": "mono", "сухоцветы": "dried", "композиции": "compositions",
  "все": "", "все товары": "", "все букеты": "",
};
export const normalizeCategory = (value) => Object.hasOwn(aliases, normalize(value)) ? aliases[normalize(value)] : normalize(value);
const legacyCategories = {
  roses: { flowers: ["rose"] }, peonies: { flowers: ["peony"] },
  mixed: { bouquetType: ["mixed"] }, mono: { bouquetType: ["mono"] },
  dried: { flowers: ["dried"] }, compositions: { format: containerFormats },
};

// Старые ссылки на цветок или состав превращаем в независимые фильтры.
function resolveState(state) {
  const category = normalizeCategory(state.category);
  const legacy = Object.hasOwn(legacyCategories, category) ? legacyCategories[category] : undefined;
  return {
    ...state,
    category: legacy ? "bouquets" : category,
    ...Object.fromEntries(FILTER_FIELDS.map((field) => [field, [...new Set([...(state[field] || []), ...(legacy?.[field] || [])])]])),
  };
}

function productCategory(product) {
  const category = normalizeCategory(product.category);
  return Object.hasOwn(legacyCategories, category) ? "bouquets" : category;
}

function fieldValue(product, field) {
  if (field === "bouquetType" && !product.bouquetType && productCategory(product) === "bouquets") {
    return product.category === "mixed" || new Set(product.flowers || []).size > 1 ? "mixed" : "mono";
  }
  return product[field];
}

// В одной группе фильтров — ИЛИ, между разными группами — И.
export function selectProducts(products, requestedState = {}) {
  const state = resolveState(requestedState);
  const query = normalize(state.q);
  const needsFlowers = FLORAL_FILTER_FIELDS.some((field) => state[field].length);
  const result = products.filter((product) => {
    const category = productCategory(product);
    if (state.category && state.category !== "popular" && category !== state.category) return false;
    if (state.category === "popular" && (product.popularity || 0) < 85) return false;
    if (needsFlowers && category !== "bouquets") return false;
    const fields = [product.name, product.variant, product.description, product.composition];
    const text = normalize([...fields, ...fields.map((value) => translateText(value || "", "en"))].join(" "));
    if (query && !query.split(/\s+/).every((word) => text.includes(word))) return false;
    if (Number.isFinite(state.minPrice) && product.priceMinor < state.minPrice) return false;
    if (Number.isFinite(state.maxPrice) && product.priceMinor > state.maxPrice) return false;
    return FILTER_FIELDS.every((field) => !state[field].length || state[field].some((value) => {
      const actual = fieldValue(product, field);
      return Array.isArray(actual) ? actual.includes(value) : actual === value;
    }));
  });
  const comparators = {
    "price-asc": (a, b) => a.priceMinor - b.priceMinor,
    "price-desc": (a, b) => b.priceMinor - a.priceMinor,
    new: (a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")),
    popular: (a, b) => (b.popularity || 0) - (a.popularity || 0),
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
  return resolveState({
    q: params.get("q") || "", category: params.get("category"),
    sort: params.get("sort") || "popular", page: Math.max(1, Math.trunc(Number(params.get("page"))) || 1),
    minPrice: price("price-min"), maxPrice: price("price-max"),
    ...Object.fromEntries(FILTER_FIELDS.map((field) => [field, params.getAll(field)])),
  });
}

export function writeCatalogState(requestedState) {
  const state = resolveState(requestedState);
  const params = new URLSearchParams();
  if (state.q) params.set("q", state.q);
  if (state.category) params.set("category", state.category);
  if (state.sort && state.sort !== "popular") params.set("sort", state.sort);
  if (state.page > 1) params.set("page", state.page);
  for (const field of FILTER_FIELDS) state[field].forEach((value) => params.append(field, value));
  if (Number.isFinite(state.minPrice)) params.set("price-min", state.minPrice / 100);
  if (Number.isFinite(state.maxPrice)) params.set("price-max", state.maxPrice / 100);
  return params;
}
