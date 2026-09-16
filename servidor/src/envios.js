import { randomBytes } from 'node:crypto';
import { anotarMensaje, idDe, sonAmigos, usuarioDe } from './amigos.js';
import { avisar } from './avisos.js';
import { consultar } from './db.js';
import { copiarFoto } from './fotos.js';
import { normalizar } from './perfil.js';

/**
 * Mandarle un plantel a otro por su nombre de usuario.
 *
 * Viaja una copia: el que recibe lo acepta y a partir de ahí es suyo, sin que
 * lo que haga uno toque lo del otro. Un plantel compartido de verdad —los dos
 * cargando los mismos partidos— es otra cosa, y hay que decidir antes quién
 * gana cuando los dos editan lo mismo.
 */

/** Cuántos envíos sin abrir puede tener alguien encima. */
const TOPE_PENDIENTES = 50;

const nuevoId = () => randomBytes(12).toString('hex');

function comoSaleAfuera(fila) {
  return {
    id: fila.id,
    de: fila.de_usuario,
    foto: fila.de_foto ?? null,
    nombre: fila.nombre,
    enviado: fila.enviado,
    jugadores: Array.isArray(fila.datos?.jugadores)
      ? fila.datos.jugadores.length
      : 0,
    partidos: Array.isArray(fila.datos?.partidos)
      ? fila.datos.partidos.length
      : 0,
  };
}

/**
 * Manda el plantel. El que manda tiene que tener nombre de usuario: el que lo
 * recibe necesita saber de quién es, y "te llegó un plantel de alguien" no
 * sirve para decidir si aceptarlo.
 */
export async function enviarPlantel(deId, aQuien, plantel) {
  const destino = normalizar(aQuien);
  if (!destino) {
    throw Object.assign(new Error('Falta a quién mandárselo.'), { status: 400 });
  }
  if (!plantel || typeof plantel !== 'object' || typeof plantel.nombre !== 'string') {
    throw Object.assign(new Error('Falta el plantel.'), { status: 400 });
  }

  const miUsuario = await usuarioDe(deId);
  if (!miUsuario) {
    throw Object.assign(
      new Error('Elegí tu nombre de usuario antes de mandar un plantel.'),
      { status: 409 }
    );
  }
  if (miUsuario === destino) {
    throw Object.assign(new Error('Ese sos vos.'), { status: 400 });
  }

  const paraId = await idDe(destino);
  if (!paraId) {
    // Acá sí se dice que no existe, y no es un descuido: para mandarle algo a
    // alguien hay que saber si le llegó. Lo que se averigua es un nombre de
    // usuario, que es público por definición; el mail no se toca.
    throw Object.assign(new Error(`No hay nadie que se llame @${destino}.`), {
      status: 404,
    });
  }

  // Sólo entre amigos. La solicitud es lo que te deja decidir de quién querés
  // recibir algo; sin esto, cualquiera que sepa tu nombre te llena la lista.
  if (!(await sonAmigos(deId, paraId))) {
    throw Object.assign(
      new Error(`Todavía no sos amigo de @${destino}.`),
      { status: 403 }
    );
  }

  const { rows: cuantos } = await consultar(
    `select count(*)::int as n from envios where para = $1 and estado = 'pendiente'`,
    [paraId]
  );
  if (cuantos[0].n >= TOPE_PENDIENTES) {
    throw Object.assign(
      new Error('Esa persona tiene demasiados envíos sin abrir.'),
      { status: 429 }
    );
  }

  const id = nuevoId();
  await consultar(
    `insert into envios (id, de, para, nombre, datos, plantel_id)
     values ($1, $2, $3, $4, $5, $6)`,
    [
      id,
      deId,
      paraId,
      plantel.nombre,
      plantel.datos ?? {},
      // De qué plantel salió: si lo borran antes de que el otro lo acepte,
      // este envío se cancela.
      typeof plantel.id === 'string' ? plantel.id : null,
    ]
  );
  // El envío es un mensaje más de la conversación: así se ve en el mismo lugar
  // que todo lo demás, y su estado sale de esta misma fila.
  await anotarMensaje(deId, paraId, { tipo: 'plantel', envio: id });

  await avisar(paraId, {
    titulo: `@${miUsuario} te mandó un plantel`,
    cuerpo: plantel.nombre,
    datos: { tipo: 'plantel', de: miUsuario },
  });

  return { id, para: destino, paraId };
}

/** Lo que le llegó y todavía no abrió, del más viejo al más nuevo. */
export async function pendientesDe(usuarioId) {
  const { rows } = await consultar(
    `select e.id, e.nombre, e.datos, e.enviado,
            p.usuario as de_usuario, p.foto as de_foto
       from envios e
       join perfiles p on p.usuario_id = e.de
      where e.para = $1 and e.estado = 'pendiente'
      order by e.enviado`,
    [usuarioId]
  );
  return rows.map(comoSaleAfuera);
}

/**
 * Acepta uno y devuelve el plantel para que el teléfono lo guarde.
 *
 * Las fotos se copian a la carpeta del que recibe. Si quedaran apuntando a las
 * del que mandó, el día que ese otro borre su plantel la limpieza de huérfanas
 * se las llevaría y las cartas quedarían rotas.
 *
 * El id nuevo del plantel lo pone el teléfono: acá no se sabe con qué ids ya
 * carga, y dos planteles con el mismo id se pisarían al respaldar.
 */
export async function aceptar(usuarioId, envioId) {
  const { rows } = await consultar(
    `update envios set estado = 'aceptado', resuelto = now()
      where id = $1 and para = $2 and estado = 'pendiente'
      returning nombre, datos, de`,
    [envioId, usuarioId]
  );
  if (rows.length === 0) {
    throw Object.assign(new Error('Ese envío ya no está.'), { status: 404 });
  }

  const datos = rows[0].datos ?? {};
  const jugadores = Array.isArray(datos.jugadores) ? datos.jugadores : [];

  const copiados = [];
  for (const jugador of jugadores) {
    const copia = jugador?.foto ? await copiarFoto(jugador.foto, usuarioId) : null;
    copiados.push(copia ? { ...jugador, foto: copia } : jugador);
  }

  // El que lo mandó se entera de que le dijeron que sí, que es la mitad que
  // faltaba: antes mandabas un plantel y no sabías nunca si había llegado.
  await avisar(rows[0].de, {
    titulo: 'Aceptaron tu plantel',
    cuerpo: `@${await usuarioDe(usuarioId)} se quedó con ${rows[0].nombre}.`,
    datos: { tipo: 'respuesta', de: await usuarioDe(usuarioId) },
  });

  return { nombre: rows[0].nombre, datos: { ...datos, jugadores: copiados } };
}

/**
 * Cancela lo que se mandó de un plantel y todavía nadie acepto.
 *
 * Corre al borrar el plantel. Lo que se compartió y no se acepto todavía deja
 * de tener sentido: el plantel que iba a recibir ya no existe. Lo ya aceptado
 * no se toca — eso ya es de la otra persona.
 */
export async function cancelarEnviosDe(usuarioId, plantelId) {
  const { rows } = await consultar(
    `update envios set estado = 'cancelado', resuelto = now()
      where de = $1 and plantel_id = $2 and estado = 'pendiente'
      returning para, nombre`,
    [usuarioId, plantelId]
  );

  const quien = await usuarioDe(usuarioId);
  for (const fila of rows) {
    await avisar(fila.para, {
      titulo: 'Se canceló un plantel',
      cuerpo: `@${quien} borró ${fila.nombre} antes de que lo aceptaras.`,
      datos: { tipo: 'respuesta', de: quien },
    });
  }
  return rows.length;
}

export async function rechazar(usuarioId, envioId) {
  const { rows } = await consultar(
    `update envios set estado = 'rechazado', resuelto = now()
      where id = $1 and para = $2 and estado = 'pendiente'
      returning de, nombre`,
    [envioId, usuarioId]
  );
  if (rows.length === 0) {
    throw Object.assign(new Error('Ese envío ya no está.'), { status: 404 });
  }

  await avisar(rows[0].de, {
    titulo: 'Rechazaron tu plantel',
    cuerpo: `@${await usuarioDe(usuarioId)} no se quedó con ${rows[0].nombre}.`,
    datos: { tipo: 'respuesta', de: await usuarioDe(usuarioId) },
  });
}
