import { useCallback, useState } from 'react';
import { Share } from 'react-native';
import { aplicarRespuestas, fechaDelDia, textoDeInvitacion } from './asistencia';
import {
  abrirLink,
  cerrarLink,
  LinkDeAsistencia,
  linkAbierto,
} from './nube/convocatorias';
import { Squad } from './types';

/** Lo que la pantalla de convocatoria necesita del link de "¿quién viene?". */
export interface Asistencia {
  link: LinkDeAsistencia | null;
  /** Si se está hablando con el servidor. */
  ocupado: boolean;
  error: string | null;
  /** Lee las respuestas y marca a los que dijeron que van. */
  actualizar: () => void;
  /** Abre el link para ese día y lo manda. */
  preguntar: (dia: Date) => void;
  /** Lo vuelve a mandar, para el que no lo vio. */
  mandar: () => void;
  cerrar: () => void;
}

async function compartir(link: LinkDeAsistencia) {
  try {
    await Share.share({ message: textoDeInvitacion(link.fecha, link.url) });
  } catch {
    // Cerró el diálogo sin elegir a quién: el link igual quedó abierto.
  }
}

/**
 * El link de "¿quién viene?" del plantel abierto.
 *
 * Se guarda por plantel y no uno solo: si se cambia de plantel mientras llega
 * una respuesta, lo que llega tiene que ir al plantel que lo pidió y no al que
 * está en pantalla. Por lo mismo, marcar a los que van se hace por id.
 */
export function useAsistencia(
  plantelId: string | null,
  /** Aplica un cambio a un plantel por id. Devolver el mismo es no tocarlo. */
  alAplicar: (plantelId: string, cambio: (p: Squad) => Squad) => void
): Asistencia {
  const [links, setLinks] = useState<Record<string, LinkDeAsistencia | null>>({});
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const link = plantelId ? links[plantelId] ?? null : null;

  const recibir = useCallback(
    (id: string, nuevo: LinkDeAsistencia | null) => {
      setLinks((prev) => ({ ...prev, [id]: nuevo }));
      if (nuevo) {
        alAplicar(id, (p) => aplicarRespuestas(p, nuevo.codigo, nuevo.respuestas));
      }
    },
    [alAplicar]
  );

  /** Corre un pedido con el aviso de ocupado y el error a la vista. */
  const conServidor = useCallback(async (pedido: () => Promise<void>) => {
    setOcupado(true);
    setError(null);
    try {
      await pedido();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo hablar con el servidor.');
    } finally {
      setOcupado(false);
    }
  }, []);

  const actualizar = useCallback(() => {
    if (!plantelId) return;
    const id = plantelId;
    conServidor(async () => recibir(id, await linkAbierto(id)));
  }, [plantelId, conServidor, recibir]);

  const preguntar = useCallback(
    (dia: Date) => {
      if (!plantelId) return;
      const id = plantelId;
      conServidor(async () => {
        const nuevo = await abrirLink(id, fechaDelDia(dia));
        recibir(id, nuevo);
        await compartir(nuevo);
      });
    },
    [plantelId, conServidor, recibir]
  );

  const mandar = useCallback(() => {
    if (link) compartir(link);
  }, [link]);

  const cerrar = useCallback(() => {
    if (!plantelId || !link) return;
    const id = plantelId;
    const codigo = link.codigo;
    conServidor(async () => {
      await cerrarLink(codigo);
      setLinks((prev) => ({ ...prev, [id]: null }));
    });
  }, [plantelId, link, conServidor]);

  return { link, ocupado, error, actualizar, preguntar, mandar, cerrar };
}
