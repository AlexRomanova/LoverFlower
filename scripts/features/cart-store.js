import { productsById } from "./products.js";

export const CART_KEY = "loverflower.cart.v1";
export const MAX_QUANTITY = 99;

// В хранилище только ID и количество. Названия, картинки и цены берём из каталога.
export function normalizeCart(value) {
  if (!Array.isArray(value)) return [];
  const items = new Map();
  for (const item of value) {
    if (!item || !productsById.has(item.id) || !Number.isSafeInteger(item.quantity) || item.quantity < 1) continue;
    items.set(item.id, Math.min(MAX_QUANTITY, (items.get(item.id) || 0) + Math.min(MAX_QUANTITY, item.quantity)));
  }
  return Array.from(items, ([id, quantity]) => ({ id, quantity }));
}

export function cartSummary(items) {
  const lines = normalizeCart(items).map(({ id, quantity }) => {
    const product = productsById.get(id);
    return { ...product, quantity, lineTotalMinor: product.priceMinor * quantity };
  });
  return {
    items: lines,
    quantity: lines.reduce((sum, item) => sum + item.quantity, 0),
    totalMinor: lines.reduce((sum, item) => sum + item.lineTotalMinor, 0),
  };
}

export function createCartStore(storage) {
  function read() {
    const raw = storage.getItem(CART_KEY);
    try { return normalizeCart(JSON.parse(raw || "[]")); }
    catch { return []; }
  }
  function write(items) {
    // Сначала сохраняем: при отказе localStorage интерфейс не сообщает об успехе.
    const normalized = normalizeCart(items);
    storage.setItem(CART_KEY, JSON.stringify(normalized));
    return cartSummary(normalized);
  }
  function requireProduct(id) {
    if (!productsById.has(id)) throw new Error("Этот товар пока недоступен для добавления.");
  }
  function requireQuantity(quantity) {
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
      throw new Error(`Количество должно быть от 1 до ${MAX_QUANTITY}.`);
    }
  }
  return {
    snapshot() { return cartSummary(read()); },
    add(id, quantity = 1) {
      requireProduct(id);
      requireQuantity(quantity);
      const items = read();
      const existing = items.find((item) => item.id === id);
      if (existing && existing.quantity + quantity > MAX_QUANTITY) throw new Error(`В корзине может быть не больше ${MAX_QUANTITY} одинаковых букетов.`);
      if (existing) existing.quantity += quantity;
      else items.push({ id, quantity });
      return write(items);
    },
    setQuantity(id, quantity) {
      requireProduct(id);
      requireQuantity(quantity);
      const items = read();
      const item = items.find((entry) => entry.id === id);
      if (!item) throw new Error("Товар уже удалён из корзины.");
      item.quantity = quantity;
      return write(items);
    },
    remove(id) {
      requireProduct(id);
      return write(read().filter((item) => item.id !== id));
    },
  };
}
