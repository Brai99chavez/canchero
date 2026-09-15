import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Rect } from 'react-native-svg';
import { colors, fuentes } from '../theme';
import { overall, Player, Position } from '../types';
import { Presionable } from './motion';

const ANCHO = 100;
const ALTO = 140;

/**
 * Cada línea tiene su altura fija en la cancha. Antes se sacaban las vacías y
 * las demás se repartían todo el alto, así que un equipo sin arquero dibujaba
 * a sus defensores sobre la línea de gol, y uno sin defensores mandaba a los
 * medios al fondo. La franja de cada puesto no puede depender de quién falta.
 */
const LINEAS: { puestos: Position[]; y: number }[] = [
  { puestos: ['ARQ'], y: 127 },
  { puestos: ['DEF'], y: 99 },
  { puestos: ['MED', 'LIB'], y: 66 },
  { puestos: ['DEL'], y: 31 },
];

const VERDE_CANCHA = '#151B36';
const LINEA_CANCHA = '#32406F';

/** Reparte los jugadores en líneas según su posición, de fondo a ataque. */
function armarLineas(players: Player[]): { jugadores: Player[]; y: number }[] {
  return LINEAS.map((linea) => ({
    y: linea.y,
    jugadores: players.filter((p) => linea.puestos.includes(p.posicion)),
  })).filter((linea) => linea.jugadores.length > 0);
}

export default function Pitch({
  players,
  medias,
  color,
  elegidoId,
  onTocar,
}: {
  players: Player[];
  /** La media a mostrar en cada ficha, ya corregida por resultados. */
  medias: Record<string, number>;
  color: string;
  elegidoId: string | null;
  onTocar: (id: string) => void;
}) {
  const lineas = armarLineas(players);

  return (
    <View style={styles.contenedor}>
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        style={StyleSheet.absoluteFill}
      >
        <Rect
          x="0"
          y="0"
          width={ANCHO}
          height={ALTO}
          rx="4"
          fill={VERDE_CANCHA}
        />
        <Rect
          x="3"
          y="3"
          width={ANCHO - 6}
          height={ALTO - 6}
          rx="2"
          fill="none"
          stroke={LINEA_CANCHA}
          strokeWidth="0.8"
        />
        <Line
          x1="3"
          y1={ALTO / 2}
          x2={ANCHO - 3}
          y2={ALTO / 2}
          stroke={LINEA_CANCHA}
          strokeWidth="0.8"
        />
        <Circle
          cx={ANCHO / 2}
          cy={ALTO / 2}
          r="12"
          fill="none"
          stroke={LINEA_CANCHA}
          strokeWidth="0.8"
        />
        <Rect
          x={ANCHO / 2 - 20}
          y={ALTO - 21}
          width="40"
          height="18"
          fill="none"
          stroke={LINEA_CANCHA}
          strokeWidth="0.8"
        />
        <Rect
          x={ANCHO / 2 - 20}
          y="3"
          width="40"
          height="18"
          fill="none"
          stroke={LINEA_CANCHA}
          strokeWidth="0.8"
        />
      </Svg>

      {/* Las fichas van como vistas encima del dibujo y no adentro del SVG:
          así se pueden tocar y resaltar igual que las filas de la lista. */}
      {lineas.map((linea) =>
        linea.jugadores.map((jugador, j) => {
          const x = (ANCHO * (j + 1)) / (linea.jugadores.length + 1);
          const y = linea.y;
          const elegido = jugador.id === elegidoId;
          return (
            <Presionable
              key={jugador.id}
              onPress={() => onTocar(jugador.id)}
              style={[
                styles.ficha,
                {
                  left: `${(x / ANCHO) * 100}%`,
                  top: `${(y / ALTO) * 100}%`,
                },
              ]}
            >
              <View
                style={[
                  styles.disco,
                  { backgroundColor: color },
                  elegido && styles.discoElegido,
                ]}
              >
                <Text style={styles.media}>
                  {medias[jugador.id] ?? overall(jugador)}
                </Text>
              </View>
              <Text style={styles.nombre} numberOfLines={1}>
                {jugador.nombre.split(' ')[0].slice(0, 9)}
              </Text>
            </Presionable>
          );
        })
      )}
    </View>
  );
}

const TAMANIO = 34;
const ANCHO_FICHA = 58;

const styles = StyleSheet.create({
  contenedor: {
    width: '100%',
    aspectRatio: ANCHO / ALTO,
  },
  ficha: {
    position: 'absolute',
    width: ANCHO_FICHA,
    alignItems: 'center',
    // El punto calculado es el centro del disco, no la esquina de la ficha.
    marginLeft: -ANCHO_FICHA / 2,
    marginTop: -TAMANIO / 2,
  },
  disco: {
    width: TAMANIO,
    height: TAMANIO,
    borderRadius: TAMANIO / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  discoElegido: {
    borderColor: colors.text,
    transform: [{ scale: 1.12 }],
  },
  media: {
    color: colors.sobreAcento,
    fontSize: 14,
    fontFamily: fuentes.extra,
  },
  nombre: {
    color: colors.text,
    fontSize: 10,
    fontFamily: fuentes.bold,
    marginTop: 2,
  },
});
