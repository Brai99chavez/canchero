/**
 * El perfil: el nombre de usuario y la foto.
 *
 * Lo que se verifica no es que "ande", sino lo que tiene que ser imposible:
 * que dos cuentas se llamen igual, que una se ponga de foto la de otra, y que
 * un cliente modificado se escriba el plan Pro mandando un PUT.
 *
 *     npm run prueba:perfil
 *
 * Contra el servidor local, levantado con:
 *
 *     node --env-file=.env -e "delete process.env.RESEND_API_KEY; import('./src/index.js')"
 *
 * Borra al terminar las cuentas @canchero.test que crea.
 *
 * Con PRUEBA_API se le puede apuntar a Render, pero de a una: ahí las IP
 * falsas no valen —el proxy pone la de verdad— así que todas las corridas caen
 * en el mismo balde del límite de intentos y la segunda se come un 429. Eso es
 * el límite haciendo su trabajo, no algo roto.
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
const sufijo = Date.now().toString(36).slice(-5);
let numeroDeApp = 0;

const base = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true },
  max: 3,
});

/** Una cuenta lista para usar: registrada, confirmada y con la sesión abierta. */
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
      // `__Secure-` adelante cuando va por HTTPS: se busca por lo que contiene
      // y no por como empieza, así sirve contra Render y contra el local.
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
  // Se confirma por la base: mandar el mail y leerlo del log ya lo prueba
  // prueba-cuentas.mjs, y acá sólo hace falta una cuenta que pueda entrar.
  await base.query('update "user" set "emailVerified" = true where email = $1', [
    email,
  ]);
  await pedir('/api/auth/sign-in/email', {
    metodo: 'POST',
    cuerpo: { email, password: CLAVE },
  });

  return { email, pedir };
}

/** Un PNG de un pixel, para tener algo real que subir. */
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

/** Sube una foto de verdad a R2 y devuelve su URL pública. */
async function subirFoto(quien, destino) {
  const permiso = await quien.pedir('/fotos/permiso', {
    metodo: 'POST',
    cuerpo: { tipo: 'image/png', destino },
  });
  if (permiso.estado !== 200) return { error: permiso.texto };
  const puesta = await fetch(permiso.json.url, {
    method: 'PUT',
    headers: { 'content-type': 'image/png' },
    body: PIXEL,
  });
  if (!puesta.ok) return { error: `R2 respondió ${puesta.status}` };
  return { publica: permiso.json.publica, key: permiso.json.key };
}

// ════════════════════════════════════════════════════════ sin sesión
titulo('sin sesión');
{
  const r = await fetch(API + '/perfil', {
    headers: { origin: ORIGEN, 'x-forwarded-for': `198.18.${corrida}.200` },
  });
  ok('el perfil pide sesión', r.status === 401, `HTTP ${r.status}`);

  const w = await fetch(API + '/perfil', {
    method: 'PUT',
    headers: {
      origin: ORIGEN,
      'content-type': 'application/json',
      'x-forwarded-for': `198.18.${corrida}.200`,
    },
    body: JSON.stringify({ usuario: 'colado' }),
  });
  ok('y tampoco se puede escribir', w.status === 401, `HTTP ${w.status}`);
}

// ═══════════════════════════════════════════════════════ recién creada
titulo('una cuenta recién creada');
const uno = await cuenta('perfil');
let r = await uno.pedir('/perfil');
ok('el perfil responde', r.estado === 200, r.texto);
ok('viene sin nombre de usuario', r.json?.usuario === null, r.texto);
ok('y sin foto', r.json?.foto === null, r.texto);
ok('y en plan gratis', r.json?.plan === 'gratis', r.texto);
ok('trae el mail de la cuenta', r.json?.email === uno.email, r.texto);

// ═══════════════════════════════════════ si un nombre está libre
titulo('si un nombre está libre');
{
  const sinSesion = async (nombre) => {
    const r = await fetch(
      `${API}/usuarios/libre?nombre=${encodeURIComponent(nombre)}`,
      { headers: { origin: ORIGEN, 'x-forwarded-for': `198.18.${corrida}.210` } }
    );
    return { estado: r.status, json: await r.json().catch(() => null) };
  };

  // Sin sesión a propósito: hace falta al crear la cuenta, cuando todavía no
  // hay con qué identificarse.
  let x = await sinSesion(`nuevo${sufijo}`);
  ok('se puede preguntar sin sesión', x.estado === 200, JSON.stringify(x.json));
  ok('y uno que no existe está libre', x.json?.libre === true);

  x = await sinSesion('ab');
  ok('uno corto no está libre', x.json?.libre === false);
  ok('y dice por qué', typeof x.json?.problema === 'string');

  x = await sinSesion('admin');
  ok('uno reservado tampoco', x.json?.libre === false);

  x = await sinSesion(`nuevo${sufijo}`);
  ok('no devuelve nada más que sí o no', Object.keys(x.json).length <= 2, JSON.stringify(x.json));
}

// ══════════════════════════════════════════════════ elegir el nombre
titulo('elegir el nombre');
r = await uno.pedir('/perfil', { metodo: 'PUT', cuerpo: { usuario: 'ElBrai' } });
ok('acepta un nombre libre', r.estado === 200, r.texto);
ok('y lo guarda en minúscula', r.json?.usuario === 'elbrai', r.texto);

r = await uno.pedir('/perfil');
ok('queda guardado', r.json?.usuario === 'elbrai', r.texto);

for (const [nombre, porque] of [
  ['ab', 'demasiado corto'],
  ['a'.repeat(21), 'demasiado largo'],
  ['.brai', 'empieza con un punto'],
  ['brai.', 'termina con un punto'],
  ['bra i', 'tiene un espacio'],
  ['braí', 'tiene un acento'],
  ['brai@casa', 'tiene una arroba'],
  ['admin', 'está reservado'],
  ['canchero', 'está reservado'],
]) {
  const x = await uno.pedir('/perfil', {
    metodo: 'PUT',
    cuerpo: { usuario: nombre },
  });
  ok(`rechaza "${nombre}": ${porque}`, x.estado === 400, x.texto);
}

r = await uno.pedir('/perfil');
ok('y ninguno de esos pisó el que ya estaba', r.json?.usuario === 'elbrai', r.texto);

{
  const r2 = await fetch(`${API}/usuarios/libre?nombre=elbrai`, {
    headers: { origin: ORIGEN, 'x-forwarded-for': `198.18.${corrida}.211` },
  });
  const j = await r2.json();
  ok('y uno ya tomado figura como no libre', j?.libre === false, JSON.stringify(j));
}

// ══════════════════════════════════════════════════ dos no pueden llamarse igual
titulo('dos no pueden llamarse igual');
const dos = await cuenta('otro');
r = await dos.pedir('/perfil', { metodo: 'PUT', cuerpo: { usuario: 'elbrai' } });
ok('el nombre tomado se rechaza', r.estado === 409, r.texto);

r = await dos.pedir('/perfil', { metodo: 'PUT', cuerpo: { usuario: 'ELBRAI' } });
ok('y en mayúsculas tampoco cuela', r.estado === 409, r.texto);

r = await dos.pedir('/perfil', { metodo: 'PUT', cuerpo: { usuario: 'elbrai2' } });
ok('uno parecido sí entra', r.estado === 200 && r.json?.usuario === 'elbrai2', r.texto);

// ══════════════════════════════════════════════════════════════ la foto
titulo('la foto');
const mia = await subirFoto(uno, 'perfil');
ok('se puede subir una foto de perfil', !mia.error, mia.error);

if (mia.publica) {
  r = await uno.pedir('/perfil', { metodo: 'PUT', cuerpo: { foto: mia.publica } });
  ok('se puede poner de perfil', r.estado === 200, r.texto);
  ok('y queda guardada', r.json?.foto === mia.publica, r.texto);
  ok('sin borrar el nombre', r.json?.usuario === 'elbrai', r.texto);

  const ajena = await subirFoto(dos, 'perfil');
  r = await uno.pedir('/perfil', {
    metodo: 'PUT',
    cuerpo: { foto: ajena.publica },
  });
  ok('la foto de otra cuenta se rechaza', r.estado === 400, r.texto);

  r = await uno.pedir('/perfil', {
    metodo: 'PUT',
    cuerpo: { foto: 'https://cualquier.cosa/foto.jpg' },
  });
  ok('una URL de afuera también', r.estado === 400, r.texto);

  r = await uno.pedir('/perfil');
  ok('y la foto buena sigue puesta', r.json?.foto === mia.publica, r.texto);

  // Cambiarla borra la anterior del bucket: si no, cada cambio dejaría un
  // archivo colgado para siempre.
  const nueva = await subirFoto(uno, 'perfil');
  await uno.pedir('/perfil', { metodo: 'PUT', cuerpo: { foto: nueva.publica } });
  const vieja = await fetch(mia.publica);
  ok('al cambiarla, la anterior se borra del bucket', vieja.status === 404, `HTTP ${vieja.status}`);
  const puesta = await fetch(nueva.publica);
  ok('y la nueva se puede ver', puesta.status === 200, `HTTP ${puesta.status}`);

  r = await uno.pedir('/perfil', { metodo: 'PUT', cuerpo: { foto: null } });
  ok('se puede sacar la foto', r.estado === 200 && r.json?.foto === null, r.texto);
}

r = await uno.pedir('/fotos/permiso', {
  metodo: 'POST',
  cuerpo: { tipo: 'image/png', destino: 'publico/logo-mail.png' },
});
ok('no se puede subir fuera de la carpeta propia', r.estado === 400, r.texto);

// ═════════════════════════════════════════════════════ el plan no se toca
titulo('el plan no se toca');
r = await uno.pedir('/perfil', {
  metodo: 'PUT',
  cuerpo: { usuario: 'elbrai', plan: 'pro' },
});
ok('mandar plan pro no da error', r.estado === 200, r.texto);
ok('pero sigue en gratis', r.json?.plan === 'gratis', r.texto);

r = await uno.pedir('/perfil');
ok('y tampoco quedó escrito en la base', r.json?.plan === 'gratis', r.texto);

// ══════════════════════════════════════════════════════ sacar el nombre
titulo('sacar el nombre');
r = await uno.pedir('/perfil', { metodo: 'PUT', cuerpo: { usuario: '' } });
ok('se puede quedar sin nombre', r.estado === 200 && r.json?.usuario === null, r.texto);

r = await dos.pedir('/perfil', { metodo: 'PUT', cuerpo: { usuario: 'elbrai' } });
ok('y ahí otro lo puede tomar', r.estado === 200, r.texto);

// ══════════════════════════════════════════════════════════════ barrido
titulo('barrido');
try {
  const { rowCount } = await base.query(
    `delete from "user" where email like '%@canchero.test'`
  );
  ok(`se borraron las ${rowCount} cuentas de prueba`, true);
} catch (error) {
  ok('se borran las cuentas de prueba', false, error.message);
} finally {
  await base.end();
}

console.log('');
console.log(fallos === 0 ? 'listo, todo en verde.' : `${fallos} fallaron.`);
process.exit(fallos === 0 ? 0 : 1);
