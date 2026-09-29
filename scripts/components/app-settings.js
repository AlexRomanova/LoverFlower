import { applySettings, readSettings, saveSettings, resetStorage } from "../features/settings.js";
import { createPageTranslator, loadDictionary, setLanguage, translateText } from "../features/i18n.js";
import { createVisionView } from "../features/vision.js";

// <app-settings>: общие настройки для гостя, покупателя и менеджера.
class AppSettings extends HTMLElement {
  async connectedCallback() {
    if (this.initialized) return;
    this.initialized = true;
    this.settings = readSettings(localStorage);
    this.render();
    this.dialog = this.querySelector("dialog");
    this.form = this.querySelector("form");
    this.vision = createVisionView();
    this.translatePage = createPageTranslator();
    this.fill();
    this.bindEvents();
    try { await loadDictionary(); }
    catch (error) {
      this.querySelector("[data-settings-status]").textContent = error.message;
      this.settings.language = "ru";
      this.form.elements.language.value = "ru";
    }
    this.apply();
    document.dispatchEvent(new Event("settings-ready"));
    this.observer = new MutationObserver(() => {
      if (this.imageUpdatePending) return;
      this.imageUpdatePending = true;
      requestAnimationFrame(() => { this.imageUpdatePending = false; this.vision.refreshImages(this.settings); });
    });
    this.observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["alt"] });
  }
  render() {
    this.innerHTML = `<button type="button" class="settings-launcher" data-settings-open aria-controls="settings-dialog" aria-label="Настройки сайта">⚙ <span>Настройки</span></button>
      <dialog class="settings-dialog" id="settings-dialog" aria-labelledby="settings-title">
        <div class="settings-heading"><h2 id="settings-title">Настройки сайта</h2><button type="button" data-settings-close aria-label="Закрыть настройки">×</button></div>
        <form>
          <label>Язык / Language<select name="language"><option value="ru" lang="ru">Русский</option><option value="en" lang="en">English</option></select></label>
          <label>Тема<select name="theme"><option value="dark">Тёмная</option><option value="light">Светлая</option></select></label>
          <label class="settings-check"><input type="checkbox" name="vision" /> Версия для слабовидящих</label>
          <fieldset data-vision-controls><legend>Параметры версии для слабовидящих</legend>
            <label>Размер шрифта<select name="fontSize"><option value="16">100%</option><option value="24">150%</option><option value="32">200%</option></select></label>
            <fieldset><legend>Цветовая схема</legend><label class="settings-check"><input type="radio" name="scheme" value="white-black" /> Белый фон, чёрный текст</label><label class="settings-check"><input type="radio" name="scheme" value="black-white" /> Чёрный фон, белый текст</label><label class="settings-check"><input type="radio" name="scheme" value="beige-brown" /> Бежевый фон, коричневый текст</label></fieldset>
            <label class="settings-check"><input type="checkbox" name="images" /> Показывать изображения</label>
          </fieldset>
          <p class="settings-hint">В версии для слабовидящих цветовая схема заменяет обычную тему.</p>
          <p class="settings-hint">Настройки применяются сразу и сохраняются при переходе между страницами.</p>
          <p class="settings-hint">Сброс очищает всё локальное хранилище и завершает вход. На GitHub Pages также удаляются созданные в этом браузере аккаунты, корзины и заявки. База JSON Server остаётся на сервере.</p>
          <button type="button" class="btn btn--outline" data-settings-reset>Сбросить настройки и данные браузера</button>
          <div data-reset-confirmation hidden><p>Удалить данные сайта из этого браузера?</p><button type="button" class="btn" data-reset-confirm>Да, сбросить</button><button type="button" class="auth-link" data-reset-cancel>Отмена</button></div>
          <p role="status" data-settings-status></p>
        </form>
      </dialog>`;
  }
  fill() {
    for (const [name, value] of Object.entries(this.settings)) {
      const control = this.form.elements[name];
      if (control.type === "checkbox") control.checked = value; else control.value = value;
    }
    this.querySelector("[data-vision-controls]").disabled = !this.settings.vision;
  }
  apply() {
    applySettings(this.settings);
    setLanguage(this.settings.language);
    this.translatePage();
    this.vision.update(this.settings);
    this.translatePage();
    document.dispatchEvent(new CustomEvent("settings-changed", { detail: { ...this.settings } }));
  }
  bindEvents() {
    const launcher = this.querySelector("[data-settings-open]");
    const open = (trigger = launcher) => {
      this.trigger = trigger;
      if (!this.dialog.open) this.dialog.showModal();
      document.body.classList.add("is-settings-open");
      this.querySelector("[data-settings-close]").focus();
    };
    const close = () => this.dialog.close();
    launcher.addEventListener("click", () => open());
    document.addEventListener("open-settings", (event) => open(event.detail?.trigger));
    this.querySelector("[data-settings-close]").addEventListener("click", close);
    this.dialog.addEventListener("close", () => {
      document.body.classList.remove("is-settings-open");
      this.querySelector("[data-reset-confirmation]").hidden = true;
      if (this.trigger?.isConnected) this.trigger.focus();
    });
    this.dialog.addEventListener("click", (event) => {
      if (event.target !== this.dialog) return;
      const rect = this.dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
    });
    this.form.addEventListener("submit", (event) => event.preventDefault());
    this.form.addEventListener("change", async () => {
      const revision = this.revision = (this.revision || 0) + 1;
      const next = Object.fromEntries(new FormData(this.form));
      next.vision = this.form.elements.vision.checked;
      next.images = this.form.elements.images.checked;
      next.fontSize = Number(this.form.elements.fontSize.value);
      next.scheme = this.form.elements.scheme.value;
      try {
        if (next.language === "en") await loadDictionary();
        if (revision !== this.revision) return;
        this.settings = saveSettings(localStorage, next);
        this.fill(); this.apply();
        this.querySelector("[data-settings-status]").textContent = "Настройки сохранены.";
      } catch (error) {
        this.fill(); this.querySelector("[data-settings-status]").textContent = translateText(error.message || "Не удалось сохранить настройки. Проверьте доступ к хранилищу браузера.");
      }
    });
    this.querySelector("[data-settings-reset]").addEventListener("click", () => {
      this.querySelector("[data-reset-confirmation]").hidden = false;
      this.querySelector("[data-reset-confirm]").focus();
    });
    this.querySelector("[data-reset-cancel]").addEventListener("click", () => { this.querySelector("[data-reset-confirmation]").hidden = true; this.querySelector("[data-settings-reset]").focus(); });
    this.querySelector("[data-reset-confirm]").addEventListener("click", () => {
      try {
        resetStorage(localStorage, sessionStorage);
        // Перезагрузка также сбрасывает кеш аккаунта, товаров и оформляемого заказа.
        location.replace(new URL(location.pathname, location.origin).href);
      } catch { this.querySelector("[data-settings-status]").textContent = translateText("Не удалось очистить хранилище браузера."); }
    });
    window.addEventListener("storage", (event) => {
      if (event.key !== "loverflower.settings.v1" && event.key !== null) return;
      this.settings = readSettings(localStorage); this.fill(); this.apply();
      if (event.key === null) location.reload();
    });
  }
}
customElements.define("app-settings", AppSettings);
