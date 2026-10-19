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
import {
  abrirConvocatoria,
  cerrarConvocatoria,
  convocatoriaAbierta,
  convocatoriaPublica,
  responder,
} from './convocatorias.js';
import {
  encabezados,
  nonceNuevo,
  paginaConvocatoria,
  paginaVencida,
} from './paginaConvocatoria.js';
import {
  borrarParaSiempre,
  DIAS_DE_PAPELERA,
  EN_LA_PAPELERA,
  recortarPapelera,
  vaciarPapeleraVieja,
} from './papelera.js';
import {
  aceptar,
  cancelarEnviosDe,
  enviarPlantel,
  pendientesDe,
  rechazar,
} from './envios.js';
import {
  guardarPerfil,
  leerPerfil,
  normalizar,
  problemaDelUsuario,
} from './perfil.js';
import {
  planDe,
  recortarAlPlan,
  topeDePapelera,
  topeDePlanteles,
} from './planes.js';
import {
  borrarFoto,
  borrarLasFotosDe,
  borrarLasFotosDelPlantel,
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

/** A dónde vuelve el que confirmó su mail. Lo abre la app por su esquema. */
const VUELTA = 'canchero://verificado';

/**
 * Confirmar el mail y volver a la app, ya adentro.
 *
 * Esto pasa en el navegador del teléfono y no en la app, así que la sesión que
 * se crea al confirmar queda del lado del navegador. Para que la app entre
 * sola, acá se arma un código de un solo uso y se lo manda en la vuelta: la
 * app lo canjea por la sesión y listo.
 *
 * Antes el link de Better Auth terminaba redirigiendo al `/` del servidor, que
 * contesta el JSON de salud. Eso es lo que veía la persona después de tocar
 * "confirmar mi cuenta".
 */
app.get('/verificar', async (c) => {
  const token = c.req.query('token');
  if (!token) return c.redirect(`${VUELTA}?error=falta`);

  try {
    // Se reusa el handler de Better Auth en vez de repetir lo que hace: es el
    // que sabe validar el token, marcar el mail y abrir la sesión.
    const base = (process.env.BASE_URL ?? '').replace(/\/+$/, '');
    const respuesta = await auth.handler(
      new Request(
        `${base}/api/auth/verify-email?token=${encodeURIComponent(token)}`,
        { headers: { origin: base } }
      )
    );

    const galletitas = respuesta.headers.getSetCookie
      ? respuesta.headers.getSetCookie()
      : [respuesta.headers.get('set-cookie')].filter(Boolean);
    const sesion = galletitas
      .map((x) => x.split(';')[0])
      .find((x) => x.includes('session_token='));

    if (!sesion) {
      // Token vencido o ya usado: se vuelve igual, y la app lo explica.
      return c.redirect(`${VUELTA}?error=vencido`);
    }

    const { token: codigo } = await auth.api.generateOneTimeToken({
      headers: { cookie: sesion },
    });
    return c.redirect(`${VUELTA}?codigo=${encodeURIComponent(codigo)}`);
  } catch {
    return c.redirect(`${VUELTA}?error=vencido`);
  }
});

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

app.use('/cuenta/*', async (c, siguiente) => {
  const sesion = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!sesion?.user) return c.json({ error: 'Sesión no válida.' }, 401);
  c.set('usuario', sesion.user);
  await siguiente();
});

// Cubre también `/convocatorias` a secas, igual que `/planteles/*`.
app.use('/convocatorias/*', async (c, siguiente) => {
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
 * Si un nombre de usuario está libre. Sin sesión, porque hace falta al crear
 * la cuenta: ahí todavía no hay con qué identificarse.
 *
 * Contesta sí o no y nada más — ni la foto, ni el id, ni cuándo se registró.
 * Lo que se puede averiguar con esto es si un nombre está tomado, que es
 * justamente lo que un nombre de usuario dice de sí mismo: si lo tuvieras que
 * adivinar para agregar a alguien, no serviría para nada.
 */
app.get('/usuarios/libre', async (c) => {
  const nombre = normalizar(c.req.query('nombre'));
  const problema = problemaDelUsuario(nombre);
  if (problema) return c.json({ libre: false, problema });

  const { rows } = await consultar(
    `select 1 from perfiles where lower(usuario) = $1`,
    [nombre]
  );
  return rows.length > 0
    ? c.json({ libre: false, problema: 'Ese nombre ya está tomado.' })
    : c.json({ libre: true });
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

/**
 * El `plantel` del cuerpo es el id con el que el teléfono lo va a guardar.
 *
 * Lo inventa él y no el servidor porque acá no se sabe con qué ids ya carga, y
 * dos planteles con el mismo id se pisarían al respaldar. Viaja hasta acá
 * porque las fotos se copian a la carpeta de ese plantel, y esa carpeta hay
 * que saber cómo se llama antes de escribir adentro.
 */
app.post('/envios/:id/aceptar', async (c) => {
  const usuario = c.get('usuario');
  const cuerpo = await c.req.json().catch(() => null);
  try {
    return c.json(
      await aceptar(usuario.id, c.req.param('id'), cuerpo?.plantel)
    );
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
      await permisoDeSubida(usuario.id, cuerpo?.tipo, cuerpo?.destino)
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
 * Darse de baja: se va la cuenta y todo lo que cuelga de ella.
 *
 * Play Store lo exige para cualquier app con cuentas, pero además
 * corresponde: si alguien guardó acá los nombres y las caras de sus amigos,
 * tiene que poder llevárselos.
 *
 * Se pide la contraseña de nuevo. No es burocracia: esto no se puede deshacer
 * y no hay papelera que valga, así que un teléfono desbloqueado en la mesa no
 * puede alcanzar para borrarle a alguien tres años de partidos.
 *
 * Una sola sentencia limpia la base entera: todo lo que cuelga del usuario
 * —planteles, amistades, mensajes, envíos, dispositivos, perfil, y las tablas
 * de sesión— está declarado `on delete cascade`.
 */
app.post('/cuenta/borrar', async (c) => {
  const usuario = c.get('usuario');
  const cuerpo = await c.req.json().catch(() => null);
  const clave = typeof cuerpo?.password === 'string' ? cuerpo.password : '';
  if (!clave) return c.json({ error: 'Falta la contraseña.' }, 400);

  try {
    await auth.api.signInEmail({
      body: { email: usuario.email, password: clave },
    });
  } catch {
    return c.json({ error: 'La contraseña no es correcta.' }, 401);
  }

  /*
   * La fila primero y las fotos después, y el orden importa: si fallara el
   * borrado de la base después de haber volado las fotos, la cuenta quedaría
   * viva y con las caras rotas, que es lo peor de los dos mundos. Al revés,
   * lo que puede quedar es alguna foto sin dueño en R2 — recuperable con un
   * barrido, y nadie puede llegar a ella.
   */
  await consultar('delete from "user" where id = $1', [usuario.id]);
  const fotos = await borrarLasFotosDe(usuario.id).catch(() => 0);

  return c.json({ ok: true, fotos });
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

  /*
   * El reloj del servidor, no el del teléfono. El próximo `desde` sale de acá:
   * si saliera del teléfono, un celular atrasado unos segundos se perdería los
   * cambios de esa ventana para siempre.
   *
   * Y se toma ANTES de leer las filas, no después. Al revés había una ventana
   * que perdía cambios para siempre: un plantel guardado desde otro teléfono
   * justo entre la lectura y el `now()` no salía en las filas —todavía no
   * estaba— pero quedaba con fecha anterior al corte que se llevaba éste, así
   * que el próximo `?desde=` tampoco lo iba a traer. Tomándolo antes, lo que
   * cae en esa ventana se manda dos veces, y mandar algo dos veces no cuesta
   * nada: llega igual y se aplica igual.
   */
  const { rows: ahora } = await consultar(`select now() as ahora`);

  /*
   * `restaurado_en` viaja porque la app necesita saber, antes de borrar, si
   * este plantel ya salió de la papelera una vez: si ya salió, el próximo
   * borrado es definitivo y hay que avisarlo. Se decide en el teléfono para
   * poder avisar sin internet, que es cuando el borrado igual funciona.
   */
  const { rows } = desde
    ? await consultar(
        `select id, nombre, llegada, datos, borrado, actualizado, restaurado_en
           from planteles
          where dueno = $1 and actualizado > $2
          order by llegada asc`,
        [usuario.id, desde]
      )
    : await consultar(
        `select id, nombre, llegada, datos, borrado, actualizado, restaurado_en
           from planteles
          where dueno = $1 and not borrado
          order by llegada asc`,
        [usuario.id]
      );

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

  const plan = await planDe(usuario.id);
  const tope = topeDePlanteles(plan);

  /*
   * El límite se cuenta acá y no se confía en lo que diga la app, y se cuenta
   * adentro del mismo insert a propósito.
   *
   * Antes eran tres pedidos: contar, ver si ya existía, y recién después
   * guardar. Entre el conteo y el insert no había nada que impidiera que otro
   * teléfono de la misma cuenta guardara el suyo, y los dos pasaban el control
   * con el mismo número — dos teléfonos sincronizando a la vez dejaban tres
   * planteles en un plan de dos. Así la condición se evalúa en el momento de
   * escribir, que es el único momento en que vale.
   *
   * Un plantel que ya existe siempre se puede seguir guardando: lo que el plan
   * limita es cuántos tenés, no que puedas editar los que tenés. Uno que está
   * en la papelera no cuenta como que existe: revivirlo ocupa un lugar igual
   * que crear otro, y si no sería la forma de saltarse el tope.
   */
  const { rows } = await consultar(
    `insert into planteles (id, dueno, nombre, llegada, datos, borrado, borrado_en, actualizado)
     select $1, $2, $3, $4, $5, false, null, now()
      where exists (
              select 1 from planteles
               where dueno = $2 and id = $1 and not borrado
            )
         or (
              select count(*) from planteles
               where dueno = $2 and not borrado
            ) < $6
     on conflict (dueno, id) do update
       set nombre = excluded.nombre,
           llegada = excluded.llegada,
           datos = excluded.datos,
           borrado = false,
           borrado_en = null,
           actualizado = now()
     returning actualizado`,
    [
      id,
      usuario.id,
      p.nombre,
      p.llegada ?? new Date().toISOString(),
      JSON.stringify(p.datos ?? {}),
      Number.isFinite(tope) ? tope : Number.MAX_SAFE_INTEGER,
    ]
  );

  // Sin filas es que la condición no se cumplió: no había lugar.
  if (rows.length === 0) {
    return c.json(
      { error: 'Llegaste al límite de planteles de tu plan.', limite: true },
      409
    );
  }

  return c.json({ ok: true, actualizado: rows[0].actualizado });
});

/** Lo que está en la papelera, de lo más nuevo a lo más viejo. */
app.get('/planteles/papelera', async (c) => {
  const usuario = c.get('usuario');
  /*
   * También filtra por el plazo, y no sólo por estar borrado. Vaciar lo viejo
   * corre cuando alguien borra algo y no con un reloj, así que una cuenta
   * quieta puede tener adentro cosas de hace meses: si se mostraran, los días
   * que dice la pantalla serían mentira.
   */
  const { rows } = await consultar(
    `select id, nombre, llegada, datos, borrado_en
       from planteles
      where dueno = $1 and ${EN_LA_PAPELERA}
        and borrado_en > now() - ($2 || ' days')::interval
      order by borrado_en desc`,
    [usuario.id, String(DIAS_DE_PAPELERA)]
  );
  // El tope viaja para que la app pueda decir cuántos guarda sin tener una
  // copia del número que se desincronice de éste.
  return c.json({
    planteles: rows,
    dias: DIAS_DE_PAPELERA,
    tope: topeDePapelera(await planDe(usuario.id)),
  });
});

/**
 * Saca uno de la papelera. Vuelve como estaba, con todo lo que tenía.
 *
 * Dos condiciones, y las dos van adentro del update. Contarlas antes y
 * escribir después dejaría pasar dos pedidos a la vez, que es justo lo que hay
 * que evitar.
 *
 *   1. Que no haya pasado el plazo. Vaciar lo viejo corre cuando alguien borra
 *      algo y no con un reloj, así que una cuenta quieta puede tener adentro
 *      cosas de hace meses: sin este control se podrían recuperar, y los días
 *      que dice la pantalla serían mentira.
 *   2. Que haya lugar en el plan.
 *
 * Que se haya sacado antes no se controla acá: uno que ya salió una vez no
 * vuelve a la papelera nunca —el segundo borrado es definitivo— así que no
 * puede estar adentro para sacarlo de nuevo.
 */
app.post('/planteles/:id/restaurar', async (c) => {
  const usuario = c.get('usuario');
  const id = c.req.param('id');
  const tope = topeDePlanteles(await planDe(usuario.id));

  const { rowCount } = await consultar(
    `update planteles
        set borrado = false,
            borrado_en = null,
            restaurado_en = now(),
            actualizado = now()
      where dueno = $1 and id = $2 and ${EN_LA_PAPELERA}
        and borrado_en > now() - ($4 || ' days')::interval
        and (
          select count(*) from planteles where dueno = $1 and not borrado
        ) < $3`,
    [
      usuario.id,
      id,
      Number.isFinite(tope) ? tope : Number.MAX_SAFE_INTEGER,
      String(DIAS_DE_PAPELERA),
    ]
  );

  if (rowCount === 0) {
    /*
     * No se restauró, y hay dos motivos posibles. Distinguirlos cuesta otro
     * pedido, pero sólo se paga cuando ya falló: en el camino bueno esto no
     * corre.
     */
    const { rows } = await consultar(
      `select (count(*) filter (
                where id = $2 and ${EN_LA_PAPELERA}
                  and borrado_en > now() - ($3 || ' days')::interval
              ))::int as a_tiempo
         from planteles where dueno = $1`,
      [usuario.id, id, String(DIAS_DE_PAPELERA)]
    );

    /*
     * Uno que pasó el plazo cuenta como que no está, aunque la fila siga: para
     * el que mira, se fue de la papelera. Es lo mismo que muestra la lista.
     */
    if (rows[0].a_tiempo === 0) {
      return c.json({ error: 'Ese plantel ya no está.' }, 404);
    }
    return c.json(
      { error: 'No te entra otro plantel en tu plan.', limite: true },
      409
    );
  }

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
  const id = c.req.param('id');

  /*
   * El segundo borrado de un plantel que ya salió una vez de la papelera es
   * definitivo: se van los jugadores, los partidos y las fotos, y queda sólo
   * la lápida para que los otros teléfonos se enteren. La app avisa antes de
   * llegar acá; esto es lo que lo hace de verdad.
   *
   * Si no era de ésos, `borrarParaSiempre` no toca nada y va a la papelera.
   */
  const definitivo = await borrarParaSiempre(usuario.id, id);

  if (!definitivo) {
    await consultar(
      `update planteles set borrado = true, borrado_en = now(), actualizado = now()
       where dueno = $1 and id = $2 and not borrado`,
      [usuario.id, id]
    );
  }

  // Lo que se compartió de este plantel y todavía nadie aceptó se cancela: lo
  // que iban a recibir ya no existe.
  await cancelarEnviosDe(usuario.id, id).catch(() => 0);
  /*
   * Los dos límites de la papelera, cada vez que entra algo: los días y la
   * cantidad. Los tres caminos por los que un plantel se va de verdad —el
   * borrado definitivo, lo que venció, lo que la papelera desplazó por llena—
   * terminan en lo mismo: se le borra la carpeta en R2.
   *
   * Nada de esto puede frenar el borrado. Lo que quede colgado en el bucket es
   * basura que no se ve desde ningún lado, y el barrido de huérfanas del
   * próximo backup la levanta igual.
   */
  try {
    const sinDueno = [
      ...(definitivo ? [id] : []),
      ...(await vaciarPapeleraVieja(usuario.id)),
      ...(await recortarPapelera(
        usuario.id,
        topeDePapelera(await planDe(usuario.id))
      )),
    ];
    for (const plantelId of sinDueno) {
      await borrarLasFotosDelPlantel(usuario.id, plantelId).catch(() => 0);
    }
  } catch {
    // Que no se pueda vaciar lo viejo no tiene por qué frenar el borrado.
  }

  return c.json({ ok: true, definitivo });
});

/**
 * El link que se manda al grupo. Con BASE_URL, que es la dirección pública:
 * la del pedido, detrás del proxy de Render, puede venir como http interno.
 */
function linkDe(c, codigo) {
  const base = (process.env.BASE_URL ?? new URL(c.req.url).origin).replace(/\/+$/, '');
  return `${base}/v/${codigo}`;
}

/**
 * Abre la convocatoria de un plantel para un día: "¿quién viene el sábado?".
 * Si ya había una para ese día devuelve la misma, con lo que ya contestaron.
 */
app.post('/convocatorias', async (c) => {
  const usuario = c.get('usuario');
  const cuerpo = await c.req.json().catch(() => null);
  try {
    const convocatoria = await abrirConvocatoria(
      usuario.id,
      cuerpo?.plantelId,
      cuerpo?.fecha
    );
    return c.json({ convocatoria: { ...convocatoria, url: linkDe(c, convocatoria.codigo) } });
  } catch (error) {
    return c.json({ error: error.message }, error.status ?? 500);
  }
});

/** La que está abierta para un plantel, con las respuestas. */
app.get('/convocatorias', async (c) => {
  const usuario = c.get('usuario');
  const plantelId = c.req.query('plantel');
  if (!plantelId) return c.json({ error: 'Falta el plantel.' }, 400);
  const convocatoria = await convocatoriaAbierta(usuario.id, plantelId);
  return c.json({
    convocatoria: convocatoria
      ? { ...convocatoria, url: linkDe(c, convocatoria.codigo) }
      : null,
  });
});

/** Cierra el link: el que lo abra después ve que ya no está activo. */
app.delete('/convocatorias/:codigo', async (c) => {
  const usuario = c.get('usuario');
  await cerrarConvocatoria(usuario.id, c.req.param('codigo'));
  return c.json({ ok: true });
});

/**
 * La página del link, sin sesión: la abre cualquiera del grupo desde
 * WhatsApp. Lo que la protege es que el código no se puede adivinar.
 */
app.get('/v/:codigo', async (c) => {
  const codigo = c.req.param('codigo');
  const nonce = nonceNuevo();
  const datos = await convocatoriaPublica(codigo);
  if (!datos) {
    return c.body(paginaVencida(), 404, encabezados(nonce));
  }
  return c.body(paginaConvocatoria({ codigo, ...datos }, nonce), 200, encabezados(nonce));
});

/** "Voy" o "no voy", desde esa página. */
app.post('/v/:codigo', async (c) => {
  const cuerpo = await c.req.json().catch(() => null);
  try {
    return c.json(
      await responder(c.req.param('codigo'), cuerpo?.jugadorId, cuerpo?.va)
    );
  } catch (error) {
    return c.json({ error: error.message }, error.status ?? 500);
  }
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
