// Prueba el camino completo de una foto contra Render + R2.
const API = 'https://canchero.onrender.com';
const mail = `foto-${Date.now()}@canchero.test`;
const clave = 'unaClaveLarga123';
let cookie = '';
const ok = (n, c) => console.log(`${c ? 'OK  ' : 'MAL '} ${n}`);

async function pedir(camino, opciones = {}) {
  const r = await fetch(API + camino, {
    method: opciones.metodo ?? 'GET',
    headers: {
      origin: 'canchero://',
      ...(cookie ? { cookie } : {}),
      ...(opciones.cuerpo ? { 'content-type': 'application/json' } : {}),
    },
    body: opciones.cuerpo ? JSON.stringify(opciones.cuerpo) : undefined,
  });
  const set = r.headers.get('set-cookie');
  if (set) cookie = set.split(';')[0];
  const texto = await r.text();
  let cuerpo = null;
  try { cuerpo = JSON.parse(texto); } catch {}
  return { estado: r.status, cuerpo, texto };
}

// Un PNG de 1x1 real, para tener bytes de verdad.
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

let r = await pedir('/fotos/permiso', { metodo: 'POST', cuerpo: { tipo: 'image/png' } });
ok('sin sesion no da permiso', r.estado === 401);

await pedir('/api/auth/sign-up/email', {
  metodo: 'POST', cuerpo: { email: mail, password: clave, name: 'Foto' },
});

r = await pedir('/fotos/permiso', { metodo: 'POST', cuerpo: { tipo: 'image/gif' } });
ok('formato no soportado rechazado', r.estado === 400);

r = await pedir('/fotos/permiso', { metodo: 'POST', cuerpo: { tipo: 'image/png' } });
ok('da permiso de subida', r.estado === 200 && !!r.cuerpo?.url);
if (r.estado !== 200) { console.log('   ->', r.texto.slice(0, 300)); process.exit(1); }

const { url, publica, key } = r.cuerpo;
ok('la key arranca con el id de la cuenta', typeof key === 'string' && key.includes('/jugadores/'));

const subida = await fetch(url, {
  method: 'PUT', headers: { 'content-type': 'image/png' }, body: png,
});
ok('sube a R2', subida.ok);
if (!subida.ok) console.log('   ->', subida.status, (await subida.text()).slice(0, 200));

// Y se puede mirar por la URL publica.
const vista = await fetch(publica);
const bytes = vista.ok ? Buffer.from(await vista.arrayBuffer()) : null;
ok('se ve por la URL publica', vista.ok);
ok('llega el mismo archivo', !!bytes && bytes.equals(png));

// El plantel la lleva en el backup.
await pedir('/planteles', { metodo: 'PUT', cuerpo: { planteles: [{
  id: 'pf1', nombre: 'Con fotos', llegada: '2026-01-01T00:00:00.000Z',
  datos: { jugadores: [{ id: 'j1', nombre: 'Rodri', foto: publica }], partidos: [] },
}]}});
r = await pedir('/planteles');
ok('la foto viaja en el backup',
   r.cuerpo?.planteles?.[0]?.datos?.jugadores?.[0]?.foto === publica);

// Borrar: sólo lo propio.
r = await pedir('/fotos/borrar', { metodo: 'POST', cuerpo: { urls: [publica] } });
ok('borra la foto propia', r.estado === 200);
const despues = await fetch(publica);
ok('ya no se ve', !despues.ok);

await pedir('/planteles/pf1', { metodo: 'DELETE' });
console.log('');
console.log('listo.');
