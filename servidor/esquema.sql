-- Tablas propias de CANCHERO en Neon.
--
-- IMPORTANTE: correr esto DESPUÉS de `npx @better-auth/cli migrate`, que es lo
-- que crea las tablas de cuentas. Acá se referencia la tabla "user" que crea
-- esa migración; si todavía no existe, las claves foráneas fallan.
--
-- Se puede volver a correr sin romper nada.

-- ---------------------------------------------------------------- perfiles
-- Una fila por cuenta, con el plan. La app la lee para saber si mostrar los
-- límites, pero la escribe sólo el webhook del cobro: no hay ningún endpoint
-- que la modifique, así que un APK modificado no puede volverse Pro.
create table if not exists perfiles (
  usuario_id  text        primary key references "user" (id) on delete cascade,
  plan        text        not null default 'gratis',
  actualizado timestamptz not null default now(),
  constraint plan_valido check (plan in ('gratis', 'pro'))
);

-- El nombre de usuario y la foto. Van acá y no en la tabla de cuentas porque
-- esa la maneja Better Auth y sus migraciones la reescriben.
--
-- Como `alter`, y no como parte del `create` de arriba: la tabla ya existe en
-- la base que está andando, y ahí el `create table if not exists` no hace
-- nada. Esto se puede volver a correr sin romper nada.
alter table perfiles add column if not exists usuario text;
alter table perfiles add column if not exists foto    text;

-- Dos personas no pueden llamarse igual, y `Juan` y `juan` son la misma: si no
-- lo fueran, un amigo que te busca no sabría cuál de las dos sos. Se guarda
-- siempre en minúscula y el índice lo vuelve a asegurar del lado de la base,
-- que es el único lugar donde dos pedidos a la vez no se pisan.
create unique index if not exists perfiles_usuario_unico
  on perfiles (lower(usuario)) where usuario is not null;

-- --------------------------------------------------------------- planteles
-- `id` es el mismo que usa el teléfono, así subir es un upsert y no hay que
-- llevar una tabla de equivalencias. La clave es (dueño, id) porque dos
-- cuentas podrían generar el mismo id sin que eso sea un problema.
--
-- `datos` guarda el plantel entero como JSON: jugadores y partidos. La app ya
-- sabe armarlo y leerlo, así que modelarlo en tablas aparte sería trabajo de
-- más para lo mismo.
--
-- `borrado` en vez de borrar de verdad: si la fila desapareciera, el plantel
-- volvería la próxima vez que otro teléfono restaure.
create table if not exists planteles (
  id          text        not null,
  dueno       text        not null references "user" (id) on delete cascade,
  nombre      text        not null,
  llegada     timestamptz not null,
  datos       jsonb       not null default '{}'::jsonb,
  borrado     boolean     not null default false,
  actualizado timestamptz not null default now(),
  primary key (dueno, id)
);

create index if not exists planteles_por_dueno
  on planteles (dueno) where not borrado;

-- ----------------------------------------------------------------- envios
-- Un plantel que alguien le manda a otro por nombre de usuario.
--
-- Es una copia y no un plantel compartido: viaja el JSON, el que lo recibe lo
-- acepta y a partir de ahí es suyo. Compartir uno en vivo —que los dos vean
-- los mismos partidos— es otra cosa y necesita resolver quién gana cuando los
-- dos editan; esto no.
--
-- El envío queda guardado aunque se acepte, con `estado`: si se borrara al
-- aceptar, tocar dos veces "aceptar" con mala señal cargaría el plantel dos
-- veces, y no habría forma de saber que ya había pasado.
create table if not exists envios (
  id          text        primary key,
  de          text        not null references "user" (id) on delete cascade,
  para        text        not null references "user" (id) on delete cascade,
  nombre      text        not null,
  datos       jsonb       not null default '{}'::jsonb,
  estado      text        not null default 'pendiente',
  enviado     timestamptz not null default now(),
  resuelto    timestamptz,
  constraint estado_valido check (estado in ('pendiente', 'aceptado', 'rechazado'))
);

-- Lo único que se consulta seguido: qué tiene sin abrir el que recibe.
create index if not exists envios_pendientes
  on envios (para, enviado) where estado = 'pendiente';

-- -------------------------------------------------------------- amistades
-- Una fila por par de personas, no una por dirección.
--
-- El `check (uno < otro)` es lo que lo hace posible: los dos ids se guardan
-- siempre ordenados, así que "A con B" y "B con A" son la misma fila y la
-- clave primaria impide que existan las dos. Sin eso, si los dos se mandan
-- solicitud al mismo tiempo quedarían dos amistades pendientes entre las
-- mismas dos personas y ninguna de las dos se podría aceptar del todo.
--
-- `pidio` guarda cuál de los dos mandó la solicitud, que es lo único que no se
-- puede deducir del par ordenado.
create table if not exists amistades (
  uno      text        not null references "user" (id) on delete cascade,
  otro     text        not null references "user" (id) on delete cascade,
  pidio    text        not null references "user" (id) on delete cascade,
  estado   text        not null default 'pendiente',
  pedido   timestamptz not null default now(),
  resuelto timestamptz,
  primary key (uno, otro),
  constraint orden_canonico check (uno < otro),
  constraint estado_amistad check (estado in ('pendiente', 'aceptada', 'rechazada'))
);

-- ---------------------------------------------------------------- mensajes
-- La conversación entre dos. Un mensaje es texto o es un plantel: cuando es un
-- plantel, `envio` apunta a la fila de envios y de ahí sale si está pendiente,
-- aceptado o rechazado. Así el estado se ve en la conversación sin copiarlo
-- acá, que es como se desincronizan las cosas.
create table if not exists mensajes (
  id     text        primary key,
  uno    text        not null references "user" (id) on delete cascade,
  otro   text        not null references "user" (id) on delete cascade,
  autor  text        not null references "user" (id) on delete cascade,
  tipo   text        not null,
  texto  text,
  envio  text        references envios (id) on delete cascade,
  creado timestamptz not null default now(),
  constraint orden_canonico_mensaje check (uno < otro),
  constraint tipo_mensaje check (tipo in ('texto', 'plantel'))
);

create index if not exists mensajes_por_conversacion
  on mensajes (uno, otro, creado);

-- ---------------------------------------------------------------- lecturas
-- Hasta dónde leyó cada uno en cada conversación, para saber qué está sin
-- leer. Va aparte y no como un booleano en `mensajes` porque son dos personas
-- mirando los mismos mensajes: cada una llegó hasta un lugar distinto.
create table if not exists lecturas (
  usuario_id text        not null references "user" (id) on delete cascade,
  con        text        not null references "user" (id) on delete cascade,
  hasta      timestamptz not null default now(),
  primary key (usuario_id, con)
);

-- ------------------------------------------------------------ dispositivos
-- Adónde mandarle un aviso a cada cuenta. Una fila por teléfono: la misma
-- persona puede tener la app en dos.
--
-- Esto es lo que evita el refresco periódico. Sin avisos, cada app tendría que
-- preguntar cada tantos segundos si pasó algo, y como casi nunca pasa nada eso
-- es despertar la base todo el día al pedo. Con esto se toca la base sólo
-- cuando alguien hace algo.
--
-- El token es la clave: si el mismo teléfono cambia de cuenta, la fila se
-- muda, y así el aviso no le llega a quien ya no está usando esa app.
create table if not exists dispositivos (
  token       text        primary key,
  usuario_id  text        not null references "user" (id) on delete cascade,
  actualizado timestamptz not null default now()
);

create index if not exists dispositivos_por_usuario
  on dispositivos (usuario_id);

-- Cuándo se borró, para la papelera. `borrado` solo decía que sí, no cuándo, y
-- sin eso no se puede vaciar lo que ya lleva demasiado tiempo adentro.
alter table planteles add column if not exists borrado_en timestamptz;

-- Lo que se borró hace poco y todavía se puede recuperar.
create index if not exists planteles_papelera
  on planteles (dueno, borrado_en) where borrado;

-- De qué plantel salió un envío, para poder cancelarlo si lo borran.
--
-- Si el que comparte borra el plantel antes de que el otro lo acepte, ese
-- envío deja de tener sentido: lo que iba a recibir ya no existe. Sin esta
-- columna no habría forma de saber cuáles cancelar.
alter table envios add column if not exists plantel_id text;

-- `cancelado` se suma a los estados: ni aceptado ni rechazado por el que
-- recibe, sino retirado por el que mandó.
alter table envios drop constraint if exists estado_valido;
alter table envios add constraint estado_valido
  check (estado in ('pendiente', 'aceptado', 'rechazado', 'cancelado'));

create index if not exists envios_por_plantel
  on envios (de, plantel_id) where estado = 'pendiente';

-- Cuándo fue la última vez que se sacó este plantel de la papelera.
--
-- Es lo que impide usar la papelera para tener más planteles de los que el
-- plan deja. Sin esto se puede borrar uno de los activos, recuperar uno de la
-- papelera, usarlo, volver a borrarlo y recuperar el siguiente: rotando así se
-- usan todos los que haya guardados, de a dos por vez.
--
-- De la papelera se saca una vez: si este campo tiene algo, el próximo borrado
-- de ese plantel es definitivo y la app lo avisa antes de hacerlo. Así la
-- rotación se corta sola, y sin bloquear nunca el rescate de otro plantel que
-- hayas borrado sin querer, que es para lo que la papelera existe.
--
-- Además marca las lápidas: una fila borrada con este campo puesto es un
-- plantel eliminado para siempre. Queda vacía y borrada para que los otros
-- teléfonos se enteren —si desapareciera la darían por viva y la volverían a
-- subir— y se barre a los mismos días que el resto de la papelera.
alter table planteles add column if not exists restaurado_en timestamptz;

-- Si el borrado fue definitivo. Marca la lápida: la fila vacía que queda de un
-- plantel eliminado para siempre, que sigue ahí sólo para que los otros
-- teléfonos se enteren de que se borró.
--
-- Va en su propia columna y no se deduce de `restaurado_en`, que era lo de
-- antes. No alcanzaba: una app vieja —que no sabe avisar que el borrado es
-- definitivo— manda a la papelera un plantel que ya se había recuperado, y esa
-- fila tiene la misma forma que una lápida sin serlo. Con eso, el plantel le
-- quedaba invisible y sin poder recuperarse al que no hizo nada malo.
alter table planteles add column if not exists definitivo boolean not null default false;

-- Las convocatorias por link: "¿quién viene el sábado?".
--
-- El que organiza manda un link al grupo de WhatsApp y cada uno toca su nombre
-- y "voy" o "no voy", sin instalar nada ni tener cuenta. La app del que
-- organiza lee las respuestas y arma la convocatoria sola.
--
-- El código es lo único que protege la página, por eso es largo y al azar:
-- quien lo tiene es porque estaba en el grupo. Los nombres no se guardan acá,
-- se leen del plantel cada vez: un jugador que se agrega después aparece en el
-- link que ya se mandó.
--
-- `respuestas` es { "<id del jugador>": { "va": true, "cuando": "..." } }.
-- Una sola abierta por plantel: abrir otra cierra la anterior.
create table if not exists convocatorias (
  codigo      text        primary key,
  dueno       text        not null,
  plantel_id  text        not null,
  fecha       text        not null,
  respuestas  jsonb       not null default '{}'::jsonb,
  creada      timestamptz not null default now(),
  actualizada timestamptz not null default now(),
  cerrada     boolean     not null default false,
  constraint fecha_de_convocatoria check (fecha ~ '^\d{4}-\d{2}-\d{2}$'),
  foreign key (dueno, plantel_id) references planteles (dueno, id) on delete cascade
);
create index if not exists convocatorias_abiertas
  on convocatorias (dueno, plantel_id) where not cerrada;
