/**
 * Cómo se escriben las fechas en la app.
 *
 * Todo en un lugar porque los partidos las muestran en tres pantallas y cada
 * una se armaba la suya: una decía "20/09", otra "sábado 20 de septiembre" y
 * el historial otra distinta.
 */

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** El día de esa fecha, sin la hora, para poder comparar dos días. */
function soloElDia(f: Date): number {
  return new Date(f.getFullYear(), f.getMonth(), f.getDate()).getTime();
}

/**
 * "Hoy", "Ayer", "Mañana" o el día escrito.
 *
 * Los tres días cercanos con su nombre y no con el número: al elegir cuándo se
 * jugó, "hoy" se entiende de un vistazo y "20 de septiembre" hay que pensarlo.
 */
export function comoSeLee(fecha: Date): string {
  const dias = Math.round(
    (soloElDia(fecha) - soloElDia(new Date())) / 86_400_000
  );
  if (dias === 0) return 'Hoy';
  if (dias === -1) return 'Ayer';
  if (dias === 1) return 'Mañana';
  return diaYMes(fecha);
}

/**
 * "20 de septiembre", siempre con el día escrito.
 *
 * Para lo que se lee otro día, como la imagen que se manda al grupo: ahí
 * "Hoy" deja de ser verdad al día siguiente. A mano y no con
 * `toLocaleDateString`, que cada motor escribe a su manera ("20-septiembre").
 */
export function diaYMes(fecha: Date): string {
  const texto = `${fecha.getDate()} de ${MESES[fecha.getMonth()]}`;
  // El año sólo cuando no es el que corre: el resto del tiempo es ruido.
  return fecha.getFullYear() === new Date().getFullYear()
    ? texto
    : `${texto} de ${fecha.getFullYear()}`;
}

/** Corto, para las listas: "20 sept". */
export function comoSeLeeCorto(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
}

/** La etiqueta de un mes: "septiembre" o "septiembre 2025". */
export function nombreDelMes(anio: number, mes: number): string {
  return anio === new Date().getFullYear()
    ? MESES[mes]
    : `${MESES[mes]} ${anio}`;
}

/** Con qué día agrupar una fecha guardada. */
export function diaDe(iso: string): string {
  const f = new Date(iso);
  if (Number.isNaN(f.getTime())) return iso.slice(0, 10);
  return `${f.getFullYear()}-${String(f.getMonth()).padStart(2, '0')}-${String(
    f.getDate()
  ).padStart(2, '0')}`;
}

/** El día suelto: "sáb 20". Para el filtro, donde el mes ya está dicho. */
export function comoSeLeeDia(iso: string): string {
  const f = new Date(iso);
  if (Number.isNaN(f.getTime())) return iso.slice(0, 10);
  return f.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' });
}

/** Con qué mes agrupar una fecha guardada. */
export function mesDe(iso: string): string {
  const f = new Date(iso);
  return `${f.getFullYear()}-${String(f.getMonth()).padStart(2, '0')}`;
}
