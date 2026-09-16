import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { hayFotos, limpiarHuerfanas, permisoDeSubida } from './src/fotos.js';

const ok = (n, c) => console.log(`${c ? 'OK  ' : 'MAL '} ${n}`);
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

ok('la nube de fotos esta configurada', hayFotos);
const usuario = `prueba-limpieza-${Date.now()}`;
const otro = `${usuario}-vecino`;

async function subir(quien) {
  const p = await permisoDeSubida(quien, 'image/png');
  const r = await fetch(p.url, { method: 'PUT', headers: { 'content-type': 'image/png' }, body: png });
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
const cuantas = async (quien) => {
  const r = await cliente.send(new ListObjectsV2Command({
    Bucket: process.env.R2_BUCKET, Prefix: `${quien}/`,
  }));
  return (r.Contents ?? []).length;
};

const usada = await subir(usuario);
await subir(usuario);            // esta no la referencia nadie
const delVecino = await subir(otro);
ok('subieron las tres', (await cuantas(usuario)) === 2 && (await cuantas(otro)) === 1);

// Con el margen normal, lo recien subido no se toca.
let n = await limpiarHuerfanas(usuario, [usada.publica]);
ok('el margen protege lo recien subido', n === 0 && (await cuantas(usuario)) === 2);

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
n = await limpiarHuerfanas(usuario, [usada.publica], SIN_MARGEN);
ok('borra la huerfana', n === 1);
ok('deja la que esta en uso', (await cuantas(usuario)) === 1);

// Y nunca toca las de otra cuenta.
ok('no toca las del vecino', (await cuantas(otro)) === 1);

// Sin nada referenciado, se van todas las de esa cuenta.
n = await limpiarHuerfanas(usuario, [], SIN_MARGEN);
ok('sin referencias no queda ninguna', n === 1 && (await cuantas(usuario)) === 0);

// Limpieza de la prueba.
await limpiarHuerfanas(otro, [], SIN_MARGEN);
ok('vecino limpiado', (await cuantas(otro)) === 0);
console.log('');
console.log('listo.');
