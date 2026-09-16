/**
 * Revisión completa del circuito de cuentas: registro, confirmación de mail,
 * entrar, recuperar contraseña y cerrar sesión — incluidos los caminos que
 * tienen que fallar.
 *
 *     npm run prueba:cuentas
 *
 * Corre contra el servidor local SIN la clave de Resend, así los links quedan
 * en el log en vez de mandar correo de verdad. Levantalo con:
 *
 *     node --env-file=.env -e "delete process.env.RESEND_API_KEY; import('./src/index.js')" > cuentas.log
 *
 * y pasale la ruta de ese archivo por PRUEBA_LOG: de ahí saca los links de
 * confirmación y de recuperación, que es la única forma de seguir el circuito
 * entero sin abrir una casilla de correo.
 *
 * Al terminar borra las cuentas @canchero.test que creó.
 */
import { readFileSync } from 'node:fs';
import pg from 'pg';

const API = process.env.PRUEBA_API ?? 'http://localhost:3000';
const LOG = process.env.PRUEBA_LOG;
const ORIGEN = 'canchero://';

let fallos = 0;
const ok = (nombre, condicion, detalle) => {
  if (!condicion) fallos++;
  console.log(`${condicion ? 'OK  ' : 'MAL '} ${nombre}`);
  if (!condicion && detalle) console.log(`       ${String(detalle).slice(0, 140)}`);
};
const titulo = (t) => console.log(`\n— ${t} —`);

/**
 * Una "app": su propia cookie y su propia IP, como dos teléfonos distintos.
 *
 * La IP falsa importa: el servidor limita los intentos por IP, y sin esto la
 * prueba entera cae en el mismo balde y se corta a la mitad. Se manda por la
 * misma cabecera que usa Render, así se ejercita el camino real en vez de
 * apagar el límite.
 *
 * Cada corrida usa además su propio rango al azar. Empezando siempre en la
 * misma IP, dos corridas seguidas comparten el contador del límite y la
 * segunda se choca con el techo que dejó la primera: fallaba la prueba, no el
 * servidor.
 */
const corrida = 1 + Math.floor(Math.random() * 250);
let numeroDeApp = 0;
function app() {
  /** Un tarro de galletitas de verdad: guarda por nombre y borra las que el
   *  servidor da de baja. Quedarse con la primera cabecera, como hacía antes,
   *  escondía justo lo que hay que mirar al cerrar sesión. */
  const tarro = new Map();
  const ip = `198.18.${corrida}.${++numeroDeApp}`;

  const guardar = (respuesta) => {
    const nuevas = respuesta.headers.getSetCookie
      ? respuesta.headers.getSetCookie()
      : [respuesta.headers.get('set-cookie')].filter(Boolean);

    for (const cruda of nuevas) {
      const [par, ...atributos] = cruda.split(';');
      const corte = par.indexOf('=');
      const nombre = par.slice(0, corte).trim();
      const valor = par.slice(corte + 1);
      const dadaDeBaja = valor === '' || /max-age\s*=\s*0/i.test(atributos.join(';'));
      if (dadaDeBaja) tarro.delete(nombre);
      else tarro.set(nombre, `${nombre}=${valor}`);
    }
  };

  return {
    get cookie() {
      return [...tarro.values()].join('; ');
    },
    olvidarCookie() {
      tarro.clear();
    },
    async pedir(camino, { metodo = 'GET', cuerpo } = {}) {
      const cookie = [...tarro.values()].join('; ');
      /*
       * El content-type va en todo POST, tenga cuerpo o no. Better Auth
       * contesta 415 sin él, y `sign-out` no lleva datos: sin esta línea el
       * cierre de sesión nunca llegaba a ejecutarse y la prueba culpaba al
       * servidor de algo que no había pasado.
       */
      const llevaCuerpo = metodo !== 'GET' && metodo !== 'HEAD';
      const r = await fetch(API + camino, {
        method: metodo,
        headers: {
          origin: ORIGEN,
          'x-forwarded-for': ip,
          ...(cookie ? { cookie } : {}),
          ...(llevaCuerpo ? { 'content-type': 'application/json' } : {}),
        },
        body: llevaCuerpo ? JSON.stringify(cuerpo ?? {}) : undefined,
        redirect: 'manual',
      });
      guardar(r);
      const texto = await r.text();
      let json = null;
      try {
        json = JSON.parse(texto);
      } catch {}
      return { estado: r.status, json, texto };
    },
  };
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/** Saca del log el último link que matchee, que es el que se acaba de generar. */
function ultimoLink(patron) {
  if (!LOG) return null;
  const log = readFileSync(LOG, 'utf8');
  return [...log.matchAll(patron)].pop()?.[0] ?? null;
}

const mail = (etiqueta) => `${etiqueta}-${Date.now()}@canchero.test`;
const CLAVE = 'claveLargaSegura1';

// ═══════════════════════════════════════════════════════ registro
titulo('registro');
const a = app();
const miMail = mail('flujo');

let r = await a.pedir('/api/auth/sign-up/email', {
  metodo: 'POST',
  cuerpo: { email: miMail, password: CLAVE, name: 'Flujo' },
});
ok('la cuenta se crea', r.estado === 200, r.texto);
ok('NO devuelve sesión: falta confirmar', r.json?.token == null, r.texto);
ok('y dice que el mail no está confirmado', r.json?.user?.emailVerified === false);

/*
 * Registrarse dos veces con el mismo mail responde 200 y vuelve a mandar la
 * confirmación, en vez de decir "ese mail ya existe". Es deliberado: si
 * contestara distinto, probando direcciones se podría averiguar quién tiene
 * cuenta.
 *
 * Lo que sí importa es que ese segundo intento no pueda apropiarse de la
 * cuenta cambiándole la contraseña. Eso es lo que se prueba acá.
 */
r = await a.pedir('/api/auth/sign-up/email', {
  metodo: 'POST',
  cuerpo: { email: miMail, password: 'claveDeUnAjeno9', name: 'Ajeno' },
});
ok('repetir el registro no delata que el mail existe', r.estado === 200, r.texto);

r = await a.pedir('/api/auth/sign-up/email', {
  metodo: 'POST',
  cuerpo: { email: mail('corta'), password: 'corta', name: 'X' },
});
ok('contraseña corta se rechaza', r.estado >= 400);

r = await a.pedir('/api/auth/sign-up/email', {
  metodo: 'POST',
  cuerpo: { email: 'no-es-un-mail', password: CLAVE, name: 'X' },
});
ok('mail inválido se rechaza', r.estado >= 400);

/*
 * Registrarse de nuevo con el mismo mail NO reenvía el mail de confirmación,
 * ni siquiera si la cuenta sigue sin confirmar. Es el comportamiento de Better
 * Auth y no se puede cambiar sin delatar qué direcciones tienen cuenta; lo que
 * se agregó es una forma de pedir el reenvío a propósito.
 */
titulo('reenviar la confirmación');
const antesDeReenviar = LOG ? ultimoLink(/verify-email[^\s"'<]*/g) : null;

r = await a.pedir('/api/auth/sign-up/email', {
  metodo: 'POST',
  cuerpo: { email: miMail, password: CLAVE, name: 'Flujo' },
});
await esperar(400);
ok(
  'registrarse de nuevo NO manda otro mail',
  !LOG || ultimoLink(/verify-email[^\s"'<]*/g) === antesDeReenviar
);

r = await a.pedir('/api/auth/send-verification-email', {
  metodo: 'POST',
  cuerpo: { email: miMail },
});
ok('pero se puede pedir el reenvío', r.estado === 200, r.texto);
await esperar(400);
ok(
  'y ahí sí llega uno nuevo',
  !LOG || ultimoLink(/verify-email[^\s"'<]*/g) !== antesDeReenviar
);

r = await a.pedir('/api/auth/send-verification-email', {
  metodo: 'POST',
  cuerpo: { email: mail('nadie') },
});
ok('con un mail que no existe responde igual', r.estado === 200, r.texto);

// ═══════════════════════════════════════════════ entrar sin confirmar
titulo('entrar sin confirmar');
a.olvidarCookie();
r = await a.pedir('/api/auth/sign-in/email', {
  metodo: 'POST',
  cuerpo: { email: miMail, password: CLAVE },
});
ok('no deja entrar', r.estado >= 400);
ok('y explica que falta verificar', /verif/i.test(r.texto), r.texto);

r = await a.pedir('/planteles');
ok('sin sesión, los planteles dan 401', r.estado === 401);

// ═══════════════════════════════════════════════════════ confirmar
titulo('confirmar el mail');
await esperar(700);
const linkVerif = ultimoLink(/https?:\/\/[^\s"'<]*verify-email[^\s"'<]*/g);
ok('se generó el link de confirmación', !!linkVerif);

if (linkVerif) {
  const v = await fetch(linkVerif, { redirect: 'manual' });
  ok('el link responde bien', v.status < 400, `HTTP ${v.status}`);

  a.olvidarCookie();
  r = await a.pedir('/api/auth/sign-in/email', {
    metodo: 'POST',
    cuerpo: { email: miMail, password: CLAVE },
  });
  ok('ahora sí entra', r.estado === 200, r.texto);
  ok('y devuelve sesión', !!r.json?.token);

  r = await a.pedir('/planteles');
  ok('con sesión, los planteles responden', r.estado === 200);

  // Reusar el link no da error: redirige. Lo que importa es que no entregue
  // una sesión nueva a quien lo tenga.
  const w = await fetch(linkVerif, { redirect: 'manual' });
  const destino = w.headers.get('location') ?? '';
  ok(
    'reusar el link de confirmación no entrega sesión',
    !w.headers.get('set-cookie') || /error/i.test(destino),
    `HTTP ${w.status} -> ${destino}`
  );

  // Y la contraseña del segundo registro nunca sirvió.
  const ajeno = app();
  const x = await ajeno.pedir('/api/auth/sign-in/email', {
    metodo: 'POST',
    cuerpo: { email: miMail, password: 'claveDeUnAjeno9' },
  });
  ok('repetir el registro no se apropia de la cuenta', x.estado >= 400, x.texto);
}

// ══════════════════════════════════════════════ contraseña incorrecta
titulo('contraseña incorrecta');
const b = app();
r = await b.pedir('/api/auth/sign-in/email', {
  metodo: 'POST',
  cuerpo: { email: miMail, password: 'noEsLaClave123' },
});
ok('rechaza la clave equivocada', r.estado >= 400);
ok('no dice si el mail existe', !/not found|no existe/i.test(r.texto), r.texto);

r = await b.pedir('/api/auth/sign-in/email', {
  metodo: 'POST',
  cuerpo: { email: mail('fantasma'), password: CLAVE },
});
ok('una cuenta inexistente falla igual', r.estado >= 400);

// ══════════════════════════════════════════════ recuperar contraseña
titulo('recuperar contraseña');
const c = app();
r = await c.pedir('/api/auth/request-password-reset', {
  metodo: 'POST',
  cuerpo: { email: miMail, redirectTo: 'canchero://recuperar' },
});
ok('acepta el pedido', r.estado === 200, r.texto);

r = await c.pedir('/api/auth/request-password-reset', {
  metodo: 'POST',
  cuerpo: { email: mail('nadie'), redirectTo: 'canchero://recuperar' },
});
ok('responde igual con un mail que no existe', r.estado === 200);

await esperar(700);
const linkReset = ultimoLink(/https?:\/\/[^\s"'<]*reset-password\/[^\s"'<]*/g);
const token = linkReset?.match(/reset-password\/([A-Za-z0-9_-]+)/)?.[1];
ok('se generó el token', !!token);

const NUEVA = 'claveNuevaSegura2';
if (token) {
  r = await c.pedir('/api/auth/reset-password', {
    metodo: 'POST',
    cuerpo: { newPassword: 'ab', token },
  });
  ok('rechaza una contraseña nueva demasiado corta', r.estado >= 400);

  r = await c.pedir('/api/auth/reset-password', {
    metodo: 'POST',
    cuerpo: { newPassword: NUEVA, token: 'inventado-' + token },
  });
  ok('rechaza un token inventado', r.estado >= 400);

  r = await c.pedir('/api/auth/reset-password', {
    metodo: 'POST',
    cuerpo: { newPassword: NUEVA, token },
  });
  ok('acepta el cambio con el token bueno', r.estado === 200, r.texto);

  r = await c.pedir('/api/auth/reset-password', {
    metodo: 'POST',
    cuerpo: { newPassword: 'otraMasLarga3', token },
  });
  ok('el token no se puede usar dos veces', r.estado >= 400);

  const d = app();
  r = await d.pedir('/api/auth/sign-in/email', {
    metodo: 'POST',
    cuerpo: { email: miMail, password: NUEVA },
  });
  ok('entra con la contraseña nueva', r.estado === 200, r.texto);

  const e = app();
  r = await e.pedir('/api/auth/sign-in/email', {
    metodo: 'POST',
    cuerpo: { email: miMail, password: CLAVE },
  });
  ok('la vieja dejó de servir', r.estado >= 400);
}

// ═══════════════════════════════════════════════════════ cerrar sesión
titulo('cerrar sesión');
const f = app();
await f.pedir('/api/auth/sign-in/email', {
  metodo: 'POST',
  cuerpo: { email: miMail, password: NUEVA },
});
const cookieVieja = f.cookie;
r = await f.pedir('/planteles');
ok('antes de salir, los planteles responden', r.estado === 200);

r = await f.pedir('/api/auth/sign-out', { metodo: 'POST' });
ok('el cierre de sesión se acepta', r.estado === 200, r.texto);
ok('y el servidor da de baja la cookie', f.cookie === '', f.cookie);

r = await f.pedir('/planteles');
ok('después de salir, dan 401', r.estado === 401, r.texto);

/*
 * Lo anterior sólo prueba que la app se olvidó de la llave. Lo que importa es
 * que la llave ya no abra: si el token siguiera valiendo, a cualquiera que lo
 * hubiera copiado no le haría falta la contraseña.
 */
const robado = await fetch(API + '/planteles', {
  headers: { origin: ORIGEN, 'x-forwarded-for': `198.18.${corrida}.250`, cookie: cookieVieja },
});
ok('y el token viejo ya no sirve aunque lo guarden', robado.status === 401, `HTTP ${robado.status}`);

// ═══════════════════════════════════════════════════════════ barrido
/*
 * Las cuentas que inventa esta prueba se borran al terminar. Sin esto la base
 * se va llenando de usuarios @canchero.test, y a las semanas no se distingue
 * una cuenta real de un resto de una corrida vieja.
 *
 * Se borra por dominio, nunca por lista: si una prueba falla a la mitad y deja
 * una cuenta a medio crear, igual se la lleva.
 */
titulo('barrido');
if (process.env.DATABASE_URL) {
  const base = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: true },
    max: 2,
  });
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
} else {
  console.log('     (sin DATABASE_URL: las cuentas de prueba quedan en la base)');
}

// ══════════════════════════════════════════════════════════ resumen
console.log('');
console.log(fallos === 0 ? 'listo, todo en verde.' : `${fallos} fallaron.`);
process.exit(fallos === 0 ? 0 : 1);
