// Esfera de elipses que gira mientras el sistema "piensa".
// Cada paso del flujo tiene su color; al avanzar, se encienden las piezas de ese paso.

export const STEP_COLORS = ['#2f7fd8', '#e2453c', '#f28c28', '#f2c230', '#be185d', '#1fa37a'];

const IDLE = [160, 140, 149];
const COUNT = 95;

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function normalize3([x, y, z]) {
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
}

function cross([ax, ay, az], [bx, by, bz]) {
  return [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
}

function rotate([x, y, z], ry, rx) {
  const cy = Math.cos(ry), sy = Math.sin(ry);
  const x1 = x * cy + z * sy;
  const z1 = -x * sy + z * cy;
  const cx = Math.cos(rx), sx = Math.sin(rx);
  return [x1, y * cx - z1 * sx, y * sx + z1 * cx];
}

function buildPieces(groups) {
  const r = rand(7);
  const golden = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: COUNT }, (_, i) => {
    const y = 1 - ((i + 0.5) / COUNT) * 2;
    const rad = Math.sqrt(1 - y * y);
    const th = golden * i + r() * 0.6;
    const n = normalize3([Math.cos(th) * rad, y, Math.sin(th) * rad]);
    const ring = r() < 0.72;
    const big = r() < 0.12;
    return {
      n,
      t: normalize3(cross(n, [r() - 0.5, r() - 0.5, r() - 0.5])),
      ring,
      size: ring ? (big ? 0.16 + r() * 0.12 : 0.035 + r() * 0.09) : 0.06 + r() * 0.08,
      width: 0.8 + r() * 1.1,
      group: i % groups
    };
  });
}

export function createOrb(canvas, colors) {
  const ctx = canvas.getContext('2d');
  const groups = colors.length;
  const pieces = buildPieces(groups);
  const rgb = colors.map(hexToRgb);
  const levels = new Array(groups).fill(0);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let upto = 0;
  let active = -1;
  let failing = -1;
  let running = false;
  let angle = 0.6;
  let speed = 0.25;
  let visible = true;
  let frame = 0;
  let last = performance.now();

  function size() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth || 96;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(w * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function target(g, t) {
    if (g === failing) return 0.35 + 0.65 * (Math.sin(t * 9) > 0 ? 1 : 0);
    if (g < upto) return 1;
    if (g === active) return 0.55 + 0.45 * Math.sin(t * 6);
    return 0;
  }

  function draw(t, dt) {
    const w = canvas.clientWidth || 96;
    const R = w * 0.44;
    const c = w / 2;
    speed += ((running ? 1.4 : 0.25) - speed) * Math.min(1, dt * 3);
    if (!reduce) angle += speed * dt;
    const tilt = 0.35 + (reduce ? 0 : Math.sin(t * 0.4) * 0.12);
    for (let g = 0; g < groups; g++) levels[g] += (target(g, t) - levels[g]) * Math.min(1, dt * 3.5);

    ctx.clearRect(0, 0, w, w);
    const projected = pieces.map((p) => ({ p, n: rotate(p.n, angle, tilt), tv: rotate(p.t, angle, tilt) }));
    projected.sort((a, b) => a.n[2] - b.n[2]);

    for (const { p, n, tv } of projected) {
      const lvl = levels[p.group];
      const col = rgb[p.group].map((v, k) => Math.round(IDLE[k] + (v - IDLE[k]) * lvl));
      const back = n[2] < 0;
      const alpha = (0.22 + 0.78 * lvl) * (back ? 0.3 : 1);
      ctx.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${alpha.toFixed(3)})`;
      ctx.lineWidth = Math.max(0.6, p.width * (w / 190) * (1 + 0.6 * lvl));
      const x = c + n[0] * R;
      const y = c - n[1] * R;
      ctx.beginPath();
      if (p.ring) {
        const a = p.size * R;
        ctx.ellipse(x, y, Math.max(0.3, a * Math.abs(n[2])), a, Math.atan2(-n[1], n[0]), 0, Math.PI * 2);
      } else {
        const l = p.size * R;
        ctx.moveTo(x - tv[0] * l, y + tv[1] * l);
        ctx.lineTo(x + tv[0] * l, y - tv[1] * l);
      }
      ctx.stroke();
    }
  }

  function loop(now) {
    frame = 0;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    draw(now / 1000, dt);
    if (visible && !document.hidden) frame = requestAnimationFrame(loop);
  }

  function kick() {
    if (!frame && visible) { last = performance.now(); frame = requestAnimationFrame(loop); }
  }

  size();
  window.addEventListener('resize', () => { size(); kick(); });
  document.addEventListener('visibilitychange', kick);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; kick(); }).observe(canvas);
  }
  kick();

  function set(next) {
    ({ upto, active, failing, running } = { upto: 0, active: -1, failing: -1, running: false, ...next });
    kick();
  }

  return {
    to(i) { set({ upto: i, active: i, running: true }); },
    done() { set({ upto: groups }); },
    fail(i) { set({ upto: i, failing: i }); },
    reset() { set({}); }
  };
}
