import { randomBytes } from 'node:crypto';
import { consultar } from './db.js';

/**
 * "¿Quién viene el sábado?" con un link.
 *
 * El que organiza abre una convocatoria para un plantel y un día, y manda el
 * link al grupo. Cada uno lo abre en el navegador, toca su nombre y dice si va.
 * Sin cuenta y sin instalar nada: si para anotarse hubiera que bajar la app,
 * la mitad del grupo contestaría "voy" por WhatsApp y volvemos a empezar.
 *
 * El código del link es lo único que la protege. Por eso es largo y al azar
 * —nueve bytes, 72 bits—: no se adivina, y quien lo tiene es porque estaba en
 * el grupo al que se mandó.
 */

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

function error(mensaje, status) {
  return Object.assign(new Error(mensaje), { status });
}

/** Un día de verdad: "2026-02-30" tiene la forma pero no existe. */
function fechaValida(fecha) {
  if (typeof fecha !== 'string' || !FECHA.test(fecha)) return false;
  const [a, m, d] = fecha.split('-').map(Number);
  const dia = new Date(Date.UTC(a, m - 1, d));
  return dia.getUTCFullYear() === a && dia.getUTCMonth() === m - 1 && dia.getUTCDate() === d;
}

/** Lo que viaja a la app: el código, el día y quién contestó qué. */
function aLaApp(fila) {
  return { codigo: fila.codigo, fecha: fila.fecha, respuestas: fila.respuestas ?? {} };
}

/**
 * Abre la convocatoria de un plantel para un día.
 *
 * Si ya hay una abierta para ese mismo día, devuelve ésa: tocar "preguntar"
 * dos veces no tiene por qué borrar a los que ya contestaron. Si es para otro
 * día, la anterior se cierra —su link deja de andar— y empieza una de cero:
 * los que iban el sábado pasado no van necesariamente a éste.
 */
export async function abrirConvocatoria(usuarioId, plantelId, fecha) {
  if (typeof plantelId !== 'string' || !plantelId) {
    throw error('Falta el plantel.', 400);
  }
  if (!fechaValida(fecha)) throw error('La fecha no es válida.', 400);

  const { rows: plantel } = await consultar(
    `select 1 from planteles where dueno = $1 and id = $2 and not borrado`,
    [usuarioId, plantelId]
  );
  if (plantel.length === 0) {
    // Lo más común es que el plantel recién creado todavía no se haya
    // terminado de guardar en la nube.
    throw error(
      'Ese plantel todavía no está guardado en la nube. Esperá unos segundos y probá de nuevo.',
      409
    );
  }

  const { rows: abiertas } = await consultar(
    `select codigo, fecha, respuestas from convocatorias
      where dueno = $1 and plantel_id = $2 and not cerrada`,
    [usuarioId, plantelId]
  );
  const misma = abiertas.find((f) => f.fecha === fecha);
  if (misma) return aLaApp(misma);

  await consultar(
    `update convocatorias set cerrada = true, actualizada = now()
      where dueno = $1 and plantel_id = $2 and not cerrada`,
    [usuarioId, plantelId]
  );
  const codigo = randomBytes(9).toString('base64url');
  const { rows } = await consultar(
    `insert into convocatorias (codigo, dueno, plantel_id, fecha)
     values ($1, $2, $3, $4)
     returning codigo, fecha, respuestas`,
    [codigo, usuarioId, plantelId, fecha]
  );
  return aLaApp(rows[0]);
}

/** La abierta de un plantel, o null. */
export async function convocatoriaAbierta(usuarioId, plantelId) {
  const { rows } = await consultar(
    `select codigo, fecha, respuestas from convocatorias
      where dueno = $1 and plantel_id = $2 and not cerrada
      order by creada desc limit 1`,
    [usuarioId, plantelId]
  );
  return rows.length > 0 ? aLaApp(rows[0]) : null;
}

/** Cierra una: el link deja de andar. Sólo la puede cerrar quien la abrió. */
export async function cerrarConvocatoria(usuarioId, codigo) {
  await consultar(
    `update convocatorias set cerrada = true, actualizada = now()
      where codigo = $1 and dueno = $2`,
    [codigo, usuarioId]
  );
}

/**
 * Lo que ve el que abre el link: el plantel, el día, los nombres y quién ya
 * contestó. Null si el link no existe, se cerró o el plantel se borró: para el
 * que lo abre es lo mismo, ya no sirve.
 *
 * Sólo los nombres de los jugadores, nada más del plantel: ni las fotos, ni
 * los puntajes, ni los partidos. Es lo que el grupo ya sabe de sí mismo.
 */
export async function convocatoriaPublica(codigo) {
  if (typeof codigo !== 'string' || codigo.length > 40) return null;
  const { rows } = await consultar(
    `select c.fecha, c.respuestas, p.nombre, p.datos
       from convocatorias c
       join planteles p on p.dueno = c.dueno and p.id = c.plantel_id
      where c.codigo = $1 and not c.cerrada and not p.borrado`,
    [codigo]
  );
  if (rows.length === 0) return null;
  const fila = rows[0];

  const jugadores = (Array.isArray(fila.datos?.jugadores) ? fila.datos.jugadores : [])
    .filter((j) => typeof j?.id === 'string' && typeof j?.nombre === 'string')
    .map((j) => ({ id: j.id, nombre: j.nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  // Las respuestas de alguien que ya no está en el plantel no se muestran:
  // no hay a quién ponérselas.
  const ids = new Set(jugadores.map((j) => j.id));
  const respuestas = {};
  for (const [id, r] of Object.entries(fila.respuestas ?? {})) {
    if (ids.has(id) && typeof r?.va === 'boolean') respuestas[id] = r.va;
  }

  return { plantel: fila.nombre, fecha: fila.fecha, jugadores, respuestas };
}

/**
 * Anota a alguien. Cualquiera con el link puede contestar por cualquiera, y
 * es a propósito: es lo que ya pasa en el grupo ("anotame que no llego a
 * contestar"). Lo que no se puede es inventar a alguien que no está en el
 * plantel.
 */
export async function responder(codigo, jugadorId, va) {
  if (typeof va !== 'boolean') throw error('Falta si va o no.', 400);
  const actual = await convocatoriaPublica(codigo);
  if (!actual) throw error('Este link ya no está activo.', 404);
  if (!actual.jugadores.some((j) => j.id === jugadorId)) {
    throw error('Ese nombre no está en la lista.', 400);
  }

  await consultar(
    `update convocatorias
        set respuestas = respuestas || jsonb_build_object(
              $2::text, jsonb_build_object('va', $3::boolean, 'cuando', now())
            ),
            actualizada = now()
      where codigo = $1 and not cerrada`,
    [codigo, jugadorId, va]
  );
  return { respuestas: { ...actual.respuestas, [jugadorId]: va } };
}
