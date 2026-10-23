/* KaraNelly Space — общий скрипт: меню, состояние хедера, появление блоков. */
(function () {
  "use strict";

  var doc = document;
  var body = doc.body;
  var header = doc.querySelector("[data-header]");
  var burger = doc.querySelector("[data-burger]");
  var menu = doc.querySelector("[data-menu]");
  var mqDesktop = window.matchMedia("(min-width: 1040px)");

  /* ---------- Хедер: фон после прокрутки ---------- */
  var lastScrolled = null;

  function onScroll() {
    if (!header) return;
    var scrolled = window.scrollY > 24;
    if (scrolled === lastScrolled) return;
    lastScrolled = scrolled;
    header.classList.toggle("is-scrolled", scrolled);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Мобильное меню ---------- */
  function setMenu(open) {
    if (!burger || !menu) return;

    body.classList.toggle("menu-open", open);
    burger.setAttribute("aria-expanded", String(open));
    burger.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
    menu.inert = !open;

    if (open) {
      var first = menu.querySelector("a, button");
      if (first) window.setTimeout(function () { first.focus(); }, 60);
    }
  }

  if (burger && menu) {
    menu.inert = true;

    burger.addEventListener("click", function () {
      setMenu(burger.getAttribute("aria-expanded") !== "true");
    });

    menu.addEventListener("click", function (event) {
      if (event.target.closest("a")) setMenu(false);
    });

    doc.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && body.classList.contains("menu-open")) {
        setMenu(false);
        burger.focus();
      }

      /* Простой focus trap внутри открытого меню */
      if (event.key === "Tab" && body.classList.contains("menu-open")) {
        var items = Array.prototype.filter.call(
          menu.querySelectorAll("a, button"),
          function (el) { return el.offsetParent !== null; }
        );
        if (!items.length) return;
        var first = items[0];
        var last = items[items.length - 1];

        if (event.shiftKey && doc.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && doc.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    });

    if (typeof mqDesktop.addEventListener === "function") {
      mqDesktop.addEventListener("change", function (event) {
        if (event.matches) setMenu(false);
      });
    }
  }

  /* ---------- Появление блоков при прокрутке ---------- */
  var revealItems = doc.querySelectorAll("[data-reveal]");

  if (revealItems.length) {
    if (!("IntersectionObserver" in window) ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      Array.prototype.forEach.call(revealItems, function (el) {
        el.classList.add("is-visible");
      });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var el = entry.target;
          var delay = el.getAttribute("data-delay");
          if (delay) el.style.setProperty("--delay", delay + "ms");
          el.classList.add("is-visible");
          io.unobserve(el);
        });
      }, { rootMargin: "0px 0px -6% 0px", threshold: 0.08 });

      Array.prototype.forEach.call(revealItems, function (el) {
        io.observe(el);
      });
    }
  }

  /* ---------- Скелетон календаря бронирования ---------- */
  var widgetFrame = doc.querySelector("[data-widget]");
  var widgetSkeleton = doc.querySelector("[data-widget-skeleton]");

  if (widgetFrame && widgetSkeleton) {
    var hideSkeleton = function () {
      widgetSkeleton.classList.add("is-hidden");
    };

    widgetFrame.addEventListener("load", hideSkeleton);
    window.setTimeout(hideSkeleton, 9000);
  }

  /* ---------- Текущий год в подвале ---------- */
  Array.prototype.forEach.call(doc.querySelectorAll("[data-year]"), function (el) {
    el.textContent = String(new Date().getFullYear());
  });
})();
