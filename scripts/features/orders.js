import { api } from "./api.js";
import { normalizePhone, isEmail } from "./registration-rules.js";
import { MAX_QUANTITY } from "./cart-store.js";

export const ORDER_STATES = { new: "Новый", processing: "В работе", delivering: "В доставке", completed: "Завершён", cancelled: "Отменён" };
export const DELIVERY_LABELS = { courier: "Доставка по Минску", pickup: "Самовывоз" };
export const PAYMENT_LABELS = { cash: "Наличными при получении", card: "Картой при получении" };
export const TIME_SLOTS = ["10:00–12:00", "12:00–15:00", "15:00–18:00", "18:00–21:00"];
export const orderNumber = (order) => String(order.id).slice(0, 8).toUpperCase();
export const deliveryFee = (subtotal, method) => method === "pickup" || subtotal >= 9000 ? 0 : 1000;
export function todayISO(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function checkoutErrors(fields, now = new Date()) {
  const errors = {};
  const name = String(fields.name || "").trim();
  if (name.length < 2 || name.length > 120 || !/^[\p{L}\p{M}'’ -]+$/u.test(name)) errors.name = "Введите имя и фамилию буквами (от 2 до 120 символов).";
  if (!normalizePhone(String(fields.phone || ""))) errors.phone = "Введите номер РБ: +375 и ещё 9 цифр.";
  if (!isEmail(String(fields.email || "")) || fields.email.length > 120) errors.email = "Введите корректный email.";
  if (!Object.hasOwn(DELIVERY_LABELS, fields.deliveryMethod)) errors.deliveryMethod = "Выберите доставку или самовывоз.";
  if (!Object.hasOwn(PAYMENT_LABELS, fields.paymentMethod)) errors.paymentMethod = "Выберите способ оплаты при получении.";
  const date = String(fields.deliveryDate || "");
  const parsed = new Date(`${date}T12:00:00`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || todayISO(parsed) !== date || date < todayISO(now)) errors.deliveryDate = "Выберите сегодняшнюю или будущую дату.";
  if (!TIME_SLOTS.includes(fields.timeSlot)) errors.timeSlot = "Выберите интервал получения.";
  const address = String(fields.address || "").trim();
  if (fields.deliveryMethod === "courier" && (address.length < 5 || address.length > 200)) errors.address = "Укажите улицу, дом и квартиру в Минске (от 5 до 200 символов).";
  if (String(fields.comment || "").trim().length > 1000) errors.comment = "Комментарий должен быть не длиннее 1000 символов.";
  return errors;
}
function requireRole(user, role) {
  if (!user?.id || user.role !== role) throw new Error(role === "customer" ? "Для оформления и истории заказов войдите как покупатель." : "Изменять статус заказа может только менеджер.");
}

// В заказ записывается снимок данных, а не ссылки на сегодняшние цены каталога.
export function orderItems(cart, products) {
  if (!Array.isArray(cart?.items) || !cart.items.length) throw new Error("В корзине нет товаров для заказа.");
  const byId = new Map(products.map((product) => [product.id, product]));
  const seen = new Set();
  return cart.items.map(({ id, quantity }) => {
    const product = byId.get(id);
    if (!product || seen.has(id)) throw new Error("Один из букетов больше не доступен. Проверьте корзину.");
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY || !Number.isSafeInteger(product.stock) || quantity > product.stock) throw new Error(`Недостаточно букетов «${product.name}» в наличии. Измените количество в корзине.`);
    if (!Number.isSafeInteger(product.priceMinor) || product.priceMinor < 1) throw new Error("Не удалось определить цену букета.");
    seen.add(id);
    return { id, name: product.name, variant: product.variant || "", image: product.image, quantity, priceMinor: product.priceMinor, lineTotalMinor: product.priceMinor * quantity };
  });
}
const quoteSignature = (items) => JSON.stringify(items.map(({ id, quantity, priceMinor }) => ({ id, quantity, priceMinor })).sort((a, b) => a.id.localeCompare(b.id)));

export async function createOrder(user, fields, quote, { id = crypto.randomUUID(), request = api, now = new Date() } = {}) {
  requireRole(user, "customer");
  // Один ID на попытку: повтор после потерянного ответа не создаёт второй заказ.
  const previous = (await request("orders")).find((order) => order.id === id);
  if (previous) {
    if (previous.userId !== user.id) throw new Error("Этот заказ принадлежит другому покупателю.");
    return previous;
  }
  const errors = checkoutErrors(fields, now);
  if (Object.keys(errors).length) throw Object.assign(new Error("Проверьте поля оформления."), { errors });
  const [carts, products] = await Promise.all([request("carts"), request("products")]);
  const cart = carts.find((entry) => entry.userId === user.id);
  const items = orderItems(cart, products);
  if (quoteSignature(items) !== quoteSignature(quote || [])) throw Object.assign(new Error("Корзина или цены изменились. Проверьте обновлённую сумму и подтвердите заказ ещё раз."), { code: "CART_CHANGED" });
  const subtotalMinor = items.reduce((sum, item) => sum + item.lineTotalMinor, 0);
  const deliveryMinor = deliveryFee(subtotalMinor, fields.deliveryMethod);
  const order = { id, userId: user.id, status: "new", createdAt: now.toISOString(), items, subtotalMinor, deliveryMinor, totalMinor: subtotalMinor + deliveryMinor,
    contact: { name: fields.name.trim(), phone: normalizePhone(fields.phone), email: fields.email.trim().toLowerCase() },
    delivery: { method: fields.deliveryMethod, address: fields.deliveryMethod === "courier" ? fields.address.trim() : "Минск, ул. Тимирязева, 67, комн. 112", date: fields.deliveryDate, timeSlot: fields.timeSlot },
    paymentMethod: fields.paymentMethod, comment: String(fields.comment || "").trim() };
  try { return await request("orders", { method: "POST", body: order }); }
  catch (error) {
    const confirmed = (await request("orders").catch(() => [])).find((entry) => entry.id === id && entry.userId === user.id);
    if (confirmed) return confirmed;
    throw error;
  }
}

// Отдельное завершение корзины: ошибка после сохранения заказа не скрывает сам заказ.
export async function completeOrderCart(user, orderId, { request = api } = {}) {
  requireRole(user, "customer");
  const order = await request(`orders/${encodeURIComponent(orderId)}`);
  if (order.userId !== user.id) throw new Error("Этот заказ принадлежит другому покупателю.");
  const cart = (await request("carts")).find((entry) => entry.userId === user.id);
  if (!cart || cart.completedOrderIds?.includes(orderId)) return;
  const ordered = new Map(order.items.map((item) => [item.id, item.quantity]));
  const items = cart.items.map((item) => ({ ...item, quantity: Math.max(0, item.quantity - (ordered.get(item.id) || 0)) })).filter((item) => item.quantity > 0);
  await request(`carts/${encodeURIComponent(cart.id)}`, { method: "PUT", body: { ...cart, items, completedOrderIds: [...(cart.completedOrderIds || []), orderId] } });
}

export async function listOrders(user, { manager = false, request = api } = {}) {
  requireRole(user, manager ? "manager" : "customer");
  return (await request("orders")).filter((order) => manager || order.userId === user.id).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}
export async function updateOrderStatus(user, id, status, { request = api } = {}) {
  requireRole(user, "manager");
  if (!Object.hasOwn(ORDER_STATES, status)) throw new Error("Неизвестный статус заказа.");
  return request(`orders/${encodeURIComponent(id)}`, { method: "PATCH", body: { status, updatedAt: new Date().toISOString() } });
}
