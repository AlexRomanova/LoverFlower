const searchToggle = document.getElementById("searchToggle");
const searchField = document.getElementById("searchField");
const searchInput = document.getElementById("searchInput");
const searchClear = document.getElementById("searchClear");
const phoneBlock = document.getElementById("phoneBlock");
const searchTitle = document.getElementById("searchTitle");
const sidebarSearchToggle = document.getElementById("sidebarSearchToggle");

function openHeaderSearch() {
  searchField.classList.add("open");
  phoneBlock.classList.add("hidden");
  searchTitle.classList.add("hidden");
  setTimeout(() => searchInput.focus(), 50);
}
function closeHeaderSearch() {
  searchField.classList.remove("open");
  phoneBlock.classList.remove("hidden");
  searchTitle.classList.remove("hidden");
  searchInput.value = "";
}

searchToggle.addEventListener("click", () => {
  searchField.classList.contains("open") ? closeHeaderSearch() : openHeaderSearch();
});
sidebarSearchToggle.addEventListener("click", () => {
  searchField.classList.contains("open") ? closeHeaderSearch() : openHeaderSearch();
});
searchClear.addEventListener("click", closeHeaderSearch);
searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeHeaderSearch();
});

const burgerBtn = document.getElementById("burgerBtn");
const closeBtn = document.getElementById("closeBtn");
const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("overlay");

function openSidebar() {
  sidebar.classList.add("open");
  overlay.classList.add("open");
  burgerBtn.setAttribute("aria-expanded", "true");
  document.body.style.overflow = "hidden";
}
function closeSidebar() {
  sidebar.classList.remove("open");
  overlay.classList.remove("open");
  burgerBtn.setAttribute("aria-expanded", "false");
  document.body.style.overflow = "";
}

burgerBtn.addEventListener("click", openSidebar);
closeBtn.addEventListener("click", closeSidebar);
overlay.addEventListener("click", closeSidebar);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeSidebar();
});




let timeout;

dropdownItem.addEventListener("mouseenter", () => {
  clearTimeout(timeout);
  document.body.style.overflow = "hidden";
});

dropdownItem.addEventListener("mouseleave", () => {
  timeout = setTimeout(() => {
    document.body.style.overflow = "";
  }, 100);
});
