import { words, stem, STOP } from './text.js';
import { esc, flow } from './ui.js';

export const DOCUMENTOS = [
  { archivo: 'envios.pdf', titulo: 'Política de envíos', texto: 'Entregamos en toda la zona metropolitana de lunes a sábado. Los pedidos confirmados antes de las 2 de la tarde se entregan al día siguiente. El envío es gratis en pedidos de $1,500 o más; en pedidos menores cuesta $120. No hacemos entregas los domingos ni días festivos.' },
  { archivo: 'devoluciones.pdf', titulo: 'Devoluciones y cambios', texto: 'Aceptamos devoluciones dentro de los 7 días posteriores a la entrega si el producto llega dañado o no corresponde al pedido. El producto debe estar en su empaque original. El reembolso se hace por el mismo medio de pago en un plazo de 3 a 5 días hábiles. No se aceptan devoluciones de producto abierto por motivos de higiene.' },
  { archivo: 'pagos-y-facturacion.pdf', titulo: 'Pagos y facturación', texto: 'Aceptamos transferencia, efectivo contra entrega y tarjeta de débito o crédito con terminal móvil. Para facturar, envía tu constancia de situación fiscal por WhatsApp el mismo día de la compra. Las facturas se timbran en un plazo de 24 horas. Los clientes frecuentes pueden pagar a crédito de 15 días después de 3 meses comprando con nosotros.' },
  { archivo: 'mayoreo.pdf', titulo: 'Precios de mayoreo', texto: 'A partir de 10 paquetes del mismo producto aplica un 8% de descuento. A partir de 30 paquetes del mismo producto el descuento es del 12%. Los descuentos no se acumulan con las promociones del mes. Los pedidos de más de 100 paquetes se cotizan directamente con ventas.' },
  { archivo: 'horarios.pdf', titulo: 'Horarios y contacto', texto: 'La sucursal abre de lunes a viernes de 8 a 18 h y los sábados de 9 a 14 h. Los domingos la sucursal permanece cerrada. El WhatsApp de pedidos responde de 7 a 21 h todos los días. Las quejas se atienden por el mismo WhatsApp con el área de calidad.' },
  { archivo: 'productos.pdf', titulo: 'Ficha de productos', texto: 'Los vasos térmicos son de unicel y conservan la temperatura de bebidas calientes. Los contenedores de una división se pueden calentar en microondas un máximo de 2 minutos. Las bolsas camiseta se venden por kilo y un kilo trae alrededor de 100 bolsas medianas. Los popotes se venden en paquetes de 250 piezas.' }
];
export const FRAGMENTOS = DOCUMENTOS.flatMap((doc) => doc.texto.split(/(?<=\.)\s+(?=[A-ZÁÉÍÓÚÑ])/u)
  .map((texto, i) => ({ doc, n: i + 1, texto })));
const grupos = [
  'envio entrega entregar entregan mandan mandar llega llegan reparto domicilio flete',
  'costo cuesta cuestan precio cobran cobra vale',
  'devolucion devolver regresar cambio reembolso abierto abri',
  'factura facturar facturacion fiscal timbran',
  'pago pagar tarjeta transferencia efectivo credito',
  'descuento mayoreo rebaja promocion',
  'horario abren abre cierran cerrada hora domingo sabado',
  'microondas calentar'
].map((grupo) => new Set(words(grupo).map(stem)));
const terminosDe = (texto) => words(texto).filter((w) => !STOP.has(w)).map(stem);
const indice = FRAGMENTOS.map((frag) => {
  const tokens = terminosDe(frag.texto);
  const frecuencias = new Map();
  tokens.forEach((t) => frecuencias.set(t, (frecuencias.get(t) || 0) + 1));
  return { ...frag, longitud: tokens.length, frecuencias };
});
const promedio = indice.reduce((sum, f) => sum + f.longitud, 0) / indice.length;
// Calibrado con las preguntas del negocio y las consultas sin respuesta de SPEC.md.
export const UMBRAL = 2.5;

export function buscar(pregunta) {
  const originales = new Set(terminosDe(pregunta));
  const pesos = new Map([...originales].map((t) => [t, 1]));
  grupos.forEach((grupo) => {
    if ([...originales].some((t) => grupo.has(t))) {
      grupo.forEach((t) => { if (!pesos.has(t)) pesos.set(t, 0.5); });
    }
  });
  const fragmentos = indice.map((f) => {
    let score = 0;
    pesos.forEach((peso, t) => {
      const tf = f.frecuencias.get(t) || 0;
      if (!tf) return;
      const df = indice.filter((item) => item.frecuencias.has(t)).length;
      const idf = Math.log(1 + (indice.length - df + 0.5) / (df + 0.5));
      score += peso * idf * tf * 2.2 / (tf + 1.2 * (0.25 + 0.75 * f.longitud / promedio));
    });
    return { doc: f.doc, n: f.n, texto: f.texto, score };
  }).filter((f) => f.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);
  let respuesta = null;
  if (fragmentos[0]?.score >= UMBRAL) {
    const usados = [fragmentos[0]];
    if (fragmentos[1]?.doc === usados[0].doc && fragmentos[1].score >= 0.6 * usados[0].score) usados.push(fragmentos[1]);
    respuesta = {
      texto: usados.map((f) => f.texto).join(' '),
      fuente: { archivo: usados[0].doc.archivo, titulo: usados[0].doc.titulo, fragmentos: usados.map((f) => f.n) }
    };
  }
  return { fragmentos, respuesta, terminos: new Set(pesos.keys()) };
}

export function resaltar(texto, terminos) {
  return texto.split(/([\p{L}\p{N}]+)/u).map((parte) => terminos.has(stem(parte))
    ? `<mark>${esc(parte)}</mark>` : esc(parte)).join('');
}

export function initRag(root) {
  const get = (s) => root.querySelector(`[data-${s}]`);
  const docs = get('docs'), chat = get('chat'), form = get('form'), frags = get('frags');
  const input = form.querySelector('textarea'), steps = flow(get('flow'));
  let busy = false;
  docs.innerHTML = DOCUMENTOS.map((doc) => `<li class="doc"><span class="doc__icon" aria-hidden="true"></span><div><div class="doc__name">${esc(doc.archivo)}</div><div class="doc__title">${esc(doc.titulo)}</div></div></li>`).join('');
  get('doc-count').textContent = `${DOCUMENTOS.length} documentos · ${FRAGMENTOS.length} fragmentos`;
  const message = (kind, html) => {
    const el = document.createElement('div');
    el.className = `msg msg--${kind}`;
    el.innerHTML = html;
    chat.append(el); chat.scrollTop = chat.scrollHeight;
  };
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const pregunta = input.value.trim();
    if (busy || !pregunta) return;
    busy = true;
    [...form.elements].forEach((el) => { el.disabled = true; });
    try {
      message('user', esc(pregunta)); input.value = '';
      await steps.to(0); await steps.to(1);
      [...docs.children].forEach((el) => el.classList.remove('is-hit'));
      const resultado = buscar(pregunta), fuente = resultado.respuesta?.fuente;
      await steps.to(2);
      frags.innerHTML = resultado.fragmentos.map((f) => {
        const usado = fuente?.archivo === f.doc.archivo && fuente.fragmentos.includes(f.n);
        if (usado) docs.children[DOCUMENTOS.indexOf(f.doc)].classList.add('is-hit');
        return `<div class="frag${usado ? ' is-used' : ''}"><div class="frag__src">${esc(f.doc.archivo)} · fragmento ${f.n}<div class="frag__score"><i style="width:${100 * f.score / resultado.fragmentos[0].score}%"></i></div></div><div class="frag__text">${resaltar(f.texto, resultado.terminos)}</div></div>`;
      }).join('') || '<p class="empty">No encontré fragmentos relacionados con tu pregunta.</p>';
      if (!resultado.respuesta) {
        steps.fail(2);
        message('bot', 'No encuentro eso en los documentos del negocio. En un caso real, aquí se le pasa la pregunta a una persona del equipo.');
      } else {
        await steps.to(3);
        message('bot', `${esc(resultado.respuesta.texto)}\n<span class="cite">${esc(fuente.archivo)} · fragmento ${fuente.fragmentos.join(', ')}</span>`);
        steps.done();
      }
    } finally {
      busy = false;
      [...form.elements].forEach((el) => { el.disabled = false; });
      input.focus();
    }
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); if (!busy) form.requestSubmit(); }
  });
  root.querySelectorAll('[data-preset]').forEach((btn) => btn.addEventListener('click', () => {
    if (!busy) { input.value = btn.dataset.preset; input.focus(); }
  }));
}
