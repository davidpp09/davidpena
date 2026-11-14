# Especificación: lógica de las 4 demos

Sitio estático sin build: `index.html` + `styles.css` ya están hechos y **no se tocan**. Tu trabajo es escribir el JavaScript en `js/`. Usa ES modules nativos (`<script type="module" src="js/main.js">`), sin dependencias, sin frameworks, sin CDNs. Todo en español de México, con acentos correctos en el texto visible.

Negocio de ejemplo para las 4 demos: **Distribuidora La Esperanza**, vende desechables por mayoreo.

## Reglas generales

- Archivos de menos de 400 líneas cada uno.
- Separa la **lógica pura** (funciones que no tocan el DOM, exportadas y probables en Node) de la **UI** (funciones `initX(root)` que sí tocan el DOM).
- Todo texto que venga del usuario se inserta escapado (`esc()`), nunca con `innerHTML` crudo.
- Usa las clases CSS que ya existen en `styles.css` (están listadas abajo por demo). No agregues estilos en línea salvo `style="width:…"` para barras.
- Animaciones: usa `sleep(ms)` de `ui.js`, que regresa 0 ms si el usuario tiene `prefers-reduced-motion`.
- Un botón o formulario no debe aceptar otra acción mientras una animación corre (bandera `busy`).
- Montos en pesos: `$1,234.50` (`toLocaleString('es-MX')` con 2 decimales).

## Archivos

```
js/main.js       pestañas + llama initPedidos/initRag/initTicket/initCrm
js/ui.js         sleep, esc, money, flow(el)
js/text.js       normalize, words, stem, lev (Levenshtein), STOP
js/pedidos.js    demo 01
js/rag.js        demo 02
js/ticket.js     demo 03
js/crm.js        demo 04
tests/logic.test.mjs   pruebas con node --test
```

### ui.js

- `sleep(ms)`
- `esc(str)`
- `money(n)`
- `flow(olElement)` → objeto con:
  - `reset()` quita clases de todos los `li`
  - `async to(i, ms = 420)` pone `is-done` a los anteriores, `is-active` al `i`, espera `ms`
  - `done()` todos `is-done`
  - `fail(i)` anteriores `is-done`, el `i` con `is-fail`

### main.js — pestañas

Botones `.tab[role=tab]` con `aria-controls`. Al hacer clic: `aria-selected="true"` y `tabindex="0"` en el activo, `false`/`-1` en los demás, `hidden` en los paneles no activos. Flechas izquierda/derecha mueven el foco entre pestañas y las activan. Si la URL trae `#demo-rag` (etc.), abrir esa pestaña al cargar.

### text.js

- `normalize(s)`: minúsculas y sin acentos (NFD + quitar diacríticos). La ñ puede volverse n.
- `words(s)`: `normalize(s).match(/[a-z0-9]+/g) || []`
- `stem(w)`: si `w.length > 3` quita una `s` final; luego si `w.length > 4` quita una `a`, `e` u `o` final. (envíos→envi, entregas→entreg, paquetes→paquet, devoluciones→devolucion)
- `lev(a, b)`: distancia de Levenshtein.
- `STOP`: set de palabras vacías en español (a, al, con, de, del, el, la, las, lo, los, en, es, y, o, que, se, si, un, una, uno, me, mi, por, para, pa, como, cuanto, cuanta, puedo, pueden, hay, tienen, tiene, dan, son, ya, algo, hola, oye, favor…).

---

## 01 · Pedidos por WhatsApp — `js/pedidos.js`

Raíz: `#demo-pedidos`. Ganchos: `[data-flow]`, `[data-chat]`, `[data-preset]` (botones con el texto en `data-preset`), `[data-form]` con su `textarea`, `[data-out]`, `[data-inv]` (tabla), `[data-reset]`.

### Catálogo (estado inicial)

| id | nombre | unidad | precio | stock | alias (normalizados) |
|---|---|---|---|---|---|
| vaso | Vaso térmico 16 oz | paq. 25 | 68 | 140 | vaso, vasos, termico, termicos, unicel |
| plato | Plato pastelero | paq. 50 | 42 | 90 | plato, platos, pastelero, pasteleros |
| contenedor | Contenedor 1 división | paq. 25 | 95 | 60 | contenedor, contenedores, charola, charolas |
| tenedor | Tenedor desechable | paq. 100 | 38 | 120 | tenedor, tenedores |
| cuchara | Cuchara desechable | paq. 100 | 38 | 110 | cuchara, cucharas |
| servilleta | Servilleta | paq. 500 | 55 | 75 | servilleta, servilletas |
| bolsa | Bolsa camiseta mediana | kg | 48 | 200 | bolsa, bolsas, camiseta |
| popote | Popote | paq. 250 | 30 | 80 | popote, popotes |

### Lógica pura: `interpretar(texto)` (exportada)

1. Normaliza. Reemplaza `media docena`→`6`, `N docena(s)`→`N*12`, `una/un docena`→`12`, `docena(s)` suelta→`12`.
2. Tokeniza con `/[a-z0-9]+/g`.
3. `matchProducto(tok)`: igual a un alias → ese producto. Si `tok.length >= 5`, también acepta `lev(tok, alias) <= (alias.length >= 8 ? 2 : 1)` y diferencia de longitud ≤ 2. Así "basos"→vaso y "serbilletas"→servilleta, pero "caso" **no** es vaso.
4. Recorre tokens. Al encontrar producto en `i`:
   - Si es el mismo producto que el token `i-1`, sáltalo ("vasos termicos" cuenta una vez; "bolsa camiseta" una vez).
   - Cantidad: busca hacia atrás hasta 4 tokens. Para si encuentras otro producto. Si el token es número (dígitos o palabra: un/una/uno=1, dos…diez, once, doce, quince, veinte, treinta, cuarenta, cincuenta, cien) y no fue usado, tómalo y márcalo usado. Si el token es relleno (`paquete(s)`, `paq`, `caja(s)`, `kilo(s)`, `kg`, `pieza(s)`, `pza(s)`, `de`, `del`, `los`, `las`, `el`, `la`, `mas`, `y`, `unos`, `unas`), sigue buscando. Cualquier otra palabra corta la búsqueda.
   - Sin cantidad → 1 y `asumida: true`.
   - Si el producto ya estaba, suma cantidades.
5. Productos no manejados: por cada token de **dígitos** no usado, que no venga después de `a`, `las`, `la`, `alas` (horas), mira hasta 3 tokens adelante saltando relleno; el primero que no sea producto, ni número, ni (`pm, am, oz, hrs, horas, hora, dias, dia, min, tarde, manana, noche`), y tenga más de 2 letras → agrégalo a `desconocidos` ("2 cajas de chicles" → `chicles`).
6. Entrega: `pasado manana`→"pasado mañana"; `hoy`→"hoy"; `manana`→"mañana"; si no, día de la semana (lunes…domingo, con acentos al mostrar: miércoles, sábado). Hora: `/\ba\s*las\s*(\d{1,2})(?::(\d{2}))?/` → 1–7 = "5:00 p. m.", 8–11 = "10:00 a. m.", 12+ = "13:00 h".
7. Pago: transferencia / efectivo / tarjeta. Factura: contiene `factura`. Cliente: `/\bsoy (?:el |la )?([a-z]+)/` con mayúscula inicial. Urgente: `urge|urgen|urgente|rapido|hoy`.

Regresa `{ lineas: [{id, nombre, unidad, precio, cantidad, asumida}], desconocidos: [], entrega: {dia, hora}, pago, factura, cliente, urgente }`.

Pruebas mínimas (ver tests): los 3 presets de `index.html` deben dar
- Preset 1 → vaso 3, plato 2, tenedor 1; mañana 5:00 p. m.; transferencia; cliente Juan.
- Preset 2 → contenedor 10, servilleta 6, bolsa 2; hoy; urgente.
- Preset 3 → vaso 4, cuchara 3; desconocidos `["chicles"]`; viernes; factura.

### Lógica pura: `armarPedido(resultado, inventario, folio)` (exportada)

Subtotal = Σ cantidad × precio. Envío: **gratis si subtotal ≥ $1,500, si no $120** (sale de la política de envíos de la demo 02). Total. Marca líneas donde `cantidad > stock` (`faltante: stock`). Regresa también el texto de respuesta al cliente:

```
¡Listo, Juan! Tu pedido PED-1043:
• 3 × Vaso térmico 16 oz
• 2 × Plato pastelero
• 1 × Tenedor desechable
Total: $XXX.XX (envío incluido $120.00 | envío gratis)
Te lo entregamos mañana a las 5:00 p. m.
```

Si no hay cliente: "¡Listo!". Sin entrega: "¿Para cuándo lo necesitas?". Desconocidos: "Ojo: no manejamos chicles." Asumidas: "Puse 1 de X porque no me dijiste cuántos; ¿así está bien?". Faltante: "De X solo tengo N; te mando esos."

### UI `initPedidos(root)`

- Presets llenan el `textarea`. Enter sin Shift envía.
- Al enviar: burbuja `.msg.msg--user`; luego `flow.to(0)`, `.msg.msg--typing` "escribiendo…", `flow.to(1)`, interpretar.
- Si no hay líneas: `flow.fail(1)`, quita "escribiendo…", responde "Perdón, no identifiqué productos. Manejamos vasos, platos, contenedores, cubiertos, servilletas, bolsas y popotes. ¿Qué y cuántos te mando?". En `[data-out]` un `.empty` "No encontré productos del catálogo en el mensaje."
- Si hay: `to(2)`, `to(3)` y renderiza en `[data-out]` un `.order`:
  - `.order__head`: `.order__id` con el folio (empieza en PED-1043 y sube), y `.badge.badge--signal` "Urgente" si aplica, si no `.badge` "Nuevo".
  - tabla `.table` con columnas Cant. | Producto | Unidad | Importe (`.num`); filas con faltante llevan `.badge.badge--warn` "solo N".
  - `.order__meta` con `<b>` para Cliente, Entrega, Pago, Factura (Sí/No).
  - `.order__total` Subtotal/Envío/Total (puedes usar varias filas).
  - `ul.notes` con desconocidos y cantidades asumidas.
- `to(4)`: descuenta del inventario (sin bajar de 0) y vuelve a pintar `[data-inv]` con columnas Producto | Existencia (con `.stock` > `.stock__bar` > `i` de ancho = stock/inicial; clase `low` si < 20%) | `.num` cantidad. Filas que cambiaron con `.is-changed`.
- `to(5)`: quita "escribiendo…", burbuja bot con el texto de respuesta; `flow.done()`.
- `[data-reset]` restablece inventario y folio.
- El chat hace scroll al final con cada mensaje.

---

## 02 · RAG — `js/rag.js`

Raíz: `#demo-rag`. Ganchos: `[data-flow]`, `[data-docs]`, `[data-doc-count]`, `[data-chat]`, `[data-preset]`, `[data-form]`, `[data-frags]`.

### Documentos (texto exacto)

1. `envios.pdf` · Política de envíos — "Entregamos en toda la zona metropolitana de lunes a sábado. Los pedidos confirmados antes de las 2 de la tarde se entregan al día siguiente. El envío es gratis en pedidos de $1,500 o más; en pedidos menores cuesta $120. No hacemos entregas los domingos ni días festivos."
2. `devoluciones.pdf` · Devoluciones y cambios — "Aceptamos devoluciones dentro de los 7 días posteriores a la entrega si el producto llega dañado o no corresponde al pedido. El producto debe estar en su empaque original. El reembolso se hace por el mismo medio de pago en un plazo de 3 a 5 días hábiles. No se aceptan devoluciones de producto abierto por motivos de higiene."
3. `pagos-y-facturacion.pdf` · Pagos y facturación — "Aceptamos transferencia, efectivo contra entrega y tarjeta de débito o crédito con terminal móvil. Para facturar, envía tu constancia de situación fiscal por WhatsApp el mismo día de la compra. Las facturas se timbran en un plazo de 24 horas. Los clientes frecuentes pueden pagar a crédito de 15 días después de 3 meses comprando con nosotros."
4. `mayoreo.pdf` · Precios de mayoreo — "A partir de 10 paquetes del mismo producto aplica un 8% de descuento. A partir de 30 paquetes del mismo producto el descuento es del 12%. Los descuentos no se acumulan con las promociones del mes. Los pedidos de más de 100 paquetes se cotizan directamente con ventas."
5. `horarios.pdf` · Horarios y contacto — "La sucursal abre de lunes a viernes de 8 a 18 h y los sábados de 9 a 14 h. Los domingos la sucursal permanece cerrada. El WhatsApp de pedidos responde de 7 a 21 h todos los días. Las quejas se atienden por el mismo WhatsApp con el área de calidad."
6. `productos.pdf` · Ficha de productos — "Los vasos térmicos son de unicel y conservan la temperatura de bebidas calientes. Los contenedores de una división se pueden calentar en microondas un máximo de 2 minutos. Las bolsas camiseta se venden por kilo y un kilo trae alrededor de 100 bolsas medianas. Los popotes se venden en paquetes de 250 piezas."

Fragmentos = una oración por fragmento (corta en `. ` seguido de mayúscula; ojo con "$1,500" y "18 h"). Cada fragmento: `{doc, n, texto}`.

### Lógica pura (exportada): `buscar(pregunta)` → `{ fragmentos: [{doc, n, texto, score}], respuesta | null, terminos: Set }`

- Términos: `words` → quitar `STOP` → `stem`. Peso 1.
- Expansión por sinónimos (comparando stems). Grupos:
  - envío: envio, entrega, entregar, entregan, mandan, mandar, llega, llegan, reparto, domicilio, flete
  - costo: costo, cuesta, cuestan, precio, cobran, cobra, vale
  - devolución: devolucion, devolver, regresar, cambio, reembolso, abierto, abri
  - factura: factura, facturar, facturacion, fiscal, timbran
  - pago: pago, pagar, tarjeta, transferencia, efectivo, credito
  - descuento: descuento, mayoreo, rebaja, promocion
  - horario: horario, abren, abre, cierran, cerrada, hora, domingo, sabado
  - microondas: microondas, calentar
  Si un término de la pregunta está en un grupo, agrega los demás términos del grupo con peso 0.5 (sin bajar el peso de uno ya presente).
- Puntuación BM25 (k1 = 1.2, b = 0.75, idf = ln(1 + (N − df + 0.5)/(df + 0.5))), multiplicada por el peso del término.
- Top 3 con score > 0. Si el mejor score < `UMBRAL` (calíbralo con las pruebas; empieza en 0.9) → `respuesta: null`.
- Respuesta: texto del mejor fragmento; si el segundo es del mismo documento y su score ≥ 0.6 × el mejor, agrégalo. Incluye `fuente: {archivo, titulo, fragmentos: [n…]}`.

Pruebas (respuesta debe contener):
- "¿Cuánto cuesta el envío?" → "$120"
- "¿Puedo devolver algo que ya abrí?" → "abierto"
- "¿Me dan descuento si compro 15 paquetes?" → "8%"
- "¿Abren en domingo?" → "cerrada"
- "¿Cómo pido factura?" → documento pagos-y-facturacion.pdf
- "¿Venden pizzas?" → `respuesta === null`
- "¿Tienen estacionamiento?" → `respuesta === null`

### UI `initRag(root)`

- Pinta la lista de documentos en `[data-docs]`: `li.doc` con `.doc__icon`, `.doc__name` (archivo) y `.doc__title`. `[data-doc-count]` = "6 documentos · N fragmentos".
- Al preguntar: burbuja usuario; `flow.to(0)`; `to(1)` y quita `is-hit` de todos; `to(2)` y pinta en `[data-frags]` hasta 3 `.frag` (`.frag__src` con archivo + "fragmento n" + `.frag__score > i` con ancho relativo al mejor; `.frag__text` con los términos resaltados en `<mark>`; clase `is-used` en los usados para la respuesta) y marca `is-hit` en los documentos usados; `to(3)` y burbuja bot con la respuesta + `<span class="cite">archivo · fragmento n</span>`; `done()`.
- Sin respuesta: `fail(2)`, burbuja "No encuentro eso en los documentos del negocio. En un caso real, aquí se le pasa la pregunta a una persona del equipo." y en `[data-frags]` muestra lo más parecido que encontró (si hay) o un `.empty`.
- Resaltado: envuelve en `<mark>` las palabras del fragmento cuyo `stem` esté en los términos (con peso). Escapa el texto antes.

---

## 03 · Ticket — `js/ticket.js`

Raíz: `#demo-ticket`. Ganchos: `[data-flow]`, `[data-picker]`, `[data-receipt]`, `[data-scan]`, `[data-fields]`, `[data-ledger]`.

### Tickets

1. **Ferretería El Clavo** · RFC XAXX010101000 · 08/11/2026 13:42 · Cinta de aislar 3 × $18.50; Brocha 2" 1 × $45.00; Thinner 1 L 2 × $62.00 · Pago: Efectivo · Categoría: Mantenimiento
2. **Servicio Las Palmas** (gasolinera) · RFC XAXX010101000 · 10/11/2026 08:15 · Magna 32.50 L × $23.89 · Pago: Tarjeta · Categoría: Combustible
3. **Fonda Doña Lupe** · RFC XAXX010101000 · 11/11/2026 15:05 · Comida corrida 3 × $95.00; Agua de jamaica 3 × $25.00; Café de olla 2 × $20.00 · Pago: Efectivo · Categoría: Alimentos

Calcula importe por línea, subtotal = total / 1.16, IVA = total − subtotal (los precios ya incluyen IVA). Redondea a 2 decimales.

### UI `initTicket(root)`

- `[data-picker]`: un `button.chip` por ticket con `aria-pressed`. El primero seleccionado al cargar.
- `[data-receipt]`: un `.receipt` con `.receipt__center` (nombre, RFC, fecha), `.receipt__sep`, `.receipt__row` por concepto (nombre y cantidad a la izquierda, importe a la derecha), `.receipt__sep`, filas SUBTOTAL, IVA 16%, TOTAL, forma de pago, y "GRACIAS POR SU COMPRA". Cada fila lleva `data-k` (`proveedor`, `rfc`, `fecha`, `concepto`, `subtotal`, `iva`, `total`, `pago`).
- `[data-scan]`: `flow.to(0)`; agrega `is-scanning` al recibo; `to(1)` (~1.2 s); `to(2)` y en `[data-fields]` (un `dl` en grid de 3 columnas) agrega uno por uno `dt` + `dd` + `span.conf` ("98%"): Proveedor, RFC, Fecha, Concepto principal (el de mayor importe), Subtotal, IVA, Total, Forma de pago; mientras se agrega cada campo, pon `is-hit` en la fila `data-k` correspondiente del recibo (y quítalo del anterior). `to(3)` y agrega Categoría con `.badge.badge--signal`. Quita `is-scanning`. `to(4)` y agrega fila a `[data-ledger]` (columnas Fecha | Proveedor | Categoría | Total `.num`) con `.is-new`, más una fila final "Total registrado" con la suma. `done()`.
- Si el ticket ya se registró, el botón dice "Ya registrado" y queda deshabilitado; al cambiar de ticket se reactiva si ese no se ha registrado. Al cambiar de ticket, `flow.reset()` y `[data-fields]` vuelve al `.empty`.

---

## 04 · Agente CRM — `js/crm.js`

Raíz: `#demo-crm`. Ganchos: `[data-flow]`, `[data-inbox]`, `[data-email]`, `[data-run]`, `[data-log]`, `[data-agent-state]`, `[data-draft]`, `[data-draft-text]`, `[data-crm]`.

### CRM inicial (columnas: Cliente | Contacto | Etapa | Valor | Siguiente paso)

- Taquería El Güero · Rogelio · `.badge.badge--ok` Cliente · $3,200 / mes · —
- Abarrotes Doña Mary · María · Cliente · $1,850 / mes · —
- Cocina Económica Rosy · Rosa · `.badge` Cotización enviada · $2,400 · Llamar el lunes

### Correos (con su guion de pasos)

1. **Laura Méndez · Grupo Constructor Altamira** — Asunto: "Cotización para evento" — "Buen día, necesitamos cotización de 40 paquetes de contenedores y 20 paquetes de vasos para un evento el 28 de noviembre. ¿Pueden facturar? Quedo atenta. Laura Méndez, Compras."
   Pasos: Entender → "Pide cotización: 40 paq. de contenedores y 20 paq. de vasos para el 28 de noviembre. Necesita factura." · `buscar_cliente("Grupo Constructor Altamira")` → "No existe en el CRM." · `crear_cliente(nombre="Grupo Constructor Altamira", contacto="Laura Méndez")` → "Cliente creado." · `cotizar(contenedor×40, vaso×20)` → "40 × $95 con 12% de mayoreo + 20 × $68 con 8% = $4,595.20. Envío gratis." · `crear_oportunidad(etapa="Cotización", valor=$4,595.20)` → "Oportunidad abierta." · `agendar_seguimiento("Llamar a Laura", "mañana 10:00")` → "Tarea creada."
   CRM: fila nueva Grupo Constructor Altamira · Laura Méndez · `.badge.badge--signal` Cotización · $4,595.20 · Llamar mañana 10:00.
   Borrador: "Hola, Laura. Gracias por escribirnos. Para el 28 de noviembre te cotizamos 40 paquetes de contenedores de una división y 20 paquetes de vasos térmicos: $4,595.20 con el descuento de mayoreo aplicado y envío gratis. Sí facturamos; solo envíanos tu constancia de situación fiscal. Mañana a las 10 te llamo para confirmar. — Distribuidora La Esperanza"
2. **Rogelio · Taquería El Güero** — Asunto: "Pedido incompleto" — "Oigan, el pedido de ayer llegó incompleto, faltaron 2 paquetes de servilletas. Los necesito para el fin de semana."
   Pasos: Entender → "Queja: faltaron 2 paq. de servilletas en el pedido de ayer. Urgente por el fin de semana." · `buscar_cliente("Taquería El Güero")` → "Cliente desde marzo. Último pedido: PED-1031, ayer." · `revisar_pedido("PED-1031")` → "Se surtieron 4 de 6 paquetes de servilletas." · `crear_ticket(tipo="Faltante", prioridad="Alta")` → "Ticket SOP-208 abierto." · `programar_reposicion(servilleta×2, "hoy, ruta de la tarde")` → "Reposición en la ruta de las 4:00 p. m."
   CRM: actualiza la fila de Taquería El Güero → Siguiente paso "Reposición hoy 4:00 p. m." con `.is-changed`.
   Borrador: "Hola, Rogelio. Tienes razón: en tu pedido PED-1031 se surtieron 4 de los 6 paquetes de servilletas. Hoy en la ruta de las 4:00 p. m. te llevamos los 2 que faltan, sin costo de envío. Una disculpa por el inconveniente. — Distribuidora La Esperanza"
3. **Marco · Cafetería Nube** — Asunto: "¿Popotes biodegradables?" — "Hola, ¿manejan popotes biodegradables? Somos una cafetería nueva y queremos precio de mayoreo."
   Pasos: Entender → "Prospecto nuevo: cafetería que busca popotes biodegradables a precio de mayoreo." · `buscar_cliente("Cafetería Nube")` → "No existe en el CRM." · `consultar_catalogo("popote biodegradable")` → "No está en el catálogo. Alternativa: Popote, paquete de 250 piezas, $30." · `crear_cliente(nombre="Cafetería Nube", contacto="Marco")` → "Prospecto creado." · `agendar_seguimiento("Llamar a Marco", "mañana 12:00")` → "Tarea creada."
   CRM: fila nueva Cafetería Nube · Marco · `.badge` Prospecto · — · Llamar mañana 12:00.
   Borrador: "Hola, Marco. Gracias por escribirnos. Por ahora no manejamos popote biodegradable; sí tenemos popote en paquete de 250 piezas a $30, y a partir de 10 paquetes te damos 8% de descuento. Te aviso si conseguimos el biodegradable. Mañana a mediodía te llamo para conocer lo que necesita tu cafetería. — Distribuidora La Esperanza"

### UI `initCrm(root)`

- `[data-inbox]`: `li > button.inbox__item` con `aria-pressed`, `.inbox__from` (nombre · empresa), un `.badge` a la derecha ("Nuevo" o "Procesado" con `.badge--ok`), `.inbox__subj`. El primero seleccionado al cargar.
- `[data-email]`: `.email__meta` ("De: … · hoy"), `.email__subj`, `.email__body`.
- `[data-run]`: `flow.to(0)`; `[data-agent-state]` "trabajando"; vacía `[data-log]`; `to(1)` y agrega el paso "Entender" (texto normal); `to(2)` para el primer `buscar_cliente`; `to(3)` para el resto de herramientas. Cada paso: `li.log__step.is-running` con `.log__icon` y contenido (`.log__tool` con la llamada en mono y `.log__result` con el resultado), espera ~650 ms, pasa a `.is-done` y muestra el resultado. Aplica el cambio al CRM en el paso que corresponde (crear_cliente / crear_oportunidad / programar_reposicion) y vuelve a pintar la tabla con `.is-new` o `.is-changed` en la fila. `to(4)`: muestra `[data-draft]` con el borrador. `done()`, estado "listo", y el correo queda "Procesado" (no se puede procesar dos veces; el botón dice "Ya procesado").
- Al cambiar de correo: `flow.reset()`, log vacío con `.empty`, borrador oculto. Si ese correo ya se procesó, muestra de nuevo su log final y su borrador.

---

## tests/logic.test.mjs

Con `node:test` y `node:assert`, importa las funciones puras de `../js/pedidos.js` y `../js/rag.js` y cubre todas las pruebas listadas arriba. Los módulos no deben tocar `document` ni `window` al importarse (solo dentro de `initX`). Debe pasar con:

```
node --test tests/
```

## Cuando termines

Corre las pruebas, corrige hasta que pasen, y al final escribe un resumen corto: archivos creados, resultado de las pruebas y cualquier decisión que hayas tomado distinta a esta especificación.
