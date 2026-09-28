const whitespace = /\s+/g;
export const normalizeText = (text) => String(text).replace(whitespace, " ").trim();
let dictionary = { texts: {}, patterns: [] };
let language = "ru";
let loading;

export function installDictionary(value) {
  dictionary = { texts: value.texts || {}, patterns: (value.patterns || []).map(([source, target]) => [new RegExp(source, "u"), target]) };
}
export async function loadDictionary() {
  if (!loading) loading = fetch(new URL("../../data/translations.en.json", import.meta.url)).then(async (response) => {
    if (!response.ok) throw new Error("Не удалось загрузить перевод. Попробуйте ещё раз.");
    installDictionary(await response.json());
  }).catch((error) => { loading = null; throw error; });
  return loading;
}
export function translateText(text, targetLanguage = language, translationKey) {
  if (targetLanguage !== "en") return String(text);
  const source = normalizeText(text);
  let result = dictionary.texts[translationKey || source];
  if (result === undefined) {
    for (const [pattern, target] of dictionary.patterns) {
      if (!pattern.test(source)) continue;
      result = source.replace(pattern, (...matches) => target.replace(/\$(\d+)/g, (_, index) => translateText(matches[Number(index)] || "", targetLanguage)));
      break;
    }
  }
  if (result === undefined) return String(text);
  return String(text).replace(/\S[\s\S]*\S|\S/u, () => result);
}
export const getLanguage = () => language;
export function setLanguage(value) { language = value === "en" ? "en" : "ru"; }

// Переводим только текст и доступные имена. Значения форм, ссылки и данные API остаются исходными.
export function createPageTranslator(root = document.documentElement) {
  const originals = new WeakMap();
  const attributes = ["aria-label", "placeholder", "title", "alt", "content"];
  const excluded = "script, style, textarea, [translate='no'], [data-user-content], [data-account-label], [data-mobile-account-name]";
  const excludedAttributes = "script, style, [translate='no'], [data-user-content], [data-account-label], [data-mobile-account-name]";
  function update(holder, key, read, write, translationKey) {
    const current = read();
    const record = originals.get(holder) || {};
    if (!record[key] || current !== record[key].display) record[key] = { source: current, display: current };
    const next = translateText(record[key].source, language, translationKey);
    record[key].display = next;
    originals.set(holder, record);
    if (next !== current) write(next);
  }
  function translate(element = root) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.parentElement?.closest(excluded)) continue;
      update(node, "text", () => node.textContent, (value) => { node.textContent = value; }, node.parentElement?.dataset.i18n);
    }
    for (const element of [root, ...root.querySelectorAll("[aria-label], [placeholder], [title], [alt], meta[name='description']")]) {
      if (element.closest(excludedAttributes)) continue;
      for (const name of attributes) {
        if (name === "title" && element.hasAttribute("data-user-title")) continue;
        if (!element.hasAttribute(name) || (name === "content" && !element.matches("meta[name='description']"))) continue;
        update(element, name, () => element.getAttribute(name), (value) => element.setAttribute(name, value));
      }
    }
  }
  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => { scheduled = false; observer.disconnect(); translate(); observe(); });
  });
  const observe = () => observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: attributes });
  observe();
  return () => { observer.disconnect(); translate(); observe(); };
}
