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

export const pool = new pg.Pool({
  connectionString: url,
  // Neon siempre pide TLS y su certificado lo firma una autoridad de verdad,
  // así que se verifica entero. Apagar la verificación es lo que suele
  // ponerse para que "ande", y deja la conexión abierta a que alguien se meta
  // en el medio.
  ssl: { rejectUnauthorized: true },
  // El plan gratis de Neon corta las conexiones ociosas; mejor pocas y que se
  // cierren solas antes de que las cierre el otro lado.
  max: 5,
  idleTimeoutMillis: 10_000,
});

export function consultar(sql, valores = []) {
  return pool.query(sql, valores);
}
