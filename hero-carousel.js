(() => {
  'use strict';
  const carousel = document.getElementById('campus-carousel');
  if (!carousel) return;

  const slides = Array.from(carousel.querySelectorAll('.campus-slide'));
  const indicators = Array.from(carousel.querySelectorAll('.campus-carousel-indicators button'));
  const previous = carousel.querySelector('.campus-carousel-prev');
  const next = carousel.querySelector('.campus-carousel-next');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const intervalMs = 6500;
  let activeIndex = 0;
  let timer = null;
  let resumeTimer = null;

  function showSlide(index) {
    activeIndex = (index + slides.length) % slides.length;
    slides.forEach((slide, i) => {
      const active = i === activeIndex;
      slide.classList.toggle('is-active', active);
      slide.setAttribute('aria-hidden', String(!active));
      if ('inert' in slide) slide.inert = !active;
    });
    indicators.forEach((button, i) => {
      const active = i === activeIndex;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    carousel.classList.remove('is-playing');
    void carousel.offsetWidth;
    if (!reducedMotion.matches && !document.hidden && !carousel.matches(':hover, :focus-within')) {
      carousel.classList.add('is-playing');
    }
  }

  function stopTimer() {
    if (timer) window.clearInterval(timer);
    timer = null;
    carousel.classList.remove('is-playing');
  }

  function startTimer() {
    stopTimer();
    if (reducedMotion.matches || document.hidden || carousel.matches(':hover, :focus-within')) return;
    carousel.classList.add('is-playing');
    timer = window.setInterval(() => showSlide(activeIndex + 1), intervalMs);
  }

  function manualMove(index) {
    showSlide(index);
    startTimer();
  }

  previous.addEventListener('click', () => manualMove(activeIndex - 1));
  next.addEventListener('click', () => manualMove(activeIndex + 1));
  indicators.forEach((button, index) => button.addEventListener('click', () => manualMove(index)));
  carousel.addEventListener('mouseenter', stopTimer);
  carousel.addEventListener('mouseleave', startTimer);
  carousel.addEventListener('focusin', stopTimer);
  carousel.addEventListener('focusout', event => {
    if (!carousel.contains(event.relatedTarget)) startTimer();
  });
  document.addEventListener('visibilitychange', () => document.hidden ? stopTimer() : startTimer());
  reducedMotion.addEventListener?.('change', startTimer);

  let touchStartX = 0;
  carousel.addEventListener('touchstart', event => {
    touchStartX = event.changedTouches[0].clientX;
  }, {passive:true});
  carousel.addEventListener('touchend', event => {
    const delta = event.changedTouches[0].clientX - touchStartX;
    if (Math.abs(delta) > 45) manualMove(activeIndex + (delta < 0 ? 1 : -1));
  }, {passive:true});

  showSlide(0);
  startTimer();
})();