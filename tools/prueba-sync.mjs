/**
 * Lo que tiene que resolver el final de una vuelta de sincronización: juntar
 * lo que ella trajo con lo que se hizo en el teléfono mientras corría.
 *
 *     node tools/prueba-sync.mjs
 *
 * Compila `src/nube/juntar.ts` a una carpeta temporal y corre esto contra el
 * resultado. No toca nada del proyecto.
 *
 * No es un script de package.json a propósito: los scripts entran en la huella
 * del runtime, y agregar uno hace que el APK que ya está instalado deje de
 * recibir las actualizaciones por EAS hasta sacar otro.
 */
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const SALIDA = process.env.PRUEBA_OUT ?? join(process.cwd(), '.tmp-prueba');
execSync(
  `npx tsc src/nube/juntar.ts src/types.ts --ignoreConfig --outDir "${SALIDA}" ` +
    '--module commonjs --target es2019 --skipLibCheck',
  { stdio: 'inherit' }
);
const { juntarConLoDeAhora } = require(join(SALIDA, 'nube', 'juntar.js'));

let fallos = 0;
const ok = (nombre, condicion) => {
  if (!condicion) fallos++;
  console.log(`${condicion ? 'OK  ' : 'MAL '} ${nombre}`);
};

const jugador = (id, foto) => ({
  id,
  nombre: id,
  posicion: 'MED',
  stats: {
    pases: 50,
    regate: 50,
    definicion: 50,
    posicionamiento: 50,
    resistencia: 50,
  },
  foto,
});

const plantel = (id, cambios = {}) => ({
  id,
  nombre: id,
  llegada: '2026-10-01T00:00:00.000Z',
  actualizado: '2026-10-19T10:00:00.000Z',
  jugadores: [],
  partidos: [],
  convocatoria: { formato: 5, seleccionados: [], usarTodos: false },
  sorteo: null,
  ...cambios,
});

const LOCAL = 'file:///fotos/juan.jpg';
const URL_R2 = 'https://fotos.canchero.app/p1/juan.jpg';

// ----------------------------------------------------------- el caso del bug
console.log('\n— se arma y se guarda el partido mientras la vuelta corre —');
{
  const ids = ['juan', 'pedro', 'luis', 'ana', 'sol', 'tomi', 'fede'];
  const recienCargado = plantel('p1', {
    jugadores: ids.map((id) => jugador(id, id === 'juan' ? LOCAL : undefined)),
    convocatoria: { formato: 5, seleccionados: ids, usarTodos: false },
  });
  const antes = [recienCargado];

  // Lo que la vuelta devuelve: subió la foto de Juan, y el servidor le
  // contestó con el mismo plantel (es el que este teléfono acaba de subir).
  const despues = [
    {
      ...recienCargado,
      jugadores: recienCargado.jugadores.map((j) =>
        j.id === 'juan' ? { ...j, foto: URL_R2 } : j
      ),
    },
  ];

  // Mientras tanto: «Todos», armar equipos y guardar el partido.
  const partido = {
    id: 'm1',
    fecha: '2026-10-19T20:00:00.000Z',
    formato: 5,
    equipoA: ids.slice(0, 4),
    equipoB: ids.slice(4),
    banco: [],
    nombres: Object.fromEntries(ids.map((id) => [id, id])),
    golesA: null,
    golesB: null,
    actuaciones: [],
  };
  const ahora = [
    {
      ...recienCargado,
      actualizado: '2026-10-19T10:00:30.000Z',
      convocatoria: { ...recienCargado.convocatoria, usarTodos: true },
      sorteo: {
        equipoA: partido.equipoA,
        equipoB: partido.equipoB,
        banco: [],
        partidoId: 'm1',
      },
      partidos: [partido],
    },
  ];

  // Lo que hacía la app antes: quedarse con lo que devolvió la vuelta.
  ok(
    'pisar con lo de la vuelta pierde el partido (el bug)',
    despues[0].partidos.length === 0
  );

  const [p] = juntarConLoDeAhora(antes, despues, ahora);
  ok('el partido sigue estando', p.partidos.length === 1 && p.partidos[0].id === 'm1');
  ok('y sigue sin resultado, o sea en Activos', p.partidos[0].golesA === null);
  ok('«Todos» sigue elegido', p.convocatoria.usarTodos === true);
  ok('el sorteo sigue apuntando al partido', p.sorteo?.partidoId === 'm1');
  ok(
    'la fecha de cambio es la de ahora, así la próxima vuelta lo sube',
    p.actualizado === '2026-10-19T10:00:30.000Z'
  );
  ok(
    'la foto que ya subió queda con su URL',
    p.jugadores.find((j) => j.id === 'juan').foto === URL_R2
  );
}

// -------------------------------------------------------- sin tocar nada
console.log('\n— nadie tocó nada durante la vuelta —');
{
  const antes = [plantel('p1')];
  const despues = [plantel('p1', { nombre: 'Cambiado en otro teléfono' })];
  ok(
    'vale lo de la vuelta, el mismo arreglo',
    juntarConLoDeAhora(antes, despues, antes) === despues
  );
}

// ----------------------------------------------- uno tocado y otro no
console.log('\n— se tocó un plantel y el otro no —');
{
  const quieto = plantel('quieto');
  const tocado = plantel('tocado', { llegada: '2026-10-02T00:00:00.000Z' });
  const antes = [quieto, tocado];
  const despues = [
    { ...quieto, nombre: 'Cambiado en otro teléfono' },
    { ...tocado },
  ];
  const ahora = [quieto, { ...tocado, nombre: 'Cambiado acá' }];

  const juntos = juntarConLoDeAhora(antes, despues, ahora);
  ok(
    'el que no se tocó trae lo del otro teléfono',
    juntos.find((p) => p.id === 'quieto').nombre === 'Cambiado en otro teléfono'
  );
  ok(
    'el que se tocó queda como está acá',
    juntos.find((p) => p.id === 'tocado').nombre === 'Cambiado acá'
  );
}

// --------------------------------------------------- altas y bajas en el medio
console.log('\n— planteles que aparecen y desaparecen durante la vuelta —');
{
  const viejo = plantel('viejo');
  const antes = [viejo];
  const nuevoAca = plantel('nuevo-aca', { llegada: '2026-10-19T10:00:10.000Z' });
  const ahora = [viejo, nuevoAca];
  const deOtroTelefono = plantel('de-otro', { llegada: '2026-10-05T00:00:00.000Z' });
  const despues = [{ ...viejo }, deOtroTelefono];

  const juntos = juntarConLoDeAhora(antes, despues, ahora);
  ok('el creado durante la vuelta se queda', juntos.some((p) => p.id === 'nuevo-aca'));
  ok('el que llegó de otro teléfono entra', juntos.some((p) => p.id === 'de-otro'));
  ok(
    'quedan ordenados por llegada',
    juntos.map((p) => p.id).join(',') === 'viejo,de-otro,nuevo-aca'
  );
}
{
  const borrado = plantel('borrado');
  const queda = plantel('queda');
  const antes = [borrado, queda];
  const despues = [{ ...borrado }, { ...queda }];
  const ahora = [queda];
  const juntos = juntarConLoDeAhora(antes, despues, ahora);
  ok(
    'el que se borró acá durante la vuelta no vuelve',
    !juntos.some((p) => p.id === 'borrado')
  );
}
{
  const borradoAfuera = plantel('borrado-afuera');
  const otro = plantel('otro');
  const antes = [borradoAfuera, otro];
  const ahora = [borradoAfuera, { ...otro, nombre: 'tocado' }];
  // La vuelta lo sacó porque en otro teléfono lo mandaron a la papelera.
  const despues = [{ ...otro }];
  const juntos = juntarConLoDeAhora(antes, despues, ahora);
  ok(
    'el que se borró en otro teléfono y acá no se tocó, se va',
    !juntos.some((p) => p.id === 'borrado-afuera')
  );
}
{
  // Un envío aceptado mientras corría la vuelta: el servidor ya lo tiene y
  // la vuelta lo trae, pero acá también se agregó.
  const antes = [plantel('a')];
  const aceptado = plantel('aceptado', { llegada: '2026-10-19T10:00:05.000Z' });
  const ahora = [...antes, aceptado];
  const despues = [{ ...antes[0] }, { ...aceptado }];
  const juntos = juntarConLoDeAhora(antes, despues, ahora);
  ok(
    'uno que está acá y también vino del servidor no se duplica',
    juntos.filter((p) => p.id === 'aceptado').length === 1
  );
}

// ------------------------------------------------------------------ fotos
console.log('\n— fotos —');
{
  const conFoto = plantel('p1', { jugadores: [jugador('juan', LOCAL)] });
  const antes = [conFoto];
  const despues = [{ ...conFoto, jugadores: [jugador('juan', URL_R2)] }];
  const otraFoto = 'file:///fotos/juan-2.jpg';
  const ahora = [{ ...conFoto, jugadores: [jugador('juan', otraFoto)] }];
  const [p] = juntarConLoDeAhora(antes, despues, ahora);
  ok(
    'si le cambiaron la foto durante la vuelta, manda la nueva',
    p.jugadores[0].foto === otraFoto
  );
}
{
  const conFoto = plantel('p1', { jugadores: [jugador('juan', LOCAL)] });
  const antes = [conFoto];
  const despues = [{ ...conFoto, jugadores: [jugador('juan', URL_R2)] }];
  const ahora = [
    { ...conFoto, jugadores: [jugador('juan', LOCAL), jugador('nuevo', LOCAL)] },
  ];
  const [p] = juntarConLoDeAhora(antes, despues, ahora);
  ok(
    'un jugador cargado durante la vuelta no se lleva una foto ajena',
    p.jugadores.find((j) => j.id === 'nuevo').foto === LOCAL
  );
}
{
  // En otro teléfono lo sacaron del plantel; acá se tocó el plantel y Juan
  // sigue, así que sigue con su foto.
  const conFoto = plantel('p1', { jugadores: [jugador('juan', URL_R2)] });
  const antes = [conFoto];
  const despues = [{ ...conFoto, jugadores: [] }];
  const ahora = [{ ...conFoto, nombre: 'tocado' }];
  const [p] = juntarConLoDeAhora(antes, despues, ahora);
  ok(
    'el que la vuelta no trae no pierde la foto',
    p.jugadores[0].foto === URL_R2
  );
}

console.log(fallos === 0 ? '\nTodo bien.' : `\n${fallos} mal.`);
process.exit(fallos === 0 ? 0 : 1);
