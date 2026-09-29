import { createAccountStore } from "../features/account-store.js";
import "./app-order-list.js";

// <app-history-modal>: личная история, отдельная от оформления и корзины.
class AppHistoryModal extends HTMLElement {
  connectedCallback() {
    this.controller = new AbortController();
    this.accounts = createAccountStore(localStorage, sessionStorage);
    this.innerHTML = `<div class="site-overlays"><dialog class="site-dialog history-dialog" id="history-dialog" aria-labelledby="history-title">
      <button class="site-dialog__close" type="button" data-history-close aria-label="Закрыть историю заказов" autofocus>×</button>
      <h2 id="history-title">История заказов</h2><app-order-list></app-order-list>
    </dialog></div>`;
    this.dialog = this.querySelector("dialog");
    const options = { signal: this.controller.signal };
    document.addEventListener("open-history", (event) => this.open(event.detail?.trigger), options);
    document.addEventListener("auth-changed", () => { if (this.accounts.currentUser()?.id !== this.ownerId) this.close(); }, options);
    this.querySelector("[data-history-close]").addEventListener("click", () => this.close(), options);
    this.dialog.addEventListener("cancel", (event) => { event.preventDefault(); this.close(); }, options);
    this.dialog.addEventListener("close", () => this.restorePage(), options);
    this.dialog.addEventListener("click", (event) => {
      if (event.target !== this.dialog) return;
      const rect = this.dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) this.close();
    }, options);
  }
  disconnectedCallback() { this.close(); this.controller.abort(); }
  open(trigger) {
    const user = this.accounts.currentUser();
    if (this.dialog.open || user?.role !== "customer") return;
    this.trigger = trigger; this.ownerId = user.id;
    this.querySelector("app-order-list").refresh();
    this.dialog.showModal();
    document.body.classList.add("is-history-open");
    trigger?.setAttribute("aria-expanded", "true");
  }
  close() { if (this.dialog?.open) { this.dialog.close(); this.restorePage(); } }
  restorePage() {
    if (this.dialog.open || !document.body.classList.contains("is-history-open")) return;
    document.body.classList.remove("is-history-open");
    this.trigger?.setAttribute("aria-expanded", "false");
    const fallback = document.querySelector('[data-open="menu"]')?.getClientRects().length ? document.querySelector('[data-open="menu"]') : document.querySelector(".site-header__member-button");
    const trigger = this.trigger?.isConnected && this.trigger.getClientRects().length ? this.trigger : fallback;
    trigger?.focus({ preventScroll: true });
    this.trigger = null;
  }
}
customElements.define("app-history-modal", AppHistoryModal);
