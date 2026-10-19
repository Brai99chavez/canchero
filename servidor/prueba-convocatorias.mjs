/**
 * El link de "¿quién viene?": abrirlo, contestar desde la página y leer las
 * respuestas desde la app.
 *
 *     npm run prueba:convocatorias
 *
 * Lo que importa es lo que tiene que ser imposible: ver o cerrar la
 * convocatoria de otro, anotar a alguien que no está en el plantel, que un
 * link cerrado siga andando, y que un nombre con código adentro se ejecute en
 * la página.
 *
 * Borra al terminar las cuentas @canchero.test que crea.
 */
import pg from 'pg';

const API = process.env.PRUEBA_API ?? 'http://localhost:3000';
const ORIGEN = 'canchero://';
const CLAVE = 'claveLargaSegura1';

let fallos = 0;
const ok = (nombre, condicion, detalle) => {
  if (!condicion) fallos++;
  console.log(`${condicion ? 'OK  ' : 'MAL '} ${nombre}`);
  if (!condicion && detalle) console.log(`       ${String(detalle).slice(0, 160)}`);
};
const titulo = (t) => console.log(`\n— ${t} —`);

const corrida = 1 + Math.floor(Math.random() * 250);
let numeroDeApp = 0;

const url = process.env.DATABASE_URL;
const base = new pg.Pool({
  connectionString: url,
  // Igual que el servidor: sin TLS sólo una base de esta misma compu.
  ssl: /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(url)
    ? false
    : { rejectUnauthorized: true },
  max: 3,
});

/** Un pedido sin sesión, como el de la página que se abre desde WhatsApp. */
async function publico(camino, { metodo = 'GET', cuerpo } = {}) {
  const r = await fetch(API + camino, {
    method: metodo,
    headers: cuerpo ? { 'content-type': 'application/json' } : {},
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const texto = await r.text();
  let json = null;
  try {
    json = JSON.parse(texto);
  } catch {}
  return { estado: r.status, json, texto, headers: r.headers };
}

/** Una cuenta lista: confirmada y con sesión. */
async function cuenta(etiqueta) {
  const email = `${etiqueta}-${Date.now()}-${++numeroDeApp}@canchero.test`;
  const ip = `198.18.${corrida}.${numeroDeApp}`;
  let cookie = '';

  const pedir = async (camino, { metodo = 'GET', cuerpo } = {}) => {
    const llevaCuerpo = metodo !== 'GET';
    const r = await fetch(API + camino, {
      method: metodo,
      headers: {
        origin: ORIGEN,
        'x-forwarded-for': ip,
        ...(cookie ? { cookie } : {}),
        ...(llevaCuerpo ? { 'content-type': 'application/json' } : {}),
      },
      body: llevaCuerpo ? JSON.stringify(cuerpo ?? {}) : undefined,
    });
    const set = r.headers.getSetCookie ? r.headers.getSetCookie() : [];
    for (const cruda of set) {
      const par = cruda.split(';')[0];
      if (par.includes('better-auth.session_token=')) cookie = par;
    }
    const texto = await r.text();
    let json = null;
    try {
      json = JSON.parse(texto);
    } catch {}
    return { estado: r.status, json, texto };
  };

  await pedir('/api/auth/sign-up/email', {
    metodo: 'POST',
    cuerpo: { email, password: CLAVE, name: etiqueta },
  });
  await base.query('update "user" set "emailVerified" = true where email = $1', [
    email,
  ]);
  await pedir('/api/auth/sign-in/email', {
    metodo: 'POST',
    cuerpo: { email, password: CLAVE },
  });
  return { email, pedir };
}

const MALICIOSO = '<img src=x onerror="alert(1)"></script><script>alert(2)</script>';

try {
  const ana = await cuenta('ana');
  const beto = await cuenta('beto');

  const plantelId = `p-conv-${Date.now()}`;
  await ana.pedir(`/planteles/${plantelId}`, {
    metodo: 'PUT',
    cuerpo: {
      nombre: 'Los del <b>jueves</b>',
      llegada: new Date().toISOString(),
      datos: {
        jugadores: [
          { id: 'juan', nombre: 'Juan', posicion: 'MED', stats: {} },
          { id: 'pedro', nombre: 'Pedro', posicion: 'DEF', stats: {} },
          { id: 'malo', nombre: MALICIOSO, posicion: 'DEL', stats: {} },
        ],
        partidos: [],
      },
    },
  });

  titulo('abrir la convocatoria');
  const sinSesion = await publico('/convocatorias', {
    metodo: 'POST',
    cuerpo: { plantelId, fecha: '2026-10-25' },
  });
  ok('sin sesión no se abre', sinSesion.estado === 401, sinSesion.estado);

  const noExiste = await ana.pedir('/convocatorias', {
    metodo: 'POST',
    cuerpo: { plantelId: 'no-existe', fecha: '2026-10-25' },
  });
  ok('de un plantel que no está en la nube, no', noExiste.estado === 409, noExiste.texto);

  const delOtro = await beto.pedir('/convocatorias', {
    metodo: 'POST',
    cuerpo: { plantelId, fecha: '2026-10-25' },
  });
  ok('de un plantel ajeno, tampoco', delOtro.estado === 409, delOtro.texto);

  const fechaMala = await ana.pedir('/convocatorias', {
    metodo: 'POST',
    cuerpo: { plantelId, fecha: '2026-02-30' },
  });
  ok('con un día que no existe, no', fechaMala.estado === 400, fechaMala.texto);

  const abierta = await ana.pedir('/convocatorias', {
    metodo: 'POST',
    cuerpo: { plantelId, fecha: '2026-10-25' },
  });
  const conv = abierta.json?.convocatoria;
  ok('se abre', abierta.estado === 200 && typeof conv?.codigo === 'string', abierta.texto);
  ok('con un código largo, que no se adivina', conv?.codigo.length >= 12, conv?.codigo);
  ok('y el link apunta a la página', conv?.url?.endsWith(`/v/${conv?.codigo}`), conv?.url);

  const otraVez = await ana.pedir('/convocatorias', {
    metodo: 'POST',
    cuerpo: { plantelId, fecha: '2026-10-25' },
  });
  ok(
    'pedirla de nuevo para el mismo día devuelve la misma',
    otraVez.json?.convocatoria?.codigo === conv?.codigo
  );

  titulo('la página');
  const pagina = await publico(`/v/${conv.codigo}`);
  ok('se abre sin sesión', pagina.estado === 200, pagina.estado);
  ok('pregunta por el día, escrito', pagina.texto.includes('¿Venís el domingo 25 de octubre?'));
  ok(
    'con el nombre del plantel, escapado',
    pagina.texto.includes('Los del &lt;b&gt;jueves&lt;/b&gt;') && !pagina.texto.includes('<b>jueves')
  );
  const csp = pagina.headers.get('content-security-policy') ?? '';
  const nonce = csp.match(/'nonce-([^']+)'/)?.[1];
  ok('sólo corre su propio script', Boolean(nonce) && !csp.includes("script-src 'unsafe-inline'"), csp);
  const scripts = [...pagina.texto.matchAll(/<script([^>]*)>/g)].map((m) => m[1]);
  ok(
    'todos sus scripts ejecutables llevan el nonce',
    scripts.every((a) => a.includes('application/json') || a.includes(`nonce="${nonce}"`)),
    scripts.join(' | ')
  );
  ok(
    'un nombre con código adentro no queda como HTML',
    !pagina.texto.includes('<img src=x') && !pagina.texto.includes('<script>alert(2)'),
    pagina.texto.slice(pagina.texto.indexOf('id="datos"'), pagina.texto.indexOf('id="datos"') + 300)
  );
  ok('no se indexa', (pagina.headers.get('x-robots-tag') ?? '').includes('noindex'));
  ok('ni muestra fotos ni puntajes', !pagina.texto.includes('stats') && !pagina.texto.includes('posicion'));

  titulo('contestar');
  const voy = await publico(`/v/${conv.codigo}`, {
    metodo: 'POST',
    cuerpo: { jugadorId: 'juan', va: true },
  });
  ok('Juan dice que va', voy.estado === 200 && voy.json?.respuestas?.juan === true, voy.texto);
  const noVoy = await publico(`/v/${conv.codigo}`, {
    metodo: 'POST',
    cuerpo: { jugadorId: 'pedro', va: false },
  });
  ok('Pedro dice que no', noVoy.json?.respuestas?.pedro === false, noVoy.texto);
  const cambia = await publico(`/v/${conv.codigo}`, {
    metodo: 'POST',
    cuerpo: { jugadorId: 'pedro', va: true },
  });
  ok('y después cambia de idea', cambia.json?.respuestas?.pedro === true, cambia.texto);

  const inventado = await publico(`/v/${conv.codigo}`, {
    metodo: 'POST',
    cuerpo: { jugadorId: 'alguien', va: true },
  });
  ok('a alguien que no está en el plantel no se lo puede anotar', inventado.estado === 400, inventado.texto);
  const sinRespuesta = await publico(`/v/${conv.codigo}`, {
    metodo: 'POST',
    cuerpo: { jugadorId: 'juan', va: 'si' },
  });
  ok('sin un sí o un no, nada', sinRespuesta.estado === 400, sinRespuesta.texto);

  titulo('lo que ve la app');
  const vista = await ana.pedir(`/convocatorias?plantel=${encodeURIComponent(plantelId)}`);
  const respuestas = vista.json?.convocatoria?.respuestas ?? {};
  ok(
    'la que organiza ve las respuestas',
    respuestas.juan?.va === true && respuestas.pedro?.va === true,
    vista.texto
  );
  const ajena = await beto.pedir(`/convocatorias?plantel=${encodeURIComponent(plantelId)}`);
  ok('otro no ve la convocatoria de ella', ajena.json?.convocatoria === null, ajena.texto);
  await beto.pedir(`/convocatorias/${conv.codigo}`, { metodo: 'DELETE' });
  const sigue = await publico(`/v/${conv.codigo}`);
  ok('ni la puede cerrar', sigue.estado === 200, sigue.estado);

  titulo('otro día, otro link');
  const nueva = await ana.pedir('/convocatorias', {
    metodo: 'POST',
    cuerpo: { plantelId, fecha: '2026-11-01' },
  });
  const conv2 = nueva.json?.convocatoria;
  ok('para otro día se abre una nueva', conv2?.codigo && conv2.codigo !== conv.codigo, nueva.texto);
  ok('que arranca sin respuestas', Object.keys(conv2?.respuestas ?? { x: 1 }).length === 0);
  const vieja = await publico(`/v/${conv.codigo}`);
  ok('y el link viejo deja de andar', vieja.estado === 404 && vieja.texto.includes('ya no está activo'), vieja.estado);
  const contestarVieja = await publico(`/v/${conv.codigo}`, {
    metodo: 'POST',
    cuerpo: { jugadorId: 'juan', va: true },
  });
  ok('ni deja contestar', contestarVieja.estado === 404, contestarVieja.texto);

  titulo('cerrar');
  await ana.pedir(`/convocatorias/${conv2.codigo}`, { metodo: 'DELETE' });
  const cerrada = await publico(`/v/${conv2.codigo}`);
  ok('cerrada, el link ya no anda', cerrada.estado === 404, cerrada.estado);
  const ninguna = await ana.pedir(`/convocatorias?plantel=${encodeURIComponent(plantelId)}`);
  ok('y la app ya no la ve abierta', ninguna.json?.convocatoria === null, ninguna.texto);

  titulo('plantel borrado');
  const otra = await ana.pedir('/convocatorias', {
    metodo: 'POST',
    cuerpo: { plantelId, fecha: '2026-11-08' },
  });
  await ana.pedir(`/planteles/${plantelId}`, { metodo: 'DELETE' });
  const sinPlantel = await publico(`/v/${otra.json?.convocatoria?.codigo}`);
  ok('con el plantel borrado, el link no anda', sinPlantel.estado === 404, sinPlantel.estado);
} finally {
  const { rowCount } = await base.query(
    `delete from "user" where email like '%@canchero.test'`
  );
  console.log(`\n(${rowCount} cuentas de prueba borradas)`);
  await base.end();
}

console.log(fallos === 0 ? '\nTodo bien.' : `\n${fallos} mal.`);
process.exit(fallos === 0 ? 0 : 1);
