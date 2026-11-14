import { esc, flow, money, sleep } from './ui.js';

const redondear = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
export function calcularTicket(ticket) {
  const lineas = ticket.lineas.map((l) => ({ ...l, importe: redondear(l.cantidad * l.precio) }));
  const total = redondear(lineas.reduce((s, l) => s + l.importe, 0));
  const subtotal = redondear(total / 1.16);
  return { ...ticket, lineas, total, subtotal, iva: redondear(total - subtotal) };
}
export const TICKETS = [
  { proveedor: 'Ferretería El Clavo', fecha: '08/11/2026 13:42', pago: 'Efectivo', categoria: 'Mantenimiento', lineas: [
    { nombre: 'Cinta de aislar', cantidad: 3, precio: 18.50 },
    { nombre: 'Brocha 2"', cantidad: 1, precio: 45 },
    { nombre: 'Thinner 1 L', cantidad: 2, precio: 62 }
  ] },
  { proveedor: 'Servicio Las Palmas', fecha: '10/11/2026 08:15', pago: 'Tarjeta', categoria: 'Combustible', lineas: [
    { nombre: 'Magna', cantidad: 32.50, unidad: 'L', precio: 23.89 }
  ] },
  { proveedor: 'Fonda Doña Lupe', fecha: '11/11/2026 15:05', pago: 'Efectivo', categoria: 'Alimentos', lineas: [
    { nombre: 'Comida corrida', cantidad: 3, precio: 95 },
    { nombre: 'Agua de jamaica', cantidad: 3, precio: 25 },
    { nombre: 'Café de olla', cantidad: 2, precio: 20 }
  ] }
].map((ticket) => calcularTicket({ ...ticket, rfc: 'XAXX010101000' }));

export function initTicket(root) {
  const get = (s) => root.querySelector(`[data-${s}]`);
  const picker = get('picker'), stage = get('receipt'), fields = get('fields');
  const button = get('scan'), ledger = get('ledger'), steps = flow(get('flow'));
  let seleccionado = 0, busy = false;
  const registrados = new Set();
  const row = (k, label, value) => `<div class="receipt__row" data-k="${k}"><span>${esc(label)}</span><span>${esc(value)}</span></div>`;
  function renderLedger(nuevo) {
    ledger.innerHTML = `<thead><tr><th>Fecha</th><th>Proveedor</th><th>Categoría</th><th class="num">Total</th></tr></thead><tbody>${[...registrados].map((i) => {
      const t = TICKETS[i];
      return `<tr${i === nuevo ? ' class="is-new"' : ''}><td>${esc(t.fecha.split(' ')[0])}</td><td>${esc(t.proveedor)}</td><td>${esc(t.categoria)}</td><td class="num">${money(t.total)}</td></tr>`;
    }).join('')}<tr><td colspan="3">Total registrado</td><td class="num">${money([...registrados].reduce((s, i) => s + TICKETS[i].total, 0))}</td></tr></tbody>`;
  }
  function select(i) {
    if (busy) return;
    seleccionado = i;
    const t = TICKETS[i];
    [...picker.children].forEach((b, n) => b.setAttribute('aria-pressed', String(n === i)));
    steps.reset(); fields.innerHTML = '<p class="empty">Pulsa «Leer ticket».</p>';
    stage.innerHTML = `<div class="receipt"><div class="receipt__center"><div data-k="proveedor">${esc(t.proveedor)}</div><div data-k="rfc">RFC ${esc(t.rfc)}</div><div data-k="fecha">${esc(t.fecha)}</div></div><div class="receipt__sep"></div>${t.lineas.map((l, n) => row('concepto', `${l.nombre} · ${l.unidad ? l.cantidad.toFixed(2) : l.cantidad}${l.unidad ? ` ${l.unidad}` : ''} × ${money(l.precio)}`, money(l.importe)).replace('data-k="concepto"', `data-k="concepto" data-linea="${n}"`)).join('')}<div class="receipt__sep"></div>${row('subtotal', 'SUBTOTAL', money(t.subtotal))}${row('iva', 'IVA 16%', money(t.iva))}${row('total', 'TOTAL', money(t.total))}${row('pago', 'Pago', t.pago)}<div class="receipt__sep"></div><div class="receipt__center">GRACIAS POR SU COMPRA</div></div>`;
    button.disabled = registrados.has(i);
    button.textContent = registrados.has(i) ? 'Ya registrado' : 'Leer ticket';
  }
  TICKETS.forEach((t, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.textContent = t.proveedor;
    b.addEventListener('click', () => select(i)); picker.append(b);
  });
  button.addEventListener('click', async () => {
    if (busy || registrados.has(seleccionado)) return;
    busy = true; button.disabled = true;
    [...picker.children].forEach((b) => { b.disabled = true; });
    const t = TICKETS[seleccionado], receipt = stage.querySelector('.receipt');
    try {
      await steps.to(0); receipt.classList.add('is-scanning');
      await steps.to(1, 1200); await steps.to(2); fields.innerHTML = '';
      const principal = t.lineas.reduce((a, b) => a.importe >= b.importe ? a : b);
      const valores = [
        ['proveedor', 'Proveedor', t.proveedor], ['rfc', 'RFC', t.rfc], ['fecha', 'Fecha', t.fecha],
        ['concepto', 'Concepto principal', principal.nombre], ['subtotal', 'Subtotal', money(t.subtotal)],
        ['iva', 'IVA', money(t.iva)], ['total', 'Total', money(t.total)], ['pago', 'Forma de pago', t.pago]
      ];
      for (const [key, label, value] of valores) {
        receipt.querySelectorAll('.is-hit').forEach((el) => el.classList.remove('is-hit'));
        const selector = key === 'concepto' ? `[data-linea="${t.lineas.indexOf(principal)}"]` : `[data-k="${key}"]`;
        receipt.querySelector(selector).classList.add('is-hit');
        fields.insertAdjacentHTML('beforeend', `<dt>${esc(label)}</dt><dd>${esc(value)}</dd><span class="conf">98%</span>`);
        await sleep(220);
      }
      await steps.to(3);
      fields.insertAdjacentHTML('beforeend', `<dt>Categoría</dt><dd><span class="badge badge--signal">${esc(t.categoria)}</span></dd><span class="conf">98%</span>`);
      receipt.classList.remove('is-scanning');
      await steps.to(4); registrados.add(seleccionado); renderLedger(seleccionado); steps.done();
    } finally {
      receipt.classList.remove('is-scanning'); busy = false;
      [...picker.children].forEach((b) => { b.disabled = false; });
      button.disabled = registrados.has(seleccionado);
      button.textContent = button.disabled ? 'Ya registrado' : 'Leer ticket';
    }
  });
  select(0); renderLedger();
}
