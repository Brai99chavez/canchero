import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { SILUETA } from '../assets';
import { Seccion } from '../components/Banner';
import HeaderModal from '../components/HeaderModal';
import { EyeIcon, EyeOffIcon } from '../components/icons';
import { useDialogo } from '../components/Dialogo';
import Opcion from '../components/Opcion';
import { Aviso, Button } from '../components/ui';
import {
  entrar,
  pedirRecuperacion,
  Explicacion,
  explicar,
  registrarse,
  salir,
  Sesion,
} from '../nube/cuenta';
import { subirFoto } from '../nube/fotos';
import {
  guardarPerfil,
  leerPerfil,
  normalizar,
  Perfil,
  problemaDelUsuario,
} from '../nube/perfil';
import { cleanupPhotos, discardPhoto, pickPhoto } from '../photos';
import { colors, fuentes, radius, spacing } from '../theme';

interface Props {
  visible: boolean;
  sesion: Sesion | null;
  /** Cuántos planteles hay en el teléfono, para explicar qué se va a subir. */
  cuantosPlanteles: number;
  ultimaCopia: string | null;
  /** Si hay cambios en el teléfono que todavía no llegaron a la cuenta. */
  haySinSubir: boolean;
  onClose: () => void;
  onBackup: () => Promise<void>;
  /** Trae la copia y devuelve cuántos planteles vinieron. */
  onRestaurar: () => Promise<number>;
}

type Modo = 'entrar' | 'registro';
/** Las dos mitades de la pantalla de cuenta. */
type Pestania = 'respaldo' | 'perfil';

/** El id con el que se guardan las copias locales de la foto de perfil. */
const FOTO_PERFIL = 'perfil';

export default function CuentaModal({
  visible,
  sesion,
  cuantosPlanteles,
  ultimaCopia,
  haySinSubir,
  onClose,
  onBackup,
  onRestaurar,
}: Props) {
  const [modo, setModo] = useState<Modo>('entrar');
  const [pestania, setPestania] = useState<Pestania>('perfil');
  const [email, setEmail] = useState('');
  const [clave, setClave] = useState('');
  const [trabajando, setTrabajando] = useState(false);
  const [verClave, setVerClave] = useState(false);
  const [error, setError] = useState<Explicacion | null>(null);
  const { dialogo, avisar, preguntar } = useDialogo();

  /** Lo que hay guardado en la cuenta. Null mientras no llegó. */
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [usuario, setUsuario] = useState('');
  /**
   * El cambio de foto que todavía no se guardó. Tres estados y no dos:
   *
   *   undefined -> no se tocó
   *   null      -> se pidió sacarla
   *   "file://" -> se eligió una nueva, acá en el teléfono
   *
   * Con un solo `string | null` no hay forma de distinguir "no toqué nada" de
   * "quiero sacarla", y sacar la foto quedaba sin poder guardarse.
   */
  const [fotoPendiente, setFotoPendiente] = useState<
    string | null | undefined
  >(undefined);
  /** Lo mismo, para poder limpiar al cerrar sin depender del render. */
  const pendienteRef = useRef<string | null | undefined>(undefined);
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);
  const [errorPerfil, setErrorPerfil] = useState<Explicacion | null>(null);
  const [guardado, setGuardado] = useState(false);

  /**
   * Anota el cambio de foto y borra la copia local que deja de servir. Todo
   * pasa por acá para que no queden archivos sueltos en el teléfono.
   */
  const ponerFotoPendiente = useCallback(
    (valor: string | null | undefined) => {
      const previa = pendienteRef.current;
      if (typeof previa === 'string' && previa !== valor) discardPhoto(previa);
      pendienteRef.current = valor;
      setFotoPendiente(valor);
    },
    []
  );

  useEffect(() => {
    if (visible) {
      setClave('');
      setTrabajando(false);
      setVerClave(false);
      setError(null);
      setPestania('perfil');
      return;
    }
    // Al cerrar sin guardar, la foto elegida no le sirve a nadie.
    ponerFotoPendiente(undefined);
  }, [visible, ponerFotoPendiente]);

  /** Trae el perfil al abrir con la sesión puesta, y al iniciarla. */
  useEffect(() => {
    if (!visible || !sesion) {
      setPerfil(null);
      return;
    }
    let vigente = true;
    leerPerfil()
      .then((traido) => {
        if (!vigente) return;
        setPerfil(traido);
        setUsuario(traido.usuario ?? '');
        ponerFotoPendiente(undefined);
        setErrorPerfil(null);
        setGuardado(false);
      })
      .catch((problema) => {
        if (vigente) setErrorPerfil(explicar(problema));
      });
    return () => {
      vigente = false;
    };
  }, [visible, sesion, ponerFotoPendiente]);

  const valido = email.trim().includes('@') && clave.length >= 8;

  async function conAviso(accion: () => Promise<void>) {
    setTrabajando(true);
    setError(null);
    try {
      await accion();
    } catch (problema) {
      setError(explicar(problema));
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
        avisar(
          'Revisá tu mail',
          `Te mandamos un link a ${email.trim()} para confirmar la cuenta. ` +
            'Tocalo y después entrá desde acá: lo último que falta es elegir ' +
            'tu nombre de usuario. Fijate también en spam.'
        );
        setModo('entrar');
      }
    });

  const handleOlvide = () => {
    const limpio = email.trim();
    if (!limpio.includes('@')) {
      setError({
        titulo: 'Escribí tu mail primero',
        detalle: 'Ponelo arriba y volvé a tocar acá para que te mandemos el link.',
      });
      return;
    }
    conAviso(async () => {
      await pedirRecuperacion(limpio);
      avisar(
        'Revisá tu mail',
        `Si hay una cuenta con ${limpio}, te llega un link para elegir una ` +
          'contraseña nueva. Vence en una hora, y fijate también en spam.'
      );
    });
  };

  const handleSalir = () => {
    if (haySinSubir) {
      preguntar({
        titulo: 'Tenés cambios sin guardar',
        mensaje:
          'Hiciste cambios en tus planteles que todavía no están en la nube. ' +
          'Si cerrás la sesión ahora, esos cambios quedan sólo en este ' +
          'teléfono: si lo perdés o reinstalás la app, no hay de dónde ' +
          'sacarlos. Conviene hacer un backup antes.',
        confirmar: 'Cerrar igual',
        peligro: true,
        alternativa: {
          label: 'Hacer backup y cerrar',
          onPress: () =>
            conAviso(async () => {
              await onBackup();
              await salir();
            }),
        },
        onConfirmar: () => conAviso(salir),
      });
      return;
    }

    preguntar({
      titulo: 'Cerrar sesión',
      mensaje:
        'Los planteles siguen en este teléfono, con todo lo que tienen. La ' +
        'copia de la nube queda guardada para cuando vuelvas a entrar.',
      confirmar: 'Cerrar sesión',
      onConfirmar: () => conAviso(salir),
    });
  };

  const handleRestaurar = () =>
    preguntar({
      titulo: 'Traer de la nube',
      mensaje:
        `Los ${cuantosPlanteles} ${
          cuantosPlanteles === 1 ? 'plantel' : 'planteles'
        } de este teléfono se reemplazan por los de tu cuenta. ` +
        'Si acá tenés algo que no subiste, se pierde.',
      confirmar: 'Traer',
      peligro: true,
      onConfirmar: () =>
        conAviso(async () => {
          const cuantos = await onRestaurar();
          if (cuantos === 0) {
            avisar(
              'No hay nada guardado',
              'Tu cuenta todavía no tiene planteles.'
            );
            return;
          }
          onClose();
        }),
    });

  // ───────────────────────────────────────────────────────────── perfil

  const handleElegirFoto = useCallback(async () => {
    const elegida = await pickPhoto(FOTO_PERFIL);
    if (!elegida) return;
    ponerFotoPendiente(elegida);
    setGuardado(false);
    setErrorPerfil(null);
  }, [ponerFotoPendiente]);

  const handleSacarFoto = useCallback(() => {
    ponerFotoPendiente(null);
    setGuardado(false);
  }, [ponerFotoPendiente]);

  const nombreLimpio = normalizar(usuario);
  const nombreAnterior = perfil?.usuario ?? '';
  const problemaNombre =
    nombreLimpio === '' ? null : problemaDelUsuario(nombreLimpio);

  const fotoGuardada = perfil?.foto ?? null;
  /*
   * Pedir sacar una foto que no existe no es un cambio: si no, apenas se abre
   * y se toca algo, el botón se prendería sin nada que guardar.
   */
  const fotoCambio =
    fotoPendiente !== undefined &&
    !(fotoPendiente === null && fotoGuardada === null);

  /** Si hay algo distinto de lo que está guardado en la cuenta. */
  const hayCambios =
    perfil !== null && (nombreLimpio !== nombreAnterior || fotoCambio);

  const handleGuardarPerfil = async () => {
    if (!perfil) return;
    setGuardandoPerfil(true);
    setErrorPerfil(null);
    try {
      const cambios: { usuario?: string | null; foto?: string | null } = {};

      if (nombreLimpio !== nombreAnterior) cambios.usuario = nombreLimpio;

      if (typeof fotoPendiente === 'string') {
        // La imagen va derecho a R2; al perfil sólo le llega la URL.
        cambios.foto = await subirFoto(fotoPendiente, 'perfil');
      } else if (fotoPendiente === null) {
        cambios.foto = null;
      }

      const guardadoPerfil = await guardarPerfil(cambios);
      setPerfil(guardadoPerfil);
      setUsuario(guardadoPerfil.usuario ?? '');
      // Ya está arriba: las copias locales no hacen falta más.
      cleanupPhotos(FOTO_PERFIL);
      ponerFotoPendiente(undefined);
      setGuardado(true);
    } catch (problema) {
      setErrorPerfil(explicar(problema));
    } finally {
      setGuardandoPerfil(false);
    }
  };

  /** Qué foto mostrar: el cambio sin guardar gana sobre lo que hay arriba. */
  const fotoEnPantalla =
    fotoPendiente !== undefined ? fotoPendiente : fotoGuardada;

  const vistaPerfil = (
    <>
      <Seccion>Tu perfil</Seccion>
      <Text style={styles.ayuda}>
        Así te van a ver tus amigos. El nombre de usuario es para que puedan
        encontrarte y mandarte un plantel sin que les pases tu mail.
      </Text>

      {errorPerfil ? (
        <Aviso titulo={errorPerfil.titulo} detalle={errorPerfil.detalle} />
      ) : null}

      {/*
        Al registrarse todavía no hay sesión —falta confirmar el mail— y sin
        sesión no hay dónde guardar el nombre. Así que se pide acá, que es el
        primer momento en que se puede: la primera vez que entra, esta pantalla
        es la que abre.
      */}
      {perfil !== null && !perfil.usuario ? (
        <Aviso
          tono="pendiente"
          titulo="Elegí tu nombre de usuario"
          detalle="Es con lo que tus amigos te van a encontrar para pasarte un plantel. Podés cambiarlo cuando quieras."
        />
      ) : null}

      {perfil === null ? (
        <Text style={styles.cargando}>Trayendo tu perfil…</Text>
      ) : (
        <>
          <View style={styles.fotoFila}>
            <Pressable onPress={handleElegirFoto} style={styles.fotoMarco}>
              {fotoEnPantalla ? (
                <Image
                  source={{ uri: fotoEnPantalla }}
                  style={styles.foto}
                  resizeMode="cover"
                />
              ) : (
                <Image
                  source={SILUETA}
                  style={styles.silueta}
                  resizeMode="contain"
                />
              )}
            </Pressable>
            <View style={styles.fotoTextos}>
              <Button
                title={fotoEnPantalla ? 'Cambiar foto' : 'Poner una foto'}
                onPress={handleElegirFoto}
                variant="ghost"
                compacto
              />
              {fotoEnPantalla ? (
                <Button
                  title="Sacar la foto"
                  onPress={handleSacarFoto}
                  variant="ghost"
                  compacto
                />
              ) : null}
            </View>
          </View>

          <Seccion style={styles.seccion}>Nombre de usuario</Seccion>
          <View style={styles.campoUsuario}>
            <Text style={styles.arroba}>@</Text>
            <TextInput
              value={usuario}
              onChangeText={(t) => {
                setUsuario(t);
                setErrorPerfil(null);
                setGuardado(false);
              }}
              placeholder="comotellaman"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, styles.inputUsuario]}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={20}
            />
          </View>

          {problemaNombre ? (
            <Text style={styles.problema}>{problemaNombre}</Text>
          ) : (
            <Text style={styles.ayuda}>
              Entre 3 y 20 letras, sin espacios ni acentos. Se guarda todo en
              minúscula, así no hay dos parecidos que se confundan.
            </Text>
          )}

          {guardado ? (
            <Text style={styles.guardado}>Perfil guardado.</Text>
          ) : null}

          <Button
            title="Guardar perfil"
            onPress={handleGuardarPerfil}
            disabled={!hayCambios || problemaNombre !== null}
            loading={guardandoPerfil}
            style={styles.boton}
          />

          <Seccion style={styles.seccion}>Tu mail</Seccion>
          <Text style={styles.mail}>{perfil.email}</Text>
          <Text style={styles.nota}>
            El mail no lo ve nadie: es sólo para entrar y para recuperar la
            cuenta si te olvidás la contraseña.
          </Text>

          {error ? (
            <Aviso titulo={error.titulo} detalle={error.detalle} />
          ) : null}

          <Button
            title="Cerrar sesión"
            onPress={handleSalir}
            variant="ghost"
            style={styles.salir}
          />
        </>
      )}
    </>
  );

  const vistaRespaldo = (
    <>
      {error ? <Aviso titulo={error.titulo} detalle={error.detalle} /> : null}

      {haySinSubir ? (
        <Aviso
          titulo="Hay cambios sin guardar"
          detalle="Tocá HACER BACKUP para subirlos a tu cuenta."
        />
      ) : null}

      <Seccion>Backup</Seccion>
      <Text style={styles.ayuda}>
        Guarda tus planteles en la cuenta. Se hace sólo cuando tocás el botón:
        si se guardara solo, borrar un plantel sin querer se llevaría puesta la
        copia de la que ibas a recuperarlo.
      </Text>
      <Text style={[styles.estado, haySinSubir && styles.estadoPendiente]}>
        {haySinSubir
          ? 'Hay cambios sin guardar en la nube.'
          : ultimaCopia
          ? `Guardado a las ${ultimaCopia}.`
          : 'Todavía no guardaste nada en esta sesión.'}
      </Text>
      <Button
        title="Hacer backup"
        onPress={() => conAviso(onBackup)}
        loading={trabajando}
        style={styles.boton}
      />

      <Seccion style={styles.seccion}>Restore</Seccion>
      <Text style={styles.ayuda}>
        Trae los planteles de tu cuenta a este teléfono. Es para cuando cambiás
        de aparato o reinstalás la app: reemplaza los {cuantosPlanteles}{' '}
        {cuantosPlanteles === 1 ? 'plantel' : 'planteles'} que tenés acá por los
        de la nube.
      </Text>
      <Button
        title="Restaurar en este teléfono"
        onPress={handleRestaurar}
        variant="ghost"
        style={styles.boton}
      />

      <Text style={styles.nota}>
        Las fotos de los jugadores viajan con el backup. El resto del plantel va
        entero.
      </Text>
    </>
  );

  const vistaEntrar = (
    <>
      <Seccion>{modo === 'entrar' ? 'Entrar' : 'Crear cuenta'}</Seccion>
      <Text style={styles.ayuda}>
        La cuenta guarda tus planteles para que no se pierdan si cambiás de
        teléfono. La app funciona igual sin ella.
      </Text>

      {error ? <Aviso titulo={error.titulo} detalle={error.detalle} /> : null}

      <TextInput
        value={email}
        onChangeText={(t) => {
          setEmail(t);
          setError(null);
        }}
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
          onChangeText={(t) => {
            setClave(t);
            setError(null);
          }}
          placeholder="Contraseña (mínimo 8)"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, styles.inputClave]}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry={!verClave}
          onSubmitEditing={modo === 'entrar' ? handleEntrar : handleRegistro}
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
        title={modo === 'entrar' ? 'No tengo cuenta' : 'Ya tengo cuenta'}
        onPress={() => setModo(modo === 'entrar' ? 'registro' : 'entrar')}
        variant="ghost"
      />
      {modo === 'entrar' ? (
        <Button
          title="Olvidé mi contraseña"
          onPress={handleOlvide}
          variant="ghost"
        />
      ) : null}
    </>
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

          {/* Sin sesión no hay nada que separar: es una sola pantalla. */}
          {sesion ? (
            <View style={styles.pestanias}>
              <Opcion
                label="Respaldo"
                activa={pestania === 'respaldo'}
                onPress={() => setPestania('respaldo')}
              />
              <Opcion
                label="Perfil"
                activa={pestania === 'perfil'}
                onPress={() => setPestania('perfil')}
              />
            </View>
          ) : null}

          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            {!sesion
              ? vistaEntrar
              : pestania === 'respaldo'
              ? vistaRespaldo
              : vistaPerfil}
          </ScrollView>
        </KeyboardAvoidingView>

        {dialogo}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xl },
  pestanias: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  seccion: { marginTop: spacing.xl },
  mail: { color: colors.text, fontSize: 16, fontFamily: fuentes.bold },
  estadoPendiente: { color: colors.danger },
  estado: {
    color: colors.primary,
    fontSize: 12,
    fontFamily: fuentes.bold,
    letterSpacing: 0.3,
  },
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
  // La arroba va fija a la izquierda: el nombre no la lleva adentro, pero es
  // como se lo va a escribir y a leer en cualquier otro lado.
  campoUsuario: { justifyContent: 'center' },
  inputUsuario: { paddingLeft: 34 },
  arroba: {
    position: 'absolute',
    left: spacing.md,
    color: colors.textMuted,
    fontSize: 16,
    fontFamily: fuentes.bold,
  },
  fotoFila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  fotoMarco: {
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
  foto: { width: '100%', height: '100%' },
  silueta: { width: '62%', height: '62%', opacity: 0.5 },
  fotoTextos: { flex: 1, alignItems: 'flex-start' },
  boton: { marginTop: spacing.sm },
  salir: { marginTop: spacing.xl },
  ayuda: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: fuentes.regular,
    lineHeight: 17,
  },
  problema: {
    color: colors.danger,
    fontSize: 12,
    fontFamily: fuentes.bold,
    lineHeight: 17,
  },
  guardado: {
    color: colors.primary,
    fontSize: 12,
    fontFamily: fuentes.bold,
    letterSpacing: 0.3,
  },
  cargando: {
    color: colors.textMuted,
    fontSize: 13,
    fontFamily: fuentes.regular,
    marginTop: spacing.md,
  },
  nota: {
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: fuentes.regular,
    lineHeight: 16,
    marginTop: spacing.sm,
  },
});
