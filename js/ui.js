import { createOrb, STEP_COLORS } from './orb.js';

const STEP_MS = 1100;

// Las pausas marcan el ritmo de cada paso; no son animación, así que se respetan
// aunque el sistema tenga "reducir movimiento" activado.
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

export function money(value) {
  return Number(value).toLocaleString('es-MX', {
    style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2
  });
}

// En el navegador, cada flujo lleva su esfera: un color por paso.
function attachOrb(element, items) {
  if (typeof document === 'undefined' || !element.parentElement) return null;
  const colors = items.map((_, i) => STEP_COLORS[i % STEP_COLORS.length]);
  items.forEach((item, i) => item.style.setProperty('--c', colors[i]));
  const status = document.createElement('div');
  status.className = 'status';
  const canvas = document.createElement('canvas');
  canvas.className = 'orb';
  canvas.setAttribute('aria-hidden', 'true');
  element.replaceWith(status);
  status.append(canvas, element);
  return createOrb(canvas, colors);
}

export function flow(element) {
  const items = [...element.querySelectorAll('li')];
  const orb = attachOrb(element, items);
  const clear = (item) => item.classList.remove('is-active', 'is-done', 'is-fail');
  return {
    reset() { items.forEach(clear); orb?.reset(); },
    // Cada paso dura al menos STEP_MS para que se vea la esfera encendiendo su color.
    async to(index, ms = STEP_MS) {
      items.forEach((item, i) => {
        clear(item);
        if (i < index) item.classList.add('is-done');
        if (i === index) item.classList.add('is-active');
      });
      orb?.to(index);
      await sleep(orb ? Math.max(ms, STEP_MS) : ms);
    },
    done() {
      items.forEach((item) => { clear(item); item.classList.add('is-done'); });
      orb?.done();
    },
    fail(index) {
      items.forEach((item, i) => {
        clear(item);
        if (i < index) item.classList.add('is-done');
        if (i === index) item.classList.add('is-fail');
      });
      orb?.fail(index);
    }
  };
}
