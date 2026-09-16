import { consultar } from './db.js';
import { borrarFoto, esNuestra, publicaDe } from './fotos.js';

/**
 * El perfil de la cuenta: el nombre con el que te encuentran y tu foto.
 *
 * El nombre de usuario existe para que un amigo pueda mandarte un plantel sin
 * que le pases tu mail. Por eso es público y el mail no: se lo vas a decir en
 * voz alta o por WhatsApp, y una dirección de correo dicha en voz alta es un
 * correo que después recibe spam.
 */

/**
 * Qué se acepta como nombre.
 *
 * Entre 3 y 20, en minúscula, con puntos, guiones y guiones bajos en el medio
 * pero nunca en las puntas. Un nombre que arranca o termina en punto se lee
 * mal en cualquier lado y se copia peor.
 */
const FORMATO = /^[a-z0-9][a-z0-9._-]{1,18}[a-z0-9]$/;

/**
 * Nombres que no puede tomar nadie. No es paranoia: si alguien se llama
 * `canchero` o `soporte`, cualquier mensaje suyo parece venir de la app.
 */
const RESERVADOS = new Set([
  'admin',
  'administrador',
  'canchero',
  'soporte',
  'ayuda',
  'sistema',
  'root',
  'api',
  'oficial',
  'null',
  'undefined',
]);

/** Deja el nombre como se guarda: sin espacios alrededor y en minúscula. */
export function normalizar(nombre) {
  return String(nombre ?? '').trim().toLowerCase();
}

/**
 * Qué tiene de malo un nombre, o null si está bien.
 *
 * Devuelve el motivo y no un booleano porque el motivo es lo que se le
 * muestra a la persona: "no es válido" la deja probando a ciegas.
 */
export function problemaDelUsuario(nombre) {
  const limpio = normalizar(nombre);
  if (limpio.length < 3) return 'Tiene que tener al menos 3 letras.';
  if (limpio.length > 20) return 'No puede pasar de 20 letras.';
  if (!FORMATO.test(limpio)) {
    return 'Sólo letras, números, punto, guión y guión bajo. No puede empezar ni terminar con un símbolo.';
  }
  if (RESERVADOS.has(limpio)) return 'Ese nombre está reservado. Elegí otro.';
  return null;
}

function comoSaleAfuera(fila) {
  return {
    plan: fila?.plan === 'pro' ? 'pro' : 'gratis',
    usuario: fila?.usuario ?? null,
    foto: fila?.foto ?? null,
  };
}

/**
 * El perfil, creando la fila si es la primera vez que entra esta cuenta.
 *
 * El `do update` que no cambia nada es para que el `returning` traiga la fila
 * tanto cuando se insertó como cuando ya estaba: con `do nothing` no devuelve
 * nada en el segundo caso y habría que consultar de nuevo.
 */
export async function leerPerfil(usuarioId) {
  const { rows } = await consultar(
    `insert into perfiles (usuario_id) values ($1)
     on conflict (usuario_id) do update set usuario_id = excluded.usuario_id
     returning plan, usuario, foto`,
    [usuarioId]
  );
  return comoSaleAfuera(rows[0]);
}

/**
 * Cambia el nombre y la foto. Sólo toca lo que viene en `cambios`: mandar
 * únicamente la foto no borra el nombre.
 *
 * La foto anterior se borra del bucket. Las del perfil viven fuera del alcance
 * del barrido de huérfanas —que sólo mira las de los jugadores— así que si no
 * se borraran acá, cada cambio de foto dejaría un archivo para siempre.
 */
export async function guardarPerfil(usuarioId, cambios) {
  const anterior = await leerPerfil(usuarioId);

  const partes = [];
  const valores = [usuarioId];

  if ('usuario' in cambios) {
    const limpio = normalizar(cambios.usuario);
    if (limpio === '') {
      partes.push(`usuario = null`);
    } else {
      const problema = problemaDelUsuario(limpio);
      if (problema) throw Object.assign(new Error(problema), { status: 400 });
      valores.push(limpio);
      partes.push(`usuario = $${valores.length}`);
    }
  }

  if ('foto' in cambios) {
    const foto = cambios.foto;
    if (foto === null || foto === '') {
      partes.push(`foto = null`);
    } else {
      /*
       * La foto tiene que ser una que esta misma cuenta haya subido. Sin este
       * chequeo se podría poner de perfil la URL de la foto de otro, y peor,
       * al cambiarla después el borrado se llevaría un archivo ajeno.
       */
      if (!esNuestra(foto) || !foto.startsWith(`${publicaDe()}/${usuarioId}/`)) {
        throw Object.assign(new Error('Esa foto no es de esta cuenta.'), {
          status: 400,
        });
      }
      valores.push(foto);
      partes.push(`foto = $${valores.length}`);
    }
  }

  if (partes.length === 0) return anterior;

  let filas;
  try {
    ({ rows: filas } = await consultar(
      `update perfiles set ${partes.join(', ')}, actualizado = now()
       where usuario_id = $1
       returning plan, usuario, foto`,
      valores
    ));
  } catch (error) {
    // 23505 es el índice único: el nombre ya lo tiene otra cuenta.
    if (error.code === '23505') {
      throw Object.assign(new Error('Ese nombre ya está tomado. Probá otro.'), {
        status: 409,
      });
    }
    throw error;
  }

  const ahora = comoSaleAfuera(filas[0]);

  if (anterior.foto && anterior.foto !== ahora.foto) {
    // Si el borrado falla, el perfil ya quedó guardado igual: queda un archivo
    // de más, que es mucho menos grave que perder el cambio.
    await borrarFoto(usuarioId, anterior.foto).catch(() => {});
  }

  return ahora;
}
