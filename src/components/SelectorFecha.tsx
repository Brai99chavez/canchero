import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { nombreDelMes } from '../fechas';
import { colors, fuentes, spacing } from '../theme';
import Panel, { DIAGONAL } from './Angular';
import { Presionable } from './motion';
import { Button } from './ui';

/**
 * El calendario para elegir el día de un partido.
 *
 * Es propio y no el del sistema porque el del sistema no se puede pintar: sale
 * con los colores de Android, blanco y azul, y en el medio de esta app parece
 * de otra aplicación. Además, así en los dos teléfonos se ve igual.
 *
 * La semana arranca en lunes, que es como se lee un calendario acá.
 */
const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/** Cuántos casilleros vacíos van antes del día 1, con la semana en lunes. */
function huecoInicial(anio: number, mes: number): number {
  const domingoPrimero = new Date(anio, mes, 1).getDay();
  return (domingoPrimero + 6) % 7;
}

function mismoDia(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function SelectorFecha({
  visible,
  valor,
  onElegir,
  onClose,
}: {
  visible: boolean;
  valor: Date;
  onElegir: (fecha: Date) => void;
  onClose: () => void;
}) {
  /** Qué mes se está mirando, que no es lo mismo que el día elegido. */
  const [mirando, setMirando] = useState(
    () => new Date(valor.getFullYear(), valor.getMonth(), 1)
  );

  useEffect(() => {
    if (visible) setMirando(new Date(valor.getFullYear(), valor.getMonth(), 1));
  }, [visible, valor]);

  const anio = mirando.getFullYear();
  const mes = mirando.getMonth();
  const cuantos = new Date(anio, mes + 1, 0).getDate();
  const hueco = huecoInicial(anio, mes);
  const hoy = new Date();

  const correrMes = (cuanto: number) =>
    setMirando(new Date(anio, mes + cuanto, 1));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.fondo}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <Panel
          style={styles.caja}
          esquinas={DIAGONAL}
          fondo={colors.surface}
          borde={colors.border}
          grosor={1.5}
        >
          <View style={styles.cabecera}>
            <Presionable onPress={() => correrMes(-1)} style={styles.flecha}>
              <Text style={styles.flechaTexto}>‹</Text>
            </Presionable>
            <Text style={styles.mes}>{nombreDelMes(anio, mes).toUpperCase()}</Text>
            <Presionable onPress={() => correrMes(1)} style={styles.flecha}>
              <Text style={styles.flechaTexto}>›</Text>
            </Presionable>
          </View>

          <View style={styles.semana}>
            {DIAS.map((d, i) => (
              <Text key={i} style={styles.diaSemana}>
                {d}
              </Text>
            ))}
          </View>

          <View style={styles.grilla}>
            {/* Los casilleros de antes del día 1, para que cada día caiga en
                la columna de su día de la semana. */}
            {Array.from({ length: hueco }, (_, i) => (
              <View key={`hueco${i}`} style={styles.celda} />
            ))}

            {Array.from({ length: cuantos }, (_, i) => {
              const fecha = new Date(anio, mes, i + 1);
              const elegido = mismoDia(fecha, valor);
              const esHoy = mismoDia(fecha, hoy);
              return (
                <Pressable
                  key={i}
                  style={styles.celda}
                  onPress={() => onElegir(fecha)}
                >
                  <Panel
                    style={styles.dia}
                    esquinas={DIAGONAL}
                    chaflan={6}
                    fondo={elegido ? colors.primary : 'transparent'}
                    opacidadFondo={elegido ? undefined : 0}
                    // Hoy se marca con el borde aunque no esté elegido: es el
                    // punto de referencia para contar los otros días.
                    borde={
                      elegido
                        ? 'transparent'
                        : esHoy
                        ? colors.primary
                        : 'transparent'
                    }
                    grosor={!elegido && esHoy ? 1.5 : 0}
                  >
                    <Text
                      style={[
                        styles.numero,
                        esHoy && !elegido && styles.numeroHoy,
                        elegido && styles.numeroElegido,
                      ]}
                    >
                      {i + 1}
                    </Text>
                  </Panel>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.pie}>
            <Button
              title="Hoy"
              variant="ghost"
              compacto
              onPress={() => onElegir(new Date())}
            />
            <Button title="Cerrar" variant="ghost" compacto onPress={onClose} />
          </View>
        </Panel>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fondo: {
    flex: 1,
    backgroundColor: '#050814CC',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  caja: { padding: spacing.md },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  flecha: {
    width: 40,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flechaTexto: {
    color: colors.primary,
    fontSize: 26,
    lineHeight: 30,
    fontFamily: fuentes.bold,
  },
  mes: {
    flex: 1,
    textAlign: 'center',
    color: colors.text,
    fontSize: 15,
    fontFamily: fuentes.display,
    letterSpacing: 1,
  },
  semana: { flexDirection: 'row', marginBottom: 2 },
  diaSemana: {
    flex: 1,
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: fuentes.extra,
    letterSpacing: 0.5,
  },
  grilla: { flexDirection: 'row', flexWrap: 'wrap' },
  // Siete columnas exactas: el ancho en porcentaje evita tener que medir la
  // pantalla y que la última columna quede corrida.
  celda: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    padding: 2,
  },
  dia: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  numero: {
    color: colors.text,
    fontSize: 14,
    fontFamily: fuentes.medium,
  },
  numeroHoy: { color: colors.primary, fontFamily: fuentes.extra },
  numeroElegido: { color: colors.sobreAcento, fontFamily: fuentes.extra },
  pie: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
