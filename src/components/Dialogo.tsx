import React, { useCallback, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, degradados, fuentes, spacing } from '../theme';
import Panel, { DIAGONAL } from './Angular';
import { Button } from './ui';

/**
 * Los avisos y las preguntas de la app, con su cara y no con la del sistema.
 *
 * Los `Alert` de Android e iOS son cuadrados, blancos o grises y con la
 * tipografía del sistema: al lado del resto parecen de otra aplicación. Y
 * además se ven distintos en cada teléfono, así que no hay forma de que el
 * mensaje quede como uno lo pensó.
 */
interface Config {
  titulo: string;
  mensaje?: string;
  /** Texto del botón que confirma. Sin esto es sólo un aviso, con un "Listo". */
  confirmar?: string;
  /** Una línea con el color de la marca, debajo del mensaje. */
  destacado?: string;
  /** Pinta de rojo lo que no se puede deshacer. */
  peligro?: boolean;
  onConfirmar?: () => void;
  /**
   * Un tercer camino, para cuando además de hacer o no hacer hay algo mejor
   * que se puede hacer antes. Con tres botones se apilan: tres en fila no
   * entran en un teléfono angosto sin partir las palabras.
   */
  alternativa?: { label: string; onPress: () => void };
  /**
   * Qué hacer al cerrarlo. Sirve cuando el aviso es lo último que pasa en una
   * pantalla que después se cierra: cerrarla antes de mostrarlo se llevaría el
   * diálogo puesto, porque vive adentro de esa ventana.
   */
  onCerrar?: () => void;
}

/**
 * Devuelve el diálogo listo para poner en la pantalla y las dos formas de
 * abrirlo.
 *
 * Cada pantalla arma el suyo en vez de haber uno solo arriba de todo: los
 * modales de React Native son ventanas aparte, y uno que nace afuera de la
 * ventana abierta corre el riesgo de quedar por debajo.
 */
export function useDialogo() {
  const [config, setConfig] = useState<Config | null>(null);
  // El callback se lee de una referencia y no de adentro del actualizador de
  // estado: React puede correr ese actualizador dos veces, y el aviso saldría
  // repetido.
  const actual = useRef<Config | null>(null);
  actual.current = config;

  const cerrar = useCallback(() => {
    const alCerrar = actual.current?.onCerrar;
    setConfig(null);
    alCerrar?.();
  }, []);

  /** Un aviso: sólo hay que enterarse. */
  const avisar = useCallback(
    (titulo: string, mensaje?: string, alCerrar?: () => void) =>
      setConfig({ titulo, mensaje, onCerrar: alCerrar }),
    []
  );

  /** Una pregunta: hay algo que confirmar o cancelar. */
  const preguntar = useCallback((c: Config) => setConfig(c), []);

  const dialogo = (
    <Dialogo config={config} onCerrar={cerrar} />
  );

  return { dialogo, avisar, preguntar };
}

function Dialogo({
  config,
  onCerrar,
}: {
  config: Config | null;
  onCerrar: () => void;
}) {
  function handleConfirmar() {
    const accion = config?.onConfirmar;
    onCerrar();
    // Después de cerrar, así la acción puede abrir otro diálogo encima —la
    // segunda pregunta de lo que borra todo, por ejemplo.
    accion?.();
  }

  return (
    <Modal
      visible={config !== null}
      transparent
      animationType="fade"
      onRequestClose={onCerrar}
      statusBarTranslucent
    >
      <View style={styles.fondo}>
        {/* Tocar afuera cancela, igual que en el resto de la app. */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onCerrar} />

        <Panel
          style={styles.caja}
          degradado={degradados.panel}
          borde={config?.peligro ? colors.danger : colors.border}
          grosor={1.5}
          esquinas={DIAGONAL}
        >
          <Text style={styles.titulo}>{config?.titulo.toUpperCase()}</Text>
          {config?.mensaje ? (
            <Text style={styles.mensaje}>{config.mensaje}</Text>
          ) : null}
          {config?.destacado ? (
            <Text style={styles.destacado}>{config.destacado}</Text>
          ) : null}

          {config?.alternativa ? (
            <View style={styles.apilados}>
              <Button
                title={config.alternativa.label}
                onPress={() => {
                  const accion = config.alternativa?.onPress;
                  onCerrar();
                  accion?.();
                }}
              />
              <Button
                title={config.confirmar ?? 'Seguir'}
                onPress={handleConfirmar}
                variant={config.peligro ? 'danger' : 'ghost'}
              />
              <Button title="Cancelar" onPress={onCerrar} variant="ghost" />
            </View>
          ) : (
            <View style={styles.botones}>
              {config?.confirmar ? (
                <>
                  <Button
                    title="Cancelar"
                    onPress={onCerrar}
                    variant="ghost"
                    style={styles.boton}
                  />
                  <Button
                    title={config.confirmar}
                    onPress={handleConfirmar}
                    variant={config.peligro ? 'danger' : 'primary'}
                    style={styles.boton}
                  />
                </>
              ) : (
                <Button title="Listo" onPress={onCerrar} style={styles.boton} />
              )}
            </View>
          )}
        </Panel>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fondo: {
    flex: 1,
    backgroundColor: '#050814D9',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  caja: { padding: spacing.lg },
  titulo: {
    color: colors.text,
    fontSize: 19,
    fontFamily: fuentes.display,
    letterSpacing: 0.5,
  },
  mensaje: {
    color: colors.textMuted,
    fontSize: 13.5,
    fontFamily: fuentes.regular,
    lineHeight: 19,
    marginTop: spacing.sm,
  },
  apilados: { gap: spacing.sm, marginTop: spacing.lg },
  destacado: {
    color: colors.primary,
    fontSize: 13,
    fontFamily: fuentes.extra,
    letterSpacing: 0.3,
    lineHeight: 18,
    marginTop: spacing.sm,
  },
  botones: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  boton: { flex: 1 },
});
