import { randomBytes } from 'node:crypto';
import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectCommand } from '@aws-sdk/client-s3';

/**
 * Las fotos de los jugadores, en Cloudflare R2.
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

/**
 * Un permiso para subir una foto, que vale unos minutos.
 *
 * La key arranca con el id de la cuenta: así una cuenta no puede escribir
 * encima de la foto de otra, aunque se ponga a inventar nombres. El resto es
 * al azar, para que cambiar la foto de un jugador no reemplace la anterior y
 * la app no tenga que pelear con la caché.
 */
export async function permisoDeSubida(usuarioId, tipo) {
  const extension = TIPOS[tipo];
  if (!extension) {
    throw Object.assign(new Error('Formato no soportado. Usá JPG, PNG o WebP.'), {
      status: 400,
    });
  }

  const key = `${usuarioId}/jugadores/${randomBytes(16).toString('hex')}.${extension}`;
  const url = await getSignedUrl(
    getCliente(),
    new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: tipo }),
    { expiresIn: 300 }
  );

  return { url, key, publica: `${publica}/${key}` };
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
