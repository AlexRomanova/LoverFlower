// <app-footer>: разметка и поведение компонента.
(() => {
  const root = new URL("../../", document.currentScript.src).href;
  const asset = (path) => new URL(path, root).href;
  const home = document.body.classList.contains("home-page");
  class AppFooter extends HTMLElement {
    connectedCallback() {
      if (this.initialized) return;
      this.initialized = true;
      this.render();
      this.bindEvents();
    }

    render() {
      this.innerHTML = `
    <footer class="footer" id="contacts">
      <div class="container footer__grid">
        <div class="footer__legal">
          <a class="logo" href="${root}index.html" aria-label="Lover Flower — главная">
            <span>L</span>
            <span>F</span>
          </a>
          <h3>Реквизиты</h3>
          <p>
            ООО «Ловефлове» 220035, Республика Беларусь, г. Минск, ул. Тимирязева д. 67, комн. 112 (пом.11) УНП
            193263781, р/с BY55MTBK30120001093300096372 ЗАО «МТБанк», БИК MTBKBY22 220007, г. Минск, улица Толстого
          </p>
        </div>
        <div>
          <h3>Каталог</h3>
          <ul>
            <li><a href="${root}pages/catalog.html?category=bouquets">Букеты</a></li>
            <li><a href="${root}pages/catalog.html?category=bouquets&bouquetType=mixed">Сборные букеты</a></li>
            <li><a href="${root}pages/catalog.html?category=bouquets&bouquetType=mono">Монобукеты</a></li>
            <li><a href="${root}pages/catalog.html?category=bouquets&flowers=rose">Букеты роз</a></li>
            <li><a href="${root}pages/catalog.html?category=bouquets&format=box">В коробке</a></li>
            <li><a href="${root}pages/catalog.html?category=bouquets&format=vase">В вазе</a></li>
            <li><a href="${root}pages/catalog.html?category=balloons">Шары</a></li>
            <li><a href="${root}pages/catalog.html?category=toys">Игрушки</a></li>
            <li><a href="${root}pages/catalog.html?category=cards">Открытки</a></li>
            <li><a href="${root}pages/catalog.html?category=packaging">Упаковка</a></li>
          </ul>
        </div>
        <div>
          <h3>Для кого</h3>
          <ul>
            <li><a href="${root}pages/catalog.html?category=bouquets&recipients=girlfriend">Для девушки</a></li>
            <li><a href="${root}pages/catalog.html?category=bouquets&recipients=man">Для мужчины</a></li>
            <li><a href="${root}pages/catalog.html?category=bouquets&recipients=wife">Для жены</a></li>
            <li><a href="${root}pages/catalog.html?category=bouquets&recipients=mom">Для мамы</a></li>
            <li><a href="${root}pages/catalog.html?category=bouquets&recipients=colleague">Для коллеги</a></li>
            <li><a href="${root}pages/catalog.html?category=bouquets&recipients=boss">Для начальника</a></li>
            <li><a href="${root}pages/catalog.html?category=bouquets&recipients=daughter">Для дочки</a></li>
            <li><a href="${root}pages/catalog.html?category=bouquets&recipients=children">Для детей</a></li>
            <li><a href="${root}pages/catalog.html?category=bouquets&recipients=woman">Для женщины</a></li>
          </ul>
        </div>
        <nav class="footer__nav" aria-label="Навигация в подвале">
          <a class="footer__catalog-link" href="${root}pages/catalog.html">Каталог</a>
          <a href="${root}pages/delivery.html">Доставка и оплата</a>
          <a href="${root}pages/about.html">О нас</a>
          <a href="${root}pages/contacts.html">Контакты</a>
          <a href="${root}pages/faq.html">FAQ</a>
          <a href="${root}pages/corporate.html">Для корпоративных клиентов</a>
        </nav>
        <address class="footer__contacts">
          <a href="mailto:zakaz@loverflower.by">zakaz@loverflower.by</a>
          <small>Доставка 24/7 по договоренности с оператором</small>
          <a href="${root}pages/contacts.html#contacts-map-title">ул. Тимирязева 67</a>
          <small>
            10:00 до 21:00
            <br />
            без выходных
          </small>
          <a href="tel:+375291136969">+375 (29) 113-69-69</a>
          <small>прием звонков круглосуточно</small>
          <div class="socials">
            <span title="Instagram"><img src="${asset(
              "media/icons/icon_instagram.svg"
            )}" class="" alt="Instagram" /></span>
            <span title="WhatsApp"><img src="${asset(
              "media/icons/icon_whatsapp.svg"
            )}" class="" alt="WhatsApp" /></span>
            <span title="Viber"><img src="${asset("media/icons/icon_viber.svg")}" class="" alt="Viber" /></span>
          </div>
        </address>
      </div>
    </footer>
`;
    }

    bindEvents() {
      const footerHost = this;
      footerHost.querySelectorAll('a[href^="#"]').forEach((link) => {
        if (!home) link.href = `${root}index.html${link.getAttribute("href")}`;
      });
    }
  }
  customElements.define("app-footer", AppFooter);
})();
