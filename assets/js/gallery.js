/* KaraNelly Space — галерея с лайтбоксом.
   Без зависимостей: клавиатура, свайпы, восстановление фокуса. */
(function () {
  "use strict";

  var gallery = document.querySelector("[data-gallery]");
  var box = document.querySelector("[data-lightbox]");
  if (!gallery || !box) return;

  var items = Array.prototype.slice.call(gallery.querySelectorAll("[data-full]"));
  if (!items.length) return;

  var imgEl = box.querySelector("[data-lightbox-img]");
  var capEl = box.querySelector("[data-lightbox-cap]");
  var counterEl = box.querySelector("[data-lightbox-counter]");
  var btnPrev = box.querySelector("[data-lightbox-prev]");
  var btnNext = box.querySelector("[data-lightbox-next]");
  var btnClose = box.querySelector("[data-lightbox-close]");

  var index = 0;
  var lastFocused = null;
  var touchStartX = 0;
  var touchStartY = 0;

  function pad(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function render(nextIndex) {
    index = (nextIndex + items.length) % items.length;
    var link = items[index];
    var full = link.getAttribute("data-full");
    var caption = link.getAttribute("data-caption") || "";
    var alt = link.querySelector("img") ? link.querySelector("img").alt : caption;

    imgEl.src = full;
    imgEl.alt = alt;
    capEl.textContent = caption;
    counterEl.textContent = pad(index + 1) + " / " + pad(items.length);
    box.setAttribute("aria-label", "Фотография " + (index + 1) + " из " + items.length);

    /* Заранее подгружаем соседние кадры */
    [items[(index + 1) % items.length], items[(index - 1 + items.length) % items.length]]
      .forEach(function (el) {
        var preload = new Image();
        preload.src = el.getAttribute("data-full");
      });
  }

  function open(startIndex, trigger) {
    lastFocused = trigger || document.activeElement;
    render(startIndex);
    box.hidden = false;
    document.body.classList.add("menu-open");

    /* Даём браузеру отрисовать hidden=false, затем плавно проявляем */
    window.requestAnimationFrame(function () {
      box.classList.add("is-open");
    });

    btnClose.focus();
    document.addEventListener("keydown", onKeydown);
  }

  function close() {
    box.classList.remove("is-open");
    document.body.classList.remove("menu-open");
    document.removeEventListener("keydown", onKeydown);

    window.setTimeout(function () {
      box.hidden = true;
      imgEl.removeAttribute("src");
      if (lastFocused) lastFocused.focus();
    }, 260);
  }

  function onKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      render(index + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      render(index - 1);
    } else if (event.key === "Tab") {
      var focusables = [btnClose, btnPrev, btnNext];
      var current = focusables.indexOf(document.activeElement);
      if (event.shiftKey && current <= 0) {
        event.preventDefault();
        btnNext.focus();
      } else if (!event.shiftKey && current === focusables.length - 1) {
        event.preventDefault();
        btnClose.focus();
      }
    }
  }

  items.forEach(function (link, i) {
    link.addEventListener("click", function (event) {
      event.preventDefault();
      open(i, link);
    });
  });

  btnPrev.addEventListener("click", function () { render(index - 1); });
  btnNext.addEventListener("click", function () { render(index + 1); });
  btnClose.addEventListener("click", close);

  box.addEventListener("click", function (event) {
    if (event.target === box || event.target.classList.contains("lightbox__stage")) {
      close();
    }
  });

  box.addEventListener("touchstart", function (event) {
    touchStartX = event.changedTouches[0].clientX;
    touchStartY = event.changedTouches[0].clientY;
  }, { passive: true });

  box.addEventListener("touchend", function (event) {
    var dx = event.changedTouches[0].clientX - touchStartX;
    var dy = event.changedTouches[0].clientY - touchStartY;
    if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy)) return;
    render(dx < 0 ? index + 1 : index - 1);
  }, { passive: true });
})();
