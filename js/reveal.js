// Entrada suave, como la versión 4 del sitio de Brittany Chiang:
// la portada aparece línea por línea y el resto se revela al hacer scroll.
// Uso: <script src="js/reveal.js" data-hero="selectores" data-scroll="selectores"></script>
// Con "reducir movimiento" activado solo se desvanece, sin desplazarse.
(function () {
  var script = document.currentScript;
  var root = document.documentElement;
  var STEP = 110; // ms entre cada línea

  var style = document.createElement('style');
  style.textContent =
    '.rv{opacity:0;transform:translateY(18px);transition:opacity .7s cubic-bezier(.645,.045,.355,1),transform .7s cubic-bezier(.645,.045,.355,1);transition-delay:var(--rv-d,0ms)}' +
    '.rv.is-in{opacity:1;transform:none}' +
    '@media (prefers-reduced-motion: reduce){.rv{transform:none;transition:opacity .6s ease!important;transition-delay:var(--rv-d,0ms)!important}}';
  document.head.appendChild(style);

  function pick(attr) {
    var sel = script && script.getAttribute(attr);
    return sel ? Array.prototype.slice.call(document.querySelectorAll(sel)) : [];
  }

  var hero = pick('data-hero');
  var later = pick('data-scroll').filter(function (el) { return hero.indexOf(el) === -1; });

  hero.concat(later).forEach(function (el) { el.classList.add('rv'); });

  // Portada: una línea tras otra.
  // setTimeout y no requestAnimationFrame: si la pestaña abre en segundo plano,
  // el texto no se queda invisible esperando a que se pinte.
  setTimeout(function () {
    hero.forEach(function (el, i) {
      el.style.setProperty('--rv-d', 150 + i * STEP + 'ms');
      el.classList.add('is-in');
    });
  }, 30);

  // Resto: se revela al entrar en pantalla; si entran varias juntas, en cascada.
  // Se revisa con scroll y con un temporizador corto: así nunca se queda texto
  // invisible aunque el navegador se salte un evento.
  var pending = later.slice();

  function check() {
    if (!pending.length) return;
    var limit = window.innerHeight * 0.92;
    var shown = 0;
    pending = pending.filter(function (el) {
      if (el.getBoundingClientRect().top > limit) return true;
      var d = shown++ * STEP;
      el.style.setProperty('--rv-d', d + 'ms');
      el.classList.add('is-in');
      // Al terminar, quita el retraso para que el hover no espere.
      setTimeout(function () { el.style.removeProperty('--rv-d'); }, 900 + d);
      return false;
    });
    if (!pending.length) clearInterval(timer);
  }

  var timer = setInterval(check, 200);
  addEventListener('scroll', check, { passive: true });
  addEventListener('resize', check);
  setTimeout(check, 30);
  root.classList.add('has-reveal');
})();
