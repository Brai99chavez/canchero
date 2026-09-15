export const colors = {
  bg: '#0D1124',
  surface: '#171C38',
  surfaceAlt: '#232949',
  border: '#2E3560',
  primary: '#4BF0A5',
  primaryDark: '#1FA974',
  text: '#EDEFFF',
  textMuted: '#8F95C4',
  danger: '#FF6B6B',
  teamA: '#4BF0A5',
  teamB: '#38BDF8',
  /** El texto que va sobre un relleno claro o sobre el degradado. */
  sobreAcento: '#08221A',
};
/**
 * Los degradados son lo que le da el brillo al conjunto. El acento va de
 * turquesa a verde; los paneles llevan uno mucho más sutil, apenas para que
 * no se vean planos.
 */
export const degradados = {
  acento: ['#5BF5A5', '#2FD9E8'] as const,
  panel: ['#1D2344', '#141931'] as const,
  panelTenue: ['#191E3A', '#12162C'] as const,
  peligro: ['#FF8A8A', '#F05252'] as const,
};
/**
 * La identidad visual: todo se inclina el mismo ángulo y se corta con el mismo
 * chaflán. Tener los números acá evita que cada pantalla invente el suyo.
 */
export const angulo = {
  inclinacion: '-9deg',
  derecho: '9deg',
  chaflan: 12,
};

/**
 * Movimiento seco: arranca rápido y frena de golpe, en vez del suavizado
 * clásico que se siente blando. `rebote` pasa apenas de largo y vuelve.
 */
export const tiempos = {
  corto: 170,
  medio: 220,
  filoso: [0.16, 1, 0.3, 1] as const,
  rebote: [0.34, 1.5, 0.64, 1] as const,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
};

/**
 * Barlow para todo el texto: es angosta y deportiva, así entra más en pantalla.
 * Anton queda para los títulos grandes, que es donde se nota el carácter.
 *
 * En React Native una fuente propia no combina con `fontWeight`: hay que
 * nombrar la variante exacta, por eso están todas listadas.
 */
export const fuentes = {
  display: 'Anton_400Regular',
  regular: 'Barlow_400Regular',
  medium: 'Barlow_500Medium',
  semi: 'Barlow_600SemiBold',
  bold: 'Barlow_700Bold',
  extra: 'Barlow_800ExtraBold',
  black: 'Barlow_900Black',
};

/** Sombra suave para las tarjetas. Android necesita `elevation` aparte. */
export const sombra = {
  shadowColor: '#000',
  shadowOpacity: 0.28,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 4 },
  elevation: 3,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};
