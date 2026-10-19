import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { comoSeLeeElDia, resumenDeRespuestas } from '../asistencia';
import { colors, fuentes, spacing } from '../theme';
import { Player } from '../types';
import { Asistencia } from '../useAsistencia';
import Panel, { DIAGONAL } from './Angular';
import { Etiqueta } from './Banner';
import { useDialogo } from './Dialogo';
import SelectorFecha from './SelectorFecha';
import { Button } from './ui';

/** Una acción chica del panel, en texto: el panel no puede comerse la lista. */
function Accion({ texto, onPress }: { texto: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8}>
      <Text style={styles.accion}>{texto}</Text>
    </Pressable>
  );
}

/**
 * "¿Quién viene?": el link que se manda al grupo para que cada uno se anote.
 *
 * Va arriba de la lista de convocados y ocupa poco a propósito: es una ayuda
 * para marcar, no reemplaza a la lista. Los que dicen que van quedan marcados
 * solos; los que dicen que no, desmarcados; y lo que se toque a mano manda
 * hasta que esa persona cambie su respuesta.
 */
export default function PanelAsistencia({
  asistencia,
  jugadores,
}: {
  asistencia: Asistencia;
  jugadores: Player[];
}) {
  const { link, ocupado, error } = asistencia;
  const [eligiendoDia, setEligiendoDia] = useState(false);
  // Fijo y no `new Date()` en cada dibujo: el calendario se reacomoda cada
  // vez que le cambia el valor, y con uno nuevo en cada dibujo no pararía.
  const [hoy] = useState(() => new Date());
  const { dialogo, preguntar } = useDialogo();

  const resumen = link ? resumenDeRespuestas(jugadores, link.respuestas) : null;

  function cerrar() {
    preguntar({
      titulo: 'Cerrar el link',
      mensaje:
        'El que lo abra va a ver que ya no está activo. Los que ya quedaron ' +
        'marcados siguen marcados.',
      confirmar: 'Cerrar',
      peligro: true,
      onConfirmar: asistencia.cerrar,
    });
  }

  return (
    <Panel
      style={styles.caja}
      esquinas={DIAGONAL}
      chaflan={10}
      fondo={colors.surface}
      borde={colors.border}
    >
      <View style={styles.cabecera}>
        <Etiqueta color={colors.teamB}>¿Quién viene?</Etiqueta>
        {link ? <Text style={styles.dia}>{comoSeLeeElDia(link.fecha)}</Text> : null}
        {ocupado ? <ActivityIndicator size="small" color={colors.textMuted} /> : null}
      </View>

      {link && resumen ? (
        <>
          <Text style={styles.resumen}>
            <Text style={styles.van}>{resumen.van} van</Text>
            {' · '}
            <Text style={styles.noVan}>{resumen.noVan} no</Text>
            {' · '}
            {resumen.faltan} sin contestar
          </Text>
          <View style={styles.acciones}>
            <Accion texto="Mandar de nuevo" onPress={asistencia.mandar} />
            <Accion texto="Actualizar" onPress={asistencia.actualizar} />
            <Accion texto="Cerrar" onPress={cerrar} />
          </View>
        </>
      ) : (
        <View style={styles.fila}>
          <Text style={styles.ayuda}>
            Mandá un link al grupo: cada uno toca su nombre y los que van quedan
            marcados acá.
          </Text>
          <Button
            title="Preguntar"
            variant="ghost"
            compacto
            disabled={ocupado}
            onPress={() => setEligiendoDia(true)}
          />
        </View>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <SelectorFecha
        visible={eligiendoDia}
        valor={hoy}
        onElegir={(dia) => {
          setEligiendoDia(false);
          asistencia.preguntar(dia);
        }}
        onClose={() => setEligiendoDia(false)}
      />
      {dialogo}
    </Panel>
  );
}

const styles = StyleSheet.create({
  caja: { padding: spacing.md, gap: 6 },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dia: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    fontFamily: fuentes.bold,
  },
  fila: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  ayuda: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: fuentes.regular,
    lineHeight: 16,
  },
  resumen: { color: colors.textMuted, fontSize: 14, fontFamily: fuentes.semi },
  van: { color: colors.primary, fontFamily: fuentes.extra },
  noVan: { color: colors.danger, fontFamily: fuentes.extra },
  acciones: { flexDirection: 'row', gap: spacing.lg },
  accion: {
    color: colors.primary,
    fontSize: 12,
    fontFamily: fuentes.extra,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  error: { color: colors.aviso, fontSize: 12, fontFamily: fuentes.bold },
});
