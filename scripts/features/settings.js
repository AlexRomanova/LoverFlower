export const SETTINGS_KEY = "loverflower.settings.v1";
export const DEFAULT_SETTINGS = Object.freeze({ language: "ru", theme: "dark", vision: false, fontSize: 16, scheme: "white-black", images: true });

export function normalizeSettings(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    language: source.language === "en" ? "en" : "ru",
    theme: source.theme === "light" ? "light" : "dark",
    vision: source.vision === true,
    fontSize: [16, 24, 32].includes(source.fontSize) ? source.fontSize : 16,
    scheme: ["white-black", "black-white", "beige-brown"].includes(source.scheme) ? source.scheme : "white-black",
    images: source.images !== false,
  };
}
export function readSettings(storage) {
  try { return normalizeSettings(JSON.parse(storage.getItem(SETTINGS_KEY) || "{}")); }
  catch { return { ...DEFAULT_SETTINGS }; }
}
export function saveSettings(storage, value) {
  const settings = normalizeSettings(value);
  storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  return settings;
}
export function resetStorage(storage, session) {
  storage.clear();
  for (let index = session.length - 1; index >= 0; index--) {
    const key = session.key(index);
    if (key?.startsWith("loverflower.")) session.removeItem(key);
  }
}
export function applySettings(settings, root = document.documentElement) {
  root.lang = settings.language;
  root.dataset.theme = settings.theme;
  root.dataset.vision = String(settings.vision);
  root.dataset.scheme = settings.scheme;
  root.dataset.images = settings.images ? "visible" : "hidden";
  root.style.setProperty("--vision-font", `${settings.fontSize}px`);
}
