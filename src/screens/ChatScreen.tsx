import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Panel, { DIAGONAL } from '../components/Angular';
import { useDialogo } from '../components/Dialogo';
import HeaderModal from '../components/HeaderModal';
import { SendIcon } from '../components/icons';
import { Presionable } from '../components/motion';
import { Aviso, Button } from '../components/ui';
import {
  conversacionCon,
  marcarLeido,
  mandarTexto,
  Mensaje,
} from '../nube/amigos';
import { Explicacion, explicar } from '../nube/cuenta';
import { colors, degradados, fuentes, radius, spacing } from '../theme';

/** La hora, que es lo único que hace falta en una conversación del día. */
function hora(cuando: string): string {
  const d = new Date(cuando);
  const hoy = new Date();
  const mismoDia = d.toDateString() === hoy.toDateString();
  return mismoDia
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
}

const ESTADOS = {
  pendiente: { texto: 'Esperando respuesta', color: colors.textMuted },
  aceptado: { texto: 'Aceptado', color: colors.primary },
  rechazado: { texto: 'Rechazado', color: colors.danger },
} as const;

/**
 * La conversación con un amigo: lo que se escribieron y los planteles que se
 * pasaron, en el mismo hilo.
 *
 * Los mensajes se traen al abrir y después de mandar algo. No hay refresco
 * periódico a propósito: mantendría despierta la base sin que haya nada nuevo.
 * Lo que trae los mensajes nuevos es el aviso que llega cuando el otro
 * escribe.
 */
export default function ChatScreen({
  con,
  onClose,
  onAceptar,
  onRechazar,
  refrescos,
}: {
  /** Con quién, por su nombre de usuario. Null cierra la pantalla. */
  con: string | null;
  onClose: () => void;
  onAceptar: (envio: string) => Promise<void>;
  onRechazar: (envio: string) => Promise<void>;
  /**
   * Sube de a uno cuando llega un aviso de que hay algo nuevo. Es lo que
   * dispara la recarga, en vez de un reloj.
   */
  refrescos: number;
}) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState('');
  const [cargando, setCargando] = useState(false);
  const [mandando, setMandando] = useState(false);
  const [resolviendo, setResolviendo] = useState<string | null>(null);
  const [error, setError] = useState<Explicacion | null>(null);
  const lista = useRef<FlatList<Mensaje>>(null);

  const traer = useCallback(
    async (mostrarVuelta: boolean) => {
      if (!con) return;
      if (mostrarVuelta) setCargando(true);
      try {
        const traidos = await conversacionCon(con);
        setMensajes(traidos);
        setError(null);
        // Se marca leído acá y no al abrir: recién ahora se sabe que llegaron.
        await marcarLeido(con).catch(() => {});
      } catch (problema) {
        setError(explicar(problema));
      } finally {
        setCargando(false);
      }
    },
    [con]
  );

  useEffect(() => {
    if (!con) {
      setMensajes([]);
      setTexto('');
      return;
    }
    traer(true);
  }, [con, traer]);

  // Un aviso de que el otro mandó algo: se recarga esta conversación y nada
  // más. Es el reemplazo del refresco cada tantos segundos.
  useEffect(() => {
    if (refrescos > 0 && con) traer(false);
  }, [refrescos, con, traer]);

  const handleMandar = async () => {
    const limpio = texto.trim();
    if (!limpio || !con) return;
    setMandando(true);
    try {
      await mandarTexto(con, limpio);
      setTexto('');
      await traer(false);
    } catch (problema) {
      setError(explicar(problema));
    } finally {
      setMandando(false);
    }
  };

  const resolver = async (envio: string, acepta: boolean) => {
    setResolviendo(envio);
    try {
      await (acepta ? onAceptar(envio) : onRechazar(envio));
      await traer(false);
    } catch (problema) {
      setError(explicar(problema));
    } finally {
      setResolviendo(null);
    }
  };

  return (
    <Modal visible={con !== null} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <HeaderModal
            titulo={con ? `@${con}` : ''}
            izquierda={{ label: 'Volver', onPress: onClose }}
          />

          {error ? (
            <View style={styles.avisoCaja}>
              <Aviso titulo={error.titulo} detalle={error.detalle} />
            </View>
          ) : null}

          <FlatList
            ref={lista}
            data={mensajes}
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.lista}
            refreshing={cargando}
            onRefresh={() => traer(true)}
            onContentSizeChange={() =>
              lista.current?.scrollToEnd({ animated: false })
            }
            ListEmptyComponent={
              cargando ? null : (
                <Text style={styles.vacio}>
                  Todavía no se escribieron nada. Podés mandarle un plantel
                  desde la tuerca del plantel, en Exportar.
                </Text>
              )
            }
            renderItem={({ item }) => {
              if (item.tipo === 'plantel' && item.plantel) {
                const estado = ESTADOS[item.plantel.estado];
                return (
                  <Panel
                    style={[styles.plantel, item.mio ? styles.mio : styles.suyo]}
                    degradado={degradados.panel}
                    borde={
                      item.plantel.estado === 'pendiente'
                        ? colors.primary
                        : colors.border
                    }
                    grosor={1.5}
                    esquinas={DIAGONAL}
                  >
                    <Text style={styles.plantelTitulo}>
                      {item.mio ? 'Le mandaste un plantel' : 'Te mandó un plantel'}
                    </Text>
                    <Text style={styles.plantelNombre}>
                      {item.plantel.nombre}
                    </Text>
                    <Text style={styles.plantelDetalle}>
                      {item.plantel.jugadores}{' '}
                      {item.plantel.jugadores === 1 ? 'jugador' : 'jugadores'} ·{' '}
                      {item.plantel.partidos}{' '}
                      {item.plantel.partidos === 1 ? 'partido' : 'partidos'}
                    </Text>

                    {!item.mio && item.plantel.estado === 'pendiente' ? (
                      <View style={styles.botones}>
                        <Button
                          title="Aceptar"
                          onPress={() => resolver(item.plantel!.envio, true)}
                          disabled={resolviendo !== null}
                          loading={resolviendo === item.plantel.envio}
                          compacto
                        />
                        <Button
                          title="Rechazar"
                          onPress={() => resolver(item.plantel!.envio, false)}
                          disabled={resolviendo !== null}
                          variant="ghost"
                          compacto
                        />
                      </View>
                    ) : (
                      <Text style={[styles.estado, { color: estado.color }]}>
                        {estado.texto}
                      </Text>
                    )}
                    <Text style={styles.hora}>{hora(item.cuando)}</Text>
                  </Panel>
                );
              }

              return (
                <View
                  style={[
                    styles.burbuja,
                    item.mio ? styles.burbujaMia : styles.burbujaSuya,
                  ]}
                >
                  <Text
                    style={item.mio ? styles.textoMio : styles.textoSuyo}
                  >
                    {item.texto}
                  </Text>
                  <Text
                    style={[
                      styles.hora,
                      item.mio ? styles.horaMia : styles.horaSuya,
                    ]}
                  >
                    {hora(item.cuando)}
                  </Text>
                </View>
              );
            }}
          />

          <View style={styles.escribir}>
            <TextInput
              value={texto}
              onChangeText={setTexto}
              placeholder="Escribí algo"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              multiline
              maxLength={1000}
            />
            <Presionable
              onPress={handleMandar}
              disabled={texto.trim().length === 0 || mandando}
              style={[
                styles.mandar,
                texto.trim().length === 0 && styles.mandarApagado,
              ]}
            >
              <SendIcon color={colors.sobreAcento} size={20} />
            </Presionable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  avisoCaja: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  lista: {
    padding: spacing.md,
    gap: spacing.sm,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  vacio: {
    color: colors.textMuted,
    fontSize: 13,
    fontFamily: fuentes.regular,
    lineHeight: 19,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  // Los míos a la derecha y los suyos a la izquierda, que es como se lee una
  // conversación en cualquier lado.
  burbuja: {
    maxWidth: '82%',
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderRadius: radius.md,
  },
  burbujaMia: { alignSelf: 'flex-end', backgroundColor: colors.primaryDark },
  burbujaSuya: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textoMio: { color: colors.text, fontSize: 15, fontFamily: fuentes.regular },
  textoSuyo: { color: colors.text, fontSize: 15, fontFamily: fuentes.regular },
  hora: {
    fontSize: 10,
    fontFamily: fuentes.regular,
    color: colors.textMuted,
    marginTop: 3,
  },
  horaMia: { textAlign: 'right' },
  horaSuya: {},
  plantel: { maxWidth: '88%', padding: spacing.md, gap: 2 },
  mio: { alignSelf: 'flex-end' },
  suyo: { alignSelf: 'flex-start' },
  plantelTitulo: {
    color: colors.primary,
    fontSize: 10,
    fontFamily: fuentes.extra,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  plantelNombre: { color: colors.text, fontSize: 16, fontFamily: fuentes.display },
  plantelDetalle: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: fuentes.regular,
  },
  botones: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  estado: {
    fontSize: 11,
    fontFamily: fuentes.bold,
    letterSpacing: 0.3,
    marginTop: 4,
  },
  escribir: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    maxHeight: 110,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 15,
    fontFamily: fuentes.regular,
  },
  mandar: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mandarApagado: { opacity: 0.4 },
});
