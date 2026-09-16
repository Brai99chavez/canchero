import React, { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDialogo } from '../components/Dialogo';
import HeaderModal from '../components/HeaderModal';
import { Etiqueta } from '../components/Banner';
import { colors, radius, spacing } from '../theme';
import { tieneResultado } from '../stats';
import { Actuacion, Partido } from '../types';

interface Props {
  visible: boolean;
  partido: Partido | null;
  onClose: () => void;
  onGuardar: (cambios: {
    equipoA: string[];
    equipoB: string[];
    golesA: number;
    golesB: number;
    actuaciones: Actuacion[];
  }) => void;
}

type Aportes = Record<string, { goles: string; asistencias: string }>;

/** Campo numérico chico: sólo dígitos, vacío cuenta como cero. */
function Contador({
  valor,
  onChange,
}: {
  valor: string;
  onChange: (v: string) => void;
}) {
  return (
    <TextInput
      value={valor}
      onChangeText={(t) => onChange(t.replace(/[^0-9]/g, '').slice(0, 2))}
      keyboardType="number-pad"
      selectTextOnFocus
      style={styles.contador}
      placeholder="0"
      placeholderTextColor={colors.textMuted}
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
    setTocado({
      a: partido.golesA !== null,
      b: partido.golesB !== null,
    });
  }, [partido]);

  useEffect(() => {
    if (!visible || !partido) return;
    reiniciar();
    // El que ya tiene resultado se abre para mirar; el que no, para cargarlo,
    // que es justo lo que se venía a hacer desde la lista de activos.
    setModo(tieneResultado(partido) ? 'lectura' : 'edicion');
  }, [visible, partido, reiniciar]);

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
          <View key={id} style={[styles.fila, salio && styles.filaFuera]}>
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
          </View>
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
                    label: 'Cancelar',
                    onPress: () => {
                      reiniciar();
                      setModo('lectura');
                    },
                  }
                : { label: editando ? 'Cancelar' : 'Cerrar', onPress: onClose }
            }
            derecha={
              editando
                ? {
                    label: yaEstaba ? 'Guardar' : 'Completar',
                    onPress: handleGuardar,
                  }
                : { label: 'Editar', onPress: () => setModo('edicion') }
            }
          />

          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.marcador}>
              <View style={styles.marcadorLado}>
                <Text style={[styles.marcadorEquipo, { color: colors.teamA }]}>
                  Equipo A
                </Text>
                {editando ? (
                  <TextInput
                    value={golesA}
                    onChangeText={(t) => {
                      setTocado((prev) => ({ ...prev, a: true }));
                      setGolesA(t.replace(/[^0-9]/g, '').slice(0, 2));
                    }}
                    keyboardType="number-pad"
                    selectTextOnFocus
                    style={styles.marcadorInput}
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                  />
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
                  <TextInput
                    value={golesB}
                    onChangeText={(t) => {
                      setTocado((prev) => ({ ...prev, b: true }));
                      setGolesB(t.replace(/[^0-9]/g, '').slice(0, 2));
                    }}
                    keyboardType="number-pad"
                    selectTextOnFocus
                    style={styles.marcadorInput}
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                  />
                ) : (
                  <Text style={[styles.marcadorInput, styles.marcadorFijo]}>
                    {numero(golesB)}
                  </Text>
                )}
              </View>
            </View>

            {editando ? (
              <Text style={styles.ayuda}>
                Los goles y asistencias son opcionales: dejá en blanco lo que no
                tengas. Con el marcador solo ya se cuentan victorias y rachas.
                Si alguien al final no jugó, sacalo con la × y deja de contar.
                Al completar, el partido pasa al historial y entra en las
                estadísticas.
                Mientras no toques el marcador, se completa solo con los goles
                que vayas cargando.
              </Text>
            ) : (
              <Text style={styles.ayuda}>
                Este partido ya está jugado. Tocá EDITAR arriba si hay algo que
                corregir.
              </Text>
            )}

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
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {dialogo}
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 64, gap: spacing.md },
  marcador: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  marcadorLado: { alignItems: 'center', gap: spacing.sm },
  marcadorEquipo: { fontSize: 13, fontFamily: 'Barlow_800ExtraBold' },
  marcadorInput: {
    width: 84,
    textAlign: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 30,
    fontFamily: 'Barlow_900Black',
  },
  // El marcador mirándolo: mismo tamaño que el campo, sin el recuadro que
  // invita a escribir.
  marcadorFijo: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    lineHeight: 36,
  },
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
  ayuda: { color: colors.textMuted, fontSize: 12, fontFamily: 'Barlow_400Regular', lineHeight: 17 },
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
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
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
  contador: {
    width: 46,
    textAlign: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    paddingVertical: 6,
    color: colors.text,
    fontSize: 15,
    fontFamily: 'Barlow_700Bold',
  },
});
