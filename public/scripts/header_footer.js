// Gestion du menu mobile
const menuToggle = document.querySelector(".menu-toggle");
const nav = document.querySelector("nav");
const overlay = document.createElement("div");
overlay.className = "mobile-menu-overlay";
document.body.appendChild(overlay);

function toggleMenu() {
    const isExpanded = menuToggle.getAttribute("aria-expanded") === "true";
    menuToggle.setAttribute("aria-expanded", !isExpanded);
    nav.classList.toggle("active");
    overlay.classList.toggle("active");
    document.body.style.overflow = isExpanded ? "" : "hidden";
}

menuToggle.addEventListener("click", toggleMenu);
overlay.addEventListener("click", toggleMenu);

// Fermer le menu quand un lien est cliqué
document.querySelectorAll("nav a").forEach((link) => {
    link.addEventListener("click", () => {
        if (nav.classList.contains("active")) {
            toggleMenu();
        }
    });
});

// Highlight la navigation active
const currentPath = window.location.pathname.split("/")[1] || "index";
document.querySelectorAll("nav a, #navigation a").forEach((link) => {
    const linkPath = link.getAttribute("href").split("/")[1] || "index";
    if (linkPath === currentPath) {
        link.setAttribute("aria-current", "page");
        link.classList.add("active");
    }
});