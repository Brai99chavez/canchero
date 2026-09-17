/**
 * El guardado automático: guardar un plantel solo, traer lo que cambió desde
 * tal momento, y la papelera.
 *
 *     npm run prueba:sync
 *
 * Lo que importa es lo que tiene que ser imposible: pasarse del límite del plan
 * creando de a uno, tocar el plantel de otro, y que las fotos de algo que está
 * en la papelera se borren antes de que se pueda recuperar.
 *
 * Con PRUEBA_API se le puede apuntar a Render, pero de a una: ahí las IP falsas
 * no valen y todas las corridas caen en el mismo balde del límite de intentos.
 */
import pg from 'pg';

const API = process.env.PRUEBA_API ?? 'http://localhost:3000';
const ORIGEN = 'canchero://';
const CLAVE = 'claveLargaSegura1';

let fallos = 0;
const ok = (nombre, condicion, detalle) => {
  if (!condicion) fallos++;
  console.log(`${condicion ? 'OK  ' : 'MAL '} ${nombre}`);
  if (!condicion && detalle) console.log(`       ${String(detalle).slice(0, 160)}`);
};
const titulo = (t) => console.log(`\n— ${t} —`);

const corrida = 1 + Math.floor(Math.random() * 250);
let numeroDeApp = 0;

const base = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true },
  max: 3,
});

async function cuenta(etiqueta) {
  const email = `${etiqueta}-${Date.now()}-${++numeroDeApp}@canchero.test`;
  const ip = `198.18.${corrida}.${numeroDeApp}`;
  let cookie = '';

  const pedir = async (camino, { metodo = 'GET', cuerpo } = {}) => {
    const llevaCuerpo = metodo !== 'GET';
    const r = await fetch(API + camino, {
      method: metodo,
      headers: {
        origin: ORIGEN,
        'x-forwarded-for': ip,
        ...(cookie ? { cookie } : {}),
        ...(llevaCuerpo ? { 'content-type': 'application/json' } : {}),
      },
      body: llevaCuerpo ? JSON.stringify(cuerpo ?? {}) : undefined,
    });
    const set = r.headers.getSetCookie ? r.headers.getSetCookie() : [];
    for (const cruda of set) {
      const par = cruda.split(';')[0];
      if (par.includes('better-auth.session_token=')) cookie = par;
    }
    const texto = await r.text();
    let json = null;
    try {
      json = JSON.parse(texto);
    } catch {}
    return { estado: r.status, json, texto };
  };

  await pedir('/api/auth/sign-up/email', {
    metodo: 'POST',
    cuerpo: { email, password: CLAVE, name: etiqueta },
  });
  await base.query('update "user" set "emailVerified" = true where email = $1', [
    email,
  ]);
  await pedir('/api/auth/sign-in/email', {
    metodo: 'POST',
    cuerpo: { email, password: CLAVE },
  });

  return { email, pedir };
}

const plantel = (nombre, jugadores = []) => ({
  nombre,
  llegada: '2026-01-01T00:00:00.000Z',
  datos: { jugadores, partidos: [] },
});

const luis = await cuenta('sync');
const otro = await cuenta('vecino');

// ══════════════════════════════════════════════════ guardar de a uno
titulo('guardar de a uno');
let r = await luis.pedir('/planteles/p1', {
  metodo: 'PUT',
  cuerpo: plantel('Los del sabado'),
});
ok('se guarda un plantel solo', r.estado === 200, r.texto);
ok('y contesta cuándo quedó guardado', !!r.json?.actualizado, r.texto);
const t1 = r.json?.actualizado;

r = await luis.pedir('/planteles');
ok('viene en la lista', r.json?.planteles?.length === 1, r.texto);
ok('con el nombre puesto', r.json?.planteles?.[0]?.nombre === 'Los del sabado');
ok('y el servidor dice hasta cuándo leyó', !!r.json?.hasta, r.texto);
const hasta1 = r.json?.hasta;

r = await luis.pedir('/planteles/p1', {
  metodo: 'PUT',
  cuerpo: plantel('Renombrado'),
});
ok('guardarlo de nuevo lo pisa', r.estado === 200, r.texto);
r = await luis.pedir('/planteles');
ok('y no lo duplica', r.json?.planteles?.length === 1, r.texto);
ok('con el nombre nuevo', r.json?.planteles?.[0]?.nombre === 'Renombrado');

r = await luis.pedir('/planteles/p1', { metodo: 'PUT', cuerpo: { llegada: 'x' } });
ok('sin nombre se rechaza', r.estado === 400, r.texto);

// ═══════════════════════════════════════════════ traer sólo lo que cambió
titulo('traer sólo lo que cambió');
r = await luis.pedir(`/planteles?desde=${encodeURIComponent(hasta1)}`);
ok('desde el último corte viene el que se tocó', r.json?.planteles?.length === 1, r.texto);

const ahora = (await luis.pedir('/planteles')).json.hasta;
r = await luis.pedir(`/planteles?desde=${encodeURIComponent(ahora)}`);
ok('y si no cambió nada, no viene nada', r.json?.planteles?.length === 0, r.texto);

// ══════════════════════════════════════════════════════ el límite
titulo('el límite del plan');
r = await luis.pedir('/planteles/p2', { metodo: 'PUT', cuerpo: plantel('Trabajo') });
ok('el segundo entra', r.estado === 200, r.texto);

r = await luis.pedir('/planteles/p3', { metodo: 'PUT', cuerpo: plantel('Barrio') });
ok('el tercero no, en el plan gratis', r.estado === 409, r.texto);
ok('y lo dice', r.json?.limite === true, r.texto);

r = await luis.pedir('/planteles/p1', {
  metodo: 'PUT',
  cuerpo: plantel('Los del sabado otra vez'),
});
ok('pero editar uno que ya existe se puede igual', r.estado === 200, r.texto);

r = await luis.pedir('/planteles');
ok('y siguen siendo dos', r.json?.planteles?.length === 2, r.texto);

// ══════════════════════════════════════════════ lo de otro no se toca
titulo('lo de otro no se toca');
r = await otro.pedir('/planteles');
ok('el vecino no ve los míos', r.json?.planteles?.length === 0, r.texto);

r = await otro.pedir('/planteles/p1', { metodo: 'PUT', cuerpo: plantel('Robado') });
ok('puede usar el mismo id sin pisarme', r.estado === 200, r.texto);

r = await luis.pedir('/planteles');
const mio = r.json?.planteles?.find((p) => p.id === 'p1');
ok('y el mío sigue como estaba', mio?.nombre === 'Los del sabado otra vez', r.texto);

// ══════════════════════════════════════════════════════ la papelera
titulo('la papelera');
r = await luis.pedir('/planteles/p2', { metodo: 'DELETE' });
ok('se borra', r.estado === 200, r.texto);

r = await luis.pedir('/planteles');
ok('deja de estar en la lista', r.json?.planteles?.length === 1, r.texto);

r = await luis.pedir('/planteles/papelera');
ok('pero está en la papelera', r.json?.planteles?.length === 1, r.texto);
ok('con su nombre', r.json?.planteles?.[0]?.nombre === 'Trabajo');
ok('y dice cuántos días dura', typeof r.json?.dias === 'number', r.texto);

r = await luis.pedir(`/planteles?desde=${encodeURIComponent(ahora)}`);
const borradoViajo = r.json?.planteles?.some((p) => p.id === 'p2' && p.borrado);
ok('el borrado viaja a los otros teléfonos', borradoViajo === true, r.texto);

r = await luis.pedir('/planteles/p2/restaurar', { metodo: 'POST' });
ok('se puede sacar de la papelera', r.estado === 200, r.texto);
r = await luis.pedir('/planteles');
ok('y vuelve a la lista', r.json?.planteles?.length === 2, r.texto);
r = await luis.pedir('/planteles/papelera');
ok('y deja la papelera vacía', r.json?.planteles?.length === 0, r.texto);

r = await otro.pedir('/planteles/p2/restaurar', { metodo: 'POST' });
ok('el vecino no puede restaurar lo mío', r.estado === 404, r.texto);

// ════════════════════════════════════ restaurar no se pasa del límite
/*
 * Se usa p9, que nunca se recuperó. Con p2 no serviría: ya salió de la
 * papelera una vez en la sección anterior, así que lo frenaría el cooldown y
 * esto pasaría sin probar el límite, que es lo que dice el título.
 */
titulo('restaurar no se pasa del límite');
await luis.pedir('/planteles/p2', { metodo: 'DELETE' });
await luis.pedir('/planteles/p9', { metodo: 'PUT', cuerpo: plantel('Nunca vuelto') });
await luis.pedir('/planteles/p9', { metodo: 'DELETE' });
r = await luis.pedir('/planteles/p3', { metodo: 'PUT', cuerpo: plantel('Barrio') });
ok('con la papelera con algo adentro entra otro nuevo', r.estado === 200, r.texto);

r = await luis.pedir('/planteles/p9/restaurar', { metodo: 'POST' });
ok('y ahí ya no se puede restaurar el de la papelera', r.estado === 409, r.texto);
ok('y lo dice', r.json?.limite === true, r.texto);
ok('sin confundirlo con el que ya volvió', r.json?.espera !== true, r.texto);

// ═══════════════════════════════════════════ la papelera tiene tope
/*
 * El tope está por el costo: sin él se puede borrar y crear sin parar y juntar
 * todo lo que uno quiera, guardado de a treinta días, sin pasarse nunca del
 * límite de planteles activos.
 */
titulo('la papelera tiene tope');
{
  /*
   * Quedan p1 y p3 vivos, y p9 en la papelera. p2 no está: se había
   * recuperado, así que su segundo borrado fue definitivo y de él quedó sólo
   * la lápida, que no cuenta como estar en la papelera.
   */
  r = await luis.pedir('/planteles/papelera');
  const tope = r.json?.tope;
  ok('el servidor dice cuántos guarda', typeof tope === 'number', r.texto);
  ok('y en el plan gratis guarda cinco', tope === 5, r.texto);

  /*
   * Se la llena y se la pasa por varios, sin depender del número: si el tope
   * cambia, esto se acomoda solo en vez de romperse.
   */
  await luis.pedir('/planteles/p3', { metodo: 'DELETE' });
  const echados = [];
  for (let i = 0; i <= tope; i++) {
    const id = `t${i}`;
    await luis.pedir(`/planteles/${id}`, {
      metodo: 'PUT',
      cuerpo: plantel(`Descarte ${i}`),
    });
    await luis.pedir(`/planteles/${id}`, { metodo: 'DELETE' });
    echados.push(id);
  }

  r = await luis.pedir('/planteles/papelera');
  const dentro = (r.json?.planteles ?? []).map((p) => p.id);
  ok('nunca pasa del tope', dentro.length === tope, `quedaron ${dentro.length}`);
  // El que entra empuja afuera al más viejo: quedan los últimos que borraste,
  // del más nuevo al más viejo.
  ok(
    'y quedan los últimos que borraste',
    dentro.join() === echados.slice(-tope).reverse().join(),
    dentro.join()
  );

  // p9 era el más viejo de la papelera: lo empujaron afuera los que entraron
  // después. Se fue de la base entera, no a otro lado.
  r = await luis.pedir('/planteles/p9/restaurar', { metodo: 'POST' });
  ok('el que salió de la papelera no se puede recuperar', r.estado === 404, r.texto);

  const { rows: quedan } = await base.query(
    `select count(*)::int as n from planteles
      where id = 'p9' and dueno = (select id from "user" where email = $1)`,
    [luis.email]
  );
  ok('y no quedó ocupando lugar en la base', quedan[0].n === 0);

  // Y vuelve cualquiera de los que quedaron, no sólo el último que borraste.
  const masViejo = dentro[dentro.length - 1];
  r = await luis.pedir(`/planteles/${masViejo}/restaurar`, { metodo: 'POST' });
  ok('cualquiera de los que quedaron vuelve', r.estado === 200, r.texto);
}

// ═══════════════════════════════ de la papelera se saca una sola vez
/*
 * Lo que impide usar la papelera para tener más planteles de los que el plan
 * deja. La maniobra: borrar uno de los activos, recuperar uno guardado, usarlo,
 * borrarlo y recuperar el siguiente. Rotando así se usan todos los que haya, de
 * a dos por vez, con un plan de dos.
 *
 * Al sacarlo una vez, el próximo borrado de ese plantel es definitivo. La app
 * lo avisa antes; acá se prueba que el servidor lo cumpla.
 */
titulo('de la papelera se saca una sola vez');
{
  // Vivos p1 y t1, que acaba de salir de la papelera. Adentro quedan t2 a t5.
  r = await luis.pedir('/planteles/t1', { metodo: 'DELETE' });
  ok('se vuelve a borrar el que ya habías recuperado', r.estado === 200, r.texto);
  ok('y el servidor avisa que fue definitivo', r.json?.definitivo === true, r.texto);

  r = await luis.pedir('/planteles/papelera');
  ok(
    'no vuelve a la papelera',
    !(r.json?.planteles ?? []).some((p) => p.id === 't1'),
    r.texto
  );

  r = await luis.pedir('/planteles/t1/restaurar', { metodo: 'POST' });
  ok('y no se lo puede recuperar', r.estado === 404, r.texto);

  /*
   * De la fila queda la lápida: vacía, pero marcada como borrada. Es lo único
   * que hace que los otros teléfonos se enteren — si desapareciera del todo lo
   * darían por vivo y lo volverían a subir.
   */
  const { rows: lapida } = await base.query(
    `select borrado, datos from planteles
      where id = 't1' and dueno = (select id from "user" where email = $1)`,
    [luis.email]
  );
  ok(
    'los jugadores y los partidos se fueron',
    JSON.stringify(lapida[0]?.datos) === '{}',
    JSON.stringify(lapida[0]?.datos)
  );
  ok('pero el borrado viaja a los otros teléfonos', lapida[0]?.borrado === true);

  // Y el que nunca salió se recupera como siempre.
  r = await luis.pedir('/planteles/t2/restaurar', { metodo: 'POST' });
  ok('el que nunca salió se recupera normal', r.estado === 200, r.texto);
}

// ══════════════════════ el borrado definitivo se lleva las fotos
titulo('el borrado definitivo se lleva las fotos');
{
  const { limpiarHuerfanas } = await import('./src/fotos.js');
  const pixel = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );
  const permiso = await luis.pedir('/fotos/permiso', {
    metodo: 'POST',
    cuerpo: { tipo: 'image/png' },
  });
  await fetch(permiso.json.url, {
    method: 'PUT',
    headers: { 'content-type': 'image/png' },
    body: pixel,
  });
  const foto = permiso.json.publica;

  // Hace lugar y crea uno con foto.
  await luis.pedir('/planteles/t2', { metodo: 'DELETE' });
  await luis.pedir('/planteles/conFoto', {
    metodo: 'PUT',
    cuerpo: plantel('Con foto', [{ id: 'j1', nombre: 'Rodri', foto }]),
  });

  // Primer borrado: a la papelera, y de ahí se saca.
  await luis.pedir('/planteles/conFoto', { metodo: 'DELETE' });
  r = await luis.pedir('/planteles/conFoto/restaurar', { metodo: 'POST' });
  ok('sale de la papelera', r.estado === 200, r.texto);

  // Segundo borrado: definitivo.
  r = await luis.pedir('/planteles/conFoto', { metodo: 'DELETE' });
  ok('el segundo borrado es definitivo', r.json?.definitivo === true, r.texto);

  /*
   * Se fuerza el barrido con el margen en negativo. En el servidor hay quince
   * minutos de gracia para no borrar una foto que se está subiendo justo
   * ahora; acá la foto es de hace un segundo y sin esto no le tocaría.
   */
  const { rows: dueno } = await base.query(
    'select id from "user" where email = $1',
    [luis.email]
  );
  const { rows: vivos } = await base.query(
    'select datos from planteles where dueno = $1',
    [dueno[0].id]
  );
  const usadas = [];
  for (const f of vivos) {
    for (const j of f.datos?.jugadores ?? []) {
      if (typeof j?.foto === 'string') usadas.push(j.foto);
    }
  }
  ok('la foto deja de estar referenciada', !usadas.includes(foto));

  await limpiarHuerfanas(dueno[0].id, usadas, -1);
  const sigue = await fetch(foto);
  ok('y se va de R2', sigue.status === 404, `HTTP ${sigue.status}`);
}

// ════════════════════════════════════ lo que pasó el plazo no vuelve
/*
 * Vaciar lo viejo corre cuando alguien borra algo, no con un reloj: una cuenta
 * quieta puede tener adentro cosas de hace meses. Si el plazo se controlara
 * sólo al vaciar, esas se podrían recuperar y los treinta días serían mentira.
 */
titulo('lo que pasó el plazo no vuelve');
{
  const { rows: dueno } = await base.query(
    'select id from "user" where email = $1',
    [luis.email]
  );
  await base.query(
    `update planteles set borrado_en = now() - interval '200 days'
      where dueno = $1 and id = $2`,
    [dueno[0].id, 't3']
  );

  r = await luis.pedir('/planteles/papelera');
  ok(
    'lo vencido no figura en la papelera',
    !(r.json?.planteles ?? []).some((p) => p.id === 't3'),
    r.texto
  );

  r = await luis.pedir('/planteles/t3/restaurar', { metodo: 'POST' });
  ok('y tampoco se puede recuperar', r.estado === 404, r.texto);
}

// ═════════════════════════════ ninguna lectura se pierde un guardado
titulo('ninguna lectura se pierde un guardado');
{
  /*
   * El corte que devuelve `/planteles` se toma antes de leer las filas. Si se
   * tomara después habría una ventana: lo guardado ahí en el medio no sale en
   * las filas y encima queda con fecha anterior al corte, así que no lo trae
   * ningún `?desde=` nunca más.
   *
   * Se prueba guardando y leyendo a la vez, muchas veces. Es una prueba de
   * carrera: puede no pegarle al hueco en una corrida, pero nunca falla si el
   * código está bien.
   */
  let corte = (await luis.pedir('/planteles')).json.hasta;
  let visto = null;
  const vueltas = 25;

  for (let i = 0; i < vueltas; i++) {
    const [, lectura] = await Promise.all([
      luis.pedir('/planteles/p1', { metodo: 'PUT', cuerpo: plantel(`carrera-${i}`) }),
      luis.pedir(`/planteles?desde=${encodeURIComponent(corte)}`),
    ]);
    corte = lectura.json?.hasta ?? corte;
    const traido = lectura.json?.planteles?.find((p) => p.id === 'p1');
    if (traido) visto = traido.nombre;
  }

  const final = await luis.pedir(`/planteles?desde=${encodeURIComponent(corte)}`);
  const ultimo = final.json?.planteles?.find((p) => p.id === 'p1');
  const llego = ultimo?.nombre ?? visto;
  ok(
    'el último guardado llega igual leyendo al mismo tiempo',
    llego === `carrera-${vueltas - 1}`,
    `llegó ${llego}`
  );
}

// ══════════════════════════════ las fotos de la papelera no se barren
titulo('las fotos de la papelera no se barren');
{
  const pixel = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );
  const permiso = await luis.pedir('/fotos/permiso', {
    metodo: 'POST',
    cuerpo: { tipo: 'image/png' },
  });
  await fetch(permiso.json.url, {
    method: 'PUT',
    headers: { 'content-type': 'image/png' },
    body: pixel,
  });
  const foto = permiso.json.publica;

  // Un plantel con foto, y después a la papelera.
  await luis.pedir('/planteles/p1', {
    metodo: 'PUT',
    cuerpo: plantel('Con foto', [{ id: 'j1', nombre: 'Rodri', foto }]),
  });
  await luis.pedir('/planteles/p1', { metodo: 'DELETE' });

  // Se fuerza el barrido con el margen en negativo, como en prueba:limpieza.
  const { limpiarHuerfanas } = await import('./src/fotos.js');
  const { rows } = await base.query(
    'select id from "user" where email = $1',
    [luis.email]
  );
  const { rows: vivos } = await base.query(
    'select datos from planteles where dueno = $1',
    [rows[0].id]
  );
  const usadas = [];
  for (const f of vivos) {
    for (const j of f.datos?.jugadores ?? []) {
      if (typeof j?.foto === 'string') usadas.push(j.foto);
    }
  }
  await limpiarHuerfanas(rows[0].id, usadas, -1);

  const sigue = await fetch(foto);
  ok('la foto de lo que está en la papelera sigue estando', sigue.ok, `HTTP ${sigue.status}`);
}

// ══════════════════════════════════════════════════════════ barrido
titulo('barrido');
try {
  const { rowCount } = await base.query(
    `delete from "user" where email like '%@canchero.test'`
  );
  ok(`se borraron las ${rowCount} cuentas de prueba`, true);
} catch (error) {
  ok('se borran las cuentas de prueba', false, error.message);
} finally {
  await base.end();
}

console.log('');
console.log(fallos === 0 ? 'listo, todo en verde.' : `${fallos} fallaron.`);
process.exit(fallos === 0 ? 0 : 1);
