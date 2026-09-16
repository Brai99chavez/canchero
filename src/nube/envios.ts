import { Squad } from '../types';
import { pedir } from './cliente';
import { subirFotosPendientes } from './fotos';

/**
 * Mandarle un plantel a otro por su nombre de usuario.
 *
 * Va una copia: el que recibe lo acepta y a partir de ahí es suyo. Lo que haga
 * cualquiera de los dos después no toca lo del otro, que es lo que uno espera
 * de "te paso el plantel".
 */

/** Uno que llegó y todavía no se abrió. */
export interface Envio {
  id: string;
  /** El nombre de usuario del que lo mandó. */
  de: string;
  foto: string | null;
  nombre: string;
  enviado: string;
  jugadores: number;
  partidos: number;
}

/**
 * Manda el plantel y devuelve cómo quedó en este teléfono.
 *
 * Las fotos que todavía viven sólo acá se suben primero: una ruta `file://` no
 * le sirve de nada al que recibe, apunta a un archivo de otro celular. Por eso
 * devuelve el plantel —con las URLs ya puestas— para que quien llama lo guarde
 * y no haya que volver a subirlas en el próximo respaldo.
 *
 * Una foto que no sube no frena el envío: va el plantel sin esa foto, que es
 * mucho mejor que no mandar nada.
 */
export async function enviarPlantel(
  usuario: string,
  plantel: Squad
): Promise<Squad> {
  const subidas = await subirFotosPendientes([plantel]);
  const listo = subidas.planteles[0] ?? plantel;

  await pedir('/envios', {
    metodo: 'POST',
    cuerpo: {
      usuario,
      // Sólo lo que tiene sentido del otro lado: el id, la fecha de llegada y
      // la convocatoria de este teléfono no le sirven a nadie más.
      plantel: {
        nombre: listo.nombre,
        datos: { jugadores: listo.jugadores, partidos: listo.partidos },
      },
    },
  });

  return listo;
}

export async function pendientes(): Promise<Envio[]> {
  const { envios } = await pedir<{ envios: Envio[] }>('/envios');
  return envios;
}

/** Acepta uno y devuelve el plantel para guardarlo en este teléfono. */
export function aceptarEnvio(id: string): Promise<{
  nombre: string;
  datos: { jugadores?: unknown[]; partidos?: unknown[] };
}> {
  return pedir(`/envios/${id}/aceptar`, { metodo: 'POST' });
}

export async function rechazarEnvio(id: string): Promise<void> {
  await pedir(`/envios/${id}/rechazar`, { metodo: 'POST' });
}
