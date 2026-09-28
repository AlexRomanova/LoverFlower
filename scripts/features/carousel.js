import { loadProducts, createProductCard } from "./products.js";

const carousel = document.querySelector("[data-products-carousel]");
if (carousel) {
  const track = carousel.querySelector(".products");
  const status = carousel.querySelector("[data-carousel-status]");
  const previous = carousel.querySelector("[data-carousel-prev]");
  const next = carousel.querySelector("[data-carousel-next]");
  function update() {
    const max = track.scrollWidth - track.clientWidth;
    previous.disabled = track.scrollLeft <= 1;
    next.disabled = track.scrollLeft >= max - 1;
    const first = track.firstElementChild;
    const stride = first ? first.getBoundingClientRect().width + parseFloat(getComputedStyle(track).gap) : 1;
    const start = Math.round(track.scrollLeft / stride) + 1;
    const visible = Math.max(1, Math.round((track.clientWidth + parseFloat(getComputedStyle(track).gap)) / stride));
    status.textContent = `Букеты ${start}–${Math.min(6, start + visible - 1)} из 6`;
  }
  function move(direction) {
    const card = track.firstElementChild;
    if (!card) return;
    track.scrollBy({ left: direction * (card.getBoundingClientRect().width + parseFloat(getComputedStyle(track).gap)), behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }
  previous.addEventListener("click", () => move(-1));
  next.addEventListener("click", () => move(1));
  track.addEventListener("scroll", update, { passive: true });
  track.addEventListener("keydown", (event) => {
    if (event.target !== track) return;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); move(event.key === "ArrowRight" ? 1 : -1); }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      track.scrollTo({ left: event.key === "Home" ? 0 : track.scrollWidth, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    }
  });
  new ResizeObserver(update).observe(track);
  loadProducts().then((products) => {
    track.replaceChildren(...products.slice(0, 6).map((product) => createProductCard(product, "product")));
    document.dispatchEvent(new Event("products-rendered"));
    update();
  }).catch((error) => { status.textContent = error.message; });
}
