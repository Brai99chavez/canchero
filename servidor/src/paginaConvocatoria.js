import { randomBytes } from 'node:crypto';

/**
 * La página del link de "¿quién viene?", la que se abre desde WhatsApp.
 *
 * Una sola página, chica y sin nada que bajar aparte del tipo de letra: la
 * abre gente en el colectivo, con datos, desde el navegador de WhatsApp. Tiene
 * que cargar rápido y entenderse sin explicación: tu nombre, voy o no voy.
 *
 * Los nombres los escribe el que organiza y llegan acá tal cual, así que todo
 * lo que se muestra va escapado, y además la página sólo deja correr su propio
 * script (el `nonce` de la política). Un "nombre" con código adentro se ve
 * como texto y no hace nada.
 */

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** "sábado 25 de octubre", a partir de "2026-10-25". Sin husos: es un día. */
export function comoSeLeeElDia(fecha) {
  const [a, m, d] = fecha.split('-').map(Number);
  const dia = new Date(Date.UTC(a, m - 1, d));
  return `${DIAS[dia.getUTCDay()]} ${d} de ${MESES[m - 1]}`;
}

export function escapar(texto) {
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * JSON que se puede meter adentro de un <script> sin que un `</script>` en un
 * nombre lo cierre antes de tiempo.
 */
function jsonSeguro(valor) {
  return JSON.stringify(valor)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/** Los encabezados de la página: lo que no se indexa y lo único que corre. */
export function encabezados(nonce) {
  return {
    'content-type': 'text/html; charset=utf-8',
    'content-security-policy': [
      "default-src 'none'",
      `script-src 'nonce-${nonce}'`,
      "style-src 'unsafe-inline' https://fonts.googleapis.com",
      'font-src https://fonts.gstatic.com',
      "connect-src 'self'",
      "base-uri 'none'",
      "form-action 'none'",
      "frame-ancestors 'none'",
    ].join('; '),
    // Es un link privado de un grupo: que no aparezca en ningún buscador.
    'x-robots-tag': 'noindex, nofollow',
    'referrer-policy': 'no-referrer',
    'cache-control': 'no-store',
  };
}

export function nonceNuevo() {
  return randomBytes(16).toString('base64');
}

const ESTILOS = `
:root{--bg:#0D1124;--sup:#171C38;--borde:#2E3560;--verde:#4BF0A5;--celeste:#2FD9E8;
--texto:#EDEFFF;--gris:#8F95C4;--rojo:#FF6B6B;--sobre:#08221A}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--texto);font-family:Barlow,system-ui,sans-serif;
-webkit-font-smoothing:antialiased}
main{max-width:480px;margin:0 auto;padding:24px 16px 48px}
.marca{font-family:Anton,Impact,sans-serif;letter-spacing:2px;color:var(--verde);margin:0 0 18px;font-size:15px}
h1{font-family:Anton,Impact,sans-serif;font-weight:400;font-size:30px;line-height:1.15;margin:0}
.plantel{color:var(--gris);margin:6px 0 22px;font-weight:600}
.caja{background:var(--sup);border:1px solid var(--borde);padding:16px;margin-bottom:16px;
clip-path:polygon(0 0,calc(100% - 14px) 0,100% 14px,100% 100%,14px 100%,0 calc(100% - 14px))}
.rotulo{color:var(--gris);font-size:12px;font-weight:800;letter-spacing:.8px;text-transform:uppercase;margin:0 0 10px}
.nombres{display:grid;grid-template-columns:1fr 1fr;gap:8px}
button{font:inherit;cursor:pointer;border:0}
.nombre{background:transparent;color:var(--texto);border:1.5px solid var(--borde);padding:12px 10px;
text-align:left;font-size:16px;font-weight:600;display:flex;justify-content:space-between;gap:6px;align-items:center}
.nombre span{font-size:11px;font-weight:800;letter-spacing:.5px}
.va{color:var(--verde)}.nova{color:var(--rojo)}
.yo{font-size:20px;margin:0 0 4px}.yo b{color:var(--verde)}
.estado{color:var(--gris);margin:0 0 14px}
.botones{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.si{background:linear-gradient(90deg,#5BF5A5,#2FD9E8);color:var(--sobre)}
.no{background:transparent;color:var(--texto);border:1.5px solid var(--borde)}
.si,.no{padding:16px 8px;font-size:18px;font-weight:900;letter-spacing:1px;text-transform:uppercase}
.si[disabled],.no[disabled]{opacity:.5}
.elegido{outline:3px solid var(--texto);outline-offset:2px}
.cambiar{background:none;color:var(--verde);font-weight:800;font-size:13px;text-transform:uppercase;
letter-spacing:.5px;padding:12px 0 0}
.aviso{margin:12px 0 0;font-weight:700}
.confirmado{text-align:center}
.tilde{width:64px;height:64px;border-radius:50%;margin:4px auto 12px;display:flex;align-items:center;
justify-content:center;font-size:34px;font-weight:900}
.tilde.va{background:linear-gradient(90deg,#5BF5A5,#2FD9E8);color:var(--sobre)}
.tilde.nova{background:var(--rojo);color:#2A0B0B}
.listo{font-family:Anton,Impact,sans-serif;font-size:28px;line-height:1.15;margin:0 0 6px}
.volver{width:100%;margin-top:6px}
.acciones{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
.lista{margin:0 0 12px;line-height:1.5}.lista b{font-weight:800}
.pie{color:var(--gris);font-size:12px;text-align:center;margin-top:28px}
`;

const FUENTES =
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anton&family=Barlow:wght@400;600;700;800;900&display=swap">';

/**
 * El script de la página. Va como texto y no como función de Node: corre en
 * el teléfono del que abre el link. Todo lo que pone en pantalla va con
 * `textContent`, nunca como HTML.
 */
const SCRIPT = `
(function () {
  var datos = JSON.parse(document.getElementById('datos').textContent);
  var CLAVE = 'canchero:' + datos.codigo;
  var respuestas = datos.respuestas;
  var yo = null;
  var aviso = '';
  var enviando = false;
  // Con una respuesta ya dada se muestra la confirmación. Esto es para
  // cuando tocó "Cambiar mi respuesta" y quiere ver los botones de nuevo.
  var cambiando = false;
  try { yo = localStorage.getItem(CLAVE); } catch (e) {}
  if (yo && !nombreDe(yo)) yo = null;

  function nombreDe(id) {
    for (var i = 0; i < datos.jugadores.length; i++) {
      if (datos.jugadores[i].id === id) return datos.jugadores[i].nombre;
    }
    return null;
  }
  function nodo(tag, clase, texto) {
    var n = document.createElement(tag);
    if (clase) n.className = clase;
    if (texto != null) n.textContent = texto;
    return n;
  }
  function soy(id) {
    yo = id;
    aviso = '';
    cambiando = false;
    try { id ? localStorage.setItem(CLAVE, id) : localStorage.removeItem(CLAVE); } catch (e) {}
    pintar();
    window.scrollTo(0, 0);
  }
  function contestar(va) {
    if (enviando || !yo) return;
    enviando = true;
    aviso = '';
    pintar();
    fetch('/v/' + encodeURIComponent(datos.codigo), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jugadorId: yo, va: va })
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (x) {
        if (!x.ok) throw new Error(x.j && x.j.error);
        respuestas = x.j.respuestas;
        cambiando = false;
        window.scrollTo(0, 0);
      })
      .catch(function (e) {
        aviso = (e && e.message) || 'No se pudo guardar. Probá de nuevo.';
      })
      .then(function () { enviando = false; pintar(); });
  }
  function pintarYo(caja) {
    caja.innerHTML = '';
    if (!yo) {
      caja.appendChild(nodo('p', 'rotulo', '¿Quién sos? Tocá tu nombre'));
      var grilla = nodo('div', 'nombres');
      datos.jugadores.forEach(function (j) {
        var b = nodo('button', 'nombre');
        b.type = 'button';
        b.appendChild(nodo('strong', null, j.nombre));
        var r = respuestas[j.id];
        if (r === true) b.appendChild(nodo('span', 'va', 'VA'));
        if (r === false) b.appendChild(nodo('span', 'nova', 'NO VA'));
        b.addEventListener('click', function () { soy(j.id); });
        grilla.appendChild(b);
      });
      caja.appendChild(grilla);
      return;
    }
    if (respuestas[yo] !== undefined && !cambiando) {
      pintarConfirmacion(caja);
      return;
    }
    var p = nodo('p', 'yo', 'Sos ');
    p.appendChild(nodo('b', null, nombreDe(yo)));
    caja.appendChild(p);
    var r = respuestas[yo];
    caja.appendChild(nodo('p', 'estado',
      r === true ? 'Dijiste que vas.' : r === false ? 'Dijiste que no vas.' : 'Todavía no contestaste.'));
    var botones = nodo('div', 'botones');
    var si = nodo('button', 'si' + (r === true ? ' elegido' : ''), 'Voy');
    var no = nodo('button', 'no' + (r === false ? ' elegido' : ''), 'No voy');
    si.type = no.type = 'button';
    si.disabled = no.disabled = enviando;
    si.addEventListener('click', function () { contestar(true); });
    no.addEventListener('click', function () { contestar(false); });
    botones.appendChild(si);
    botones.appendChild(no);
    caja.appendChild(botones);
    if (aviso) caja.appendChild(nodo('p', 'aviso', aviso));
    var acciones = nodo('div', 'acciones');
    if (cambiando) {
      var dejar = nodo('button', 'cambiar', 'Dejarlo como estaba');
      dejar.type = 'button';
      dejar.addEventListener('click', function () { cambiando = false; pintar(); });
      acciones.appendChild(dejar);
    }
    var otro = nodo('button', 'cambiar', 'No soy ' + nombreDe(yo));
    otro.type = 'button';
    otro.addEventListener('click', function () { soy(null); });
    acciones.appendChild(otro);
    caja.appendChild(acciones);
  }
  /*
   * Lo que ve después de contestar, y también si vuelve a abrir el link: que
   * quedó anotado, para qué día, y cómo volver. Antes la respuesta se
   * guardaba con un renglón chico abajo de los botones y parecía que no había
   * pasado nada.
   */
  function pintarConfirmacion(caja) {
    var va = respuestas[yo] === true;
    var bloque = nodo('div', 'confirmado');
    bloque.appendChild(nodo('div', 'tilde ' + (va ? 'va' : 'nova'), va ? '✓' : '✕'));
    bloque.appendChild(nodo('p', 'listo', (va ? '¡Listo, ' : 'Listo, ') + nombreDe(yo) + (va ? '!' : '.')));
    bloque.appendChild(nodo('p', 'estado', va
      ? 'Quedaste anotado para el ' + datos.dia + '.'
      : 'Avisamos que no venís el ' + datos.dia + '.'));
    var volver = nodo('button', 'si volver', 'Volver a WhatsApp');
    volver.type = 'button';
    var comoVolver = nodo('p', 'estado', 'Tocá atrás en tu celular para volver a WhatsApp.');
    comoVolver.style.display = 'none';
    volver.addEventListener('click', function () {
      // Cerrar la pestaña es lo más directo, pero el navegador no siempre
      // deja: si sigue abierta, se dice cómo volver, que es lo que anda siempre.
      try { window.close(); } catch (e) {}
      setTimeout(function () { comoVolver.style.display = 'block'; }, 300);
    });
    bloque.appendChild(volver);
    bloque.appendChild(comoVolver);
    caja.appendChild(bloque);
    var acciones = nodo('div', 'acciones');
    var cambiar = nodo('button', 'cambiar', 'Cambiar mi respuesta');
    cambiar.type = 'button';
    cambiar.addEventListener('click', function () { cambiando = true; pintar(); });
    var otro = nodo('button', 'cambiar', 'No soy ' + nombreDe(yo));
    otro.type = 'button';
    otro.addEventListener('click', function () { soy(null); });
    acciones.appendChild(cambiar);
    acciones.appendChild(otro);
    caja.appendChild(acciones);
  }
  function pintarResumen(caja) {
    caja.innerHTML = '';
    var van = [], noVan = [], faltan = [];
    datos.jugadores.forEach(function (j) {
      var r = respuestas[j.id];
      (r === true ? van : r === false ? noVan : faltan).push(j.nombre);
    });
    caja.appendChild(nodo('p', 'rotulo', 'Cómo viene'));
    [['Van', van, 'va'], ['No van', noVan, 'nova'], ['Sin contestar', faltan, null]].forEach(function (g) {
      var linea = nodo('p', 'lista');
      linea.appendChild(nodo('b', g[2], g[0] + ' (' + g[1].length + '): '));
      linea.appendChild(document.createTextNode(g[1].length ? g[1].join(', ') : '—'));
      caja.appendChild(linea);
    });
  }
  function pintar() {
    pintarYo(document.getElementById('yo'));
    pintarResumen(document.getElementById('resumen'));
  }
  pintar();
})();
`;

/** La página de una convocatoria abierta. */
export function paginaConvocatoria({ codigo, plantel, fecha, jugadores, respuestas }, nonce) {
  const dia = comoSeLeeElDia(fecha);
  const titulo = `¿Venís el ${dia}?`;
  const datos = { codigo, jugadores, respuestas, dia };

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#0D1124">
<meta name="robots" content="noindex, nofollow">
<title>${escapar(titulo)} · ${escapar(plantel)}</title>
<meta property="og:title" content="${escapar(`¿Venís al fútbol del ${dia}?`)}">
<meta property="og:description" content="${escapar(`${plantel} · Tocá tu nombre y anotate.`)}">
${FUENTES}
<style>${ESTILOS}</style>
</head>
<body>
<main>
<p class="marca">CANCHERO</p>
<h1>${escapar(titulo)}</h1>
<p class="plantel">${escapar(plantel)}</p>
<section class="caja" id="yo"><noscript>Para anotarte, el navegador tiene que tener JavaScript activado.</noscript></section>
<section class="caja" id="resumen"></section>
<p class="pie">Armado con Canchero</p>
</main>
<script type="application/json" id="datos">${jsonSeguro(datos)}</script>
<script nonce="${nonce}">${SCRIPT}</script>
</body>
</html>`;
}

/** Lo que ve quien abre un link que ya no sirve. */
export function paginaVencida() {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#0D1124">
<meta name="robots" content="noindex, nofollow">
<title>Este link ya no está activo · Canchero</title>
${FUENTES}
<style>${ESTILOS}</style>
</head>
<body>
<main>
<p class="marca">CANCHERO</p>
<h1>Este link ya no está activo</h1>
<p class="plantel">Puede que ya hayan armado el partido o que hayan mandado uno nuevo. Pedíselo al que organiza.</p>
</main>
</body>
</html>`;
}
