import { notify } from "./app-notifications.js";
import { createAccountStore } from "../features/account-store.js";
import { listOrders, updateOrderStatus, ORDER_STATES, DELIVERY_LABELS, PAYMENT_LABELS, orderNumber } from "../features/orders.js";
import { formatMoney, productLabel } from "../features/products.js";

// <app-order-list>: история покупателя; mode="manager" добавляет обработку заказов.
class AppOrderList extends HTMLElement {
  connectedCallback() {
    this.controller = new AbortController();
    this.accounts = createAccountStore(localStorage, sessionStorage);
    this.manager = this.getAttribute("mode") === "manager";
    this.innerHTML = `<div class="orders-toolbar"><button class="btn btn--outline" type="button" data-orders-refresh>Обновить список</button><p data-orders-status role="status"></p></div><div class="order-list" data-orders></div>`;
    const options = { signal: this.controller.signal };
    document.addEventListener("auth-changed", () => this.refresh(), options);
    document.addEventListener("order-created", () => this.refresh(), options);
    this.querySelector("[data-orders-refresh]").addEventListener("click", () => this.refresh(), options);
    this.addEventListener("change", (event) => { if (event.target.matches("[data-order-state]")) this.changeStatus(event.target); }, options);
    this.accounts.restore().then(() => this.refresh()).catch((error) => this.status(error.message));
  }
  disconnectedCallback() { this.controller.abort(); }
  status(message) { this.querySelector("[data-orders-status]").textContent = message; }
  async refresh() {
    const revision = this.revision = (this.revision || 0) + 1;
    this.querySelector("[data-orders]").replaceChildren();
    const user = this.accounts.currentUser();
    if (user?.role !== (this.manager ? "manager" : "customer")) {
      this.status(this.manager ? "Заказы доступны после входа в аккаунт менеджера." : "История заказов доступна после входа в аккаунт покупателя.");
      return;
    }
    this.status("Загружаем заказы…");
    try {
      const orders = await listOrders(user, { manager: this.manager });
      if (revision !== this.revision || !this.isConnected || this.accounts.currentUser()?.id !== user.id) return;
      this.querySelector("[data-orders]").replaceChildren(...orders.map((order) => this.orderCard(order)));
      this.status(orders.length ? `Заказов: ${orders.length}.` : "Заказов пока нет.");
    } catch (error) { if (revision === this.revision) this.status(error.message); }
  }
  orderCard(order) {
    const card = document.createElement("article");
    card.className = "order-card"; card.dataset.orderId = order.id;
    card.innerHTML = `<div class="order-card__head"><h3></h3><span class="order-state"></span></div>
      <time></time><dl class="order-details"></dl><details><summary>Состав заказа</summary><ul class="order-lines"></ul></details>
      <p class="order-card__amount"></p><p class="order-card__comment" hidden></p><p class="order-card__status" role="status"></p>`;
    card.querySelector("h3").textContent = `Заказ № ${orderNumber(order)}`;
    card.querySelector(".order-state").textContent = ORDER_STATES[order.status] || order.status;
    card.querySelector("time").dateTime = order.createdAt;
    card.querySelector("time").textContent = new Date(order.createdAt).toLocaleString("ru-RU");
    const fields = {
      "Получение": `${DELIVERY_LABELS[order.delivery.method]}, ${order.delivery.date}, ${order.delivery.timeSlot}`,
      "Адрес": order.delivery.address,
      "Контакт": `${order.contact.name}, ${order.contact.phone}`,
      "Email": order.contact.email,
      "Оплата": PAYMENT_LABELS[order.paymentMethod],
    };
    for (const [title, value] of Object.entries(fields)) {
      const label = document.createElement("dt"); label.textContent = title;
      const text = document.createElement("dd"); text.textContent = value;
      if (["Адрес", "Контакт", "Email"].includes(title)) text.setAttribute("translate", "no");
      card.querySelector("dl").append(label, text);
    }
    for (const item of order.items) {
      const line = document.createElement("li");
      line.textContent = `${productLabel(item)} — ${item.quantity} × ${formatMoney(item.priceMinor)} = ${formatMoney(item.lineTotalMinor)}`;
      card.querySelector("ul").append(line);
    }
    card.querySelector(".order-card__amount").textContent = `Товары: ${formatMoney(order.subtotalMinor)}. Доставка: ${formatMoney(order.deliveryMinor)}. Итого: ${formatMoney(order.totalMinor)}.`;
    if (order.comment) {
      const comment = card.querySelector(".order-card__comment"); comment.hidden = false;
      const value = document.createElement("span"); value.setAttribute("translate", "no"); value.textContent = order.comment;
      comment.replaceChildren("Пожелания: ", value);
    }
    if (this.manager) {
      const label = document.createElement("label"); label.className = "order-card__control"; label.textContent = "Статус заказа ";
      const select = document.createElement("select"); select.dataset.orderState = "";
      for (const [value, title] of Object.entries(ORDER_STATES)) { const option = document.createElement("option"); option.value = value; option.textContent = title; select.append(option); }
      select.value = order.status; select.dataset.previous = order.status;
      select.setAttribute("aria-label", `Статус заказа № ${orderNumber(order)}`);
      label.append(select); card.append(label);
    }
    return card;
  }
  async changeStatus(select) {
    const card = select.closest("[data-order-id]");
    const revision = this.revision;
    const user = this.accounts.currentUser();
    select.disabled = true;
    try {
      const order = await updateOrderStatus(user, card.dataset.orderId, select.value);
      if (revision !== this.revision || this.accounts.currentUser()?.id !== user?.id) return;
      card.querySelector(".order-state").textContent = ORDER_STATES[order.status];
      select.dataset.previous = order.status;
      card.querySelector("[role=status]").textContent = "Статус сохранён."; notify("Статус сохранён.");
    } catch (error) {
      select.value = select.dataset.previous;
      card.querySelector("[role=status]").textContent = error.message; notify(error.message, "error");
    } finally { select.disabled = false; }
  }
}
customElements.define("app-order-list", AppOrderList);
