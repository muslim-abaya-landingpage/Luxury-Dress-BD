/* ==========================================
   Muslim Abaya Liquid Glass UI
   Version 1.0
========================================== */

(() => {
  "use strict";

  // Respect accessibility settings
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  // Product card hover tilt (desktop only)
  if (window.matchMedia("(hover: hover)").matches) {
    document.querySelectorAll(".ah-card").forEach(card => {

      card.addEventListener("mousemove", e => {

        const rect = card.getBoundingClientRect();

        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const rotateY = ((x / rect.width) - 0.5) * 6;
        const rotateX = ((y / rect.height) - 0.5) * -6;

        card.style.transform =
          `perspective(900px)
           rotateX(${rotateX}deg)
           rotateY(${rotateY}deg)
           translateY(-4px)`;

      });

      card.addEventListener("mouseleave", () => {
        card.style.transform = "";
      });

    });
  }

})();