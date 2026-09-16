import React, { useState } from 'react';
import { compartir, descargar } from '../backup';
import { useDialogo } from '../components/Dialogo';
import Hoja, { Opcion } from '../components/Hoja';
import { DownloadIcon, SendIcon, ShareIcon } from '../components/icons';
import { colors } from '../theme';
import { Squad } from '../types';

/**
 * Las formas de sacar un plantel de acá.
 *
 * Mandárselo a alguien de CANCHERO va primero porque es lo que se quiere hacer
 * casi siempre: le llega adentro de la app, con las fotos, y lo acepta de un
 * toque. Las otras dos son para lo demás —guardarte una copia, o pasárselo a
 * alguien que no tiene la app— y ahí viaja un archivo suelto.
 */
export default function ExportarModal({
  visible,
  plantel,
  haySesion,
  onClose,
  onEnviar,
}: {
  visible: boolean;
  plantel: Squad | null;
  /** Sin cuenta no hay a quién mandárselo ni de parte de quién. */
  haySesion: boolean;
  onClose: () => void;
  onEnviar: () => void;
}) {
  const [trabajando, setTrabajando] = useState(false);
  const { dialogo, avisar } = useDialogo();

  async function conAviso(accion: () => Promise<void>) {
    if (trabajando) return;
    setTrabajando(true);
    try {
      await accion();
    } catch (error) {
      avisar(
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
      avisar(
        'Guardado',
        `El archivo quedó en ${carpeta}. Lo vas a encontrar con el explorador de archivos del teléfono.`,
        onClose
      );
    });

  const handleCompartir = () =>
    conAviso(async () => {
      if (!plantel) return;
      const pudo = await compartir([plantel]);
      if (!pudo) {
        avisar(
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
      titulo="Pasar el plantel"
      bajada={
        plantel
          ? `${plantel.jugadores.length} ` +
            `${plantel.jugadores.length === 1 ? 'jugador' : 'jugadores'} y su ` +
            'historial de partidos. En el archivo las fotos no viajan; ' +
            'enviándolo por la app, sí.'
          : undefined
      }
      onClose={onClose}
    >
      {haySesion ? (
        <Opcion
          icono={<SendIcon color={colors.sobreAcento} size={22} />}
          titulo="Enviar a alguien de CANCHERO"
          detalle="Con su nombre de usuario. Le llega adentro de la app y lo acepta ahí."
          onPress={onEnviar}
          disabled={trabajando}
        />
      ) : null}
      <Opcion
        icono={<DownloadIcon color={colors.sobreAcento} size={22} />}
        titulo="Guardar en el teléfono"
        detalle="Elegís la carpeta: Descargas, Drive, donde quieras. Queda en el teléfono."
        onPress={handleDescargar}
        disabled={trabajando}
      />
      <Opcion
        icono={<ShareIcon color={colors.sobreAcento} size={22} />}
        titulo="Compartir"
        detalle="Se lo mandás a alguien por WhatsApp, mail o lo que uses."
        onPress={handleCompartir}
        disabled={trabajando}
      />
      {dialogo}
    </Hoja>
  );
}
