import { useCallback, useState } from 'react';
import { Linking } from 'react-native';
import {
  fechaDelDia,
  marcarVistas,
  textoDeInvitacion,
  textoParaLosQueFaltan,
  tildarLosQueVienen,
} from './asistencia';
import {
  abrirLink,
  cerrarLink,
  LinkDeAsistencia,
  linkAbierto,
} from './nube/convocatorias';
import { mandarAlGrupo as mandar, Via } from './mandar';
import { Squad } from './types';

export type { Via };

/** Lo que las pantallas necesitan del link de "¿quién viene?". */
export interface Asistencia {
  link: LinkDeAsistencia | null;
  /** Cuándo se leyeron las respuestas por última vez, para el "hace 2 min". */
  leido: number | null;
  /** Si se está haciendo algo que pidió la persona: abrir o cerrar el link. */
  ocupado: boolean;
  error: string | null;
  /** Lee las respuestas. Callado: sin mostrar que está trabajando. */
  actualizar: () => void;
  /** Abre el link para ese día y lo manda. */
  preguntar: (dia: Date, via: Via) => void;
  mandarDeNuevo: (via: Via) => void;
  /** Manda al grupo un recordatorio con los nombres de los que no contestaron. */
  avisarALosQueFaltan: (nombres: string[], via: Via) => void;
  /** Tilda a los que vienen y destilda a los que no. */
  tildar: () => void;
  /** Abre la página que reciben los amigos. */
  verPagina: () => void;
  dejarDeRecibir: () => void;
  /** Lo cierra si es de ese día: es lo que pasa al cargar el resultado. */
  cerrarSiEsDe: (fecha: string) => void;
  /** Anota que ya se vieron las respuestas, para el número de la pestaña. */
  marcarVistas: () => void;
}

/** Lo que se le pasa a la app para cambiar un plantel por id. */
export type AplicarAlPlantel = (
  plantelId: string,
  cambio: (p: Squad) => Squad,
  opciones?: { sinSubir?: boolean }
) => void;

interface Estado {
  link: LinkDeAsistencia | null;
  leido: number | null;
}

/**
 * El link de "¿quién viene?" del plantel abierto.
 *
 * Se guarda por plantel y no uno solo: si se cambia de plantel mientras llega
 * una respuesta, lo que llega tiene que ir al plantel que lo pidió y no al que
 * está en pantalla. Por lo mismo, todo lo que cambia un plantel va por id.
 *
 * Leer las respuestas no cambia nada de la convocatoria: tildar es un botón,
 * a la vista. Lo único que se anota solo es qué respuestas ya se vieron.
 */
export function useAsistencia(
  plantelId: string | null,
  alAplicar: AplicarAlPlantel
): Asistencia {
  const [estados, setEstados] = useState<Record<string, Estado>>({});
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const estado = plantelId ? estados[plantelId] : undefined;
  const link = estado?.link ?? null;
  const leido = estado?.leido ?? null;

  const recibir = useCallback((id: string, nuevo: LinkDeAsistencia | null) => {
    setEstados((prev) => ({ ...prev, [id]: { link: nuevo, leido: Date.now() } }));
  }, []);

  /** Un pedido que pidió la persona: se muestra que está trabajando. */
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
    linkAbierto(id)
      .then((nuevo) => {
        recibir(id, nuevo);
        setError(null);
      })
      .catch((e) =>
        // Callado también al fallar, salvo que no haya nada para mostrar:
        // con lo de hace un minuto a la vista, un cartel de error asusta más
        // de lo que ayuda.
        setError((antes) => antes ?? (e instanceof Error ? e.message : null))
      );
  }, [plantelId, recibir]);

  const preguntar = useCallback(
    (dia: Date, via: Via) => {
      if (!plantelId) return;
      const id = plantelId;
      conServidor(async () => {
        const nuevo = await abrirLink(id, fechaDelDia(dia));
        recibir(id, nuevo);
        await mandar(textoDeInvitacion(nuevo.fecha, nuevo.url), via);
      });
    },
    [plantelId, conServidor, recibir]
  );

  const mandarDeNuevo = useCallback(
    (via: Via) => {
      if (link) mandar(textoDeInvitacion(link.fecha, link.url), via);
    },
    [link]
  );

  const avisarALosQueFaltan = useCallback(
    (nombres: string[], via: Via) => {
      if (link && nombres.length > 0) {
        mandar(textoParaLosQueFaltan(link.fecha, nombres, link.url), via);
      }
    },
    [link]
  );

  const tildar = useCallback(() => {
    if (!plantelId || !link) return;
    const respuestas = link.respuestas;
    alAplicar(plantelId, (p) => tildarLosQueVienen(p, respuestas));
  }, [plantelId, link, alAplicar]);

  const verPagina = useCallback(() => {
    if (link) Linking.openURL(link.url).catch(() => {});
  }, [link]);

  const cerrar = useCallback(
    (codigo: string, id: string) =>
      conServidor(async () => {
        await cerrarLink(codigo);
        setEstados((prev) => ({ ...prev, [id]: { link: null, leido: Date.now() } }));
      }),
    [conServidor]
  );

  const dejarDeRecibir = useCallback(() => {
    if (plantelId && link) cerrar(link.codigo, plantelId);
  }, [plantelId, link, cerrar]);

  const cerrarSiEsDe = useCallback(
    (fecha: string) => {
      if (plantelId && link && link.fecha === fecha) cerrar(link.codigo, plantelId);
    },
    [plantelId, link, cerrar]
  );

  const marcar = useCallback(() => {
    if (!plantelId || !link) return;
    const { codigo, respuestas } = link;
    // Sin subir: es de este teléfono y no viaja, así que no hay nada que
    // guardar en la nube por haber mirado.
    alAplicar(plantelId, (p) => marcarVistas(p, codigo, respuestas), { sinSubir: true });
  }, [plantelId, link, alAplicar]);

  return {
    link,
    leido,
    ocupado,
    error,
    actualizar,
    preguntar,
    mandarDeNuevo,
    avisarALosQueFaltan,
    tildar,
    verPagina,
    dejarDeRecibir,
    cerrarSiEsDe,
    marcarVistas: marcar,
  };
}
