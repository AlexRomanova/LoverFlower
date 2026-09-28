import { PRODUCTS, loadProducts, createProductCard } from "../features/products.js";
import { FILTER_FIELDS, selectProducts, paginateProducts, readCatalogState } from "../features/catalog.js";

const form = document.querySelector(".catalog-filters__form");
const search = document.querySelector("[data-catalog-search]");
const sort = document.querySelector("#catalog-sort");
const grid = document.querySelector("[data-catalog-items]");
const status = document.querySelector("[data-catalog-status]");
const pagination = document.querySelector("[data-pagination]");
const filterDetails = document.querySelector(".catalog-filter-details");
const narrowScreen = matchMedia("(max-width: 760px)");
filterDetails.open = !narrowScreen.matches;
narrowScreen.addEventListener("change", () => { filterDetails.open = !narrowScreen.matches; });
let state = readCatalogState(new URLSearchParams(location.search));

function fillControls() {
  search.elements.q.value = state.q;
  sort.value = ["popular", "price-asc", "price-desc", "new"].includes(state.sort) ? state.sort : "popular";
  form.querySelectorAll('[type="checkbox"]').forEach((input) => { input.checked = state[input.name]?.includes(input.value); });
  form.elements["price-min"].value = Number.isFinite(state.minPrice) ? state.minPrice / 100 : "";
  form.elements["price-max"].value = Number.isFinite(state.maxPrice) ? state.maxPrice / 100 : "";
}

function saveURL() {
  const params = new URLSearchParams();
  if (state.q) params.set("q", state.q);
  if (state.category) params.set("category", state.category);
  if (state.sort !== "popular") params.set("sort", state.sort);
  if (state.page > 1) params.set("page", state.page);
  for (const field of FILTER_FIELDS) (state[field] || []).forEach((value) => params.append(field, value));
  if (Number.isFinite(state.minPrice)) params.set("price-min", state.minPrice / 100);
  if (Number.isFinite(state.maxPrice)) params.set("price-max", state.maxPrice / 100);
  history.replaceState(null, "", `${location.pathname}${params.size ? `?${params}` : ""}${location.hash}`);
}

function render() {
  const result = paginateProducts(selectProducts(PRODUCTS, state), state.page, document.documentElement.dataset.vision === "true" ? 4 : 12);
  state.page = result.page;
  grid.replaceChildren(...result.items.map((product) => createProductCard(product)));
  status.textContent = result.total ? `Найдено букетов: ${result.total}. Страница ${result.page} из ${result.pages}.` : "Ничего не найдено. Измените запрос или сбросьте фильтры.";
  pagination.replaceChildren();
  pagination.hidden = result.pages <= 1;
  for (let page = 1; page <= result.pages; page += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = page;
    button.setAttribute("aria-label", `Страница ${page}`);
    if (page === result.page) button.setAttribute("aria-current", "page");
    button.addEventListener("click", () => {
      state.page = page;
      render();
      status.focus({ preventScroll: true });
      status.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    });
    pagination.append(button);
  }
  document.querySelectorAll("[data-category]").forEach((link) => {
    if (link.dataset.category === state.category) link.setAttribute("aria-current", "true");
    else link.removeAttribute("aria-current");
  });
  saveURL();
  document.dispatchEvent(new Event("products-rendered"));
}

function updateFilters() {
  const data = new FormData(form);
  const error = document.querySelector("[data-price-error]");
  const min = form.elements["price-min"], max = form.elements["price-max"];
  const reversed = min.value !== "" && max.value !== "" && Number(min.value) > Number(max.value);
  if (!min.validity.valid || !max.validity.valid || reversed) {
    error.textContent = reversed ? "Цена «от» не должна превышать цену «до»." : "Введите неотрицательную цену с точностью до копеек.";
    status.textContent = "Исправьте диапазон цены, чтобы применить фильтры.";
    min.setAttribute("aria-invalid", "true"); max.setAttribute("aria-invalid", "true");
    return;
  }
  error.textContent = "";
  min.removeAttribute("aria-invalid"); max.removeAttribute("aria-invalid");
  const next = readCatalogState(new URLSearchParams(data));
  state = { ...state, ...Object.fromEntries(FILTER_FIELDS.map((field) => [field, next[field]])), minPrice: next.minPrice, maxPrice: next.maxPrice, page: 1 };
  render();
}

form.addEventListener("submit", (event) => event.preventDefault());
form.addEventListener("input", updateFilters);
form.addEventListener("reset", (event) => {
  event.preventDefault();
  state = readCatalogState(new URLSearchParams());
  fillControls(); updateFilters();
});
search.addEventListener("submit", (event) => { event.preventDefault(); state.q = search.elements.q.value.trim(); state.page = 1; render(); });
search.elements.q.addEventListener("input", () => { state.q = search.elements.q.value.trim(); state.page = 1; render(); });
sort.addEventListener("change", () => { state.sort = sort.value; state.page = 1; render(); });
document.querySelector(".catalog-categories").addEventListener("click", (event) => {
  const link = event.target.closest("[data-category]");
  if (!link || event.ctrlKey || event.metaKey || event.shiftKey) return;
  event.preventDefault(); state.category = link.dataset.category; state.page = 1; render();
});
window.addEventListener("popstate", () => { state = readCatalogState(new URLSearchParams(location.search)); fillControls(); render(); });
document.addEventListener("settings-changed", () => { if (PRODUCTS.length) render(); });
fillControls();
async function initialize() {
  status.textContent = "Загружаем букеты…";
  try {
    await loadProducts();
    for (const name of ["price-min", "price-max"]) form.elements[name].placeholder = name === "price-min" ? Math.min(...PRODUCTS.map((p) => p.priceMinor)) / 100 : Math.max(...PRODUCTS.map((p) => p.priceMinor)) / 100;
    render();
    // Повторная попытка загрузки каталога также восстанавливает компонент корзины.
    const cart = document.querySelector("app-cart-modal");
    if (cart?.initialized && !cart.storageAvailable) cart.initialize();
    document.querySelector("[data-catalog-retry]").hidden = true;
  } catch (error) {
    status.textContent = error.message;
    document.querySelector("[data-catalog-retry]").hidden = false;
  }
}
document.querySelector("[data-catalog-retry]").addEventListener("click", initialize);
initialize();
