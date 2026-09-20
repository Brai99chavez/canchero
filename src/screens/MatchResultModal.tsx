import React, { useCallback, useEffect, useRef, useState } from 'react';
import Panel, { DIAGONAL } from '../components/Angular';
import { CalendarIcon } from '../components/icons';
import SelectorFecha from '../components/SelectorFecha';
import { comoSeLee } from '../fechas';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDialogo } from '../components/Dialogo';
import { Presionable } from '../components/motion';
import CampoTexto from '../components/CampoTexto';
import HeaderModal from '../components/HeaderModal';
import { Etiqueta } from '../components/Banner';
import { Button } from '../components/ui';
import { EstampaOculta, useCompartirEquipos } from '../compartirEquipos';
import EditarEquiposModal from './EditarEquiposModal';
import { colors, spacing } from '../theme';
import { tieneResultado } from '../stats';
import { Actuacion, Partido, TeamSplit } from '../types';

interface Props {
  visible: boolean;
  partido: Partido | null;
  /** Si se piden los goles y asistencias de cada uno. Es del plantel. */
  detalle: boolean;
  onDetalle: (valor: boolean) => void;
  /**
   * Los dos equipos con los jugadores de verdad, para poder compartirlos.
   *
   * El partido guarda ids y nombres, que alcanzan para la pantalla pero no
   * para la estampa: ésa muestra la posición de cada uno y la media del
   * equipo. Viene armado de afuera, que es donde está el plantel.
   */
  split: TeamSplit | null;
  /** El nombre del plantel, que va en la estampa. */
  plantel: string;
  /**
   * Cambia de equipo a dos jugadores de este partido.
   *
   * Se aplica en el momento, no al completar: los equipos se tocan días antes
   * de jugar —alguien avisa que no viene— y guardar ese cambio no tiene por
   * qué esperar a que haya un resultado.
   */
  onSwap: (unoId: string, otroId: string) => void;
  onClose: () => void;
  onGuardar: (cambios: {
    fecha: string;
    equipoA: string[];
    equipoB: string[];
    golesA: number;
    golesB: number;
    actuaciones: Actuacion[];
  }) => void;
}

type Aportes = Record<string, { goles: string; asistencias: string }>;

/**
 * Un botón de más o de menos para el marcador.
 *
 * Va abajo del número y no a los costados: con los dos marcadores y el guión
 * en el medio, cuatro botones al lado no entran en un teléfono angosto.
 */
function Paso({
  signo,
  onPress,
}: {
  signo: '+' | '−';
  onPress: () => void;
}) {
  /*
   * Mientras se lo tiene apretado se rellena y el signo se da vuelta de color.
   * El hundido que trae `Presionable` solo no alcanzaba acá: es un botón que
   * se toca varias veces seguidas, y sin una confirmación clara uno no sabe si
   * el toque entró o le erró.
   */
  const [tocando, setTocando] = useState(false);

  return (
    <Presionable
      onPress={onPress}
      onPressIn={() => setTocando(true)}
      onPressOut={() => setTocando(false)}
      escala={0.88}
      style={styles.paso}
      hitSlop={10}
    >
      <Panel
        style={styles.pasoCaja}
        esquinas={DIAGONAL}
        chaflan={7}
        fondo={tocando ? colors.primary : colors.surface}
        borde={tocando ? colors.primary : colors.border}
      >
        <Text style={[styles.pasoTexto, tocando && styles.pasoTextoTocado]}>
          {signo}
        </Text>
      </Panel>
    </Presionable>
  );
}

/** Campo numérico chico: sólo dígitos, vacío cuenta como cero. */
function Contador({
  valor,
  onChange,
}: {
  valor: string;
  onChange: (v: string) => void;
}) {
  return (
    <CampoTexto
      value={valor}
      onChangeText={(t) => onChange(t.replace(/[^0-9]/g, '').slice(0, 2))}
      keyboardType="number-pad"
      selectTextOnFocus
      contenedor={styles.contadorCaja}
      style={styles.contador}
      placeholder="0"
    />
  );
}

/**
 * Qué se puede hacer con el partido que está abierto.
 *
 * Un partido del historial ya pasó: entrar a mirarlo es lo normal y
 * corregirlo la excepción. Antes se abría con todos los campos listos para
 * escribir, y un roce sin querer cambiaba un marcador que ya estaba bien.
 */
type Modo = 'lectura' | 'edicion';

/** Un aporte ya cargado. Ocupa lo mismo que el campo, así no salta al editar. */
function Dato({ valor }: { valor: number }) {
  return (
    <Text style={[styles.dato, valor === 0 && styles.datoCero]}>
      {valor === 0 ? '–' : valor}
    </Text>
  );
}

export default function MatchResultModal({
  visible,
  partido,
  detalle,
  onDetalle,
  split,
  plantel,
  onSwap,
  onClose,
  onGuardar,
}: Props) {
  const [modo, setModo] = useState<Modo>('edicion');
  const [golesA, setGolesA] = useState('');
  const { dialogo, preguntar } = useDialogo();
  const [golesB, setGolesB] = useState('');
  const [aportes, setAportes] = useState<Aportes>({});
  /** Quiénes al final no jugaron: se sacan del partido al guardar. */
  const [fuera, setFuera] = useState<string[]>([]);
  /**
   * Si el marcador todavía no se tocó a mano, se completa solo con la suma de
   * los goles que se van cargando. En cuanto lo escribís vos, deja de moverse.
   */
  const [tocado, setTocado] = useState({ a: false, b: false });
  /** El día en que se jugó. Se puede corregir al editar. */
  const [dia, setDia] = useState(() => new Date());
  const [eligiendoDia, setEligiendoDia] = useState(false);
  const [editandoEquipos, setEditandoEquipos] = useState(false);

  /** Vuelve a poner en pantalla lo que está guardado, tirando los cambios. */
  const reiniciar = useCallback(() => {
    if (!partido) return;
    setGolesA(partido.golesA === null ? '' : String(partido.golesA));
    setGolesB(partido.golesB === null ? '' : String(partido.golesB));

    const inicial: Aportes = {};
    for (const id of [...partido.equipoA, ...partido.equipoB]) {
      const act = partido.actuaciones.find((a) => a.jugadorId === id);
      inicial[id] = {
        goles: act?.goles ? String(act.goles) : '',
        asistencias: act?.asistencias ? String(act.asistencias) : '',
      };
    }
    setAportes(inicial);
    setFuera([]);
    const guardada = new Date(partido.fecha);
    setDia(Number.isNaN(guardada.getTime()) ? new Date() : guardada);
    setTocado({
      a: partido.golesA !== null,
      b: partido.golesB !== null,
    });
  }, [partido]);

  /**
   * Cuál es el partido que ya está puesto en pantalla.
   *
   * Sin esto, preparar la pantalla dependía del objeto `partido`, que cambia
   * de identidad cada vez que se toca: intercambiar dos jugadores tiraba los
   * goles que estabas cargando y te devolvía al principio.
   */
  const preparado = useRef<string | null>(null);

  useEffect(() => {
    if (!visible || !partido) {
      preparado.current = null;
      return;
    }
    if (preparado.current === partido.id) return;
    preparado.current = partido.id;

    reiniciar();
    // El que ya tiene resultado se abre para mirar; el que no, para cargarlo,
    // que es justo lo que se venía a hacer desde la lista de activos.
    setModo(tieneResultado(partido) ? 'lectura' : 'edicion');
  }, [visible, partido, reiniciar]);

  /**
   * El golpe del número cuando cambia el marcador.
   *
   * Sumar lo agranda y restar lo achica, y no es adorno: son dos acciones
   * opuestas con el mismo aspecto, y sin eso la única forma de saber cuál
   * saliste es mirar el número. Así el movimiento lo dice antes de leerlo.
   *
   * Vuelve con un resorte, no con una transición pareja: lo que se estira y
   * vuelve de golpe se siente físico, y lo que vuelve a velocidad constante
   * se siente animado.
   *
   * Va ACÁ ARRIBA, con los demás hooks y antes del corte de abajo. Puesto
   * después, en los dibujos sin partido no se ejecutaba y en los que sí, sí:
   * React exige que sean siempre los mismos y en el mismo orden, y al ver que
   * cambiaba la cantidad tiraba la app entera.
   */
  const pulsoA = useRef(new Animated.Value(0)).current;
  const pulsoB = useRef(new Animated.Value(0)).current;

  const pulsar = useCallback((anim: Animated.Value, paso: number) => {
    anim.setValue(0);
    Animated.sequence([
      Animated.timing(anim, {
        toValue: Math.sign(paso),
        duration: 90,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(anim, {
        toValue: 0,
        useNativeDriver: true,
        speed: 16,
        bounciness: 10,
      }),
    ]).start();
  }, []);

  /** De -1 a 1: el achique de restar, el quieto, y el estirón de sumar. */
  const escalaDe = (anim: Animated.Value) => ({
    transform: [
      {
        scale: anim.interpolate({
          inputRange: [-1, 0, 1],
          outputRange: [0.88, 1, 1.18],
        }),
      },
    ],
  });

  /*
   * Va acá arriba, con los demás hooks y antes del corte de abajo: los hooks
   * se llaman siempre y en el mismo orden, o React se pierde. Puesto después
   * del `if`, los dibujos sin partido no lo ejecutarían y los que sí, sí.
   */
  const { estampa, compartir } = useCompartirEquipos(split);

  if (!partido) return null;

  const editando = modo === 'edicion';
  /** Si el partido ya tenía resultado cuando se abrió. */
  const yaEstaba = tieneResultado(partido);

  const numero = (v: string) => (v === '' ? 0 : Number(v));


  /** Goles cargados jugador por jugador, sin contar a los que no jugaron. */
  function sumaDe(ids: string[]): number {
    return ids
      .filter((id) => !fuera.includes(id))
      .reduce((acc, id) => acc + numero(aportes[id]?.goles ?? ''), 0);
  }

  const sumaA = sumaDe(partido.equipoA);
  const sumaB = sumaDe(partido.equipoB);

  function setAporte(id: string, campo: 'goles' | 'asistencias', v: string) {
    const siguiente = {
      ...aportes,
      [id]: { ...(aportes[id] ?? { goles: '', asistencias: '' }), [campo]: v },
    };
    setAportes(siguiente);

    if (campo !== 'goles' || !partido) return;

    // Mientras el marcador no se haya escrito a mano, lo llevamos nosotros.
    const suma = (ids: string[]) =>
      ids
        .filter((x) => !fuera.includes(x))
        .reduce((acc, x) => acc + numero(siguiente[x]?.goles ?? ''), 0);

    if (!tocado.a && partido.equipoA.includes(id)) {
      setGolesA(String(suma(partido.equipoA)));
    }
    if (!tocado.b && partido.equipoB.includes(id)) {
      setGolesB(String(suma(partido.equipoB)));
    }
  }

  /**
   * Sube o baja un gol del marcador.
   *
   * Marca el lado como tocado a mano, igual que escribirlo: tocar el más es
   * decidir el marcador, y desde ahí deja de completarse solo con la suma de
   * los goles individuales.
   */
  function cambiarGol(lado: 'a' | 'b', paso: number) {
    const actual = numero(lado === 'a' ? golesA : golesB);
    const siguiente = Math.min(99, Math.max(0, actual + paso));
    // Si ya estaba en el tope no pasa nada, y el número tampoco se mueve: una
    // animación por un cambio que no ocurrió es mentirle al que la mira.
    if (siguiente === actual) return;
    setTocado((prev) => ({ ...prev, [lado]: true }));
    (lado === 'a' ? setGolesA : setGolesB)(String(siguiente));
    pulsar(lado === 'a' ? pulsoA : pulsoB, paso);
  }

  function alternarFuera(id: string) {
    setFuera((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function guardar(golesFinalA: number, golesFinalB: number) {
    const jugo = (id: string) => !fuera.includes(id);
    const actuaciones: Actuacion[] = Object.entries(aportes)
      .filter(([id]) => jugo(id))
      .map(([jugadorId, a]) => ({
        jugadorId,
        goles: numero(a.goles),
        asistencias: numero(a.asistencias),
      }))
      // Sólo se guarda a quien hizo algo: el resto no ocupa lugar.
      .filter((a) => a.goles > 0 || a.asistencias > 0);

    onGuardar({
      fecha: dia.toISOString(),
      equipoA: partido!.equipoA.filter(jugo),
      equipoB: partido!.equipoB.filter(jugo),
      golesA: golesFinalA,
      golesB: golesFinalB,
      actuaciones,
    });
  }

  function handleGuardar() {
    const marcadorA = numero(golesA);
    const marcadorB = numero(golesB);

    // Cargar menos goles que el marcador es normal: hay goles en contra, y a
    // veces nadie se acuerda quién la metió. Cargar más es imposible.
    const sobranA = sumaA > marcadorA;
    const sobranB = sumaB > marcadorB;

    if (sobranA || sobranB) {
      const equipo = sobranA && sobranB ? 'los equipos' : sobranA ? 'A' : 'B';
      const detalle = sobranA
        ? `${sumaA} goles cargados contra un marcador de ${marcadorA}`
        : `${sumaB} goles cargados contra un marcador de ${marcadorB}`;
      preguntar({
        titulo: 'El marcador no cierra',
        mensaje:
          `En el equipo ${equipo} hay ${detalle}. ¿Querés que el marcador ` +
          'tome la suma de los goles cargados?',
        confirmar: 'Usar la suma',
        onConfirmar: () => {
          const finalA = sobranA ? sumaA : marcadorA;
          const finalB = sobranB ? sumaB : marcadorB;
          setGolesA(String(finalA));
          setGolesB(String(finalB));
          guardar(finalA, finalB);
        },
      });
      return;
    }

    guardar(marcadorA, marcadorB);
  }

  const filas = (
    ids: string[],
    titulo: string,
    color: string,
    suma: number,
    marcador: number
  ) => (
    <View style={styles.bloque}>
      <View style={styles.bloqueTitulo}>
        <View style={[styles.punto, { backgroundColor: color }]} />
        <View style={styles.bloqueNombre}>
          <Etiqueta color={color}>{titulo}</Etiqueta>
        </View>
        {/* Sirve para controlar mientras se carga; después es ruido. */}
        {editando ? (
          <Text style={[styles.contados, suma > marcador && styles.contadosMal]}>
            {suma} de {marcador} goles
          </Text>
        ) : null}
        <Text style={styles.encabezado}>G · A</Text>
      </View>
      {ids.map((id) => {
        const salio = fuera.includes(id);
        return (
          <Panel
            key={id}
            style={[styles.fila, salio && styles.filaFuera]}
            esquinas={DIAGONAL}
            chaflan={9}
            fondo={colors.surface}
            borde={colors.border}
          >
            {editando ? (
              <Pressable onPress={() => alternarFuera(id)} hitSlop={8}>
                <Text style={salio ? styles.volver : styles.sacar}>
                  {salio ? '+' : '×'}
                </Text>
              </Pressable>
            ) : null}
            <Text
              style={[styles.nombre, salio && styles.nombreFuera]}
              numberOfLines={1}
            >
              {partido.nombres[id] ?? 'Jugador'}
            </Text>
            {salio ? (
              <Text style={styles.noJugo}>no jugó</Text>
            ) : editando ? (
              <>
                <Contador
                  valor={aportes[id]?.goles ?? ''}
                  onChange={(v) => setAporte(id, 'goles', v)}
                />
                <Contador
                  valor={aportes[id]?.asistencias ?? ''}
                  onChange={(v) => setAporte(id, 'asistencias', v)}
                />
              </>
            ) : (
              <>
                <Dato valor={numero(aportes[id]?.goles ?? '')} />
                <Dato valor={numero(aportes[id]?.asistencias ?? '')} />
              </>
            )}
          </Panel>
        );
      })}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <HeaderModal
            titulo="Resultado"
            izquierda={
              editando && yaEstaba
                ? {
                    // Sale de editar sin tocar nada: vuelve a mostrar lo
                    // guardado en vez de cerrar y perder de vista el partido.
                    label: 'Descartar',
                    onPress: () => {
                      reiniciar();
                      setModo('lectura');
                    },
                  }
                : { label: 'Volver', onPress: onClose }
            }
            /*
             * Compartir se queda con el lugar de arriba, y completar baja al
             * pie. Es lo que se viene a hacer más seguido: al partido que ya
             * está armado se entra el día que se juega, para mandarle la
             * formación al grupo. Antes eso no se podía: guardado el partido,
             * la pantalla de equipos no se abría más y la imagen se perdía.
             */
            derecha={{
              label: 'Compartir',
              onPress: compartir,
              disabled: split === null,
            }}
          />

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
          >
            <View style={styles.marcador}>
              <View style={styles.marcadorLado}>
                <Text style={[styles.marcadorEquipo, { color: colors.teamA }]}>
                  Equipo A
                </Text>
                {editando ? (
                  <>
                    <Animated.View style={escalaDe(pulsoA)}>
                      <CampoTexto
                        value={golesA}
                        onChangeText={(t) => {
                          setTocado((prev) => ({ ...prev, a: true }));
                          setGolesA(t.replace(/[^0-9]/g, '').slice(0, 2));
                        }}
                        keyboardType="number-pad"
                        selectTextOnFocus
                        contenedor={styles.marcadorCaja}
                        style={styles.marcadorInput}
                        placeholder="0"
                      />
                    </Animated.View>
                    <View style={styles.pasos}>
                      <Paso signo="−" onPress={() => cambiarGol('a', -1)} />
                      <Paso signo="+" onPress={() => cambiarGol('a', 1)} />
                    </View>
                  </>
                ) : (
                  <Text style={[styles.marcadorInput, styles.marcadorFijo]}>
                    {numero(golesA)}
                  </Text>
                )}
              </View>
              <Text style={styles.guion}>—</Text>
              <View style={styles.marcadorLado}>
                <Text style={[styles.marcadorEquipo, { color: colors.teamB }]}>
                  Equipo B
                </Text>
                {editando ? (
                  <>
                    <Animated.View style={escalaDe(pulsoB)}>
                      <CampoTexto
                        value={golesB}
                        onChangeText={(t) => {
                          setTocado((prev) => ({ ...prev, b: true }));
                          setGolesB(t.replace(/[^0-9]/g, '').slice(0, 2));
                        }}
                        keyboardType="number-pad"
                        selectTextOnFocus
                        contenedor={styles.marcadorCaja}
                        style={styles.marcadorInput}
                        placeholder="0"
                      />
                    </Animated.View>
                    <View style={styles.pasos}>
                      <Paso signo="−" onPress={() => cambiarGol('b', -1)} />
                      <Paso signo="+" onPress={() => cambiarGol('b', 1)} />
                    </View>
                  </>
                ) : (
                  <Text style={[styles.marcadorInput, styles.marcadorFijo]}>
                    {numero(golesB)}
                  </Text>
                )}
              </View>
            </View>

            {/*
              El día también se corrige acá: si el partido se guardó con la
              fecha equivocada, este es el único lugar donde se puede arreglar.
            */}
            {editando ? (
              <Pressable onPress={() => setEligiendoDia(true)}>
              <Panel
                  style={styles.dia}
                  esquinas={DIAGONAL}
                  chaflan={9}
                  fondo={colors.primary}
                  opacidadFondo={0.1}
                  borde={colors.primary}
                  grosor={1.5}
                >
                  <CalendarIcon color={colors.primary} size={20} />
                  <View style={styles.diaTextos}>
                    <Text style={styles.diaRotulo}>Fecha</Text>
                    <Text style={styles.diaValor}>{comoSeLee(dia)}</Text>
                  </View>
                  <Text style={styles.diaCambiar}>Cambiar</Text>
                </Panel>
              </Pressable>
            ) : null}

            <SelectorFecha
              visible={eligiendoDia}
              valor={dia}
              onElegir={(elegida) => {
                setDia(elegida);
                setEligiendoDia(false);
              }}
              onClose={() => setEligiendoDia(false)}
            />

            {editando ? (
              <Text style={styles.ayuda}>
                Con el marcador alcanza: así se cuentan las victorias, las
                rachas y el nivel de cada uno. Al completar, el partido pasa al
                historial.
              </Text>
            ) : (
              <Text style={styles.ayuda}>
                Este partido ya está jugado. Tocá EDITAR RESULTADO abajo si hay
                algo que corregir.
              </Text>
            )}

            {/*
              Apagado, que es como está casi siempre: en un picado nadie lleva
              la cuenta de quién metió cada gol. El que sí la lleva lo prende
              una vez y le queda prendido para ese plantel.
            */}
            {editando ? (
              <View style={styles.switchRow}>
                <View style={styles.switchTexto}>
                  <Text style={styles.switchTitulo}>
                    Cargar el detalle del partido
                  </Text>
                  <Text style={styles.ayuda}>
                    Opcional. Quién hizo los goles y las asistencias, y si
                    alguno al final no jugó.
                  </Text>
                </View>
                <Switch
                  value={detalle}
                  onValueChange={onDetalle}
                  trackColor={{
                    false: colors.surfaceAlt,
                    true: colors.primaryDark,
                  }}
                  thumbColor={detalle ? colors.primary : colors.textMuted}
                />
              </View>
            ) : null}

            {detalle ? (
              <>
                {editando ? (
                  <Text style={styles.ayuda}>
                    Dejá en blanco lo que no tengas. Si alguien al final no
                    jugó, sacalo con la × y deja de contar. Y mientras no
                    toques el marcador, se completa solo con lo que cargues.
                  </Text>
                ) : null}

                {filas(
                  partido.equipoA,
                  'Equipo A',
                  colors.teamA,
                  sumaA,
                  numero(golesA)
                )}
                {filas(
                  partido.equipoB,
                  'Equipo B',
                  colors.teamB,
                  sumaB,
                  numero(golesB)
                )}
              </>
            ) : null}
          </ScrollView>

          <EstampaOculta referencia={estampa} split={split} plantel={plantel} />

          {/*
            Anclado al pie y no al final de la lista: con el detalle prendido
            hay una fila por jugador, y el botón quedaba a varios scrolls de
            distancia del marcador, que es lo último que se toca.

            Las dos acciones que cambian el partido van juntas acá abajo, y
            compartir se queda arriba: es la única que no modifica nada y la
            única que sale de la app.
          */}
          <View style={styles.footer}>
            <View style={styles.mitad}>
              <Button
                title="Editar equipos"
                variant="ghost"
                onPress={() => setEditandoEquipos(true)}
                disabled={split === null}
              />
            </View>
            <View style={styles.mitad}>
              {editando ? (
                <Button
                  title={yaEstaba ? 'Guardar' : 'Completar'}
                  onPress={handleGuardar}
                />
              ) : (
                <Button
                  title="Editar resultado"
                  onPress={() => setModo('edicion')}
                />
              )}
            </View>
          </View>

          <EditarEquiposModal
            visible={editandoEquipos}
            split={split}
            onSwap={onSwap}
            onClose={() => setEditandoEquipos(false)}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>

      {dialogo}
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.lg, gap: spacing.md },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  mitad: { flex: 1 },
  marcador: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  marcadorLado: { alignItems: 'center', gap: spacing.sm },
  // Los dos botones juntos miden lo mismo que el marcador de arriba: así la
  // columna de cada equipo es un bloque y no tres cosas de anchos distintos.
  pasos: { flexDirection: 'row', gap: spacing.sm },
  paso: { width: 49 },
  pasoCaja: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
  },
  pasoTexto: {
    color: colors.primary,
    fontSize: 26,
    lineHeight: 32,
    fontFamily: 'Barlow_800ExtraBold',
  },
  // Relleno el botón, el verde deja de servir para el signo.
  pasoTextoTocado: { color: colors.sobreAcento },
  marcadorEquipo: { fontSize: 13, fontFamily: 'Barlow_800ExtraBold' },
  marcadorCaja: { width: 106, paddingHorizontal: 0 },
  marcadorInput: {
    textAlign: 'center',
    paddingVertical: 14,
    fontSize: 38,
    fontFamily: 'Barlow_900Black',
  },
  // Mirándolo: mismo cuerpo que el campo, sin el recuadro que invita a
  // escribir.
  marcadorFijo: { width: 106, color: colors.text, lineHeight: 46 },
  dato: {
    width: 46,
    textAlign: 'center',
    paddingVertical: 6,
    color: colors.text,
    fontSize: 15,
    fontFamily: 'Barlow_700Bold',
  },
  datoCero: { color: colors.textMuted },
  guion: { color: colors.textMuted, fontSize: 22, fontFamily: 'Barlow_400Regular', marginTop: 24 },
  dia: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
  },
  diaTextos: { flex: 1 },
  diaRotulo: {
    color: colors.primary,
    fontSize: 10,
    fontFamily: 'Barlow_800ExtraBold',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  // El día en grande: es el dato, no el rótulo.
  diaValor: {
    color: colors.text,
    fontSize: 16,
    fontFamily: 'Barlow_800ExtraBold',
    marginTop: 1,
  },
  diaCambiar: {
    color: colors.primary,
    fontSize: 11,
    fontFamily: 'Barlow_800ExtraBold',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  ayuda: { color: colors.textMuted, fontSize: 12, fontFamily: 'Barlow_400Regular', lineHeight: 17 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
  },
  switchTexto: { flex: 1 },
  switchTitulo: {
    color: colors.text,
    fontSize: 15,
    fontFamily: 'Barlow_700Bold',
    marginBottom: 2,
  },
  bloque: { gap: 6 },
  bloqueTitulo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  punto: { width: 8, height: 8, borderRadius: 4 },
  bloqueNombre: { flex: 1 },
  encabezado: { color: colors.textMuted, fontSize: 11, fontFamily: 'Barlow_700Bold' },
  contados: { color: colors.textMuted, fontSize: 11 , fontFamily: 'Barlow_400Regular'},
  contadosMal: { color: colors.danger, fontFamily: 'Barlow_800ExtraBold' },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  filaFuera: { opacity: 0.55 },
  nombre: { flex: 1, color: colors.text, fontSize: 15 , fontFamily: 'Barlow_400Regular'},
  nombreFuera: { textDecorationLine: 'line-through' },
  sacar: {
    color: colors.danger,
    fontSize: 20,
    fontFamily: 'Barlow_900Black',
    width: 20,
    textAlign: 'center',
  },
  volver: {
    color: colors.primary,
    fontSize: 20,
    fontFamily: 'Barlow_900Black',
    width: 20,
    textAlign: 'center',
  },
  noJugo: { color: colors.textMuted, fontSize: 12, fontFamily: 'Barlow_400Regular', fontStyle: 'italic' },
  contadorCaja: { width: 46, paddingHorizontal: 0 },
  contador: {
    textAlign: 'center',
    paddingVertical: 6,
    fontSize: 15,
    fontFamily: 'Barlow_700Bold',
  },
});
