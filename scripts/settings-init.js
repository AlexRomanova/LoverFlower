// До CSS применяем сохранённую тему: при переходе страницы не мигают другой палитрой.
(() => {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem("loverflower.settings.v1") || "{}"); } catch { /* Используем исходные настройки. */ }
  const root = document.documentElement;
  root.dataset.theme = saved.theme === "light" ? "light" : "dark";
  root.dataset.vision = String(saved.vision === true);
  root.dataset.scheme = ["white-black", "black-white", "beige-brown"].includes(saved.scheme) ? saved.scheme : "white-black";
  root.dataset.images = saved.images === false ? "hidden" : "visible";
  root.style.setProperty("--vision-font", `${[16, 24, 32].includes(saved.fontSize) ? saved.fontSize : 16}px`);
  root.lang = saved.language === "en" ? "en" : "ru";
  root.dataset.loading = "true";
  // Даже недоступный API или внешний шрифт не оставляет страницу под прелоадером.
  const finish = () => { delete root.dataset.loading; document.querySelector(".site-preloader")?.remove(); };
  let pageLoaded = false, settingsReady = false;
  const finishWhenReady = () => { if (pageLoaded && settingsReady) finish(); };
  window.addEventListener("load", () => { pageLoaded = true; finishWhenReady(); }, { once: true });
  document.addEventListener("settings-ready", () => { settingsReady = true; finishWhenReady(); }, { once: true });
  window.setTimeout(finish, 4000);
  document.addEventListener("DOMContentLoaded", () => {
    if (!root.dataset.loading) return;
    const loader = document.createElement("div");
    loader.className = "site-preloader";
    loader.setAttribute("role", "status");
    loader.innerHTML = `<span class="site-preloader__spinner" aria-hidden="true"></span><span>${root.lang === "en" ? "Loading…" : "Загрузка…"}</span>`;
    document.body.append(loader);
  }, { once: true });
})();
