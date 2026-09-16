/**
 * Mandarle un plantel a otro por nombre de usuario: enviar, ver lo que llegó,
 * aceptar y rechazar.
 *
 *     npm run prueba:envios
 *
 * Lo que importa acá es lo que tiene que ser imposible: ver lo que le mandaron
 * a otro, aceptar un envío ajeno, y que aceptar dos veces cargue el plantel
 * dos veces. Que haga falta ser amigos lo prueba prueba-amigos.mjs; acá se da
 * por hecho y se los hace amigos de entrada.
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
let numeroDeApp = 0;

const base = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true },
  max: 3,
});

/** Una cuenta lista: confirmada, con sesión y, si se pide, con nombre. */
async function cuenta(etiqueta, nombreDeUsuario) {
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
  if (nombreDeUsuario) {
    await pedir('/perfil', {
      metodo: 'PUT',
      cuerpo: { usuario: nombreDeUsuario },
    });
  }

  return { email, usuario: nombreDeUsuario ?? null, pedir };
}

const sufijo = Date.now().toString(36).slice(-5);

/** Los deja amigos: uno pide y el otro acepta. */
async function amigos(a, b) {
  await a.pedir('/amigos', { metodo: 'POST', cuerpo: { usuario: b.usuario } });
  await b.pedir(`/amigos/${a.usuario}/responder`, {
    metodo: 'POST',
    cuerpo: { acepta: true },
  });
}
const PLANTEL = {
  nombre: 'Los del sabado',
  datos: {
    jugadores: [
      { id: 'j1', nombre: 'Rodri', stats: { velocidad: 70 } },
      { id: 'j2', nombre: 'Hugo' },
    ],
    partidos: [{ id: 'm1', golesA: 3, golesB: 2 }],
  },
};

// ═══════════════════════════════════════════════════════════ sin sesión
titulo('sin sesión');
{
  const r = await fetch(API + '/envios', {
    headers: { origin: ORIGEN, 'x-forwarded-for': `198.18.${corrida}.200` },
  });
  ok('no se puede mirar lo que le llega a otro', r.status === 401, `HTTP ${r.status}`);
}

// ══════════════════════════════════════════════════════════════ mandar
titulo('mandar');
const luis = await cuenta('luis', `luis${sufijo}`);
const ana = await cuenta('ana', `ana${sufijo}`);
const sinNombre = await cuenta('sinnombre');
await amigos(luis, ana);
await amigos(ana, sinNombre);

let r = await sinNombre.pedir('/envios', {
  metodo: 'POST',
  cuerpo: { usuario: ana.usuario, plantel: PLANTEL },
});
ok('sin nombre de usuario propio no se puede mandar', r.estado === 409, r.texto);

r = await luis.pedir('/envios', {
  metodo: 'POST',
  cuerpo: { usuario: `noexiste${sufijo}`, plantel: PLANTEL },
});
ok('a alguien que no existe, 404', r.estado === 404, r.texto);

r = await luis.pedir('/envios', {
  metodo: 'POST',
  cuerpo: { usuario: luis.usuario, plantel: PLANTEL },
});
ok('a uno mismo no', r.estado === 400, r.texto);

r = await luis.pedir('/envios', { metodo: 'POST', cuerpo: { usuario: ana.usuario } });
ok('sin plantel, 400', r.estado === 400, r.texto);

r = await luis.pedir('/envios', {
  metodo: 'POST',
  cuerpo: { usuario: ana.usuario.toUpperCase(), plantel: PLANTEL },
});
ok('el nombre no distingue mayúsculas', r.estado === 200, r.texto);
const envioId = r.json?.id;

// ════════════════════════════════════════════════════════════ recibir
titulo('recibir');
r = await ana.pedir('/envios');
ok('a Ana le llegó', r.json?.envios?.length === 1, r.texto);
const llegado = r.json?.envios?.[0];
ok('dice de quién es', llegado?.de === luis.usuario, JSON.stringify(llegado));
ok('y cómo se llama el plantel', llegado?.nombre === 'Los del sabado');
ok('con cuántos jugadores viene', llegado?.jugadores === 2);
ok('y cuántos partidos', llegado?.partidos === 1);

r = await luis.pedir('/envios');
ok('el que mandó no lo ve en su bandeja', r.json?.envios?.length === 0, r.texto);

// ═══════════════════════════════════════════════ el de otro no se toca
titulo('el envío de otro no se toca');
r = await sinNombre.pedir(`/envios/${envioId}/aceptar`, { metodo: 'POST' });
ok('un tercero no lo puede aceptar', r.estado === 404, r.texto);

r = await sinNombre.pedir(`/envios/${envioId}/rechazar`, { metodo: 'POST' });
ok('ni rechazar', r.estado === 404, r.texto);

r = await ana.pedir('/envios');
ok('y sigue estando para Ana', r.json?.envios?.length === 1);

// ═══════════════════════════════════════════════════════════ aceptar
titulo('aceptar');
r = await ana.pedir(`/envios/${envioId}/aceptar`, { metodo: 'POST' });
ok('Ana lo acepta', r.estado === 200, r.texto);
ok('y le llega el plantel entero', r.json?.datos?.jugadores?.length === 2, r.texto);
ok('con los datos adentro', r.json?.datos?.jugadores?.[0]?.stats?.velocidad === 70);
ok('y los partidos', r.json?.datos?.partidos?.length === 1);

r = await ana.pedir(`/envios/${envioId}/aceptar`, { metodo: 'POST' });
ok('aceptar dos veces no lo carga dos veces', r.estado === 404, r.texto);

r = await ana.pedir('/envios');
ok('y deja de aparecer como pendiente', r.json?.envios?.length === 0);

// ══════════════════════════════════════════════════════════ rechazar
titulo('rechazar');
r = await luis.pedir('/envios', {
  metodo: 'POST',
  cuerpo: { usuario: ana.usuario, plantel: { ...PLANTEL, nombre: 'Otro mas' } },
});
const segundo = r.json?.id;
ok('llega uno nuevo', r.estado === 200 && !!segundo, r.texto);

r = await ana.pedir(`/envios/${segundo}/rechazar`, { metodo: 'POST' });
ok('Ana lo rechaza', r.estado === 200, r.texto);

r = await ana.pedir('/envios');
ok('y la bandeja queda vacía', r.json?.envios?.length === 0, r.texto);

r = await ana.pedir(`/envios/${segundo}/aceptar`, { metodo: 'POST' });
ok('lo rechazado no se puede aceptar después', r.estado === 404, r.texto);

// ════════════════════════════════════════════════════════════ la foto
titulo('la foto viaja a la carpeta del que recibe');
{
  const pixel = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );
  const permiso = await luis.pedir('/fotos/permiso', {
    metodo: 'POST',
    cuerpo: { tipo: 'image/png' },
  });
  await fetch(permiso.json.url, {
    method: 'PUT',
    headers: { 'content-type': 'image/png' },
    body: pixel,
  });
  const suya = permiso.json.publica;

  r = await luis.pedir('/envios', {
    metodo: 'POST',
    cuerpo: {
      usuario: ana.usuario,
      plantel: {
        nombre: 'Con foto',
        datos: { jugadores: [{ id: 'j1', nombre: 'Rodri', foto: suya }], partidos: [] },
      },
    },
  });
  const conFoto = r.json?.id;

  r = await ana.pedir(`/envios/${conFoto}/aceptar`, { metodo: 'POST' });
  const recibida = r.json?.datos?.jugadores?.[0]?.foto;
  ok('la foto cambió de URL', !!recibida && recibida !== suya, String(recibida));

  const suId = permiso.json.key.split('/')[0];
  ok(
    'y ya no está bajo la carpeta del que mandó',
    !!recibida && !recibida.includes(`/${suId}/`),
    String(recibida)
  );

  const mirar = await fetch(recibida);
  ok('la copia se puede ver', mirar.ok, `HTTP ${mirar.status}`);
  const bytes = mirar.ok ? Buffer.from(await mirar.arrayBuffer()) : null;
  ok('y es el mismo archivo', !!bytes && bytes.equals(pixel));

  const original = await fetch(suya);
  ok('la del que mandó sigue estando', original.ok, `HTTP ${original.status}`);
}

// ══════════════════════════════════════════════════════════ barrido
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
