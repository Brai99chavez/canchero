import { pedir } from './cliente';

/**
 * Los amigos y la conversación con cada uno.
 *
 * Nada de esto se consulta cada tantos segundos: se pide al abrir la pantalla,
 * al mandar algo y cuando llega un aviso de que pasó algo. La base es la de
 * Neon en su plan gratis, que se suspende sola cuando nadie la usa; un refresco
 * periódico la mantendría despierta para siempre sin que haya nada nuevo.
 */

export type EstadoAmistad = 'pendiente' | 'aceptada';

export interface Amigo {
  usuario: string;
  foto: string | null;
  estado: EstadoAmistad;
  /** Si la solicitud pendiente la mandé yo, la tiene que responder el otro. */
  loPediYo: boolean;
  pedido: string;
  ultimo: { tipo: 'texto' | 'plantel'; texto: string | null; cuando: string } | null;
  sinLeer: number;
}

export interface Mensaje {
  id: string;
  mio: boolean;
  tipo: 'texto' | 'plantel';
  texto: string | null;
  cuando: string;
  plantel: {
    envio: string;
    nombre: string;
    estado: 'pendiente' | 'aceptado' | 'rechazado';
    jugadores: number;
    partidos: number;
  } | null;
}

export async function listarAmigos(): Promise<Amigo[]> {
  const { amigos } = await pedir<{ amigos: Amigo[] }>('/amigos');
  return amigos;
}

/**
 * Manda una solicitud. Si el otro ya te había mandado una, esto la acepta y
 * vuelve con `aceptada`.
 */
export function pedirAmistad(
  usuario: string
): Promise<{ estado: EstadoAmistad; usuario: string }> {
  return pedir('/amigos', { metodo: 'POST', cuerpo: { usuario } });
}

export async function responderAmistad(
  usuario: string,
  acepta: boolean
): Promise<void> {
  await pedir(`/amigos/${usuario}/responder`, {
    metodo: 'POST',
    cuerpo: { acepta },
  });
}

export async function sacarAmigo(usuario: string): Promise<void> {
  await pedir(`/amigos/${usuario}`, { metodo: 'DELETE' });
}

export async function conversacionCon(usuario: string): Promise<Mensaje[]> {
  const { mensajes } = await pedir<{ mensajes: Mensaje[] }>(
    `/mensajes/${usuario}`
  );
  return mensajes;
}

export async function mandarTexto(
  usuario: string,
  texto: string
): Promise<void> {
  await pedir(`/mensajes/${usuario}`, { metodo: 'POST', cuerpo: { texto } });
}

/** Deja la conversación como leída. Es lo que apaga el contador de la lista. */
export async function marcarLeido(usuario: string): Promise<void> {
  await pedir(`/mensajes/${usuario}/leido`, { metodo: 'POST' });
}
