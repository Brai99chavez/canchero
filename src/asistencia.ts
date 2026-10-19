import { Convocatoria, Player, Squad } from './types';

/**
 * Lo que contestaron desde el link de "¿quién viene?", y cómo eso arma la
 * convocatoria.
 *
 * Aparte de las pantallas para poder probarlo solo: es lo que decide a quién
 * se marca y a quién no, y un error acá deja a alguien afuera del partido.
 */

/** Quién contestó qué: `true` va, `false` no va. Los que no están, no contestaron. */
export type Respuestas = Record<string, boolean>;

/**
 * Pasa a la convocatoria lo que contestaron desde el link.
 *
 * Sólo lo que cambió desde la última vez que se miró. Si se aplicara todo cada
 * vez, el que organiza no podría corregir nada: Juan dijo que va, pero avisó
 * por WhatsApp que llega tarde y lo desmarcás; a la próxima vuelta la app lo
 * volvería a marcar sola. Así, lo tuyo manda hasta que Juan cambie su
 * respuesta.
 *
 * Devuelve el mismo plantel si no hay nada nuevo, para no tocarlo de gusto.
 */
export function aplicarRespuestas(
  plantel: Squad,
  codigo: string,
  respuestas: Respuestas
): Squad {
  const conv = plantel.convocatoria;
  // Un link nuevo empieza de cero: lo que se contestó en el anterior era para
  // otro día.
  const antes = conv.asistencia?.codigo === codigo ? conv.asistencia.respuestas : {};
  const existen = new Set(plantel.jugadores.map((j) => j.id));

  let seleccionados = conv.seleccionados;
  let cambio = conv.asistencia?.codigo !== codigo;
  for (const [id, va] of Object.entries(respuestas)) {
    if (antes[id] === va) continue;
    cambio = true;
    if (!existen.has(id)) continue;
    if (va && !seleccionados.includes(id)) {
      seleccionados = [...seleccionados, id];
    } else if (!va && seleccionados.includes(id)) {
      seleccionados = seleccionados.filter((x) => x !== id);
    }
  }
  if (!cambio) return plantel;

  const convocatoria: Convocatoria = {
    ...conv,
    seleccionados,
    asistencia: { codigo, respuestas: { ...respuestas } },
  };
  return { ...plantel, convocatoria };
}

/** Cuántos van, cuántos no y cuántos faltan contestar, entre los del plantel. */
export function resumenDeRespuestas(
  jugadores: Player[],
  respuestas: Respuestas
): { van: number; noVan: number; faltan: number } {
  let van = 0;
  let noVan = 0;
  for (const j of jugadores) {
    if (respuestas[j.id] === true) van++;
    else if (respuestas[j.id] === false) noVan++;
  }
  return { van, noVan, faltan: jugadores.length - van - noVan };
}

/** "2026-10-25", el día en la hora del teléfono. Es lo que viaja al servidor. */
export function fechaDelDia(dia: Date): string {
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${dia.getFullYear()}-${dos(dia.getMonth() + 1)}-${dos(dia.getDate())}`;
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
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

/** El mensaje que se manda al grupo con el link. */
export function textoDeInvitacion(fecha: string, url: string): string {
  return (
    `¿Quién viene al fútbol del ${comoSeLeeElDia(fecha)}? ` +
    `Tocá tu nombre y anotate, es un segundo: ${url}`
  );
}
