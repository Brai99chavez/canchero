/**
 * Los casos que tiene que resolver la media corregida por resultados.
 *
 *     npm run prueba:elo
 *
 * El script compila `src/elo.ts` y `src/balance.ts` a una carpeta temporal y
 * corre esto contra el resultado. No toca nada del proyecto.
 */
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const SALIDA = process.env.PRUEBA_OUT ?? join(process.cwd(), '.tmp-prueba');
const { ajustesDe, topeDe, elosDe } = require(join(SALIDA, 'elo.js'));
const { buildTeams } = require(join(SALIDA, 'balance.js'));

let fallos = 0;
const ok = (nombre, condicion) => {
  if (!condicion) fallos++;
  console.log(`${condicion ? 'OK  ' : 'MAL '} ${nombre}`);
};

const jugador = (id, media, posicion = 'MED') => ({
  id,
  nombre: id,
  posicion,
  stats: {
    pases: media,
    regate: media,
    definicion: media,
    posicionamiento: media,
    resistencia: media,
  },
});

let fecha = 0;
const partido = (equipoA, equipoB, golesA, golesB) => ({
  id: `m${fecha++}`,
  fecha: new Date(2026, 0, 1 + fecha * 7).toISOString(),
  formato: 5,
  equipoA,
  equipoB,
  nombres: {},
  golesA,
  golesB,
  actuaciones: [],
});

const repetir = (veces, f) => Array.from({ length: veces }, (_, i) => f(i));

// --------------------------------------------------------------- los topes
console.log('\n— cuánto se le permite moverse —');
ok('con 4 partidos no opina', topeDe(4) === 0);
ok('con 10 se mueve hasta 3', topeDe(10) === 3);
ok('con 20, hasta 6', topeDe(20) === 6);
ok('con 50, hasta 8', topeDe(50) === 8);

// ------------------------------------------------- el bueno que hace perder
console.log('\n— el que juega bien pero el equipo pierde —');
{
  const plantel = [jugador('bueno', 81), ...repetir(9, (i) => jugador(`p${i}`, 70))];
  fecha = 0;
  const partidos = repetir(25, () =>
    partido(['bueno', 'p0', 'p1', 'p2', 'p3'], ['p4', 'p5', 'p6', 'p7', 'p8'], 1, 3)
  );
  const a = ajustesDe(plantel, partidos);
  console.log(`     ${a.bueno.base} -> ${a.bueno.elo} (${a.bueno.ajuste})`);
  ok('baja', a.bueno.ajuste < 0);
  ok('no se pasa del tope', Math.abs(a.bueno.ajuste) <= a.bueno.tope);
}

// ------------------------------------------------------ el que lo llevan
console.log('\n— el que gana porque lo llevan de arrastre —');
{
  const plantel = [
    jugador('llevado', 60),
    jugador('sufrido', 60),
    ...repetir(4, (i) => jugador(`crack${i}`, 90)),
    ...repetir(4, (i) => jugador(`flojo${i}`, 60)),
  ];
  fecha = 0;
  const partidos = repetir(25, () =>
    partido(
      ['llevado', 'crack0', 'crack1', 'crack2', 'crack3'],
      ['flojo0', 'flojo1', 'flojo2', 'flojo3', 'sufrido'],
      3,
      1
    )
  );
  const a = ajustesDe(plantel, partidos);
  console.log(`     llevado ${a.llevado.base} -> ${a.llevado.elo} (${a.llevado.ajuste})`);
  console.log(`     sufrido ${a.sufrido.base} -> ${a.sufrido.elo} (${a.sufrido.ajuste})`);
  ok('ganar siendo muy favorito casi no suma', Math.abs(a.llevado.ajuste) <= 2);
  ok('perder contra un equipo superior casi no resta', Math.abs(a.sufrido.ajuste) <= 2);
}

// -------------------------------------------------- ganar partidos peleados
console.log('\n— el que gana contra equipos parejos —');
{
  const plantel = [jugador('merito', 60), ...repetir(9, (i) => jugador(`r${i}`, 60))];
  fecha = 0;
  const partidos = repetir(25, () =>
    partido(['merito', 'r0', 'r1', 'r2', 'r3'], ['r4', 'r5', 'r6', 'r7', 'r8'], 3, 1)
  );
  const a = ajustesDe(plantel, partidos);
  console.log(`     ${a.merito.base} -> ${a.merito.elo} (${a.merito.ajuste})`);
  ok('ganar peleado sí suma', a.merito.ajuste >= 4);
}

// ------------------------------------------------------- pocos partidos
console.log('\n— sin datos no inventa —');
{
  const plantel = [jugador('nuevo', 75), ...repetir(9, (i) => jugador(`s${i}`, 75))];
  fecha = 0;
  const partidos = repetir(3, () =>
    partido(['nuevo', 's0', 's1', 's2', 's3'], ['s4', 's5', 's6', 's7', 's8'], 0, 6)
  );
  const a = ajustesDe(plantel, partidos);
  ok('con 3 partidos no mueve nada', a.nuevo.ajuste === 0);
  ok('y muestra la media que cargaste', a.nuevo.elo === a.nuevo.base);
}

// --------------------------------------------------------- lo usa el sorteo
console.log('\n— el sorteo lo tiene en cuenta —');
{
  const plantel = [jugador('inflado', 85), ...repetir(9, (i) => jugador(`t${i}`, 70))];
  fecha = 0;
  const partidos = repetir(25, () =>
    partido(['inflado', 't0', 't1', 't2', 't3'], ['t4', 't5', 't6', 't7', 't8'], 0, 3)
  );
  const elo = elosDe(plantel, partidos);
  ok('el sorteo acepta el número corregido', typeof elo.inflado === 'number');
  const split = buildTeams(plantel, 5, { elo });
  ok('y sigue armando dos equipos', split.teamA.length === 5 && split.teamB.length === 5);
}

console.log('');
console.log(fallos === 0 ? 'listo, todo en verde.' : `${fallos} fallaron.`);
process.exit(fallos === 0 ? 0 : 1);
