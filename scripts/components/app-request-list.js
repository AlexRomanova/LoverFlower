import { notify } from "./app-notifications.js";
import { api } from "../features/api.js";
import { createAccountStore } from "../features/account-store.js";
import { importCallbackRequests } from "../features/requests.js";

const types = { callback: "Обратный звонок", corporate: "Корпоративная заявка", question: "Вопрос", order: "Заказ" };
const states = { new: "Новая", processing: "В работе", completed: "Завершена" };
const labels = { name: "Имя", phone: "Телефон", companyName: "Организация", postalAddress: "Адрес", contactName: "Контактное лицо", contactPhone: "Контактный телефон", bouquetPrice: "Стоимость букета", contactEmail: "Email", unp: "УНП", account: "Расчётный счёт", bankCode: "Код банка", monthlyOrders: "Заявок в месяц", comment: "Комментарий", address: "Адрес доставки", totalMinor: "Сумма в копейках" };

class AppRequestList extends HTMLElement {
  connectedCallback() {
    this.controller = new AbortController();
    this.accounts = createAccountStore(localStorage, sessionStorage);
    this.innerHTML = `<p data-requests-status role="status"></p><div class="manager-requests" data-requests></div>`;
    document.addEventListener("auth-changed", () => this.refresh(), { signal: this.controller.signal });
    this.addEventListener("change", (event) => this.updateStatus(event.target), { signal: this.controller.signal });
    this.accounts.restore().then(() => this.refresh()).catch((error) => this.status(error.message));
  }
  disconnectedCallback() { this.controller.abort(); }
  status(message) { this.querySelector("[data-requests-status]").textContent = message; }
  async refresh() {
    const revision = this.revision = (this.revision || 0) + 1;
    const container = this.querySelector("[data-requests]"); container.replaceChildren();
    if (this.accounts.currentUser()?.role !== "manager") { this.status("Заявки доступны менеджеру после входа."); return; }
    this.status("Загружаем заявки…");
    try {
      await importCallbackRequests(localStorage);
      const requests = await api("requests");
      if (revision !== this.revision || !this.isConnected) return;
      const entries = requests.map((item) => ({ ...item, collection: "requests" })).sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
      this.status(entries.length ? `Заявок: ${entries.length}.` : "Заявок пока нет.");
      for (const entry of entries) {
        const card = document.createElement("article"); card.className = "manager-request";
        const heading = document.createElement("h3"); heading.textContent = types[entry.type] || "Заявка"; card.append(heading);
        const time = document.createElement("time"); time.dateTime = entry.createdAt;
        time.textContent = new Date(entry.createdAt).toLocaleString("ru-RU"); card.append(time);
        const list = document.createElement("dl");
        for (const [key, value] of Object.entries(entry.fields || {})) {
          if (!value || (key === "contactPhone" && entry.fields.phone === value)) continue;
          const label = document.createElement("dt"); label.textContent = labels[key] || key;
          const text = document.createElement("dd"); text.setAttribute("translate", "no"); text.textContent = String(value); list.append(label, text);
        }
        card.append(list);
        const label = document.createElement("label"); label.textContent = "Статус ";
        const select = document.createElement("select"); select.dataset.id = entry.id; select.dataset.collection = entry.collection;
        for (const [value, title] of Object.entries(states)) { const option = document.createElement("option"); option.value = value; option.textContent = title; select.append(option); }
        select.value = entry.status in states ? entry.status : "new";
        select.dataset.previous = select.value; label.append(select); card.append(label);
        const status = document.createElement("p"); status.setAttribute("role", "status"); card.append(status);
        container.append(card);
      }
    } catch (error) { this.status(error.message); }
  }
  async updateStatus(select) {
    if (!select.matches("select[data-id]") || this.accounts.currentUser()?.role !== "manager") return;
    const status = select.closest("article").querySelector("[role=status]");
    select.disabled = true;
    try {
      await api(`${select.dataset.collection}/${encodeURIComponent(select.dataset.id)}`, { method: "PATCH", body: { status: select.value } });
      select.dataset.previous = select.value; status.textContent = "Статус сохранён."; notify(status.textContent);
    } catch (error) { select.value = select.dataset.previous; status.textContent = error.message; notify(error.message, "error"); }
    finally { select.disabled = false; }
  }
}
customElements.define("app-request-list", AppRequestList);
