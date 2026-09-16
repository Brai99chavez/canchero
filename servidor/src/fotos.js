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
 * Dónde puede escribir una cuenta. Es una lista cerrada y no lo que mande la
 * app: con una carpeta libre se podría escribir en `publico/`, que es de donde
 * salen las imágenes de los mails.
 *
 * `jugadores` lo barre la limpieza de huérfanas; `perfil` no, porque ahí hay
 * una sola foto y la reemplaza el propio perfil al cambiarla.
 */
const CARPETAS = new Set(['jugadores', 'perfil']);

/**
 * Un permiso para subir una foto, que vale unos minutos.
 *
 * La key arranca con el id de la cuenta: así una cuenta no puede escribir
 * encima de la foto de otra, aunque se ponga a inventar nombres. El resto es
 * al azar, para que cambiar la foto de un jugador no reemplace la anterior y
 * la app no tenga que pelear con la caché.
 */
export async function permisoDeSubida(usuarioId, tipo, carpeta = 'jugadores') {
  const extension = TIPOS[tipo];
  if (!extension) {
    throw Object.assign(new Error('Formato no soportado. Usá JPG, PNG o WebP.'), {
      status: 400,
    });
  }
  if (!CARPETAS.has(carpeta)) {
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
export async function copiarFoto(url, paraUsuarioId) {
  if (!hayFotos || !esNuestra(url)) return null;

  const origen = url.slice(publica.length + 1);
  const extension = origen.split('.').pop();
  if (!Object.values(TIPOS).includes(extension)) return null;

  const destino = `${paraUsuarioId}/jugadores/${randomBytes(16).toString('hex')}.${extension}`;
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
 * Saca del bucket las fotos de esta cuenta que ya no referencia ningún
 * plantel.
 *
 * Corre al final del backup, contra lo que quedó guardado: recién ahí se sabe
 * qué sigue en uso. Hacerlo antes, o desde el teléfono al borrar un jugador,
 * podía llevarse la foto que la copia de la nube todavía estaba mostrando.
 *
 * `usadas` son las URLs públicas que aparecen en los planteles vivos.
 */
const MINUTOS_DE_GRACIA = 15;

export async function limpiarHuerfanas(usuarioId, usadas, gracia = MINUTOS_DE_GRACIA) {
  if (!hayFotos) return 0;

  const prefijo = `${usuarioId}/jugadores/`;
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

    const sobran = (pagina.Contents ?? [])
      .filter(
        (o) =>
          !enUso.has(o.Key) &&
          (!o.LastModified || o.LastModified.getTime() < limite)
      )
      .map((o) => ({ Key: o.Key }));

    if (sobran.length > 0) {
      await getCliente().send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: sobran, Quiet: true },
        })
      );
      borradas += sobran.length;
    }

    continuacion = pagina.IsTruncated ? pagina.NextContinuationToken : undefined;
  } while (continuacion);

  return borradas;
}
