import { notify } from "../components/app-notifications.js";
import { api } from "../features/api.js";
import { createAccountStore } from "../features/account-store.js";
import { createCustomerCart } from "../features/customer-cart.js";
import { loadProducts, productLabel, formatMoney } from "../features/products.js";
import { checkoutErrors, createOrder, completeOrderCart, deliveryFee, todayISO, TIME_SLOTS, orderNumber } from "../features/orders.js";

const accounts = createAccountStore(localStorage, sessionStorage);
const cart = createCustomerCart(localStorage, accounts);
const form = document.querySelector("[data-checkout-form]");
const status = document.querySelector("[data-checkout-status]");
const layout = document.querySelector("[data-checkout-layout]");
const gate = document.querySelector("[data-checkout-gate]");
const success = document.querySelector("[data-checkout-success]");
let ownerId, quote, receipt, busy = false, revision = 0;
const pendingKey = (user) => `loverflower.checkout.pending.v1.${user.id}`;
const fields = () => Object.fromEntries(new FormData(form));
for (const slot of TIME_SLOTS) { const option = document.createElement("option"); option.value = slot; option.textContent = slot; form.elements.timeSlot.append(option); }

function setBusy(value) {
  busy = value;
  form.querySelectorAll("[data-checkout-fields]").forEach((fieldset) => { fieldset.disabled = value; });
  document.querySelector("[data-checkout-cart]").disabled = value;
  validate();
}
function validate() {
  if (busy) { form.querySelector("[data-place-order]").disabled = true; return; }
  const pickup = form.elements.deliveryMethod.value === "pickup";
  document.querySelector("[data-address-field]").hidden = pickup;
  document.querySelector("[data-pickup-address]").hidden = !pickup;
  form.elements.address.disabled = pickup;
  form.elements.address.required = !pickup;
  form.querySelector("[data-place-order]").disabled = !quote?.items.length || quote.items.some((item) => item.quantity > item.stock || item.stock < 1) || accounts.currentUser()?.role !== "customer" || Object.keys(checkoutErrors(fields())).length > 0;
  const shipping = deliveryFee(quote?.totalMinor || 0, form.elements.deliveryMethod.value);
  document.querySelector("[data-subtotal]").textContent = formatMoney(quote?.totalMinor || 0);
  document.querySelector("[data-delivery-fee]").textContent = formatMoney(shipping);
  document.querySelector("[data-order-total]").textContent = formatMoney((quote?.totalMinor || 0) + shipping);
}
function fieldError(name, message = "") {
  const node = form.querySelector(`[data-error="${name}"]`);
  if (!node) return;
  node.textContent = message;
  if (message) form.elements[name].setAttribute("aria-invalid", "true");
  else form.elements[name].removeAttribute("aria-invalid");
}
function resetForUser(user) {
  form.reset();
  form.querySelectorAll("[data-error]").forEach((node) => fieldError(node.dataset.error));
  form.elements.name.value = `${user.firstName} ${user.surname}`;
  form.elements.phone.value = user.phone;
  form.elements.email.value = user.email;
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  form.elements.deliveryDate.min = todayISO();
  form.elements.deliveryDate.value = todayISO(tomorrow);
}
async function finish(order) {
  if (accounts.currentUser()?.id !== order.userId) return;
  receipt = order; quote = null;
  history.replaceState(null, "", `${location.pathname}?order=${encodeURIComponent(order.id)}`);
  layout.hidden = true; gate.hidden = true; success.hidden = false;
  status.textContent = "";
  document.querySelector("[data-order-confirmation]").textContent = `Заказ № ${orderNumber(order)}. Сумма: ${formatMoney(order.totalMinor)}. Получение: ${order.delivery.date}, ${order.delivery.timeSlot}.`;
  document.querySelector("[data-cleanup-status]").textContent = "";
  document.querySelector("[data-order-cleanup]").hidden = true;
  try {
    await completeOrderCart(accounts.currentUser(), order.id);
    sessionStorage.removeItem(pendingKey({ id: order.userId }));
    document.dispatchEvent(new Event("cart-updated"));
  } catch {
    if (accounts.currentUser()?.id !== order.userId) return;
    document.querySelector("[data-cleanup-status]").textContent = "Заказ уже сохранён. Не удалось обновить корзину — завершите обновление, чтобы убрать заказанные товары.";
    document.querySelector("[data-order-cleanup]").hidden = false;
  }
  document.dispatchEvent(new CustomEvent("order-created", { detail: { id: order.id } }));
}
async function refresh() {
  const current = ++revision;
  const user = accounts.currentUser();
  layout.hidden = true; gate.hidden = true;
  if (receipt?.userId !== user?.id) { receipt = null; success.hidden = true; }
  if (!user || user.role !== "customer") {
    quote = null; ownerId = null; success.hidden = true; gate.hidden = false;
    document.querySelector("[data-checkout-login]").hidden = Boolean(user);
    document.querySelector("[data-checkout-retry]").hidden = true;
    status.textContent = user ? "Заказы оформляются из аккаунта покупателя. Для менеджера доступен его кабинет." : "Войдите или зарегистрируйтесь, чтобы оформить заказ и сохранить его в истории.";
    validate(); return;
  }
  if (ownerId !== user.id) { resetForUser(user); ownerId = user.id; }
  status.textContent = "Обновляем корзину…";
  try {
    const pending = sessionStorage.getItem(pendingKey(user));
    const requestedOrder = new URLSearchParams(location.search).get("order");
    if (pending || requestedOrder) {
      const order = (await api("orders")).find((entry) => entry.id === (pending || requestedOrder) && entry.userId === user.id);
      if (current !== revision) return;
      if (order) { await finish(order); return; }
      if (requestedOrder) history.replaceState(null, "", location.pathname);
    }
    if (receipt) { status.textContent = ""; return; }
    await loadProducts({ force: true });
    const snapshot = await cart.snapshot();
    if (current !== revision || accounts.currentUser()?.id !== user.id) return;
    quote = snapshot;
    status.textContent = !snapshot.items.length ? "В корзине нет товаров. Выберите товары в каталоге." : snapshot.items.some((item) => item.quantity > item.stock || item.stock < 1) ? "Количество некоторых товаров превышает остаток. Измените корзину перед оформлением." : "";
    layout.hidden = !snapshot.items.length; gate.hidden = Boolean(snapshot.items.length);
    document.querySelector("[data-checkout-login]").hidden = true;
    document.querySelector("[data-checkout-retry]").hidden = false;
    const list = document.querySelector("[data-checkout-items]"); list.replaceChildren();
    for (const item of snapshot.items) {
      const line = document.createElement("li");
      line.innerHTML = `<img loading="lazy" width="65" height="85" alt="" /><div><strong></strong><p></p></div>`;
      line.querySelector("img").src = item.image; line.querySelector("img").alt = productLabel(item);
      line.querySelector("strong").textContent = productLabel(item);
      line.querySelector("p").textContent = `${item.quantity} × ${formatMoney(item.priceMinor)} = ${formatMoney(item.lineTotalMinor)}`;
      list.append(line);
    }
    validate();
  } catch (error) {
    if (current !== revision) return;
    quote = null; status.textContent = error.message;
    gate.hidden = false; document.querySelector("[data-checkout-login]").hidden = true;
    document.querySelector("[data-checkout-retry]").hidden = false;
  }
}
form.addEventListener("input", (event) => { fieldError(event.target.name); if (event.target.name === "deliveryMethod") fieldError("address"); validate(); });
form.addEventListener("focusout", (event) => { const error = checkoutErrors(fields())[event.target.name]; fieldError(event.target.name, error); });
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy || !quote?.items.length) return;
  const user = accounts.currentUser();
  const data = fields();
  const errors = checkoutErrors(data);
  Object.entries(errors).forEach(([name, message]) => fieldError(name, message));
  if (Object.keys(errors).length || user?.role !== "customer") return;
  const submittedQuote = quote.items;
  setBusy(true); status.textContent = "Сохраняем заказ…";
  try {
    let id = sessionStorage.getItem(pendingKey(user));
    if (!id) { id = crypto.randomUUID(); sessionStorage.setItem(pendingKey(user), id); }
    const order = await createOrder(user, data, submittedQuote, { id });
    await finish(order);
    if (accounts.currentUser()?.id === user.id) {
      document.querySelector("#success-title").focus({ preventScroll: false });
      notify("Заказ сохранён. Он доступен в истории вашего аккаунта.");
    }
  } catch (error) {
    if (accounts.currentUser()?.id !== user.id) return;
    if (error.code === "CART_CHANGED") await refresh();
    if (error.errors) Object.entries(error.errors).forEach(([name, message]) => fieldError(name, message));
    status.textContent = error.message; notify(error.message, "error");
  } finally { setBusy(false); }
});
document.querySelector("[data-checkout-login]").addEventListener("click", (event) => document.dispatchEvent(new CustomEvent("open-auth", { detail: { trigger: event.currentTarget } })));
document.querySelector("[data-checkout-cart]").addEventListener("click", (event) => document.dispatchEvent(new CustomEvent("open-cart", { detail: { trigger: event.currentTarget } })));
document.querySelector("[data-checkout-history]").addEventListener("click", (event) => document.dispatchEvent(new CustomEvent("open-history", { detail: { trigger: event.currentTarget } })));
async function initialize() {
  try { await accounts.restore(); await refresh(); }
  catch (error) { status.textContent = error.message; gate.hidden = false; document.querySelector("[data-checkout-retry]").hidden = false; }
}
document.querySelector("[data-checkout-retry]").addEventListener("click", initialize);
document.querySelector("[data-order-cleanup]").addEventListener("click", async (event) => { event.currentTarget.disabled = true; try { await finish(receipt); } finally { event.currentTarget.disabled = false; } });
document.addEventListener("auth-changed", refresh);
document.addEventListener("cart-changed", (event) => {
  if (busy || receipt || !event.detail || !quote) return;
  const signature = (items) => JSON.stringify(items.map(({ id, quantity, priceMinor }) => ({ id, quantity, priceMinor })));
  if (signature(event.detail.items) !== signature(quote.items)) refresh();
});
initialize();
