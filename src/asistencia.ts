import { Partido, Player, Squad } from './types';

/**
 * Lo que contestaron desde el link de "¿quién viene?", y lo que el que
 * organiza puede hacer con eso.
 *
 * Aparte de las pantallas para poder probarlo solo: es lo que decide a quién
 * se tilda y a quién no, y un error acá deja a alguien afuera del partido.
 *
 * Nada de esto tilda por su cuenta. Antes la app tildaba sola al leer las
 * respuestas, sin avisar, y el que organizaba no entendía por qué la lista
 * había cambiado. Ahora la lista se agrupa por lo que contestó cada uno y el
 * tildado es un botón: se ve qué va a pasar antes de que pase.
 */

/** Quién contestó qué: `true` viene, `false` no viene. Los que no están, no contestaron. */
export type Respuestas = Record<string, boolean>;

const porNombre = (a: Player, b: Player) => a.nombre.localeCompare(b.nombre, 'es');

/** Los jugadores del plantel separados por lo que contestaron, cada grupo por nombre. */
export function agruparPorRespuesta(
  jugadores: Player[],
  respuestas: Respuestas
): { vienen: Player[]; faltan: Player[]; noVienen: Player[] } {
  const vienen: Player[] = [];
  const faltan: Player[] = [];
  const noVienen: Player[] = [];
  for (const j of jugadores) {
    const r = respuestas[j.id];
    (r === true ? vienen : r === false ? noVienen : faltan).push(j);
  }
  return {
    vienen: vienen.sort(porNombre),
    faltan: faltan.sort(porNombre),
    noVienen: noVienen.sort(porNombre),
  };
}

/**
 * Qué cambiaría tildar según lo que contestaron: a quién falta sumar y a quién
 * habría que sacar. Es lo que dice el botón antes de tocarlo.
 */
export function queFaltaTildar(
  seleccionados: string[],
  jugadores: Player[],
  respuestas: Respuestas
): { sumar: Player[]; sacar: Player[] } {
  const tildados = new Set(seleccionados);
  const { vienen, noVienen } = agruparPorRespuesta(jugadores, respuestas);
  return {
    sumar: vienen.filter((j) => !tildados.has(j.id)),
    sacar: noVienen.filter((j) => tildados.has(j.id)),
  };
}

/**
 * Tilda a los que dijeron que vienen y destilda a los que dijeron que no. A
 * los que no contestaron no los toca: si estaban tildados es porque alguien
 * los tildó a mano, y eso manda.
 *
 * Devuelve el mismo plantel si no hay nada que hacer, para no tocarlo de gusto.
 */
export function tildarLosQueVienen(plantel: Squad, respuestas: Respuestas): Squad {
  const conv = plantel.convocatoria;
  const { sumar, sacar } = queFaltaTildar(conv.seleccionados, plantel.jugadores, respuestas);
  if (sumar.length === 0 && sacar.length === 0) return plantel;
  const fuera = new Set(sacar.map((j) => j.id));
  return {
    ...plantel,
    convocatoria: {
      ...conv,
      seleccionados: [
        ...conv.seleccionados.filter((id) => !fuera.has(id)),
        ...sumar.map((j) => j.id),
      ],
    },
  };
}

/**
 * Cuántas respuestas no viste todavía: las que llegaron y las que cambiaron
 * desde la última vez que miraste la pantalla. Es el número de la pestaña.
 */
export function respuestasNuevas(
  plantel: Squad,
  codigo: string,
  respuestas: Respuestas
): number {
  const guardada = plantel.convocatoria.asistencia;
  const vistas = guardada?.codigo === codigo ? guardada.vistas : {};
  const existen = new Set(plantel.jugadores.map((j) => j.id));
  return Object.entries(respuestas).filter(
    ([id, va]) => existen.has(id) && vistas[id] !== va
  ).length;
}

/** Anota que ya las viste. El mismo plantel si no había nada nuevo. */
export function marcarVistas(plantel: Squad, codigo: string, respuestas: Respuestas): Squad {
  if (respuestasNuevas(plantel, codigo, respuestas) === 0 &&
      plantel.convocatoria.asistencia?.codigo === codigo) {
    return plantel;
  }
  return {
    ...plantel,
    convocatoria: {
      ...plantel.convocatoria,
      asistencia: { codigo, vistas: { ...respuestas } },
    },
  };
}

/**
 * Lo que cambió en un partido ya armado según el link: quiénes de los que
 * juegan avisaron que no vienen, y quiénes dijeron que vienen pero no están
 * en ningún equipo. Es lo que se le muestra al que organiza en el partido.
 */
export function novedadesDelPartido(
  partido: Partido,
  respuestas: Respuestas,
  jugadores: Player[]
): { seBajaron: string[]; quierenJugar: string[] } {
  const juegan = new Set([...partido.equipoA, ...partido.equipoB, ...partido.banco]);
  const nombre = (id: string) =>
    partido.nombres[id] ?? jugadores.find((j) => j.id === id)?.nombre ?? 'Jugador';
  return {
    seBajaron: [...juegan].filter((id) => respuestas[id] === false).map(nombre),
    quierenJugar: jugadores
      .filter((j) => respuestas[j.id] === true && !juegan.has(j.id))
      .sort(porNombre)
      .map((j) => j.nombre),
  };
}

/** "Pedro, Tomi y Fede": como se escribe una lista en un mensaje. */
export function enLista(nombres: string[]): string {
  if (nombres.length <= 1) return nombres.join('');
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
}

/** "2026-10-25", el día en la hora del teléfono. Es lo que viaja al servidor. */
export function fechaDelDia(dia: Date): string {
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${dia.getFullYear()}-${dos(dia.getMonth() + 1)}-${dos(dia.getDate())}`;
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** "domingo 25 de octubre", a partir de "2026-10-25". */
export function comoSeLeeElDia(fecha: string): string {
  const [a, m, d] = fecha.split('-').map(Number);
  const dia = new Date(a, m - 1, d);
  if (Number.isNaN(dia.getTime())) return fecha;
  return `${DIAS[dia.getDay()]} ${d} de ${MESES[m - 1]}`;
}

/**
 * Los días que se ofrecen para preguntar, sin abrir un calendario: hoy,
 * mañana, y el sábado y el domingo que vienen, que es cuando se juega casi
 * siempre. Sin repetir: si mañana es sábado, el sábado ya está.
 */
export function atajosDeDia(hoy: Date): { etiqueta: string; dia: Date }[] {
  const base = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const masDias = (n: number) =>
    new Date(base.getFullYear(), base.getMonth(), base.getDate() + n);
  const atajos = [
    { etiqueta: 'Hoy', dia: base },
    { etiqueta: 'Mañana', dia: masDias(1) },
  ];
  for (let n = 2; n <= 7; n++) {
    const dia = masDias(n);
    if (dia.getDay() === 6 || dia.getDay() === 0) {
      atajos.push({ etiqueta: `${DIAS_CORTOS[dia.getDay()]} ${dia.getDate()}`, dia });
    }
  }
  return atajos;
}

/** "recién", "hace 3 min", "hace 2 h": cuándo se miró por última vez. */
export function hace(desde: number, ahora: number): string {
  const minutos = Math.floor((ahora - desde) / 60000);
  if (minutos < 1) return 'recién';
  if (minutos < 60) return `hace ${minutos} min`;
  return `hace ${Math.floor(minutos / 60)} h`;
}

/** El mensaje que se manda al grupo con el link. */
export function textoDeInvitacion(fecha: string, url: string): string {
  return (
    `¿Quién viene al fútbol del ${comoSeLeeElDia(fecha)}? ` +
    `Tocá tu nombre y anotate, es un segundo: ${url}`
  );
}

/** El recordatorio para los que no contestaron, con sus nombres. */
export function textoParaLosQueFaltan(fecha: string, nombres: string[], url: string): string {
  return (
    `Faltan contestar ${enLista(nombres)} para el fútbol del ${comoSeLeeElDia(fecha)}. ` +
    `Anótense acá, es un segundo: ${url}`
  );
}
