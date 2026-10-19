import { Respuestas } from '../asistencia';
import { pedir } from './cliente';

/**
 * El link de "¿quién viene?" del lado del servidor: abrirlo, ver quién
 * contestó y cerrarlo. La página que abre el grupo la sirve el servidor; acá
 * sólo se habla con él.
 */

export interface LinkDeAsistencia {
  codigo: string;
  /** Lo que se manda al grupo. */
  url: string;
  /** "2026-10-25". */
  fecha: string;
  respuestas: Respuestas;
}

interface DelServidor {
  codigo: string;
  url: string;
  fecha: string;
  respuestas: Record<string, { va?: unknown } | undefined>;
}

/** El servidor guarda también cuándo contestó cada uno; acá alcanza con el sí o el no. */
function desdeServidor(c: DelServidor): LinkDeAsistencia {
  const respuestas: Respuestas = {};
  for (const [id, r] of Object.entries(c.respuestas ?? {})) {
    if (typeof r?.va === 'boolean') respuestas[id] = r.va;
  }
  return { codigo: c.codigo, url: c.url, fecha: c.fecha, respuestas };
}

/**
 * Abre el link de un plantel para un día. Si ya había uno para ese día vuelve
 * el mismo, con lo que ya contestaron.
 */
export async function abrirLink(
  plantelId: string,
  fecha: string
): Promise<LinkDeAsistencia> {
  const r = await pedir<{ convocatoria: DelServidor }>('/convocatorias', {
    metodo: 'POST',
    cuerpo: { plantelId, fecha },
  });
  return desdeServidor(r.convocatoria);
}

/** El que está abierto para ese plantel, o null. */
export async function linkAbierto(
  plantelId: string
): Promise<LinkDeAsistencia | null> {
  const r = await pedir<{ convocatoria: DelServidor | null }>(
    `/convocatorias?plantel=${encodeURIComponent(plantelId)}`
  );
  return r.convocatoria ? desdeServidor(r.convocatoria) : null;
}

/** Lo cierra: al que lo abra después le dice que ya no está activo. */
export async function cerrarLink(codigo: string): Promise<void> {
  await pedir(`/convocatorias/${encodeURIComponent(codigo)}`, {
    metodo: 'DELETE',
  });
}
