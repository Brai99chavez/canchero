/**
 * El camino completo de una foto: permiso, subida a R2, verla, que viaje en el
 * backup y que se pueda borrar.
 *
 *     npm run prueba:fotos
 *
 * Corre contra Render y R2 de verdad, no contra el local: lo que se quiere
 * saber es que el despliegue tiene bien las claves del bucket. Con PRUEBA_API
 * se le puede apuntar a otro lado.
 *
 * Borra al terminar la cuenta que crea.
 */
import pg from 'pg';

const API = process.env.PRUEBA_API ?? 'https://canchero.onrender.com';
const mail = `foto-${Date.now()}@canchero.test`;
const clave = 'unaClaveLarga123';
let cookie = '';

let fallos = 0;
const ok = (n, c, detalle) => {
  if (!c) fallos++;
  console.log(`${c ? 'OK  ' : 'MAL '} ${n}`);
  if (!c && detalle) console.log(`       ${String(detalle).slice(0, 160)}`);
};

async function pedir(camino, opciones = {}) {
  const metodo = opciones.metodo ?? 'GET';
  const r = await fetch(API + camino, {
    method: metodo,
    headers: {
      origin: 'canchero://',
      ...(cookie ? { cookie } : {}),
      // En todo lo que no sea GET: Better Auth contesta 415 sin esto, aunque
      // el pedido no lleve datos.
      ...(metodo !== 'GET' ? { 'content-type': 'application/json' } : {}),
    },
    body: metodo !== 'GET' ? JSON.stringify(opciones.cuerpo ?? {}) : undefined,
  });
  const set = r.headers.getSetCookie ? r.headers.getSetCookie() : [];
  for (const cruda of set) {
    const par = cruda.split(';')[0];
    /*
     * Sobre HTTPS la cookie se llama `__Secure-better-auth.session_token` y no
     * `better-auth.session_token`: el prefijo se lo pone Better Auth cuando la
     * marca Secure. Buscar el nombre pelado andaba contra localhost y fallaba
     * contra Render, que es donde importa.
     */
    if (par.includes('better-auth.session_token=')) cookie = par;
  }
  const texto = await r.text();
  let cuerpo = null;
  try {
    cuerpo = JSON.parse(texto);
  } catch {}
  return { estado: r.status, cuerpo, texto };
}

// Un PNG de 1x1 real, para tener bytes de verdad.
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

const base = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true },
  max: 2,
});

/** El id del plantel al que pertenecerian estas fotos. */
const PLANTEL = 'plantel-de-prueba';

let r = await pedir('/fotos/permiso', {
  metodo: 'POST',
  cuerpo: { tipo: 'image/png', destino: PLANTEL },
});
ok('sin sesion no da permiso', r.estado === 401);

await pedir('/api/auth/sign-up/email', {
  metodo: 'POST',
  cuerpo: { email: mail, password: clave, name: 'Foto' },
});
/*
 * Registrarse ya no deja adentro: hay que confirmar el mail primero. Se marca
 * por la base porque acá interesa la foto, y el circuito del mail lo prueba
 * entero prueba-cuentas.mjs.
 */
await base.query('update "user" set "emailVerified" = true where email = $1', [
  mail,
]);
r = await pedir('/api/auth/sign-in/email', {
  metodo: 'POST',
  cuerpo: { email: mail, password: clave },
});
ok('entra con la cuenta recien creada', r.estado === 200, r.texto);

r = await pedir('/fotos/permiso', {
  metodo: 'POST',
  cuerpo: { tipo: 'image/gif', destino: PLANTEL },
});
ok('formato no soportado rechazado', r.estado === 400, r.texto);

r = await pedir('/fotos/permiso', {
  metodo: 'POST',
  cuerpo: { tipo: 'image/png' },
});
ok('sin destino tampoco da permiso', r.estado === 400, r.texto);

r = await pedir('/fotos/permiso', {
  metodo: 'POST',
  cuerpo: { tipo: 'image/png', destino: PLANTEL },
});
ok('da permiso de subida', r.estado === 200 && !!r.cuerpo?.url, r.texto);

if (r.estado === 200) {
  const { url, publica, key } = r.cuerpo;
  ok(
    'la key es {cuenta}/{plantel}/{azar}',
    typeof key === 'string' && key.includes(`/${PLANTEL}/`)
  );

  const subida = await fetch(url, {
    method: 'PUT',
    headers: { 'content-type': 'image/png' },
    body: png,
  });
  ok('sube a R2', subida.ok, `HTTP ${subida.status}`);

  // Y se puede mirar por la URL publica.
  const vista = await fetch(publica);
  const bytes = vista.ok ? Buffer.from(await vista.arrayBuffer()) : null;
  ok('se ve por la URL publica', vista.ok, `HTTP ${vista.status}`);
  ok('llega el mismo archivo', !!bytes && bytes.equals(png));

  // El plantel la lleva en el backup.
  await pedir('/planteles', {
    metodo: 'PUT',
    cuerpo: {
      planteles: [
        {
          id: 'pf1',
          nombre: 'Con fotos',
          llegada: '2026-01-01T00:00:00.000Z',
          datos: {
            jugadores: [{ id: 'j1', nombre: 'Rodri', foto: publica }],
            partidos: [],
          },
        },
      ],
    },
  });
  r = await pedir('/planteles');
  ok(
    'la foto viaja en el backup',
    r.cuerpo?.planteles?.[0]?.datos?.jugadores?.[0]?.foto === publica,
    r.texto
  );

  // Borrar: sólo lo propio.
  r = await pedir('/fotos/borrar', { metodo: 'POST', cuerpo: { urls: [publica] } });
  ok('borra la foto propia', r.estado === 200, r.texto);
  const despues = await fetch(publica);
  ok('ya no se ve', !despues.ok, `HTTP ${despues.status}`);
}

// La cuenta se lleva sus planteles y su fila de perfil por la clave foránea.
try {
  const { rowCount } = await base.query('delete from "user" where email = $1', [
    mail,
  ]);
  ok('se borro la cuenta de prueba', rowCount === 1);
} finally {
  await base.end();
}

console.log('');
console.log(fallos === 0 ? 'listo, todo en verde.' : `${fallos} fallaron.`);
process.exit(fallos === 0 ? 0 : 1);
