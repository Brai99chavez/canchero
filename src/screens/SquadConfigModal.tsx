import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDialogo } from '../components/Dialogo';
import CampoTexto from '../components/CampoTexto';
import HeaderModal from '../components/HeaderModal';
import { Button } from '../components/ui';
import { Seccion } from '../components/Banner';
import { Amigo } from '../nube/amigos';
import { colors, spacing } from '../theme';
import { Squad } from '../types';
import EnviarModal from './EnviarModal';

export interface CambiosPlantel {
  nombre: string;
}

interface Props {
  visible: boolean;
  plantel: Squad | null;

  /** A quiénes se les puede pasar el plantel. */
  amigos: Amigo[];
  onClose: () => void;
  onGuardar: (cambios: CambiosPlantel) => void;
  onBorrar: () => void;
  /** Mandar sube las fotos que faltaban: hay que guardar las URLs nuevas. */
  onFotosSubidas: (plantel: Squad) => void;
  /** Para el que quiere compartir y todavía no tiene amigos cargados. */
  onIrAAmigos: () => void;
}

export default function SquadConfigModal({
  visible,
  plantel,

  amigos,
  onClose,
  onGuardar,
  onBorrar,
  onFotosSubidas,
  onIrAAmigos,
}: Props) {
  // Todo se edita en borrador y recién se aplica con Guardar.
  const [nombre, setNombre] = useState('');
  const { dialogo, avisar, preguntar } = useDialogo();

  const [enviarVisible, setEnviarVisible] = useState(false);

  useEffect(() => {
    if (!visible || !plantel) return;
    setNombre(plantel.nombre);
  }, [visible, plantel]);

  if (!plantel) return null;

  const hayCambios = nombre.trim() !== plantel.nombre;
  const puedeGuardar = nombre.trim().length > 0 && hayCambios;

  function handleGuardar() {
    const limpio = nombre.trim();
    if (!limpio) {
      avisar('Falta el nombre', 'El plantel necesita un nombre.');
      return;
    }
    onGuardar({ nombre: limpio });
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

  function handleCompartir() {
    if (!plantel) return;
    if (plantel.jugadores.length === 0) {
      avisar('Nada para compartir', 'Este plantel no tiene jugadores.');
      return;
    }
    setEnviarVisible(true);
  }

  function handleBorrar() {
    if (!plantel) return;

    const cuantos = `${plantel.jugadores.length} ${
      plantel.jugadores.length === 1 ? 'jugador' : 'jugadores'
    }`;

    /*
     * De la papelera se saca una sola vez. Al que ya salió hay que avisarle
     * antes, no después: es la última pantalla donde se puede arrepentir, y lo
     * que se va no vuelve de ningún lado.
     */
    if (plantel.yaVolvio) {
      preguntar({
        titulo: 'Esto no se puede deshacer',
        mensaje:
          `"${plantel.nombre}" ya lo sacaste de la papelera una vez. Si lo ` +
          `borrás ahora se elimina para siempre: los ${cuantos}, sus fotos y ` +
          'los partidos jugados. No va a quedar en la papelera. ¿Seguimos?',
        confirmar: 'Borrar para siempre',
        peligro: true,
        onConfirmar: onBorrar,
      });
      return;
    }

    preguntar({
      titulo: 'Borrar plantel',
      mensaje:
        `Se elimina "${plantel.nombre}" con sus ${cuantos}. Queda en la ` +
        'papelera de tu cuenta y lo podés recuperar desde ahí, una vez.',
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
            izquierda={{ label: 'Volver', onPress: handleCerrar }}
            derecha={{
              label: 'Guardar',
              onPress: handleGuardar,
              disabled: !puedeGuardar,
            }}
          />

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
          >
            <Seccion>Nombre</Seccion>
            <CampoTexto
              value={nombre}
              onChangeText={setNombre}
              autoCapitalize="words"
            />

            {hayCambios ? (
              <Text style={styles.aviso}>
                Hay cambios sin guardar. Tocá Guardar arriba a la derecha.
              </Text>
            ) : null}

            <Seccion>Compartir</Seccion>
            <Text style={styles.ayuda}>
              Le pasás una copia a un amigo de la app: los{' '}
              {plantel.jugadores.length}{' '}
              {plantel.jugadores.length === 1 ? 'jugador' : 'jugadores'} con sus
              fotos, sus stats y el historial de partidos. Desde que la acepta
              es suya, y lo que cambie cada uno no toca lo del otro.
            </Text>
            <Button title="Compartir este plantel" onPress={handleCompartir} />

            <Seccion>Zona peligrosa</Seccion>
            <Button
              title="Borrar plantel"
              variant="danger"
              onPress={handleBorrar}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <EnviarModal
        visible={enviarVisible}
        plantel={plantel}
        amigos={amigos}
        onClose={() => setEnviarVisible(false)}
        onFotosSubidas={onFotosSubidas}
        onIrAAmigos={() => {
          setEnviarVisible(false);
          onClose();
          onIrAAmigos();
        }}
      />

      {dialogo}
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 64, gap: spacing.sm },
  ayuda: { color: colors.textMuted, fontSize: 12, fontFamily: 'Barlow_400Regular', lineHeight: 17 },
  aviso: {
    color: colors.primary,
    fontSize: 12,
    fontFamily: 'Barlow_700Bold',
    marginTop: spacing.xs,
  },
});
