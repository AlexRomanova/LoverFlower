const ui = {
  header: {
    toggle: document.getElementById("searchToggle"),
    field: document.getElementById("searchField"),
    input: document.getElementById("searchInput"),
    clear: document.getElementById("searchClear"),
    extras: [
      document.getElementById("phoneBlock"),
      document.getElementById("searchTitle"),
    ],
  },
  sidebar: {
    toggle: document.getElementById("sidebarSearchToggle"),
    field: document.getElementById("sidebarSearchField"),
    input: document.getElementById("sidebarSearchInput"),
    clear: document.getElementById("sidebarSearchClear"),
    extras: [document.getElementById("sidebarSearchTitle")],
  },
  menu: {
    burger: document.getElementById("burgerBtn"),
    close: document.getElementById("closeBtn"),
    el: document.getElementById("sidebar"),
    overlay: document.getElementById("overlay"),
  },
};

function toggleSearch(context, forceClose = false) {
  const isOpening = !context.field.classList.contains("open") && !forceClose;

  if (isOpening) {
    context.field.classList.add("open");
    context.extras.forEach((el) => el?.classList.add("hidden"));
    setTimeout(() => context.input?.focus(), 50);
  } else {
    context.field.classList.remove("open");
    context.extras.forEach((el) => el?.classList.remove("hidden"));
    if (context.input) context.input.value = "";
  }
}

[ui.header, ui.sidebar].forEach((context) => {
  if (!context.toggle) return;

  context.toggle.addEventListener("click", (e) => {
    e.stopPropagation(); 
    toggleSearch(context);
  });

  context.clear?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleSearch(context, true);
  });

  context.input?.addEventListener("keydown", (e) => {
    if (e.key === "Escape") toggleSearch(context, true);
  });

  context.field?.addEventListener("click", (e) => e.stopPropagation());
});


function toggleSidebar(isOpen) {
  ui.menu.el?.classList.toggle("open", isOpen);
  ui.menu.overlay?.classList.toggle("open", isOpen);
  ui.menu.burger?.setAttribute("aria-expanded", isOpen);
  document.body.style.overflow = isOpen ? "hidden" : "";
}

ui.menu.burger?.addEventListener("click", () => toggleSidebar(true));
ui.menu.close?.addEventListener("click", () => toggleSidebar(false));
ui.menu.overlay?.addEventListener("click", () => toggleSidebar(false));

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    toggleSidebar(false);
    toggleSearch(ui.header, true);
    toggleSearch(ui.sidebar, true);
  }
});
