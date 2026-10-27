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

  /* Одно видео за раз: запуск нового останавливает остальные */
  cards.forEach(function (card) {
    var video = card.querySelector("video");
    var playBtn = card.querySelector(".video-card__play");
    if (!video || !playBtn) return;

    playBtn.addEventListener("click", function () {
      cards.forEach(function (other) {
        var otherVideo = other.querySelector("video");
        if (otherVideo && otherVideo !== video) otherVideo.pause();
      });

      video.controls = true;
      var playing = video.play();
      if (playing && typeof playing.catch === "function") {
        playing.catch(function () { /* автоплей запрещён — останутся нативные кнопки */ });
      }
    });

    video.addEventListener("play", function () {
      card.classList.add("is-playing");
      video.controls = true;
    });

    video.addEventListener("ended", function () {
      card.classList.remove("is-playing");
      video.controls = false;
      video.currentTime = 0;
    });
  });
})();
