import pg from 'pg';

/**
 * La conexión a Neon. La cadena tiene usuario y contraseña, así que vive sólo
 * acá adentro: nunca en la app, que es un archivo que cualquiera se baja.
 */
const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    'Falta DATABASE_URL. Es la cadena de conexión de Neon, de las variables ' +
      'de entorno del servidor.'
  );
}

/**
 * Una base en esta misma compu, para probar sin tocar la de verdad. Ésa no
 * tiene TLS, y no le hace falta: no sale de la máquina. Se decide por el host
 * y no por una variable aparte, así no hay forma de apagar el TLS de Neon por
 * error.
 */
const esLocal = /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(url);

export const pool = new pg.Pool({
  connectionString: url,
  // Neon siempre pide TLS y su certificado lo firma una autoridad de verdad,
  // así que se verifica entero. Apagar la verificación es lo que suele
  // ponerse para que "ande", y deja la conexión abierta a que alguien se meta
  // en el medio.
  ssl: esLocal ? false : { rejectUnauthorized: true },
  // El plan gratis de Neon corta las conexiones ociosas; mejor pocas y que se
  // cierren solas antes de que las cierre el otro lado.
  max: 5,
  idleTimeoutMillis: 10_000,
});

export function consultar(sql, valores = []) {
  return pool.query(sql, valores);
}
