import Slider from '@react-native-community/slider';
import React, { useEffect, useState } from 'react';
import {
  Image,
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
import { ZonaGuia } from '../components/Guia';
import { useDialogo } from '../components/Dialogo';
import HeaderModal from '../components/HeaderModal';
import { SILUETA } from '../assets';
import Opcion from '../components/Opcion';
import PlayerCard, { ResumenCarta } from '../components/PlayerCard';
import { Button, RatingBadge } from '../components/ui';
import { discardPhoto, pickPhoto } from '../photos';
import { newId } from '../storage';
import { Seccion } from '../components/Banner';
import { colors, radius, spacing } from '../theme';
import {
  DEFAULT_STATS,
  Player,
  Position,
  POSITIONS,
  POSITION_COLORS,
  POSITION_HINTS,
  STAT_KEYS,
  STAT_LABELS,
  Stats,
  StatKey,
} from '../types';

const MIN_STAT = 1;
const MAX_STAT = 99;

/** De a cuánto puede moverse cada barra. */
const STEPS = [1, 5, 10];

/** Redondea al múltiplo de paso más cercano, sin salirse del rango. */
function snap(value: number, step: number): number {
  const rounded = Math.round(value / step) * step;
  return Math.min(MAX_STAT, Math.max(MIN_STAT, rounded));
}

interface Props {
  visible: boolean;
  player: Player | null;
  /** Partidos, goles y asistencias del jugador, para mostrar en la carta. */
  resumen?: ResumenCarta;
  onClose: () => void;
  onSave: (player: Player) => void;
  onDelete?: (id: string) => void;
}

function StatRow({
  label,
  value,
  step,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <View style={styles.statBlock}>
      <View style={styles.statHeader}>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={styles.statValue}>{value}</Text>
      </View>
      <Slider
        minimumValue={MIN_STAT}
        maximumValue={MAX_STAT}
        step={1}
        value={value}
        onValueChange={(next: number) => onChange(snap(next, step))}
        minimumTrackTintColor={colors.primary}
        maximumTrackTintColor={colors.surfaceAlt}
        thumbTintColor={colors.primary}
      />
    </View>
  );
}

export default function PlayerFormModal({
  visible,
  player,
  resumen,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const [editing, setEditing] = useState(false);
  const { dialogo, avisar, preguntar } = useDialogo();
  const [id, setId] = useState('');
  const [nombre, setNombre] = useState('');
  const [posicion, setPosicion] = useState<Position>('MED');
  const [stats, setStats] = useState<Stats>({ ...DEFAULT_STATS });
  const [foto, setFoto] = useState<string | undefined>(undefined);
  // De a 5 por defecto: clavar un valor exacto arrastrando es incómodo, y
  // para estimar a ojo a un amigo, cinco puntos es la resolución justa.
  const [step, setStep] = useState(5);

  // Un jugador existente abre en modo carta; uno nuevo, directo a la carga.
  useEffect(() => {
    if (!visible) return;
    // El id se decide al abrir porque la foto se copia a disco con ese nombre,
    // antes de que el jugador exista en el plantel.
    setId(player?.id ?? newId());
    setNombre(player?.nombre ?? '');
    setPosicion(player?.posicion ?? 'MED');
    setStats(player ? { ...player.stats } : { ...DEFAULT_STATS });
    setFoto(player?.foto);
    setEditing(player === null);
  }, [visible, player]);

  const media = Math.round(
    STAT_KEYS.reduce((acc, k) => acc + stats[k], 0) / STAT_KEYS.length
  );

  async function handlePickPhoto() {
    const elegida = await pickPhoto(id);
    if (!elegida) return;
    // Si ya había una foto nueva sin guardar, esa copia queda al pedo.
    if (foto && foto !== player?.foto) discardPhoto(foto);
    setFoto(elegida);
  }

  function handleRemovePhoto() {
    if (foto && foto !== player?.foto) discardPhoto(foto);
    setFoto(undefined);
  }

  function handleSave() {
    const name = nombre.trim();
    if (!name) {
      avisar('Falta el nombre', 'Escribí el nombre del jugador.');
      return;
    }
    onSave({ id, nombre: name, posicion, stats, foto });
  }

  // Cancelar vuelve a la carta si el jugador ya existía; si es nuevo, cierra.
  function handleCancel() {
    // Al cancelar se descarta la foto que se eligió y no llegó a guardarse.
    if (foto && foto !== player?.foto) discardPhoto(foto);

    if (player) {
      setNombre(player.nombre);
      setPosicion(player.posicion);
      setStats({ ...player.stats });
      setFoto(player.foto);
      setEditing(false);
      return;
    }
    onClose();
  }

  function handleDelete() {
    if (!player || !onDelete) return;
    preguntar({
      titulo: 'Borrar jugador',
      mensaje: `Se elimina a ${player.nombre} del plantel.`,
      confirmar: 'Borrar',
      peligro: true,
      onConfirmar: () => onDelete(player.id),
    });
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* El modal es otra ventana: necesita su propia capa de foco. */}
        <ZonaGuia>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <HeaderModal
            titulo={
              !editing
                ? 'Jugador'
                : player
                ? 'Editar jugador'
                : 'Nuevo jugador'
            }
            izquierda={{
              label: editing ? 'Cancelar' : 'Cerrar',
              onPress: editing ? handleCancel : onClose,
            }}
            derecha={{
              label: editing ? 'Guardar' : 'Editar',
              onPress: editing ? handleSave : () => setEditing(true),
            }}
          />

          {!editing && player ? (
            <ScrollView contentContainerStyle={styles.cardContent}>
              <PlayerCard player={player} resumen={resumen} />
              <Button
                title="Editar jugador"
                onPress={() => setEditing(true)}
                style={styles.cardButton}
              />
              {onDelete ? (
                <Button
                  title="Borrar jugador"
                  variant="danger"
                  onPress={handleDelete}
                  style={styles.cardButtonGhost}
                />
              ) : null}
            </ScrollView>
          ) : (
            <ScrollView
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.identityRow}>
                <Pressable onPress={handlePickPhoto} style={styles.fotoFrame}>
                  {foto ? (
                    <Image
                      source={{ uri: foto }}
                      style={styles.fotoPreview}
                      resizeMode="cover"
                    />
                  ) : (
                    <Image
                      source={SILUETA}
                      style={styles.siluetaChica}
                      resizeMode="contain"
                    />
                  )}
                </Pressable>

                <View style={styles.identityFields}>
                  <TextInput
                      value={nombre}
                      onChangeText={setNombre}
                      placeholder="Nombre"
                      placeholderTextColor={colors.textMuted}
                      style={styles.input}
                    autoCapitalize="words"
                  />
                  <View style={styles.fotoLinks}>
                    <Pressable onPress={handlePickPhoto} hitSlop={8}>
                      <Text style={styles.fotoLink}>
                        {foto ? 'Cambiar foto' : 'Elegir foto'}
                      </Text>
                    </Pressable>
                    {foto ? (
                      <Pressable onPress={handleRemovePhoto} hitSlop={8}>
                        <Text style={styles.fotoRemove}>Quitar</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              </View>

              <Seccion>Posición</Seccion>
              <View style={styles.positionGrid}>
                {POSITIONS.map((pos) => {
                  const active = pos === posicion;
                  return (
                    <Pressable
                      key={pos}
                      onPress={() => setPosicion(pos)}
                      style={[
                        styles.positionChip,
                        pos === 'LIB' && styles.positionChipWide,
                        active && {
                          backgroundColor: POSITION_COLORS[pos] + '26',
                          borderColor: POSITION_COLORS[pos],
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.positionChipText,
                          active && { color: POSITION_COLORS[pos] },
                        ]}
                      >
                        {pos}
                      </Text>
                      <Text style={styles.positionChipHint} numberOfLines={1}>
                        {POSITION_HINTS[pos]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.statsHeader}>
                <Seccion style={styles.seccionPlana}>Estadísticas</Seccion>
                <RatingBadge value={media} size={46} />
              </View>

              <View style={styles.stepRow}>
                <Text style={styles.stepLabel}>Mover de a</Text>
                {STEPS.map((value) => (
                  <Opcion
                    key={value}
                    label={String(value)}
                    activa={value === step}
                    onPress={() => setStep(value)}
                    style={styles.stepChip}
                  />
                ))}
              </View>

              {STAT_KEYS.map((key: StatKey) => (
                <StatRow
                  key={key}
                  label={STAT_LABELS[key]}
                  value={stats[key]}
                  step={step}
                  onChange={(next) =>
                    setStats((prev) => ({ ...prev, [key]: next }))
                  }
                />
              ))}

              {player && onDelete ? (
                <Button
                  title="Borrar jugador"
                  variant="danger"
                  onPress={handleDelete}
                  style={{ marginTop: spacing.lg }}
                />
              ) : null}
            </ScrollView>
          )}
        </KeyboardAvoidingView>
        </ZonaGuia>
      </SafeAreaView>

      {dialogo}
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: {
    flex: 1,
  },
  cardContent: {
    padding: spacing.lg,
    paddingTop: spacing.xl,
    gap: spacing.md,
  },
  cardButton: {
    marginTop: spacing.lg,
  },
  cardButtonGhost: {
    marginTop: 0,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 64,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  identityFields: {
    flex: 1,
    gap: spacing.sm,
  },
  fotoFrame: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fotoPreview: {
    width: '100%',
    height: '100%',
  },
  // La foto llena el aro; la silueta va suelta adentro, más chica.
  siluetaChica: {
    width: 42,
    height: 42,
    opacity: 0.85,
  },
  fotoLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingLeft: spacing.xs,
  },
  fotoLink: {
    color: colors.primary,
    fontSize: 13,
    fontFamily: 'Barlow_700Bold',
  },
  fotoRemove: {
    color: colors.danger,
    fontSize: 13,
    fontFamily: 'Barlow_700Bold',
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    color: colors.text,
    fontSize: 16,
    fontFamily: 'Barlow_400Regular',
  },
  seccionPlana: {
    marginTop: 0,
    marginBottom: 0,
  },
  statsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  stepLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontFamily: 'Barlow_400Regular',
    marginRight: spacing.xs,
  },
  stepChip: {
    maxWidth: 62,
    backgroundColor: colors.surface,
  },
  positionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  positionChip: {
    flexGrow: 1,
    flexBasis: '22%',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  positionChipWide: {
    flexBasis: '100%',
  },
  positionChipText: {
    color: colors.text,
    fontFamily: 'Barlow_800ExtraBold',
    fontSize: 14,
  },
  positionChipHint: {
    color: colors.textMuted,
    fontSize: 9,
    fontFamily: 'Barlow_400Regular',
    marginTop: 2,
  },
  statBlock: {
    marginBottom: spacing.md,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    color: colors.text,
    fontSize: 14,
    fontFamily: 'Barlow_400Regular',
  },
  statValue: {
    color: colors.primary,
    fontSize: 16,
    fontFamily: 'Barlow_800ExtraBold',
  },
});
