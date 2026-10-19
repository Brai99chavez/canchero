import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  agruparPorRespuesta,
  comoSeLeeElDia,
  enLista,
  hace,
  queFaltaTildar,
} from '../asistencia';
import { colors, fuentes, spacing } from '../theme';
import { Player } from '../types';
import { Asistencia } from '../useAsistencia';
import Panel, { DIAGONAL } from './Angular';
import { Etiqueta } from './Banner';
import { useDialogo } from './Dialogo';
import Hoja, { Opcion } from './Hoja';
import HojaPreguntar from './HojaPreguntar';
import { CalendarIcon, EyeIcon, EyeOffIcon, SendIcon } from './icons';
import { Button } from './ui';

/** Los nombres si son pocos, la cantidad si son muchos: así entra en un botón. */
function quienes(jugadores: Player[], muchos: string): string {
  return jugadores.length <= 2 ? enLista(jugadores.map((j) => j.nombre)) : muchos;
}

/**
 * Lo que dice el botón principal, que es lo que va a pasar al tocarlo. Null
 * si no hay nada que tildar ni destildar.
 */
function textoDelBoton(
  sumar: Player[],
  sacar: Player[],
  vienen: number
): { titulo: string; bajada: string | null } | null {
  if (sumar.length > 0) {
    const todos = sumar.length === vienen;
    return {
      titulo: `Tildar a ${quienes(
        sumar,
        todos ? `los ${sumar.length} que vienen` : `${sumar.length} más que vienen`
      )}`,
      bajada:
        sacar.length > 0
          ? `y destildar a ${quienes(sacar, `${sacar.length}`)}, que no ${
              sacar.length === 1 ? 'viene' : 'vienen'
            }`
          : null,
    };
  }
  if (sacar.length > 0) {
    return {
      titulo: `Destildar a ${quienes(sacar, `los ${sacar.length} que no vienen`)}`,
      bajada: null,
    };
  }
  return null;
}

/**
 * "¿Quién viene?": el link que se manda al grupo para que cada uno se anote.
 *
 * Va primero en la pantalla de armar el partido, porque es lo primero que se
 * hace: preguntar, y después armar con los que vienen. Los nombres no están
 * acá sino en la lista de abajo, agrupada por lo que contestó cada uno: es la
 * misma lista donde se tilda, y así no se repiten.
 *
 * Nada se tilda solo. El botón principal dice qué va a hacer antes de
 * hacerlo ("Tildar a los 8 que vienen"), y cuando ya está todo al día lo dice
 * en vez de mostrar un botón que no haría nada.
 */
export default function PanelAsistencia({
  asistencia,
  jugadores,
  seleccionados,
}: {
  asistencia: Asistencia;
  jugadores: Player[];
  seleccionados: string[];
}) {
  const { link, ocupado, error, leido } = asistencia;
  const [preguntando, setPreguntando] = useState(false);
  const [cambiandoDia, setCambiandoDia] = useState(false);
  const [opciones, setOpciones] = useState(false);
  const { dialogo, preguntar } = useDialogo();

  // La hora con la que se escribe "actualizado hace 2 min". Avanza sola cada
  // tanto: si no, el "recién" quedaba "recién" para siempre.
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const reloj = setInterval(() => setAhora(Date.now()), 20_000);
    return () => clearInterval(reloj);
  }, []);

  if (!link) {
    return (
      <Panel style={styles.caja} esquinas={DIAGONAL} chaflan={10} fondo={colors.surface} borde={colors.border}>
        {/* En una fila, como con el link: suelta se estiraba a todo el ancho. */}
        <View style={styles.cabecera}>
          <Etiqueta color={colors.teamB}>¿Quién viene?</Etiqueta>
        </View>
        <Text style={styles.ayuda}>
          Mandale un link al grupo: cada uno toca su nombre y dice si viene, y
          vos lo ves acá.
        </Text>
        <Button title="Preguntar al grupo" onPress={() => setPreguntando(true)} loading={ocupado} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <HojaPreguntar
          visible={preguntando}
          ocupado={ocupado}
          onMandar={(dia, via) => {
            setPreguntando(false);
            asistencia.preguntar(dia, via);
          }}
          onClose={() => setPreguntando(false)}
        />
      </Panel>
    );
  }

  const grupos = agruparPorRespuesta(jugadores, link.respuestas);
  const { sumar, sacar } = queFaltaTildar(seleccionados, jugadores, link.respuestas);
  const boton = textoDelBoton(sumar, sacar, grupos.vienen.length);

  function dejarDeRecibir() {
    setOpciones(false);
    preguntar({
      titulo: 'Dejar de recibir respuestas',
      mensaje:
        'El link deja de andar: el que lo abra va a ver que ya no está ' +
        'activo. La lista de convocados queda como está.',
      confirmar: 'Dejar de recibir',
      peligro: true,
      onConfirmar: asistencia.dejarDeRecibir,
    });
  }

  return (
    <Panel style={styles.caja} esquinas={DIAGONAL} chaflan={10} fondo={colors.surface} borde={colors.border}>
      <View style={styles.cabecera}>
        <Etiqueta color={colors.teamB}>¿Quién viene?</Etiqueta>
        <Text style={styles.dia} numberOfLines={1}>
          {comoSeLeeElDia(link.fecha)}
        </Text>
      </View>

      <Text style={styles.resumen}>
        <Text style={styles.vienen}>
          {grupos.vienen.length} {grupos.vienen.length === 1 ? 'viene' : 'vienen'}
        </Text>
        {' · '}
        <Text style={styles.noVienen}>{grupos.noVienen.length} no</Text>
        {' · '}
        {grupos.faltan.length} {grupos.faltan.length === 1 ? 'falta' : 'faltan'} contestar
      </Text>

      {boton ? (
        <View>
          <Button title={boton.titulo} onPress={asistencia.tildar} />
          {boton.bajada ? <Text style={styles.bajada}>{boton.bajada}</Text> : null}
        </View>
      ) : grupos.vienen.length > 0 ? (
        <Text style={styles.listo}>
          ✓ {grupos.vienen.length === 1
            ? `${grupos.vienen[0].nombre} ya está tildado`
            : `Ya están tildados los ${grupos.vienen.length} que vienen`}
        </Text>
      ) : (
        <Text style={styles.ayuda}>Todavía nadie dijo que viene.</Text>
      )}

      {grupos.faltan.length > 0 ? (
        <Button
          title={`Avisarles a ${quienes(grupos.faltan, `los ${grupos.faltan.length} que faltan`)}`}
          variant="ghost"
          onPress={() =>
            asistencia.avisarALosQueFaltan(grupos.faltan.map((j) => j.nombre), 'whatsapp')
          }
        />
      ) : null}

      <View style={styles.pie}>
        <Text style={[styles.cuando, error ? styles.error : null]} numberOfLines={1}>
          {error
            ? 'No se pudo actualizar: sin conexión'
            : leido
            ? `Actualizado ${hace(leido, Math.max(ahora, leido))}`
            : 'Mirando quién contestó…'}
        </Text>
        <Pressable onPress={() => setOpciones(true)} hitSlop={10}>
          <Text style={styles.mas}>Más opciones</Text>
        </Pressable>
      </View>

      <Hoja visible={opciones} titulo="¿Quién viene?" onClose={() => setOpciones(false)}>
        <Opcion
          icono={<SendIcon color={colors.sobreAcento} size={20} />}
          titulo="Volver a mandar el link"
          detalle="Para el que no lo vio. Lo que ya contestaron sigue igual."
          onPress={() => {
            setOpciones(false);
            asistencia.mandarDeNuevo('whatsapp');
          }}
        />
        <Opcion
          icono={<EyeIcon color={colors.sobreAcento} size={20} />}
          titulo="Ver la página que reciben"
          detalle="Así la ven tus amigos cuando tocan el link."
          onPress={() => {
            setOpciones(false);
            asistencia.verPagina();
          }}
        />
        <Opcion
          icono={<CalendarIcon color={colors.sobreAcento} size={20} />}
          titulo="Cambiar el día"
          detalle="Se manda un link nuevo y las respuestas empiezan de cero."
          onPress={() => {
            setOpciones(false);
            setCambiandoDia(true);
          }}
        />
        <Opcion
          icono={<EyeOffIcon color={colors.sobreAcento} size={20} />}
          titulo="Dejar de recibir respuestas"
          detalle="El link deja de andar. La lista queda como está."
          onPress={dejarDeRecibir}
        />
      </Hoja>

      <HojaPreguntar
        visible={cambiandoDia}
        titulo="¿Para qué otro día?"
        aviso="Se manda un link nuevo y las respuestas empiezan de cero."
        ocupado={ocupado}
        onMandar={(dia, via) => {
          setCambiandoDia(false);
          asistencia.preguntar(dia, via);
        }}
        onClose={() => setCambiandoDia(false)}
      />
      {dialogo}
    </Panel>
  );
}

const styles = StyleSheet.create({
  caja: { padding: spacing.md, gap: spacing.sm },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dia: { flex: 1, color: colors.text, fontSize: 14, fontFamily: fuentes.extra },
  ayuda: {
    color: colors.textMuted,
    fontSize: 13,
    fontFamily: fuentes.regular,
    lineHeight: 18,
  },
  resumen: { color: colors.textMuted, fontSize: 15, fontFamily: fuentes.semi },
  vienen: { color: colors.primary, fontFamily: fuentes.extra },
  noVienen: { color: colors.danger, fontFamily: fuentes.extra },
  bajada: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: fuentes.medium,
    textAlign: 'center',
    marginTop: 4,
  },
  listo: { color: colors.primary, fontSize: 14, fontFamily: fuentes.bold },
  pie: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  cuando: { flex: 1, color: colors.textMuted, fontSize: 12, fontFamily: fuentes.regular },
  mas: {
    color: colors.primary,
    fontSize: 12,
    fontFamily: fuentes.extra,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  error: { color: colors.aviso, fontSize: 12, fontFamily: fuentes.bold },
});
