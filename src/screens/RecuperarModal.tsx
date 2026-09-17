import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Seccion } from '../components/Banner';
import CampoTexto from '../components/CampoTexto';
import HeaderModal from '../components/HeaderModal';
import { EyeIcon, EyeOffIcon } from '../components/icons';
import { Aviso, Button } from '../components/ui';
import { cambiarClave, Explicacion, explicar } from '../nube/cuenta';
import { Recuperacion } from '../nube/enlaces';
import { colors, fuentes, spacing } from '../theme';

interface Props {
  /** Lo que trajo el link del mail. Con null la pantalla no existe. */
  pedido: Recuperacion | null;
  onClose: () => void;
  /** Se llama cuando la contraseña quedó cambiada, para ir a entrar. */
  onListo: () => void;
}

/**
 * Elegir una contraseña nueva, después de tocar el link del mail.
 *
 * Se abre sola: no hay forma de llegar acá desde adentro de la app, porque
 * hace falta el token que el servidor mandó por correo. Eso es justamente lo
 * que prueba que la casilla es tuya.
 */
export default function RecuperarModal({ pedido, onClose, onListo }: Props) {
  const [clave, setClave] = useState('');
  const [repetida, setRepetida] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<Explicacion | null>(null);
  const [listo, setListo] = useState(false);

  const token = pedido?.token ?? null;

  useEffect(() => {
    if (!pedido) return;
    setClave('');
    setRepetida('');
    setVerClave(false);
    setTrabajando(false);
    setListo(false);
    // Un link vencido llega sin token y con el motivo: se muestra de entrada,
    // en vez de dejar escribir una contraseña que no se va a poder guardar.
    setError(
      pedido.token ? null : explicar(new Error(pedido.error ?? 'invalid token'))
    );
  }, [pedido]);

  const coinciden = clave.length > 0 && clave === repetida;
  const valido = Boolean(token) && clave.length >= 8 && coinciden;

  const handleGuardar = async () => {
    if (!token) return;
    setTrabajando(true);
    setError(null);
    try {
      await cambiarClave(token, clave);
      setClave('');
      setRepetida('');
      setListo(true);
    } catch (problema) {
      setError(explicar(problema));
    } finally {
      setTrabajando(false);
    }
  };

  return (
    <Modal
      visible={pedido !== null}
      animationType="slide"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <HeaderModal
            titulo="Contraseña nueva"
            izquierda={{ label: 'Volver', onPress: onClose }}
          />

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
          >
            {listo ? (
              <>
                <Seccion>Listo</Seccion>
                <Text style={styles.ayuda}>
                  Ya podés entrar con tu contraseña nueva. Si tenías la sesión
                  abierta en otro teléfono, ahí sigue como estaba.
                </Text>
                <Button title="Entrar" onPress={onListo} style={styles.boton} />
              </>
            ) : (
              <>
                <Seccion>Elegí una nueva</Seccion>
                <Text style={styles.ayuda}>
                  Llegaste desde el link que te mandamos por mail. Escribí la
                  contraseña que vas a usar de ahora en adelante.
                </Text>

                {error ? (
                  <Aviso titulo={error.titulo} detalle={error.detalle} />
                ) : null}

                <CampoTexto
                  value={clave}
                  onChangeText={(t) => {
                    setClave(t);
                    setError(null);
                  }}
                  placeholder="Contraseña (mínimo 8)"
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry={!verClave}
                  editable={Boolean(token)}
                  derecha={
                    <Pressable
                      onPress={() => setVerClave((v) => !v)}
                      hitSlop={10}
                      accessibilityLabel={
                        verClave ? 'Ocultar contraseña' : 'Ver contraseña'
                      }
                    >
                      {verClave ? (
                        <EyeOffIcon color={colors.textMuted} size={20} />
                      ) : (
                        <EyeIcon color={colors.textMuted} size={20} />
                      )}
                    </Pressable>
                  }
                />

                {/*
                  Se pide dos veces porque acá no hay a quién preguntarle: si
                  se escribe mal y queda guardada, la única salida es pedir
                  otro mail y empezar de nuevo.
                */}
                <CampoTexto
                  value={repetida}
                  onChangeText={(t) => {
                    setRepetida(t);
                    setError(null);
                  }}
                  placeholder="Repetila"
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry={!verClave}
                  editable={Boolean(token)}
                  onSubmitEditing={valido ? handleGuardar : undefined}
                  returnKeyType="done"
                />

                {repetida.length > 0 && !coinciden ? (
                  <Text style={styles.noCoincide}>
                    Las dos contraseñas no son iguales.
                  </Text>
                ) : null}

                <Button
                  title="Guardar contraseña"
                  onPress={handleGuardar}
                  disabled={!valido}
                  loading={trabajando}
                  style={styles.boton}
                />
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xl },
  boton: { marginTop: spacing.sm },
  ayuda: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: fuentes.regular,
    lineHeight: 17,
  },
  noCoincide: {
    color: colors.danger,
    fontSize: 12,
    fontFamily: fuentes.bold,
    letterSpacing: 0.3,
  },
});
