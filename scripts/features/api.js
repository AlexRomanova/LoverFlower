export const SESSION_KEY = "loverflower.session.v3";
export const DEMO_DATA_KEY = "loverflower.demoData.v1";
const COLLECTIONS = new Set(["users", "products", "carts", "requests", "orders", "reviews"]);
const storageQueues = new WeakMap();

// Старый статический каталог сохранялся целиком после изменения цены менеджером.
// Обновляем его карточки и добавляем подарки, сохраняя изменённые цены и остатки.
function upgradeLegacyProducts(savedProducts, seedProducts = []) {
  const isLegacy = (product) => !product.source && ["roses", "peonies", "mixed"].includes(product.category)
    && /^media\/(?:catalog\/catalog-product__image\d+\.png|home-mobile\/popular-[123]\.webp)$/.test(product.image || "");
  if (!Array.isArray(savedProducts) || !savedProducts.some(isLegacy) || !seedProducts.some((product) => product.source)) return savedProducts;
  const savedById = new Map(savedProducts.map((product) => [product.id, product]));
  const products = seedProducts.map((product) => {
    const old = savedById.get(product.id);
    if (!old) return product;
    if (!isLegacy(old)) return old;
    const number = Number(/^(?:home|bouquet)-(\d+)$/.exec(old.id)?.[1]);
    const originalPrice = number <= 3 ? 16700 : 7800 + number * 700;
    const originalStock = number <= 3 ? 99 : number + 9;
    return { ...product,
      ...(old.priceMinor !== originalPrice ? { priceMinor: old.priceMinor } : {}),
      ...(old.stock !== originalStock ? { stock: old.stock } : {}),
    };
  });
  const seedIds = new Set(seedProducts.map((product) => product.id));
  return [...products, ...savedProducts.filter((product) => !seedIds.has(product.id))];
}

function serializeStorage(storage, operation, signal) {
  // Web Locks согласует записи между вкладками на GitHub Pages и localhost.
  const locks = globalThis.window?.navigator?.locks;
  if (locks?.request) {
    return locks.request(DEMO_DATA_KEY, { mode: "exclusive", ...(signal ? { signal } : {}) }, operation);
  }
  // Резервный вариант для окружений без Web Locks: общая очередь для этого хранилища.
  const pending = (storageQueues.get(storage) || Promise.resolve()).catch(() => {}).then(operation);
  storageQueues.set(storage, pending);
  return pending.finally(() => { if (storageQueues.get(storage) === pending) storageQueues.delete(storage); });
}

// Локально — обычный JSON Server. На GitHub Pages — JSON + изменения в браузере.
export function createDataApi({ local, storage, fetcher = (...args) => fetch(...args),
  serverRoot = "http://127.0.0.1:3000/", seedUrl = new URL("../../data/db.json", import.meta.url).href } = {}) {
  let seed;
  async function database(signal) {
    if (!seed) seed = fetcher(seedUrl, { signal }).then(async (response) => {
      if (!response.ok) throw new Error("Не удалось прочитать учебные данные.");
      return response.json();
    }).catch((error) => { seed = null; throw error; });
    return seed;
  }
  function currentData(base) {
    let saved = {};
    try { saved = JSON.parse(storage.getItem(DEMO_DATA_KEY) || "{}"); } catch { /* Повреждённые данные не заменяют исходный JSON. */ }
    const data = { ...base, ...saved };
    if (saved.products) data.products = upgradeLegacyProducts(saved.products, base.products);
    return { base, saved, data };
  }
  return async function request(path, { method = "GET", body, signal } = {}) {
    const [collection, encodedId] = path.split("/");
    if (!COLLECTIONS.has(collection)) throw new Error("Неизвестный тип данных.");
    if (local) {
      let response;
      try {
        response = await fetcher(new URL(path, serverRoot).href, { method, signal,
          headers: body === undefined ? {} : { "Content-Type": "application/json" },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      } catch (error) {
        if (error.name === "AbortError") throw error;
        throw new Error("Не удалось подключиться к JSON Server. Запустите npm start.");
      }
      if (!response.ok) throw Object.assign(new Error(response.status === 404 ? "Запись не найдена." : "Не удалось сохранить данные."), { status: response.status });
      return response.status === 204 ? null : response.json();
    }
    signal?.throwIfAborted();
    const base = await database(signal);
    signal?.throwIfAborted();
    const id = encodedId ? decodeURIComponent(encodedId) : null;
    if (method === "GET") {
      const records = structuredClone(currentData(base).data[collection] || []);
      const index = id === null ? -1 : records.findIndex((entry) => String(entry.id) === id);
      if (id === null) return records;
      if (index < 0) throw Object.assign(new Error("Запись не найдена."), { status: 404 });
      return records[index];
    }
    return serializeStorage(storage, () => {
      signal?.throwIfAborted();
      // Читаем актуальные коллекции внутри блокировки. Между чтением и записью нет await.
      const { saved, data } = currentData(base);
      const records = structuredClone(data[collection] || []);
      const index = id === null ? -1 : records.findIndex((entry) => String(entry.id) === id);
      let result;
      if (method === "POST") {
        result = { ...body, id: body?.id || crypto.randomUUID() };
        if (records.some((entry) => entry.id === result.id)) throw Object.assign(new Error("Запись уже существует."), { status: 409 });
        records.push(result);
      } else if (["PUT", "PATCH", "DELETE"].includes(method) && index >= 0) {
        result = method === "PATCH" ? { ...records[index], ...body, id: records[index].id } : { ...body, id: records[index].id };
        if (method === "DELETE") { records.splice(index, 1); result = null; }
        else records[index] = result;
      } else throw Object.assign(new Error("Запись не найдена."), { status: 404 });
      storage.setItem(DEMO_DATA_KEY, JSON.stringify({ ...saved, [collection]: records }));
      return structuredClone(result);
    }, signal);
  };
}

let client;
export function api(path, options) {
  if (!client) client = createDataApi({
    local: ["localhost", "127.0.0.1"].includes(location.hostname), storage: localStorage,
  });
  return client(path, options);
}

