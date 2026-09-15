import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDialogo } from '../components/Dialogo';
import HeaderModal from '../components/HeaderModal';
import { Button } from '../components/ui';
import { Seccion } from '../components/Banner';
import { colors, radius, spacing } from '../theme';
import { Squad } from '../types';
import ExportarModal from './ExportarModal';

export interface CambiosPlantel {
  nombre: string;
  predeterminado: boolean;
}

interface Props {
  visible: boolean;
  plantel: Squad | null;
  esPredeterminado: boolean;
  onClose: () => void;
  onGuardar: (cambios: CambiosPlantel) => void;
  onBorrar: () => void;
}

export default function SquadConfigModal({
  visible,
  plantel,
  esPredeterminado,
  onClose,
  onGuardar,
  onBorrar,
}: Props) {
  // Todo se edita en borrador y recién se aplica con Guardar.
  const [nombre, setNombre] = useState('');
  const { dialogo, avisar, preguntar } = useDialogo();
  const [predeterminado, setPredeterminado] = useState(false);
  const [exportarVisible, setExportarVisible] = useState(false);

  useEffect(() => {
    if (!visible || !plantel) return;
    setNombre(plantel.nombre);
    setPredeterminado(esPredeterminado);
  }, [visible, plantel, esPredeterminado]);

  if (!plantel) return null;

  const hayCambios =
    nombre.trim() !== plantel.nombre || predeterminado !== esPredeterminado;
  const puedeGuardar = nombre.trim().length > 0 && hayCambios;

  function handleGuardar() {
    const limpio = nombre.trim();
    if (!limpio) {
      avisar('Falta el nombre', 'El plantel necesita un nombre.');
      return;
    }
    onGuardar({ nombre: limpio, predeterminado });
  }

  function handleCerrar() {
    if (!hayCambios) {
      onClose();
      return;
    }
    preguntar({
      titulo: 'Descartar cambios',
      mensaje: 'Hay cambios sin guardar.',
      confirmar: 'Descartar',
      peligro: true,
      onConfirmar: onClose,
    });
  }

  function handleExportar() {
    if (!plantel) return;
    if (plantel.jugadores.length === 0) {
      avisar('Nada para exportar', 'Este plantel no tiene jugadores.');
      return;
    }
    setExportarVisible(true);
  }

  function handleBorrar() {
    if (!plantel) return;
    preguntar({
      titulo: 'Borrar plantel',
      mensaje:
        `Se elimina "${plantel.nombre}" con sus ${plantel.jugadores.length} ` +
        'jugadores, y también sus fotos. No se puede deshacer.',
      confirmar: 'Borrar',
      peligro: true,
      onConfirmar: onBorrar,
    });
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleCerrar}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <HeaderModal
            titulo="Config del plantel"
            izquierda={{ label: 'Cancelar', onPress: handleCerrar }}
            derecha={{
              label: 'Guardar',
              onPress: handleGuardar,
              disabled: !puedeGuardar,
            }}
          />

          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <Seccion>Nombre</Seccion>
            <TextInput
              value={nombre}
              onChangeText={setNombre}
              style={styles.input}
              autoCapitalize="words"
            />

            <Seccion>Al abrir la app</Seccion>
            <View style={styles.switchRow}>
              <View style={styles.switchTexto}>
                <Text style={styles.switchTitulo}>Abrir este plantel</Text>
                <Text style={styles.ayuda}>
                  Con esto activado la app entra directo acá. Si lo apagás,
                  arranca mostrando la lista de planteles.
                </Text>
              </View>
              <Switch
                value={predeterminado}
                onValueChange={setPredeterminado}
                trackColor={{
                  false: colors.surfaceAlt,
                  true: colors.primaryDark,
                }}
                thumbColor={predeterminado ? colors.primary : colors.textMuted}
              />
            </View>

            {hayCambios ? (
              <Text style={styles.aviso}>
                Hay cambios sin guardar. Tocá Guardar arriba a la derecha.
              </Text>
            ) : null}

            <Seccion>Respaldo</Seccion>
            <Text style={styles.ayuda}>
              Exporta sólo este plantel: {plantel.jugadores.length}{' '}
              {plantel.jugadores.length === 1 ? 'jugador' : 'jugadores'}. Guarda
              nombre, posición y stats; las fotos quedan en el teléfono.
            </Text>
            <Button title="Exportar este plantel" onPress={handleExportar} />

            <Seccion>Zona peligrosa</Seccion>
            <Button
              title="Borrar plantel"
              variant="danger"
              onPress={handleBorrar}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <ExportarModal
        visible={exportarVisible}
        plantel={plantel}
        onClose={() => setExportarVisible(false)}
      />

      {dialogo}
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 64, gap: spacing.sm },
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
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  switchTexto: { flex: 1 },
  switchTitulo: {
    color: colors.text,
    fontSize: 15,
    fontFamily: 'Barlow_700Bold',
    marginBottom: 2,
  },
  ayuda: { color: colors.textMuted, fontSize: 12, fontFamily: 'Barlow_400Regular', lineHeight: 17 },
  aviso: {
    color: colors.primary,
    fontSize: 12,
    fontFamily: 'Barlow_700Bold',
    marginTop: spacing.xs,
  },
});
