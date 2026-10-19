import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { atajosDeDia, fechaDelDia, textoDeInvitacion } from '../asistencia';
import { colors, fuentes, spacing } from '../theme';
import { Via } from '../useAsistencia';
import Panel, { DIAGONAL } from './Angular';
import Hoja from './Hoja';
import Opcion from './Opcion';
import SelectorFecha from './SelectorFecha';
import { Button } from './ui';

/**
 * Preguntarle al grupo quién viene: para qué día, y cómo le va a llegar.
 *
 * Antes era un calendario pelado, sin decir para qué era. Ahora pregunta con
 * palabras ("¿para qué día es el partido?"), ofrece los días de siempre sin
 * abrir un calendario, y muestra el mensaje tal cual le va a llegar al grupo
 * antes de mandarlo: lo que se manda a un grupo de WhatsApp no se puede
 * deshacer, así que tiene que verse antes.
 */
export default function HojaPreguntar({
  visible,
  titulo = '¿Para qué día es el partido?',
  aviso,
  ocupado,
  onMandar,
  onClose,
}: {
  visible: boolean;
  titulo?: string;
  /** Algo que conviene saber antes, como que cambiar el día empieza de cero. */
  aviso?: string;
  ocupado: boolean;
  onMandar: (dia: Date, via: Via) => void;
  onClose: () => void;
}) {
  // Los atajos se calculan al abrir y no en cada dibujo: si la hoja queda
  // abierta a la medianoche, "hoy" no tiene por qué cambiar en la mano.
  const [atajos, setAtajos] = useState(() => atajosDeDia(new Date()));
  const [dia, setDia] = useState<Date | null>(null);
  const [calendario, setCalendario] = useState(false);
  const [abierta, setAbierta] = useState(visible);

  // Cada vez que se abre arranca de cero, con los atajos de ese momento.
  if (visible !== abierta) {
    setAbierta(visible);
    if (visible) {
      setAtajos(atajosDeDia(new Date()));
      setDia(null);
    }
  }

  const elegido = dia ? fechaDelDia(dia) : null;
  const esAtajo = (d: Date) => elegido === fechaDelDia(d);
  const otroDia = dia !== null && !atajos.some((a) => esAtajo(a.dia));

  function mandar(via: Via) {
    if (dia) onMandar(dia, via);
  }

  return (
    <Hoja visible={visible} titulo={titulo} bajada={aviso} onClose={onClose}>
      <View style={styles.atajos}>
        {atajos.map((a) => (
          <Opcion
            key={a.etiqueta}
            label={a.etiqueta}
            activa={esAtajo(a.dia)}
            onPress={() => setDia(a.dia)}
            style={styles.atajo}
          />
        ))}
        <Opcion
          label={otroDia && dia ? `${dia.getDate()}/${dia.getMonth() + 1}` : 'Otro día'}
          activa={otroDia}
          onPress={() => setCalendario(true)}
          style={styles.atajo}
        />
      </View>

      {elegido ? (
        <>
          <Text style={styles.rotulo}>Así le llega al grupo</Text>
          <Panel
            style={styles.mensaje}
            esquinas={DIAGONAL}
            chaflan={10}
            fondo={colors.surfaceAlt}
            borde={colors.border}
          >
            <Text style={styles.mensajeTexto}>
              {textoDeInvitacion(elegido, 'canchero.onrender.com/v/…')}
            </Text>
          </Panel>
          <Button
            title="Mandar por WhatsApp"
            onPress={() => mandar('whatsapp')}
            loading={ocupado}
          />
          <Pressable
            onPress={() => mandar('otra')}
            disabled={ocupado}
            hitSlop={8}
            style={styles.otraApp}
          >
            <Text style={styles.otraAppTexto}>Mandar por otra app</Text>
          </Pressable>
        </>
      ) : (
        <Text style={styles.ayuda}>
          Elegí el día y te muestro el mensaje antes de mandarlo.
        </Text>
      )}

      <SelectorFecha
        visible={calendario}
        valor={dia ?? atajos[0].dia}
        onElegir={(d) => {
          setDia(d);
          setCalendario(false);
        }}
        onClose={() => setCalendario(false)}
      />
    </Hoja>
  );
}

const styles = StyleSheet.create({
  atajos: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  // Tres por fila: con más, "Mañana" no entra en un teléfono angosto.
  atajo: { flexBasis: '30%', flexGrow: 1 },
  rotulo: {
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: fuentes.extra,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: spacing.md,
  },
  mensaje: { padding: spacing.md, marginBottom: spacing.sm },
  mensajeTexto: { color: colors.text, fontSize: 14, fontFamily: fuentes.regular, lineHeight: 20 },
  ayuda: {
    color: colors.textMuted,
    fontSize: 13,
    fontFamily: fuentes.regular,
    marginTop: spacing.md,
  },
  otraApp: { alignSelf: 'center', paddingVertical: spacing.sm },
  otraAppTexto: {
    color: colors.primary,
    fontSize: 12,
    fontFamily: fuentes.extra,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
