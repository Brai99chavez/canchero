import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SILUETA } from '../assets';
import Panel, { DIAGONAL } from '../components/Angular';
import CampoTexto from '../components/CampoTexto';
import Hoja from '../components/Hoja';
import { Aviso, Button } from '../components/ui';
import { Amigo } from '../nube/amigos';
import { Explicacion, explicar } from '../nube/cuenta';
import { enviarPlantel } from '../nube/envios';
import { colors, fuentes, spacing } from '../theme';
import { Squad } from '../types';

/**
 * A quién le paso este plantel.
 *
 * Se elige de la lista de amigos y no se escribe el nombre a mano, que es lo
 * que había antes: tener que acordarse de cómo se escribe el usuario del otro
 * —y que te lo pase bien— era pedirle a la gente que hiciera de teclado. Acá
 * el que ya es amigo está a un toque.
 *
 * Va una copia: el que recibe la acepta y a partir de ahí es suya. Lo que haga
 * cualquiera de los dos después no toca lo del otro, que es lo que espera
 * cualquiera cuando dice "te paso el plantel".
 */
export default function EnviarModal({
  visible,
  plantel,
  amigos,
  onClose,
  onFotosSubidas,
  onIrAAmigos,
}: {
  visible: boolean;
  plantel: Squad | null;
  amigos: Amigo[];
  onClose: () => void;
  /**
   * Mandar sube las fotos que faltaban. Se avisa para poder guardar las URLs
   * en el teléfono y no volver a subirlas en la próxima sincronización.
   */
  onFotosSubidas: (plantel: Squad) => void;
  /** Para el que todavía no tiene a nadie a quien mandárselo. */
  onIrAAmigos: () => void;
}) {
  const [busqueda, setBusqueda] = useState('');
  const [enviando, setEnviando] = useState<string | null>(null);
  const [error, setError] = useState<Explicacion | null>(null);
  const [mandadoA, setMandadoA] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setBusqueda('');
    setEnviando(null);
    setError(null);
    setMandadoA(null);
  }, [visible]);

  /*
   * Sólo los que ya aceptaron: a una solicitud pendiente no se le puede
   * mandar nada todavía, y mostrarla acá sería ofrecer algo que va a fallar.
   *
   * Ordenados de la A a la Z y no por conversación reciente. Acá se viene
   * buscando a alguien puntual —"se lo mando a Rodri"— y para eso el orden
   * alfabético es el único donde sabés de antemano dónde mirar.
   */
  const lista = useMemo(() => {
    const busca = busqueda.trim().toLowerCase();
    return amigos
      .filter((a) => a.estado === 'aceptada')
      .filter((a) => !busca || a.usuario.toLowerCase().includes(busca))
      .sort((a, b) => a.usuario.localeCompare(b.usuario, 'es'));
  }, [amigos, busqueda]);

  const cuantosAmigos = amigos.filter((a) => a.estado === 'aceptada').length;

  const handleEnviar = async (usuario: string) => {
    if (!plantel || enviando) return;
    setEnviando(usuario);
    setError(null);
    try {
      const actualizado = await enviarPlantel(usuario, plantel);
      if (actualizado !== plantel) onFotosSubidas(actualizado);
      setMandadoA(usuario);
    } catch (problema) {
      setError(explicar(problema));
    } finally {
      setEnviando(null);
    }
  };

  const cuantos = plantel?.jugadores.length ?? 0;

  return (
    <Hoja
      visible={visible}
      titulo={mandadoA ? 'Mandado' : 'Compartir plantel'}
      bajada={
        mandadoA || !plantel
          ? undefined
          : `Se manda una copia de ${plantel.nombre} con sus ${cuantos} ` +
            `${cuantos === 1 ? 'jugador' : 'jugadores'}, las fotos y el ` +
            'historial. Lo que cambie cada uno después no toca lo del otro.'
      }
      onClose={onClose}
    >
      {mandadoA ? (
        <>
          <Text style={styles.listo}>
            Le llegó a @{mandadoA}. Le va a aparecer en el chat y ahí decide si
            lo acepta.
          </Text>
          <Button title="Listo" onPress={onClose} />
        </>
      ) : (
        <>
          {error ? (
            <Aviso titulo={error.titulo} detalle={error.detalle} />
          ) : null}

          {cuantosAmigos === 0 ? (
            <>
              <Text style={styles.vacio}>
                Todavía no tenés amigos en la app. Agregá a alguien por su
                nombre de usuario y después vas a poder pasarle tus planteles.
              </Text>
              <Button title="Ir a Amigos" onPress={onIrAAmigos} />
            </>
          ) : (
            <>
              <CampoTexto
                value={busqueda}
                onChangeText={setBusqueda}
                placeholder="Buscar amigo"
                autoCapitalize="none"
                autoCorrect={false}
              />

              {lista.length === 0 ? (
                <Text style={styles.vacio}>
                  Ninguno de tus amigos se llama así.
                </Text>
              ) : (
                <FlatList
                  data={lista}
                  keyExtractor={(a) => a.usuario}
                  keyboardShouldPersistTaps="handled"
                  style={styles.lista}
                  renderItem={({ item }) => (
                    <Pressable
                      onPress={() => handleEnviar(item.usuario)}
                      disabled={enviando !== null}
                    >
                      <Panel
                        style={styles.amigo}
                        esquinas={DIAGONAL}
                        chaflan={9}
                        fondo={colors.surface}
                        borde={colors.border}
                      >
                        <Retrato foto={item.foto} />
                        <Text style={styles.usuario} numberOfLines={1}>
                          @{item.usuario}
                        </Text>
                        <Text style={styles.accion}>
                          {enviando === item.usuario ? 'MANDANDO…' : 'MANDAR'}
                        </Text>
                      </Panel>
                    </Pressable>
                  )}
                />
              )}
            </>
          )}
        </>
      )}
    </Hoja>
  );
}

function Retrato({ foto }: { foto: string | null }) {
  return (
    <View style={styles.retrato}>
      {foto ? (
        <Image
          source={{ uri: foto }}
          style={styles.retratoFoto}
          resizeMode="cover"
        />
      ) : (
        <Image
          source={SILUETA}
          style={styles.retratoSilueta}
          resizeMode="contain"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Alto acotado: la hoja no puede crecer hasta tapar la pantalla cuando
  // alguien tiene treinta amigos.
  lista: { maxHeight: 340 },
  amigo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    marginBottom: spacing.sm,
  },
  retrato: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  retratoFoto: { width: '100%', height: '100%' },
  retratoSilueta: { width: '60%', height: '60%', opacity: 0.5 },
  usuario: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontFamily: fuentes.bold,
  },
  accion: {
    color: colors.primary,
    fontSize: 11,
    fontFamily: fuentes.extra,
    letterSpacing: 0.8,
  },
  vacio: {
    color: colors.textMuted,
    fontSize: 13,
    fontFamily: fuentes.regular,
    lineHeight: 19,
  },
  listo: {
    color: colors.text,
    fontSize: 14,
    fontFamily: fuentes.regular,
    lineHeight: 20,
  },
});
