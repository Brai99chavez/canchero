/**
 * Lo que rodea a un partido: la cuenta de la cancha, los goleadores de la
 * imagen, el recordatorio de "¿cómo salió?" y el link de "¿quién viene?".
 *
 *     node tools/prueba-partido.mjs
 *
 * Compila esos archivos a una carpeta temporal y corre esto contra el
 * resultado. No toca nada del proyecto. No es un script de package.json por
 * lo mismo que `prueba-sync.mjs`: cambiaría la huella del APK.
 */
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const SALIDA = process.env.PRUEBA_OUT ?? join(process.cwd(), '.tmp-prueba');
execSync(
  'npx tsc src/cancha.ts src/stats.ts src/recordatorios.ts src/asistencia.ts src/types.ts ' +
    `--ignoreConfig --outDir "${SALIDA}" --module commonjs --target es2019 --skipLibCheck`,
  { stdio: 'inherit' }
);
const cancha = require(join(SALIDA, 'cancha.js'));
const stats = require(join(SALIDA, 'stats.js'));
const recordatorios = require(join(SALIDA, 'recordatorios.js'));
const asistencia = require(join(SALIDA, 'asistencia.js'));

let fallos = 0;
const ok = (nombre, condicion, detalle) => {
  if (!condicion) fallos++;
  console.log(`${condicion ? 'OK  ' : 'MAL '} ${nombre}`);
  if (!condicion && detalle !== undefined) console.log(`       ${JSON.stringify(detalle)}`);
};
const titulo = (t) => console.log(`\n— ${t} —`);

const partido = (cambios = {}) => ({
  id: 'm1',
  fecha: new Date(2026, 9, 25, 20, 0).toISOString(),
  formato: 5,
  equipoA: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'],
  equipoB: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6'],
  banco: ['s1'],
  nombres: { a1: 'Juan', a2: 'Pedro', b1: 'Ana', b2: 'Luis' },
  golesA: null,
  golesB: null,
  actuaciones: [],
  ...cambios,
});

// ------------------------------------------------------------- la cancha
titulo('la cancha');
{
  const p = partido();
  ok('ponen todos los que vinieron, banco incluido', cancha.quienesPonen(p).length === 14);
  ok(
    'sin repetir a nadie',
    cancha.quienesPonen(partido({ banco: ['a1', 's1'] })).length === 14
  );
  ok('45.000 entre 14 son 3.215, para arriba', cancha.parteDeCadaUno(45000, 14) === 3215);
  ok('10.000 entre 4 son 2.500 justos', cancha.parteDeCadaUno(10000, 4) === 2500);
  ok('sin nadie no se divide', cancha.parteDeCadaUno(10000, 0) === 0);

  ok('sin cancha cargada no hay cuenta', cancha.estadoDeLaCancha(p) === null);
  const conCancha = partido({ cancha: { total: 45000, pagaron: ['a1', 'b1', 's1'] } });
  const e = cancha.estadoDeLaCancha(conCancha);
  ok('pagaron 3', e.pagaron.length === 3, e.pagaron);
  ok('faltan 11', e.faltan.length === 11, e.faltan);
  ok('falta juntar 11 partes', e.falta === 11 * 3215, e.falta);

  const sinUno = partido({
    equipoA: ['a2', 'a3', 'a4', 'a5', 'a6', 'a7'],
    cancha: { total: 45000, pagaron: ['a1', 'b1'] },
  });
  const e2 = cancha.estadoDeLaCancha(sinUno);
  ok(
    'el que al final no jugó no cuenta, aunque haya pagado',
    e2.pagaron.length === 1 && e2.parte === cancha.parteDeCadaUno(45000, 13),
    e2
  );

  const c = { total: 1000, pagaron: [] };
  const conJuan = cancha.alternarPago(c, 'a1');
  ok('marcar que pagó', conJuan.pagaron.includes('a1'));
  ok('y desmarcarlo', !cancha.alternarPago(conJuan, 'a1').pagaron.includes('a1'));
  ok('sin tocar el original', c.pagaron.length === 0);

  ok('lee un total que vino como texto', cancha.limpiarCancha({ total: '45000' })?.total === 45000);
  ok('redondea al peso', cancha.limpiarCancha({ total: 45000.6 })?.total === 45001);
  ok('sin total no hay cancha', cancha.limpiarCancha({ total: 0 }) === undefined);
  ok('un total negativo tampoco', cancha.limpiarCancha({ total: -5 }) === undefined);
  ok('nada guardado, nada', cancha.limpiarCancha(undefined) === undefined);
  ok(
    'los que pagaron, sin repetir y sólo ids',
    JSON.stringify(cancha.limpiarCancha({ total: 10, pagaron: ['a', 'a', 3, null, 'b'] }).pagaron) ===
      '["a","b"]'
  );

  ok('$45.000', cancha.enPesos(45000) === '$45.000', cancha.enPesos(45000));
  ok('$3.215', cancha.enPesos(3215) === '$3.215');
  ok('$999', cancha.enPesos(999) === '$999');
  ok('$1.234.567', cancha.enPesos(1234567) === '$1.234.567');
  ok('$0', cancha.enPesos(0) === '$0');
}

// --------------------------------------------------------- los goleadores
titulo('los goleadores');
{
  const p = partido({
    golesA: 4,
    golesB: 1,
    actuaciones: [
      { jugadorId: 'a2', goles: 1, asistencias: 0 },
      { jugadorId: 'a1', goles: 2, asistencias: 1 },
      { jugadorId: 'b2', goles: 0, asistencias: 2 },
      { jugadorId: 'b1', goles: 1, asistencias: 0 },
    ],
  });
  const g = stats.goleadoresDe(p);
  ok('el que más hizo primero, y a igual cantidad por nombre', g.map((x) => x.nombre).join(',') === 'Juan,Ana,Pedro', g);
  ok('sin los que no metieron', !g.some((x) => x.nombre === 'Luis'));
  ok('se escribe como en el grupo', stats.textoDeGoleadores(g) === 'Juan (2), Ana, Pedro', stats.textoDeGoleadores(g));
}

// --------------------------------------------------------- el recordatorio
titulo('el recordatorio de "¿cómo salió?"');
{
  const cuando = recordatorios.cuandoRecordar(new Date(2026, 9, 25, 20, 0).toISOString());
  ok(
    'a la mañana siguiente',
    cuando.getDate() === 26 && cuando.getMonth() === 9 && cuando.getHours() === recordatorios.HORA_DEL_RECORDATORIO,
    cuando
  );
  ok('fin de mes pasa al día 1', recordatorios.cuandoRecordar(new Date(2026, 9, 31, 20).toISOString()).getDate() === 1);
  ok('una fecha rota no se programa', recordatorios.cuandoRecordar('cualquiera') === null);

  const plantel = (partidos, id = 'p1') => ({
    id, nombre: 'Los del jueves', llegada: '', actualizado: '', jugadores: [], partidos,
    convocatoria: { formato: 5, seleccionados: [], usarTodos: false }, sorteo: null,
  });
  const antes = new Date(2026, 9, 24, 12);
  const lista = recordatorios.recordatoriosPara([plantel([partido()])], antes);
  ok('un partido sin resultado lleva uno', lista.length === 1, lista);
  ok('con el nombre del plantel', lista[0]?.cuerpo.includes('Los del jueves'));
  ok('y sabe a qué partido lleva', lista[0]?.plantelId === 'p1' && lista[0]?.partidoId === 'm1');
  ok('con el prefijo propio', lista[0]?.id.startsWith(recordatorios.PREFIJO));

  ok(
    'con resultado ya no',
    recordatorios.recordatoriosPara([plantel([partido({ golesA: 1, golesB: 0 })])], antes).length === 0
  );
  ok(
    'si la mañana siguiente ya pasó, tampoco',
    recordatorios.recordatoriosPara([plantel([partido()])], new Date(2026, 9, 26, 12)).length === 0
  );
  ok(
    'de un plantel fuera del plan, tampoco',
    recordatorios.recordatoriosPara([plantel([partido()])], antes, new Set(['otro'])).length === 0
  );
  const otroDia = recordatorios.recordatoriosPara(
    [plantel([partido({ fecha: new Date(2026, 9, 27, 20).toISOString() })])],
    antes
  );
  ok('si cambia la fecha, cambia el id', otroDia[0].id !== lista[0].id);

  const d = recordatorios.diferencia(
    [lista[0].id, 'resultado:viejo:1', 'otra-cosa'],
    [...lista, ...otroDia]
  );
  ok('cancela los suyos que ya no van', JSON.stringify(d.cancelar) === '["resultado:viejo:1"]', d.cancelar);
  ok('no toca avisos ajenos', !d.cancelar.includes('otra-cosa'));
  ok('programa sólo los que faltan', d.programar.length === 1 && d.programar[0].id === otroDia[0].id, d.programar);
}

// ------------------------------------------------- el link de asistencia
titulo('el link de "¿quién viene?"');
{
  const jugador = (id) => ({ id, nombre: id, posicion: 'MED', stats: {} });
  const base = {
    id: 'p1', nombre: 'Los del jueves', llegada: '', actualizado: '',
    jugadores: ['juan', 'pedro', 'luis', 'ana'].map(jugador), partidos: [], sorteo: null,
    convocatoria: { formato: 5, seleccionados: ['luis'], usarTodos: false },
  };

  const p1 = asistencia.aplicarRespuestas(base, 'c1', { juan: true, luis: false, fantasma: true });
  ok('el que va queda marcado', p1.convocatoria.seleccionados.includes('juan'), p1.convocatoria.seleccionados);
  ok('el que no va, desmarcado', !p1.convocatoria.seleccionados.includes('luis'));
  ok('alguien que no está en el plantel no se marca', !p1.convocatoria.seleccionados.includes('fantasma'));
  ok('sin tocar el original', base.convocatoria.seleccionados.join() === 'luis');

  ok(
    'sin nada nuevo devuelve el mismo plantel',
    asistencia.aplicarRespuestas(p1, 'c1', { juan: true, luis: false, fantasma: true }) === p1
  );

  // Lo desmarcan a mano: manda eso hasta que Juan cambie su respuesta.
  const aMano = { ...p1, convocatoria: { ...p1.convocatoria, seleccionados: [] } };
  const p2 = asistencia.aplicarRespuestas(aMano, 'c1', { juan: true, luis: false, fantasma: true });
  ok('lo corregido a mano no se pisa', !p2.convocatoria.seleccionados.includes('juan'));
  const p3 = asistencia.aplicarRespuestas(p2, 'c1', { juan: false, luis: false });
  const p4 = asistencia.aplicarRespuestas(p3, 'c1', { juan: true, luis: false });
  ok('hasta que cambia de respuesta', p4.convocatoria.seleccionados.includes('juan'), p4.convocatoria.seleccionados);

  const nuevo = asistencia.aplicarRespuestas(aMano, 'c2', { juan: true });
  ok('un link nuevo empieza de cero', nuevo.convocatoria.seleccionados.includes('juan'));
  ok('y se acuerda de cuál es', nuevo.convocatoria.asistencia.codigo === 'c2');

  const r = asistencia.resumenDeRespuestas(base.jugadores, { juan: true, pedro: true, luis: false, fantasma: true });
  ok('cuenta sólo a los del plantel', r.van === 2 && r.noVan === 1 && r.faltan === 1, r);

  ok('el día que viaja', asistencia.fechaDelDia(new Date(2026, 9, 5, 23, 30)) === '2026-10-05');
  ok('cómo se lee', asistencia.comoSeLeeElDia('2026-10-25') === 'domingo 25 de octubre');
  const texto = asistencia.textoDeInvitacion('2026-10-25', 'https://x/v/abc');
  ok('el mensaje lleva el día y el link', texto.includes('domingo 25 de octubre') && texto.endsWith('https://x/v/abc'), texto);
}

console.log(fallos === 0 ? '\nTodo bien.' : `\n${fallos} mal.`);
process.exit(fallos === 0 ? 0 : 1);
