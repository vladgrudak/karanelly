/* Праздничная тема сайта.
   Меняем THEME — включаем другой набор акцентов (см. CSS, блок «Праздничные акценты»).
   Пустая строка — акцентов нет. Значение попадает в data-theme у <html>. */
(function () {
  "use strict";

  var THEME = "ny"; // ny — Новый год; "" — без акцентов

  if (THEME) document.documentElement.setAttribute("data-theme", THEME);
})();
