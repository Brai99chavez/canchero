/**
 * Prueba de punta a punta contra un servidor andando. Levantá la API en otra
 * terminal con `npm run dev` y corré:
 *
 *     npm run prueba
 *
 * Crea cuentas de mentira con mails @canchero.test y planteles de juguete, y
 * las borra al terminar.
 *
 * Apunta a localhost; para probar lo que está en Render, PRUEBA_API.
 */
import pg from 'pg';
const API = process.env.PRUEBA_API ?? 'http://localhost:3000';
const mail = `prueba-${Date.now()}@canchero.test`;
const clave = 'unaClaveLarga123';
let cookie = '';

let fallos = 0;
const ok = (n, c) => {
  if (!c) fallos++;
  console.log(`${c ? 'OK  ' : 'MAL '} ${n}`);
};

const base = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true },
  max: 2,
});

/**
 * Registrarse ya no deja adentro: el servidor pide confirmar el mail. Para lo
 * que prueba este archivo —planteles, upsert, que una cuenta no vea lo de la
 * otra— sólo hace falta una cuenta que pueda entrar, así que se confirma por
 * la base. El circuito del mail lo recorre entero prueba-cuentas.mjs.
 */
async function nuevaCuenta(email) {
  await pedir('/api/auth/sign-up/email', {
    metodo: 'POST',
    cuerpo: { email, password: clave, name: 'Prueba' },
  });
  await base.query('update "user" set "emailVerified" = true where email = $1', [
    email,
  ]);
  return pedir('/api/auth/sign-in/email', {
    metodo: 'POST',
    cuerpo: { email, password: clave },
  });
}

async function pedir(camino, opciones = {}) {
  const r = await fetch(API + camino, {
    method: opciones.metodo ?? 'GET',
    headers: {
      // Lo mismo que manda la app: Better Auth lo exige para que un sitio
      // cualquiera no pueda disparar pedidos con la sesion del usuario.
      origin: 'canchero://',
      ...(cookie ? { cookie } : {}),
      ...(opciones.cuerpo ? { 'content-type': 'application/json' } : {}),
    },
    body: opciones.cuerpo ? JSON.stringify(opciones.cuerpo) : undefined,
  });
  const set = r.headers.getSetCookie ? r.headers.getSetCookie() : [];
  for (const cruda of set) {
    const par = cruda.split(';')[0];
    // `__Secure-` adelante cuando va por HTTPS; pelado en localhost.
    if (par.includes('better-auth.session_token=')) cookie = par;
  }
  const texto = await r.text();
  let cuerpo = null;
  try { cuerpo = JSON.parse(texto); } catch {}
  return { estado: r.status, cuerpo, texto };
}

// 1. Sin sesión no se entra a nada.
let r = await pedir('/planteles');
ok('sin sesion -> 401', r.estado === 401);

// 2. Registro y entrada.
r = await nuevaCuenta(mail);
ok('registro y login', r.estado === 200 && !!r.cuerpo?.token);
if (r.estado !== 200) console.log('   ->', r.texto.slice(0, 300));

// 3. Perfil: la cuenta nueva arranca gratis.
r = await pedir('/perfil');
ok('perfil devuelve plan gratis', r.cuerpo?.plan === 'gratis');
if (r.estado !== 200) console.log('   ->', r.texto.slice(0, 300));

// 4. Subir dos planteles.
r = await pedir('/planteles', {
  metodo: 'PUT',
  cuerpo: {
    planteles: [
      { id: 'p1', nombre: 'Los del sabado', llegada: '2026-01-01T00:00:00.000Z',
        datos: { jugadores: [{ id: 'j1', nombre: 'Rodri' }], partidos: [] } },
      { id: 'p2', nombre: 'Trabajo', llegada: '2026-02-01T00:00:00.000Z',
        datos: { jugadores: [], partidos: [] } },
    ],
  },
});
ok('subir 2 planteles', r.cuerpo?.guardados === 2);

// 5. Bajarlos.
r = await pedir('/planteles');
ok('bajar 2 planteles', r.cuerpo?.planteles?.length === 2);
ok('el JSON vuelve entero', r.cuerpo?.planteles?.[0]?.datos?.jugadores?.[0]?.nombre === 'Rodri');

// 6. Subir de nuevo el mismo id: pisa, no duplica.
await pedir('/planteles', { metodo: 'PUT', cuerpo: { planteles: [
  { id: 'p1', nombre: 'Renombrado', llegada: '2026-01-01T00:00:00.000Z', datos: {} } ] } });
r = await pedir('/planteles');
ok('upsert no duplica', r.cuerpo?.planteles?.length === 2);
ok('upsert renombra', r.cuerpo?.planteles?.some((p) => p.nombre === 'Renombrado'));

// 7. Lista vacia no borra el respaldo.
await pedir('/planteles', { metodo: 'PUT', cuerpo: { planteles: [] } });
r = await pedir('/planteles');
ok('subir vacio no borra', r.cuerpo?.planteles?.length === 2);

// 8. Borrar marca, y deja de venir.
await pedir('/planteles/p2', { metodo: 'DELETE' });
r = await pedir('/planteles');
ok('borrar saca de la lista', r.cuerpo?.planteles?.length === 1);

// 9. Los planteles de otro no se ven.
cookie = '';
await nuevaCuenta(`otro-${Date.now()}@canchero.test`);
r = await pedir('/planteles');
ok('otra cuenta no ve lo mio', r.cuerpo?.planteles?.length === 0);

// 10. Login con la primera.
cookie = '';
r = await pedir('/api/auth/sign-in/email', { metodo: 'POST', cuerpo: { email: mail, password: clave } });
ok('login', r.estado === 200);
r = await pedir('/planteles');
ok('tras login vuelve a ver lo suyo', r.cuerpo?.planteles?.length === 1);

// 11. Contrasena mal.
cookie = '';
r = await pedir('/api/auth/sign-in/email', { metodo: 'POST', cuerpo: { email: mail, password: 'noEsLaClave1' } });
ok('clave incorrecta rechazada', r.estado >= 400);

// 12. Contrasena corta.
r = await pedir('/api/auth/sign-up/email', { metodo: 'POST',
  cuerpo: { email: `corta-${Date.now()}@canchero.test`, password: 'corta', name: 'X' } });
ok('clave corta rechazada', r.estado >= 400);

// Las cuentas que inventó esta prueba se van con todo lo que tienen adentro:
// los planteles cuelgan de la cuenta por clave foránea.
try {
  const { rowCount } = await base.query(
    `delete from "user" where email like '%@canchero.test'`
  );
  ok(`se borraron las ${rowCount} cuentas de prueba`, true);
} finally {
  await base.end();
}

console.log('');
console.log(fallos === 0 ? 'listo, todo en verde.' : `${fallos} fallaron.`);
process.exit(fallos === 0 ? 0 : 1);
