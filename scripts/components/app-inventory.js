import { notify } from "./app-notifications.js";
import { api } from "../features/api.js";
import { createAccountStore } from "../features/account-store.js";
import { loadProducts, productLabel } from "../features/products.js";

// <app-inventory>: кабинет менеджера, отдельный от компонентов покупателя.
class AppInventory extends HTMLElement {
  connectedCallback() {
    this.controller = new AbortController();
    this.accounts = createAccountStore(localStorage, sessionStorage);
    this.innerHTML = `<p data-inventory-status role="status">Загружаем каталог…</p><div data-inventory-items></div>`;
    document.addEventListener("auth-changed", () => this.refresh(), { signal: this.controller.signal });
    this.addEventListener("submit", (event) => { event.preventDefault(); this.save(event.target); }, { signal: this.controller.signal });
    this.addEventListener("input", (event) => {
      const form = event.target.closest("form");
      if (form) { form.querySelector("[role='status']").textContent = ""; form.querySelectorAll("[data-field-error]").forEach((node) => { node.textContent = ""; }); }
    }, { signal: this.controller.signal });
    this.accounts.restore().then(() => this.refresh()).catch((error) => this.setStatus(error.message));
  }
  disconnectedCallback() { this.controller.abort(); }
  setStatus(message) { this.querySelector("[data-inventory-status]").textContent = message; }
  async refresh() {
    const revision = this.revision = (this.revision || 0) + 1;
    const container = this.querySelector("[data-inventory-items]");
    container.replaceChildren();
    const user = this.accounts.currentUser();
    if (user?.role !== "manager") {
      this.setStatus(user ? "Управление каталогом доступно только менеджеру." : "Войдите в аккаунт менеджера, чтобы управлять товарами.");
      const button = document.createElement("button");
      button.type = "button"; button.className = "btn"; button.textContent = "Войти";
      button.addEventListener("click", () => this.dispatchEvent(new CustomEvent("open-auth", { bubbles: true, detail: { trigger: button } })));
      container.append(button);
      return;
    }
    this.setStatus("Загружаем товары…");
    try {
      const products = await loadProducts({ force: true });
      if (revision !== this.revision || !this.isConnected) return;
      const fragment = document.createDocumentFragment();
      for (const product of products) {
        const form = document.createElement("form");
        form.className = "inventory-item"; form.dataset.id = product.id; form.noValidate = true;
        form.innerHTML = `<img loading="lazy" width="100" height="120" /><h3></h3>
          <div><label>Цена, ₽ <input name="price" type="number" min="0.01" max="1000000" step="0.01" required /></label><p data-field-error="price" class="auth-error"></p></div>
          <div><label>В наличии <input name="stock" type="number" min="0" max="99" step="1" required /></label><p data-field-error="stock" class="auth-error"></p></div>
          <button class="btn btn--outline" type="submit">Сохранить</button><p class="inventory-item__status" role="status" aria-live="polite"></p>`;
        form.querySelector("img").src = product.image; form.querySelector("img").alt = productLabel(product);
        form.querySelector("h3").textContent = productLabel(product);
        form.elements.price.value = (product.priceMinor / 100).toFixed(2);
        form.elements.stock.value = product.stock;
        fragment.append(form);
      }
      container.replaceChildren(fragment);
      this.setStatus(`Товаров: ${products.length}. Изменения сохраняются в базе и видны покупателям после обновления страницы.`);
    } catch (error) { this.setStatus(error.message); }
  }
  async save(form) {
    if (this.accounts.currentUser()?.role !== "manager") return;
    if (form.dataset.saving || !form.matches(".inventory-item")) return;
    const price = Number(form.elements.price.value);
    const stock = Number(form.elements.stock.value);
    const priceMinor = Math.round(price * 100);
    const errors = {
      price: !form.elements.price.value || !Number.isFinite(price) || priceMinor < 1 || priceMinor > 100000000 || Math.abs(price * 100 - priceMinor) > 0.000001 ? "Введите цену от 0,01 до 1 000 000 с двумя знаками после запятой." : "",
      stock: !form.elements.stock.value || !Number.isSafeInteger(stock) || stock < 0 || stock > 99 ? "Введите целое число от 0 до 99." : "",
    };
    Object.entries(errors).forEach(([field, message]) => { form.querySelector(`[data-field-error="${field}"]`).textContent = message; });
    if (Object.values(errors).some(Boolean)) return;
    form.dataset.saving = "true";
    Array.from(form.elements).forEach((element) => { element.disabled = true; });
    const status = form.querySelector("[role='status']");
    status.textContent = "Сохраняем…";
    try {
      const product = await api(`products/${encodeURIComponent(form.dataset.id)}`, { method: "PATCH", body: { priceMinor, stock }, signal: this.controller.signal });
      form.elements.price.value = (product.priceMinor / 100).toFixed(2); form.elements.stock.value = product.stock;
      status.textContent = "Цена и наличие сохранены."; notify(status.textContent);
    } catch (error) { if (error.name !== "AbortError") { status.textContent = error.message; notify(error.message, "error"); } }
    finally { delete form.dataset.saving; Array.from(form.elements).forEach((element) => { element.disabled = false; }); }
  }
}
customElements.define("app-inventory", AppInventory);
