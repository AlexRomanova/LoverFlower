import { api, SESSION_KEY } from "./api.js";
import { transferGuestCart } from "./customer-cart.js";
import { AGREEMENT_VERSION, normalizePhone, registrationErrors } from "./registration-rules.js";
import { createCredential, fromHex, hashPassword } from "./password-crypto.js";
export { SESSION_KEY } from "./api.js";
export const ACCOUNTS_KEY = "loverflower.accounts.v1";
const MIGRATION_KEY = "loverflower.accounts.migrated.v3";
const stores = new WeakMap();
const publicProfile = ({ credential, ...user }) => user;

// Учебная авторизация на клиенте. JSON Server не защищает записи от прямых запросов.
export function createAccountStore(accountsStorage, sessionStorage, { request = api } = {}) {
  if (stores.has(sessionStorage)) return stores.get(sessionStorage);
  let user = null;
  let restoring;
  async function migrate(signal) {
    if (accountsStorage.getItem(MIGRATION_KEY)) return;
    const old = JSON.parse(accountsStorage.getItem(ACCOUNTS_KEY) || "[]");
    if (!Array.isArray(old)) throw new Error("Не удалось прочитать старые аккаунты.");
    if (old.length) {
      const users = await request("users", { signal });
      for (const entry of old) {
        if (!entry.credential || users.some((item) => item.email === entry.email || item.phone === entry.phone || item.nickname === entry.nickname)) continue;
        const profile = { id: entry.id || crypto.randomUUID(), role: "customer", surname: entry.surname, firstName: entry.firstName, patronymic: entry.patronymic || "", phone: entry.phone, email: entry.email, birthDate: entry.birthDate, nickname: entry.nickname, credential: entry.credential, agreement: entry.agreement, createdAt: entry.createdAt };
        const added = await request("users", { method: "POST", body: profile, signal });
        users.push(added);
      }
    }
    accountsStorage.setItem(MIGRATION_KEY, "complete");
  }
  async function accept(account, signal) {
    signal?.throwIfAborted();
    if (account.role === "customer") await transferGuestCart(accountsStorage, account, signal, request);
    signal?.throwIfAborted();
    sessionStorage.setItem(SESSION_KEY, account.id);
    sessionStorage.removeItem("loverflower.session.v1");
    sessionStorage.removeItem("loverflower.session.v2");
    user = publicProfile(account);
    return user;
  }
  const store = {
    currentUser: () => user,
    restore() {
      if (restoring) return restoring;
      restoring = (async () => {
        await migrate();
        const id = sessionStorage.getItem(SESSION_KEY) || sessionStorage.getItem("loverflower.session.v1");
        if (!id) return null;
        const account = (await request("users")).find((entry) => entry.id === id);
        user = account ? publicProfile(account) : null;
        if (!account) sessionStorage.removeItem(SESSION_KEY);
        else sessionStorage.setItem(SESSION_KEY, account.id);
        return user;
      })().finally(() => { restoring = null; });
      return restoring;
    },
    async register(data, signal) {
      const errors = registrationErrors(data);
      if (Object.keys(errors).length) throw Object.assign(new Error("Проверьте поля регистрации."), { errors });
      await migrate(signal);
      const profile = { surname: data.surname.trim(), firstName: data.firstName.trim(), patronymic: (data.patronymic || "").trim(),
        phone: normalizePhone(data.phone), email: data.email.trim().toLowerCase(), birthDate: data.birthDate, nickname: data.nickname.trim() };
      const credential = await createCredential(data.password);
      signal?.throwIfAborted();
      const users = await request("users", { signal });
      const field = ["email", "phone", "nickname"].find((key) => users.some((entry) => entry[key].toLowerCase() === profile[key].toLowerCase()));
      if (field) throw Object.assign(new Error({ email: "Этот email уже зарегистрирован.", phone: "Этот телефон уже зарегистрирован.", nickname: "Этот никнейм уже занят." }[field]), { field });
      const account = await request("users", { method: "POST", signal, body: { ...profile, id: crypto.randomUUID(), role: "customer", credential,
        createdAt: new Date().toISOString(), agreement: { version: AGREEMENT_VERSION, acceptedAt: new Date().toISOString() } } });
      return accept(account, signal);
    },
    async login(identifier, password, signal) {
      await migrate(signal);
      const account = (await request("users", { signal })).find((entry) => entry.email === identifier.trim().toLowerCase() || entry.phone === normalizePhone(identifier));
      if (!account?.credential) throw new Error("Неверный email, телефон или пароль.");
      const hash = await hashPassword(password, fromHex(account.credential.salt), account.credential.iterations);
      signal?.throwIfAborted();
      if (hash !== account.credential.hash) throw new Error("Неверный email, телефон или пароль.");
      return accept(account, signal);
    },
    async logout() { sessionStorage.removeItem(SESSION_KEY); sessionStorage.removeItem("loverflower.session.v1"); sessionStorage.removeItem("loverflower.session.v2"); user = null; },
  };
  stores.set(sessionStorage, store);
  return store;
}

