import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

const FOTOS = 'fotos';

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
  return persist(playerId, resultado.assets[0].uri);
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
