(() => {
  const root = new URL("../../", document.currentScript.src).href;
  const asset = (path) => new URL(path, root).href;
  const home = document.body.classList.contains("home-page");
  class AppHeader extends HTMLElement {
    connectedCallback() {
      if (this.initialized) return;
      this.initialized = true;
      this.render();
      this.bindEvents();
    }

    render() {
      this.innerHTML = `
   <header class="site-header" id="top">
      <div class="site-header__inner container">
        <button class="site-header__burger" type="button" data-open="menu"
          aria-label="Открыть меню" aria-controls="mobile-menu-dialog" aria-expanded="false" disabled>
          <span></span>
          <span class="sr-only" data-vision-label>Меню</span>
          <span></span>
          <span></span>
        </button>
        <a class="site-header__mark" href="${root}index.html" aria-label="Lover Flower — на главную">
          <span>L</span>
          <span>F</span>
        </a>
        <a class="site-header__wordmark" href="${root}index.html" aria-label="Lover Flower — на главную">
          LOVER
          <br />
          FLOWER
        </a>
        <nav class="site-header__nav" aria-label="Основная навигация">
          <div class="site-nav__catalog">
            <a href="${root}pages/catalog.html" aria-haspopup="true" aria-expanded="false">Каталог</a>
            <nav class="site-nav__submenu" aria-label="Категории каталога">
              ${[
                ["Букеты", "category=bouquets"],
                ["Сборные букеты", "category=bouquets&bouquetType=mixed"],
                ["Монобукеты", "category=bouquets&bouquetType=mono"],
                ["В коробке", "category=bouquets&format=box"],
                ["В вазе", "category=bouquets&format=vase"],
                ["Шары", "category=balloons"],
                ["Игрушки", "category=toys"],
                ["Открытки", "category=cards"],
                ["Упаковка", "category=packaging"],
              ]
                .map(
                  ([name, query]) => `
              <a href="${root}pages/catalog.html?${query}">${name}</a>
              `
                )
                .join("")}
            </nav>
          </div>
          <a href="${root}pages/delivery.html">Доставка и оплата</a>
          <a href="${root}pages/about.html">О нас</a>
          <a href="${root}pages/contacts.html">Контакты</a>
          <a href="${root}pages/faq.html">FAQ</a>
        </nav>
        <div class="site-header__tools">
          <button type="button" class="site-header__search-toggle" data-search-open aria-label="Открыть поиск">
            <img src="${asset("media/icons/icon_magnifying-glass.webp")}" alt="" />
            <span>Поиск</span>
          </button>
          <a class="site-header__phone" href="tel:+375291136969">
            <img src="${asset("media/icons/icon_phone.webp")}" alt="" /> +375 (29) 113-69-69
          </a>
          <button type="button" class="site-header__cart" data-open="cart" aria-label="Открыть корзину">
            <img src="${asset("media/icons/icon_cart_handbag.webp")}" alt="" />
            <span class="sr-only" data-vision-label>Корзина</span>
            <span data-cart-count class="site-header__count"></span>
          </button>
          <button type="button" class="site-header__guest" data-open="auth">
            <img src="${asset("media/icons/icon_sign-in.svg")}" alt="" /> Войти
          </button>
          <div class="site-header__member">
            <button
              type="button"
              class="site-header__member-button"
              aria-label="Меню личного кабинета"
              aria-expanded="false">
              <img src="${asset("media/icons/icon_account.webp")}" alt="" /> <span data-account-label></span>
            </button>
            <nav class="site-header__profile-menu" aria-label="Личный кабинет">
              <a href="${root}pages/admin.html" data-manager-link hidden>Кабинет менеджера</a>
              <button type="button" data-open="history">История заказов</button>
              <button type="button" data-profile-action="settings">Настройки</button>
              <button type="button" data-profile-action="logout">Выйти</button>
              <p class="site-header__profile-status" role="status"></p>
            </nav>
          </div>
        </div>
        <form class="site-search" role="search" aria-label="Поиск товаров">
          <label class="sr-only" for="site-search-input">Найти товар</label>
          <img src="${asset("media/icons/icon_magnifying-glass.webp")}" alt="" />
          <input
            id="site-search-input"
            name="q"
            type="search"
            placeholder="Введите свой запрос"
            autocomplete="off"
            required />
          <button type="button" data-search-close aria-label="Закрыть поиск">×</button>
        </form>
      </div>
    </header>`;
    }

    bindEvents() {
      const headerHost = this;
      for (const [selector, triggerSelector] of [
        [".site-header__member", ".site-header__member-button"],
        [".site-nav__catalog", "a[aria-haspopup]"],
      ]) {
        const container = headerHost.querySelector(selector);
        const trigger = container.querySelector(triggerSelector);
        container.addEventListener("mouseenter", () => trigger.setAttribute("aria-expanded", "true"));
        container.addEventListener("mouseleave", () => trigger.setAttribute("aria-expanded", "false"));
        container.addEventListener("focusin", () => trigger.setAttribute("aria-expanded", "true"));
        container.addEventListener("focusout", (event) => {
          if (!container.contains(event.relatedTarget)) trigger.setAttribute("aria-expanded", "false");
        });
      }
      if (home) {
        let collapseAt = 0;
        let framePending = false;
        const updateHomeHeader = () => {
          document.body.classList.toggle("is-past-hero", window.scrollY > collapseAt);
          framePending = false;
        };
        const measureHomeHeader = () => {
          const headerHeight = this.getBoundingClientRect().height;
          if (window.matchMedia("(max-width: 760px)").matches) {
            // Две строки надписи должны уместиться в хэдере уже в начале прокрутки.
            collapseAt = parseFloat(getComputedStyle(this).getPropertyValue("--home-brand-collapse-distance"));
          } else {
            const title = document.querySelector(".hero__title");
            collapseAt = title ? Math.max(0, title.getBoundingClientRect().top + window.scrollY - headerHeight) : 0;
          }
          updateHomeHeader();
        };
        window.addEventListener("scroll", () => {
          if (framePending) return;
          framePending = true;
          window.requestAnimationFrame(updateHomeHeader);
        }, { passive: true });
        window.addEventListener("resize", measureHomeHeader);
        document.fonts.ready.then(measureHomeHeader);
        measureHomeHeader();
      }
      const menuButton = this.querySelector('[data-open="menu"]');
      menuButton.addEventListener("click", () => {
        this.dispatchEvent(new CustomEvent("open-mobile-menu", {
          bubbles: true,
          detail: { trigger: menuButton },
        }));
      });
      customElements.whenDefined("app-mobile-menu").then(() => {
        if (document.querySelector("app-mobile-menu")) menuButton.disabled = false;
      });
      const authButton = this.querySelector('[data-open="auth"]');
      authButton.disabled = true;
      authButton.setAttribute("aria-controls", "auth-dialog");
      authButton.addEventListener("click", () => {
        this.dispatchEvent(new CustomEvent("open-auth", { bubbles: true, detail: { trigger: authButton } }));
      });
      customElements.whenDefined("app-auth-modal").then(() => {
        if (document.querySelector("app-auth-modal")) authButton.disabled = false;
      });
      const cartButton = this.querySelector('[data-open="cart"]');
      cartButton.disabled = true;
      cartButton.setAttribute("aria-controls", "cart-dialog");
      cartButton.setAttribute("aria-expanded", "false");
      cartButton.addEventListener("click", () => {
        this.dispatchEvent(new CustomEvent("open-cart", { bubbles: true, detail: { trigger: cartButton } }));
      });
      customElements.whenDefined("app-cart-modal").then(() => {
        if (document.querySelector("app-cart-modal")) cartButton.disabled = false;
      });
      document.addEventListener("cart-changed", (event) => {
        const quantity = event.detail.quantity;
        this.querySelector("[data-cart-count]").textContent = quantity || "";
        cartButton.setAttribute("aria-label", quantity ? `Открыть корзину. Количество товаров: ${quantity}` : "Открыть корзину");
      });
      document.addEventListener("auth-changed", (event) => {
        const user = event.detail.user;
        this.querySelector("[data-manager-link]").hidden = user?.role !== "manager";
        this.querySelector("[data-account-label]").textContent = user ? `${user.firstName[0]}${user.surname[0]}`.toUpperCase() : "";
        this.querySelector(".site-header__member-button").title = user?.nickname || "Личный кабинет";
        this.querySelector(".site-header__member-button").toggleAttribute("data-user-title", Boolean(user));
        const history = this.querySelector('[data-open="history"]');
        history.hidden = user?.role !== "customer";
        history.disabled = !document.querySelector("app-history-modal") || !customElements.get("app-history-modal");
      });
      const historyButton = this.querySelector('[data-open="history"]');
      historyButton.setAttribute("aria-controls", "history-dialog");
      historyButton.setAttribute("aria-expanded", "false");
      historyButton.addEventListener("click", () => this.dispatchEvent(new CustomEvent("open-history", { bubbles: true, detail: { trigger: historyButton } })));
      customElements.whenDefined("app-history-modal").then(() => { if (document.querySelector("app-history-modal")) historyButton.disabled = false; });
      this.querySelector('[data-profile-action="logout"]').addEventListener("click", () => {
        this.dispatchEvent(new CustomEvent("auth-logout", { bubbles: true }));
        authButton.focus();
      });
      const settingsButton = this.querySelector('[data-profile-action="settings"]');
      settingsButton.addEventListener("click", () => this.dispatchEvent(new CustomEvent("open-settings", { bubbles: true, detail: { trigger: settingsButton } })));
      const searchButton = this.querySelector("[data-search-open]");
      const searchForm = this.querySelector(".site-search");
      const searchInput = searchForm.elements.q;
      searchButton.setAttribute("aria-expanded", "false");
      const closeSearch = () => {
        document.body.classList.remove("is-searching");
        searchButton.setAttribute("aria-expanded", "false");
        searchButton.focus();
      };
      searchButton.addEventListener("click", () => {
        document.body.classList.add("is-searching");
        searchButton.setAttribute("aria-expanded", "true");
        searchInput.focus();
      });
      this.querySelector("[data-search-close]").addEventListener("click", closeSearch);
      searchForm.addEventListener("keydown", (event) => { if (event.key === "Escape") closeSearch(); });
      searchForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const query = searchInput.value.trim();
        if (query) location.href = `${root}pages/catalog.html?q=${encodeURIComponent(query)}`;
      });
      historyButton.disabled = !document.querySelector("app-history-modal") || !customElements.get("app-history-modal");
    }
  }
  customElements.define("app-header", AppHeader);
})();
