import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { auth } from './auth.js';
import { consultar } from './db.js';
import { hayMails } from './mails.js';
import { planDe, recortarAlPlan } from './planes.js';
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
 */
app.get('/', (c) =>
  c.json({
    ok: true,
    servicio: 'canchero-api',
    fotos: hayFotos,
    mails: hayMails,
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

app.use('/perfil', async (c, siguiente) => {
  const sesion = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!sesion?.user) return c.json({ error: 'Sesión no válida.' }, 401);
  c.set('usuario', sesion.user);
  await siguiente();
});

/**
 * El plan de la cuenta. Lo lee la app para saber si mostrar los límites, pero
 * no hay forma de escribirlo desde acá: eso lo hace el webhook del cobro, con
 * su propia clave. Un APK modificado no puede volverse Pro.
 */
app.get('/perfil', async (c) => {
  const usuario = c.get('usuario');
  return c.json({ email: usuario.email, plan: await planDe(usuario.id) });
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
    return c.json(await permisoDeSubida(usuario.id, cuerpo?.tipo));
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

app.get('/planteles', async (c) => {
  const usuario = c.get('usuario');
  const { rows } = await consultar(
    `select id, nombre, llegada, datos from planteles
     where dueno = $1 and not borrado
     order by llegada asc`,
    [usuario.id]
  );
  return c.json({ planteles: rows });
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

/** Las URLs de foto que aparecen en los planteles vivos de una cuenta. */
async function fotosEnUso(usuarioId) {
  const { rows } = await consultar(
    'select datos from planteles where dueno = $1 and not borrado',
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
app.delete('/planteles/:id', async (c) => {
  const usuario = c.get('usuario');
  await consultar(
    `update planteles set borrado = true, actualizado = now()
     where dueno = $1 and id = $2`,
    [usuario.id, c.req.param('id')]
  );
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
