import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { enPesos, estadoDeLaCancha, quienesPonen, alternarPago } from '../cancha';
import { colors, fuentes, spacing } from '../theme';
import { Cancha, Partido } from '../types';
import Panel, { DIAGONAL } from './Angular';
import { Etiqueta } from './Banner';
import CampoTexto from './CampoTexto';
import { Presionable } from './motion';
import { Button } from './ui';

/**
 * Lo que salió la cancha, dividido entre los que vinieron, y quién ya pagó.
 *
 * Los cambios se guardan en el momento, como los intercambios de jugadores:
 * se marca al que pagó con la plata en la mano, días antes o después del
 * partido, y eso no tiene por qué esperar a ningún botón de guardar.
 *
 * Quien lo usa le pone `key` con el id del partido: lo que se está escribiendo
 * es de ese partido y no tiene que pasar al siguiente que se abra.
 */
export default function PagoDeCancha({
  partido,
  onCambiar,
  abierto = true,
}: {
  partido: Partido;
  /** `undefined` es sacar la cancha: borrar el total deja de dividir. */
  onCambiar: (cancha: Cancha | undefined) => void;
  /**
   * Si, sin nada cargado, arranca con el campo a la vista. En un partido por
   * jugarse sí, que es cuando se arregla la plata; en uno del historial no,
   * o cada partido viejo tendría un campo vacío pidiendo algo.
   */
  abierto?: boolean;
}) {
  const estado = estadoDeLaCancha(partido);
  const ponen = quienesPonen(partido);
  const [editando, setEditando] = useState(estado === null && abierto);
  const [texto, setTexto] = useState(estado ? String(estado.total) : '');

  const nombre = (id: string) => partido.nombres[id] ?? 'Jugador';

  function listo() {
    const total = Number(texto);
    if (!texto || !Number.isFinite(total) || total <= 0) {
      onCambiar(undefined);
      setTexto('');
    } else {
      // Los que ya estaban marcados siguen marcados: cambiar el total porque
      // se pidió una hora más no borra a los que ya pagaron.
      onCambiar({ total, pagaron: partido.cancha?.pagaron ?? [] });
    }
    setEditando(false);
  }

  return (
    <Panel
      style={styles.caja}
      esquinas={DIAGONAL}
      chaflan={12}
      fondo={colors.surface}
      borde={colors.border}
    >
      <View style={styles.cabecera}>
        <Etiqueta color={colors.aviso}>La cancha</Etiqueta>
        {estado && !editando ? (
          <Presionable onPress={() => setEditando(true)} hitSlop={8}>
            <Text style={styles.cambiar}>Cambiar</Text>
          </Presionable>
        ) : null}
      </View>

      {editando ? (
        <>
          <Text style={styles.ayuda}>
            ¿Cuánto salió? Lo divido entre los {ponen.length} que vinieron.
          </Text>
          <View style={styles.fila}>
            <CampoTexto
              value={texto}
              onChangeText={(t) => setTexto(t.replace(/[^0-9]/g, '').slice(0, 8))}
              keyboardType="number-pad"
              placeholder="Por ejemplo, 45000"
              izquierda={<Text style={styles.signo}>$</Text>}
              contenedor={styles.campo}
              style={styles.campoTexto}
              onSubmitEditing={listo}
            />
            <Button title="Dividir" onPress={listo} style={styles.boton} />
          </View>
        </>
      ) : estado ? (
        <>
          <Text style={styles.cuenta}>
            {enPesos(estado.parte)}{' '}
            <Text style={styles.cuentaDetalle}>
              cada uno · {enPesos(estado.total)} entre {ponen.length}
            </Text>
          </Text>
          <Text
            style={[styles.progreso, estado.faltan.length === 0 && styles.completo]}
          >
            {estado.faltan.length === 0
              ? 'Ya pagaron todos ✓'
              : `Pagaron ${estado.pagaron.length} de ${ponen.length} · faltan ${enPesos(estado.falta)}`}
          </Text>
          <Text style={styles.ayuda}>Tocá a los que ya pagaron.</Text>
          <View style={styles.nombres}>
            {ponen.map((id) => {
              const pago = estado.pagaron.includes(id);
              return (
                <Presionable
                  key={id}
                  onPress={() => onCambiar(alternarPago(partido.cancha!, id))}
                  escala={0.94}
                >
                  <Panel
                    style={styles.chip}
                    esquinas={DIAGONAL}
                    chaflan={7}
                    fondo={pago ? colors.primary : 'transparent'}
                    opacidadFondo={pago ? 0.16 : undefined}
                    borde={pago ? colors.primary : colors.border}
                    grosor={1.5}
                  >
                    <Text style={[styles.chipTexto, pago && styles.chipPago]}>
                      {pago ? `✓ ${nombre(id)}` : nombre(id)}
                    </Text>
                  </Panel>
                </Presionable>
              );
            })}
          </View>
        </>
      ) : (
        <View style={styles.fila}>
          <Text style={[styles.ayuda, styles.campo]}>
            Cargá lo que salió y lo divido entre los {ponen.length}.
          </Text>
          <Button
            title="Dividir"
            variant="ghost"
            onPress={() => setEditando(true)}
            style={styles.boton}
          />
        </View>
      )}
    </Panel>
  );
}

const styles = StyleSheet.create({
  caja: { padding: spacing.md, gap: spacing.sm },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cambiar: {
    color: colors.primary,
    fontSize: 11,
    fontFamily: fuentes.extra,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  ayuda: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: fuentes.regular,
    lineHeight: 17,
  },
  fila: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  campo: { flex: 1 },
  campoTexto: { fontSize: 18, fontFamily: fuentes.bold },
  signo: { color: colors.textMuted, fontSize: 18, fontFamily: fuentes.bold },
  boton: { minWidth: 110 },
  cuenta: { color: colors.text, fontSize: 24, fontFamily: fuentes.black },
  cuentaDetalle: {
    color: colors.textMuted,
    fontSize: 13,
    fontFamily: fuentes.semi,
  },
  progreso: { color: colors.aviso, fontSize: 13, fontFamily: fuentes.bold },
  completo: { color: colors.primary },
  nombres: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 7 },
  chipTexto: { color: colors.text, fontSize: 13, fontFamily: fuentes.semi },
  chipPago: { color: colors.primary, fontFamily: fuentes.bold },
});
