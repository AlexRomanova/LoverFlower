import { api } from "./api.js";
import { createAccountStore } from "./account-store.js";
import { getLanguage } from "./i18n.js";
import { notify } from "../components/app-notifications.js";

let controller;

export function initializeReviews(productId) {
  controller?.abort();
  controller = new AbortController();
  const { signal } = controller;
  const panel = document.querySelector("[data-reviews-list]").closest("section");
  const list = panel.querySelector("[data-reviews-list]");
  const empty = panel.querySelector("[data-reviews-empty]");
  const status = panel.querySelector("[data-reviews-status]");
  const retry = panel.querySelector("[data-reviews-retry]");
  const form = panel.querySelector("[data-review-form]");
  const submit = form.querySelector('[type="submit"]');
  const submitStatus = form.querySelector("[data-review-submit-status]");
  const login = panel.querySelector("[data-review-login]");
  const note = panel.querySelector("[data-review-auth-note]");
  let accounts;
  let records = [];
  let sending = false;
  try { accounts = createAccountStore(localStorage, sessionStorage); }
  catch { status.textContent = "Не удалось открыть хранилище браузера."; }
  const translate = () => document.dispatchEvent(new Event("products-rendered"));

  function render() {
    list.replaceChildren(...records.map((record) => {
      const item = document.createElement("li");
      item.className = "review";
      const stars = document.createElement("p");
      stars.className = "review-stars";
      const rating = Math.max(1, Math.min(5, Number(record.rating) || 1));
      stars.textContent = "★".repeat(rating) + "☆".repeat(5 - rating);
      stars.setAttribute("aria-label", `${rating} / 5`);
      const text = document.createElement("p");
      text.dataset.userContent = "";
      text.textContent = record.text;
      const author = document.createElement("p");
      author.className = "review__author";
      author.dataset.userContent = "";
      const date = new Date(record.createdAt);
      author.textContent = `${record.authorName} · ${Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString(getLanguage() === "en" ? "en-GB" : "ru-RU")}`;
      item.append(stars, text, author);
      return item;
    }));
    panel.dataset.reviewState = records.length ? "filled" : "empty";
    empty.hidden = records.length > 0;
    document.querySelector("[data-review-count]").textContent = records.length;
    translate();
  }

  function updateAccess() {
    const user = accounts?.currentUser();
    const customer = user?.role === "customer";
    form.hidden = !customer;
    note.hidden = customer;
    login.hidden = Boolean(user);
    submit.disabled = sending || !customer;
    if (!customer) form.reset();
    submitStatus.textContent = "";
    translate();
  }

  async function load() {
    status.textContent = "Загружаем отзывы…";
    retry.hidden = true;
    empty.hidden = true;
    translate();
    try {
      const all = await api("reviews", { signal });
      records = all.filter((record) => record.productId === productId)
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      status.textContent = "";
      render();
    } catch (error) {
      if (signal.aborted) return;
      status.textContent = error.message;
      retry.hidden = false;
      translate();
    }
  }

  form.addEventListener("input", (event) => {
    const field = event.target;
    const error = document.getElementById(`review-${field.name}-error`);
    if (error) { error.textContent = ""; field.removeAttribute("aria-invalid"); }
    submitStatus.textContent = "";
  }, { signal });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (sending) return;
    const user = accounts?.currentUser();
    if (user?.role !== "customer") { updateAccess(); return; }
    const rating = Number(form.elements.rating.value);
    const text = form.elements.text.value.trim();
    const errors = {
      rating: Number.isInteger(rating) && rating >= 1 && rating <= 5 ? "" : "Выберите оценку от 1 до 5.",
      text: text.length >= 10 && text.length <= 2000 ? "" : "Напишите отзыв длиной от 10 до 2000 символов.",
    };
    for (const [name, message] of Object.entries(errors)) {
      document.getElementById(`review-${name}-error`).textContent = message;
      form.elements[name].setAttribute("aria-invalid", String(Boolean(message)));
    }
    translate();
    const invalid = Object.keys(errors).find((name) => errors[name]);
    if (invalid) { form.elements[invalid].focus(); return; }
    sending = true;
    submit.disabled = true;
    submitStatus.textContent = "Сохраняем отзыв…";
    translate();
    try {
      const review = await api("reviews", { method: "POST", signal, body: {
        productId, userId: user.id, authorName: user.nickname || user.firstName,
        rating, text, createdAt: new Date().toISOString(),
      } });
      if (signal.aborted) return;
      records.unshift(review);
      form.reset();
      submitStatus.textContent = "Отзыв опубликован.";
      render();
      notify("Отзыв опубликован.");
    } catch (error) {
      if (!signal.aborted) submitStatus.textContent = error.message;
    } finally {
      sending = false;
      submit.disabled = accounts?.currentUser()?.role !== "customer";
      translate();
    }
  }, { signal });
  login.addEventListener("click", () => document.dispatchEvent(new CustomEvent("open-auth", { detail: { trigger: login } })), { signal });
  retry.addEventListener("click", load, { signal });
  document.addEventListener("auth-changed", updateAccess, { signal });
  document.addEventListener("settings-changed", render, { signal });
  updateAccess();
  accounts?.restore().then(() => { if (!signal.aborted) updateAccess(); }).catch(() => {});
  load();
}
