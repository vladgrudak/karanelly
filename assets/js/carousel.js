/* KaraNelly Space — лента видео в стиле Apple «highlights».
   Тап по кнопке запускает показ: ролики играют по очереди, под лентой
   растёт полоска прогресса, которая на завершённом ролике сжимается в точку.
   На телефоне показ включается сам, когда лента попадает в кадр. */
(function () {
  "use strict";

  var track = document.querySelector("[data-carousel-track]");
  if (!track) return;

  var cards = Array.prototype.slice.call(document.querySelectorAll("[data-video-card]"));
  var dots = Array.prototype.slice.call(document.querySelectorAll("[data-go]"));
  var toggle = document.querySelector("[data-reel-toggle]");
  var soundToggle = document.querySelector("[data-sound-toggle]");

  var index = 0;
  var running = false;
  var userPaused = false;
  var raf = 0;
  var suppressScroll = false;
  var scrollTimer = 0;
  var soundOn = false;

  /* Громкость роликов: 0…1, то есть 0.5 = 50 %. Меняется здесь.
     На iPhone Safari громкость программно не регулируется — там работает
     только кнопка громкости на самом устройстве. */
  var VOLUME = 0.4;

  function setVolume(video) {
    try {
      video.volume = VOLUME;
    } catch (error) {
      /* некоторые мобильные браузеры игнорируют установку громкости */
    }
  }

  function videoAt(i) {
    var card = cards[i];
    return card ? card.querySelector("video") : null;
  }

  function step() {
    var card = cards[0];
    if (!card) return 300;
    var gap = parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap) || 16;
    return card.getBoundingClientRect().width + gap;
  }

  /* ---------- Звук: один на всю ленту ---------- */
  function applySound() {
    cards.forEach(function (card) {
      var video = card.querySelector("video");
      if (!video) return;
      video.muted = !soundOn;
      setVolume(video);
    });

    if (soundToggle) {
      soundToggle.classList.toggle("is-on", soundOn);
      soundToggle.setAttribute("aria-pressed", String(soundOn));
      soundToggle.setAttribute("aria-label", soundOn
        ? "Выключить звук во всех видео"
        : "Включить звук во всех видео");
    }
  }

  if (soundToggle) {
    soundToggle.addEventListener("click", function () {
      soundOn = !soundOn;
      applySound();
    });
  }

  /* ---------- Индикаторы ---------- */
  function updateDots() {
    dots.forEach(function (dot, i) {
      dot.classList.toggle("is-active", i === index);
      dot.classList.toggle("is-done", i < index);
      var fill = dot.querySelector(".reel-dot__fill");
      if (fill) fill.style.transform = "scaleX(" + (i === index ? progress : i < index ? 1 : 0) + ")";
    });
  }

  var progress = 0;

  function toggleUI() {
    if (!toggle) return;
    toggle.classList.toggle("is-running", running);
    toggle.setAttribute("aria-label", running ? "Остановить показ" : "Смотреть ролики");
  }

  /* ---------- Показ ---------- */
  function scrollToIndex(i) {
    suppressScroll = true;
    track.scrollTo({ left: i * step(), behavior: "smooth" });
    window.setTimeout(function () { suppressScroll = false; }, 650);
  }

  function playIndex(i) {
    index = Math.max(0, Math.min(cards.length - 1, i));
    progress = 0;

    cards.forEach(function (card, j) {
      var video = card.querySelector("video");
      if (!video) return;
      if (j !== index) video.pause();
    });

    var video = videoAt(index);
    if (video) {
      video.currentTime = 0;
      video.muted = !soundOn;
      setVolume(video);
      video.loop = false;
      video.controls = false;
      var promise = video.play();
      if (promise && typeof promise.catch === "function") promise.catch(function () {});
    }

    updateDots();
    scrollToIndex(index);

    /* Заранее просим метаданные следующего ролика — переключение плавнее */
    var next = videoAt((index + 1) % cards.length);
    if (next) next.preload = "metadata";
  }

  function start() {
    if (running) return;
    running = true;
    userPaused = false;
    toggleUI();
    playIndex(index);
    cancelAnimationFrame(raf);
    tick();
  }

  function pauseSequence() {
    running = false;
    cancelAnimationFrame(raf);
    var video = videoAt(index);
    if (video) video.pause();
    toggleUI();
  }

  function stop() {
    userPaused = true;
    pauseSequence();
  }

  function tick() {
    if (!running) return;
    var video = videoAt(index);
    if (video && video.duration) {
      progress = Math.min(1, video.currentTime / video.duration);
      var dot = dots[index];
      var fill = dot && dot.querySelector(".reel-dot__fill");
      if (fill) fill.style.transform = "scaleX(" + progress + ")";
    }
    raf = requestAnimationFrame(tick);
  }

  if (toggle) {
    toggle.addEventListener("click", function () {
      if (running) stop();
      else start();
    });
  }

  /* Клик по точке — переход к ролику */
  dots.forEach(function (dot, i) {
    dot.addEventListener("click", function () {
      index = i;
      progress = 0;
      updateDots();
      if (running) playIndex(i);
      else scrollToIndex(i);
    });
  });

  /* Завершение ролика — следующий по кругу.
     Слушаем и ended, и timeupdate: в некоторых браузерах ended не приходит. */
  var advancing = false;

  function advanceFrom(i) {
    if (advancing) return;
    advancing = true;
    running = true;
    if (dots[i]) dots[i].classList.add("is-done");

    window.setTimeout(function () {
      advancing = false;
      if (!running) return;
      playIndex((i + 1) % cards.length);
    }, 220);
  }

  cards.forEach(function (card, i) {
    var video = card.querySelector("video");
    if (!video) return;

    video.addEventListener("ended", function () {
      if (!running || i !== index || advancing) return;
      advanceFrom(i);
    });

    video.addEventListener("timeupdate", function () {
      if (!running || i !== index || advancing) return;
      if (video.duration && video.currentTime >= video.duration - 0.12) advanceFrom(i);
    });
  });

  /* Ручная прокрутка ленты синхронизирует активный ролик */
  track.addEventListener("scroll", function () {
    window.clearTimeout(scrollTimer);
    scrollTimer = window.setTimeout(function () {
      if (suppressScroll) return;
      var i = Math.max(0, Math.min(cards.length - 1, Math.round(track.scrollLeft / step())));
      if (i === index) return;
      index = i;
      progress = 0;
      updateDots();
      if (running) playIndex(i);
    }, 150);
  });

  /* ---------- Автозапуск на телефоне ---------- */
  var mobile = window.matchMedia("(max-width: 899px)");
  var carousel = document.querySelector("[data-carousel]");

  if (carousel && "IntersectionObserver" in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          if (mobile.matches && !userPaused && !running) start();
        } else if (running) {
          pauseSequence();
        }
      });
    }, { threshold: 0.5 });

    observer.observe(carousel);
  }

  applySound();
  updateDots();
})();
