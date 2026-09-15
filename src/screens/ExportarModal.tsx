import React, { useState } from 'react';
import { Alert } from 'react-native';
import { compartir, descargar } from '../backup';
import Hoja, { Opcion } from '../components/Hoja';
import { DownloadIcon, ShareIcon } from '../components/icons';
import { colors } from '../theme';
import { Squad } from '../types';

/**
 * Los dos caminos de exportar. Antes era un botón solo que abría el menú de
 * compartir, y no había forma de quedarse con el archivo: el respaldo dependía
 * de mandárselo a uno mismo por WhatsApp.
 */
export default function ExportarModal({
  visible,
  plantel,
  onClose,
}: {
  visible: boolean;
  plantel: Squad | null;
  onClose: () => void;
}) {
  const [trabajando, setTrabajando] = useState(false);

  async function conAviso(accion: () => Promise<void>) {
    if (trabajando) return;
    setTrabajando(true);
    try {
      await accion();
    } catch (error) {
      Alert.alert(
        'No se pudo exportar',
        String(error instanceof Error ? error.message : error)
      );
    } finally {
      setTrabajando(false);
    }
  }

  const handleDescargar = () =>
    conAviso(async () => {
      if (!plantel) return;
      const carpeta = await descargar([plantel]);
      // Sin carpeta es que cerró el selector: no hay nada que avisar.
      if (!carpeta) return;
      onClose();
      Alert.alert(
        'Guardado',
        `El archivo quedó en ${carpeta}. Lo vas a encontrar con el explorador de archivos del teléfono.`
      );
    });

  const handleCompartir = () =>
    conAviso(async () => {
      if (!plantel) return;
      const pudo = await compartir([plantel]);
      if (!pudo) {
        Alert.alert(
          'No se puede compartir',
          'Este teléfono no tiene con qué compartir archivos.'
        );
        return;
      }
      onClose();
    });

  return (
    <Hoja
      visible={visible}
      titulo="Exportar plantel"
      bajada={
        plantel
          ? `Se genera un archivo JSON con ${plantel.jugadores.length} ` +
            `${plantel.jugadores.length === 1 ? 'jugador' : 'jugadores'} y su ` +
            'historial de partidos. Las fotos no viajan.'
          : undefined
      }
      onClose={onClose}
    >
      <Opcion
        icono={<DownloadIcon color={colors.primary} size={21} />}
        titulo="Guardar en el teléfono"
        detalle="Elegís la carpeta: Descargas, Drive, donde quieras. Queda en el teléfono."
        onPress={handleDescargar}
        disabled={trabajando}
      />
      <Opcion
        icono={<ShareIcon color={colors.primary} size={21} />}
        titulo="Compartir"
        detalle="Se lo mandás a alguien por WhatsApp, mail o lo que uses."
        onPress={handleCompartir}
        disabled={trabajando}
      />
    </Hoja>
  );
}
