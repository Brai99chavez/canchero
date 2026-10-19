import { Linking, Share } from 'react-native';

/** Por dónde se manda: directo a WhatsApp, o el menú de compartir del teléfono. */
export type Via = 'whatsapp' | 'otra';

/**
 * Manda un texto al grupo.
 *
 * Directo a WhatsApp si se eligió eso: es donde están los grupos de fútbol, y
 * el menú de compartir del teléfono son veinte íconos para encontrar uno. Si
 * WhatsApp no está instalado, cae al menú de compartir, que tiene todas las
 * apps. Nunca tira error: cerrar el menú sin elegir no es un problema.
 */
export async function mandarAlGrupo(texto: string, via: Via = 'whatsapp'): Promise<void> {
  if (via === 'whatsapp') {
    try {
      await Linking.openURL(`whatsapp://send?text=${encodeURIComponent(texto)}`);
      return;
    } catch {
      // Sin WhatsApp: el menú de compartir.
    }
  }
  try {
    await Share.share({ message: texto });
  } catch {
    // Cerró el menú sin elegir: no pasa nada.
  }
}
