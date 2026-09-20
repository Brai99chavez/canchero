import { randomBytes } from 'node:crypto';
import {
  CopyObjectCommand,
  DeleteObjectsCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectCommand } from '@aws-sdk/client-s3';

/**
 * Las fotos, en Cloudflare R2: las de los jugadores y la del perfil.
 *
 * El servidor no toca los bytes: firma un permiso de subida y la app manda el
 * archivo derecho a R2. Si pasaran por acá, cada foto ocuparía el contenedor
 * —512 MB en el plan gratis de Render, y que además se duerme— para mover algo
 * que no necesita pasar por el medio.
 *
 * Sin las variables configuradas queda apagado y la app sigue andando con las
 * fotos guardadas sólo en el teléfono.
 */
const cuenta = process.env.R2_ACCOUNT_ID;
const clave = process.env.R2_ACCESS_KEY_ID;
const secreto = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET;
const publica = (process.env.R2_PUBLIC_URL ?? '').replace(/\/+$/, '');

export const hayFotos = Boolean(cuenta && clave && secreto && bucket && publica);

/** Sólo lo que se puede mostrar en una carta, y nada de SVG, que ejecuta. */
const TIPOS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

let cliente;
function getCliente() {
  if (!cliente) {
    cliente = new S3Client({
      region: 'auto',
      endpoint: `https://${cuenta}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: clave, secretAccessKey: secreto },
    });
  }
  return cliente;
}

/** La raíz pública del bucket, para verificar que una URL sea nuestra. */
export function publicaDe() {
  return publica;
}

/**
 * Cómo se acomodan las fotos adentro del bucket:
 *
 *     {cuenta}/perfil/{azar}.jpg      la foto de perfil
 *     {cuenta}/{plantel}/{azar}.jpg   las fotos de los jugadores de un plantel
 *     publico/…                       el logo de los mails, de nadie
 *
 * La idea es que cada nivel de borrado sea un prefijo: se va un plantel, se
 * borra su carpeta; se va una cuenta, se borra la suya. Sin eso hay que listar
 * todo y comparar contra qué URLs siguen nombradas en la base, que es lento y
 * fácil de equivocar.
 *
 * Antes era `{cuenta}/jugadores/` para todos los planteles juntos, y borrar
 * uno significaba justamente esa comparación.
 *
 * El nombre del archivo es al azar y no el del jugador, para que cambiar una
 * foto no reemplace la anterior y la app no tenga que pelear con la caché.
 */
const CARPETA_DE_PERFIL = 'perfil';

/**
 * Qué puede ser un destino: `perfil`, o el id de un plantel.
 *
 * Los ids los inventa el teléfono, así que se validan acá. Sin esto, una app
 * modificada podría mandar `perfil` como id de plantel —o algo con barras— y
 * escribir donde no va. El daño quedaría adentro de su propia cuenta, porque
 * la key igual arranca con su id, pero no hay razón para permitirlo.
 */
const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;

/** Si sirve como nombre de carpeta de plantel. `perfil` no: ya está ocupado. */
export function esIdDePlantel(id) {
  return typeof id === 'string' && id !== CARPETA_DE_PERFIL && ID_VALIDO.test(id);
}

function carpetaDe(destino) {
  if (destino === CARPETA_DE_PERFIL) return CARPETA_DE_PERFIL;
  return esIdDePlantel(destino) ? destino : null;
}

/**
 * Un permiso para subir una foto, que vale unos minutos.
 *
 * La key arranca con el id de la cuenta: así una cuenta no puede escribir
 * encima de la foto de otra, aunque se ponga a inventar nombres.
 */
export async function permisoDeSubida(usuarioId, tipo, destino) {
  const extension = TIPOS[tipo];
  if (!extension) {
    throw Object.assign(new Error('Formato no soportado. Usá JPG, PNG o WebP.'), {
      status: 400,
    });
  }
  const carpeta = carpetaDe(destino);
  if (!carpeta) {
    throw Object.assign(new Error('Destino no válido.'), { status: 400 });
  }

  const key = `${usuarioId}/${carpeta}/${randomBytes(16).toString('hex')}.${extension}`;
  const url = await getSignedUrl(
    getCliente(),
    new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: tipo }),
    { expiresIn: 300 }
  );

  return { url, key, publica: `${publica}/${key}` };
}

/**
 * Copia una foto a la carpeta de otra cuenta y devuelve la URL nueva.
 *
 * Se usa cuando alguien acepta un plantel que le mandaron. Sin copiarla, las
 * cartas del que recibe apuntarían a los archivos del que mandó, y el día que
 * ese otro borre el plantel la limpieza de huérfanas se las llevaría: cada
 * cuenta barre lo suyo, y esos archivos serían suyos.
 *
 * Si algo falla devuelve null y el que llama se queda con la URL original: una
 * foto que puede romperse más adelante es mejor que no aceptar el plantel.
 */
export async function copiarFoto(url, paraUsuarioId, plantelId) {
  if (!hayFotos || !esNuestra(url)) return null;

  const carpeta = carpetaDe(plantelId);
  if (!carpeta || carpeta === CARPETA_DE_PERFIL) return null;

  const origen = url.slice(publica.length + 1);
  const extension = origen.split('.').pop();
  if (!Object.values(TIPOS).includes(extension)) return null;

  const destino = `${paraUsuarioId}/${carpeta}/${randomBytes(16).toString('hex')}.${extension}`;
  try {
    await getCliente().send(
      new CopyObjectCommand({
        Bucket: bucket,
        // El origen va con el bucket adelante, que es como lo pide S3.
        CopySource: `${bucket}/${origen}`,
        Key: destino,
      })
    );
  } catch {
    return null;
  }
  return `${publica}/${destino}`;
}

/** Si una URL es de nuestro bucket. Lo demás no se borra ni se toca. */
export function esNuestra(url) {
  return typeof url === 'string' && url.startsWith(`${publica}/`);
}

export async function borrarFoto(usuarioId, url) {
  if (!esNuestra(url)) return;
  const key = url.slice(publica.length + 1);
  // El prefijo se vuelve a chequear acá: sin esto, mandando una URL armada a
  // mano se podrían borrar las fotos de otra cuenta.
  if (!key.startsWith(`${usuarioId}/`)) return;

  await getCliente().send(
    new DeleteObjectCommand({ Bucket: bucket, Key: key })
  );
}

/**
 * Recorre un prefijo del bucket y borra lo que `sobra` diga que sobra.
 *
 * El listado viene paginado y el borrado va de a mil, que son los topes de la
 * API. Las tres limpiezas —huérfanas, un plantel, una cuenta entera— son el
 * mismo recorrido con distinto criterio, así que está una sola vez.
 */
async function barrer(prefijo, sobra) {
  if (!hayFotos) return 0;

  let continuacion;
  let borradas = 0;
  do {
    const pagina = await getCliente().send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefijo,
        ContinuationToken: continuacion,
      })
    );

    const aSacar = (pagina.Contents ?? [])
      .filter(sobra)
      .map((o) => ({ Key: o.Key }));

    for (let i = 0; i < aSacar.length; i += 1000) {
      await getCliente().send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: aSacar.slice(i, i + 1000), Quiet: true },
        })
      );
    }
    borradas += aSacar.length;

    continuacion = pagina.IsTruncated ? pagina.NextContinuationToken : undefined;
  } while (continuacion);

  return borradas;
}

/**
 * Saca del bucket las fotos de esta cuenta que ya no referencia ningún
 * plantel.
 *
 * Con una carpeta por plantel esto ya no es la vía principal para borrar
 * —cuando se va un plantel entero se va su carpeta, de una—, pero sigue
 * haciendo falta para lo que pasa adentro de un plantel vivo: el jugador que
 * se borró, o el que cambió de foto y dejó la anterior colgada.
 *
 * Corre al final del backup, contra lo que quedó guardado: recién ahí se sabe
 * qué sigue en uso. Hacerlo antes, o desde el teléfono al borrar un jugador,
 * podía llevarse la foto que la copia de la nube todavía estaba mostrando.
 *
 * `usadas` son las URLs públicas que aparecen en los planteles vivos, y ahí
 * entran también los de la papelera: mientras se puedan recuperar, sus fotos
 * tienen que seguir estando.
 *
 * El perfil queda afuera a propósito: esa foto no aparece en ningún plantel,
 * así que acá adentro se borraría sola todas las veces.
 */
const MINUTOS_DE_GRACIA = 15;

export async function limpiarHuerfanas(usuarioId, usadas, gracia = MINUTOS_DE_GRACIA) {
  const perfil = `${usuarioId}/${CARPETA_DE_PERFIL}/`;
  const enUso = new Set();
  for (const url of usadas) {
    if (esNuestra(url)) enUso.add(url.slice(publica.length + 1));
  }

  /*
   * Un margen antes de tocar nada: una foto recién subida puede estar
   * esperando el plantel que la va a nombrar, y borrarla ahí la perdería.
   *
   * Se compara contra el reloj de esta máquina y la fecha la pone R2, que
   * puede ir unos segundos corrido. Con 15 minutos de margen eso no importa;
   * con un margen de cero sí, y por eso las pruebas usan uno negativo en vez
   * de cero cuando quieren que barra todo.
   */
  const limite = Date.now() - gracia * 60 * 1000;

  return barrer(
    `${usuarioId}/`,
    (o) =>
      !o.Key.startsWith(perfil) &&
      !enUso.has(o.Key) &&
      (!o.LastModified || o.LastModified.getTime() < limite)
  );
}

/**
 * Borra la carpeta entera de un plantel.
 *
 * Es lo que se lleva las fotos cuando el plantel se va de verdad: el borrado
 * definitivo, lo que venció en la papelera y lo que la papelera desplazó por
 * llena.
 *
 * Va por prefijo y no por la lista de URLs que tenía guardadas, que es lo
 * importante de esta forma de acomodar el bucket: si una foto llegó a subirse
 * pero el plantel que la iba a nombrar nunca terminó de guardarse, esa foto no
 * figura en ningún lado y por lista quedaría para siempre. Por prefijo se va
 * igual, porque está adentro de la carpeta.
 */
export async function borrarLasFotosDelPlantel(usuarioId, plantelId) {
  const carpeta = carpetaDe(plantelId);
  if (!carpeta || carpeta === CARPETA_DE_PERFIL) return 0;
  return barrer(`${usuarioId}/${carpeta}/`, () => true);
}

/**
 * Borra TODAS las fotos de una cuenta: las de todos sus planteles y la del
 * perfil.
 *
 * Es para cuando alguien se da de baja. A diferencia de la limpieza de
 * huérfanas, acá no hay margen de gracia ni nada que conservar: la cuenta se
 * va entera y sus archivos con ella.
 *
 * El prefijo es la cuenta y nada más, así que barre todas sus carpetas de una.
 * Y no puede tocar lo de otro: todas las claves arrancan con el id del dueño.
 */
export async function borrarLasFotosDe(usuarioId) {
  return barrer(`${usuarioId}/`, () => true);
}
