// <app-callback-modal>: кнопка обратного звонка, форма и её валидация.
(() => {
  const root = new URL("../../", document.currentScript.src).href;

  class AppCallbackModal extends HTMLElement {
    connectedCallback() {
      if (!this.initialized) {
        this.render();
        this.dialog = this.querySelector("dialog");
        this.form = this.querySelector("form");
        this.phone = this.form.elements.phone;
        this.error = this.querySelector(".callback-form__error");
        this.status = this.querySelector("[role=status]");
        this.submitButton = this.form.querySelector('[type="submit"]');
        this.widget = this.querySelector(".callback-widget");
        this.initialized = true;
      }
      this.controller = new AbortController();
      this.bindEvents();
      this.updateSubmitButton();
    }

    disconnectedCallback() {
      this.close();
      this.controller.abort();
    }

    render() {
      this.innerHTML = `
        <button class="callback-widget" type="button" aria-label="Заказать звонок"
          aria-haspopup="dialog" aria-controls="callback-dialog" aria-expanded="false">
          <img src="${root}media/icons/icon_phone.webp" alt="" />
          <span>Заказать звонок</span>
        </button>
        <div class="site-overlays">
          <dialog class="site-dialog callback-dialog" id="callback-dialog" aria-labelledby="callback-title">
            <button class="site-dialog__close" type="button" aria-label="Закрыть окно">×</button>
            <h2 id="callback-title">Заказать звонок</h2>
            <span class="site-dialog__line" aria-hidden="true"></span>
            <p>Введите номер для заявки на обратный звонок.</p>
            <form class="callback-form" novalidate>
              <div class="callback-form__field">
                <label for="callback-name">Ваше имя (необязательно)</label>
                <input id="callback-name" name="name" autocomplete="name" maxlength="60" placeholder="Ваше имя" />
              </div>
              <div class="callback-form__field">
                <label for="callback-phone">Телефон <span aria-hidden="true">*</span></label>
                <input id="callback-phone" name="phone" type="tel" autocomplete="tel" maxlength="32"
                  placeholder="+375 (29) 123-45-67" aria-describedby="callback-phone-hint callback-phone-error" required />
                <small id="callback-phone-hint">Номер Беларуси в формате +375 XX XXX-XX-XX.</small>
                <p class="callback-form__error" id="callback-phone-error" hidden></p>
              </div>
              <button class="btn" type="submit" disabled>Заказать звонок</button>
              <small>Учебная форма: заявки доступны в кабинете менеджера.</small>
              <p class="site-form-status" role="status" aria-live="polite"></p>
            </form>
          </dialog>
        </div>`;
    }

    bindEvents() {
      const options = { signal: this.controller.signal };
      this.widget.addEventListener("click", () => this.open(), options);
      this.querySelector(".site-dialog__close").addEventListener("click", () => this.close(), options);
      this.dialog.addEventListener("cancel", (event) => {
        event.preventDefault();
        this.close();
      }, options);
      this.dialog.addEventListener("close", () => this.restorePage(), options);
      this.dialog.addEventListener("click", (event) => {
        if (event.target !== this.dialog) return;
        const bounds = this.dialog.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right ||
            event.clientY < bounds.top || event.clientY > bounds.bottom) this.close();
      }, options);
      this.form.addEventListener("input", (event) => {
        if (event.target === this.phone) {
          this.error.hidden = true;
          this.phone.removeAttribute("aria-invalid");
        }
        this.status.textContent = "";
        this.updateSubmitButton();
      }, options);
      this.phone.addEventListener("blur", () => this.validatePhone(), options);
      this.form.addEventListener("submit", (event) => {
        event.preventDefault();
        if (this.validatePhone()) this.saveRequest();
      }, options);
    }

    normalizePhone() {
      const value = this.phone.value.trim();
      if (!/^\+?[\d\s()-]+$/.test(value)) return "";
      const compact = value.replace(/[\s()-]/g, "");
      const normalized = compact.startsWith("+") ? compact : `+${compact}`;
      return /^\+375\d{9}$/.test(normalized) ? normalized : "";
    }

    validatePhone() {
      const valid = Boolean(this.normalizePhone());
      this.error.textContent = this.phone.value.trim()
        ? "Введите номер Беларуси: +375 и ещё 9 цифр."
        : "Введите номер телефона.";
      this.error.hidden = valid;
      this.phone.setAttribute("aria-invalid", String(!valid));
      if (!valid) this.submitButton.disabled = true;
      return valid;
    }

    updateSubmitButton() {
      this.submitButton.disabled = Boolean(this.busy) || !this.normalizePhone();
    }

    async saveRequest() {
      if (this.busy) return;
      this.busy = true;
      this.updateSubmitButton();
      try {
        const { createRequest } = await import(`${root}scripts/features/requests.js`);
        await createRequest("callback", {
          name: this.form.elements.name.value.trim(),
          phone: this.normalizePhone(),
        });
        this.form.reset();
        this.phone.removeAttribute("aria-invalid");
        this.error.hidden = true;
        this.updateSubmitButton();
        this.status.textContent = "Учебная заявка сохранена и доступна менеджеру.";
        this.dispatchEvent(new CustomEvent("site-notification", { bubbles: true, detail: { message: this.status.textContent } }));
      } catch (error) {
        this.status.textContent = error.message;
        this.dispatchEvent(new CustomEvent("site-notification", { bubbles: true, detail: { message: error.message, type: "error" } }));
      }
      finally { this.busy = false; this.updateSubmitButton(); }
    }

    open() {
      if (this.dialog.open) return;
      this.error.hidden = true;
      this.phone.removeAttribute("aria-invalid");
      this.status.textContent = "";
      this.updateSubmitButton();
      this.dialog.showModal();
      document.body.classList.add("is-callback-open");
      this.widget.setAttribute("aria-expanded", "true");
      this.phone.focus();
    }

    close() {
      if (!this.dialog?.open) return;
      this.dialog.close();
      this.restorePage();
    }

    restorePage() {
      if (this.dialog.open) return;
      document.body.classList.remove("is-callback-open");
      this.widget.setAttribute("aria-expanded", "false");
      if (this.widget.isConnected) this.widget.focus({ preventScroll: true });
    }
  }

  customElements.define("app-callback-modal", AppCallbackModal);
})();
