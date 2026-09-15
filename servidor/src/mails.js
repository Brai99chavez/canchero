/**
 * Los mails que manda la app: recuperar contraseña y confirmar la cuenta.
 *
 * Sin `RESEND_API_KEY` no se envía nada y el mail se escribe en el log del
 * servidor, con el link incluido. Eso permite probar el circuito entero sin
 * mandar correo de verdad, y que un despliegue mal configurado no se caiga:
 * queda anotado y sigue andando.
 */
const clave = process.env.RESEND_API_KEY;
const remitente =
  process.env.EMAIL_FROM ?? 'CANCHERO <onboarding@resend.dev>';
const publicaR2 = (process.env.R2_PUBLIC_URL ?? '').replace(/\/+$/, '');

export const hayMails = Boolean(clave);

/** Los mismos de src/theme.ts. */
const C = {
  fondo: '#0D1124',
  panel: '#171C38',
  borde: '#2E3560',
  acento: '#4BF0A5',
  sobreAcento: '#08221A',
  texto: '#EDEFFF',
  apagado: '#8F95C4',
  tenue: '#5A6099',
};

/**
 * El logotipo va como imagen y no como texto porque los clientes de correo no
 * cargan tipografías propias: Anton no existe en Gmail. Es la única forma de
 * que el nombre se vea con la letra de la app.
 *
 * Si el bucket no está configurado se cae a un título de texto, para que el
 * mail siga saliendo en vez de mostrar una imagen rota.
 */
function cabecera() {
  if (!publicaR2) {
    return `<p style="margin:0 0 20px;color:${C.acento};font-size:15px;letter-spacing:4px;font-weight:bold">CANCHERO</p>`;
  }
  return `<img src="${publicaR2}/publico/logo-mail.png" width="220" alt="CANCHERO"
    style="display:block;margin:0 0 24px;width:220px;max-width:100%;height:auto;border:0">`;
}

/**
 * El HTML es simple a propósito: tablas, estilos en línea y nada de flexbox ni
 * gradientes. Los clientes de correo soportan mucho menos que un navegador, y
 * un mail que llega roto es peor que uno feo.
 *
 * Lo que sí se conserva de la app es la paleta, los títulos en mayúsculas con
 * mucho espaciado —que es como se lee Anton— y el botón menta con texto
 * oscuro.
 */
function plantilla({ titulo, bajada, boton, url, pie }) {
  return `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${C.fondo}">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${bajada}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.fondo};padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:500px">

        <tr><td style="background:${C.panel};border:1px solid ${C.borde};padding:36px 32px">
          ${cabecera()}

          <h1 style="margin:0 0 14px;color:${C.texto};font-size:23px;line-height:29px;font-weight:bold;letter-spacing:0.5px;font-family:Helvetica,Arial,sans-serif;text-transform:uppercase">${titulo}</h1>

          <p style="margin:0 0 28px;color:${C.apagado};font-size:15px;line-height:23px;font-family:Helvetica,Arial,sans-serif">${bajada}</p>

          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr><td style="background:${C.acento}">
              <a href="${url}" style="display:block;padding:15px 30px;color:${C.sobreAcento};text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:bold;letter-spacing:1.2px;text-transform:uppercase">${boton}</a>
            </td></tr>
          </table>

          <p style="margin:28px 0 0;color:${C.apagado};font-size:13px;line-height:19px;font-family:Helvetica,Arial,sans-serif">${pie}</p>
        </td></tr>

        <tr><td style="padding:18px 32px 0">
          <p style="margin:0;color:${C.tenue};font-size:11px;line-height:17px;font-family:Helvetica,Arial,sans-serif">
            Si el botón no funciona, copiá y pegá este link en tu navegador:<br>
            <a href="${url}" style="color:${C.tenue};word-break:break-all">${url}</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>`;
}

/** La versión en texto, para el que lee el correo sin HTML. */
function enTexto({ titulo, bajada, url, pie }) {
  return `CANCHERO\n\n${titulo.toUpperCase()}\n\n${bajada}\n\n${url}\n\n${pie}\n`;
}

async function enviar(para, asunto, contenido) {
  const html = plantilla(contenido);

  if (!hayMails) {
    // Sin servicio configurado el link va al log: alcanza para desarrollar.
    console.log(`[mail sin enviar] para ${para} — ${asunto}`);
    console.log(contenido.url);
    return;
  }

  const respuesta = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${clave}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: remitente,
      to: [para],
      subject: asunto,
      html,
      // Muchos filtros de spam penalizan un mail que sólo trae HTML.
      text: enTexto(contenido),
    }),
  });

  if (!respuesta.ok) {
    const detalle = await respuesta.text().catch(() => '');
    throw new Error(
      `Resend respondió ${respuesta.status}: ${detalle.slice(0, 200)}`
    );
  }
}

export function mailDeRecuperacion(para, url) {
  return enviar(para, 'Recuperá tu contraseña de CANCHERO', {
    titulo: 'Cambiá tu contraseña',
    bajada:
      'Pediste volver a entrar a tu cuenta. Tocá el botón y elegí una nueva.',
    boton: 'Cambiar contraseña',
    url,
    pie: 'El link vence en una hora. Si no lo pediste vos, ignorá este mail: tu contraseña sigue siendo la de siempre.',
  });
}

export function mailDeConfirmacion(para, url) {
  return enviar(para, 'Confirmá tu cuenta de CANCHERO', {
    titulo: 'Confirmá tu mail',
    bajada:
      'Falta un paso para terminar de crear tu cuenta. Hasta que no confirmes, no vas a poder entrar.',
    boton: 'Confirmar mi cuenta',
    url,
    pie: 'Si no creaste ninguna cuenta, ignorá este mail y listo.',
  });
}

/** Para poder mirar cómo queda sin mandar nada. Lo usa tools/. */
export const _plantilla = plantilla;
