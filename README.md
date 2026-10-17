# Canchero

App para el celular que arma equipos de fútbol parejos.

## Qué es

Para grupos de amigos que juegan al fútbol 5, 7 u 11: cargás el plantel una vez y la app reparte los jugadores en dos equipos equilibrados. Funciona sin internet, y con una cuenta se guarda todo en la nube.

## Qué hace

- Fichas de jugadores estilo FIFA, con foto, 5 atributos y posición.
- Sorteo de equipos parejos según promedio, atributos y posiciones, con la vista de la cancha.
- Historial de partidos con goles y asistencias, tabla de posiciones y un puntaje que se ajusta con los resultados (tipo Elo).
- Compartir los equipos como imagen.
- Amigos, chat y envío de planteles entre usuarios, con notificaciones.
- Cuenta con copia de seguridad y papelera de planteles borrados.

## Tecnologías

- **App:** Expo, React Native y TypeScript.
- **Servidor:** Node.js con Hono, Better Auth y PostgreSQL (Neon). Fotos en Cloudflare R2 y mails con Resend. Publicado en Render.

## Cómo correrlo

Necesitás Node.js 20 o más y la app **Expo Go** en el celular.

```bash
git clone https://github.com/Brai99chavez/canchero.git
cd canchero
npm install
npm start
```

Escaneá el código QR con Expo Go. La app usa el servidor publicado (`extra.apiUrl` en `app.json`).

**Servidor propio (opcional):** necesitás una base PostgreSQL.

```bash
cd servidor
npm install
cp .env.example .env        # completá DATABASE_URL y AUTH_SECRET
npx @better-auth/cli migrate
psql "$DATABASE_URL" -f esquema.sql
npm run dev
```

Arranca en el puerto 3000. Las fotos (R2) y los mails (Resend) son opcionales. Para que la app lo use, cambiá `extra.apiUrl` en `app.json`.
