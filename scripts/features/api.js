export const SESSION_KEY = "loverflower.session.v3";
export const DEMO_DATA_KEY = "loverflower.demoData.v1";
const COLLECTIONS = new Set(["users", "products", "carts", "requests", "orders"]);

// Локально — обычный JSON Server. На GitHub Pages — JSON + изменения в браузере.
export function createDataApi({ local, storage, fetcher = (...args) => fetch(...args),
  serverRoot = "http://127.0.0.1:3000/", seedUrl = new URL("../../data/db.json", import.meta.url).href } = {}) {
  let seed;
  async function database(signal) {
    if (!seed) seed = fetcher(seedUrl, { signal }).then(async (response) => {
      if (!response.ok) throw new Error("Не удалось прочитать учебные данные.");
      return response.json();
    }).catch((error) => { seed = null; throw error; });
    const base = await seed;
    let saved = {};
    try { saved = JSON.parse(storage.getItem(DEMO_DATA_KEY) || "{}"); } catch { /* Повреждённые данные не заменяют исходный JSON. */ }
    return { base, saved, data: { ...base, ...saved } };
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
    const { saved, data } = await database(signal);
    signal?.throwIfAborted();
    const records = structuredClone(data[collection] || []);
    const id = encodedId ? decodeURIComponent(encodedId) : null;
    const index = id === null ? -1 : records.findIndex((entry) => String(entry.id) === id);
    if (method === "GET") {
      if (id === null) return records;
      if (index < 0) throw Object.assign(new Error("Запись не найдена."), { status: 404 });
      return records[index];
    }
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
  };
}

let client;
export function api(path, options) {
  if (!client) client = createDataApi({
    local: ["localhost", "127.0.0.1"].includes(location.hostname), storage: localStorage,
  });
  return client(path, options);
}

