import { esc, flow, money, sleep } from './ui.js';

export const CORREOS = [
  {
    contacto: 'Laura Méndez', empresa: 'Grupo Constructor Altamira', asunto: 'Cotización para evento',
    cuerpo: 'Buen día, necesitamos cotización de 40 paquetes de contenedores y 20 paquetes de vasos para un evento el 28 de noviembre. ¿Pueden facturar? Quedo atenta. Laura Méndez, Compras.',
    pasos: [
      ['Entender', 'Pide cotización: 40 paq. de contenedores y 20 paq. de vasos para el 28 de noviembre. Necesita factura.'],
      ['buscar_cliente("Grupo Constructor Altamira")', 'No existe en el CRM.'],
      ['crear_cliente(nombre="Grupo Constructor Altamira", contacto="Laura Méndez")', 'Cliente creado.', 'crear'],
      ['cotizar(contenedor×40, vaso×20)', '40 × $95 con 12% de mayoreo + 20 × $68 con 8% = $4,595.20. Envío gratis.'],
      ['crear_oportunidad(etapa="Cotización", valor=$4,595.20)', 'Oportunidad abierta.', 'oportunidad'],
      ['agendar_seguimiento("Llamar a Laura", "mañana 10:00")', 'Tarea creada.', 'laura']
    ],
    borrador: 'Hola, Laura. Gracias por escribirnos. Para el 28 de noviembre te cotizamos 40 paquetes de contenedores de una división y 20 paquetes de vasos térmicos: $4,595.20 con el descuento de mayoreo aplicado y envío gratis. Sí facturamos; solo envíanos tu constancia de situación fiscal. Mañana a las 10 te llamo para confirmar. — Distribuidora La Esperanza'
  },
  {
    contacto: 'Rogelio', empresa: 'Taquería El Güero', asunto: 'Pedido incompleto',
    cuerpo: 'Oigan, el pedido de ayer llegó incompleto, faltaron 2 paquetes de servilletas. Los necesito para el fin de semana.',
    pasos: [
      ['Entender', 'Queja: faltaron 2 paq. de servilletas en el pedido de ayer. Urgente por el fin de semana.'],
      ['buscar_cliente("Taquería El Güero")', 'Cliente desde marzo. Último pedido: PED-1031, ayer.'],
      ['revisar_pedido("PED-1031")', 'Se surtieron 4 de 6 paquetes de servilletas.'],
      ['crear_ticket(tipo="Faltante", prioridad="Alta")', 'Ticket SOP-208 abierto.'],
      ['programar_reposicion(servilleta×2, "hoy, ruta de la tarde")', 'Reposición en la ruta de las 4:00 p. m.', 'reposicion']
    ],
    borrador: 'Hola, Rogelio. Tienes razón: en tu pedido PED-1031 se surtieron 4 de los 6 paquetes de servilletas. Hoy en la ruta de las 4:00 p. m. te llevamos los 2 que faltan, sin costo de envío. Una disculpa por el inconveniente. — Distribuidora La Esperanza'
  },
  {
    contacto: 'Marco', empresa: 'Cafetería Nube', asunto: '¿Popotes biodegradables?',
    cuerpo: 'Hola, ¿manejan popotes biodegradables? Somos una cafetería nueva y queremos precio de mayoreo.',
    pasos: [
      ['Entender', 'Prospecto nuevo: cafetería que busca popotes biodegradables a precio de mayoreo.'],
      ['buscar_cliente("Cafetería Nube")', 'No existe en el CRM.'],
      ['consultar_catalogo("popote biodegradable")', 'No está en el catálogo. Alternativa: Popote, paquete de 250 piezas, $30.'],
      ['crear_cliente(nombre="Cafetería Nube", contacto="Marco")', 'Prospecto creado.', 'crear'],
      ['agendar_seguimiento("Llamar a Marco", "mañana 12:00")', 'Tarea creada.', 'marco']
    ],
    borrador: 'Hola, Marco. Gracias por escribirnos. Por ahora no manejamos popote biodegradable; sí tenemos popote en paquete de 250 piezas a $30, y a partir de 10 paquetes te damos 8% de descuento. Te aviso si conseguimos el biodegradable. Mañana a mediodía te llamo para conocer lo que necesita tu cafetería. — Distribuidora La Esperanza'
  }
];

export function initCrm(root) {
  const get = (s) => root.querySelector(`[data-${s}]`);
  const inbox = get('inbox'), email = get('email'), run = get('run'), log = get('log');
  const state = get('agent-state'), draft = get('draft'), table = get('crm'), steps = flow(get('flow'));
  let seleccionado = 0, busy = false;
  const procesados = new Set();
  const clientes = [
    { nombre: 'Taquería El Güero', contacto: 'Rogelio', etapa: 'Cliente', badge: 'badge--ok', valor: 3200, mensual: true, siguiente: '—' },
    { nombre: 'Abarrotes Doña Mary', contacto: 'María', etapa: 'Cliente', badge: 'badge--ok', valor: 1850, mensual: true, siguiente: '—' },
    { nombre: 'Cocina Económica Rosy', contacto: 'Rosa', etapa: 'Cotización enviada', valor: 2400, siguiente: 'Llamar el lunes' }
  ];
  function renderCrm() {
    table.innerHTML = `<thead><tr><th>Cliente</th><th>Contacto</th><th>Etapa</th><th>Valor</th><th>Siguiente paso</th></tr></thead><tbody>${clientes.map((c) => `<tr${c.clase ? ` class="${c.clase}"` : ''}><td>${esc(c.nombre)}</td><td>${esc(c.contacto)}</td><td><span class="badge ${c.badge || ''}">${esc(c.etapa)}</span></td><td class="num">${c.valor == null ? '—' : money(c.valor)}${c.mensual ? ' / mes' : ''}</td><td>${esc(c.siguiente)}</td></tr>`).join('')}</tbody>`;
  }
  function renderInbox() {
    inbox.innerHTML = CORREOS.map((c, i) => `<li><button type="button" class="inbox__item" data-correo="${i}" aria-pressed="${seleccionado === i}"${busy ? ' disabled' : ''}><span class="inbox__from">${esc(c.contacto)} · ${esc(c.empresa)}</span><span class="badge${procesados.has(i) ? ' badge--ok' : ''}">${procesados.has(i) ? 'Procesado' : 'Nuevo'}</span><span class="inbox__subj">${esc(c.asunto)}</span></button></li>`).join('');
  }
  function logHtml(paso, listo = false) {
    return `<li class="log__step ${listo ? 'is-done' : 'is-running'}"><span class="log__icon" aria-hidden="true"></span><div><span${paso[0] === 'Entender' ? '' : ' class="log__tool"'}>${esc(paso[0])}</span><div class="log__result"${listo ? '' : ' hidden'}>${esc(paso[1])}</div></div></li>`;
  }
  function showDraft(c) { get('draft-text').textContent = c.borrador; draft.hidden = false; }
  function select(i) {
    if (busy) return;
    seleccionado = i;
    const c = CORREOS[i], listo = procesados.has(i);
    steps.reset(); renderInbox();
    email.innerHTML = `<div class="email__meta">De: ${esc(c.contacto)} · ${esc(c.empresa)} · hoy</div><div class="email__subj">${esc(c.asunto)}</div><div class="email__body">${esc(c.cuerpo)}</div>`;
    log.innerHTML = listo ? c.pasos.map((p) => logHtml(p, true)).join('') : '<li class="empty">Elige un correo y pásaselo al agente.</li>';
    draft.hidden = true;
    if (listo) showDraft(c);
    state.textContent = listo ? 'listo' : 'en espera';
    run.disabled = listo; run.textContent = listo ? 'Ya procesado' : 'Pasárselo al agente';
  }
  function aplicar(accion, correo) {
    if (!accion) return;
    let cliente = clientes.find((c) => c.nombre === correo.empresa);
    if (accion === 'crear') {
      cliente = { nombre: correo.empresa, contacto: correo.contacto, etapa: 'Prospecto', siguiente: '—', clase: 'is-new' };
      clientes.push(cliente);
    } else if (accion === 'oportunidad') {
      Object.assign(cliente, { etapa: 'Cotización', badge: 'badge--signal', valor: 4595.20 });
    } else if (accion === 'reposicion') {
      Object.assign(cliente, { siguiente: 'Reposición hoy 4:00 p. m.', clase: 'is-changed' });
    } else cliente.siguiente = accion === 'laura' ? 'Llamar mañana 10:00' : 'Llamar mañana 12:00';
    renderCrm();
  }
  inbox.addEventListener('click', (event) => {
    const button = event.target.closest('[data-correo]');
    if (button && !busy) select(Number(button.dataset.correo));
  });
  run.addEventListener('click', async () => {
    if (busy || procesados.has(seleccionado)) return;
    busy = true; run.disabled = true; renderInbox();
    const c = CORREOS[seleccionado];
    state.textContent = 'trabajando'; log.innerHTML = ''; draft.hidden = true;
    clientes.forEach((cliente) => { delete cliente.clase; }); renderCrm();
    try {
      await steps.to(0);
      for (let i = 0; i < c.pasos.length; i++) {
        if (i < 3) await steps.to(i + 1);
        const paso = c.pasos[i];
        log.insertAdjacentHTML('beforeend', logHtml(paso));
        const node = log.lastElementChild;
        await sleep(650);
        node.classList.replace('is-running', 'is-done'); node.querySelector('.log__result').hidden = false;
        aplicar(paso[2], c);
      }
      await steps.to(4); showDraft(c); steps.done();
      procesados.add(seleccionado); state.textContent = 'listo';
    } finally {
      busy = false; renderInbox();
      run.disabled = procesados.has(seleccionado);
      run.textContent = run.disabled ? 'Ya procesado' : 'Pasárselo al agente';
    }
  });
  renderCrm(); select(0);
}
