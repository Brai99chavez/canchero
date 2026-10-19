# canchero-api

La API de CANCHERO: cuentas y respaldo de planteles. Se deploya aparte de la
app — la app es un programa que corre en el teléfono de cada uno, esto corre en
un servidor.

- **Base**: Neon (Postgres).
- **Cuentas**: Better Auth, con las tablas en la misma base de Neon. Los
  usuarios son tuyos y se consultan con un SELECT; no hay ningún tercero.
- **Hosting**: Render.

## Ponerlo a andar

### 1. La base

Crear un proyecto en [neon.tech](https://neon.tech) y copiar la **connection
string** (la que dice *pooled*).

Es secreta: va en las variables de entorno del servidor y **nunca** en la app.

### 2. Las variables

```bash
cp .env.example .env
```

Completar las tres. El `AUTH_SECRET` se genera con:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Las tablas

Primero las de cuentas, que las crea Better Auth:

```bash
npx @better-auth/cli migrate
```

Después las nuestras, que referencian la tabla de usuarios que creó el paso
anterior. En el SQL Editor de Neon, pegar y correr `esquema.sql`.

Ese orden importa: al revés, las claves foráneas fallan.

### 4. Local

```bash
npm install
npm run dev
```

### 5. Render

Web Service nuevo, apuntando a este repo:

| | |
|---|---|
| Root directory | `servidor` |
| Build command | `npm install` |
| Start command | `npm start` |

Y las tres variables de entorno del `.env`, con `BASE_URL` apuntando a la URL
que te da Render.

**El plan gratis de Render se apaga a los 15 minutos sin tráfico** y tarda entre
30 y 60 segundos en despertar. Para desarrollar está perfecto. Antes de que haya
usuarios de verdad conviene pasar al plan pago, que no se duerme, o mover esto a
Cloudflare Workers, que arranca instantáneo. El código es el mismo.

## Qué hace

| | |
|---|---|
| `/api/auth/*` | Registro, login, sesión, recuperar contraseña. Lo maneja Better Auth. |
| `GET /perfil` | El mail y el plan de la cuenta. |
| `GET /planteles` | Los planteles guardados. |
| `PUT /planteles` | Sube todos de una. Es un upsert: nunca borra. |
| `DELETE /planteles/:id` | Marca el plantel como borrado. |
| `POST /convocatorias` | Abre el link de «¿quién viene?» de un plantel para un día (o devuelve el que ya está abierto para ese día). |
| `GET /convocatorias?plantel=` | El link abierto de ese plantel, con quién contestó qué. |
| `DELETE /convocatorias/:codigo` | Cierra el link. |
| `GET /v/:codigo` | **Sin sesión.** La página que se abre desde WhatsApp: tocás tu nombre y decís si vas. |
| `POST /v/:codigo` | **Sin sesión.** Lo que contesta esa página. |

**El link de «¿quién viene?» no pide cuenta**, a propósito: si para anotarse
hubiera que bajar la app, la mitad del grupo contestaría por WhatsApp. Lo que
lo protege es el código, de 72 bits al azar. La página muestra sólo los nombres
del plantel —ni fotos ni puntajes—, todo escapado, y sólo corre su propio
script (`nonce` en la política de contenido). Se prueba con
`npm run prueba:convocatorias`.

## Decisiones que no son obvias

**Todo lo que no es `/api/auth` pasa por un chequeo de sesión.** Es lo que en
una base con reglas por fila hace la base sola. Sin eso, cualquiera pide los
planteles de cualquiera cambiando un id.

**Subir nunca borra.** Una app recién instalada tiene la lista vacía; si subir
sincronizara de verdad, vaciaría el respaldo antes de que la persona alcance a
restaurarlo.

**Borrar marca `borrado`** en vez de borrar la fila. Si desapareciera, el
plantel volvería la próxima vez que otro teléfono restaure.

**El plan no se puede escribir desde la app.** No hay endpoint que lo toque:
`perfiles` la escribe el webhook del cobro, con su propia clave.

**Y el límite se aplica acá, no allá** (`src/planes.js`). En la app hay una
copia de los mismos números, pero esa vive adentro del APK, y un APK se
descompila, se cambia y se vuelve a firmar: quien quiera saltearse el límite
sólo tiene que cambiar una constante. Por eso `PUT /planteles` recorta contra
el plan que figura en la base y devuelve cuántos ignoró, para que la app pueda
avisar en vez de dar por guardado algo que no se guardó.

El tope de jugadores por plantel no se verifica: un plantel de treinta no le
cuesta nada al servidor, y rechazarlo le haría perder datos a alguien que
importó un respaldo grande y no hizo nada malo. Lo que se cobra es la cantidad
de planteles, y eso sí se verifica.

**Los errores no se devuelven con detalle.** El detalle va al log del servidor;
al teléfono le llega que falló y nada más, para no filtrar nombres de tablas ni
cadenas de conexión.

## Los mails

`src/mails.js`, con Resend. **Sin `RESEND_API_KEY` no se envía nada**: el mail
se escribe en el log del servidor con el link incluido. Eso permite probar el
circuito entero sin mandar correo de verdad, y que un despliegue mal
configurado no se caiga — queda anotado y sigue andando.

Dos mails:

- **Recuperar contraseña.** Sin esto, una contraseña olvidada es la cuenta
  perdida para siempre con el respaldo adentro. El link vence en una hora y no
  se puede usar dos veces.
- **Confirmar la cuenta.** Está **prendido**: hasta que no confirme, la cuenta
  existe pero no puede entrar. Sin eso cualquiera se registra con el mail de
  otro y ese otro se queda sin poder usar el suyo.

Pedir la recuperación responde igual exista o no la cuenta, a propósito: si
dijera "ese mail no está registrado" sería una forma de averiguar quién tiene
cuenta probando direcciones.

El HTML de los mails es simple a propósito: los clientes de correo soportan
mucho menos CSS que un navegador, y un mail que llega roto es peor que uno feo.

## Pendiente

- Mezclar dos copias en vez de reemplazar. Necesita una fecha de modificación
  por plantel, actualizada en cada cambio.
- Un dominio propio para los mails. Hoy salen de un subdominio prestado y se
  lee raro para una app que se llama CANCHERO. Es cosmético.
