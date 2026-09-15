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

## Respaldo: exportar e importar

Se exporta a un archivo JSON, que sale por el menú de compartir del teléfono
(WhatsApp, Drive, mail, lo que tengas), desde la tuerca de cada plantel.
Importar está en la lista. Sirve para no perder los datos si desinstalás la app y para pasarle el
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

Qué hace hoy (`src/nube/`):

- **Respaldo automático**, un rato después del último cambio. Si falla no
  interrumpe: se reintenta con el cambio siguiente.
- **Traer de la nube** reemplaza lo local, con confirmación. No mezcla, porque
  sin una fecha de modificación por plantel no hay forma de saber cuál de las
  dos copias es la buena, y adivinar mal se lleva datos cargados a mano. La
  mezcla de verdad es el paso siguiente.
- **Borrar marca el plantel como borrado** en vez de sacar la fila: si
  desapareciera, volvería la próxima vez que otro teléfono restaure.
- **Las fotos no suben**: son archivos de este teléfono y la ruta no significa
  nada en otro. Van con un lugar para archivos, más adelante.

La sesión se guarda en el almacenamiento seguro del sistema y no junto a los
planteles: es la llave de la cuenta, no un dato más. Que venza el token no se
avisa solo — se entera el primer pedido que falle con 401, y ahí la pantalla
pide entrar de nuevo.

El corte de los pedidos es de 70 segundos a propósito: el plan gratis de Render
apaga el servicio cuando no se usa y tarda en despertar, así que cortar a los
diez daría "sin conexión" cada vez que alguien es el primero del día en abrir
la app.

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

Cuando haya cobro, el que decide si una cuenta es Pro es el servidor.
`src/plan.ts` sirve para mostrar u ocultar cosas y para frenar al que se pasa
sin querer, nunca para dar por buena una compra: un APK modificado cambia esa
constante en cinco minutos.

## La media que evoluciona

`src/stats.ts`. Cada jugador tiene un ajuste de ±5 sobre su media base, que sale
de los últimos 8 partidos y se aplica tanto a la carta como al armado de
equipos.

Los resultados mueven para los dos lados: ganar seguido suma, perder seguido
resta. Los goles y asistencias **sólo suman** — un arquero no convierte nunca y
castigarlo por eso sería absurdo además de romper el balance. Todo se multiplica
por una confianza que crece con los partidos jugados, y hacen falta al menos 3
partidos antes de mover nada.

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
  la misma grilla y deja las imágenes en `tools/salida/`. Podés pedirle una
  plantilla puntual (`python tools/preview-carta.py AZUL`). Sirve para ajustar
  posiciones sin ir y volver al celular; si cambiás la grilla en `assets.ts`,
  cambiala también ahí.

  Ojo: dibuja con Pillow, no con `react-native-svg`. Sirve para decidir dónde
  va cada cosa, no para dar por buena la forma en que el celular lo pinta — la
  viñeta de la foto, por ejemplo, salía bien acá y cortada al ras en Android
  por un bug de la librería (está explicado en `PlayerCard.tsx`).
