import { useNetworkState } from 'expo-network';
import { useEffect, useState } from 'react';
import { API } from './cliente';

/**
 * Si el teléfono puede llegar al servidor.
 *
 * Lo primero que se mira es lo que dice el sistema, que es gratis y no pide
 * nada. Pero no alcanza con eso, y el motivo es concreto: en Android
 * `isInternetReachable` sale de una prueba que hace el propio sistema, y se
 * equivoca seguido. Tarda en confirmarse al reconectar, parpadea, y hay redes
 * que bloquean esa prueba y quedan marcadas como sin salida teniendo salida.
 * El resultado era un cartel de "sin conexión" con la conexión andando.
 *
 * Y ese error es caro: a un cartel que miente se le deja de creer, y entonces
 * tampoco se le cree cuando dice la verdad.
 *
 * Así que cuando el sistema dice que no hay, no se le cree de una: se espera
 * un momento —por si era un parpadeo— y se prueba llegar al servidor, que es
 * lo único que de verdad importa. El cartel sale recién si eso también falla.
 *
 * No es un refresco periódico: esto corre sólo cuando el sistema avisa que se
 * cayó algo, no cada tantos segundos.
 */

/** Lo que se espera antes de dudar, para no reaccionar a un parpadeo. */
const ANTES_DE_DUDAR = 3000;

/**
 * Cuánto se le da al servidor para contestar.
 *
 * Generoso porque el plan gratis de Render apaga el servicio cuando no se usa
 * y tarda en despertar. Sin señal de verdad esto no llega ni cerca del tope:
 * un pedido sin red falla al instante, así que el cartel igual aparece rápido
 * cuando la cosa es real.
 */
const CORTE = 12_000;

async function llegaElServidor(): Promise<boolean> {
  if (!API) return false;
  const corte = new AbortController();
  const reloj = setTimeout(() => corte.abort(), CORTE);
  try {
    const r = await fetch(`${API}/`, { signal: corte.signal });
    return r.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(reloj);
  }
}

export function useHayInternet(): boolean {
  const estado = useNetworkState();
  /*
   * Mientras el sistema todavía no contestó —los primeros instantes— acá hay
   * internet. Arrancar mostrando el cartel y sacarlo medio segundo después es
   * un parpadeo que no le sirve a nadie.
   */
  const sistemaDice = estado.isInternetReachable ?? estado.isConnected ?? true;
  const [confirmadoSinRed, setConfirmadoSinRed] = useState(false);

  useEffect(() => {
    if (sistemaDice) {
      setConfirmadoSinRed(false);
      return;
    }
    let vigente = true;
    const reloj = setTimeout(async () => {
      const anda = await llegaElServidor();
      if (vigente) setConfirmadoSinRed(!anda);
    }, ANTES_DE_DUDAR);

    return () => {
      vigente = false;
      clearTimeout(reloj);
    };
  }, [sistemaDice]);

  // Sin confirmar, se asume que hay: el sistema puede estar equivocándose.
  return sistemaDice || !confirmadoSinRed;
}
