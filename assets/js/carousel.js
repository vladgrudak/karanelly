/* KaraNelly Space — карусель вертикальных видео на странице мероприятий. */
(function () {
  "use strict";

  var track = document.querySelector("[data-carousel-track]");
  if (!track) return;

  var prev = document.querySelector("[data-carousel-prev]");
  var next = document.querySelector("[data-carousel-next]");
  var cards = Array.prototype.slice.call(document.querySelectorAll("[data-video-card]"));

  function step() {
    var card = track.querySelector(".video-card");
    if (!card) return 300;
    var gap = parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap) || 16;
    return card.getBoundingClientRect().width + gap;
  }

  if (prev) {
    prev.addEventListener("click", function () {
      track.scrollBy({ left: -step(), behavior: "smooth" });
    });
  }

  if (next) {
    next.addEventListener("click", function () {
      track.scrollBy({ left: step(), behavior: "smooth" });
    });
  }

  /* Останавливает всё, кроме переданного ролика, и снимает служебные классы */
  function pauseOthers(except) {
    cards.forEach(function (card) {
      var video = card.querySelector("video");
      if (!video || video === except) return;
      video.pause();
      video.controls = false;
      card.classList.remove("is-playing", "is-autoplaying", "is-unmuted");
    });
  }

  cards.forEach(function (card) {
    var video = card.querySelector("video");
    if (!video) return;

    var playBtn = card.querySelector(".video-card__play");
    var soundBtn = card.querySelector("[data-sound]");

    /* Ручной запуск: со звуком и нативными кнопками */
    if (playBtn) {
      playBtn.addEventListener("click", function () {
        pauseOthers(video);
        video.muted = false;
        video.loop = false;
        video.controls = true;
        card.classList.add("is-playing");
        card.classList.remove("is-unmuted");
        var promise = video.play();
        if (promise && typeof promise.catch === "function") promise.catch(function () {});
      });
    }

    /* Автовоспроизведение идёт без звука — эта кнопка его включает */
    if (soundBtn) {
      soundBtn.addEventListener("click", function (event) {
        event.stopPropagation();
        video.muted = !video.muted;
        card.classList.toggle("is-unmuted", !video.muted);
        soundBtn.setAttribute("aria-pressed", String(!video.muted));
        soundBtn.setAttribute("aria-label", video.muted ? "Включить звук" : "Выключить звук");
      });
    }

    video.addEventListener("ended", function () {
      card.classList.remove("is-playing");
      video.controls = false;
      video.currentTime = 0;
    });
  });

  /* Телефон: ролик включается сам, когда попадает в кадр */
  var mobileQuery = window.matchMedia("(max-width: 899px)");
  var observer = null;

  function startAutoplay() {
    if (!mobileQuery.matches || !("IntersectionObserver" in window) || observer) return;

    observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var card = entry.target;
        var video = card.querySelector("video");
        if (!video) return;

        if (entry.isIntersecting) {
          pauseOthers(video);
          video.muted = true;
          video.loop = true;
          video.controls = false;
          card.classList.remove("is-unmuted");

          var promise = video.play();
          if (promise && typeof promise.then === "function") {
            promise
              .then(function () { card.classList.add("is-autoplaying"); })
              .catch(function () { card.classList.remove("is-autoplaying"); });
          } else {
            card.classList.add("is-autoplaying");
          }
        } else {
          video.pause();
          card.classList.remove("is-autoplaying");
        }
      });
    }, { threshold: 0.65 });

    cards.forEach(function (card) { observer.observe(card); });
  }

  function stopAutoplay() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    cards.forEach(function (card) {
      var video = card.querySelector("video");
      if (video) {
        video.pause();
        video.muted = false;
        video.loop = false;
        video.controls = false;
      }
      card.classList.remove("is-autoplaying", "is-unmuted");
    });
  }

  startAutoplay();

  if (typeof mobileQuery.addEventListener === "function") {
    mobileQuery.addEventListener("change", function (event) {
      if (event.matches) startAutoplay();
      else stopAutoplay();
    });
  }
})();
