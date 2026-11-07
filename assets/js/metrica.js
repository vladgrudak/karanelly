/* Яндекс Метрика: счётчик и цели.
   Счётчик — 114125317. Цели по кликам: бронь, звонок, соцсети, заявка на мероприятие.
   Цели по URL (например, посещение /booking/) создаются в интерфейсе Метрики. */
(function () {
  "use strict";

  var COUNTER_ID = 114125317;

  (function (m, e, t, r, i, k, a) {
    m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments); };
    m[i].l = 1 * new Date();
    for (var j = 0; j < document.scripts.length; j++) {
      if (document.scripts[j].src === r) return;
    }
    k = e.createElement(t);
    a = e.getElementsByTagName(t)[0];
    k.async = 1;
    k.src = r;
    a.parentNode.insertBefore(k, a);
  })(window, document, "script", "https://mc.yandex.ru/metrika/tag.js?id=" + COUNTER_ID, "ym");

  window.ym(COUNTER_ID, "init", {
    ssr: true,
    webvisor: true,
    clickmap: true,
    ecommerce: "dataLayer",
    referrer: document.referrer,
    url: location.href,
    accurateTrackBounce: true,
    trackLinks: true
  });

  function reachGoal(name) {
    if (typeof window.ym === "function") window.ym(COUNTER_ID, "reachGoal", name);
  }

  function goalFor(link) {
    var explicit = link.getAttribute("data-metrica-goal");
    if (explicit) return explicit;

    var href = link.getAttribute("href") || "";
    if (href.indexOf("tel:") === 0) return "call_click";
    if (/t\.me\//.test(href)) return "telegram_click";
    if (/vk\.(ru|com)\//.test(href)) return "vk_click";
    if (/instagram\.com\//.test(href)) return "instagram_click";
    if (href.indexOf("booking/") !== -1) return "booking_click";
    return null;
  }

  document.addEventListener("click", function (event) {
    var target = event.target;
    var link = target && target.closest ? target.closest("a") : null;
    if (!link) return;
    var goal = goalFor(link);
    if (goal) reachGoal(goal);
  }, true);
})();
