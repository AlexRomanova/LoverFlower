import { commonPasswords } from "./common-passwords-2023.js";

export const AGREEMENT_VERSION = "educational-2026-09-29";
export const NICKNAME_ATTEMPTS = 5;

export function normalizePhone(value) {
  if (!/^\+?[\d\s()-]+$/.test(value.trim())) return "";
  const digits = value.replace(/\D/g, "");
  return /^375\d{9}$/.test(digits) ? `+${digits}` : "";
}

export function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isAtLeast16(value, today = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const birthday = new Date(year, month - 1, day);
  if (birthday.getFullYear() !== year || birthday.getMonth() !== month - 1 || birthday.getDate() !== day) return false;
  let age = today.getFullYear() - year;
  if (today.getMonth() < month - 1 || (today.getMonth() === month - 1 && today.getDate() < day)) age--;
  return age >= 16;
}

export function passwordError(value) {
  if (value.length < 8 || value.length > 20) return "Пароль должен содержать от 8 до 20 символов.";
  if (!/\p{Lu}/u.test(value) || !/\p{Ll}/u.test(value) || !/\d/.test(value) || !/[^\p{L}\p{N}\s]/u.test(value)) {
    return "Добавьте заглавную и строчную буквы, цифру и специальный символ.";
  }
  if (commonPasswords.has(value.toLowerCase())) return "Этот пароль входит в TOP-100 популярных паролей 2023 года. Выберите другой.";
  return "";
}

export function registrationErrors(data, today = new Date()) {
  const errors = {};
  const namePattern = /^\p{L}[\p{L}\p{M}'’ -]*$/u;
  for (const field of ["surname", "firstName", "patronymic"]) {
    const value = (data[field] || "").trim();
    if ((field !== "patronymic" || value) && (!namePattern.test(value) || value.length > 60)) {
      errors[field] = "Введите имя буквами (до 60 символов).";
    }
  }
  if (!normalizePhone(data.phone || "")) errors.phone = "Введите номер РБ: +375 и ещё 9 цифр.";
  if (!isEmail(data.email || "")) errors.email = "Введите email, например name@example.com.";
  if (!isAtLeast16(data.birthDate || "", today)) errors.birthDate = "Регистрация доступна с 16 лет. Проверьте дату рождения.";
  if (!/^[\p{L}\p{N}_-]{3,24}$/u.test(data.nickname || "")) errors.nickname = "От 3 до 24 букв, цифр, дефисов или подчёркиваний.";
  const invalidPassword = passwordError(data.password || "");
  if (invalidPassword) errors.password = invalidPassword;
  if (data.passwordMode !== "automatic" && data.confirmPassword !== data.password) errors.confirmPassword = "Пароли не совпадают.";
  if (!data.agreementRead || !data.agreementAccepted) errors.agreement = "Прочитайте соглашение до конца и подтвердите согласие.";
  return errors;
}

function randomIndex(length) {
  const buffer = new Uint32Array(1);
  const ceiling = Math.floor(2 ** 32 / length) * length;
  do { crypto.getRandomValues(buffer); } while (buffer[0] >= ceiling);
  return buffer[0] % length;
}

export function generatePassword() {
  const groups = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnopqrstuvwxyz", "23456789", "!@#$%&*?_-+"];
  const alphabet = groups.join("");
  const characters = groups.map((group) => group[randomIndex(group.length)]);
  while (characters.length < 16) characters.push(alphabet[randomIndex(alphabet.length)]);
  for (let index = characters.length - 1; index > 0; index--) {
    const other = randomIndex(index + 1);
    [characters[index], characters[other]] = [characters[other], characters[index]];
  }
  const password = characters.join("");
  return passwordError(password) ? generatePassword() : password;
}

export function generateNickname() {
  const adjectives = ["Sunny", "Gentle", "Happy", "Velvet", "Lovely", "Golden", "Fresh", "Sweet"];
  const flowers = ["Rose", "Peony", "Lily", "Tulip", "Iris", "Daisy", "Lotus", "Orchid"];
  return `${adjectives[randomIndex(adjectives.length)]}${flowers[randomIndex(flowers.length)]}${1000 + randomIndex(9000)}`;
}
