(() => {
  const root = new URL("../../", document.currentScript.src).href;
  const asset = (path) => new URL(path, root).href;

  class AppMobileMenu extends HTMLElement {
    connectedCallback() {
      if (!this.initialized) {
        this.render();
        this.dialog = this.querySelector("dialog");
        this.initialized = true;
      }
      this.controller = new AbortController();
      this.bindEvents();
    }

    disconnectedCallback() {
      this.close();
      this.controller.abort();
    }

    render() {
      this.innerHTML = `
        <div class="site-overlays">
          <dialog class="mobile-drawer" id="mobile-menu-dialog" aria-label="Мобильное меню">
            <div class="mobile-drawer__head">
              <a class="site-header__mark" href="${root}index.html" aria-label="Lover Flower — главная">
                <span>L</span>
                <span>F</span>
              </a>
              <button type="button" data-menu-close aria-label="Закрыть меню" autofocus>×</button>
            </div>
            <nav aria-label="Мобильная навигация">
              <a href="${root}pages/catalog.html">Каталог</a>
              <a href="${root}pages/delivery.html">Доставка и оплата</a>
              <a href="${root}pages/about.html">О нас</a>
              <a href="${root}pages/contacts.html">Контакты</a>
              <a href="${root}pages/faq.html">FAQ</a>
              <a href="${root}pages/corporate.html">Для корпоративных клиентов</a>
            </nav>
            <address>
              <a href="mailto:zakaz@loverflower.by">zakaz@loverflower.by</a>
              <small>Доставка 24/7 по договоренности с оператором</small>
              <a href="${root}pages/contacts.html">ул. Тимирязева 67</a>
              <small>10:00 до 21:00<br />без выходных</small>
              <a href="tel:+375291136969">+375 (29) 113-69-69</a>
              <small>Прием звонков круглосуточно</small>
            </address>
            <div class="mobile-drawer__socials">
              <span title="Instagram"><img src="${asset("media/icons/icon_instagram.svg")}" alt="Instagram" /></span>
              <span title="WhatsApp"><img src="${asset("media/icons/icon_whatsapp.svg")}" alt="WhatsApp" /></span>
              <span title="Viber"><img src="${asset("media/icons/icon_viber.svg")}" alt="Viber" /></span>
            </div>
          </dialog>
        </div>`;
    }

    bindEvents() {
      const options = { signal: this.controller.signal };
      document.addEventListener("open-mobile-menu", (event) => this.open(event.detail?.trigger), options);
      this.querySelector("[data-menu-close]").addEventListener("click", () => this.close(), options);
      this.dialog.addEventListener("click", (event) => {
        if (event.target.closest("a")) this.close();
        if (event.target !== this.dialog) return;
        const bounds = this.dialog.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right ||
            event.clientY < bounds.top || event.clientY > bounds.bottom) this.close();
      }, options);
      this.dialog.addEventListener("close", () => this.restorePage(), options);
      this.dialog.addEventListener("cancel", (event) => {
        event.preventDefault();
        this.close();
      }, options);
      window.matchMedia("(min-width: 761px)").addEventListener("change", (event) => {
        if (event.matches) this.close();
      }, options);
    }

    open(trigger) {
      if (this.dialog.open || !window.matchMedia("(max-width: 760px)").matches) return;
      this.trigger = trigger;
      this.dialog.showModal();
      document.body.classList.add("is-menu-open");
      this.trigger?.setAttribute("aria-expanded", "true");
    }

    close() {
      if (!this.dialog?.open) return;
      this.dialog.close();
      this.restorePage();
    }

    restorePage() {
      if (this.dialog.open) return;
      document.body.classList.remove("is-menu-open");
      this.trigger?.setAttribute("aria-expanded", "false");
      if (this.trigger?.isConnected && this.trigger.getClientRects().length) {
        this.trigger.focus({ preventScroll: true });
      }
      this.trigger = null;
    }
  }

  customElements.define("app-mobile-menu", AppMobileMenu);
})();
