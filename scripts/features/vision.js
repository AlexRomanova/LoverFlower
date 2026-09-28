// Информационные секции доступны через раскрывающиеся заголовки; формы не сворачиваем.
export function createVisionView() {
  const sections = new Map();
  const captions = new Map();
  let productDetails;
  function sectionTitle(section) {
    if (section.tagName === "NAV") return "Навигация по странице";
    if (section.matches(".social-section")) return "Наши социальные сети";
    return section.getAttribute("aria-label") || section.querySelector("h2, h3")?.textContent.trim() || "Дополнительно";
  }
  function update(settings) {
    if (settings.vision) {
      for (const section of document.querySelectorAll("main section, main nav[class*='breadcrumbs'], app-footer .footer__grid > div")) {
        if (section.closest(".vision-section, .hero, .checkout-page") || section.querySelector("h1") || section.matches(".product-hero")) continue;
        const heading = section.querySelector("h2");
        const title = heading || section.querySelector("h3");
        if (!title && !section.getAttribute("aria-label")) continue;
        const details = document.createElement("details"); details.className = "vision-section";
        const summary = document.createElement("summary"); summary.textContent = sectionTitle(section);
        section.before(details); details.append(summary, section);
        sections.set(section, details);
      }
      for (const [section, details] of sections) details.querySelector("summary").textContent = sectionTitle(section);
      const info = document.querySelector(".product-info");
      if (info && !productDetails) {
        const fields = [...info.querySelectorAll(".product-info__composition, .product-info__description, .product-info__meta")];
        productDetails = document.createElement("details"); productDetails.className = "vision-section";
        const summary = document.createElement("summary"); summary.textContent = "Описание и состав";
        fields[0].before(productDetails); productDetails.append(summary, ...fields);
      }
      if (productDetails) productDetails.querySelector("summary").textContent = "Описание и состав";
    } else {
      for (const [section, details] of sections) { details.replaceWith(section); }
      sections.clear();
      if (productDetails) { productDetails.replaceWith(...productDetails.querySelectorAll("p")); productDetails = null; }
    }
    refreshImages(settings);
    expandTarget();
  }
  function expandTarget() {
    let id = location.hash.slice(1);
    try { id = decodeURIComponent(id); } catch { /* Некорректный fragment не мешает открыть страницу. */ }
    const target = document.getElementById(id);
    const details = target?.closest(".vision-section");
    if (details) details.open = true;
  }
  window.addEventListener("hashchange", expandTarget);
  function refreshImages(settings) {
    for (const [image, caption] of captions) {
      if (!image.isConnected || !settings.vision || settings.images) { caption.remove(); captions.delete(image); }
      else if (caption.textContent !== image.alt) caption.textContent = image.alt;
    }
    if (!settings.vision || settings.images) return;
    for (const image of document.querySelectorAll("img[alt]")) {
      if (!image.alt || image.closest("[aria-hidden='true']") || captions.has(image)) continue;
      const caption = document.createElement("span"); caption.className = "image-description";
      caption.textContent = image.alt;
      (image.closest("picture") || image).after(caption);
      captions.set(image, caption);
    }
  }
  return { update, refreshImages };
}
