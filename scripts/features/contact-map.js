import { getLanguage } from "./i18n.js";

const frame = document.querySelector("[data-contact-map]");
function updateMapLanguage() {
  const url = new URL(frame.src);
  const language = getLanguage() === "en" ? "en_RU" : "ru_RU";
  if (url.searchParams.get("lang") === language) return;
  url.searchParams.set("lang", language);
  frame.src = url.href;
}
if (frame) {
  updateMapLanguage();
  document.addEventListener("settings-changed", updateMapLanguage);
}
