import { consultar } from './db.js';

/**
 * Los avisos que le llegan al teléfono.
 *
 * Son lo que reemplaza al refresco periódico. Sin esto, cada app tendría que
 * preguntar cada tantos segundos si pasó algo; como casi nunca pasa nada, eso
 * es despertar la base de Neon todo el día para que conteste "no". Con esto la
 * base se toca sólo cuando alguien hace algo, y el que tiene que enterarse se
 * entera en el momento.
 *
 * Los manda Expo, que es gratis y no necesita clave: se le pasa el token del
 * teléfono y él se arregla con Google y con Apple.
 */
const EXPO = 'https://exp.host/--/api/v2/push/send';

/** Un token de Expo, que es lo único que se acepta guardar. */
const FORMATO = /^Expo(nent)?PushToken\[[^\]]+\]$/;

export async function guardarDispositivo(usuarioId, token) {
  if (typeof token !== 'string' || !FORMATO.test(token)) {
    throw Object.assign(new Error('Token no válido.'), { status: 400 });
  }
  /*
   * La clave es el token y no la cuenta: si en el mismo teléfono entra otra
   * persona, la fila se muda en vez de duplicarse. Sin eso, el aviso de la
   * cuenta vieja seguiría llegando a un teléfono donde ya entró otro.
   */
  await consultar(
    `insert into dispositivos (token, usuario_id) values ($1, $2)
     on conflict (token) do update
       set usuario_id = excluded.usuario_id, actualizado = now()`,
    [token, usuarioId]
  );
}

export async function olvidarDispositivo(token) {
  await consultar(`delete from dispositivos where token = $1`, [token]);
}

/**
 * Le avisa a alguien. No falla nunca hacia afuera: que un aviso no salga no
 * puede hacer que el mensaje no se mande.
 *
 * `datos` viaja con el aviso y es lo que la app usa para saber qué recargar,
 * sin tener que preguntar nada más.
 */
export async function avisar(usuarioId, { titulo, cuerpo, datos }) {
  try {
    const { rows } = await consultar(
      `select token from dispositivos where usuario_id = $1`,
      [usuarioId]
    );
    if (rows.length === 0) return;

    const mensajes = rows.map((f) => ({
      to: f.token,
      title: titulo,
      body: cuerpo,
      data: datos ?? {},
      sound: 'default',
      // Android los agrupa por canal; sin esto van al canal por defecto.
      channelId: 'default',
    }));

    const respuesta = await fetch(EXPO, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(mensajes),
    });
    if (!respuesta.ok) return;

    /*
     * Expo contesta un resultado por mensaje. `DeviceNotRegistered` es la app
     * desinstalada o los permisos sacados: ese token no sirve más y se borra,
     * si no la tabla se llena de teléfonos que ya no existen y cada aviso se
     * manda a todos ellos.
     */
    const salida = await respuesta.json().catch(() => null);
    const tickets = Array.isArray(salida?.data) ? salida.data : [];
    for (let i = 0; i < tickets.length; i++) {
      if (tickets[i]?.details?.error === 'DeviceNotRegistered') {
        await olvidarDispositivo(mensajes[i].to).catch(() => {});
      }
    }
  } catch {
    // Sin red, o Expo caído: el aviso se pierde y la app se entera la próxima
    // vez que abra la pantalla. No es motivo para romper lo que se estaba
    // haciendo.
  }
}
