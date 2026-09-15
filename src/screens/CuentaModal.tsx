import React, { useEffect, useState } from 'react';
import {
  Alert,
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
import { Seccion } from '../components/Banner';
import HeaderModal from '../components/HeaderModal';
import { EyeIcon, EyeOffIcon } from '../components/icons';
import { Button } from '../components/ui';
import { entrar, registrarse, salir, Sesion } from '../nube/cuenta';
import { colors, fuentes, radius, spacing } from '../theme';

interface Props {
  visible: boolean;
  sesion: Sesion | null;
  /** Cuántos planteles hay en el teléfono, para explicar qué se va a subir. */
  cuantosPlanteles: number;
  ultimaCopia: string | null;
  onClose: () => void;
  onGuardarAhora: () => Promise<void>;
  onRestaurar: () => void;
}

type Modo = 'entrar' | 'registro';

export default function CuentaModal({
  visible,
  sesion,
  cuantosPlanteles,
  ultimaCopia,
  onClose,
  onGuardarAhora,
  onRestaurar,
}: Props) {
  const [modo, setModo] = useState<Modo>('entrar');
  const [email, setEmail] = useState('');
  const [clave, setClave] = useState('');
  const [trabajando, setTrabajando] = useState(false);
  const [verClave, setVerClave] = useState(false);

  useEffect(() => {
    if (visible) {
      setClave('');
      setTrabajando(false);
      setVerClave(false);
    }
  }, [visible]);

  const valido = email.trim().includes('@') && clave.length >= 8;

  async function conAviso(accion: () => Promise<void>) {
    setTrabajando(true);
    try {
      await accion();
    } catch (error) {
      Alert.alert('No se pudo', String(error instanceof Error ? error.message : error));
    } finally {
      setTrabajando(false);
    }
  }

  const handleEntrar = () =>
    conAviso(async () => {
      await entrar(email, clave);
      setClave('');
    });

  const handleRegistro = () =>
    conAviso(async () => {
      const alta = await registrarse(email, clave);
      setClave('');
      if (alta.faltaConfirmar) {
        Alert.alert(
          'Revisá tu mail',
          'Te mandamos un link para confirmar la cuenta. Después entrá desde acá.'
        );
        setModo('entrar');
      }
    });

  const handleSalir = () =>
    Alert.alert(
      'Cerrar sesión',
      'Los planteles siguen en este teléfono. La copia de la nube queda guardada para cuando vuelvas a entrar.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesión',
          style: 'destructive',
          onPress: () => conAviso(salir),
        },
      ]
    );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <HeaderModal
            titulo="Cuenta"
            izquierda={{ label: 'Cerrar', onPress: onClose }}
          />

          <ScrollView contentContainerStyle={styles.content}>
            {sesion ? (
              <>
                <Seccion>Sesión iniciada</Seccion>
                <Text style={styles.mail}>{sesion.email}</Text>
                <Text style={styles.ayuda}>
                  {ultimaCopia
                    ? `Última copia: ${ultimaCopia}.`
                    : 'Todavía no se guardó ninguna copia en esta sesión.'}{' '}
                  Se guarda sola cada vez que cambiás algo.
                </Text>

                <Button
                  title="Guardar ahora"
                  onPress={() => conAviso(onGuardarAhora)}
                  loading={trabajando}
                  style={styles.boton}
                />

                <Seccion style={styles.seccion}>Teléfono nuevo</Seccion>
                <Text style={styles.ayuda}>
                  Traer la copia reemplaza los {cuantosPlanteles}{' '}
                  {cuantosPlanteles === 1 ? 'plantel' : 'planteles'} que tenés
                  acá por los de la nube. Es para cuando cambiás de teléfono, no
                  para todos los días.
                </Text>
                <Button
                  title="Traer de la nube"
                  onPress={onRestaurar}
                  variant="ghost"
                  style={styles.boton}
                />

                <Text style={styles.nota}>
                  Las fotos de los jugadores no se suben todavía: son archivos
                  de este teléfono. El resto viaja entero.
                </Text>

                <Button
                  title="Cerrar sesión"
                  onPress={handleSalir}
                  variant="ghost"
                  style={styles.salir}
                />
              </>
            ) : (
              <>
                <Seccion>
                  {modo === 'entrar' ? 'Entrar' : 'Crear cuenta'}
                </Seccion>
                <Text style={styles.ayuda}>
                  La cuenta guarda tus planteles para que no se pierdan si
                  cambiás de teléfono. La app funciona igual sin ella.
                </Text>

                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Mail"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  inputMode="email"
                />
                <View style={styles.campoClave}>
                  <TextInput
                    value={clave}
                    onChangeText={setClave}
                    placeholder="Contraseña (mínimo 8)"
                    placeholderTextColor={colors.textMuted}
                    style={[styles.input, styles.inputClave]}
                    autoCapitalize="none"
                    autoCorrect={false}
                    secureTextEntry={!verClave}
                    onSubmitEditing={
                      modo === 'entrar' ? handleEntrar : handleRegistro
                    }
                    returnKeyType="done"
                  />
                  <Pressable
                    onPress={() => setVerClave((v) => !v)}
                    hitSlop={10}
                    style={styles.ojo}
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
                </View>

                <Button
                  title={modo === 'entrar' ? 'Entrar' : 'Crear cuenta'}
                  onPress={modo === 'entrar' ? handleEntrar : handleRegistro}
                  disabled={!valido}
                  loading={trabajando}
                  style={styles.boton}
                />
                <Button
                  title={
                    modo === 'entrar'
                      ? 'No tengo cuenta'
                      : 'Ya tengo cuenta'
                  }
                  onPress={() =>
                    setModo(modo === 'entrar' ? 'registro' : 'entrar')
                  }
                  variant="ghost"
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
  seccion: { marginTop: spacing.xl },
  mail: { color: colors.text, fontSize: 16, fontFamily: fuentes.bold },
  campoClave: { justifyContent: 'center' },
  // Sitio para el ojo, que va encima y no empuja el texto.
  inputClave: { paddingRight: 46 },
  ojo: { position: 'absolute', right: 0, paddingHorizontal: spacing.md },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    color: colors.text,
    fontSize: 16,
    fontFamily: fuentes.regular,
  },
  boton: { marginTop: spacing.sm },
  salir: { marginTop: spacing.xl },
  ayuda: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: fuentes.regular,
    lineHeight: 17,
  },
  nota: {
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: fuentes.regular,
    lineHeight: 16,
    marginTop: spacing.sm,
  },
});
