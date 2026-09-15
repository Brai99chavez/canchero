# CANCHERO

App mobile para cargar un plantel y armar dos equipos parejos de fútbol 5, 7 u 11.

Los jugadores se guardan en el celular (no hace falta internet ni cuenta) y el
sorteo reparte buscando igualar la media de habilidad y distribuir las
posiciones.

## Correrla

```bash
npm install
npx expo start
```

Escaneá el QR con la app **Expo Go** (Android/iOS) y la app abre en el celular.
Para Android con emulador: `npm run android`.

## Cómo se usa

1. **Plantel**: `+ Agregar` carga un jugador con su posición y sus cinco stats:
   pases, regate, definición, posicionamiento y resistencia, del 1 al 99. Cada
   stat se ajusta con una barra, y arriba de todas hay un selector de **paso**
   (de a 1, 5 o 10) para que la barra avance en saltos redondos en vez de tener
   que clavar el valor a pulso. La media general se calcula sola y se muestra al
   lado del título de la sección.

   Las posiciones son ARQ, DEF, MED, DEL y **LIB (líbero)**, para el que juega
   en cualquier lado. Tocando un jugador del plantel se abre su carta; desde ahí
   `Editar` muestra los deslizantes, con la carta actualizándose abajo mientras
   tocás los valores.

   Cada jugador puede tener **foto**, elegida de la galería y recortada en
   cuadrado. En la carta llena la mitad de arriba y se apaga con una viñeta
   elíptica que llega a cero en los cuatro bordes, así que no queda ningún canto
   recto y el desvanecido sale igual para cualquier foto: no hace falta un PNG
   sin fondo. Sin foto va una silueta de busto
   (`assets/silueta.png`), más chica y centrada para que se vea el arte de la
   plantilla. Las fotos se copian a una carpeta propia de la app y se borran
   solas cuando cambiás de foto o eliminás al jugador.
2. **Planteles**: la app abre en la lista de planteles, uno por grupo de amigos.
   Tocás uno y entrás; desde adentro volvés con `‹ Planteles`. Cada plantel
   tiene su `Config`: renombrar, marcarlo para que la app abra directo ahí,
   exportarlo y borrarlo. Si ningún plantel está marcado, la app arranca
   mostrando la lista.
3. **Partido**: elegís el formato (fútbol 5, 7 u 11) y tildás quiénes juegan hoy.
   Con **Repartir a todos** se ignora el tope del formato y los convocados se
   dividen en dos equipos: con 17 personas salen equipos de 9 y 8, sin banco.
4. **Armar equipos**: muestra los dos equipos con su media y el promedio de cada
   atributo, en vista *Lista* o *Cancha* (las formaciones dibujadas). Si hay más
   convocados que lugares, los que sobran quedan de suplentes, y el banco rota:
   se sienta a quien menos descansó en los últimos partidos. `Volver a sortear`
   da otro reparto igual de parejo, y `Compartir` manda una imagen lista para
   pegar en el grupo (si la captura falla, cae al texto).

5. **Guardar partido** deja el sorteo en el historial y abre la carga del
   resultado: marcador, y opcionalmente goles y asistencias por jugador. Si
   alguien al final no jugó, se lo saca con la × y deja de contar.

6. **Historial**: los partidos jugados y una tabla con partidos jugados,
   ganados, empatados, perdidos, goles, asistencias y la forma de los últimos
   cinco. Tocá un partido para cargar o corregir su resultado; mantenelo
   apretado para borrarlo.

## Los avisos y las preguntas

No queda ningún `Alert` del sistema en la app. Los de Android e iOS son
cuadrados, blancos o grises y con la tipografía del sistema: al lado del resto
parecen de otra aplicación, y se ven distintos en cada teléfono.

En su lugar hay tres piezas, según qué tan fuerte sea la interrupción:

- `Aviso` (`components/ui.tsx`) — un recuadro rojo **adentro** de la pantalla,
  para errores del formulario que se está mirando. No tapa nada ni obliga a
  aceptar.
- `useDialogo` (`components/Dialogo.tsx`) — el aviso o la pregunta encima de
  todo, con Cancelar y el botón de confirmar en rojo cuando no hay vuelta
  atrás.
- `Hoja` (`components/Hoja.tsx`) — sube desde abajo cuando hay que **elegir**
  entre dos caminos, como exportar.

Cada pantalla arma su propio `useDialogo` en vez de haber uno solo arriba de
todo: los modales de React Native son ventanas aparte, y uno que nace afuera de
la ventana abierta corre el riesgo de quedar por debajo.

`avisar` acepta un tercer argumento con qué hacer al cerrarlo. Hace falta
cuando el aviso es lo último que pasa en una pantalla que después se cierra:
cerrarla antes de mostrarlo se llevaría el diálogo puesto, porque vive adentro
de esa ventana.

## Respaldo: exportar e importar

Se exporta **un plantel por vez**, desde su tuerca. El botón abre una hoja con
dos caminos: **guardar en el teléfono**, que abre el selector de carpetas del
sistema para dejarlo en Descargas o donde quieras, o **compartir**, que abre el
menú del teléfono (WhatsApp, Drive, mail).

Va por el selector y no directo a la carpeta de descargas porque una app no
puede escribir ahí por su cuenta: Android no se lo permite desde hace varias
versiones. El selector además deja elegir, que termina siendo mejor que decidir
por el otro.

Importar está en la lista de planteles, y también abre una hoja que explica qué
va a pasar antes de mandar a buscar el archivo. Sirve para no perder los datos si desinstalás la app y para pasarle el
plantel a otra persona.

El archivo guarda nombre, posición y stats de cada jugador, **y el historial de
partidos**. Al importar, los ids se regeneran y los partidos se traducen a los
nuevos, así las estadísticas viajan enteras. **Las fotos no viajan**: son
archivos del teléfono y meterlas adentro haría el JSON enorme.

Al importar, los planteles del archivo se agregan como nuevos: nunca se pisa lo
que ya está cargado, y nunca se descarta ninguno por el tope del plan (ver
**Planes y límites**). Si importás dos veces el mismo archivo vas a terminar con
el plantel duplicado, y lo borrás desde la misma pantalla.

`src/backup.ts` arma y lee el archivo. Verifica que el JSON sea de esta app
(campo `app`) y sanea cada jugador, así un archivo cualquiera no rompe nada.

## Cuenta y respaldo en la nube

**Opcional.** Sin configurar, `hayNube` queda en false, el botón de cuenta ni
aparece y la app funciona como siempre: sin internet, sin registrarse y con
todo guardado en el teléfono. Ese es el modo en que la usa la mayoría.

El servidor vive en `servidor/` y se deploya aparte — la app es un programa que
corre en el teléfono de cada uno, la API corre en Render. Cómo levantarla está
en `servidor/README.md`. Una vez andando, va su URL en `extra.apiUrl` de
`app.json` y listo; esa URL no es un secreto. La cadena de conexión de la base
vive en las variables de entorno de Render y **nunca** en la app, que es un
archivo que cualquiera se baja y descomprime.

La pantalla de cuenta tiene dos acciones, **Backup** y **Restore**:

- **Backup** sube los planteles a la cuenta, **sólo al tocar el botón**.
  Automático parecía mejor hasta pensar en el caso malo: borrás un plantel sin
  querer y a los dos segundos ese borrado ya está en la nube, que era justo de
  donde ibas a recuperarlo. Una copia que se pisa sola no es una copia de
  seguridad.

  Por lo mismo, borrar un plantel **no lo borra en la nube en ese momento**:
  queda anotado y viaja con el próximo backup, después de subir los que
  quedan, así una subida fallida no se lleva nada.
- **Restore** trae los de la cuenta a este teléfono y **reemplaza** lo local,
  con confirmación. No mezcla, porque sin una fecha de modificación por plantel
  no hay forma de saber cuál de las dos copias es la buena, y adivinar mal se
  lleva datos cargados a mano. La mezcla de verdad es el paso siguiente.

**Cerrar sesión no borra nada del teléfono.** Si quedó algo sin subir —que
ahora es lo normal, porque el backup es manual— avisa antes y ofrece hacer el
backup y cerrar en un solo paso. Eso lo sabe comparando
`firmaDe()` —un hash corto de lo que se subiría— con la firma de la última
subida que salió bien. Va sobre lo que viaja y no sobre el plantel entero, para
que elegir una foto, que no se sube, no cuente como cambio pendiente.

Dos cosas más:

- **Borrar marca el plantel como borrado** en vez de sacar la fila: si
  desapareciera, volvería la próxima vez que otro teléfono restaure.
- **Las fotos viajan con el backup**, pero no adentro del JSON: se suben a
  Cloudflare R2 y en el plantel queda la URL. Ver abajo.

La sesión se guarda en el almacenamiento seguro del sistema y no junto a los
planteles: es la llave de la cuenta, no un dato más. Que venza el token no se
avisa solo — se entera el primer pedido que falle con 401, y ahí la pantalla
pide entrar de nuevo.

El corte de los pedidos es de 70 segundos a propósito: el plan gratis de Render
apaga el servicio cuando no se usa y tarda en despertar, así que cortar a los
diez daría "sin conexión" cada vez que alguien es el primero del día en abrir
la app.

## Limpiar el historial

En **En juego** y en **Jugados**, arriba de la lista hay *Elegir para borrar*:
se marcan los que sobran y el botón rojo de abajo los saca de una. *Todos*
selecciona la lista entera, que es la forma de vaciar el historial de un
plantel sin un botón aparte para eso.

Mantener apretado un partido entra al modo con ese ya marcado, que es el atajo
que espera cualquiera que borró algo en un celular.

Cambiar de pestaña sale del modo: lo que quedó marcado era de la otra lista, y
borrar eso no sería lo que nadie espera.

Borrar un partido lo saca de la tabla y de los PJ/G/A de las cartas, porque
todo eso se calcula sobre la lista de partidos y no se guarda aparte.

## Las fotos

Van a Cloudflare R2 y viajan con el backup: en el plantel queda la URL, no la
imagen. Sin las variables `R2_*` en el servidor queda apagado solo y las fotos
siguen viviendo únicamente en cada teléfono.

**El archivo no pasa por el servidor.** La app le pide un permiso
(`POST /fotos/permiso`), el servidor firma una URL que vale cinco minutos, y la
app manda el archivo derecho al bucket. Pasarlo por el medio ocuparía el
contenedor —512 MB en el plan gratis de Render, que además se duerme— para
mover algo que no lo necesita.

**Se achica en el teléfono, no en el servidor** (`src/photos.ts`): 640 px de
ancho y compresión 0.72 al elegirla. Una foto de celular son 3 o 4 MB y queda
en unos 50 KB — ochenta veces menos para subir, para bajar y para ocupar en el
teléfono. En el ecommerce eso se hace con `sharp` del lado del servidor porque
el que sube es un navegador; acá el que sube es un celular y puede hacerlo él.

Dos cosas del servidor que no son decorativas: la key arranca con el id de la
cuenta, así una cuenta no puede escribir encima de la foto de otra aunque se
ponga a inventar nombres, y el borrado vuelve a chequear ese prefijo.

Si una foto falla al subir, el plantel se guarda igual: la foto queda local y
se reintenta en el próximo backup. Perder el respaldo entero porque una imagen
no subió sería mucho peor que quedarse sin esa imagen.

**Las fotos que ya no usa nadie se borran al final del backup**, no antes. El
servidor mira qué quedó guardado —no lo que vino en el pedido— y saca del
bucket lo que ningún plantel vivo referencia. Ese es el único momento en que se
sabe con certeza qué sigue en uso: hacerlo desde el teléfono al borrar un
jugador podía llevarse la foto que la copia de la nube todavía estaba
mostrando.

Con **15 minutos de gracia**: una foto recién subida puede estar esperando el
plantel que la va a nombrar, y borrarla ahí la perdería.

`npm run prueba:fotos` recorre el camino entero contra el servidor de verdad:
permiso, subida, que se vea por la URL pública, que viaje en el backup y que se
borre. `npm run prueba:limpieza` prueba el barrido, incluido que el margen
proteja lo recién subido y que nunca toque las fotos de otra cuenta; necesita
las variables `R2_*` en el `.env` local.

## Planes y límites

El plan gratis llega a **2 planteles** de hasta **24 jugadores** cada uno; Pro
no tiene tope. Las reglas viven todas en `src/plan.ts` y las pantallas sólo
preguntan: cuando exista la cuenta, cambia de dónde sale `PLAN` y nada más.

Cuando hay más planteles que los que el plan permite —porque se importó un
respaldo grande, o porque se venció un Pro— **no se borra ni se esconde
ninguno**. Se usan **los que llegaron primero a este teléfono** y el resto
queda en la lista, con el borde rojo y el motivo escrito, sin poder abrirse. La
tuerca sigue andando, que es por donde se los borra para hacer lugar: al borrar
un activo, el siguiente entra solo.

Eso lo decide `llegada`, el momento en que el plantel entró a este teléfono —al
crearlo o al importarlo—, no cuándo se creó en el teléfono de otro:

- **No viaja en el respaldo.** Si viajara, importar un plantel viejo le sacaría
  el lugar al que venías usando. Lo importado llega ahora, por definición.
- Al importar varios de una, el índice dentro del archivo conserva su orden.
  Eso importa cuando se restaura un respaldo entero en un teléfono vacío: manda
  el orden que tenían en el anterior.
- Los planteles guardados antes de que el campo existiera reciben una fecha
  inventada a partir de su posición (`src/storage.ts`), que es el orden en que
  entraron. Sale igual en cada lectura, así que el orden no se mueve solo.
- **Importar nunca descarta planteles**: entra todo y después la llegada decide
  cuáles se pueden usar. Perder datos de un respaldo sería peor que mostrarlos
  bloqueados.

Cuando exista la cuenta, `llegada` tiene que sincronizarse con ella para que
los dos teléfonos de la misma persona coincidan en cuáles están activos.

`PRO_DISPONIBLE` está en falso mientras no se pueda comprar: con eso los
avisos dicen que Pro está por salir en vez de mandar a contratarlo. Ofrecer una
salida que todavía no existe es peor que no ofrecer ninguna. El día que el
cobro ande, esa constante pasa a true y los textos se acomodan solos.

Cuando haya cobro, el que decide si una cuenta es Pro es el servidor.
`src/plan.ts` sirve para mostrar u ocultar cosas y para frenar al que se pasa
sin querer, nunca para dar por buena una compra: un APK modificado cambia esa
constante en cinco minutos.

## La media que corrige tu ojo

`src/elo.ts`. La media que cargás a mano dice lo que el jugador **sabe hacer**;
esto dice lo que **pasa cuando juega**. Arranca exactamente en tu media y se
mueve con los resultados.

Lo que la hace útil es que no mira si ganó, sino si ganó **cuando se esperaba
que ganara**. Si su equipo era favorito y perdió, pega fuerte; si lo llevaron
de arrastre en un equipo muy superior, ganar casi no le suma. Esa corrección
por compañeros y rivales sale de la fórmula, no hay que programarla.

**El tope es la confianza.** Cuánto se le permite alejarse de tu media depende
de cuántos partidos lo respaldan:

| Partidos | Se mueve hasta |
|---|---|
| menos de 5 | nada |
| 5 a 15 | ±3 |
| 15 a 40 | ±6 |
| 40 o más | ±8 |

Con pocos partidos el sistema no sabe, y en vez de avisarlo con una etiqueta
que nadie lee, directamente no se le permite opinar. Ese ±8 es la única perilla
que importa: es cuánto le creés a los resultados por encima de tu ojo.

**No se guarda, se recalcula del historial.** Borrar un partido de prueba lo
deshace solo, corregir las stats de alguien mueve su número con ellas, y el
respaldo ya lo lleva sin hacer nada — porque lleva los partidos.

**Es el único número que se muestra en toda la app**: la lista, la tabla, la
convocatoria, la cancha, los equipos y la carta usan el corregido. Dos números
compitiendo en seis pantallas se vuelve un lío, y el mismo jugador mostrando 75
acá y 81 allá es peor que no tener nada.

Las dos excepciones son a propósito: **al editar** se ve la media base, porque
es la que se está tocando — mostrar la corregida haría que al guardar se hornee
el ajuste adentro y se sume encima. Y en la **ficha del jugador** hay una línea
que explica de dónde sale el número y cuál es tu media. Eso es lo que faltó la
vez anterior: un número que se mueve solo y no dice por qué termina
desconfiando a cualquiera.

El sorteo lo usa, que es el punto: si con alguien el equipo pierde más de lo
que debería, el sorteo se entera.

**En lo que se comparte no va ningún puntaje individual.** Ni en la imagen ni
en el texto: eso va al grupo entero, y ver que a uno le pusieron 62 al lado de
un 88 no le suma nada al partido. La media del equipo sí queda, que es lo que
muestra que el reparto fue parejo.

Un límite honesto: si los mismos cinco juegan siempre juntos, ningún método
puede repartir la culpa entre ellos. Por eso importa que el sorteo rote las
duplas.

`npm run prueba:elo` corre los casos: el bueno que hace perder, el que lo
llevan de arrastre, el que gana peleado, y que sin datos no invente.

## La tabla

Por jugador: la media corregida, el registro, la tirita de los últimos cinco y
el **porcentaje de partidos ganados**. Los empates no cuentan como medio — se
ganó o no se ganó, que es como se habla de esto en un grupo.

El porcentaje repite en parte lo que dice el registro, y eso es a propósito: se
lee de un vistazo sin tener que dividir `0G 1E 5P` mentalmente.

Lo que no muestra, y se calcula igual en `src/stats.ts`, es la **diferencia de
gol**. Distingue cosas que el porcentaje no —perder 1-0 cinco veces y perder
8-0 cinco veces son el mismo 0%— pero se prefirió el porcentaje por ser más
directo. Volver a mostrarla es cambiar una pantalla, no la cuenta.

## Cómo arma los equipos

`src/balance.ts`. El sorteo le pone un costo a cada reparto posible sumando:

- la diferencia de media general entre los dos equipos (lo que más pesa),
- la diferencia promedio en cada uno de los cinco atributos,
- el desbalance de posiciones, con castigo extra si los arqueros caen del mismo
  lado.

Los líberos entran en esa última cuenta como comodines: cada puesto que le falta
a un equipo respecto del otro es un hueco, y los líberos de ese equipo tapan los
huecos más caros primero (el arco antes que nada). Sólo se penaliza lo que queda
sin tapar, más un desempate chico para que los líberos no caigan todos del mismo
lado. Si cargás a todo el plantel como líbero, el reparto queda definido sólo por
los stats.

Con ese costo hace varios repartos aleatorios, cada uno afinado a fuerza de
intercambiar jugadores mientras eso mejore el balance, y se queda con el mejor.

Como ese óptimo es casi siempre el mismo reparto, después explora los repartos
vecinos que quedan dentro de un margen de justicia (`TOLERANCE`) y junta hasta
40 alternativas igual de parejas. El sorteo elige una al azar entre esas, y
descarta la que ya está en pantalla: por eso `Volver a sortear` cambia los
equipos sin empeorar el balance.

En pruebas con planteles de 10 a 22 jugadores, con y sin líberos, la diferencia
de media entre equipos queda entre 0 y 2 puntos, ningún equipo se queda sin
arquero ni suplente de arquero, los equipos nunca quedan desparejos en cantidad,
y 30 sorteos seguidos dan entre 4 y 30 repartos distintos. Cada sorteo tarda
entre 9 y 85 ms.

## Estructura

```
App.tsx                      navegación por pestañas y estado del plantel
src/types.ts                 jugador, posiciones, stats y cálculo de medias
src/balance.ts               armado de equipos
src/storage.ts               guardado local (AsyncStorage) y migración
src/backup.ts                exportar/importar planteles en JSON
src/stats.ts                 estadísticas, forma y rotación del banco
src/photos.ts                elegir, copiar y limpiar fotos de jugador
src/theme.ts                 colores y espaciados
src/components/ui.tsx        badges, barras de stats, botones
src/components/PlayerCard    carta estilo FIFA (oro/plata/bronce por media)
src/components/PlayerSilhouette  silueta vectorial para cuando no hay foto
src/screens/PlayersScreen    listado del plantel
src/screens/PlayerFormModal  carta del jugador, alta y edición
src/screens/SquadsScreen     lista de planteles, exportar todos e importar
src/screens/SquadConfigModal config de un plantel: nombre, default, exportar
src/screens/MatchScreen      formato y convocados
src/screens/MatchResultModal marcador, goles y asistencias
src/screens/HistoryScreen    partidos jugados y tabla del plantel
src/components/Pitch         formaciones dibujadas en la cancha
src/components/ShareCard     la estampa que se comparte como imagen
src/screens/TeamsModal       resultado del sorteo
```

## Ajustes rápidos

- **Otros atributos**: agregalos en `STAT_KEYS` y `STAT_LABELS` (`src/types.ts`).
  El resto de la app los toma solo.
- **Qué tan parejo tiene que ser**: `TOLERANCE` en `src/balance.ts`. Más bajo,
  equipos más parejos pero menos variedad al re-sortear.
- **Cuánto pesa cada cosa**: las constantes `W_*` arriba del mismo archivo.
- **Diseño de la carta**: la carta entera es un solo SVG. El fondo es el PNG de
  la plantilla y la foto y los textos van adentro del mismo SVG, en las
  coordenadas de ese PNG. Que esté todo en el mismo sistema de coordenadas es lo
  que la hace andar en cualquier pantalla: el `viewBox` escala fondo, foto y
  textos juntos, y la carta se estira hasta el ancho que le dé el contenedor
  (hasta 320) sin que nada se desalinee.

  Las plantillas están en `src/assets.ts`. La grilla (`GRILLA`) se guarda en
  **fracciones** del tamaño de la carta, no en píxeles, así que una plantilla
  nueva sólo necesita su medida y todo cae en el mismo lugar relativo. Los
  valores salen de medir las líneas doradas de la plantilla azul, que es la
  única que las trae dibujadas.

  Cada plantilla define además su `clip` (el contorno, trazado del canal alfa
  del PNG, es lo que recorta la foto), su `ink` (color del texto) y su `halo`
  (el color con que se engrosa el texto por detrás para que se lea sobre la
  foto). Si el fondo es claro, `ink` va oscuro y `halo` claro; si es oscuro, al
  revés. `ajustes` permite corregir la grilla para una plantilla puntual — la
  de mármol sube las stats porque abajo trae impreso "FUT CARDS", y la de neón
  —la que está activa— corre el bloque de abajo para repartir el aire entre el
  nombre y la punta inferior del marco.

  Para cambiar cuál se usa: `CARD_TEMPLATES` tiene una entrada por tier (oro,
  plata, bronce) que hoy apuntan todas a la misma. Con tres plantillas
  distintas, cada jugador usa la de su media.

- **Marca**: `python tools/generar-iconos.py` regenera el icono, el adaptativo
  de Android, el favicon y el splash (`assets/splash-icon.png`, que es el
  escudo con la palabra CANCHERO). Sobreescribe los PNG de `assets/` que usa
  `app.json`; volver a correrlo es inofensivo.

  El escudo está dibujado dos veces con las mismas coordenadas: en Python para
  los PNG y en `src/components/Logo.tsx` para usarlo dentro de la app. Si se
  toca uno hay que tocar el otro.

  El splash lo arma el plugin `expo-splash-screen` de `app.json`, y la pantalla
  de carga (`src/screens/Cargando.tsx`) muestra el mismo archivo al mismo
  ancho: `imageWidth` del plugin y `ANCHO_LOGO` de la pantalla tienen que valer
  lo mismo, si no se ve un salto de tamaño al arrancar.

  El nombre escrito aparece en un solo lugar de la interfaz: el encabezado de
  la lista de planteles, que es la portada. En el resto de las pantallas el
  título dice de qué plantel se trata.

- **Ver la carta sin compilar**: `python tools/preview-carta.py` la dibuja con
  la misma grilla y deja las imágenes en `tools/salida/`. Sirve para ajustar
  posiciones sin ir y volver al celular; si cambiás la grilla en `assets.ts`,
  cambiala también ahí.

  Ojo: dibuja con Pillow, no con `react-native-svg`. Sirve para decidir dónde
  va cada cosa, no para dar por buena la forma en que el celular lo pinta — la
  viñeta de la foto, por ejemplo, salía bien acá y cortada al ras en Android
  por un bug de la librería (está explicado en `PlayerCard.tsx`).
