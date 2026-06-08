// Учебные аккаунты в этом браузере. Для реального сайта нужен сервер авторизации.
import { AGREEMENT_VERSION, normalizePhone, registrationErrors } from "./registration-rules.js";

export const ACCOUNTS_KEY = "loverflower.accounts.v1";
export const SESSION_KEY = "loverflower.session.v1";
const HASH_ITERATIONS = 600000;
const toHex = (bytes) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
const fromHex = (hex) => Uint8Array.from(hex.match(/.{2}/g) || [], (byte) => parseInt(byte, 16));
const publicProfile = ({ credential, ...profile }) => profile;

async function hashPassword(password, salt, iterations = HASH_ITERATIONS) {
  if (!crypto.subtle) throw new Error("Для регистрации откройте сайт через localhost или HTTPS.");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return toHex(new Uint8Array(bits));
}

export function createAccountStore(accountsStorage, sessionStorage) {
  const readAccounts = () => {
    const parsed = JSON.parse(accountsStorage.getItem(ACCOUNTS_KEY) || "[]");
    if (!Array.isArray(parsed)) throw new Error("Не удалось прочитать сохранённые аккаунты.");
    return parsed;
  };
  function checkDuplicates(data, accounts) {
    const field = ["email", "phone", "nickname"].find((key) => accounts.some((account) => account[key].toLowerCase() === data[key].toLowerCase()));
    if (field) {
      const error = new Error({ email: "Этот email уже зарегистрирован.", phone: "Этот телефон уже зарегистрирован.", nickname: "Этот никнейм уже занят." }[field]);
      error.field = field;
      throw error;
    }
  }
  return {
    currentUser() {
      try {
        const id = sessionStorage.getItem(SESSION_KEY);
        const account = readAccounts().find((item) => item.id === id);
        return account ? publicProfile(account) : null;
      } catch { return null; }
    },
    async register(data, signal) {
      const errors = registrationErrors(data);
      if (Object.keys(errors).length) {
        const error = new Error("Проверьте поля регистрации.");
        error.errors = errors;
        throw error;
      }
      const profile = {
        surname: data.surname.trim(), firstName: data.firstName.trim(), patronymic: data.patronymic.trim(),
        phone: normalizePhone(data.phone), email: data.email.trim().toLowerCase(),
        birthDate: data.birthDate, nickname: data.nickname,
      };
      checkDuplicates(profile, readAccounts());
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const hash = await hashPassword(data.password, salt);
      signal?.throwIfAborted();
      // Перечитываем после асинхронного хеширования, чтобы не потерять новый аккаунт.
      const accounts = readAccounts();
      checkDuplicates(profile, accounts);
      const account = {
        ...profile, id: crypto.randomUUID(), createdAt: new Date().toISOString(),
        agreement: { version: AGREEMENT_VERSION, acceptedAt: new Date().toISOString() },
        credential: { salt: toHex(salt), hash, iterations: HASH_ITERATIONS },
      };
      // Проверяем доступность сессии до записи аккаунта.
      sessionStorage.setItem(SESSION_KEY, account.id);
      try { accountsStorage.setItem(ACCOUNTS_KEY, JSON.stringify([...accounts, account])); }
      catch (error) { sessionStorage.removeItem(SESSION_KEY); throw error; }
      return publicProfile(account);
    },
    async login(identifier, password, signal) {
      const email = identifier.trim().toLowerCase();
      const phone = normalizePhone(identifier);
      const account = readAccounts().find((item) => item.email === email || (phone && item.phone === phone));
      const credential = account?.credential;
      if (!credential) throw new Error("Неверный email, телефон или пароль.");
      const hash = await hashPassword(password, fromHex(credential.salt), credential.iterations);
      signal?.throwIfAborted();
      if (hash !== credential.hash) throw new Error("Неверный email, телефон или пароль.");
      sessionStorage.setItem(SESSION_KEY, account.id);
      return publicProfile(account);
    },
    logout() { sessionStorage.removeItem(SESSION_KEY); },
  };
}
