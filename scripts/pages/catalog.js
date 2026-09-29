import {
  PRODUCTS, loadProducts, createProductCard, formatMoney,
  CATEGORY_LABELS, BOUQUET_TYPE_LABELS, FORMAT_LABELS, RECIPIENT_LABELS, FLOWER_LABELS,
} from "../features/products.js";
import { FILTER_FIELDS, FLORAL_FILTER_FIELDS, PRODUCT_CATEGORIES, selectProducts, paginateProducts, readCatalogState, writeCatalogState } from "../features/catalog.js";

const form = document.querySelector(".catalog-filters__form");
const search = document.querySelector("[data-catalog-search]");
const sort = document.querySelector("#catalog-sort");
const grid = document.querySelector("[data-catalog-items]");
const status = document.querySelector("[data-catalog-status]");
const pagination = document.querySelector("[data-pagination]");
const selection = document.querySelector("[data-catalog-selection]");
const selectionItems = document.querySelector("[data-active-filters]");
const filterDetails = document.querySelector(".catalog-filter-details");
const narrowScreen = matchMedia("(max-width: 760px)");
filterDetails.open = !narrowScreen.matches;
narrowScreen.addEventListener("change", () => { filterDetails.open = !narrowScreen.matches; });
let state = readCatalogState(new URLSearchParams(location.search));
const filterLabels = {
  bouquetType: BOUQUET_TYPE_LABELS, format: FORMAT_LABELS, recipients: RECIPIENT_LABELS, flowers: FLOWER_LABELS,
  light: { soft: "Нежные", bright: "Яркие" },
  color: { white: "Белый", yellow: "Желтый", green: "Зеленый", red: "Красный", orange: "Оранжевый", pink: "Розовый", blue: "Синий", purple: "Фиолетовый", grey: "Серый", multicolor: "Разноцветный" },
};
const filterPrefixes = { bouquetType: "Состав:", format: "Формат:", recipients: "Кому:", flowers: "Цветы:", light: "Настроение:", color: "Цвет:" };

function fillControls() {
  search.elements.q.value = state.q;
  sort.value = ["popular", "price-asc", "price-desc", "new"].includes(state.sort) ? state.sort : "popular";
  form.querySelectorAll('[type="checkbox"]').forEach((input) => { input.checked = state[input.name]?.includes(input.value); });
  form.elements["price-min"].value = Number.isFinite(state.minPrice) ? state.minPrice / 100 : "";
  form.elements["price-max"].value = Number.isFinite(state.maxPrice) ? state.maxPrice / 100 : "";
  document.querySelector("[data-price-error]").textContent = "";
  for (const name of ["price-min", "price-max"]) form.elements[name].removeAttribute("aria-invalid");
}

function saveURL() {
  const params = writeCatalogState(state);
  history.replaceState(null, "", `${location.pathname}${params.size ? `?${params}` : ""}${location.hash}`);
}

function renderSelection() {
  selectionItems.replaceChildren();
  function add(label, prefix, remove, userContent = false) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "catalog-selection__chip";
    button.setAttribute("aria-label", `Убрать фильтр: ${label}`);
    const heading = document.createElement("span");
    heading.textContent = prefix;
    const value = document.createElement("span");
    value.textContent = label;
    if (userContent) value.dataset.userContent = "";
    const close = document.createElement("span");
    close.textContent = "×";
    close.setAttribute("aria-hidden", "true");
    button.append(heading, value, close);
    button.addEventListener("click", () => {
      const index = [...selectionItems.children].indexOf(item);
      remove(); state.page = 1; fillControls(); render();
      const buttons = selectionItems.querySelectorAll("button");
      if (buttons.length) buttons[Math.min(index, buttons.length - 1)].focus();
      else search.elements.q.focus();
    });
    item.append(button); selectionItems.append(item);
  }
  if (state.category) add(CATEGORY_LABELS[state.category] || (state.category === "popular" ? "Популярное" : state.category), "Категория:", () => { state.category = ""; });
  if (state.q) add(state.q, "Поиск:", () => { state.q = ""; }, true);
  for (const field of FILTER_FIELDS) for (const value of state[field] || []) {
    add(filterLabels[field]?.[value] || value, filterPrefixes[field], () => { state[field] = state[field].filter((item) => item !== value); });
  }
  for (const [field, prefix] of [["minPrice", "Цена от:"], ["maxPrice", "Цена до:"]]) {
    if (Number.isFinite(state[field])) add(formatMoney(state[field]), prefix, () => { state[field] = undefined; }, true);
  }
  selection.hidden = !selectionItems.children.length;
  const accessory = PRODUCT_CATEGORIES.includes(state.category) && state.category !== "bouquets";
  form.querySelectorAll("[data-floral-filter]").forEach((fieldset) => { fieldset.disabled = accessory; });
  document.querySelector("[data-floral-filter-hint]").hidden = !accessory;
}

function render() {
  const result = paginateProducts(selectProducts(PRODUCTS, state), state.page, document.documentElement.dataset.vision === "true" ? 4 : 12);
  state.page = result.page;
  grid.replaceChildren(...result.items.map((product) => createProductCard(product)));
  status.textContent = result.total ? `Найдено товаров: ${result.total}. Страница ${result.page} из ${result.pages}.` : "Ничего не найдено. Измените запрос или сбросьте фильтры.";
  renderSelection();
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
function resetCatalog() {
  state = readCatalogState(new URLSearchParams());
  fillControls(); updateFilters();
}
form.addEventListener("reset", (event) => { event.preventDefault(); resetCatalog(); });
document.querySelector("[data-clear-catalog]").addEventListener("click", resetCatalog);
search.addEventListener("submit", (event) => { event.preventDefault(); state.q = search.elements.q.value.trim(); state.page = 1; render(); });
search.elements.q.addEventListener("input", () => { state.q = search.elements.q.value.trim(); state.page = 1; render(); });
sort.addEventListener("change", () => { state.sort = sort.value; state.page = 1; render(); });
document.querySelector(".catalog-categories").addEventListener("click", (event) => {
  const link = event.target.closest("[data-category]");
  if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  event.preventDefault(); state.category = link.dataset.category; state.page = 1;
  if (PRODUCT_CATEGORIES.includes(state.category) && state.category !== "bouquets") {
    for (const field of FLORAL_FILTER_FIELDS) state[field] = [];
  }
  fillControls(); render();
});
window.addEventListener("popstate", () => { state = readCatalogState(new URLSearchParams(location.search)); fillControls(); render(); });
document.addEventListener("settings-changed", () => { if (PRODUCTS.length) render(); });
fillControls();
async function initialize() {
  status.textContent = "Загружаем товары…";
  try {
    await loadProducts();
    if (PRODUCTS.length) for (const name of ["price-min", "price-max"]) form.elements[name].placeholder = name === "price-min" ? Math.min(...PRODUCTS.map((p) => p.priceMinor)) / 100 : Math.max(...PRODUCTS.map((p) => p.priceMinor)) / 100;
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
