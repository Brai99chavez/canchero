import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SILUETA } from '../assets';
import Panel, { DIAGONAL, FondoDegradado } from '../components/Angular';
import { Seccion } from '../components/Banner';
import { useDialogo } from '../components/Dialogo';
import { Presionable } from '../components/motion';
import { Aviso, Button, EmptyState } from '../components/ui';
import {
  Amigo,
  listarAmigos,
  pedirAmistad,
  responderAmistad,
} from '../nube/amigos';
import { Explicacion, explicar } from '../nube/cuenta';
import { normalizar } from '../nube/perfil';
import { colors, degradados, fuentes, radius, spacing } from '../theme';

/**
 * Los amigos: con quién ya lo sos, quién te está esperando y a quién esperás.
 *
 * La lista se pide al entrar y después de cada acción, no cada tantos
 * segundos: la base se suspende sola cuando nadie la usa, y un refresco
 * periódico la mantendría despierta para siempre sin que haya nada nuevo.
 */
export default function AmigosScreen({
  amigos,
  cargando,
  tengoUsuario,
  onRecargar,
  onAbrir,
  onIrAPerfil,
}: {
  amigos: Amigo[];
  cargando: boolean;
  /** Sin nombre propio no se puede agregar a nadie ni que te agreguen. */
  tengoUsuario: boolean;
  onRecargar: () => Promise<void>;
  onAbrir: (usuario: string) => void;
  onIrAPerfil: () => void;
}) {
  const [buscado, setBuscado] = useState('');
  const [agregando, setAgregando] = useState(false);
  const [error, setError] = useState<Explicacion | null>(null);
  const [respondiendo, setRespondiendo] = useState<string | null>(null);
  const { dialogo, avisar, preguntar } = useDialogo();

  useEffect(() => {
    setError(null);
  }, [tengoUsuario]);

  const limpio = normalizar(buscado);

  const handleAgregar = async () => {
    setAgregando(true);
    setError(null);
    try {
      const salida = await pedirAmistad(limpio);
      setBuscado('');
      await onRecargar();
      avisar(
        salida.estado === 'aceptada' ? 'Ya son amigos' : 'Solicitud mandada',
        salida.estado === 'aceptada'
          ? `@${salida.usuario} ya te había agregado, así que quedaron amigos.`
          : `Le llegó a @${salida.usuario}. Cuando acepte van a poder pasarse planteles.`
      );
    } catch (problema) {
      setError(explicar(problema));
    } finally {
      setAgregando(false);
    }
  };

  const responder = useCallback(
    async (usuario: string, acepta: boolean) => {
      setRespondiendo(usuario);
      try {
        await responderAmistad(usuario, acepta);
        await onRecargar();
      } catch (problema) {
        setError(explicar(problema));
      } finally {
        setRespondiendo(null);
      }
    },
    [onRecargar]
  );

  /*
   * Las solicitudes que tenés que responder van arriba de todo: es lo único
   * de esta pantalla que espera algo tuyo. Después los amigos, y al final las
   * que mandaste vos, que no dependen de vos.
   */
  const paraResponder = amigos.filter(
    (a) => a.estado === 'pendiente' && !a.loPediYo
  );
  const aceptados = amigos.filter((a) => a.estado === 'aceptada');
  const esperando = amigos.filter(
    (a) => a.estado === 'pendiente' && a.loPediYo
  );

  if (!tengoUsuario) {
    return (
      <View style={styles.container}>
        <Text style={styles.titulo}>AMIGOS</Text>
        <EmptyState
          title="Elegí tu nombre de usuario"
          subtitle="Es con lo que tus amigos te agregan y te pasan planteles. Se elige en Perfil y lo podés cambiar cuando quieras."
          accion="Ir a Perfil"
          onAccion={onIrAPerfil}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>AMIGOS</Text>
      <View style={styles.buscador}>
        <View style={styles.campo}>
          <Text style={styles.arroba}>@</Text>
          <TextInput
            value={buscado}
            onChangeText={(t) => {
              setBuscado(t);
              setError(null);
            }}
            placeholder="agregar por nombre de usuario"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={20}
            onSubmitEditing={limpio.length >= 3 ? handleAgregar : undefined}
            returnKeyType="send"
          />
        </View>
        <Button
          title="Agregar"
          onPress={handleAgregar}
          disabled={limpio.length < 3}
          loading={agregando}
          compacto
        />
      </View>

      {error ? (
        <View style={styles.avisoCaja}>
          <Aviso titulo={error.titulo} detalle={error.detalle} />
        </View>
      ) : null}

      <FlatList
        keyboardShouldPersistTaps="handled"
        data={aceptados}
        keyExtractor={(item) => item.usuario}
        contentContainerStyle={styles.lista}
        onRefresh={onRecargar}
        refreshing={cargando}
        ListHeaderComponent={
          paraResponder.length > 0 ? (
            <View style={styles.bloque}>
              <Seccion>Te quieren agregar</Seccion>
              {paraResponder.map((a) => (
                <Panel
                  key={a.usuario}
                  style={styles.solicitud}
                  degradado={degradados.panel}
                  borde={colors.primary}
                  grosor={1.5}
                  esquinas={DIAGONAL}
                >
                  <View style={styles.fila}>
                    <Retrato foto={a.foto} />
                    <Text style={styles.usuario}>@{a.usuario}</Text>
                  </View>
                  <View style={styles.botones}>
                    <Button
                      title="Aceptar"
                      onPress={() => responder(a.usuario, true)}
                      disabled={respondiendo !== null}
                      loading={respondiendo === a.usuario}
                      compacto
                    />
                    <Button
                      title="Rechazar"
                      onPress={() => responder(a.usuario, false)}
                      disabled={respondiendo !== null}
                      variant="ghost"
                      compacto
                    />
                  </View>
                </Panel>
              ))}
            </View>
          ) : null
        }
        ListEmptyComponent={
          paraResponder.length > 0 || esperando.length > 0 ? null : (
            <EmptyState
              title="Todavía no tenés amigos acá"
              subtitle="Pedile a alguien su nombre de usuario de CANCHERO y agregalo arriba. Después van a poder pasarse planteles y escribirse."
            />
          )
        }
        ListFooterComponent={
          esperando.length > 0 ? (
            <View style={styles.bloque}>
              <Seccion>Esperando que acepten</Seccion>
              {esperando.map((a) => (
                <View key={a.usuario} style={styles.esperando}>
                  <Retrato foto={a.foto} />
                  <Text style={styles.usuarioTenue}>@{a.usuario}</Text>
                  <Presionable
                    onPress={() =>
                      preguntar({
                        titulo: 'Cancelar la solicitud',
                        mensaje: `Se saca el pedido a @${a.usuario}. Lo podés volver a mandar cuando quieras.`,
                        confirmar: 'Cancelar',
                        peligro: true,
                        onConfirmar: () => responder(a.usuario, false),
                      })
                    }
                    style={styles.cancelar}
                  >
                    <Text style={styles.cancelarTexto}>Cancelar</Text>
                  </Presionable>
                </View>
              ))}
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Presionable
            onPress={() => onAbrir(item.usuario)}
            style={styles.amigo}
          >
            <FondoDegradado colores={degradados.panelTenue} />
            <Retrato foto={item.foto} />
            <View style={styles.amigoTextos}>
              <Text style={styles.usuario}>@{item.usuario}</Text>
              <Text style={styles.ultimo} numberOfLines={1}>
                {item.ultimo === null
                  ? 'Todavía no se escribieron'
                  : item.ultimo.tipo === 'plantel'
                  ? 'Se pasaron un plantel'
                  : item.ultimo.texto}
              </Text>
            </View>
            {item.sinLeer > 0 ? (
              <View style={styles.globo}>
                <Text style={styles.globoTexto}>
                  {item.sinLeer > 9 ? '9+' : item.sinLeer}
                </Text>
              </View>
            ) : null}
          </Presionable>
        )}
      />

      {dialogo}
    </View>
  );
}

/** La foto de alguien, o la silueta si no puso ninguna. */
function Retrato({ foto }: { foto: string | null }) {
  return (
    <View style={styles.retrato}>
      {foto ? (
        <Image source={{ uri: foto }} style={styles.retratoFoto} resizeMode="cover" />
      ) : (
        <Image source={SILUETA} style={styles.retratoSilueta} resizeMode="contain" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  titulo: {
    color: colors.text,
    fontSize: 22,
    fontFamily: fuentes.display,
    letterSpacing: 1,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  buscador: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  campo: { flex: 1, justifyContent: 'center' },
  arroba: {
    position: 'absolute',
    left: spacing.md,
    color: colors.textMuted,
    fontSize: 15,
    fontFamily: fuentes.bold,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingLeft: 32,
    paddingRight: spacing.md,
    paddingVertical: 11,
    color: colors.text,
    fontSize: 15,
    fontFamily: fuentes.regular,
  },
  avisoCaja: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  lista: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl, gap: spacing.sm },
  bloque: { gap: spacing.sm, marginBottom: spacing.md },
  solicitud: { padding: spacing.md, gap: spacing.sm },
  fila: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  botones: { flexDirection: 'row', gap: spacing.sm },
  amigo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  amigoTextos: { flex: 1 },
  usuario: { color: colors.text, fontSize: 15, fontFamily: fuentes.extra },
  usuarioTenue: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 14,
    fontFamily: fuentes.regular,
  },
  ultimo: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: fuentes.regular,
    marginTop: 1,
  },
  esperando: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  cancelar: { paddingHorizontal: spacing.sm, paddingVertical: 4 },
  cancelarTexto: {
    color: colors.danger,
    fontSize: 12,
    fontFamily: fuentes.bold,
    letterSpacing: 0.3,
  },
  retrato: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  retratoFoto: { width: '100%', height: '100%' },
  retratoSilueta: { width: '60%', height: '60%', opacity: 0.5 },
  globo: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  globoTexto: { color: '#FFFFFF', fontSize: 11, fontFamily: fuentes.extra },
});
