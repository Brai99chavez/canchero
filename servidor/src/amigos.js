import { randomBytes } from 'node:crypto';
import { consultar } from './db.js';
import { normalizar } from './perfil.js';

/**
 * Amigos y la conversación con cada uno.
 *
 * Un par de personas es siempre la misma fila, con los dos ids ordenados. Sin
 * esa regla, si los dos se mandan solicitud al mismo tiempo quedan dos
 * amistades pendientes entre las mismas dos personas y ninguna se puede
 * aceptar del todo; con ella, la clave primaria lo impide sola.
 */
const par = (a, b) => (a < b ? [a, b] : [b, a]);

const nuevoId = () => randomBytes(12).toString('hex');

const TOPE_TEXTO = 1000;

/** El id de quien tiene ese nombre de usuario, o null. */
export async function idDe(nombreDeUsuario) {
  const limpio = normalizar(nombreDeUsuario);
  if (!limpio) return null;
  const { rows } = await consultar(
    `select usuario_id from perfiles where lower(usuario) = $1`,
    [limpio]
  );
  return rows[0]?.usuario_id ?? null;
}

/** Mi nombre de usuario, o null si todavía no eligió uno. */
export async function usuarioDe(usuarioId) {
  const { rows } = await consultar(
    `select usuario from perfiles where usuario_id = $1`,
    [usuarioId]
  );
  return rows[0]?.usuario ?? null;
}

/** Si esos dos son amigos aceptados. Es lo que habilita todo lo demás. */
export async function sonAmigos(a, b) {
  const [uno, otro] = par(a, b);
  const { rows } = await consultar(
    `select 1 from amistades where uno = $1 and otro = $2 and estado = 'aceptada'`,
    [uno, otro]
  );
  return rows.length > 0;
}

/**
 * Manda una solicitud. Si la otra persona ya te había mandado una, esto la
 * acepta: es lo que uno espera cuando los dos se agregan a la vez, en vez de
 * quedar los dos esperando al otro.
 */
export async function pedirAmistad(yo, aQuien) {
  const miUsuario = await usuarioDe(yo);
  if (!miUsuario) {
    throw Object.assign(
      new Error('Elegí tu nombre de usuario antes de agregar a alguien.'),
      { status: 409 }
    );
  }

  const destino = normalizar(aQuien);
  const suId = await idDe(destino);
  if (!suId) {
    throw Object.assign(new Error(`No hay nadie que se llame @${destino}.`), {
      status: 404,
    });
  }
  if (suId === yo) {
    throw Object.assign(new Error('Ese sos vos.'), { status: 400 });
  }

  const [uno, otro] = par(yo, suId);
  const { rows } = await consultar(
    `select pidio, estado from amistades where uno = $1 and otro = $2`,
    [uno, otro]
  );
  const existente = rows[0];

  if (existente?.estado === 'aceptada') {
    return { estado: 'aceptada', usuario: destino };
  }

  // La otra persona ya había pedido: esto es aceptarla.
  if (existente?.estado === 'pendiente' && existente.pidio !== yo) {
    await consultar(
      `update amistades set estado = 'aceptada', resuelto = now()
        where uno = $1 and otro = $2`,
      [uno, otro]
    );
    return { estado: 'aceptada', usuario: destino };
  }

  await consultar(
    `insert into amistades (uno, otro, pidio, estado, pedido, resuelto)
     values ($1, $2, $3, 'pendiente', now(), null)
     on conflict (uno, otro) do update
       set pidio = excluded.pidio, estado = 'pendiente',
           pedido = now(), resuelto = null`,
    [uno, otro, yo]
  );
  return { estado: 'pendiente', usuario: destino };
}

export async function responderAmistad(yo, deQuien, acepta) {
  const suId = await idDe(deQuien);
  if (!suId) {
    throw Object.assign(new Error('Esa persona ya no está.'), { status: 404 });
  }
  const [uno, otro] = par(yo, suId);

  // `pidio <> yo`: no se puede aceptar la solicitud que mandó uno mismo.
  const { rowCount } = await consultar(
    `update amistades set estado = $3, resuelto = now()
      where uno = $1 and otro = $2 and estado = 'pendiente' and pidio <> $4`,
    [uno, otro, acepta ? 'aceptada' : 'rechazada', yo]
  );
  if (rowCount === 0) {
    throw Object.assign(new Error('Esa solicitud ya no está.'), { status: 404 });
  }
}

/** Deja de ser amigo. La conversación queda, por si se vuelven a agregar. */
export async function sacarAmigo(yo, aQuien) {
  const suId = await idDe(aQuien);
  if (!suId) return;
  const [uno, otro] = par(yo, suId);
  await consultar(`delete from amistades where uno = $1 and otro = $2`, [
    uno,
    otro,
  ]);
}

/**
 * Los amigos y las solicitudes, todo junto.
 *
 * Viene con lo último que se dijeron y cuántos mensajes hay sin leer, porque
 * es lo que se muestra en la lista y pedirlo aparte por cada amigo serían
 * tantas consultas como amigos.
 */
export async function amigosDe(usuarioId) {
  const { rows } = await consultar(
    `with mios as (
       select a.*,
              case when a.uno = $1 then a.otro else a.uno end as suyo
         from amistades a
        where (a.uno = $1 or a.otro = $1) and a.estado <> 'rechazada'
     )
     select m.suyo               as id,
            p.usuario,
            p.foto,
            m.estado,
            m.pidio = $1         as lo_pedi_yo,
            m.pedido,
            (select x.texto from mensajes x
              where x.uno = least(m.suyo, $1) and x.otro = greatest(m.suyo, $1)
              order by x.creado desc limit 1)  as ultimo_texto,
            (select x.tipo from mensajes x
              where x.uno = least(m.suyo, $1) and x.otro = greatest(m.suyo, $1)
              order by x.creado desc limit 1)  as ultimo_tipo,
            (select x.creado from mensajes x
              where x.uno = least(m.suyo, $1) and x.otro = greatest(m.suyo, $1)
              order by x.creado desc limit 1)  as ultimo_cuando,
            (select count(*) from mensajes x
              where x.uno = least(m.suyo, $1) and x.otro = greatest(m.suyo, $1)
                and x.autor <> $1
                and x.creado > coalesce(
                      (select l.hasta from lecturas l
                        where l.usuario_id = $1 and l.con = m.suyo),
                      'epoch'::timestamptz))   as sin_leer
       from mios m
       join perfiles p on p.usuario_id = m.suyo
      order by m.estado, coalesce((select x.creado from mensajes x
              where x.uno = least(m.suyo, $1) and x.otro = greatest(m.suyo, $1)
              order by x.creado desc limit 1), m.pedido) desc`,
    [usuarioId]
  );

  return rows.map((f) => ({
    usuario: f.usuario,
    foto: f.foto ?? null,
    estado: f.estado,
    /** Si la solicitud pendiente la mandé yo, la tiene que responder el otro. */
    loPediYo: f.lo_pedi_yo,
    pedido: f.pedido,
    ultimo:
      f.ultimo_tipo === null
        ? null
        : {
            tipo: f.ultimo_tipo,
            texto: f.ultimo_tipo === 'texto' ? f.ultimo_texto : null,
            cuando: f.ultimo_cuando,
          },
    sinLeer: Number(f.sin_leer ?? 0),
  }));
}

/** Anota un mensaje en la conversación. Lo usan el texto y el envío. */
export async function anotarMensaje(autor, conQuien, { tipo, texto, envio }) {
  const [uno, otro] = par(autor, conQuien);
  const id = nuevoId();
  await consultar(
    `insert into mensajes (id, uno, otro, autor, tipo, texto, envio)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [id, uno, otro, autor, tipo, texto ?? null, envio ?? null]
  );
  return id;
}

export async function mandarTexto(yo, aQuien, texto) {
  const suId = await idDe(aQuien);
  if (!suId) {
    throw Object.assign(new Error('Esa persona ya no está.'), { status: 404 });
  }
  if (!(await sonAmigos(yo, suId))) {
    throw Object.assign(new Error('Todavía no son amigos.'), { status: 403 });
  }

  const limpio = String(texto ?? '').trim();
  if (!limpio) {
    throw Object.assign(new Error('El mensaje está vacío.'), { status: 400 });
  }
  if (limpio.length > TOPE_TEXTO) {
    throw Object.assign(new Error('El mensaje es demasiado largo.'), {
      status: 400,
    });
  }

  return anotarMensaje(yo, suId, { tipo: 'texto', texto: limpio });
}

/**
 * La conversación con alguien.
 *
 * El estado del plantel sale de la tabla de envíos y no se copia acá: si se
 * guardara en el mensaje habría que actualizarlo al aceptar, y ese es
 * exactamente el momento en que las dos copias se separan.
 */
export async function conversacionCon(yo, conQuien, limite = 100) {
  const suId = await idDe(conQuien);
  if (!suId) {
    throw Object.assign(new Error('Esa persona ya no está.'), { status: 404 });
  }
  if (!(await sonAmigos(yo, suId))) {
    throw Object.assign(new Error('Todavía no son amigos.'), { status: 403 });
  }

  const [uno, otro] = par(yo, suId);
  const { rows } = await consultar(
    `select m.id, m.autor = $3 as mio, m.tipo, m.texto, m.creado,
            e.id as envio, e.nombre as plantel, e.estado as envio_estado,
            e.datos as datos
       from mensajes m
       left join envios e on e.id = m.envio
      where m.uno = $1 and m.otro = $2
      order by m.creado desc
      limit $4`,
    [uno, otro, yo, Math.min(Number(limite) || 100, 200)]
  );

  // Se leen del más nuevo al más viejo para que el límite corte los viejos, y
  // se devuelven al derecho, que es como se muestran.
  return rows.reverse().map((f) => ({
    id: f.id,
    mio: f.mio,
    tipo: f.tipo,
    texto: f.texto,
    cuando: f.creado,
    plantel:
      f.tipo === 'plantel'
        ? {
            envio: f.envio,
            nombre: f.plantel,
            estado: f.envio_estado,
            jugadores: Array.isArray(f.datos?.jugadores)
              ? f.datos.jugadores.length
              : 0,
            partidos: Array.isArray(f.datos?.partidos)
              ? f.datos.partidos.length
              : 0,
          }
        : null,
  }));
}

/** Marca como leído hasta ahora. */
export async function marcarLeido(yo, conQuien) {
  const suId = await idDe(conQuien);
  if (!suId) return;
  await consultar(
    `insert into lecturas (usuario_id, con, hasta) values ($1, $2, now())
     on conflict (usuario_id, con) do update set hasta = now()`,
    [yo, suId]
  );
}
