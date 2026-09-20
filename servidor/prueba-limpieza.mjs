import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import {
  borrarLasFotosDe,
  borrarLasFotosDelPlantel,
  hayFotos,
  limpiarHuerfanas,
  permisoDeSubida,
} from './src/fotos.js';

/*
 * Las fotos en R2, que estan acomodadas asi:
 *
 *     {cuenta}/perfil/{azar}.jpg
 *     {cuenta}/{plantel}/{azar}.jpg
 *
 * Lo que se prueba es que cada nivel de borrado se lleve exactamente lo suyo:
 * un plantel su carpeta, una cuenta la suya, y el barrido de huerfanas solo lo
 * que ya no referencia nadie.
 */
const ok = (n, c) => console.log(`${c ? 'OK  ' : 'MAL '} ${n}`);
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

ok('la nube de fotos esta configurada', hayFotos);
const usuario = `prueba-limpieza-${Date.now()}`;
const otro = `${usuario}-vecino`;
const UNO = 'plantel-uno';
const DOS = 'plantel-dos';

async function subir(quien, destino) {
  const p = await permisoDeSubida(quien, 'image/png', destino);
  const r = await fetch(p.url, {
    method: 'PUT',
    headers: { 'content-type': 'image/png' },
    body: png,
  });
  if (!r.ok) throw new Error('no subio: ' + r.status);
  return p;
}

const cliente = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});
const cuantas = async (prefijo) => {
  const r = await cliente.send(
    new ListObjectsV2Command({ Bucket: process.env.R2_BUCKET, Prefix: prefijo })
  );
  return (r.Contents ?? []).length;
};

// --- donde cae cada cosa -----------------------------------------------

const usada = await subir(usuario, UNO);
const suelta = await subir(usuario, UNO); // esta no la referencia nadie
const deDos = await subir(usuario, DOS);
const perfil = await subir(usuario, 'perfil');
const delVecino = await subir(otro, UNO);

ok('la foto de un plantel cae en su carpeta',
  usada.key.startsWith(`${usuario}/${UNO}/`) && deDos.key.startsWith(`${usuario}/${DOS}/`));
ok('la del perfil cae en perfil', perfil.key.startsWith(`${usuario}/perfil/`));
ok('subieron todas',
  (await cuantas(`${usuario}/`)) === 4 && (await cuantas(`${otro}/`)) === 1);

// Destinos que no existen: nadie puede escribir fuera de su carpeta ni pisar
// el logo de los mails.
for (const malo of [undefined, '', 'con/barra', '..', 'publico/logo', 'a'.repeat(65)]) {
  const fallo = await permisoDeSubida(usuario, 'image/png', malo).then(
    () => false,
    (e) => e.status === 400
  );
  ok(`rechaza el destino ${JSON.stringify(malo)}`, fallo);
}
ok('el vecino no puede escribir en mi carpeta',
  !delVecino.key.startsWith(`${usuario}/`));

// --- el barrido de huerfanas -------------------------------------------

let n = await limpiarHuerfanas(usuario, [usada.publica, deDos.publica]);
ok('el margen protege lo recien subido', n === 0 && (await cuantas(`${usuario}/`)) === 4);

/*
 * Margen negativo, y no cero, para pedir que barra tambien lo recien subido.
 *
 * Con cero el limite es la hora de esta maquina, y el reloj de R2 puede ir
 * unos segundos adelantado: la foto queda fechada en el futuro, nunca entra
 * en el barrido y la prueba fallaba sin que hubiera nada roto. En produccion
 * el margen son 15 minutos, asi que unos segundos de diferencia no cambian
 * nada; es esta prueba la que necesita que el margen no exista.
 */
const SIN_MARGEN = -1;
n = await limpiarHuerfanas(usuario, [usada.publica, deDos.publica], SIN_MARGEN);
ok('borra la huerfana', n === 1 && (await cuantas(`${usuario}/${UNO}/`)) === 1);
ok('deja las que estan en uso', (await cuantas(`${usuario}/${DOS}/`)) === 1);
ok('no toca la del perfil', (await cuantas(`${usuario}/perfil/`)) === 1);
ok('no toca las del vecino', (await cuantas(`${otro}/`)) === 1);

// --- borrar un plantel se lleva su carpeta -----------------------------

// Una foto que subio pero que ningun plantel llego a nombrar: por lista no se
// iria nunca, y por prefijo se va igual.
await subir(usuario, UNO);
n = await borrarLasFotosDelPlantel(usuario, UNO);
ok('el plantel se lleva su carpeta entera',
  n === 2 && (await cuantas(`${usuario}/${UNO}/`)) === 0);
ok('y no toca el otro plantel', (await cuantas(`${usuario}/${DOS}/`)) === 1);
ok('ni el perfil', (await cuantas(`${usuario}/perfil/`)) === 1);

ok('el perfil no es una carpeta de plantel',
  (await borrarLasFotosDelPlantel(usuario, 'perfil')) === 0 &&
    (await cuantas(`${usuario}/perfil/`)) === 1);

// --- darse de baja se lleva todo ---------------------------------------

n = await borrarLasFotosDe(usuario);
ok('la baja se lleva todo, perfil incluido',
  n === 2 && (await cuantas(`${usuario}/`)) === 0);
ok('y deja al vecino intacto', (await cuantas(`${otro}/`)) === 1);

await borrarLasFotosDe(otro);
ok('vecino limpiado', (await cuantas(`${otro}/`)) === 0);
console.log('');
console.log('listo.');
