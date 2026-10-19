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
    jugadores: ['pedro', 'juan', 'luis', 'ana', 'sol'].map(jugador), partidos: [], sorteo: null,
    convocatoria: { formato: 5, seleccionados: ['luis', 'sol'], usarTodos: false },
  };
  const respuestas = { juan: true, ana: true, luis: false, fantasma: true };

  const g = asistencia.agruparPorRespuesta(base.jugadores, respuestas);
  ok('vienen, por nombre', g.vienen.map((j) => j.id).join() === 'ana,juan', g.vienen.map((j) => j.id));
  ok('no vienen', g.noVienen.map((j) => j.id).join() === 'luis');
  ok('faltan contestar, por nombre', g.faltan.map((j) => j.id).join() === 'pedro,sol', g.faltan.map((j) => j.id));
  ok('alguien que no está en el plantel no aparece', ![...g.vienen, ...g.faltan, ...g.noVienen].some((j) => j.id === 'fantasma'));

  const q = asistencia.queFaltaTildar(base.convocatoria.seleccionados, base.jugadores, respuestas);
  ok('el botón sabe a quién sumar', q.sumar.map((j) => j.id).join() === 'ana,juan', q.sumar.map((j) => j.id));
  ok('y a quién sacar', q.sacar.map((j) => j.id).join() === 'luis', q.sacar.map((j) => j.id));

  const t = asistencia.tildarLosQueVienen(base, respuestas);
  const sel = t.convocatoria.seleccionados;
  ok('tilda a los que vienen', sel.includes('juan') && sel.includes('ana'), sel);
  ok('destilda a los que no', !sel.includes('luis'), sel);
  ok('a los que no contestaron no los toca', sel.includes('sol'), sel);
  ok('ni marca a desconocidos', !sel.includes('fantasma'));
  ok('sin tocar el original', base.convocatoria.seleccionados.join() === 'luis,sol');
  ok('si ya está al día, devuelve el mismo plantel', asistencia.tildarLosQueVienen(t, respuestas) === t);
  ok(
    'después de tildar no queda nada pendiente',
    asistencia.queFaltaTildar(sel, base.jugadores, respuestas).sumar.length === 0
  );

  ok('sin haber mirado, todas son nuevas', asistencia.respuestasNuevas(base, 'c1', respuestas) === 3);
  const visto = asistencia.marcarVistas(base, 'c1', respuestas);
  ok('después de mirar, ninguna', asistencia.respuestasNuevas(visto, 'c1', respuestas) === 0);
  ok('mirar no tilda a nadie', visto.convocatoria.seleccionados.join() === 'luis,sol');
  ok('marcar dos veces devuelve el mismo plantel', asistencia.marcarVistas(visto, 'c1', respuestas) === visto);
  ok(
    'una respuesta que cambia cuenta como nueva',
    asistencia.respuestasNuevas(visto, 'c1', { ...respuestas, luis: true }) === 1
  );
  ok('un link nuevo empieza de cero', asistencia.respuestasNuevas(visto, 'c2', respuestas) === 3);

  const partidoArmado = partido({
    equipoA: ['juan', 'luis'], equipoB: ['sol'], banco: [],
    nombres: { juan: 'Juan', luis: 'Luis', sol: 'Sol' },
  });
  const n = asistencia.novedadesDelPartido(partidoArmado, respuestas, base.jugadores);
  ok('marca al que se bajó del partido', n.seBajaron.join() === 'Luis', n.seBajaron);
  ok('y al que viene pero no está en los equipos', n.quierenJugar.join() === 'ana', n.quierenJugar);

  ok('una lista de uno', asistencia.enLista(['Juan']) === 'Juan');
  ok('una lista de varios', asistencia.enLista(['Pedro', 'Tomi', 'Fede']) === 'Pedro, Tomi y Fede');

  ok('el día que viaja', asistencia.fechaDelDia(new Date(2026, 9, 5, 23, 30)) === '2026-10-05');
  ok('cómo se lee', asistencia.comoSeLeeElDia('2026-10-25') === 'domingo 25 de octubre');

  const jueves = asistencia.atajosDeDia(new Date(2026, 9, 22, 18));
  ok(
    'un jueves ofrece hoy, mañana, sábado y domingo',
    jueves.map((a) => a.etiqueta).join() === 'Hoy,Mañana,Sáb 24,Dom 25',
    jueves.map((a) => a.etiqueta)
  );
  const viernes = asistencia.atajosDeDia(new Date(2026, 9, 23, 18));
  ok(
    'un viernes no repite el sábado de mañana, ni ofrece el de la otra semana',
    viernes.map((a) => a.etiqueta).join() === 'Hoy,Mañana,Dom 25',
    viernes.map((a) => a.etiqueta)
  );
  ok('los atajos arrancan a la medianoche', jueves[0].dia.getHours() === 0);

  const ahora = new Date(2026, 9, 22, 18).getTime();
  ok('recién', asistencia.hace(ahora - 20_000, ahora) === 'recién');
  ok('hace 3 min', asistencia.hace(ahora - 3 * 60_000, ahora) === 'hace 3 min');
  ok('hace 2 h', asistencia.hace(ahora - 125 * 60_000, ahora) === 'hace 2 h');

  const texto = asistencia.textoDeInvitacion('2026-10-25', 'https://x/v/abc');
  ok('la invitación lleva el día y el link', texto.includes('domingo 25 de octubre') && texto.endsWith('https://x/v/abc'), texto);
  const faltan = asistencia.textoParaLosQueFaltan('2026-10-25', ['Pedro', 'Sol'], 'https://x/v/abc');
  ok('el recordatorio nombra a los que faltan', faltan.startsWith('Faltan contestar Pedro y Sol para el fútbol del domingo 25 de octubre'), faltan);
}

// ------------------------------------------------- pedir la plata
titulo('pedir la plata');
{
  const p = partido({
    fecha: new Date(2026, 9, 25, 20).toISOString(),
    equipoA: ['a1', 'a2'], equipoB: ['b1'], banco: [],
    nombres: { a1: 'Juan', a2: 'Pedro', b1: 'Ana' },
    cancha: { total: 30000, pagaron: ['a1'] },
  });
  const texto = cancha.textoParaCobrar(p, 'juan.mp');
  ok('dice cuánto pone cada uno', texto.includes('$10.000 cada uno'), texto);
  ok('el día del partido', texto.includes('domingo 25 de octubre'), texto);
  ok('nombra a los que faltan', texto.includes('Faltan pagar Pedro y Ana'), texto);
  ok('y el alias', texto.endsWith('Alias: juan.mp'), texto);
  ok('sin alias, no lo inventa', !cancha.textoParaCobrar(p).includes('Alias'));
  const uno = cancha.textoParaCobrar({ ...p, cancha: { total: 30000, pagaron: ['a1', 'a2'] } });
  ok('si falta uno solo, en singular', uno.includes('Falta pagar Ana.'), uno);
  ok('si pagaron todos, no hay nada que pedir', cancha.textoParaCobrar({ ...p, cancha: { total: 30000, pagaron: ['a1', 'a2', 'b1'] } }) === null);
  ok('sin cancha, tampoco', cancha.textoParaCobrar(partido()) === null);
}

// ------------------------------------------------- avisar el recordatorio
titulo('avisar que va a llegar el recordatorio');
{
  const sabado = new Date(2026, 9, 24, 20).toISOString();
  ok(
    'el mismo día del partido: mañana',
    recordatorios.avisoDelRecordatorio(sabado, new Date(2026, 9, 24, 12)) === 'Mañana a las 11 te recordamos cargar el resultado.',
    recordatorios.avisoDelRecordatorio(sabado, new Date(2026, 9, 24, 12))
  );
  ok(
    'a la mañana siguiente, antes de las 11: hoy',
    recordatorios.avisoDelRecordatorio(sabado, new Date(2026, 9, 25, 8)) === 'Hoy a las 11 te recordamos cargar el resultado.'
  );
  ok(
    'con días de anticipación, el día escrito',
    recordatorios.avisoDelRecordatorio(sabado, new Date(2026, 9, 21, 8)) === 'El domingo 25 de octubre a las 11 te recordamos cargar el resultado.',
    recordatorios.avisoDelRecordatorio(sabado, new Date(2026, 9, 21, 8))
  );
  ok('si ya pasó, nada', recordatorios.avisoDelRecordatorio(sabado, new Date(2026, 9, 25, 12)) === null);
}


console.log(fallos === 0 ? '\nTodo bien.' : `\n${fallos} mal.`);
process.exit(fallos === 0 ? 0 : 1);
