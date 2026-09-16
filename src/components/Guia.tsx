import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { angulo, colors, fuentes, radius, spacing } from '../theme';
import Panel, { DIAGONAL } from './Angular';

export type PasoGuia =
  | 'crear-plantel'
  | 'agregar-jugador'
  | 'segundo-jugador'
  | 'ir-a-partido'
  | 'convocar'
  | 'armar-equipos';

/**
 * El orden importa: el paso activo es el primero sin completar cuyo objetivo
 * esté en pantalla. Con esa sola regla, abrir un modal hace que tomen el turno
 * los pasos de adentro, y cerrarlo se lo devuelve a los de afuera.
 */
const PASOS: { id: PasoGuia; titulo: string; texto: string }[] = [
  {
    id: 'crear-plantel',
    titulo: 'Creá tu grupo',
    texto:
      'Tocá NUEVO y ponele el nombre de los que juegan con vos. Tomate tu ' +
      'tiempo: mientras completás, el tutorial se hace a un lado.',
  },
  {
    id: 'agregar-jugador',
    titulo: 'Cargá tu primer jugador',
    texto:
      'Tocá AGREGAR y completá nombre, posición y stats. Las stats van a ojo, ' +
      'no hace falta precisión.',
  },
  {
    id: 'segundo-jugador',
    titulo: 'Falta uno más',
    texto:
      'Para repartir equipos hacen falta al menos dos. Tocá AGREGAR otra vez ' +
      'y cargá al siguiente.',
  },
  {
    id: 'ir-a-partido',
    titulo: 'Ahora el partido',
    texto: 'Pasá a PARTIDO para elegir el formato y quiénes vienen hoy.',
  },
  {
    id: 'convocar',
    titulo: 'Tildá a los que juegan',
    texto: 'Tocá a cada uno que viene. Los que no, quedan afuera del sorteo.',
  },
  {
    id: 'armar-equipos',
    titulo: 'Y listo',
    texto: 'Los equipos salen parejos solos. Podés re-sortear o mover a mano.',
  },
];

interface Recuadro {
  x: number;
  y: number;
  width: number;
  height: number;
}

type Medir = () => Promise<Recuadro | null>;

interface Registro {
  zonaId: number;
  medir: Medir;
}

interface Contexto {
  activo: PasoGuia | null;
  completar: (paso: PasoGuia) => void;
  registrar: (paso: PasoGuia, zonaId: number, medir: Medir) => void;
  olvidar: (paso: PasoGuia) => void;
  registro: Map<PasoGuia, Registro>;
  onSaltar: () => void;
}

const GuiaContexto = createContext<Contexto>({
  activo: null,
  completar: () => {},
  registrar: () => {},
  olvidar: () => {},
  registro: new Map(),
  onSaltar: () => {},
});

/**
 * Cada ventana nativa es su propia zona. Un objetivo sólo se puede medir
 * contra la raíz de su zona, y el foco sólo se puede dibujar ahí.
 */
interface ContextoZona {
  zonaId: number;
  raiz: React.RefObject<View | null>;
}

const ZonaContexto = createContext<ContextoZona>({
  zonaId: 0,
  raiz: { current: null },
});

let contadorZonas = 0;

/** Para que un componente marque su hito sin conocer al resto de los pasos. */
export function useGuia() {
  const { completar, activo } = useContext(GuiaContexto);
  return { completar, activo };
}

/** Envuelve al elemento que la guía tiene que resaltar. */
export function Objetivo({
  paso,
  children,
  style,
}: {
  /** Puede ser objetivo de varios pasos: el botón de agregar, por ejemplo. */
  paso: PasoGuia | PasoGuia[];
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { registrar, olvidar } = useContext(GuiaContexto);
  const { zonaId, raiz } = useContext(ZonaContexto);
  const ref = useRef<View>(null);
  // La lista se compara por su contenido: un array nuevo en cada render
  // volvería a registrar en bucle.
  const clave = Array.isArray(paso) ? paso.join('|') : paso;

  useEffect(() => {
    const pasos = clave.split('|') as PasoGuia[];
    const medir = () =>
      new Promise<Recuadro | null>((resolver) => {
        // Se mide contra la raíz de la zona y no contra la ventana: así las
        // coordenadas son las mismas en las que se dibuja el foco, sin
        // depender de la barra de estado ni del área segura.
        if (!ref.current || !raiz.current) return resolver(null);
        ref.current.measureLayout(
          raiz.current,
          (x, y, width, height) => {
            if (width === 0 && height === 0) return resolver(null);
            resolver({ x, y, width, height });
          },
          () => resolver(null)
        );
      });

    pasos.forEach((p) => registrar(p, zonaId, medir));
    return () => pasos.forEach((p) => olvidar(p));
  }, [clave, zonaId, raiz, registrar, olvidar]);

  return (
    <View ref={ref} collapsable={false} style={style}>
      {children}
    </View>
  );
}

/**
 * Una capa donde se puede dibujar el foco. Va en la app y también adentro de
 * cada modal: un modal es otra ventana nativa, así que el foco de la app no
 * llega hasta ahí ni podría taparlo.
 */
export function ZonaGuia({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { activo, registro, onSaltar } = useContext(GuiaContexto);
  const [zonaId] = useState(() => ++contadorZonas);
  const raiz = useRef<View>(null);
  const [zona, setZona] = useState<Recuadro | null>(null);
  const [alto, setAlto] = useState(0);
  const anim = useRef(new Animated.Value(0)).current;

  const mio = activo ? registro.get(activo)?.zonaId === zonaId : false;

  // Se mide varias veces: al abrir un modal o crear algo, la pantalla se
  // reacomoda y el objetivo se mueve después de la primera medición.
  useEffect(() => {
    let vivo = true;
    let mostrado = false;
    setZona(null);
    if (!activo || !mio) return;

    const intentar = async (restantes: number) => {
      const entrada = registro.get(activo);
      const medida = entrada ? await entrada.medir() : null;
      if (!vivo) return;

      if (medida) {
        setZona((previa) =>
          previa &&
          Math.abs(previa.x - medida.x) < 1 &&
          Math.abs(previa.y - medida.y) < 1 &&
          Math.abs(previa.width - medida.width) < 1 &&
          Math.abs(previa.height - medida.height) < 1
            ? previa
            : medida
        );
        if (!mostrado) {
          mostrado = true;
          Animated.timing(anim, {
            toValue: 1,
            duration: 220,
            easing: Easing.bezier(0.16, 1, 0.3, 1),
            useNativeDriver: true,
          }).start();
        }
      }
      if (restantes > 0) setTimeout(() => intentar(restantes - 1), 240);
    };

    anim.setValue(0);
    const t = setTimeout(() => intentar(10), 260);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [activo, mio, registro, anim]);

  const contenido = PASOS.find((p) => p.id === activo);
  const indice = PASOS.findIndex((p) => p.id === activo);
  const margen = 8;
  // Con el objetivo abajo, el cartel va arriba: si no, cae fuera de la caja.
  const arriba = zona && alto > 0 ? zona.y > alto * 0.5 : false;

  return (
    <ZonaContexto.Provider value={{ zonaId, raiz }}>
      <View
        style={[styles.raiz, style]}
        ref={raiz}
        collapsable={false}
        onLayout={(e) => setAlto(e.nativeEvent.layout.height)}
      >
        {children}

        {mio && zona && contenido ? (
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            {/* Los cuatro paños absorben el toque: el único camino habilitado
                es el elemento resaltado, o SKIP TUTORIAL. */}
            <Pressable
              style={[styles.panoFijo, { height: Math.max(0, zona.y - margen) }]}
            />
            <View
              style={[styles.filaHueco, { height: zona.height + margen * 2 }]}
            >
              <Pressable
                style={[
                  styles.panoFijo,
                  { width: Math.max(0, zona.x - margen) },
                ]}
              />
              <Animated.View
                style={[
                  styles.hueco,
                  {
                    width: zona.width + margen * 2,
                    height: zona.height + margen * 2,
                    opacity: anim,
                    transform: [
                      {
                        scale: anim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1.1, 1],
                        }),
                      },
                    ],
                  },
                ]}
                pointerEvents="none"
              />
              <Pressable style={styles.pano} />
            </View>
            <Pressable style={styles.pano} />

            <Animated.View
              style={[
                styles.globo,
                arriba
                  ? { bottom: alto - zona.y + margen + 14 }
                  : { top: zona.y + zona.height + margen + 14 },
                {
                  opacity: anim,
                  transform: [
                    {
                      translateY: anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [10, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Text style={styles.paso}>
                PASO {indice + 1} DE {PASOS.length}
              </Text>
              <Text style={styles.titulo}>{contenido.titulo}</Text>
              <Text style={styles.texto}>{contenido.texto}</Text>

              <Pressable onPress={onSaltar} hitSlop={8} style={styles.saltarCaja}>
                <Panel
                  style={styles.saltar}
                  esquinas={DIAGONAL}
                  chaflan={8}
                  fondo="transparent"
                  borde={colors.border}
                  grosor={1.5}
                >
                  <Text style={styles.saltarTexto}>SKIP TUTORIAL</Text>
                </Panel>
              </Pressable>
            </Animated.View>
          </View>
        ) : null}
      </View>
    </ZonaContexto.Provider>
  );
}

export function ProveedorGuia({
  activa,
  completados,
  bloqueados = [],
  onCompletar,
  onSaltar,
  children,
}: {
  activa: boolean;
  completados: string[];
  /**
   * Pasos que todavía no se pueden cumplir: se saltean sin darlos por hechos.
   * Sin esto, un paso cuya condición es imposible deja al usuario encerrado,
   * porque el foco le tapa el resto de la pantalla.
   */
  bloqueados?: PasoGuia[];
  onCompletar: (paso: PasoGuia) => void;
  onSaltar: () => void;
  children: React.ReactNode;
}) {
  const registro = useRef(new Map<PasoGuia, Registro>()).current;
  const [montados, setMontados] = useState<PasoGuia[]>([]);

  const registrar = useCallback(
    (p: PasoGuia, zonaId: number, medir: Medir) => {
      registro.set(p, { zonaId, medir });
      setMontados((prev) => (prev.includes(p) ? prev : [...prev, p]));
    },
    [registro]
  );

  const olvidar = useCallback(
    (p: PasoGuia) => {
      registro.delete(p);
      setMontados((prev) => prev.filter((x) => x !== p));
    },
    [registro]
  );

  /**
   * Con un modal abierto conviven dos zonas: la pantalla de atrás sigue
   * montada. Manda la de más arriba, porque es la única que el usuario ve y
   * puede tocar. Sin esto, un paso de la pantalla de atrás se queda con el
   * turno y los del modal no aparecen nunca.
   */
  const activo: PasoGuia | null = (() => {
    if (!activa) return null;
    const zonas = Array.from(registro.values()).map((r) => r.zonaId);
    if (zonas.length === 0) return null;
    const arriba = Math.max(...zonas);
    return (
      PASOS.find(
        (p) =>
          !completados.includes(p.id) &&
          !bloqueados.includes(p.id) &&
          montados.includes(p.id) &&
          registro.get(p.id)?.zonaId === arriba
      )?.id ?? null
    );
  })();

  return (
    <GuiaContexto.Provider
      value={{
        activo,
        completar: onCompletar,
        registrar,
        olvidar,
        registro,
        onSaltar,
      }}
    >
      <ZonaGuia>{children}</ZonaGuia>
    </GuiaContexto.Provider>
  );
}

const OSCURO = 'rgba(5, 8, 20, 0.88)';

const styles = StyleSheet.create({
  raiz: { flex: 1 },
  /** Los que rellenan lo que sobra. */
  pano: { flex: 1, backgroundColor: OSCURO },
  /**
   * Los que llevan una medida calculada. No pueden tener `flex`: en flexbox el
   * flex le gana al tamaño fijo, y los paños terminarían repartiéndose el
   * espacio en partes iguales, corriendo el hueco al centro de la pantalla.
   */
  panoFijo: { backgroundColor: OSCURO },
  filaHueco: { flexDirection: 'row' },
  hueco: {
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: 'transparent',
  },
  globo: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: 5,
  },
  paso: {
    color: colors.primary,
    fontSize: 10,
    fontFamily: fuentes.extra,
    letterSpacing: 1.5,
  },
  titulo: {
    color: colors.text,
    fontSize: 18,
    fontFamily: fuentes.display,
    letterSpacing: 0.5,
  },
  texto: {
    color: colors.textMuted,
    fontSize: 13,
    fontFamily: fuentes.regular,
    lineHeight: 18,
  },
  saltarCaja: { alignSelf: 'flex-start', marginTop: spacing.sm },
  saltar: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
  },
  saltarTexto: {
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: fuentes.extra,
    letterSpacing: 1,
    transform: [{ skewX: angulo.derecho }],
  },
});
