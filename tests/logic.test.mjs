import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { interpretar, armarPedido, CATALOGO } from '../js/pedidos.js';
import { buscar, DOCUMENTOS, FRAGMENTOS, UMBRAL, resaltar } from '../js/rag.js';
import { normalize, words, stem, lev, STOP } from '../js/text.js';
import { esc, money, flow, sleep } from '../js/ui.js';
import { calcularTicket, TICKETS } from '../js/ticket.js';
import { CORREOS } from '../js/crm.js';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const presets = [...html.matchAll(/data-preset="([^"]+)"/g)].map((m) => m[1]);
const cantidades = (r) => Object.fromEntries(r.lineas.map((l) => [l.id, l.cantidad]));

test('los módulos de lógica se importan sin document ni window', () => {
  assert.equal(typeof document, 'undefined');
  assert.equal(typeof window, 'undefined');
  assert.equal(CORREOS.length, 3);
});
test('normalización, tokenización y raíces especificadas', () => {
  assert.equal(normalize('ÁÉÍÓÚ Ñ'), 'aeiou n');
  assert.deepEqual(words('¡Envíos $1,500!'), ['envios', '1', '500']);
  assert.deepEqual(words(''), []);
  assert.deepEqual(['envíos', 'entregas', 'paquetes', 'devoluciones'].map(stem), ['envi', 'entreg', 'paquet', 'devolucion']);
  assert.equal(stem('dos'), 'dos');
  assert.ok(STOP.has('cuanto'));
});
test('Levenshtein: sustitución, inserción, eliminación y vacíos', () => {
  assert.equal(lev('vasos', 'basos'), 1);
  assert.equal(lev('kitten', 'sitting'), 3);
  assert.equal(lev('', 'abc'), 3);
  assert.equal(lev('abc', ''), 3);
  assert.equal(lev('igual', 'igual'), 0);
});
test('preset 1: cantidades, entrega, pago y cliente', () => {
  const r = interpretar(presets[0]);
  assert.deepEqual(cantidades(r), { vaso: 3, plato: 2, tenedor: 1 });
  assert.deepEqual(r.entrega, { dia: 'mañana', hora: '5:00 p. m.' });
  assert.equal(r.pago, 'transferencia');
  assert.equal(r.cliente, 'Juan');
  assert.ok(r.lineas.every((l) => !l.asumida));
});
test('preset 2: faltas, media docena, alias consecutivos y urgencia', () => {
  const r = interpretar(presets[1]);
  assert.deepEqual(cantidades(r), { contenedor: 10, servilleta: 6, bolsa: 2 });
  assert.equal(r.entrega.dia, 'hoy');
  assert.equal(r.urgente, true);
  assert.deepEqual(r.desconocidos, []);
});
test('preset 3: basos, producto desconocido, viernes y factura', () => {
  const r = interpretar(presets[2]);
  assert.deepEqual(cantidades(r), { vaso: 4, cuchara: 3 });
  assert.deepEqual(r.desconocidos, ['chicles']);
  assert.equal(r.entrega.dia, 'viernes');
  assert.equal(r.factura, true);
});
test('docenas y cantidades en palabras', () => {
  for (const [texto, valor] of [['media docena', 6], ['2 docenas', 24], ['una docena', 12], ['un docena', 12], ['docenas', 12], ['quince', 15], ['cien', 100]]) {
    assert.equal(interpretar(`${texto} de platos`).lineas[0].cantidad, valor, texto);
  }
});
test('sumas, cantidades asumidas y límites de búsqueda hacia atrás', () => {
  assert.deepEqual(cantidades(interpretar('2 vasos y 3 vasos')), { vaso: 5 });
  const r = interpretar('3 vasos y platos');
  assert.equal(r.lineas[1].cantidad, 1);
  assert.equal(r.lineas[1].asumida, true);
  assert.equal(interpretar('5 por favor vasos').lineas[0].cantidad, 1);
  assert.equal(interpretar('4 paquetes de los vasos').lineas[0].cantidad, 4);
  assert.equal(interpretar('4 paquetes de los nuevos vasos').lineas[0].cantidad, 1);
});
test('coincidencia exacta tiene prioridad y caso no es vaso', () => {
  assert.deepEqual(cantidades(interpretar('2 contenedores y 3 tenedores')), { contenedor: 2, tenedor: 3 });
  assert.equal(interpretar('un caso').lineas.length, 0);
  assert.deepEqual(cantidades(interpretar('3 vasos termicos y 2 bolsa camiseta')), { vaso: 3, bolsa: 2 });
});
test('desconocidos y horas no se confunden', () => {
  assert.deepEqual(interpretar('2 cajas de chicles y 3 cajas de chicles').desconocidos, ['chicles']);
  assert.deepEqual(interpretar('2 vasos mañana a las 5 pm').desconocidos, []);
  assert.deepEqual(interpretar('a las 10 horas').desconocidos, []);
});
test('entregas, horarios, pagos y metadatos opcionales', () => {
  assert.deepEqual(interpretar('vasos pasado mañana a las 10:30').entrega, { dia: 'pasado mañana', hora: '10:30 a. m.' });
  assert.equal(interpretar('vasos miércoles a las 13').entrega.hora, '13:00 h');
  assert.equal(interpretar('vasos sábado').entrega.dia, 'sábado');
  assert.equal(interpretar('soy la ana, vasos efectivo').cliente, 'Ana');
  assert.equal(interpretar('vasos tarjeta').pago, 'tarjeta');
  assert.equal(interpretar('vasos rápido').urgente, true);
  assert.deepEqual(interpretar('').lineas, []);
});
test('pedido calcula subtotal, envío y respuesta sin mutar argumentos', () => {
  const r = interpretar(presets[0]);
  const antes = JSON.stringify([r, CATALOGO]);
  const p = armarPedido(r, CATALOGO, 'PED-1043');
  assert.equal(p.subtotal, 326);
  assert.equal(p.envio, 120);
  assert.equal(p.total, 446);
  assert.match(p.respuesta, /¡Listo, Juan! Tu pedido PED-1043:/);
  assert.match(p.respuesta, /Total: \$446\.00/);
  assert.match(p.respuesta, /mañana a las 5:00 p\. m\./);
  assert.equal(JSON.stringify([r, CATALOGO]), antes);
});
test('envío gratis desde exactamente $1,500', () => {
  assert.equal(armarPedido(interpretar('50 popotes'), CATALOGO, 'X').envio, 0);
  assert.equal(armarPedido(interpretar('49 popotes'), CATALOGO, 'X').envio, 120);
  assert.equal(armarPedido(interpretar('100 popotes'), CATALOGO, 'X').envio, 0);
});
test('faltantes, desconocidos, supuestos y entrega por confirmar', () => {
  const p = armarPedido(interpretar('vasos y 2 chicles'), { vaso: 0 }, 'PED-9');
  assert.equal(p.lineas[0].faltante, 0);
  assert.match(p.respuesta, /^¡Listo!/);
  assert.match(p.respuesta, /Ojo: no manejamos chicles\./);
  assert.match(p.respuesta, /Puse 1 de Vaso/);
  assert.match(p.respuesta, /solo tengo 0; te mando esos/);
  assert.match(p.respuesta, /¿Para cuándo lo necesitas\?/);
  assert.equal(armarPedido(interpretar('3 vasos'), { vaso: { stock: 2 } }, 'X').lineas[0].faltante, 2);
});

for (const [pregunta, esperado] of [
  ['¿Cuánto cuesta el envío?', '$120'],
  ['¿Puedo devolver algo que ya abrí?', 'abierto'],
  ['¿Me dan descuento si compro 15 paquetes?', '8%'],
  ['¿Abren en domingo?', 'cerrada']
]) test(`RAG: ${pregunta}`, () => {
  const r = buscar(pregunta);
  assert.ok(r.respuesta);
  assert.ok(r.respuesta.texto.includes(esperado));
  assert.ok(r.fragmentos[0].score >= UMBRAL);
  assert.ok(r.terminos instanceof Set);
});
test('RAG: factura con fuente trazable', () => {
  const { respuesta } = buscar('¿Cómo pido factura?');
  assert.equal(respuesta.fuente.archivo, 'pagos-y-facturacion.pdf');
  assert.ok(respuesta.fuente.fragmentos.length);
  assert.equal(respuesta.fuente.titulo, 'Pagos y facturación');
});
for (const pregunta of ['¿Venden pizzas?', '¿Tienen estacionamiento?', '', '<script>alert("x")</script>']) {
  test(`RAG sin respuesta: ${pregunta}`, () => assert.equal(buscar(pregunta).respuesta, null));
}
test('fragmentos íntegros, scores ordenados y reglas de selección', () => {
  assert.equal(DOCUMENTOS.length, 6);
  assert.equal(FRAGMENTOS.length, 24);
  for (const doc of DOCUMENTOS) assert.equal(FRAGMENTOS.filter((f) => f.doc === doc).map((f) => f.texto).join(' '), doc.texto);
  const { fragmentos, respuesta } = buscar('¿Me dan descuento si compro 15 paquetes?');
  assert.equal(fragmentos.length, 3);
  assert.ok(fragmentos.every((f, i) => f.score > 0 && (!i || f.score <= fragmentos[i - 1].score)));
  assert.deepEqual(respuesta.fuente.fragmentos, [fragmentos[0].n, fragmentos[1].n]);
  assert.ok(fragmentos[1].score >= 0.6 * fragmentos[0].score);
});
test('HTML escapado y resaltado seguro con acentos', () => {
  assert.equal(esc('<img title="x">&\''), '&lt;img title=&quot;x&quot;&gt;&amp;&#39;');
  assert.equal(resaltar('<b>Envíos</b> & "hola"', new Set(['envi'])), '&lt;b&gt;<mark>Envíos</mark>&lt;/b&gt; &amp; &quot;hola&quot;');
  assert.equal(money(1234.5), '$1,234.50');
});
test('tickets: importes, IVA incluido y concepto principal', () => {
  assert.deepEqual(TICKETS.map((t) => t.total), [224.5, 776.43, 400]);
  assert.deepEqual(TICKETS.map((t) => t.subtotal), [193.53, 669.34, 344.83]);
  assert.deepEqual(TICKETS.map((t) => t.iva), [30.97, 107.09, 55.17]);
  const input = { lineas: [{ nombre: 'Ejemplo', cantidad: 3, precio: 0.1 }] };
  assert.equal(calcularTicket(input).total, 0.3);
  assert.equal(input.lineas[0].importe, undefined);
});
test('flow: activo, anteriores, fallo, final y reinicio', async () => {
  const items = Array.from({ length: 3 }, () => {
    const classes = new Set();
    return { classes, classList: { add: (...cs) => cs.forEach((c) => classes.add(c)), remove: (...cs) => cs.forEach((c) => classes.delete(c)) } };
  });
  const steps = flow({ querySelectorAll: () => items });
  await steps.to(1, 0);
  assert.deepEqual(items.map((i) => [...i.classes]), [['is-done'], ['is-active'], []]);
  steps.fail(1);
  assert.deepEqual(items.map((i) => [...i.classes]), [['is-done'], ['is-fail'], []]);
  steps.done(); assert.ok(items.every((i) => i.classes.has('is-done')));
  steps.reset(); assert.ok(items.every((i) => i.classes.size === 0));
  await sleep(0);
});
