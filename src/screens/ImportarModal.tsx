import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { importar } from '../backup';
import { useDialogo } from '../components/Dialogo';
import Hoja from '../components/Hoja';
import { Button } from '../components/ui';
import { colors, fuentes, spacing } from '../theme';
import { Squad } from '../types';

/**
 * Explica qué se importa antes de abrir el explorador de archivos. Sin esto,
 * el botón abría el selector del sistema de una y no había forma de saber qué
 * archivo buscar ni qué iba a pasar con lo que ya estaba cargado.
 */
export default function ImportarModal({
  visible,
  onClose,
  onImportar,
}: {
  visible: boolean;
  onClose: () => void;
  onImportar: (nuevos: Squad[]) => void;
}) {
  const [trabajando, setTrabajando] = useState(false);
  const { dialogo, avisar } = useDialogo();

  async function handleBuscar() {
    setTrabajando(true);
    try {
      const resultado = await importar();
      // Sin resultado es que cerró el selector: no hay nada que avisar.
      if (!resultado) return;

      onImportar(resultado.planteles);
      avisar(
        'Listo',
        `Se agregaron ${resultado.planteles.length} ${
          resultado.planteles.length === 1 ? 'plantel' : 'planteles'
        } con ${resultado.jugadores} jugadores` +
          (resultado.partidos > 0
            ? ` y ${resultado.partidos} ${
                resultado.partidos === 1 ? 'partido' : 'partidos'
              } de historial.`
            : '.'),
        onClose
      );
    } catch (error) {
      avisar(
        'No se pudo importar',
        String(error instanceof Error ? error.message : error)
      );
    } finally {
      setTrabajando(false);
    }
  }

  return (
    <Hoja
      visible={visible}
      titulo="Importar plantel"
      bajada="Buscá un archivo JSON exportado desde CANCHERO, tuyo o de un amigo."
      onClose={onClose}
    >
      <View style={styles.puntos}>
        <Punto>
          Se agrega como un plantel nuevo: <Fuerte>nunca pisa</Fuerte> lo que ya
          tenés cargado.
        </Punto>
        <Punto>
          Vienen los jugadores con sus stats y el historial de partidos, con
          goles y asistencias.
        </Punto>
        <Punto>
          Las fotos no viajan en el archivo: los jugadores importados arrancan
          con la silueta.
        </Punto>
        <Punto>
          Si importás dos veces el mismo archivo vas a terminar con el plantel
          repetido. Se borra desde su tuerca.
        </Punto>
      </View>

      <Button
        title="Buscar archivo"
        onPress={handleBuscar}
        loading={trabajando}
        style={styles.boton}
      />
      {dialogo}
    </Hoja>
  );
}

function Punto({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.punto}>
      <Text style={styles.vinieta}>›</Text>
      <Text style={styles.texto}>{children}</Text>
    </View>
  );
}

function Fuerte({ children }: { children: React.ReactNode }) {
  return <Text style={styles.fuerte}>{children}</Text>;
}

const styles = StyleSheet.create({
  puntos: { gap: spacing.sm },
  punto: { flexDirection: 'row', gap: spacing.sm },
  vinieta: {
    color: colors.primary,
    fontSize: 15,
    fontFamily: fuentes.extra,
    lineHeight: 18,
  },
  texto: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 13,
    fontFamily: fuentes.regular,
    lineHeight: 18,
  },
  fuerte: { color: colors.text, fontFamily: fuentes.bold },
  boton: { marginTop: spacing.md },
});
