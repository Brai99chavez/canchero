/**
 * Darse de baja: que se vaya la cuenta entera y nada de otro.
 *
 *     npm run prueba:baja
 *
 * Lo que importa es lo que tiene que ser imposible: borrar sin la contraseña,
 * y que la baja de uno se lleve puesto algo del de al lado.
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

const base = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true },
  max: 3,
});

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
    for (const cruda of r.headers.getSetCookie ? r.headers.getSetCookie() : []) {
      const par = cruda.split(';')[0];
      if (par.includes('better-auth.session_token=')) cookie = par;
    }
    const texto = await r.text();
    let json = null;
    try { json = JSON.parse(texto); } catch {}
    return { estado: r.status, json, texto };
  };

  await pedir('/api/auth/sign-up/email', {
    metodo: 'POST',
    cuerpo: { email, password: CLAVE, name: etiqueta },
  });
  await base.query('update "user" set "emailVerified" = true where email = $1', [email]);
  await pedir('/api/auth/sign-in/email', { metodo: 'POST', cuerpo: { email, password: CLAVE } });

  const { rows } = await base.query('select id from "user" where email = $1', [email]);
  return { email, id: rows[0]?.id, pedir };
}

const plantel = (nombre) => ({
  nombre,
  llegada: '2026-01-01T00:00:00.000Z',
  datos: { jugadores: [{ id: 'j1', nombre: 'Rodri' }], partidos: [] },
});

const luis = await cuenta('baja');
const ana = await cuenta('vecina');

// Los dos con algo cargado, y amigos entre si.
await luis.pedir('/planteles/p1', { metodo: 'PUT', cuerpo: plantel('Los del sabado') });
await ana.pedir('/planteles/p1', { metodo: 'PUT', cuerpo: plantel('Los de Ana') });
await luis.pedir('/perfil', { metodo: 'PUT', cuerpo: { usuario: `luis${corrida}` } });
await ana.pedir('/perfil', { metodo: 'PUT', cuerpo: { usuario: `ana${corrida}` } });
await luis.pedir('/amigos', { metodo: 'POST', cuerpo: { usuario: `ana${corrida}` } });
await ana.pedir(`/amigos/luis${corrida}/responder`, { metodo: 'POST', cuerpo: { acepta: true } });
await luis.pedir(`/mensajes/ana${corrida}`, { metodo: 'POST', cuerpo: { texto: 'hola' } });

// ═══════════════════════════════════════════ no se borra de cualquier forma
titulo('no se borra de cualquier forma');
let r = await luis.pedir('/cuenta/borrar', { metodo: 'POST', cuerpo: {} });
ok('sin contraseña se rechaza', r.estado === 400, r.texto);

r = await luis.pedir('/cuenta/borrar', { metodo: 'POST', cuerpo: { password: 'otraCosa123' } });
ok('con la contraseña equivocada tampoco', r.estado === 401, r.texto);

r = await luis.pedir('/planteles');
ok('y la cuenta sigue entera', r.json?.planteles?.length === 1, r.texto);

const sinSesion = await fetch(`${API}/cuenta/borrar`, {
  method: 'POST',
  headers: { origin: ORIGEN, 'content-type': 'application/json' },
  body: JSON.stringify({ password: CLAVE }),
});
ok('y sin sesión da 401', sinSesion.status === 401, `HTTP ${sinSesion.status}`);

// ═══════════════════════════════════════════════════════ la baja de verdad
titulo('la baja se lleva todo');
r = await luis.pedir('/cuenta/borrar', { metodo: 'POST', cuerpo: { password: CLAVE } });
ok('con la contraseña buena se borra', r.estado === 200, r.texto);

const queda = async (sql, args) => (await base.query(sql, args)).rows[0].n;
ok('no queda el usuario', (await queda('select count(*)::int as n from "user" where id = $1', [luis.id])) === 0);
ok('ni sus planteles', (await queda('select count(*)::int as n from planteles where dueno = $1', [luis.id])) === 0);
ok('ni su perfil', (await queda('select count(*)::int as n from perfiles where usuario_id = $1', [luis.id])) === 0);
ok('ni sus sesiones', (await queda('select count(*)::int as n from "session" where "userId" = $1', [luis.id])) === 0);
ok('ni su contraseña', (await queda('select count(*)::int as n from "account" where "userId" = $1', [luis.id])) === 0);
ok('ni la amistad', (await queda('select count(*)::int as n from amistades where uno = $1 or otro = $1', [luis.id])) === 0);
ok('ni los mensajes', (await queda('select count(*)::int as n from mensajes where autor = $1', [luis.id])) === 0);

r = await luis.pedir('/planteles');
ok('la sesión deja de valer', r.estado === 401, r.texto);

// ═════════════════════════════════════════════ y a la vecina no le pasa nada
titulo('y a la vecina no le pasa nada');
r = await ana.pedir('/planteles');
ok('sigue pudiendo entrar', r.estado === 200, r.texto);
ok('con su plantel intacto', r.json?.planteles?.[0]?.nombre === 'Los de Ana', r.texto);

r = await ana.pedir('/perfil');
ok('y su perfil también', r.json?.usuario === `ana${corrida}`, r.texto);

// ══════════════════════════════════════════════════════════ barrido
titulo('barrido');
try {
  const { rowCount } = await base.query(`delete from "user" where email like '%@canchero.test'`);
  ok(`se borraron las ${rowCount} cuentas de prueba`, true);
} catch (error) {
  ok('se borran las cuentas de prueba', false, error.message);
} finally {
  await base.end();
}

console.log('');
console.log(fallos === 0 ? 'listo, todo en verde.' : `${fallos} fallaron.`);
process.exit(fallos === 0 ? 0 : 1);
