import { generateNickname, generatePassword, isEmail, normalizePhone, NICKNAME_ATTEMPTS, registrationErrors } from "../features/registration-rules.js";
import { createAccountStore } from "../features/account-store.js";

// <app-auth-modal>: окно входа и регистрации. Правила и хранение — в features/.
class AppAuthModal extends HTMLElement {
  connectedCallback() {
    if (!this.initialized) {
      this.render();
      this.dialog = this.querySelector("#auth-dialog");
      this.registrationForm = this.querySelector("[data-registration-form]");
      this.loginForm = this.querySelector("[data-login-form]");
      this.initialized = true;
      this.resetRegistration();
    }
    this.controller = new AbortController();
    try { this.store = createAccountStore(localStorage, sessionStorage); }
    catch { this.store = null; }
    this.bindEvents();
    this.publishUser(this.store?.currentUser() || null);
    this.store?.restore().then((user) => { if (this.isConnected) this.publishUser(user); }).catch((error) => this.showStatus(this.loginForm, error.message));
    this.updateButtons();
  }

  disconnectedCallback() {
    this.operation?.abort();
    this.close();
    this.controller.abort();
  }

  render() {
    const field = (name, label, attributes, hint = "") => `
      <div class="auth-field">
        <label for="register-${name}">${label}</label>
        <input id="register-${name}" name="${name}" ${attributes}
          aria-describedby="register-${name}-error${hint ? ` register-${name}-hint` : ""}" />
        ${hint ? `<small class="auth-hint" id="register-${name}-hint">${hint}</small>` : ""}
        <p class="auth-error" id="register-${name}-error" data-error-for="${name}" aria-live="polite"></p>
      </div>`;
    this.innerHTML = `
      <div class="site-overlays">
        <dialog class="site-dialog auth-dialog" id="auth-dialog" aria-labelledby="auth-title">
          <button type="button" class="site-dialog__close" aria-label="Закрыть окно входа и регистрации">×</button>
          <h2 id="auth-title">Личный кабинет</h2>
          <span class="site-dialog__line" aria-hidden="true"></span>
          <p class="auth-demo">Учебная версия: локально данные сохраняются в JSON Server, на GitHub Pages — в этом браузере.</p>
          <div class="auth-tabs" role="tablist" aria-label="Вход или регистрация">
            <button type="button" role="tab" id="login-tab" data-auth-tab="login" aria-controls="login-panel" aria-selected="true">Войти</button>
            <button type="button" role="tab" id="register-tab" data-auth-tab="register" aria-controls="register-panel" aria-selected="false" tabindex="-1">Регистрация</button>
          </div>
          <section id="login-panel" role="tabpanel" aria-labelledby="login-tab">
            <form class="auth-form" data-login-form novalidate>
              <div class="auth-field">
                <label for="login-identifier">Email или телефон РБ <span class="auth-required">*</span></label>
                <input id="login-identifier" name="identifier" autocomplete="username" required aria-describedby="login-identifier-error" />
                <p class="auth-error" id="login-identifier-error" aria-live="polite"></p>
              </div>
              <div class="auth-field">
                <label for="login-password">Пароль <span class="auth-required">*</span></label>
                <input id="login-password" name="password" type="password" autocomplete="current-password" required aria-describedby="login-password-error" />
                <p class="auth-error" id="login-password-error" aria-live="polite"></p>
              </div>
              <p class="auth-status" data-login-status role="status"></p>
              <button class="btn" type="submit" disabled>Войти</button>
            </form>
          </section>
          <section id="register-panel" role="tabpanel" aria-labelledby="register-tab" hidden>
            <p class="auth-hint">Поля со знаком <span class="auth-required">*</span> обязательны.</p>
            <form class="auth-form" data-registration-form novalidate>
              <div class="auth-grid">
                ${field("surname", 'Фамилия <span class="auth-required">*</span>', 'autocomplete="family-name" maxlength="60" required')}
                ${field("firstName", 'Имя <span class="auth-required">*</span>', 'autocomplete="given-name" maxlength="60" required')}
                ${field("patronymic", "Отчество", 'autocomplete="additional-name" maxlength="60"')}
                ${field("birthDate", 'Дата рождения <span class="auth-required">*</span>', 'type="date" autocomplete="bday" required', "Регистрация доступна с 16 лет.")}
                ${field("phone", 'Телефон РБ <span class="auth-required">*</span>', 'type="tel" autocomplete="tel" placeholder="+375 (29) 123-45-67" maxlength="30" required')}
                ${field("email", 'Email <span class="auth-required">*</span>', 'type="email" autocomplete="email" maxlength="254" placeholder="name@example.com" required')}
              </div>
              <div class="auth-field">
                <label for="register-nickname">Никнейм <span class="auth-required">*</span></label>
                <div class="auth-inline">
                  <input id="register-nickname" name="nickname" maxlength="24" autocomplete="off" readonly required aria-describedby="nickname-hint register-nickname-error" />
                  <button class="auth-link" type="button" data-generate-nickname>Другой вариант</button>
                </div>
                <small class="auth-hint" id="nickname-hint" data-nickname-hint></small>
                <p class="auth-error" id="register-nickname-error" data-error-for="nickname" aria-live="polite"></p>
              </div>
              <fieldset class="auth-password-mode">
                <legend>Как задать пароль <span class="auth-required">*</span></legend>
                <label><input type="radio" name="passwordMode" value="manual" checked /> Самостоятельно</label>
                <label><input type="radio" name="passwordMode" value="automatic" /> Автоматически</label>
              </fieldset>
              <div class="auth-grid" data-manual-password>
                ${field("password", 'Пароль <span class="auth-required">*</span>', 'type="password" autocomplete="new-password" required', "8–20 символов: заглавная и строчная буквы, цифра и спецсимвол. Пароли из TOP-100 за 2023 год запрещены.")}
                ${field("confirmPassword", 'Повторите пароль <span class="auth-required">*</span>', 'type="password" autocomplete="off" required', "Введите повторно вручную. Вставка и перетаскивание запрещены.")}
              </div>
              <div class="auth-field" data-automatic-password hidden>
                <label for="generated-password">Сгенерированный пароль <span class="auth-required">*</span></label>
                <div class="auth-inline">
                  <input id="generated-password" name="generatedPassword" readonly disabled aria-describedby="generated-password-hint generated-password-error" />
                  <button type="button" class="auth-link" data-generate-password>Другой пароль</button>
                </div>
                <small class="auth-hint" id="generated-password-hint">Сохраните пароль: он понадобится для следующего входа.</small>
                <p class="auth-error" id="generated-password-error" data-error-for="password" aria-live="polite"></p>
              </div>
              <div class="auth-agreement">
                <button type="button" class="auth-link" data-read-agreement aria-expanded="false" aria-controls="user-agreement">Прочитать соглашение пользователя <span class="auth-required">*</span></button>
                <div class="auth-agreement__text" id="user-agreement" tabindex="0" role="region" aria-label="Текст соглашения пользователя" hidden>
                  <h3>Соглашение пользователя</h3>
                  <p><strong>Учебный текст для курсового проекта.</strong> Он не является утверждённым соглашением действующего магазина.</p>
                  <h4>1. Назначение сайта</h4>
                  <p>Lover Flower демонстрирует каталог цветов и интерфейс личного кабинета. Регистрация создаёт учебный аккаунт и не отправляет данные в настоящий магазин.</p>
                  <h4>2. Условия регистрации</h4>
                  <p>Пользователю должно исполниться 16 лет. Для регистрации указываются фамилия, имя, дата рождения, email и номер телефона Республики Беларусь. Отчество заполняется по желанию.</p>
                  <h4>3. Пароль и доступ</h4>
                  <p>Пароль задаётся самостоятельно или генерируется автоматически. Пользователь сохраняет его и не передаёт другим лицам. Восстановление доступа по SMS или email в учебной версии не реализовано.</p>
                  <h4>4. Хранение данных</h4>
                  <p>При локальном запуске аккаунты, корзины и заявки сохраняются в JSON Server. На GitHub Pages они сохраняются только в этом браузере. Очистка данных браузера удаляет изменения демонстрационной версии, но не меняет локальную базу JSON Server.</p>
                  <h4>5. Использование кабинета</h4>
                  <p>Покупатель работает со своей корзиной. Менеджер управляет ценами и наличием товаров. Оформление заказа подключается отдельным этапом. Этот интерфейс не подтверждает оплату или реальный заказ.</p>
                  <h4>6. Подтверждение</h4>
                  <p>Прочитав текст до конца, пользователь может отметить согласие с условиями учебной версии. Для запуска настоящего магазина текст необходимо заменить утверждённым соглашением.</p>
                  <p class="auth-agreement__end">Конец соглашения</p>
                </div>
                <small class="auth-hint" data-agreement-hint>Откройте текст и прокрутите до конца, чтобы подтвердить согласие.</small>
                <label class="auth-consent"><input name="agreementAccepted" type="checkbox" required disabled aria-describedby="agreement-error" /> Я прочитал(а) и принимаю соглашение <span class="auth-required">*</span></label>
                <p class="auth-error" id="agreement-error" data-error-for="agreement" aria-live="polite"></p>
              </div>
              <p class="auth-status" data-register-status role="status"></p>
              <button type="submit" class="btn" disabled>Зарегистрироваться</button>
            </form>
          </section>
          <section class="auth-success" data-auth-success hidden role="status">
            <h3 data-success-title></h3>
            <p data-success-message></p>
            <div data-success-password hidden>
              <label for="success-password">Сохраните сгенерированный пароль</label>
              <input id="success-password" readonly />
            </div>
            <button type="button" class="btn" data-auth-continue>Продолжить</button>
          </section>
        </dialog>
      </div>`;
  }

  bindEvents() {
    const options = { signal: this.controller.signal };
    document.addEventListener("open-auth", (event) => this.open(event.detail?.trigger, event.detail?.tab), options);
    document.addEventListener("auth-logout", async () => {
      try { await this.store?.logout(); this.publishUser(null); }
      catch { this.showStatus(this.loginForm, "Не удалось выйти из аккаунта. Проверьте доступ к хранилищу браузера."); }
    }, options);
    this.querySelector(".site-dialog__close").addEventListener("click", () => this.close(), options);
    this.querySelector("[data-auth-continue]").addEventListener("click", () => this.close(), options);
    this.dialog.addEventListener("cancel", (event) => { event.preventDefault(); this.close(); }, options);
    this.dialog.addEventListener("close", () => this.restorePage(), options);
    this.dialog.addEventListener("click", (event) => {
      if (event.target !== this.dialog) return;
      const bounds = this.dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) this.close();
    }, options);
    this.querySelectorAll("[data-auth-tab]").forEach((button) => {
      button.addEventListener("click", () => this.selectTab(button.dataset.authTab), options);
      button.addEventListener("keydown", (event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key) || this.busy) return;
        event.preventDefault();
        const tab = event.key === "Home" ? "login" : event.key === "End" ? "register" : button.dataset.authTab === "login" ? "register" : "login";
        this.selectTab(tab);
        this.querySelector(`[data-auth-tab="${tab}"]`).focus();
      }, options);
    });
    this.registrationForm.addEventListener("input", (event) => {
      this.clearFieldError(event.target.name === "agreementAccepted" ? "agreement" : event.target.name);
      if (event.target.name === "password") this.clearFieldError("confirmPassword");
      this.showStatus(this.registrationForm, "");
      this.updateButtons();
    }, options);
    this.registrationForm.addEventListener("focusout", (event) => {
      const name = event.target.name;
      if (!name || ["passwordMode", "generatedPassword"].includes(name)) return;
      const field = name === "agreementAccepted" ? "agreement" : name;
      this.showFieldError(field, registrationErrors(this.registrationData())[field] || "");
    }, options);
    this.registrationForm.addEventListener("change", (event) => {
      if (event.target.name === "passwordMode") this.setPasswordMode();
      this.updateButtons();
    }, options);
    this.querySelector("[data-generate-nickname]").addEventListener("click", () => this.regenerateNickname(), options);
    this.querySelector("[data-generate-password]").addEventListener("click", () => {
      this.registrationForm.elements.generatedPassword.value = generatePassword();
      this.clearFieldError("password");
      this.updateButtons();
    }, options);
    const confirmation = this.registrationForm.elements.confirmPassword;
    for (const type of ["paste", "drop", "beforeinput"]) {
      confirmation.addEventListener(type, (event) => {
        if (type === "beforeinput" && !["insertFromPaste", "insertFromDrop"].includes(event.inputType)) return;
        event.preventDefault();
        this.showFieldError("confirmPassword", "Повторите пароль вручную: вставка запрещена.");
      }, options);
    }
    this.querySelector("[data-read-agreement]").addEventListener("click", () => {
      const text = this.querySelector("#user-agreement");
      text.hidden = !text.hidden;
      this.querySelector("[data-read-agreement]").setAttribute("aria-expanded", String(!text.hidden));
      if (!text.hidden) {
        text.focus();
        requestAnimationFrame(() => this.checkAgreementRead());
      }
    }, options);
    this.querySelector("#user-agreement").addEventListener("scroll", () => this.checkAgreementRead(), { ...options, passive: true });
    this.loginForm.addEventListener("input", (event) => {
      this.querySelector(`#login-${event.target.name}-error`).textContent = "";
      event.target.removeAttribute("aria-invalid");
      this.showStatus(this.loginForm, "");
      this.updateButtons();
    }, options);
    this.loginForm.addEventListener("focusout", (event) => {
      if (!event.target.name) return;
      const message = event.target.name === "identifier"
        ? this.validIdentifier() ? "" : "Введите email или номер телефона РБ."
        : event.target.value ? "" : "Введите пароль.";
      this.querySelector(`#login-${event.target.name}-error`).textContent = message;
      event.target.setAttribute("aria-invalid", String(Boolean(message)));
    }, options);
    this.registrationForm.addEventListener("submit", (event) => { event.preventDefault(); this.submitRegistration(); }, options);
    this.loginForm.addEventListener("submit", (event) => { event.preventDefault(); this.submitLogin(); }, options);
  }

  registrationData() {
    const data = Object.fromEntries(new FormData(this.registrationForm));
    data.password = data.passwordMode === "automatic" ? data.generatedPassword : data.password;
    data.agreementRead = this.agreementRead;
    data.agreementAccepted = this.registrationForm.elements.agreementAccepted.checked;
    return data;
  }

  resetRegistration() {
    this.registrationForm.reset();
    this.nicknameAttempts = 0;
    this.agreementRead = false;
    this.registrationForm.elements.agreementAccepted.disabled = true;
    this.querySelector("#user-agreement").hidden = true;
    this.querySelector("[data-read-agreement]").setAttribute("aria-expanded", "false");
    this.querySelector("[data-agreement-hint]").textContent = "Откройте текст и прокрутите до конца, чтобы подтвердить согласие.";
    this.querySelector("[data-generate-nickname]").disabled = false;
    this.regenerateNickname();
    this.setPasswordMode();
    this.registrationForm.querySelectorAll("[data-error-for]").forEach((node) => { node.textContent = ""; });
    this.registrationForm.querySelectorAll("[aria-invalid]").forEach((node) => node.removeAttribute("aria-invalid"));
    this.showStatus(this.registrationForm, "");
  }

  regenerateNickname() {
    if (this.nicknameAttempts >= NICKNAME_ATTEMPTS) return;
    const input = this.registrationForm.elements.nickname;
    let nickname;
    do { nickname = generateNickname(); } while (nickname === input.value);
    input.value = nickname;
    this.nicknameAttempts++;
    input.readOnly = this.nicknameAttempts < NICKNAME_ATTEMPTS;
    this.querySelector("[data-generate-nickname]").disabled = !input.readOnly;
    this.querySelector("[data-nickname-hint]").textContent = input.readOnly
      ? `Вариант ${this.nicknameAttempts} из ${NICKNAME_ATTEMPTS}. После пяти вариантов можно ввести свой никнейм.`
      : "Пять вариантов использованы. Теперь можно ввести свой никнейм (3–24 символа).";
    this.clearFieldError("nickname");
    this.updateButtons();
  }

  setPasswordMode() {
    const automatic = this.registrationForm.elements.passwordMode.value === "automatic";
    this.querySelector("[data-manual-password]").hidden = automatic;
    this.querySelector("[data-automatic-password]").hidden = !automatic;
    for (const name of ["password", "confirmPassword"]) this.registrationForm.elements[name].disabled = automatic;
    this.registrationForm.elements.generatedPassword.disabled = !automatic;
    if (automatic && !this.registrationForm.elements.generatedPassword.value) this.registrationForm.elements.generatedPassword.value = generatePassword();
    this.clearFieldError("password");
    this.clearFieldError("confirmPassword");
    this.updateButtons();
  }

  checkAgreementRead() {
    const text = this.querySelector("#user-agreement");
    if (text.hidden || !this.dialog.open || text.scrollTop + text.clientHeight < text.scrollHeight - 2) return;
    this.agreementRead = true;
    this.registrationForm.elements.agreementAccepted.disabled = false;
    this.querySelector("[data-agreement-hint]").textContent = "Текст прочитан до конца. Теперь подтвердите согласие.";
    this.clearFieldError("agreement");
    this.updateButtons();
  }

  clearFieldError(field) { this.showFieldError(field, ""); }

  showFieldError(field, message) {
    this.registrationForm.querySelectorAll(`[data-error-for="${field}"]`).forEach((node) => { node.textContent = message; });
    const input = this.registrationForm.elements[field === "agreement" ? "agreementAccepted" : field];
    if (input?.setAttribute) input.setAttribute("aria-invalid", String(Boolean(message)));
    this.updateButtons();
  }

  showStatus(form, message) { form.querySelector(".auth-status").textContent = message; }

  validIdentifier() {
    const value = this.loginForm.elements.identifier.value;
    return isEmail(value) || Boolean(normalizePhone(value));
  }

  updateButtons() {
    this.loginForm.querySelector('[type="submit"]').disabled = Boolean(this.busy) || !this.validIdentifier() || !this.loginForm.elements.password.value;
    const fieldError = Array.from(this.registrationForm.querySelectorAll("[data-error-for]")).some((node) => node.textContent);
    this.registrationForm.querySelector('[type="submit"]').disabled = Boolean(this.busy) || fieldError || Object.keys(registrationErrors(this.registrationData())).length > 0;
  }

  selectTab(tab = "login") {
    if (this.busy) return;
    this.querySelector("[data-auth-success]").hidden = true;
    this.querySelector(".auth-tabs").hidden = false;
    this.querySelector("#login-panel").hidden = tab !== "login";
    this.querySelector("#register-panel").hidden = tab !== "register";
    this.dialog.classList.toggle("auth-dialog--register", tab === "register");
    this.querySelectorAll("[data-auth-tab]").forEach((button) => {
      const selected = button.dataset.authTab === tab;
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
  }

  async submitRegistration() {
    if (this.busy) return;
    const data = this.registrationData();
    const errors = registrationErrors(data);
    if (Object.keys(errors).length) {
      Object.entries(errors).forEach(([field, message]) => this.showFieldError(field, message));
      this.updateButtons();
      return;
    }
    await this.performAuth(this.registrationForm, (signal) => this.store.register(data, signal), data.passwordMode === "automatic" ? data.password : "");
  }

  async submitLogin() {
    if (this.busy || !this.validIdentifier() || !this.loginForm.elements.password.value) return;
    const { identifier, password } = this.loginForm.elements;
    await this.performAuth(this.loginForm, (signal) => this.store.login(identifier.value, password.value, signal));
  }

  async performAuth(form, operation, generatedPassword = "") {
    if (!this.store) { this.showStatus(form, "Разрешите сайту сохранять данные в браузере."); return; }
    this.operation = new AbortController();
    const pending = this.operation;
    this.busy = true;
    this.querySelectorAll("[data-auth-tab]").forEach((button) => { button.disabled = true; });
    this.updateButtons();
    this.showStatus(form, "Проверяем данные…");
    try {
      const user = await operation(pending.signal);
      pending.signal.throwIfAborted();
      this.publishUser(user);
      this.showSuccess(user, form === this.registrationForm, generatedPassword);
    } catch (error) {
      if (pending.signal.aborted) return;
      this.showStatus(form, "");
      if (error.field) this.showFieldError(error.field, error.message);
      else if (error.errors) Object.entries(error.errors).forEach(([field, message]) => this.showFieldError(field, message));
      else this.showStatus(form, error.name === "QuotaExceededError" || error.name === "SecurityError"
        ? "Не удалось сохранить аккаунт. Проверьте доступ и свободное место в хранилище браузера."
        : error.message);
    } finally {
      if (this.operation === pending) {
        this.busy = false;
        this.operation = null;
        this.querySelectorAll("[data-auth-tab]").forEach((button) => { button.disabled = false; });
        this.updateButtons();
      }
    }
  }

  publishUser(user) {
    document.body.dataset.auth = user ? "member" : "guest";
    this.dispatchEvent(new CustomEvent("auth-changed", { bubbles: true, detail: { user } }));
  }

  showSuccess(user, registered, generatedPassword) {
    this.querySelector(".auth-tabs").hidden = true;
    this.querySelector("#login-panel").hidden = true;
    this.querySelector("#register-panel").hidden = true;
    this.querySelector("[data-auth-success]").hidden = false;
    this.dialog.classList.remove("auth-dialog--register");
    this.querySelector("[data-success-title]").textContent = registered ? "Аккаунт создан" : "Вы вошли";
    this.querySelector("[data-success-message]").textContent = `Добро пожаловать, ${user.nickname}!`;
    this.querySelector("[data-success-password]").hidden = !generatedPassword;
    this.querySelector("#success-password").value = generatedPassword;
    this.querySelector("[data-auth-continue]").focus();
    this.completed = true;
    this.loginForm.elements.password.value = "";
    this.registrationForm.elements.password.value = "";
    this.registrationForm.elements.confirmPassword.value = "";
    this.registrationForm.elements.generatedPassword.value = "";
    this.showStatus(this.loginForm, "");
    this.showStatus(this.registrationForm, "");
  }

  open(trigger, tab = "login") {
    if (this.dialog.open) return;
    this.trigger = trigger;
    this.selectTab(tab);
    this.dialog.showModal();
    this.dialog.scrollTop = 0;
    document.body.classList.add("is-auth-open");
    this.querySelector(tab === "register" ? "#register-surname" : "#login-identifier").focus({ preventScroll: true });
  }

  close() {
    if (!this.dialog?.open) return;
    this.operation?.abort();
    this.operation = null;
    this.busy = false;
    this.querySelectorAll("[data-auth-tab]").forEach((button) => { button.disabled = false; });
    this.loginForm.elements.password.value = "";
    for (const name of ["password", "confirmPassword", "generatedPassword"]) this.registrationForm.elements[name].value = "";
    this.querySelector("#success-password").value = "";
    this.showStatus(this.loginForm, "");
    this.showStatus(this.registrationForm, "");
    for (const field of ["password", "confirmPassword"]) this.clearFieldError(field);
    if (this.completed) { this.resetRegistration(); this.completed = false; }
    this.setPasswordMode();
    this.dialog.close();
    this.restorePage();
  }

  restorePage() {
    if (this.dialog.open || !document.body.classList.contains("is-auth-open")) return;
    document.body.classList.remove("is-auth-open");
    const fallback = document.querySelector('[data-open="menu"]')?.getClientRects().length
      ? document.querySelector('[data-open="menu"]')
      : document.querySelector(document.body.dataset.auth === "member" ? ".site-header__member-button" : '[data-open="auth"]');
    const trigger = this.trigger?.isConnected && this.trigger.getClientRects().length ? this.trigger : fallback;
    trigger?.focus({ preventScroll: true });
    this.trigger = null;
    this.dispatchEvent(new CustomEvent("auth-closed", { bubbles: true }));
  }
}

customElements.define("app-auth-modal", AppAuthModal);
