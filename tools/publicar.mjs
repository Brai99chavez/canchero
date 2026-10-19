/**
 * Manda lo que está en el código a los teléfonos que tienen el APK, por EAS.
 *
 *     node tools/publicar.mjs "Qué cambió"
 *
 * Tres pasos, y el primero es el que frena:
 *
 *   1. Compara la huella del código con la del último APK. Si no coinciden, la
 *      actualización no le llegaría a nadie —EAS sólo se la manda a los que
 *      pueden correrla— y se publicaría al vacío sin ningún aviso. Pasa más
 *      fácil de lo que parece: alcanza con agregar un script a package.json.
 *   2. Publica en el canal `preview`, que es el que escucha el APK.
 *   3. Sube los mapas de código a Sentry, para que un error de esta versión se
 *      pueda leer. Necesita SENTRY_AUTH_TOKEN, en el entorno o en
 *      `.env.sentry.local` (que no se sube al repo). Sin token publica igual y
 *      avisa.
 *
 * No es un script de package.json por lo mismo del paso 1.
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const CANAL = 'preview';
const PLATAFORMA = 'android';

const correr = (comando, opciones = {}) =>
  execSync(comando, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opciones });

const mensaje =
  process.argv[2] ?? correr('git log -1 --format=%s').trim();

// ── 1. La huella
console.log('Comparando la huella con la del último APK…');
const builds = JSON.parse(
  correr(`npx eas build:list --platform ${PLATAFORMA} --limit 10 --non-interactive --json`)
);
const apk = builds.find(
  (b) => b.status === 'FINISHED' && b.updateChannel?.name === CANAL
);
if (!apk) {
  console.error(`No hay ningún APK terminado en el canal ${CANAL}.`);
  process.exit(1);
}
const huellaApk = apk.runtime?.version ?? apk.fingerprint?.hash;
const huellaCodigo = JSON.parse(
  correr(`npx expo-updates fingerprint:generate --platform ${PLATAFORMA}`)
).hash;

if (huellaApk !== huellaCodigo) {
  console.error(
    [
      '',
      'La huella no coincide: esta actualización no le llegaría al APK.',
      `  APK del ${apk.createdAt.slice(0, 10)}: ${huellaApk}`,
      `  código de ahora:      ${huellaCodigo}`,
      '',
      'Cambió algo nativo (o un script de package.json). Hay que sacar un APK',
      'nuevo con `npx eas build --profile preview --platform android`.',
    ].join('\n')
  );
  process.exit(1);
}
console.log(`Coinciden (${huellaCodigo.slice(0, 7)}).`);

// ── 2. Publicar
console.log(`\nPublicando en ${CANAL}: "${mensaje}"`);
execSync(
  `npx eas update --channel ${CANAL} --environment ${CANAL} --platform ${PLATAFORMA} ` +
    `--message ${JSON.stringify(mensaje)} --non-interactive`,
  { stdio: 'inherit' }
);

// ── 3. Los mapas para Sentry
let token = process.env.SENTRY_AUTH_TOKEN;
if (!token && existsSync('.env.sentry.local')) {
  const linea = readFileSync('.env.sentry.local', 'utf8')
    .split(/\r?\n/)
    .find((l) => l.startsWith('SENTRY_AUTH_TOKEN='));
  token = linea?.slice('SENTRY_AUTH_TOKEN='.length).trim();
}
if (!token) {
  console.warn(
    '\nPublicado, pero SIN subir los mapas a Sentry: falta SENTRY_AUTH_TOKEN.\n' +
      'Un error de esta versión va a llegar ilegible.'
  );
  process.exit(0);
}
console.log('\nSubiendo los mapas de código a Sentry…');
execSync('npx --package=@sentry/react-native sentry-expo-upload-sourcemaps dist', {
  stdio: 'inherit',
  env: { ...process.env, SENTRY_AUTH_TOKEN: token },
});
console.log('\nListo.');
