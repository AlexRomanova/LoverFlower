// Общий сигнал: вызываем только после завершения действия, а не при загрузке страницы.
export function notify(message, type = "success") {
  document.dispatchEvent(new CustomEvent("site-notification", { detail: { message, type } }));
}

// <app-notifications>: одно всплывающее сообщение с закрытием и паузой при чтении.
class AppNotifications extends HTMLElement {
  connectedCallback() {
    if (this.controller) return;
    this.controller = new AbortController();
    this.region = document.createElement("div");
    this.region.className = "site-notification-region";
    this.region.setAttribute("aria-live", "polite");
    this.region.hidden = true;
    document.body.append(this.region);
    const options = { signal: this.controller.signal };
    document.addEventListener("site-notification", (event) => this.show(event.detail), options);
    // Переносим сообщение в открытый dialog: оно доступно поверх его backdrop.
    document.addEventListener("close", () => this.moveRegion(), { ...options, capture: true });
    this.region.addEventListener("pointerenter", () => { this.hovered = true; this.pause(); }, options);
    this.region.addEventListener("pointerleave", () => { this.hovered = false; this.resume(); }, options);
    this.region.addEventListener("focusin", () => this.pause(), options);
    this.region.addEventListener("focusout", () => queueMicrotask(() => this.resume()), options);
  }

  disconnectedCallback() {
    clearTimeout(this.timer);
    this.controller?.abort();
    this.controller = null;
    this.region?.remove();
  }

  moveRegion() {
    const dialogs = [...document.querySelectorAll("dialog[open]")];
    const parent = dialogs.at(-1) || document.body;
    if (this.region.parentElement !== parent) parent.append(this.region);
  }

  show({ message, type = "success" } = {}) {
    if (typeof message !== "string" || !message.trim()) return;
    this.dismiss();
    this.moveRegion();
    const toast = document.createElement("div");
    toast.className = "site-notification";
    toast.dataset.type = type === "error" ? "error" : "success";
    const text = document.createElement("p");
    text.setAttribute("role", type === "error" ? "alert" : "status");
    text.setAttribute("aria-atomic", "true");
    const close = document.createElement("button");
    close.type = "button";
    close.setAttribute("aria-label", "Закрыть уведомление");
    close.textContent = "×";
    close.addEventListener("click", () => this.dismiss(true));
    toast.append(text, close);
    this.region.append(toast);
    this.region.hidden = false;
    this.trigger = document.activeElement;
    // Живой регион уже находится в DOM, когда в нём появляется сообщение.
    requestAnimationFrame(() => { if (text.isConnected) text.textContent = message; });
    this.remaining = type === "error" ? 0 : 8000;
    this.resume();
  }

  pause() {
    if (!this.timer) return;
    clearTimeout(this.timer);
    this.timer = null;
    this.remaining = Math.max(1, this.remaining - (performance.now() - this.started));
  }

  resume() {
    if (this.timer || !this.remaining || this.region.hidden || this.hovered || this.region.contains(document.activeElement)) return;
    this.started = performance.now();
    this.timer = setTimeout(() => this.dismiss(), this.remaining);
  }

  dismiss(restoreFocus = false) {
    clearTimeout(this.timer);
    this.timer = null;
    this.remaining = 0;
    if (restoreFocus && this.region.contains(document.activeElement)) {
      const trigger = this.trigger?.isConnected && this.trigger !== document.body && !this.trigger.matches(":disabled") && this.trigger.getClientRects().length
        ? this.trigger : this.region.closest("dialog")?.querySelector("button:not(:disabled)");
      trigger?.focus({ preventScroll: true });
    }
    this.region.hidden = true;
    this.region.replaceChildren();
  }
}

customElements.define("app-notifications", AppNotifications);
