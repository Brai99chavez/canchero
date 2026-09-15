import { betterAuth } from 'better-auth';
import { expo } from '@better-auth/expo';
import { pool } from './db.js';
import { mailDeConfirmacion, mailDeRecuperacion } from './mails.js';

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

    /**
     * Sin esto una contraseña olvidada es la cuenta perdida para siempre, con
     * el respaldo adentro. Es lo primero que había que resolver de los mails,
     * antes que confirmar la dirección.
     */
    sendResetPassword: async ({ user, url }) => {
      await mailDeRecuperacion(user.email, url);
    },
    resetPasswordTokenExpiresIn: 60 * 60,

    /**
     * Sin esto cualquiera se registra con el mail de otro, y ese otro se queda
     * sin poder usar el suyo. Hasta que no confirme, la cuenta existe pero no
     * puede entrar.
     */
    requireEmailVerification: true,
  },

  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await mailDeConfirmacion(user.email, url);
    },
    /** El mail sale al registrarse, sin que la app tenga que pedirlo aparte. */
    sendOnSignUp: true,
    /** Al confirmar queda la sesión abierta, sin pedir la contraseña de nuevo. */
    autoSignInAfterVerification: true,
  },

  // La app no es un sitio web: no hay cookies ni dominio, el token viaja en el
  // header. Este plugin es el que habilita ese modo y el esquema canchero://.
  plugins: [expo()],

  /**
   * De dónde se aceptan pedidos. `canchero://` es el esquema de la app
   * compilada.
   *
   * Probando con Expo Go el origen es otro —`exp://ip:8081/--/`, porque quien
   * corre es Expo Go y no la app— así que hay que sumarlo a mano con la
   * variable TRUSTED_ORIGINS, separando por comas. El patrón que sirve es
   * `exp://*​/*`: con un solo comodín no matchea, porque el origen trae ese
   * `/--/` al final.
   *
   * Va por variable de entorno y no fijo en el código para poder sacarlo
   * antes de publicar sin tocar nada.
   */
  trustedOrigins: [
    'canchero://',
    ...(process.env.TRUSTED_ORIGINS ?? '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  ],

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
