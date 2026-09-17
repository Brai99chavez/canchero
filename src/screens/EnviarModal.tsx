import React, { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Explicacion, explicar } from '../nube/cuenta';
import { enviarPlantel } from '../nube/envios';
import { normalizar } from '../nube/perfil';
import Hoja from '../components/Hoja';
import CampoTexto from '../components/CampoTexto';
import { Aviso, Button } from '../components/ui';
import { colors, fuentes } from '../theme';
import { Squad } from '../types';

/**
 * Mandarle este plantel a otro por su nombre de usuario.
 *
 * Va una copia: el que recibe la acepta y a partir de ahí es suya. Lo que haga
 * cualquiera de los dos después no toca lo del otro, que es lo que espera
 * cualquiera cuando dice "te paso el plantel".
 */
export default function EnviarModal({
  visible,
  plantel,
  onClose,
  onFotosSubidas,
}: {
  visible: boolean;
  plantel: Squad | null;
  onClose: () => void;
  /**
   * Mandar sube las fotos que faltaban. Se avisa para poder guardar las URLs
   * en el teléfono y no volver a subirlas en el próximo respaldo.
   */
  onFotosSubidas: (plantel: Squad) => void;
}) {
  const [usuario, setUsuario] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<Explicacion | null>(null);
  const [mandadoA, setMandadoA] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setUsuario('');
    setEnviando(false);
    setError(null);
    setMandadoA(null);
  }, [visible]);

  const limpio = normalizar(usuario);
  const sePuede = limpio.length >= 3 && plantel !== null;

  const handleEnviar = async () => {
    if (!plantel) return;
    setEnviando(true);
    setError(null);
    try {
      const actualizado = await enviarPlantel(limpio, plantel);
      if (actualizado !== plantel) onFotosSubidas(actualizado);
      setMandadoA(limpio);
    } catch (problema) {
      setError(explicar(problema));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Hoja
      visible={visible}
      titulo={mandadoA ? 'Mandado' : 'Enviar plantel'}
      bajada={
        mandadoA
          ? undefined
          : plantel
          ? `Se le manda una copia de ${plantel.nombre} con sus ${plantel.jugadores.length} ` +
            `${plantel.jugadores.length === 1 ? 'jugador' : 'jugadores'}, las fotos ` +
            'y el historial. Lo que cambie cada uno después no toca lo del otro.'
          : undefined
      }
      onClose={onClose}
    >
      {mandadoA ? (
        <>
          <Text style={styles.listo}>
            Le llegó a @{mandadoA}. Lo va a ver la próxima vez que abra la app,
            y ahí decide si lo acepta.
          </Text>
          <Button title="Listo" onPress={onClose} />
        </>
      ) : (
        <>
          {error ? (
            <Aviso titulo={error.titulo} detalle={error.detalle} />
          ) : null}

          <CampoTexto
            izquierda={<Text style={styles.arroba}>@</Text>}
            value={usuario}
            onChangeText={(t) => {
              setUsuario(t);
              setError(null);
            }}
            placeholder="nombre de usuario"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={20}
            onSubmitEditing={sePuede ? handleEnviar : undefined}
            returnKeyType="send"
          />

          <Text style={styles.ayuda}>
            Es el nombre que la otra persona eligió en su perfil, no su mail.
            Tiene que pasártelo tal cual.
          </Text>

          <Button
            title="Enviar"
            onPress={handleEnviar}
            disabled={!sePuede}
            loading={enviando}
          />
        </>
      )}
    </Hoja>
  );
}

const styles = StyleSheet.create({
  // La arroba no forma parte del nombre, pero es como se lee y se escribe en
  // cualquier otro lado.
  arroba: {
    color: colors.textMuted,
    fontSize: 16,
    fontFamily: fuentes.bold,
  },
  ayuda: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: fuentes.regular,
    lineHeight: 17,
  },
  listo: {
    color: colors.text,
    fontSize: 14,
    fontFamily: fuentes.regular,
    lineHeight: 20,
  },
});
