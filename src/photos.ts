import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

const FOTOS = 'fotos';

/**
 * Lo más ancho que se guarda una foto.
 *
 * En la carta se ve a unos 300 píxeles; 640 alcanza para cualquier pantalla y
 * deja margen si algún día se muestra más grande. Una foto de celular son 3 o
 * 4 MB y así queda en unos 50 KB: ochenta veces menos para subir, para bajar y
 * para ocupar en el teléfono.
 */
const ANCHO_MAXIMO = 640;
const CALIDAD = 0.72;

/** Carpeta propia de la app, a salvo de que el sistema la limpie. */
function fotosDir(): Directory {
  const dir = new Directory(Paths.document, FOTOS);
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  return dir;
}

function filesOf(playerId: string): File[] {
  return fotosDir()
    .list()
    .filter(
      (entry): entry is File =>
        entry instanceof File && entry.name.startsWith(playerId + '-')
    );
}

/**
 * Achica y comprime antes de guardar. Se hace acá, en el teléfono, y no en el
 * servidor: es gratis, no manda megas por la red del usuario, y el servidor no
 * necesita procesar imágenes.
 */
async function achicar(uri: string): Promise<string> {
  const imagen = await ImageManipulator.manipulate(uri)
    .resize({ width: ANCHO_MAXIMO })
    .renderAsync();
  const guardada = await imagen.saveAsync({
    compress: CALIDAD,
    format: SaveFormat.JPEG,
  });
  return guardada.uri;
}

/**
 * Guarda una copia propia de la foto elegida. El nombre lleva un timestamp
 * para que al cambiar la foto la nueva no quede tapada por la cacheada.
 */
function persist(playerId: string, uri: string): string {
  const destino = new File(fotosDir(), `${playerId}-${Date.now()}.jpg`);
  new File(uri).copy(destino);
  return destino.uri;
}

/**
 * Abre la galería, deja recortar en cuadrado y devuelve la ruta de la copia.
 * Devuelve null si el usuario cancela.
 */
export async function pickPhoto(playerId: string): Promise<string | null> {
  const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permiso.granted) return null;

  const resultado = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  });

  if (resultado.canceled || resultado.assets.length === 0) return null;
  return persist(playerId, await achicar(resultado.assets[0].uri));
}

/** Borra las fotos del jugador menos la que quedó guardada. */
export function cleanupPhotos(playerId: string, keep?: string): void {
  for (const archivo of filesOf(playerId)) {
    if (archivo.uri !== keep) archivo.delete();
  }
}

/** Borra la carpeta entera de fotos. Va con el reinicio de la app. */
export function borrarTodasLasFotos(): void {
  const dir = new Directory(Paths.document, FOTOS);
  if (dir.exists) dir.delete();
}

/** Borra una foto suelta: la que quedó colgada al cancelar una edición. */
export function discardPhoto(uri?: string): void {
  if (!uri || !uri.includes(`/${FOTOS}/`)) return;
  const archivo = new File(uri);
  if (archivo.exists) archivo.delete();
}

/** Si la foto todavía vive sólo en este teléfono y falta subirla. */
export function esLocal(uri?: string): boolean {
  return typeof uri === 'string' && uri.startsWith('file:');
}
