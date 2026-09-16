import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { auth } from './auth.js';
import { consultar } from './db.js';
import { hayMails } from './mails.js';
import {
  amigosDe,
  conversacionCon,
  mandarTexto,
  marcarLeido,
  pedirAmistad,
  responderAmistad,
  sacarAmigo,
} from './amigos.js';
import { guardarDispositivo, olvidarDispositivo } from './avisos.js';
import { DIAS_DE_PAPELERA, vaciarPapeleraVieja } from './papelera.js';
import { aceptar, enviarPlantel, pendientesDe, rechazar } from './envios.js';
import { guardarPerfil, leerPerfil } from './perfil.js';
import { hayLugar, planDe, recortarAlPlan } from './planes.js';
import {
  borrarFoto,
  hayFotos,
  limpiarHuerfanas,
  permisoDeSubida,
} from './fotos.js';

const app = new Hono();

/**
 * Todo lo de cuentas lo resuelve Better Auth: registro, login, sesión,
 * recuperar contraseña. Lo único que hacemos es darle el camino.
 */
app.all('/api/auth/*', (c) => auth.handler(c.req.raw));

/**
 * Render pega acá para saber si el servicio está vivo, y de paso dice qué
 * tiene configurado. Son booleanos de configuración, no secretos, y evitan
 * tener que adivinar si un despliegue quedó a medias.
 *
 * `version` es el commit que Render está corriendo, que él mismo pone en el
 * entorno. Sin esto, después de subir un cambio no hay forma de saber si lo
 * que contesta el servidor ya es el código nuevo o todavía el viejo: se
 * esperaba un rato y se cruzaban los dedos.
 */
app.get('/', (c) =>
  c.json({
    ok: true,
    servicio: 'canchero-api',
    fotos: hayFotos,
    mails: hayMails,
    version: (process.env.RENDER_GIT_COMMIT ?? 'local').slice(0, 7),
  })
);

/**
 * De acá para abajo hay que estar logueado. Esto es lo que en Supabase hacían
 * las reglas de la base: sin esto, cualquiera pide los planteles de cualquiera
 * cambiando un id en la URL.
 */
app.use('/planteles/*', async (c, siguiente) => {
  const sesion = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!sesion?.user) return c.json({ error: 'Sesión no válida.' }, 401);
  c.set('usuario', sesion.user);
  await siguiente();
});

app.use('/fotos/*', async (c, siguiente) => {
  const sesion = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!sesion?.user) return c.json({ error: 'Sesión no válida.' }, 401);
  c.set('usuario', sesion.user);
  await siguiente();
});

app.use('/dispositivos', async (c, siguiente) => {
  const sesion = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!sesion?.user) return c.json({ error: 'Sesión no válida.' }, 401);
  c.set('usuario', sesion.user);
  await siguiente();
});

app.use('/amigos/*', async (c, siguiente) => {
  const sesion = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!sesion?.user) return c.json({ error: 'Sesión no válida.' }, 401);
  c.set('usuario', sesion.user);
  await siguiente();
});

app.use('/mensajes/*', async (c, siguiente) => {
  const sesion = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!sesion?.user) return c.json({ error: 'Sesión no válida.' }, 401);
  c.set('usuario', sesion.user);
  await siguiente();
});

app.use('/envios/*', async (c, siguiente) => {
  const sesion = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!sesion?.user) return c.json({ error: 'Sesión no válida.' }, 401);
  c.set('usuario', sesion.user);
  await siguiente();
});

app.use('/perfil', async (c, siguiente) => {
  const sesion = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!sesion?.user) return c.json({ error: 'Sesión no válida.' }, 401);
  c.set('usuario', sesion.user);
  await siguiente();
});

/**
 * El perfil: el plan, el nombre con el que te encuentran y la foto.
 *
 * El plan sale de acá pero no entra: escribirlo es cosa del webhook del cobro,
 * con su propia clave. Un APK modificado no puede volverse Pro mandando un
 * PUT, y por eso `PUT /perfil` ignora cualquier `plan` que le llegue.
 */
app.get('/perfil', async (c) => {
  const usuario = c.get('usuario');
  return c.json({ email: usuario.email, ...(await leerPerfil(usuario.id)) });
});

app.put('/perfil', async (c) => {
  const usuario = c.get('usuario');
  const cuerpo = await c.req.json().catch(() => null);
  if (!cuerpo || typeof cuerpo !== 'object') {
    return c.json({ error: 'Falta el cuerpo del pedido.' }, 400);
  }

  // Sólo estos dos campos, elegidos a mano: pasar el cuerpo entero dejaría
  // que un cliente modificado se escriba el plan.
  const cambios = {};
  if ('usuario' in cuerpo) cambios.usuario = cuerpo.usuario;
  if ('foto' in cuerpo) cambios.foto = cuerpo.foto;

  try {
    const perfil = await guardarPerfil(usuario.id, cambios);
    return c.json({ email: usuario.email, ...perfil });
  } catch (error) {
    return c.json({ error: error.message }, error.status ?? 500);
  }
});

/**
 * Dónde avisarle a esta cuenta. Lo manda la app al entrar, con el token que le
 * da Expo.
 *
 * Es lo que evita el refresco periódico: sin esto, cada app tendría que
 * preguntar cada tantos segundos si pasó algo, y como casi nunca pasa nada eso
 * es despertar la base todo el día para que conteste que no.
 */
app.post('/dispositivos', async (c) => {
  const usuario = c.get('usuario');
  const cuerpo = await c.req.json().catch(() => null);
  try {
    await guardarDispositivo(usuario.id, cuerpo?.token);
    return c.json({ ok: true });
  } catch (error) {
    return c.json({ error: error.message }, error.status ?? 500);
  }
});

/** Al cerrar sesión: este teléfono deja de recibir los avisos de esta cuenta. */
app.delete('/dispositivos', async (c) => {
  const cuerpo = await c.req.json().catch(() => null);
  if (typeof cuerpo?.token === 'string') await olvidarDispositivo(cuerpo.token);
  return c.json({ ok: true });
});

/**
 * Los amigos y las solicitudes, todo en una lista: con quién ya sos amigo,
 * quién te está esperando y a quién estás esperando vos.
 */
app.get('/amigos', async (c) => {
  const usuario = c.get('usuario');
  return c.json({ amigos: await amigosDe(usuario.id) });
});

/** Manda una solicitud. Si el otro ya te había mandado una, la acepta. */
app.post('/amigos', async (c) => {
  const usuario = c.get('usuario');
  const cuerpo = await c.req.json().catch(() => null);
  try {
    return c.json(await pedirAmistad(usuario.id, cuerpo?.usuario));
  } catch (error) {
    return c.json({ error: error.message }, error.status ?? 500);
  }
});

app.post('/amigos/:usuario/responder', async (c) => {
  const usuario = c.get('usuario');
  const cuerpo = await c.req.json().catch(() => null);
  try {
    await responderAmistad(
      usuario.id,
      c.req.param('usuario'),
      cuerpo?.acepta === true
    );
    return c.json({ ok: true });
  } catch (error) {
    return c.json({ error: error.message }, error.status ?? 500);
  }
});

app.delete('/amigos/:usuario', async (c) => {
  const usuario = c.get('usuario');
  await sacarAmigo(usuario.id, c.req.param('usuario'));
  return c.json({ ok: true });
});

/** La conversación con alguien: sus mensajes y los planteles que se pasaron. */
app.get('/mensajes/:usuario', async (c) => {
  const usuario = c.get('usuario');
  try {
    return c.json({
      mensajes: await conversacionCon(usuario.id, c.req.param('usuario')),
    });
  } catch (error) {
    return c.json({ error: error.message }, error.status ?? 500);
  }
});

app.post('/mensajes/:usuario', async (c) => {
  const usuario = c.get('usuario');
  const cuerpo = await c.req.json().catch(() => null);
  try {
    const id = await mandarTexto(
      usuario.id,
      c.req.param('usuario'),
      cuerpo?.texto
    );
    return c.json({ id });
  } catch (error) {
    return c.json({ error: error.message }, error.status ?? 500);
  }
});

/** Hasta acá leí. Sirve para el contador de sin leer de la lista. */
app.post('/mensajes/:usuario/leido', async (c) => {
  const usuario = c.get('usuario');
  await marcarLeido(usuario.id, c.req.param('usuario'));
  return c.json({ ok: true });
});

/**
 * Mandarle un plantel a otro por su nombre de usuario.
 *
 * Va una copia: el que recibe la acepta y a partir de ahí es suya. Nada de
 * esto toca el plantel del que mandó.
 */
app.post('/envios', async (c) => {
  const usuario = c.get('usuario');
  const cuerpo = await c.req.json().catch(() => null);
  try {
    return c.json(
      await enviarPlantel(usuario.id, cuerpo?.usuario, cuerpo?.plantel)
    );
  } catch (error) {
    return c.json({ error: error.message }, error.status ?? 500);
  }
});

/** Lo que me llegó y todavía no abrí. */
app.get('/envios', async (c) => {
  const usuario = c.get('usuario');
  return c.json({ envios: await pendientesDe(usuario.id) });
});

app.post('/envios/:id/aceptar', async (c) => {
  const usuario = c.get('usuario');
  try {
    return c.json(await aceptar(usuario.id, c.req.param('id')));
  } catch (error) {
    return c.json({ error: error.message }, error.status ?? 500);
  }
});

app.post('/envios/:id/rechazar', async (c) => {
  const usuario = c.get('usuario');
  try {
    await rechazar(usuario.id, c.req.param('id'));
    return c.json({ ok: true });
  } catch (error) {
    return c.json({ error: error.message }, error.status ?? 500);
  }
});

/**
 * Un permiso para subir una foto. El archivo no pasa por acá: la app lo manda
 * derecho a R2 con esta URL, y después guarda la pública en el jugador.
 */
app.post('/fotos/permiso', async (c) => {
  if (!hayFotos) return c.json({ error: 'Las fotos no están configuradas.' }, 503);
  const usuario = c.get('usuario');
  const cuerpo = await c.req.json().catch(() => null);
  try {
    return c.json(
      await permisoDeSubida(usuario.id, cuerpo?.tipo, cuerpo?.carpeta)
    );
  } catch (error) {
    return c.json({ error: error.message }, error.status ?? 500);
  }
});

/** Saca una foto del bucket: la del jugador que se borró o que la cambió. */
app.post('/fotos/borrar', async (c) => {
  if (!hayFotos) return c.json({ ok: true });
  const usuario = c.get('usuario');
  const cuerpo = await c.req.json().catch(() => null);
  const urls = Array.isArray(cuerpo?.urls) ? cuerpo.urls.slice(0, 100) : [];
  // Que falle una no tiene por qué frenar las demás: una foto que quedó
  // colgada es basura, no un error que haya que mostrarle a nadie.
  for (const url of urls) {
    await borrarFoto(usuario.id, url).catch(() => {});
  }
  return c.json({ ok: true });
});

/**
 * Los planteles de la cuenta.
 *
 * Con `?desde=` vienen sólo los que cambiaron después de ese momento, y ahí sí
 * vienen también los borrados: el teléfono necesita enterarse de un borrado
 * hecho en otro aparato, y si los borrados no viajaran lo daría por vivo para
 * siempre.
 *
 * Sin `desde` es todo lo vivo, que es lo que hace falta al entrar por primera
 * vez en un teléfono.
 */
app.get('/planteles', async (c) => {
  const usuario = c.get('usuario');
  const desde = c.req.query('desde');

  const { rows } = desde
    ? await consultar(
        `select id, nombre, llegada, datos, borrado, actualizado
           from planteles
          where dueno = $1 and actualizado > $2
          order by llegada asc`,
        [usuario.id, desde]
      )
    : await consultar(
        `select id, nombre, llegada, datos, borrado, actualizado
           from planteles
          where dueno = $1 and not borrado
          order by llegada asc`,
        [usuario.id]
      );

  /*
   * El reloj del servidor, no el del teléfono. El próximo `desde` sale de acá:
   * si saliera del teléfono, un celular atrasado unos segundos se perdería los
   * cambios de esa ventana para siempre.
   */
  const { rows: ahora } = await consultar(`select now() as ahora`);

  return c.json({ planteles: rows, hasta: ahora[0].ahora });
});

/**
 * Guarda un plantel solo. Es lo que usa el guardado automático: cambia un
 * jugador y sube ese plantel, no los diez.
 */
app.put('/planteles/:id', async (c) => {
  const usuario = c.get('usuario');
  const id = c.req.param('id');
  const p = await c.req.json().catch(() => null);
  if (typeof p?.nombre !== 'string') {
    return c.json({ error: 'Falta el plantel.' }, 400);
  }

  /*
   * El límite se cuenta acá y no se confía en lo que diga la app. Un plantel
   * que ya existe siempre se puede seguir guardando: lo que el plan limita es
   * cuántos tenés, no que puedas editar los que tenés.
   */
  const plan = await planDe(usuario.id);
  const { rows: cuantos } = await consultar(
    `select count(*)::int as n from planteles
      where dueno = $1 and not borrado and id <> $2`,
    [usuario.id, id]
  );
  const { rows: existe } = await consultar(
    `select 1 from planteles where dueno = $1 and id = $2 and not borrado`,
    [usuario.id, id]
  );
  if (existe.length === 0 && !hayLugar(cuantos[0].n, plan)) {
    return c.json(
      { error: 'Llegaste al límite de planteles de tu plan.', limite: true },
      409
    );
  }

  await consultar(
    `insert into planteles (id, dueno, nombre, llegada, datos, borrado, borrado_en, actualizado)
     values ($1, $2, $3, $4, $5, false, null, now())
     on conflict (dueno, id) do update
       set nombre = excluded.nombre,
           llegada = excluded.llegada,
           datos = excluded.datos,
           borrado = false,
           borrado_en = null,
           actualizado = now()`,
    [
      id,
      usuario.id,
      p.nombre,
      p.llegada ?? new Date().toISOString(),
      JSON.stringify(p.datos ?? {}),
    ]
  );

  const { rows } = await consultar(
    `select actualizado from planteles where dueno = $1 and id = $2`,
    [usuario.id, id]
  );
  return c.json({ ok: true, actualizado: rows[0].actualizado });
});

/** Lo que está en la papelera, de lo más nuevo a lo más viejo. */
app.get('/planteles/papelera', async (c) => {
  const usuario = c.get('usuario');
  const { rows } = await consultar(
    `select id, nombre, llegada, datos, borrado_en from planteles
      where dueno = $1 and borrado and borrado_en is not null
      order by borrado_en desc`,
    [usuario.id]
  );
  return c.json({ planteles: rows, dias: DIAS_DE_PAPELERA });
});

/** Saca uno de la papelera. Vuelve como estaba, con todo lo que tenía. */
app.post('/planteles/:id/restaurar', async (c) => {
  const usuario = c.get('usuario');
  const plan = await planDe(usuario.id);
  const { rows: cuantos } = await consultar(
    `select count(*)::int as n from planteles where dueno = $1 and not borrado`,
    [usuario.id]
  );
  if (!hayLugar(cuantos[0].n, plan)) {
    return c.json(
      { error: 'No te entra otro plantel en tu plan.', limite: true },
      409
    );
  }

  const { rowCount } = await consultar(
    `update planteles set borrado = false, borrado_en = null, actualizado = now()
      where dueno = $1 and id = $2 and borrado`,
    [usuario.id, c.req.param('id')]
  );
  if (rowCount === 0) return c.json({ error: 'Ese plantel ya no está.' }, 404);
  return c.json({ ok: true });
});

/**
 * Sube todos los planteles de una. Es un upsert y nunca borra: una app recién
 * instalada, con la lista vacía, no tiene por qué poder vaciar el respaldo
 * antes de que la persona alcance a restaurarlo.
 */
app.put('/planteles', async (c) => {
  const usuario = c.get('usuario');
  const cuerpo = await c.req.json().catch(() => null);
  const lista = Array.isArray(cuerpo?.planteles) ? cuerpo.planteles : null;
  if (!lista) return c.json({ error: 'Falta la lista de planteles.' }, 400);
  if (lista.length === 0) return c.json({ guardados: 0, ignorados: 0 });
  if (lista.length > 200) return c.json({ error: 'Demasiados planteles.' }, 413);

  // El límite se aplica acá y no se confía en lo que diga la app: un APK
  // modificado puede pedir lo que quiera, pero lo que se guarda lo decide el
  // servidor contra el plan que figura en la base.
  const { aceptados, ignorados } = recortarAlPlan(
    lista,
    await planDe(usuario.id)
  );

  for (const p of aceptados) {
    if (typeof p?.id !== 'string' || typeof p?.nombre !== 'string') continue;
    await consultar(
      `insert into planteles (id, dueno, nombre, llegada, datos, borrado, actualizado)
       values ($1, $2, $3, $4, $5, false, now())
       on conflict (dueno, id) do update
         set nombre = excluded.nombre,
             llegada = excluded.llegada,
             datos = excluded.datos,
             borrado = false,
             actualizado = now()`,
      [
        p.id,
        usuario.id,
        p.nombre,
        p.llegada ?? new Date().toISOString(),
        JSON.stringify(p.datos ?? {}),
      ]
    );
  }
  // Recién acá se sabe qué fotos siguen en uso: se mira lo que quedó
  // guardado, no lo que vino en el pedido, así una foto que referencia un
  // plantel que no vino en este backup tampoco se borra.
  const fotosBorradas = await limpiarHuerfanas(
    usuario.id,
    await fotosEnUso(usuario.id)
  ).catch(() => 0);

  return c.json({ guardados: aceptados.length, ignorados, fotosBorradas });
});

/**
 * Las URLs de foto que aparecen en los planteles de una cuenta.
 *
 * Los de la papelera cuentan como en uso: mientras se puedan recuperar, sus
 * fotos tienen que seguir estando. Si no, el plantel volvería con las cartas
 * rotas, que es casi peor que no poder recuperarlo.
 */
async function fotosEnUso(usuarioId) {
  const { rows } = await consultar(
    'select datos from planteles where dueno = $1',
    [usuarioId]
  );
  const usadas = [];
  for (const fila of rows) {
    for (const jugador of fila.datos?.jugadores ?? []) {
      if (typeof jugador?.foto === 'string') usadas.push(jugador.foto);
    }
  }
  return usadas;
}

/**
 * Se marca en vez de borrar: si la fila desapareciera, el plantel volvería a
 * aparecer la próxima vez que otro teléfono restaure.
 */
/**
 * Borra un plantel. No lo saca de la base: lo manda a la papelera.
 *
 * Con el guardado automático esto es lo que reemplaza a la protección que daba
 * el backup manual. Antes, borrar sin querer no tocaba la copia de la nube
 * hasta que apretabas el botón; ahora sube solo, así que el seguro tiene que
 * estar del otro lado.
 */
app.delete('/planteles/:id', async (c) => {
  const usuario = c.get('usuario');
  await consultar(
    `update planteles set borrado = true, borrado_en = now(), actualizado = now()
     where dueno = $1 and id = $2 and not borrado`,
    [usuario.id, c.req.param('id')]
  );
  /*
   * Vaciar lo viejo deja fotos sin dueño: se barren contra lo que sigue
   * referenciado, que ahora incluye lo que está en la papelera.
   */
  try {
    const sueltas = await vaciarPapeleraVieja(usuario.id);
    if (sueltas.length > 0) {
      await limpiarHuerfanas(usuario.id, await fotosEnUso(usuario.id));
    }
  } catch {
    // Que no se pueda vaciar lo viejo no tiene por qué frenar el borrado.
  }

  return c.json({ ok: true });
});

app.onError((error, c) => {
  // El detalle va al log del servidor; al teléfono sólo que falló, para no
  // filtrar nombres de tablas ni cadenas de conexión en un mensaje de error.
  console.error(error);
  return c.json({ error: 'Error del servidor.' }, 500);
});

const puerto = Number(process.env.PORT ?? 3000);
serve({ fetch: app.fetch, port: puerto }, () =>
  console.log(`canchero-api escuchando en :${puerto}`)
);
