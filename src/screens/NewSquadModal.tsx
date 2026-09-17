import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ZonaGuia } from '../components/Guia';
import CampoTexto from '../components/CampoTexto';
import HeaderModal from '../components/HeaderModal';
import CierraTeclado from '../components/Teclado';
import { Seccion } from '../components/Banner';
import { colors, spacing } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  onCrear: (nombre: string) => void;
}

export default function NewSquadModal({ visible, onClose, onCrear }: Props) {
  const [nombre, setNombre] = useState('');

  useEffect(() => {
    if (visible) setNombre('');
  }, [visible]);

  const valido = nombre.trim().length > 0;

  function handleCrear() {
    const limpio = nombre.trim();
    if (!limpio) return;
    onCrear(limpio);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <CierraTeclado>
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          {/* El modal es otra ventana: necesita su propia capa de foco. */}
          <ZonaGuia>
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <HeaderModal
              titulo="Nuevo plantel"
              izquierda={{ label: 'Cancelar', onPress: onClose }}
              derecha={{
                label: 'Crear',
                onPress: handleCrear,
                disabled: !valido,
              }}
            />

            <View style={styles.content}>
              <Seccion>Nombre del grupo</Seccion>
              <CampoTexto
                value={nombre}
                onChangeText={setNombre}
                placeholder="Los del sábado, Trabajo, Barrio…"
                autoCapitalize="words"
                autoFocus
                onSubmitEditing={handleCrear}
                returnKeyType="done"
              />
              <Text style={styles.ayuda}>
                Cada plantel tiene sus propios jugadores. Después podés cargarlos,
                exportarlo o marcarlo para que la app abra directo acá.
              </Text>
            </View>
          </KeyboardAvoidingView>
          </ZonaGuia>
        </SafeAreaView>
      </CierraTeclado>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.sm },
  ayuda: { color: colors.textMuted, fontSize: 12, fontFamily: 'Barlow_400Regular', lineHeight: 17 },
});
