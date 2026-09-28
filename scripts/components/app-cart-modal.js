import { CART_KEY, MAX_QUANTITY, cartSummary } from "../features/cart-store.js";
import { productsById, productLabel, formatMoney, loadProducts } from "../features/products.js";
import { createAccountStore } from "../features/account-store.js";
import { createCustomerCart } from "../features/customer-cart.js";

// <app-cart-modal>: окно корзины, кнопки карточек и переход к входу.
class AppCartModal extends HTMLElement {
  connectedCallback() {
    if (!this.initialized) {
      this.render();
      this.dialog = this.querySelector("dialog");
      this.initialized = true;
    }
    this.controller = new AbortController();
    try {
      this.accounts = createAccountStore(localStorage, sessionStorage);
      this.store = createCustomerCart(localStorage, this.accounts);
    } catch { this.store = null; }
    this.bindEvents();
    this.initialize();
    customElements.whenDefined("app-auth-modal").then(() => {
      if (this.isConnected) this.updateAccount();
    });
  }

  disconnectedCallback() {
    this.returnFromAuth = false;
    this.close();
    this.controller.abort();
  }

  async initialize() {
    this.setStatus("Загружаем корзину…");
    try {
      await Promise.all([loadProducts(), this.accounts.restore()]);
      if (!this.isConnected) return;
      await this.refresh();
      this.setStatus("");
    } catch (error) { this.setStatus(error.message); }
  }

  render() {
    this.innerHTML = `
      <div class="site-overlays">
        <dialog class="cart-drawer" id="cart-dialog" aria-labelledby="cart-title">
          <div class="cart-drawer__header">
            <h2 id="cart-title">Ваша корзина</h2>
            <button type="button" data-cart-close aria-label="Закрыть корзину">×</button>
          </div>
          <div class="cart-drawer__items" data-cart-items></div>
          <div class="cart-drawer__empty" data-cart-empty>
            <p>В корзине пока нет букетов.</p>
            <button type="button" class="btn btn--outline" data-cart-close>Продолжить покупки</button>
          </div>
          <div class="cart-drawer__bottom" data-cart-bottom hidden>
            <p class="cart-drawer__total">Сумма заказа: <strong data-cart-total></strong></p>
            <p class="cart-drawer__note">Доставка рассчитывается при оформлении.</p>
            <p class="cart-drawer__note" data-cart-account-note></p>
            <button type="button" class="btn" data-cart-login hidden>Войти в аккаунт</button>
            <button type="button" class="btn" data-cart-checkout disabled hidden>Оформить заказ</button>
          </div>
          <p class="cart-drawer__status" data-cart-status role="status" aria-live="polite"></p>
        </dialog>
      </div>`;
  }

  bindEvents() {
    const options = { signal: this.controller.signal };
    document.addEventListener("open-cart", (event) => this.open(event.detail?.trigger), options);
    document.addEventListener("click", (event) => {
      const button = event.target.closest("[data-add-to-cart]");
      if (!button || button.disabled) return;
      const id = button.closest("[data-product-id]")?.dataset.productId;
      if (!productsById.has(id)) return;
      this.open(button);
      const quantityInput = button.closest("[data-product-id]").querySelector("[data-product-quantity]");
      const quantity = quantityInput ? Number(quantityInput.value) : 1;
      this.mutate(() => this.store.add(id, quantity), `${productLabel(productsById.get(id))} добавлен в корзину.`);
    }, options);
    this.querySelectorAll("[data-cart-close]").forEach((button) => button.addEventListener("click", () => this.close(), options));
    this.querySelector("[data-cart-items]").addEventListener("click", (event) => this.changeItem(event), options);
    this.dialog.addEventListener("cancel", (event) => { event.preventDefault(); this.close(); }, options);
    this.dialog.addEventListener("close", () => this.restorePage(), options);
    this.dialog.addEventListener("click", (event) => {
      if (event.target !== this.dialog) return;
      const bounds = this.dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) this.close();
    }, options);
    this.querySelector("[data-cart-login]").addEventListener("click", () => {
      this.returnFromAuth = true;
      const trigger = document.querySelector('[data-open="cart"]');
      this.close();
      this.dispatchEvent(new CustomEvent("open-auth", { bubbles: true, detail: { trigger } }));
    }, options);
    this.querySelector("[data-cart-checkout]").addEventListener("click", () => {
      if (this.busy || !this.storageAvailable || !this.snapshot?.quantity || this.accounts.currentUser()?.role !== "customer") return;
      location.href = new URL("../../pages/checkout.html", import.meta.url).href;
    }, options);
    document.addEventListener("auth-changed", () => { this.updateAccount(); this.refresh(); }, options);
    document.addEventListener("cart-updated", () => this.refresh(), options);
    document.addEventListener("products-rendered", () => { if (this.snapshot) this.updateProductButtons(); }, options);
    document.addEventListener("auth-closed", () => {
      if (!this.returnFromAuth) return;
      this.returnFromAuth = false;
      this.refresh();
      this.open(document.querySelector('[data-open="cart"]'));
    }, options);
    window.addEventListener("storage", (event) => {
      if (event.key === CART_KEY || event.key === null) this.refresh();
    }, options);
  }

  async refresh(snapshot) {
    const revision = this.revision = (this.revision || 0) + 1;
    try {
      const result = snapshot || await this.store.snapshot();
      if (revision !== this.revision || !this.isConnected) return;
      this.snapshot = result;
      this.storageAvailable = true;
    } catch (error) {
      if (revision !== this.revision || !this.isConnected) return;
      this.snapshot = cartSummary([]);
      this.storageAvailable = false;
      this.setStatus(error.message || "Не удалось открыть корзину.");
    }
    this.renderItems();
    this.querySelector("[data-cart-total]").textContent = formatMoney(this.snapshot.totalMinor);
    this.querySelector("[data-cart-empty]").hidden = this.snapshot.items.length > 0;
    this.querySelector("[data-cart-bottom]").hidden = this.snapshot.items.length === 0;
    this.updateAccount();
    this.updateProductButtons();
    this.dispatchEvent(new CustomEvent("cart-changed", { bubbles: true, detail: this.snapshot }));
  }

  renderItems() {
    const container = this.querySelector("[data-cart-items]");
    const active = container.contains(document.activeElement) ? document.activeElement : null;
    const activeId = active?.closest("[data-cart-id]")?.dataset.cartId;
    const activeAction = active?.dataset.cartAction;
    const oldIndex = Array.from(container.children).findIndex((row) => row.dataset.cartId === activeId);
    const fragment = document.createDocumentFragment();
    for (const item of this.snapshot.items) {
      const row = document.createElement("article");
      row.className = "cart-item";
      row.dataset.cartId = item.id;
      // Только постоянный шаблон; любые данные записываем через textContent/атрибуты.
      row.innerHTML = `
        <img loading="lazy" />
        <div class="cart-item__info">
          <h3></h3><small data-cart-variant></small><small data-cart-unit-price></small>
          <div class="cart-item__quantity" role="group">
            <button type="button" data-cart-action="decrease">−</button>
            <span data-cart-quantity></span>
            <button type="button" data-cart-action="increase">+</button>
          </div>
        </div>
        <div class="cart-item__actions">
          <strong></strong><button type="button" data-cart-action="remove">Удалить</button>
        </div>`;
      row.querySelector("img").src = item.image;
      row.querySelector("img").alt = productLabel(item);
      row.querySelector("h3").textContent = item.name;
      row.querySelector("[data-cart-variant]").textContent = item.variant;
      row.querySelector("[data-cart-unit-price]").textContent = `${formatMoney(item.priceMinor)} / шт.`;
      row.querySelector("[data-cart-quantity]").textContent = item.quantity;
      row.querySelector("strong").textContent = formatMoney(item.lineTotalMinor);
      row.querySelector('[role="group"]').setAttribute("aria-label", `Количество: ${productLabel(item)}`);
      for (const [action, label] of [["decrease", "Уменьшить количество"], ["increase", "Увеличить количество"], ["remove", "Удалить"]]) {
        row.querySelector(`[data-cart-action="${action}"]`).setAttribute("aria-label", `${label}: ${productLabel(item)}`);
      }
      row.querySelector('[data-cart-action="decrease"]').disabled = item.quantity === 1;
      row.querySelector('[data-cart-action="increase"]').disabled = item.quantity >= Math.min(MAX_QUANTITY, item.stock);
      fragment.append(row);
    }
    container.replaceChildren(fragment);
    if (active) {
      const row = container.querySelector(`[data-cart-id="${activeId}"]`) || container.children[Math.min(Math.max(oldIndex, 0), container.children.length - 1)];
      const button = row?.querySelector(`[data-cart-action="${activeAction}"]:not(:disabled)`) || row?.querySelector("button:not(:disabled)") || this.querySelector("[data-cart-close]");
      button.focus({ preventScroll: true });
    }
  }

  updateProductButtons() {
    document.querySelectorAll("[data-add-to-cart]").forEach((button) => {
      const id = button.closest("[data-product-id]")?.dataset.productId;
      const product = productsById.get(id);
      if (!product) return;
      const quantity = this.snapshot.items.find((item) => item.id === id)?.quantity || 0;
        button.disabled = !this.storageAvailable || this.busy || !product.stock || button.dataset.invalidQuantity === "true" || this.accounts?.currentUser()?.role === "manager";
        button.textContent = !product.stock ? "Нет в наличии" : quantity ? `В корзине: ${quantity}` : "В корзину";
      button.setAttribute("aria-label", `Добавить ${productLabel(product)} в корзину${quantity ? `. Уже добавлено: ${quantity}` : ""}`);
    });
  }

  updateAccount() {
    const user = this.accounts?.currentUser();
    const note = this.querySelector("[data-cart-account-note]");
    const login = this.querySelector("[data-cart-login]");
    const checkout = this.querySelector("[data-cart-checkout]");
    login.hidden = Boolean(user);
    login.disabled = !document.querySelector("app-auth-modal") || !customElements.get("app-auth-modal");
    checkout.hidden = user?.role !== "customer";
    checkout.disabled = this.busy || !this.storageAvailable || !this.snapshot?.quantity;
    note.textContent = user?.role === "customer"
      ? "Заказ будет сохранён в истории вашего аккаунта."
      : user ? "Для менеджера заказы доступны в его кабинете."
      : "Чтобы оформить заказ и сохранить его в личном кабинете, войдите в аккаунт.";
  }

  async mutate(operation, message) {
    if (this.busy) return;
    this.busy = true;
    this.updateAccount();
    this.updateProductButtons();
    this.querySelectorAll("[data-cart-action]").forEach((button) => { button.disabled = true; });
    try {
      await this.refresh(await operation());
      this.setStatus(`${message} Сумма: ${formatMoney(this.snapshot.totalMinor)}.`);
    } catch (error) {
      this.setStatus(error.name === "QuotaExceededError" || error.name === "SecurityError" || !this.store
        ? "Не удалось сохранить корзину. Проверьте доступ и свободное место в хранилище браузера."
        : error.message);
    } finally { this.busy = false; this.updateAccount(); this.updateProductButtons(); this.renderItems(); }
  }

  changeItem(event) {
    const button = event.target.closest("[data-cart-action]");
    if (!button || button.disabled || this.busy) return;
    const id = button.closest("[data-cart-id]").dataset.cartId;
    const action = button.dataset.cartAction;
    const item = this.snapshot.items.find((entry) => entry.id === id);
    if (!item) return;
    if (action === "remove") this.mutate(() => this.store.remove(id), `${productLabel(item)} удалён.`);
    else this.mutate(async () => {
      // Перечитываем количество, если корзина изменилась в другой вкладке.
      const latest = (await this.store.snapshot()).items.find((entry) => entry.id === id);
      if (!latest) throw new Error("Товар уже удалён из корзины.");
      return this.store.setQuantity(id, latest.quantity + (action === "increase" ? 1 : -1));
    }, "Количество изменено.");
  }

  setStatus(message) { this.querySelector("[data-cart-status]").textContent = message; }

  open(trigger) {
    if (this.dialog.open) return;
    this.trigger = trigger;
    this.setStatus("");
    this.refresh();
    this.dialog.showModal();
    document.body.classList.add("is-cart-open");
    document.querySelector('[data-open="cart"]')?.setAttribute("aria-expanded", "true");
  }

  close() {
    if (!this.dialog?.open) return;
    this.dialog.close();
    this.restorePage();
  }

  restorePage() {
    if (this.dialog.open || !document.body.classList.contains("is-cart-open")) return;
    document.body.classList.remove("is-cart-open");
    document.querySelector('[data-open="cart"]')?.setAttribute("aria-expanded", "false");
    const trigger = this.trigger?.isConnected && this.trigger.getClientRects().length
      ? this.trigger
      : document.querySelector('[data-open="cart"]');
    trigger?.focus({ preventScroll: true });
    this.trigger = null;
  }
}

customElements.define("app-cart-modal", AppCartModal);
