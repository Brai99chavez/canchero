import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SILUETA } from '../assets';
import { Seccion } from '../components/Banner';
import CampoTexto from '../components/CampoTexto';
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
  reenviarConfirmacion,
  salir,
  Sesion,
} from '../nube/cuenta';
import { subirFoto } from '../nube/fotos';
import {
  EnPapelera,
  restaurarDePapelera,
  verPapelera,
} from '../nube/sync';
import Panel, { DIAGONAL } from '../components/Angular';
import { comoSeLeeCorto } from '../fechas';
import {
  guardarPerfil,
  leerPerfil,
  normalizar,
  Perfil,
  perfilEnMemoria,
  problemaDelUsuario,
} from '../nube/perfil';
import { cleanupPhotos, discardPhoto, pickPhoto } from '../photos';
import { colors, fuentes, spacing } from '../theme';

interface Props {
  sesion: Sesion | null;
  /** Cuántos planteles hay en el teléfono, para explicar qué se va a subir. */
  cuantosPlanteles: number;
  ultimaCopia: string | null;
  /** Si hay cambios en el teléfono que todavía no llegaron a la cuenta. */
  haySinSubir: boolean;
  /** Vuelve a traer lo que haya en la papelera y lo recuperado. */
  onRecuperado: () => void;
}

type Modo = 'entrar' | 'registro';
/** Las dos mitades de la pantalla de cuenta. */
type Pestania = 'respaldo' | 'perfil';

/** El id con el que se guardan las copias locales de la foto de perfil. */
const FOTO_PERFIL = 'perfil';

/**
 * La sección Perfil: quién sos y qué se guarda de lo tuyo.
 *
 * Adentro hay dos mitades, porque son dos cosas distintas: Perfil es "yo" —la
 * foto, el nombre con el que te encuentran— y Respaldo es "mis datos". Abre en
 * Perfil, que es lo que se mira y se toca; el respaldo se usa de vez en cuando.
 */
export default function PerfilScreen({
  sesion,
  cuantosPlanteles,
  ultimaCopia,
  haySinSubir,
  onRecuperado,
}: Props) {
  const [modo, setModo] = useState<Modo>('entrar');
  const [pestania, setPestania] = useState<Pestania>('perfil');
  const [email, setEmail] = useState('');
  const [clave, setClave] = useState('');
  const [trabajando, setTrabajando] = useState(false);
  const [verClave, setVerClave] = useState(false);
  const [error, setError] = useState<Explicacion | null>(null);
  const { dialogo, avisar, preguntar } = useDialogo();

  /*
   * Arranca con lo último que se supo, si es que ya se supo algo. Volver a la
   * sección no tiene por qué mostrar "trayendo tu perfil" ni despertar la base
   * para traer algo que casi nunca cambia.
   */
  const [perfil, setPerfil] = useState<Perfil | null>(() => perfilEnMemoria());
  const [refrescando, setRefrescando] = useState(false);
  const [usuario, setUsuario] = useState(() => perfilEnMemoria()?.usuario ?? '');
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
  /** Lo que hay en la papelera. Null mientras no se miró. */
  const [papelera, setPapelera] = useState<{
    planteles: EnPapelera[];
    dias: number;
  } | null>(null);
  const [recuperando, setRecuperando] = useState<string | null>(null);
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

  // Al irse de la sección, la foto elegida y sin guardar no le sirve a nadie.
  useEffect(() => () => ponerFotoPendiente(undefined), [ponerFotoPendiente]);

  /** Trae el perfil al abrir con la sesión puesta, y al iniciarla. */
  const traerPerfil = useCallback(
    (refrescar: boolean) => {
      if (!sesion) return Promise.resolve();
      return leerPerfil(refrescar)
        .then((traido) => {
          setPerfil(traido);
          setUsuario(traido.usuario ?? '');
          ponerFotoPendiente(undefined);
          setErrorPerfil(null);
          setGuardado(false);
        })
        .catch((problema) => setErrorPerfil(explicar(problema)));
    },
    [sesion, ponerFotoPendiente]
  );

  useEffect(() => {
    if (!sesion) {
      setPerfil(null);
      return;
    }
    // Sin `refrescar`: si ya está en memoria esto no pide nada.
    traerPerfil(false);
  }, [sesion, traerPerfil]);

  /*
   * La papelera se mira al entrar a esa pestaña y no al abrir la sección: casi
   * nadie la va a abrir, y pedirla siempre es despertar la base para nada.
   */
  const mirarPapelera = useCallback(() => {
    if (!sesion) return;
    verPapelera()
      .then(setPapelera)
      .catch(() => setPapelera({ planteles: [], dias: 30 }));
  }, [sesion]);

  useEffect(() => {
    if (pestania === 'respaldo') mirarPapelera();
  }, [pestania, mirarPapelera]);

  const handleRecuperar = async (id: string) => {
    setRecuperando(id);
    setError(null);
    try {
      await restaurarDePapelera(id);
      // Que la lista de planteles se entere: el que volvió tiene que aparecer.
      onRecuperado();
      mirarPapelera();
    } catch (problema) {
      setError(explicar(problema));
    } finally {
      setRecuperando(null);
    }
  };

  /** El tirón hacia abajo: la forma de pedirlo de nuevo a propósito. */
  const handleRefrescar = () => {
    setRefrescando(true);
    traerPerfil(true).finally(() => setRefrescando(false));
  };

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
        /*
         * No se afirma que se mandó el mail, porque puede no haberse mandado:
         * si ese mail ya tenía cuenta, el servidor contesta que sí igual —para
         * no delatar qué direcciones están registradas— pero no manda nada. El
         * cartel decía "te mandamos un link" y a veces era mentira.
         */
        avisar(
          'Revisá tu mail',
          `Si ${email.trim()} todavía no tenía cuenta, te llega un link para ` +
            'confirmarla. Fijate también en spam. Si ya tenías cuenta con ese ' +
            'mail, entrá con tu contraseña.'
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

  const handleReenviar = () => {
    const limpio = email.trim();
    if (!limpio.includes('@')) {
      setError({
        titulo: 'Escribí tu mail primero',
        detalle: 'Ponelo arriba y volvé a tocar acá.',
      });
      return;
    }
    conAviso(async () => {
      await reenviarConfirmacion(limpio);
      avisar(
        'Listo',
        `Si ${limpio} tiene una cuenta sin confirmar, te acabamos de mandar ` +
          'otro link. Fijate también en spam.'
      );
    });
  };

  const handleSalir = () => {
    if (haySinSubir) {
      preguntar({
        titulo: 'Tenés cambios sin subir',
        mensaje:
          'Hay algo que todavía no llegó a tu cuenta —seguramente porque no ' +
          'hubo internet—. Si cerrás la sesión ahora, eso queda sólo en este ' +
          'teléfono. Esperá a tener señal y va a subir solo.',
        confirmar: 'Cerrar igual',
        peligro: true,
        onConfirmar: () => conAviso(salir),
      });
      return;
    }

    preguntar({
      titulo: 'Cerrar sesión',
      mensaje:
        'Tus planteles quedan guardados en la cuenta. Cuando vuelvas a entrar, ' +
        'desde este teléfono o desde otro, van a estar ahí.',
      confirmar: 'Cerrar sesión',
      onConfirmar: () => conAviso(salir),
    });
  };

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
          <CampoTexto
            izquierda={<Text style={styles.arroba}>@</Text>}
            value={usuario}
            onChangeText={(t) => {
              setUsuario(t);
              setErrorPerfil(null);
              setGuardado(false);
            }}
            placeholder="comotellaman"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={20}
          />

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

      <Seccion>Tus datos</Seccion>
      <Text style={styles.ayuda}>
        Todo lo que hacés se guarda solo en tu cuenta: los planteles, los
        jugadores con sus fotos y los partidos. No hay nada que apretar.
      </Text>
      <Text style={[styles.estado, haySinSubir && styles.estadoPendiente]}>
        {haySinSubir
          ? 'Falta subir algo. Se sube solo cuando vuelva internet.'
          : ultimaCopia
          ? `Todo guardado — ${ultimaCopia}.`
          : 'Todo guardado.'}
      </Text>
      <Text style={styles.nota}>
        Los {cuantosPlanteles}{' '}
        {cuantosPlanteles === 1 ? 'plantel' : 'planteles'} de este teléfono
        están en tu cuenta. Si entrás desde otro, los vas a encontrar ahí.
      </Text>

      <Seccion style={styles.seccion}>Papelera</Seccion>
      <Text style={styles.ayuda}>
        Lo que borrás se guarda acá por {papelera?.dias ?? 30} días antes de
        irse del todo. Es la vuelta atrás de haber borrado sin querer.
      </Text>

      {papelera === null ? (
        <Text style={styles.cargando}>Mirando la papelera…</Text>
      ) : papelera.planteles.length === 0 ? (
        <Text style={styles.nota}>No borraste nada últimamente.</Text>
      ) : (
        papelera.planteles.map((p) => (
          <Panel
            key={p.id}
            style={styles.papelera}
            esquinas={DIAGONAL}
            chaflan={9}
            fondo={colors.surface}
            borde={colors.border}
          >
            <View style={styles.papeleraTextos}>
              <Text style={styles.papeleraNombre}>{p.nombre}</Text>
              <Text style={styles.papeleraDetalle}>
                {p.jugadores}{' '}
                {p.jugadores === 1 ? 'jugador' : 'jugadores'} · borrado{' '}
                {comoSeLeeCorto(p.borradoEn)}
              </Text>
            </View>
            <Button
              title="Recuperar"
              variant="ghost"
              compacto
              loading={recuperando === p.id}
              disabled={recuperando !== null}
              onPress={() => handleRecuperar(p.id)}
            />
          </Panel>
        ))
      )}
    </>
  );

  const vistaEntrar = (
    <>
      <Seccion>{modo === 'entrar' ? 'Entrar' : 'Crear cuenta'}</Seccion>
      <Text style={styles.ayuda}>
        Todo lo que cargues se guarda en tu cuenta: los planteles, los jugadores
        y los partidos. Si cambiás de teléfono, entrás y está todo. Y es lo que
        te deja pasarle un plantel a un amigo.
      </Text>

      {error ? <Aviso titulo={error.titulo} detalle={error.detalle} /> : null}

      <CampoTexto
        value={email}
        onChangeText={(t) => {
          setEmail(t);
          setError(null);
        }}
        placeholder="Mail"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        inputMode="email"
      />
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
        onSubmitEditing={modo === 'entrar' ? handleEntrar : handleRegistro}
        returnKeyType="done"
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
        <>
          <Button
            title="Olvidé mi contraseña"
            onPress={handleOlvide}
            variant="ghost"
          />
          {/*
            Si el primer mail se perdió no hay otra forma de salir: registrarse
            de nuevo con el mismo mail no reenvía nada.
          */}
          <Button
            title="No me llegó el mail de confirmación"
            onPress={handleReenviar}
            variant="ghost"
          />
        </>
      ) : null}
    </>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.titulo}>{sesion ? 'TU CUENTA' : 'CUENTA'}</Text>

      {/* Sin sesión no hay nada que separar: es una sola pantalla. */}
      {sesion ? (
        <View style={styles.pestanias}>
          <Opcion
            label="Perfil"
            activa={pestania === 'perfil'}
            onPress={() => setPestania('perfil')}
          />
          <Opcion
            label="Respaldo"
            activa={pestania === 'respaldo'}
            onPress={() => setPestania('respaldo')}
          />
        </View>
      ) : null}

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        {!sesion
          ? vistaEntrar
          : pestania === 'respaldo'
          ? vistaRespaldo
          : vistaPerfil}
      </ScrollView>

      {dialogo}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  titulo: {
    color: colors.text,
    fontSize: 22,
    fontFamily: fuentes.display,
    letterSpacing: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  content: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xl },
  pestanias: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
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
  // La arroba no forma parte del nombre, pero es como se lo escribe y se lo
  // lee en cualquier otro lado.
  arroba: {
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
  papelera: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  papeleraTextos: { flex: 1 },
  papeleraNombre: {
    color: colors.text,
    fontSize: 15,
    fontFamily: fuentes.extra,
  },
  papeleraDetalle: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: fuentes.regular,
    marginTop: 1,
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
