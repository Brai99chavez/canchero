import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

/**
 * Iconos de trazo, todos en una caja de 24x24. Se dibujan con el color que se
 * les pase, así sirven tanto en la barra como sobre fondos claros.
 */
interface IconProps {
  color: string;
  size?: number;
}

function Trazo({
  color,
  size = 22,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </Svg>
  );
}

/**
 * Arma el contorno de una tuerca: por cada diente, dos puntos en el radio
 * externo y dos en el interno. El agujero del medio es un segundo subpath que
 * con `evenodd` queda calado en vez de relleno.
 */
function pathTuerca(dientes = 8): string {
  const centro = 12;
  const radioDiente = 11.2;
  const radioBase = 8.2;
  const radioHueco = 3.6;
  const paso = 360 / dientes;

  const punto = (grados: number, radio: number) => {
    const rad = ((grados - 90) * Math.PI) / 180;
    return `${(centro + radio * Math.cos(rad)).toFixed(2)},${(
      centro +
      radio * Math.sin(rad)
    ).toFixed(2)}`;
  };

  const tramos: string[] = [];
  for (let i = 0; i < dientes; i++) {
    const a = i * paso;
    tramos.push(punto(a - paso * 0.24, radioDiente));
    tramos.push(punto(a + paso * 0.24, radioDiente));
    tramos.push(punto(a + paso * 0.42, radioBase));
    tramos.push(punto(a + paso * 0.58, radioBase));
  }

  const hueco =
    `M ${centro - radioHueco},${centro} ` +
    `a ${radioHueco},${radioHueco} 0 1,0 ${radioHueco * 2},0 ` +
    `a ${radioHueco},${radioHueco} 0 1,0 ${-radioHueco * 2},0 Z`;

  return `M ${tramos.join(' L ')} Z ${hueco}`;
}

const TUERCA = pathTuerca();

export function GearIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={TUERCA} fill={color} fillRule="evenodd" />
    </Svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Trazo {...props}>
      <Path d="M12 5v14" />
      <Path d="M5 12h14" />
    </Trazo>
  );
}

/** Flecha que entra a una bandeja: importar. */
export function ImportIcon(props: IconProps) {
  return (
    <Trazo {...props}>
      <Path d="M12 3v12" />
      <Path d="M8 11.5l4 3.7 4-3.7" />
      <Path d="M4 14v5a2 2 0 002 2h12a2 2 0 002-2v-5" />
    </Trazo>
  );
}

/** Dos personas: el plantel. */
export function PeopleIcon(props: IconProps) {
  return (
    <Trazo {...props}>
      <Path d="M15 20v-1.5a4 4 0 00-4-4H6a4 4 0 00-4 4V20" />
      <Circle cx="8.5" cy="7.5" r="3.5" />
      <Path d="M17 4.6a3.5 3.5 0 010 6.8" />
      <Path d="M22 20v-1.5a4 4 0 00-3-3.85" />
    </Trazo>
  );
}

/** Pelota: el partido. */
export function BallIcon(props: IconProps) {
  return (
    <Trazo {...props}>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M12 7.6l3.6 2.6-1.4 4.2H9.8l-1.4-4.2z" />
      <Path d="M12 3v4.6" />
      <Path d="M20.5 10.2l-4.9 0" />
      <Path d="M17.7 19.4l-3.5-5" />
      <Path d="M6.3 19.4l3.5-5" />
      <Path d="M3.5 10.2l4.9 0" />
    </Trazo>
  );
}

/** Reloj: los partidos en curso. */
export function ClockIcon(props: IconProps) {
  return (
    <Trazo {...props}>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M12 7.2V12l3.4 2" />
    </Trazo>
  );
}

/** Lista con tilde: los partidos ya jugados. */
export function CheckListIcon(props: IconProps) {
  return (
    <Trazo {...props}>
      <Path d="M3 7h11" />
      <Path d="M3 12h8" />
      <Path d="M3 17h6" />
      <Path d="M14 16.8l2.2 2.2L21 14" />
    </Trazo>
  );
}

/** Una persona: la cuenta. */
export function UserIcon(props: IconProps) {
  return (
    <Trazo {...props}>
      <Circle cx="12" cy="8" r="4" />
      <Path d="M4.5 20v-1a5 5 0 015-5h5a5 5 0 015 5v1" />
    </Trazo>
  );
}

/** Barras: la tabla. */
export function ChartIcon(props: IconProps) {
  return (
    <Trazo {...props}>
      <Path d="M6 20v-7" />
      <Path d="M12 20V4" />
      <Path d="M18 20v-11" />
    </Trazo>
  );
}
