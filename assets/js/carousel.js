/* KaraNelly Space — карусель вертикальных видео на странице мероприятий.
   Звук — один на всю карусель: включили на одном ролике, звучат все. */
(function () {
  "use strict";

  var track = document.querySelector("[data-carousel-track]");
  if (!track) return;

  var prev = document.querySelector("[data-carousel-prev]");
  var next = document.querySelector("[data-carousel-next]");
  var soundToggle = document.querySelector("[data-sound-toggle]");
  var soundLabel = document.querySelector("[data-sound-label]");
  var cards = Array.prototype.slice.call(document.querySelectorAll("[data-video-card]"));

  var soundOn = false;

  function applySound() {
    cards.forEach(function (card) {
      var video = card.querySelector("video");
      if (video) video.muted = !soundOn;
    });

    if (soundToggle) {
      soundToggle.classList.toggle("is-on", soundOn);
      soundToggle.setAttribute("aria-pressed", String(soundOn));
      soundToggle.setAttribute("aria-label", soundOn
        ? "Выключить звук во всех видео"
        : "Включить звук во всех видео");
    }

    if (soundLabel) {
      soundLabel.textContent = soundOn ? "Звук включён" : "Звук выключен";
    }
  }

  if (soundToggle) {
    soundToggle.addEventListener("click", function () {
      soundOn = !soundOn;
      applySound();
    });
  }

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

  /* Останавливает всё, кроме переданного ролика */
  function pauseOthers(except) {
    cards.forEach(function (card) {
      var video = card.querySelector("video");
      if (!video || video === except) return;
      video.pause();
      video.controls = false;
      card.classList.remove("is-playing", "is-autoplaying");
    });
  }

  cards.forEach(function (card) {
    var video = card.querySelector("video");
    if (!video) return;

    var playBtn = card.querySelector(".video-card__play");

    /* Ручной запуск: сразу включаем общий звук */
    if (playBtn) {
      playBtn.addEventListener("click", function () {
        soundOn = true;
        applySound();

        pauseOthers(video);
        video.loop = false;
        video.controls = true;
        card.classList.add("is-playing");

        var promise = video.play();
        if (promise && typeof promise.catch === "function") promise.catch(function () {});
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

  function playCard(card) {
    var video = card.querySelector("video");
    if (!video) return;

    pauseOthers(video);
    video.loop = true;
    video.controls = false;
    video.muted = !soundOn;

    var promise = video.play();

    function onFail() {
      card.classList.remove("is-autoplaying");
      /* Браузер не дал автозвук — откатываемся на беззвучный режим */
      if (soundOn) {
        soundOn = false;
        applySound();
        video.muted = true;
        var retry = video.play();
        if (retry && typeof retry.then === "function") {
          retry.then(function () { card.classList.add("is-autoplaying"); }).catch(function () {});
        }
      }
    }

    if (promise && typeof promise.then === "function") {
      promise.then(function () { card.classList.add("is-autoplaying"); }).catch(onFail);
    } else {
      card.classList.add("is-autoplaying");
    }
  }

  function startAutoplay() {
    if (!mobileQuery.matches || !("IntersectionObserver" in window) || observer) return;

    var active = [];

    observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var card = entry.target;
        var index = active.indexOf(card);

        if (entry.isIntersecting && index === -1) {
          active.push(card);
        } else if (!entry.isIntersecting && index !== -1) {
          active.splice(index, 1);
          var video = card.querySelector("video");
          if (video) video.pause();
          card.classList.remove("is-autoplaying");
        }
      });

      if (!active.length) return;

      /* Играет самый левый из видимых роликов */
      active.sort(function (a, b) { return cards.indexOf(a) - cards.indexOf(b); });
      playCard(active[0]);
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
        video.loop = false;
        video.controls = false;
      }
      card.classList.remove("is-autoplaying");
    });
  }

  applySound();
  startAutoplay();

  if (typeof mobileQuery.addEventListener === "function") {
    mobileQuery.addEventListener("change", function (event) {
      if (event.matches) startAutoplay();
      else stopAutoplay();
    });
  }
})();
