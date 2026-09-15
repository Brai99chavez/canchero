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

export const hayMails = Boolean(clave);

/**
 * El HTML va con los colores de la app pero simple a propósito: los clientes
 * de correo soportan mucho menos CSS que un navegador, y un mail que llega
 * roto es peor que uno feo.
 */
function plantilla(titulo, bajada, boton, url, pie) {
  return `<!doctype html>
<html lang="es"><body style="margin:0;background:#0D1124;padding:32px 16px;font-family:Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:480px;background:#171C38;border:1px solid #2E3560;border-radius:14px;padding:32px">
        <tr><td>
          <p style="margin:0 0 4px;color:#4BF0A5;font-size:13px;letter-spacing:2px;font-weight:bold">CANCHERO</p>
          <h1 style="margin:0 0 12px;color:#EDEFFF;font-size:22px">${titulo}</h1>
          <p style="margin:0 0 24px;color:#8F95C4;font-size:15px;line-height:22px">${bajada}</p>
          <a href="${url}" style="display:inline-block;background:#4BF0A5;color:#08221A;text-decoration:none;font-weight:bold;font-size:15px;padding:13px 26px;border-radius:8px">${boton}</a>
          <p style="margin:24px 0 0;color:#8F95C4;font-size:12px;line-height:18px">${pie}</p>
          <p style="margin:16px 0 0;color:#5A6099;font-size:11px;word-break:break-all">Si el botón no anda, copiá este link:<br>${url}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

async function enviar(para, asunto, html) {
  if (!hayMails) {
    // Sin servicio configurado el link va al log: alcanza para desarrollar.
    console.log(`[mail sin enviar] para ${para} — ${asunto}`);
    console.log(html.match(/https?:\/\/[^\s"'<]+/)?.[0] ?? '(sin link)');
    return;
  }

  const respuesta = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${clave}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: remitente, to: [para], subject: asunto, html }),
  });

  if (!respuesta.ok) {
    const detalle = await respuesta.text().catch(() => '');
    throw new Error(`Resend respondió ${respuesta.status}: ${detalle.slice(0, 200)}`);
  }
}

export function mailDeRecuperacion(para, url) {
  return enviar(
    para,
    'Recuperá tu contraseña de CANCHERO',
    plantilla(
      'Cambiá tu contraseña',
      'Pediste volver a entrar a tu cuenta. Tocá el botón y elegí una nueva.',
      'Cambiar contraseña',
      url,
      'El link vence en una hora. Si no lo pediste vos, ignorá este mail: tu contraseña sigue siendo la de siempre.'
    )
  );
}

export function mailDeConfirmacion(para, url) {
  return enviar(
    para,
    'Confirmá tu cuenta de CANCHERO',
    plantilla(
      'Confirmá tu mail',
      'Falta un paso para terminar de crear tu cuenta.',
      'Confirmar mi cuenta',
      url,
      'Si no creaste ninguna cuenta, ignorá este mail.'
    )
  );
}
