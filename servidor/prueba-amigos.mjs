/**
 * Amigos y la conversación con cada uno.
 *
 * Lo que importa es lo que tiene que ser imposible: leer la conversación de
 * otros, escribirle a alguien que no te aceptó, aceptar tu propia solicitud, y
 * que dos que se agregan al mismo tiempo queden los dos esperando al otro.
 *
 *     npm run prueba:amigos
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
const sufijo = Date.now().toString(36).slice(-5);
let numeroDeApp = 0;

const base = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true },
  max: 3,
});

async function cuenta(nombreDeUsuario) {
  const email = `${nombreDeUsuario}-${Date.now()}-${++numeroDeApp}@canchero.test`;
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
    cuerpo: { email, password: CLAVE, name: nombreDeUsuario },
  });
  await base.query('update "user" set "emailVerified" = true where email = $1', [
    email,
  ]);
  await pedir('/api/auth/sign-in/email', {
    metodo: 'POST',
    cuerpo: { email, password: CLAVE },
  });
  await pedir('/perfil', { metodo: 'PUT', cuerpo: { usuario: nombreDeUsuario } });

  return { email, usuario: nombreDeUsuario, pedir };
}

const PLANTEL = {
  nombre: 'Los del sabado',
  datos: {
    jugadores: [{ id: 'j1', nombre: 'Rodri' }, { id: 'j2', nombre: 'Hugo' }],
    partidos: [],
  },
};

const luis = await cuenta(`luis${sufijo}`);
const ana = await cuenta(`ana${sufijo}`);
const tito = await cuenta(`tito${sufijo}`);

// ══════════════════════════════════════════════════════════ sin sesión
titulo('sin sesión');
{
  const r = await fetch(API + '/amigos', {
    headers: { origin: ORIGEN, 'x-forwarded-for': `198.18.${corrida}.200` },
  });
  ok('la lista de amigos pide sesión', r.status === 401, `HTTP ${r.status}`);
  const w = await fetch(API + `/mensajes/${luis.usuario}`, {
    headers: { origin: ORIGEN, 'x-forwarded-for': `198.18.${corrida}.200` },
  });
  ok('la conversación también', w.status === 401, `HTTP ${w.status}`);
}

// ══════════════════════════════════════════════════════ pedir amistad
titulo('pedir amistad');
let r = await luis.pedir('/amigos', {
  metodo: 'POST',
  cuerpo: { usuario: `noexiste${sufijo}` },
});
ok('a alguien que no existe, 404', r.estado === 404, r.texto);

r = await luis.pedir('/amigos', { metodo: 'POST', cuerpo: { usuario: luis.usuario } });
ok('a uno mismo no', r.estado === 400, r.texto);

r = await luis.pedir('/amigos', { metodo: 'POST', cuerpo: { usuario: ana.usuario } });
ok('a Ana sí', r.estado === 200 && r.json?.estado === 'pendiente', r.texto);

r = await luis.pedir('/amigos');
ok('a Luis le figura pendiente', r.json?.amigos?.[0]?.estado === 'pendiente', r.texto);
ok('y que la pidió él', r.json?.amigos?.[0]?.loPediYo === true, r.texto);

r = await ana.pedir('/amigos');
ok('a Ana le figura la solicitud', r.json?.amigos?.[0]?.estado === 'pendiente', r.texto);
ok('y que la pidió el otro', r.json?.amigos?.[0]?.loPediYo === false, r.texto);

// ══════════════════════════════════════ antes de aceptar, nada pasa
titulo('mientras no acepte, nada pasa');
r = await luis.pedir(`/mensajes/${ana.usuario}`, {
  metodo: 'POST',
  cuerpo: { texto: 'hola' },
});
ok('no se puede escribir', r.estado === 403, r.texto);

r = await luis.pedir(`/mensajes/${ana.usuario}`);
ok('ni leer la conversación', r.estado === 403, r.texto);

r = await luis.pedir('/envios', {
  metodo: 'POST',
  cuerpo: { usuario: ana.usuario, plantel: PLANTEL },
});
ok('ni mandar un plantel', r.estado === 403, r.texto);

r = await luis.pedir(`/amigos/${ana.usuario}/responder`, {
  metodo: 'POST',
  cuerpo: { acepta: true },
});
ok('y uno no se puede aceptar su propia solicitud', r.estado === 404, r.texto);

// ══════════════════════════════════════════════════════════ aceptar
titulo('aceptar');
r = await ana.pedir(`/amigos/${luis.usuario}/responder`, {
  metodo: 'POST',
  cuerpo: { acepta: true },
});
ok('Ana acepta', r.estado === 200, r.texto);

r = await ana.pedir('/amigos');
ok('quedan amigos', r.json?.amigos?.[0]?.estado === 'aceptada', r.texto);
r = await luis.pedir('/amigos');
ok('de los dos lados', r.json?.amigos?.[0]?.estado === 'aceptada', r.texto);

// ════════════════════════════════════════════════════════════ chatear
titulo('chatear');
r = await luis.pedir(`/mensajes/${ana.usuario}`, {
  metodo: 'POST',
  cuerpo: { texto: 'llevás la pelota?' },
});
ok('Luis escribe', r.estado === 200, r.texto);

r = await ana.pedir(`/mensajes/${luis.usuario}`, {
  metodo: 'POST',
  cuerpo: { texto: 'sí, y los pecheros' },
});
ok('Ana contesta', r.estado === 200, r.texto);

r = await luis.pedir(`/mensajes/${ana.usuario}`);
ok('la conversación tiene los dos', r.json?.mensajes?.length === 2, r.texto);
ok('en orden', r.json?.mensajes?.[0]?.texto === 'llevás la pelota?', r.texto);
ok('el primero es mío', r.json?.mensajes?.[0]?.mio === true);
ok('el segundo no', r.json?.mensajes?.[1]?.mio === false);

r = await ana.pedir(`/mensajes/${luis.usuario}`);
ok('y del otro lado se ve al revés', r.json?.mensajes?.[0]?.mio === false, r.texto);

r = await luis.pedir(`/mensajes/${ana.usuario}`, { metodo: 'POST', cuerpo: { texto: '   ' } });
ok('un mensaje vacío se rechaza', r.estado === 400, r.texto);

r = await luis.pedir(`/mensajes/${ana.usuario}`, {
  metodo: 'POST',
  cuerpo: { texto: 'x'.repeat(1001) },
});
ok('y uno larguísimo también', r.estado === 400, r.texto);

// ═══════════════════════════════════════════════════════ sin leer
titulo('sin leer');
r = await ana.pedir('/amigos');
const conLuis = r.json?.amigos?.find((a) => a.usuario === luis.usuario);
ok('Ana tiene uno sin leer', conLuis?.sinLeer === 1, JSON.stringify(conLuis));
ok('y ve de qué se trata el último', conLuis?.ultimo?.tipo === 'texto', JSON.stringify(conLuis));

await ana.pedir(`/mensajes/${luis.usuario}/leido`, { metodo: 'POST' });
r = await ana.pedir('/amigos');
ok(
  'después de leer, ninguno',
  r.json?.amigos?.find((a) => a.usuario === luis.usuario)?.sinLeer === 0,
  r.texto
);

// ══════════════════════════════════════ un tercero no se mete
titulo('un tercero no se mete');
r = await tito.pedir(`/mensajes/${ana.usuario}`);
ok('no puede leer la conversación de otros', r.estado === 403, r.texto);

r = await tito.pedir(`/mensajes/${ana.usuario}`, {
  metodo: 'POST',
  cuerpo: { texto: 'me meto' },
});
ok('ni escribir en ella', r.estado === 403, r.texto);

r = await luis.pedir(`/mensajes/${ana.usuario}`);
ok('y la conversación sigue con lo que había', r.json?.mensajes?.length === 2, r.texto);

// ══════════════════════════════════ el plantel va a la conversación
titulo('el plantel va a la conversación');
r = await luis.pedir('/envios', {
  metodo: 'POST',
  cuerpo: { usuario: ana.usuario, plantel: PLANTEL },
});
ok('ahora sí se puede mandar', r.estado === 200, r.texto);
const envioId = r.json?.id;

r = await luis.pedir(`/mensajes/${ana.usuario}`);
const ultimo = r.json?.mensajes?.at(-1);
ok('aparece en el chat', ultimo?.tipo === 'plantel', JSON.stringify(ultimo));
ok('con el nombre del plantel', ultimo?.plantel?.nombre === 'Los del sabado');
ok('y dice que está pendiente', ultimo?.plantel?.estado === 'pendiente');
ok('con cuántos jugadores trae', ultimo?.plantel?.jugadores === 2);

await ana.pedir(`/envios/${envioId}/aceptar`, { metodo: 'POST' });
r = await luis.pedir(`/mensajes/${ana.usuario}`);
ok(
  'al aceptarlo, el que mandó lo ve aceptado',
  r.json?.mensajes?.at(-1)?.plantel?.estado === 'aceptado',
  r.texto
);

r = await luis.pedir('/envios', {
  metodo: 'POST',
  cuerpo: { usuario: ana.usuario, plantel: { ...PLANTEL, nombre: 'Otro' } },
});
const segundo = r.json?.id;
await ana.pedir(`/envios/${segundo}/rechazar`, { metodo: 'POST' });
r = await luis.pedir(`/mensajes/${ana.usuario}`);
ok(
  'y si lo rechaza, lo ve rechazado',
  r.json?.mensajes?.at(-1)?.plantel?.estado === 'rechazado',
  r.texto
);

// ═══════════════════════════════ los dos se agregan a la vez
titulo('los dos se agregan a la vez');
r = await tito.pedir('/amigos', { metodo: 'POST', cuerpo: { usuario: ana.usuario } });
ok('Tito le pide a Ana', r.estado === 200 && r.json?.estado === 'pendiente', r.texto);

r = await ana.pedir('/amigos', { metodo: 'POST', cuerpo: { usuario: tito.usuario } });
ok(
  'Ana le pide a Tito y quedan amigos de una',
  r.estado === 200 && r.json?.estado === 'aceptada',
  r.texto
);

r = await base.query(
  `select count(*)::int as n from amistades
    where (uno = (select usuario_id from perfiles where usuario = $1)
       and otro = (select usuario_id from perfiles where usuario = $2))
       or (uno = (select usuario_id from perfiles where usuario = $2)
       and otro = (select usuario_id from perfiles where usuario = $1))`,
  [ana.usuario, tito.usuario]
);
ok('y hay una sola fila, no dos', r.rows[0].n === 1, JSON.stringify(r.rows[0]));

// ══════════════════════════════════════════════════════════ rechazar
titulo('rechazar una solicitud');
r = await tito.pedir('/amigos', { metodo: 'POST', cuerpo: { usuario: luis.usuario } });
ok('Tito le pide a Luis', r.estado === 200, r.texto);

r = await luis.pedir(`/amigos/${tito.usuario}/responder`, {
  metodo: 'POST',
  cuerpo: { acepta: false },
});
ok('Luis lo rechaza', r.estado === 200, r.texto);

r = await luis.pedir('/amigos');
ok(
  'y deja de aparecerle',
  !r.json?.amigos?.some((a) => a.usuario === tito.usuario),
  r.texto
);

r = await tito.pedir(`/mensajes/${luis.usuario}`, {
  metodo: 'POST',
  cuerpo: { texto: 'igual te escribo' },
});
ok('el rechazado no puede escribir', r.estado === 403, r.texto);

// ═══════════════════════════════════════════════════ avisos al teléfono
titulo('avisos al teléfono');
{
  const r0 = await fetch(API + '/dispositivos', {
    method: 'POST',
    headers: {
      origin: ORIGEN,
      'content-type': 'application/json',
      'x-forwarded-for': `198.18.${corrida}.201`,
    },
    body: JSON.stringify({ token: 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]' }),
  });
  ok('anotar el teléfono pide sesión', r0.status === 401, `HTTP ${r0.status}`);

  r = await luis.pedir('/dispositivos', {
    metodo: 'POST',
    cuerpo: { token: 'no-es-un-token' },
  });
  ok('un token inventado se rechaza', r.estado === 400, r.texto);

  const token = `ExponentPushToken[prueba-${sufijo}]`;
  r = await luis.pedir('/dispositivos', { metodo: 'POST', cuerpo: { token } });
  ok('un token de Expo se acepta', r.estado === 200, r.texto);

  let fila = await base.query('select usuario_id from dispositivos where token = $1', [token]);
  const suId = await base.query('select usuario_id from perfiles where usuario = $1', [luis.usuario]);
  ok('queda anotado a esa cuenta', fila.rows[0]?.usuario_id === suId.rows[0]?.usuario_id);

  /*
   * El mismo teléfono con otra cuenta: la fila se muda en vez de duplicarse.
   * Sin esto, al entrar otra persona en el mismo celular le seguirían llegando
   * los avisos de la anterior.
   */
  r = await ana.pedir('/dispositivos', { metodo: 'POST', cuerpo: { token } });
  fila = await base.query('select usuario_id from dispositivos where token = $1', [token]);
  const suIdAna = await base.query('select usuario_id from perfiles where usuario = $1', [ana.usuario]);
  ok('si entra otra cuenta, el teléfono se muda', fila.rows[0]?.usuario_id === suIdAna.rows[0]?.usuario_id);

  const cuantos = await base.query('select count(*)::int as n from dispositivos where token = $1', [token]);
  ok('y no queda duplicado', cuantos.rows[0].n === 1);

  // Con un teléfono anotado, mandar un mensaje sale igual aunque el aviso no
  // llegue a ningún lado: el token es inventado.
  r = await luis.pedir(`/mensajes/${ana.usuario}`, {
    metodo: 'POST',
    cuerpo: { texto: 'con aviso puesto' },
  });
  ok('mandar un mensaje no se rompe por el aviso', r.estado === 200, r.texto);

  r = await ana.pedir('/dispositivos', { metodo: 'DELETE', cuerpo: { token } });
  ok('se puede desanotar', r.estado === 200, r.texto);
  const quedan = await base.query('select count(*)::int as n from dispositivos where token = $1', [token]);
  ok('y deja de estar', quedan.rows[0].n === 0);
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
