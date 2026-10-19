import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  alternarPago,
  enPesos,
  estadoDeLaCancha,
  quienesPonen,
  textoParaCobrar,
} from '../cancha';
import { mandarAlGrupo } from '../mandar';
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
  alias,
  onAlias,
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
  /** El alias al que le transfieren al que organiza, si ya lo cargó. */
  alias?: string;
  onAlias: (alias: string) => void;
}) {
  const estado = estadoDeLaCancha(partido);
  const ponen = quienesPonen(partido);
  const [editando, setEditando] = useState(estado === null && abierto);
  const [texto, setTexto] = useState(estado ? String(estado.total) : '');

  const nombre = (id: string) => partido.nombres[id] ?? 'Jugador';

  /*
   * Pedir la plata: un mensaje al grupo con cuánto pone cada uno, quiénes
   * faltan y a qué alias. El alias se pregunta la primera vez, ahí mismo, y
   * queda guardado: preguntarlo en otra pantalla antes sería mandar a la
   * persona a buscar dónde se configura algo que todavía no sabe que existe.
   */
  const [pidiendoAlias, setPidiendoAlias] = useState(false);
  const [aliasTexto, setAliasTexto] = useState(alias ?? '');

  function cobrar(conAlias: string) {
    const limpio = conAlias.trim();
    if (limpio && limpio !== alias) onAlias(limpio);
    setPidiendoAlias(false);
    const texto = textoParaCobrar(partido, limpio || undefined);
    if (texto) mandarAlGrupo(texto);
  }

  function pedirLaPlata() {
    if (alias) cobrar(alias);
    else setPidiendoAlias(true);
  }

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

          {estado.faltan.length === 0 ? null : pidiendoAlias ? (
            <View style={styles.cobro}>
              <Text style={styles.ayuda}>
                ¿A qué alias te transfieren? Lo guardo para la próxima.
              </Text>
              <CampoTexto
                value={aliasTexto}
                onChangeText={setAliasTexto}
                placeholder="Por ejemplo, juan.perez.mp"
                autoCapitalize="none"
                autoCorrect={false}
                onSubmitEditing={() => cobrar(aliasTexto)}
              />
              <Button title="Pedir la plata" onPress={() => cobrar(aliasTexto)} />
              {alias ? null : (
                <Pressable onPress={() => cobrar('')} hitSlop={8} style={styles.sinAlias}>
                  <Text style={styles.cambiar}>Mandar sin alias</Text>
                </Pressable>
              )}
            </View>
          ) : (
            <View style={styles.cobro}>
              <Button title="Pedir la plata por WhatsApp" variant="ghost" onPress={pedirLaPlata} />
              {alias ? (
                <Text style={styles.ayuda}>
                  Alias: {alias}
                  {'  ·  '}
                  <Text
                    style={styles.cambiar}
                    onPress={() => {
                      setAliasTexto(alias);
                      setPidiendoAlias(true);
                    }}
                  >
                    Cambiar
                  </Text>
                </Text>
              ) : null}
            </View>
          )}
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
  cobro: { gap: spacing.sm, marginTop: spacing.xs },
  sinAlias: { alignSelf: 'center', paddingVertical: 4 },
});
