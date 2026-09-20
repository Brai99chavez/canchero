import * as Sharing from 'expo-sharing';
import React, { RefObject, useCallback, useRef } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import ShareCard from './components/ShareCard';
import { reparto } from './stats';
import { Player, TeamSplit } from './types';

/**
 * Mandar los equipos al grupo.
 *
 * Vive acá y no adentro de una pantalla porque se comparte desde dos lugares:
 * cuando se acaban de sortear, y después, entrando al partido desde la lista
 * de activos. Ese segundo lugar es el que faltaba: una vez guardado el
 * partido, la pantalla de equipos ya no se abre y no había forma de volver a
 * mandar la formación —que es justo cuando hace falta, porque el grupo
 * pregunta "¿quién juega con quién?" el día del partido, no el día del
 * sorteo—.
 *
 * Se manda una imagen. El texto es el plan B para cuando la captura no se
 * puede hacer o el teléfono no tiene con qué compartir un archivo.
 */

/** El texto plano, que es el plan B si la imagen no se puede generar. */
export function textoDeEquipos(split: TeamSplit): string {
  // Sin puntajes, igual que la imagen: esto va al grupo.
  const line = (p: Player) => `• ${p.nombre} (${p.posicion})`;
  const parts = [
    `${reparto(split.teamA.length, split.teamB.length)} — equipos armados`,
    '',
    'EQUIPO A',
    ...split.teamA.map(line),
    '',
    'EQUIPO B',
    ...split.teamB.map(line),
  ];
  if (split.bench.length > 0) {
    parts.push('', 'SUPLENTES', ...split.bench.map(line));
  }
  return parts.join('\n');
}

/**
 * Devuelve la referencia que hay que colgarle a `<EstampaOculta>` y la función
 * que comparte.
 *
 * Son dos cosas y no una porque la imagen se saca de algo que está dibujado:
 * `captureRef` fotografía una vista de verdad, así que la estampa tiene que
 * estar montada —fuera de la pantalla, pero montada— antes de que alguien
 * toque compartir.
 */
export function useCompartirEquipos(split: TeamSplit | null) {
  const estampa = useRef<View>(null);

  const compartir = useCallback(async () => {
    if (!split) return;

    const mandarTexto = async () => {
      try {
        await Share.share({ message: textoDeEquipos(split) });
      } catch {
        // El usuario canceló el diálogo de compartir.
      }
    };

    try {
      const uri = await captureRef(estampa, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
      if (!(await Sharing.isAvailableAsync())) {
        await mandarTexto();
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Compartir equipos',
      });
    } catch {
      // Si la captura falla (o el usuario cancela), queda el texto.
      await mandarTexto();
    }
  }, [split]);

  return { estampa, compartir };
}

/** La estampa dibujada fuera de pantalla, que es lo que se fotografía. */
export function EstampaOculta({
  referencia,
  split,
  plantel,
}: {
  referencia: RefObject<View | null>;
  split: TeamSplit | null;
  plantel: string;
}) {
  if (!split) return null;

  return (
    <View style={styles.fuera} pointerEvents="none">
      <View ref={referencia} collapsable={false}>
        <ShareCard split={split} plantel={plantel} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fuera: {
    position: 'absolute',
    left: -1000,
    top: 0,
    opacity: 0,
  },
});
