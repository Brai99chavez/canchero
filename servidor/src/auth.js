import { betterAuth } from 'better-auth';
import { expo } from '@better-auth/expo';
import { pool } from './db.js';

/**
 * Las cuentas. Better Auth se encarga de lo que no conviene escribir a mano
 * —hasheo de contraseñas, sesiones largas, tokens de recuperación— pero las
 * tablas son nuestras: las crea en la misma base de Neon y se consultan con un
 * SELECT como cualquier otra.
 *
 * Las tablas se crean con `npx @better-auth/cli migrate` (ver README).
 */
export const auth = betterAuth({
  database: pool,

  // La URL pública del servidor. Better Auth la usa para armar los links de
  // los mails y para validar de dónde vienen los pedidos.
  baseURL: process.env.BASE_URL,
  secret: process.env.AUTH_SECRET,

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    // Se arranca sin confirmar el mail para no depender de un servicio de
    // envío el primer día. Antes de abrirla al público hay que prenderlo: si
    // no, cualquiera se registra con el mail de otro.
    requireEmailVerification: false,
  },

  // La app no es un sitio web: no hay cookies ni dominio, el token viaja en el
  // header. Este plugin es el que habilita ese modo y el esquema canchero://.
  plugins: [expo()],

  trustedOrigins: ['canchero://'],

  session: {
    // Un celular no se vuelve a loguear cada semana. La sesión dura 60 días y
    // se renueva sola mientras se use.
    expiresIn: 60 * 60 * 24 * 60,
    updateAge: 60 * 60 * 24,
  },

  rateLimit: {
    // Un registro y un login abiertos a internet se prueban por fuerza bruta.
    enabled: true,
    window: 60,
    max: 20,
  },

  advanced: {
    ipAddress: {
      // Detrás del proxy de Render, la conexión siempre viene de la misma IP
      // interna. Sin esto el límite de intentos cae en un balde único y
      // compartido: un solo atacante dejaría afuera a todos los demás.
      ipAddressHeaders: ['x-forwarded-for'],
    },
  },
});
