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
