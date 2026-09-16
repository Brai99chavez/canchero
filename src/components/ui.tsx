import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import {
  angulo,
  colors,
  degradados,
  fuentes,
  spacing,
} from '../theme';
import Panel, { CHAFLAN, DIAGONAL, FondoDegradado } from './Angular';
import { Etiqueta } from './Banner';
import { Presionable } from './motion';
import { Position, POSITION_COLORS, ratingColor } from '../types';

export function PositionPill({ position }: { position: Position }) {
  return <Etiqueta color={POSITION_COLORS[position]}>{position}</Etiqueta>;
}

export function RatingBadge({ value, size = 38 }: { value: number; size?: number }) {
  return (
    <View
      style={[
        styles.badge,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: ratingColor(value),
        },
      ]}
    >
      <Text style={[styles.badgeText, { color: ratingColor(value), fontSize: size * 0.4 }]}>
        {value}
      </Text>
    </View>
  );
}

export function StatBar({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.statTrack}>
        <View style={[styles.statFill, { width: `${Math.max(2, value)}%` }]}>
          <FondoDegradado
            colores={[ratingColor(value), degradados.acento[1]]}
          />
        </View>
      </View>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  /** Versión chica, para las acciones de los encabezados. */
  compacto?: boolean;
  style?: ViewStyle;
}

/**
 * El botón de toda la app.
 *
 * La esquina cortada en diagonal es la misma de los planteles: antes los
 * botones eran un paralelogramo inclinado y las tarjetas un bloque con el
 * chaflán, así que la app tenía dos formas distintas para lo mismo. El fondo
 * lo dibuja un SVG porque React Native no sabe cortar esquinas.
 */
export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  compacto,
  style,
}: ButtonProps) {
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';
  const apagado = Boolean(disabled || loading);
  const relleno = isPrimary
    ? degradados.acento
    : isDanger
    ? degradados.peligro
    : undefined;

  return (
    <Presionable
      onPress={onPress}
      disabled={apagado}
      style={[apagado && styles.buttonDisabled, style]}
    >
      <Panel
        style={[styles.button, compacto && styles.buttonCompacto]}
        esquinas={DIAGONAL}
        chaflan={compacto ? 9 : CHAFLAN}
        // Apagado va sin degradado: el relleno lleno se leería como habilitado
        // aunque esté al 40% de opacidad.
        degradado={apagado ? undefined : relleno}
        fondo="transparent"
        borde={relleno && !apagado ? 'transparent' : colors.border}
        grosor={relleno && !apagado ? 0 : 1.5}
      >
        {loading ? (
          <ActivityIndicator
            color={isPrimary ? colors.sobreAcento : colors.text}
          />
        ) : (
          <Text
            style={[
              styles.buttonText,
              compacto && styles.buttonTextCompacto,
              isPrimary && !apagado && styles.buttonTextPrimary,
              isDanger && !apagado && styles.buttonTextDanger,
            ]}
          >
            {title.toUpperCase()}
          </Text>
        )}
      </Panel>
    </Presionable>
  );
}

/**
 * Un error explicado, con la cara de la app. Reemplaza al cartel del sistema
 * cuando el problema es del formulario que se está mirando: un `Alert` tapa la
 * pantalla, obliga a aceptarlo y se lleva puesto el contexto de lo que pasó.
 *
 * El detalle no es decoración: decir "mail o contraseña incorrectos" sin
 * agregar qué hacer deja a la persona probando lo mismo de nuevo.
 */
/**
 * Un botón que es sólo un ícono: volver, la tuerca, importar, agregar.
 *
 * Estaba repetido en cuatro pantallas, cada una con su tamaño y su borde. Con
 * la esquina cortada, como todo lo demás.
 */
export function BotonIcono({
  children,
  onPress,
  accessibilityLabel,
  relleno,
  style,
}: {
  children: React.ReactNode;
  onPress: () => void;
  accessibilityLabel?: string;
  /** Lleno con el acento —el que propone la acción— o sólo su recuadro. */
  relleno?: boolean;
  style?: ViewStyle;
}) {
  return (
    <Presionable
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      style={style}
    >
      <Panel
        style={styles.botonIcono}
        esquinas={DIAGONAL}
        chaflan={9}
        degradado={relleno ? degradados.acento : degradados.panel}
        borde={relleno ? 'transparent' : colors.border}
        grosor={relleno ? 0 : 1.5}
      >
        {children}
      </Panel>
    </Presionable>
  );
}

/**
 * Un cartel dentro de la pantalla.
 *
 * El tono cambia el borde y no el texto: rojo cuando algo salió mal, y del
 * color de la app cuando es algo que falta hacer. Pedirle a alguien que elija
 * su nombre de usuario con el mismo rojo que un error es decirle que se
 * equivocó cuando todavía no hizo nada.
 */
export function Aviso({
  titulo,
  detalle,
  tono = 'error',
}: {
  titulo: string;
  detalle?: string;
  tono?: 'error' | 'pendiente';
}) {
  return (
    <Panel
      style={styles.aviso}
      degradado={degradados.panelTenue}
      borde={tono === 'error' ? colors.danger : colors.primary}
      grosor={1.5}
      esquinas={DIAGONAL}
    >
      <Text style={styles.avisoTitulo}>{titulo}</Text>
      {detalle ? <Text style={styles.avisoDetalle}>{detalle}</Text> : null}
    </Panel>
  );
}

export function EmptyState({
  title,
  subtitle,
  pasos,
  accion,
  onAccion,
}: {
  title: string;
  subtitle: string;
  /** Los primeros pasos, para que la pantalla vacía no sea un callejón. */
  pasos?: string[];
  accion?: string;
  onAccion?: () => void;
}) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>

      {pasos ? (
        <View style={styles.pasos}>
          {pasos.map((paso, i) => (
            <View key={paso} style={styles.paso}>
              <View style={styles.pasoNumero}>
                <Text style={styles.pasoNumeroTexto}>{i + 1}</Text>
              </View>
              <Text style={styles.pasoTexto}>{paso}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {accion && onAccion ? (
        <Button title={accion} onPress={onAccion} style={styles.emptyBoton} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  aviso: { padding: spacing.md },
  avisoTitulo: {
    color: colors.danger,
    fontSize: 14,
    fontFamily: fuentes.extra,
    letterSpacing: 0.3,
  },
  avisoDetalle: {
    color: colors.textMuted,
    fontSize: 12.5,
    fontFamily: fuentes.regular,
    lineHeight: 17,
    marginTop: 3,
  },
  badge: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: 'Barlow_800ExtraBold',
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 6,
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: 'Barlow_400Regular',
    width: 108,
  },
  statTrack: {
    flex: 1,
    height: 7,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
    transform: [{ skewX: angulo.inclinacion }],
  },
  statFill: {
    height: '100%',
  },
  statValue: {
    color: colors.text,
    fontSize: 12,
    fontFamily: 'Barlow_700Bold',
    width: 24,
    textAlign: 'right',
  },
  button: {
    /*
     * Crece, pero sin flexBasis en cero. Dos botones al lado del otro se
     * estiran al alto del más alto —uno tiene el texto en dos líneas y el otro
     * en una— y sin esto el bloque de adentro se quedaba con su alto de
     * contenido: mismo espacio, recuadros de distinto tamaño.
     *
     * `flex: 1` no sirve acá: pone flexBasis en 0 y en un padre de alto
     * automático el bloque se aplasta a nada.
     */
    flexGrow: 1,
    paddingVertical: 13,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonCompacto: {
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
  },
  buttonTextCompacto: {
    fontSize: 12,
    letterSpacing: 0.8,
  },
  botonIcono: {
    width: 40,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    color: colors.text,
    fontFamily: 'Barlow_800ExtraBold',
    fontSize: 14,
    letterSpacing: 1,
    textAlign: 'center',
  },
  buttonTextPrimary: {
    color: colors.sobreAcento,
  },
  buttonTextDanger: {
    color: '#2A0806',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 19,
    fontFamily: 'Anton_400Regular',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: colors.textMuted,
    fontSize: 14,
    fontFamily: 'Barlow_400Regular',
    textAlign: 'center',
    lineHeight: 20,
  },
  pasos: {
    marginTop: spacing.xl,
    gap: spacing.md,
    alignSelf: 'stretch',
  },
  paso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  pasoNumero: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary + '26',
    borderWidth: 1,
    borderColor: colors.primary + '59',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pasoNumeroTexto: {
    color: colors.primary,
    fontSize: 12,
    fontFamily: 'Barlow_900Black',
  },
  pasoTexto: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 13,
    fontFamily: 'Barlow_400Regular',
    lineHeight: 18,
  },
  emptyBoton: {
    marginTop: spacing.xl,
    alignSelf: 'stretch',
  },
});
