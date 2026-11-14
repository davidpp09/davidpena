import { lev, normalize } from './text.js';
import { esc, flow, money } from './ui.js';

export const CATALOGO = [
  { id: 'vaso', nombre: 'Vaso térmico 16 oz', unidad: 'paq. 25', precio: 68, stock: 140, alias: ['vaso', 'vasos', 'termico', 'termicos', 'unicel'] },
  { id: 'plato', nombre: 'Plato pastelero', unidad: 'paq. 50', precio: 42, stock: 90, alias: ['plato', 'platos', 'pastelero', 'pasteleros'] },
  { id: 'contenedor', nombre: 'Contenedor 1 división', unidad: 'paq. 25', precio: 95, stock: 60, alias: ['contenedor', 'contenedores', 'charola', 'charolas'] },
  { id: 'tenedor', nombre: 'Tenedor desechable', unidad: 'paq. 100', precio: 38, stock: 120, alias: ['tenedor', 'tenedores'] },
  { id: 'cuchara', nombre: 'Cuchara desechable', unidad: 'paq. 100', precio: 38, stock: 110, alias: ['cuchara', 'cucharas'] },
  { id: 'servilleta', nombre: 'Servilleta', unidad: 'paq. 500', precio: 55, stock: 75, alias: ['servilleta', 'servilletas'] },
  { id: 'bolsa', nombre: 'Bolsa camiseta mediana', unidad: 'kg', precio: 48, stock: 200, alias: ['bolsa', 'bolsas', 'camiseta'] },
  { id: 'popote', nombre: 'Popote', unidad: 'paq. 250', precio: 30, stock: 80, alias: ['popote', 'popotes'] }
];

const NUMEROS = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, quince: 15, veinte: 20, treinta: 30, cuarenta: 40, cincuenta: 50, cien: 100 };
const RELLENO = new Set(['paquete', 'paquetes', 'paq', 'caja', 'cajas', 'kilo', 'kilos', 'kg', 'pieza', 'piezas', 'pza', 'pzas', 'de', 'del', 'los', 'las', 'el', 'la', 'mas', 'y', 'unos', 'unas']);
const NO_DESCONOCIDO = new Set(['pm', 'am', 'oz', 'hrs', 'horas', 'hora', 'dias', 'dia', 'min', 'tarde', 'manana', 'noche']);

function matchProducto(token) {
  const exacto = CATALOGO.find((producto) => producto.alias.includes(token));
  if (exacto) return exacto;
  for (const producto of CATALOGO) {
    for (const alias of producto.alias) {
      if (token === alias) return producto;
      const limite = alias.length >= 8 ? 2 : 1;
      if (token.length >= 5 && Math.abs(token.length - alias.length) <= 2 && lev(token, alias) <= limite) return producto;
    }
  }
  return null;
}

function numero(token) {
  if (/^\d+$/.test(token)) return Number(token);
  return NUMEROS[token] ?? null;
}

export function interpretar(texto) {
  let normal = normalize(texto);
  normal = normal.replace(/\bmedia docena\b/g, '6');
  normal = normal.replace(/\b(\d+) docenas?\b/g, (_, n) => String(Number(n) * 12));
  normal = normal.replace(/\b(?:una|un) docena\b/g, '12').replace(/\bdocenas?\b/g, '12');
  const tokens = normal.match(/[a-z0-9]+/g) || [];
  const usados = new Set();
  const lineas = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const producto = matchProducto(tokens[i]);
    if (!producto) continue;
    if (i > 0 && matchProducto(tokens[i - 1])?.id === producto.id) continue;
    let cantidad = null;
    for (let j = i - 1; j >= Math.max(0, i - 4); j -= 1) {
      if (matchProducto(tokens[j])) break;
      const valor = numero(tokens[j]);
      if (valor !== null && !usados.has(j)) { cantidad = valor; usados.add(j); break; }
      if (!RELLENO.has(tokens[j])) break;
    }
    const asumida = cantidad === null;
    cantidad ??= 1;
    const existente = lineas.find((linea) => linea.id === producto.id);
    if (existente) { existente.cantidad += cantidad; existente.asumida ||= asumida; }
    else lineas.push({ id: producto.id, nombre: producto.nombre, unidad: producto.unidad, precio: producto.precio, cantidad, asumida });
  }
  const desconocidos = [];
  for (let i = 0; i < tokens.length; i += 1) {
    if (!/^\d+$/.test(tokens[i]) || usados.has(i) || ['a', 'las', 'la', 'alas'].includes(tokens[i - 1])) continue;
    for (let j = i + 1; j <= Math.min(tokens.length - 1, i + 3); j += 1) {
      const token = tokens[j];
      if (RELLENO.has(token)) continue;
      if (!matchProducto(token) && numero(token) === null && !NO_DESCONOCIDO.has(token) && token.length > 2 && !desconocidos.includes(token)) desconocidos.push(token);
      break;
    }
  }
  const dias = { lunes: 'lunes', martes: 'martes', miercoles: 'miércoles', jueves: 'jueves', viernes: 'viernes', sabado: 'sábado', domingo: 'domingo' };
  let dia = null;
  if (/\bpasado manana\b/.test(normal)) dia = 'pasado mañana';
  else if (/\bhoy\b/.test(normal)) dia = 'hoy';
  else if (/\bmanana\b/.test(normal)) dia = 'mañana';
  else dia = Object.entries(dias).find(([key]) => new RegExp(`\\b${key}\\b`).test(normal))?.[1] ?? null;
  const horaMatch = normal.match(/\ba\s*las\s*(\d{1,2})(?::(\d{2}))?/);
  let hora = null;
  if (horaMatch) {
    const h = Number(horaMatch[1]);
    const minutos = horaMatch[2] || '00';
    hora = h <= 7 ? `${h}:${minutos} p. m.` : h <= 11 ? `${h}:${minutos} a. m.` : `${h}:${minutos} h`;
  }
  const pago = ['transferencia', 'efectivo', 'tarjeta'].find((tipo) => normal.includes(tipo)) ?? null;
  const clienteMatch = normal.match(/\bsoy (?:el |la )?([a-z]+)/);
  const cliente = clienteMatch ? clienteMatch[1][0].toUpperCase() + clienteMatch[1].slice(1) : null;
  return { lineas, desconocidos, entrega: { dia, hora }, pago, factura: normal.includes('factura'), cliente, urgente: /\b(urge|urgen|urgente|rapido|hoy)\b/.test(normal) };
}

export function armarPedido(resultado, inventario, folio) {
  const stockDe = (id) => {
    if (Array.isArray(inventario)) return inventario.find((item) => item.id === id)?.stock ?? 0;
    const value = inventario?.[id];
    return typeof value === 'object' ? value.stock : Number(value ?? 0);
  };
  const lineas = resultado.lineas.map((linea) => {
    const stock = stockDe(linea.id);
    return { ...linea, ...(linea.cantidad > stock ? { faltante: stock } : {}) };
  });
  const subtotal = lineas.reduce((suma, linea) => suma + linea.cantidad * linea.precio, 0);
  const envio = subtotal >= 1500 ? 0 : 120;
  const saludo = resultado.cliente ? `¡Listo, ${resultado.cliente}!` : '¡Listo!';
  const detalle = lineas.map((linea) => `• ${linea.cantidad} × ${linea.nombre}`).join('\n');
  const envioTexto = envio ? `envío incluido ${money(envio)}` : 'envío gratis';
  const { dia, hora } = resultado.entrega;
  const cuando = /^(hoy|mañana|pasado mañana)$/.test(dia) ? dia : `el ${dia}`;
  const entrega = dia
    ? `Te lo entregamos ${cuando}${hora ? ` a las ${hora}` : ''}`.replace(/\.?$/, '.')
    : '¿Para cuándo lo necesitas?';
  const avisos = [];
  if (resultado.desconocidos.length) avisos.push(`Ojo: no manejamos ${resultado.desconocidos.join(', ')}.`);
  lineas.filter((linea) => linea.asumida).forEach((linea) => avisos.push(`Puse 1 de ${linea.nombre} porque no me dijiste cuántos; ¿así está bien?`));
  lineas.filter((linea) => 'faltante' in linea).forEach((linea) => avisos.push(`De ${linea.nombre} solo tengo ${linea.faltante}; te mando esos.`));
  const respuesta = `${saludo} Tu pedido ${folio}:\n${detalle}\nTotal: ${money(subtotal + envio)} (${envioTexto})\n${entrega}${avisos.length ? `\n${avisos.join('\n')}` : ''}`;
  return { ...resultado, lineas, folio, subtotal, envio, total: subtotal + envio, respuesta };
}

export function initPedidos(root) {
  const stepper = flow(root.querySelector('[data-flow]'));
  const chat = root.querySelector('[data-chat]');
  const form = root.querySelector('[data-form]');
  const input = form.querySelector('textarea');
  const out = root.querySelector('[data-out]');
  const invTable = root.querySelector('[data-inv]');
  let inventario = CATALOGO.map((item) => ({ ...item, inicial: item.stock }));
  let siguienteFolio = 1043;
  let busy = false;
  const addMessage = (kind, text, extra = '') => {
    const node = document.createElement('div');
    node.className = `msg msg--${kind}${extra ? ` ${extra}` : ''}`;
    node.innerHTML = esc(text);
    chat.append(node); chat.scrollTop = chat.scrollHeight;
    return node;
  };
  const renderInv = (changed = new Set()) => {
    invTable.innerHTML = `<thead><tr><th>Producto</th><th>Existencia</th><th class="num">Cant.</th></tr></thead><tbody>${inventario.map((item) => {
      const pct = Math.max(0, item.stock / item.inicial * 100);
      return `<tr${changed.has(item.id) ? ' class="is-changed"' : ''}><td>${esc(item.nombre)}</td><td><div class="stock"><span class="stock__bar"><i${pct < 20 ? ' class="low"' : ''} style="width:${pct}%"></i></span></div></td><td class="num">${item.stock}</td></tr>`;
    }).join('')}</tbody>`;
  };
  const renderOrder = (pedido) => {
    const notes = [];
    pedido.desconocidos.forEach((name) => notes.push(`No manejamos ${name}.`));
    pedido.lineas.filter((line) => line.asumida).forEach((line) => notes.push(`Cantidad asumida: 1 de ${line.nombre}.`));
    out.innerHTML = `<div class="order"><div class="order__head"><span class="order__id">${esc(pedido.folio)}</span><span class="badge${pedido.urgente ? ' badge--signal' : ''}">${pedido.urgente ? 'Urgente' : 'Nuevo'}</span></div><table class="table"><thead><tr><th>Cant.</th><th>Producto</th><th>Unidad</th><th class="num">Importe</th></tr></thead><tbody>${pedido.lineas.map((line) => `<tr><td>${line.cantidad}</td><td>${esc(line.nombre)}${'faltante' in line ? ` <span class="badge badge--warn">solo ${line.faltante}</span>` : ''}</td><td>${esc(line.unidad)}</td><td class="num">${money(line.cantidad * line.precio)}</td></tr>`).join('')}</tbody></table><div class="order__meta"><span><b>Cliente:</b> ${esc(pedido.cliente || 'No indicado')}</span><span><b>Entrega:</b> ${esc([pedido.entrega.dia, pedido.entrega.hora].filter(Boolean).join(' · ') || 'Por confirmar')}</span><span><b>Pago:</b> ${esc(pedido.pago || 'Por confirmar')}</span><span><b>Factura:</b> ${pedido.factura ? 'Sí' : 'No'}</span></div><div class="order__total"><span>Subtotal</span><span>${money(pedido.subtotal)}</span></div><div class="order__total"><span>Envío</span><span>${pedido.envio ? money(pedido.envio) : 'Gratis'}</span></div><div class="order__total"><span>Total</span><span>${money(pedido.total)}</span></div></div>${notes.length ? `<ul class="notes">${notes.map((note) => `<li>${esc(note)}</li>`).join('')}</ul>` : ''}`;
  };
  const submit = async () => {
    const text = input.value.trim();
    if (busy || !text) return;
    busy = true; [...form.elements].forEach((el) => { el.disabled = true; });
    try {
    addMessage('user', text); input.value = '';
    await stepper.to(0); const typing = addMessage('typing', 'escribiendo…'); await stepper.to(1);
    const result = interpretar(text);
    if (!result.lineas.length) {
      stepper.fail(1); typing.remove();
      addMessage('bot', 'Perdón, no identifiqué productos. Manejamos vasos, platos, contenedores, cubiertos, servilletas, bolsas y popotes. ¿Qué y cuántos te mando?');
      out.innerHTML = '<p class="empty">No encontré productos del catálogo en el mensaje.</p>';
    } else {
      await stepper.to(2); await stepper.to(3);
      const folio = `PED-${siguienteFolio++}`;
      const pedido = armarPedido(result, inventario, folio); renderOrder(pedido);
      await stepper.to(4);
      const changed = new Set(pedido.lineas.map((line) => line.id));
      pedido.lineas.forEach((line) => { const item = inventario.find((entry) => entry.id === line.id); item.stock = Math.max(0, item.stock - line.cantidad); });
      renderInv(changed); await stepper.to(5); typing.remove(); addMessage('bot', pedido.respuesta); stepper.done();
    }
    } finally {
      [...form.elements].forEach((el) => { el.disabled = false; });
      busy = false; input.focus();
    }
  };
  root.querySelectorAll('[data-preset]').forEach((button) => button.addEventListener('click', () => { if (!busy) { input.value = button.dataset.preset; input.focus(); } }));
  form.addEventListener('submit', (event) => { event.preventDefault(); submit(); });
  input.addEventListener('keydown', (event) => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); if (!busy) form.requestSubmit(); } });
  root.querySelector('[data-reset]').addEventListener('click', () => { if (!busy) { inventario = CATALOGO.map((item) => ({ ...item, inicial: item.stock })); siguienteFolio = 1043; stepper.reset(); renderInv(); } });
  renderInv();
}
