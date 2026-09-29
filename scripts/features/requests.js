import { api } from "./api.js";
import { normalizePhone } from "./registration-rules.js";

export async function createRequest(type, fields, { request = api, signal } = {}) {
  if (!["callback", "corporate", "question"].includes(type)) throw new Error("Неизвестный тип заявки.");
  const phone = normalizePhone(fields.phone || fields.contactPhone || "");
  if (!phone) throw new Error("Введите номер РБ: +375 и ещё 9 цифр.");
  const cleaned = Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, String(value).trim()]));
  return request("requests", { method: "POST", signal, body: { id: crypto.randomUUID(), type, fields: { ...cleaned, phone }, status: "new", createdAt: new Date().toISOString() } });
}

// Старые заявки на звонок тоже должны появиться в кабинете менеджера.
export async function importCallbackRequests(storage, request = api) {
  const marker = "loverflower.callbackRequests.migrated.v1";
  if (storage.getItem(marker)) return;
  let old;
  try { old = JSON.parse(storage.getItem("loverflower.callbackRequests") || "[]"); } catch { old = []; }
  if (!Array.isArray(old)) old = [];
  if (old.length) {
    const existing = await request("requests");
    for (const [index, entry] of old.entries()) {
      if (!entry?.phone) continue;
      const id = `legacy-callback-${index}-${String(entry.createdAt || "undated").replace(/[^a-z0-9]/gi, "")}`;
      if (!existing.some((item) => item.id === id)) await request("requests", { method: "POST", body: { id, type: "callback", fields: { name: entry.name || "", phone: entry.phone }, status: "new", createdAt: entry.createdAt || new Date().toISOString() } });
    }
  }
  storage.setItem(marker, "complete");
}
