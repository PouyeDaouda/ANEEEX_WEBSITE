document.addEventListener("DOMContentLoaded", function () {
  // Lazy loading des images
  const lazyLoadImages = () => {
    const images = document.querySelectorAll("img[data-src]");

    if ("IntersectionObserver" in window) {
      const imageObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const img = entry.target;
              img.src = img.dataset.src;
              img.onload = () => img.removeAttribute("data-src");
              imageObserver.unobserve(img);
            }
          });
        },
        { rootMargin: "200px" }
      );

      images.forEach((img) => imageObserver.observe(img));
    } else {
      // Fallback pour les navigateurs qui ne supportent pas IntersectionObserver
      images.forEach((img) => {
        img.src = img.dataset.src;
        img.removeAttribute("data-src");
      });
    }
  };

  // Initialiser le lazy loading
  lazyLoadImages();

  // Gestion du loader
  const loader = document.createElement("div");
  loader.className = "loader";
  // Remplacer l'icône Iconify par une icône Font Awesome
  loader.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; // Exemple d'icône de chargement Font Awesome
  document.body.appendChild(loader);

  // Simuler un chargement (à adapter selon vos besoins)
  window.addEventListener("load", function () {
    setTimeout(() => {
      loader.classList.add("fade-out");
      setTimeout(() => {
        loader.remove();
      }, 500);
    }, 1000);
  });

  // Smooth scroll pour les ancres
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute("href"));
      if (target) {
        window.scrollTo({
          top: target.offsetTop - 100,
          behavior: "smooth",
        });
      }
    });
  });

  // Animation au scroll
  const animateOnScroll = () => {
    const elements = document.querySelectorAll(".pilier, .service, .actualite");

    elements.forEach((element) => {
      const elementPosition = element.getBoundingClientRect().top;
      const screenPosition = window.innerHeight / 1.2;

      if (elementPosition < screenPosition) {
        element.classList.add("animate");
      }
    });
  };

  window.addEventListener("scroll", animateOnScroll);
  animateOnScroll(); // Exécuter une fois au chargement
});

// Ajouter des styles pour les animations
const style = document.createElement("style");
style.textContent = `
    .pilier, .service, .actualite {
        opacity: 0;
        transform: translateY(20px);
        transition: opacity 0.6s ease-out, transform 0.6s ease-out;
    }
    
    .pilier.animate, 
    .service.animate, 
    .actualite.animate {
        opacity: 1;
        transform: translateY(0);
    }
    
    .loader.fade-out {
        opacity: 0 !important;
        visibility: hidden !important;
    }
`;
document.head.appendChild(style);
