import { api } from "./api.js";
import { CART_KEY, cartSummary, createCartStore, normalizeCart } from "./cart-store.js";
import { loadProducts, productsById } from "./products.js";
const TRANSFER_KEY = "loverflower.cart.transfer.v1";

async function cartFor(user, request) {
  return (await request("carts")).find((cart) => cart.userId === user.id)
    || { id: user.id, userId: user.id, items: [], importedGuestIds: [] };
}
async function saveCart(cart, request) {
  const exists = (await request("carts")).some((entry) => entry.id === cart.id);
  return request(exists ? `carts/${encodeURIComponent(cart.id)}` : "carts", { method: exists ? "PUT" : "POST", body: cart });
}
export async function transferGuestCart(storage, user, signal, request = api) {
  await loadProducts({ request });
  let saved;
  try { saved = JSON.parse(storage.getItem(CART_KEY) || "[]"); } catch { saved = []; }
  const guest = normalizeCart(saved);
  if (!guest.length) return;
  let transferId = storage.getItem(TRANSFER_KEY);
  if (!transferId) { transferId = crypto.randomUUID(); storage.setItem(TRANSFER_KEY, transferId); }
  const cart = await cartFor(user, request);
  if (!(cart.importedGuestIds || []).includes(transferId)) {
    const items = normalizeCart([...cart.items, ...guest]).map((item) => ({ ...item, quantity: Math.min(item.quantity, productsById.get(item.id).stock) })).filter((item) => item.quantity > 0);
    await saveCart({ ...cart, items, importedGuestIds: [...(cart.importedGuestIds || []), transferId] }, request);
  }
  signal?.throwIfAborted();
  storage.removeItem(CART_KEY); storage.removeItem(TRANSFER_KEY);
}
export function createCustomerCart(storage, accounts, { request = api } = {}) {
  const guest = createCartStore(storage);
  let queue = Promise.resolve();
  async function snapshot() {
    await loadProducts({ request });
    const user = accounts.currentUser();
    if (user?.role === "manager") return cartSummary([]);
    if (!user) return guest.snapshot();
    await transferGuestCart(storage, user, undefined, request);
    return cartSummary((await cartFor(user, request)).items);
  }
  function change(action, id, quantity) {
    const pending = queue.catch(() => {}).then(async () => {
      await loadProducts({ request });
      const user = accounts.currentUser();
      if (user?.role === "manager") throw new Error("Управление товарами доступно в кабинете менеджера.");
      if (!user) return guest[action](id, quantity);
      const cart = await cartFor(user, request);
      const validationStorage = { getItem: () => JSON.stringify(cart.items), setItem: (key, value) => { cart.items = JSON.parse(value); } };
      createCartStore(validationStorage)[action](id, quantity);
      await saveCart(cart, request);
      return cartSummary(cart.items);
    });
    queue = pending;
    return pending;
  }
  return { snapshot, add: (id, quantity = 1) => change("add", id, quantity), setQuantity: (id, quantity) => change("setQuantity", id, quantity), remove: (id) => change("remove", id) };
}

