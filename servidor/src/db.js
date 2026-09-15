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
  // Neon siempre pide TLS. Sin esto la conexión se rechaza.
  ssl: { rejectUnauthorized: false },
  // El plan gratis de Neon corta las conexiones ociosas; mejor pocas y que se
  // cierren solas antes de que las cierre el otro lado.
  max: 5,
  idleTimeoutMillis: 10_000,
});

export function consultar(sql, valores = []) {
  return pool.query(sql, valores);
}
