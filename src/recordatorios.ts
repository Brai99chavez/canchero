import { tieneResultado } from './stats';
import { Squad } from './types';

/**
 * Qué recordatorios de "¿cómo salió?" tienen que estar programados.
 *
 * El puntaje de cada uno sólo aprende de los resultados, y el resultado es lo
 * que nadie se acuerda de cargar: el partido se juega, se van a comer, y al
 * otro día ya nadie abre la app para eso. El recordatorio llega la mañana
 * siguiente, que es cuando todavía se acuerdan cómo salió.
 *
 * Esto sólo decide cuáles y cuándo; programarlos en el teléfono es de
 * `avisos.ts`. Así se puede probar sin un teléfono.
 */

/** A qué hora del día siguiente. Ni tan temprano que despierte a nadie. */
export const HORA_DEL_RECORDATORIO = 11;

/** Con esto empiezan los ids, para no tocar otros avisos programados. */
export const PREFIJO = 'resultado:';

export interface Recordatorio {
  /**
   * Lleva la hora adentro a propósito: si cambia la fecha del partido, cambia
   * el id, y el viejo se cancela solo al no estar más en la lista.
   */
  id: string;
  cuando: Date;
  titulo: string;
  cuerpo: string;
  plantelId: string;
  partidoId: string;
}

/** La mañana siguiente al día del partido, en la hora del teléfono. */
export function cuandoRecordar(fechaDelPartido: string): Date | null {
  const dia = new Date(fechaDelPartido);
  if (Number.isNaN(dia.getTime())) return null;
  return new Date(
    dia.getFullYear(),
    dia.getMonth(),
    dia.getDate() + 1,
    HORA_DEL_RECORDATORIO,
    0,
    0
  );
}

export function recordatoriosPara(
  planteles: Squad[],
  ahora: Date,
  /** Los que el plan deja abrir. Avisar de uno bloqueado es mandar a un muro. */
  permitidos?: ReadonlySet<string>
): Recordatorio[] {
  const lista: Recordatorio[] = [];
  for (const plantel of planteles) {
    if (permitidos && !permitidos.has(plantel.id)) continue;
    for (const partido of plantel.partidos) {
      if (tieneResultado(partido)) continue;
      const cuando = cuandoRecordar(partido.fecha);
      // Uno que ya pasó no se programa: un aviso de hace tres días que llega
      // ahora no ayuda a nadie a acordarse.
      if (!cuando || cuando.getTime() <= ahora.getTime()) continue;
      lista.push({
        id: `${PREFIJO}${partido.id}:${cuando.getTime()}`,
        cuando,
        titulo: '¿Cómo salió el partido de ayer?',
        cuerpo: `Cargá el resultado en ${plantel.nombre}: así se llevan las rachas y el nivel de cada uno.`,
        plantelId: plantel.id,
        partidoId: partido.id,
      });
    }
  }
  return lista;
}

/**
 * Qué hay que cancelar y qué hay que programar, comparando con lo que ya está
 * programado en el teléfono. Sólo mira los suyos: los que empiezan con el
 * prefijo.
 */
export function diferencia(
  programados: string[],
  queTocan: Recordatorio[]
): { cancelar: string[]; programar: Recordatorio[] } {
  const nuestros = programados.filter((id) => id.startsWith(PREFIJO));
  const quedan = new Set(queTocan.map((r) => r.id));
  const yaEstan = new Set(nuestros);
  return {
    cancelar: nuestros.filter((id) => !quedan.has(id)),
    programar: queTocan.filter((r) => !yaEstan.has(r.id)),
  };
}
