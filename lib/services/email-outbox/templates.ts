import type {
  CustomerBookingPayload,
  BarberBookingPayload,
} from "./types";

/**
 * Escapa caracteres especiales en cadenas dinámicas para su inserción segura en HTML.
 * Protege contra inyecciones XSS en clientes de correo electrónico.
 */
export function escapeHtml(value: string | number): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Formatea un instante ISO 8601 en fecha y hora legible para la zona horaria
 * oficial de la barbería ('America/Argentina/Buenos_Aires').
 */
export function formatDateTimeBuenosAires(isoDate: string): {
  dateStr: string;
  timeStr: string;
  fullStr: string;
} {
  const date = new Date(isoDate);

  const dateFormatter = new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const timeFormatter = new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const rawDate = dateFormatter.format(date);
  const timeStr = `${timeFormatter.format(date)} hs`;
  const dateStr = rawDate.charAt(0).toUpperCase() + rawDate.slice(1);
  const fullStr = `${dateStr} a las ${timeStr}`;

  return { dateStr, timeStr, fullStr };
}

/**
 * Formatea un importe numérico en pesos argentinos con separador de miles.
 */
export function formatPriceArs(amount: number, currency = "ARS"): string {
  const formatted = new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 0,
  }).format(amount);
  return `$${formatted} ${currency}`;
}

/**
 * Genera el email de confirmación de reserva para el cliente (HTML y Texto plano).
 */
export function renderCustomerConfirmationEmail(options: {
  payload: CustomerBookingPayload;
  baseUrl: string;
}): {
  subject: string;
  html: string;
  text: string;
} {
  const { payload, baseUrl } = options;
  const { fullStr } = formatDateTimeBuenosAires(payload.startAt);
  const formattedPrice = formatPriceArs(payload.servicePriceAmount, payload.currency);
  const cleanBaseUrl = baseUrl.replace(/\/+$/, "");
  const cancellationUrl = `${cleanBaseUrl}/cancelar/${encodeURIComponent(payload.cancellationToken)}`;

  const subject = `Confirmación de tu turno en Rove Barbería — ${payload.serviceName}`;

  const text = `Hola ${payload.customerName},

¡Tu turno en Rove Barbería está confirmado!

Detalles de la reserva:
- Servicio: ${payload.serviceName}
- Fecha y horario: ${fullStr}
- Duración estimada: ${payload.serviceDurationMinutes} minutos
- Precio: ${formattedPrice}

Ubicación:
Mar del Plata, Buenos Aires, Argentina

¿Necesitás cancelar tu turno?
Podés cancelarlo de forma anticipada haciendo clic en el siguiente enlace:
${cancellationUrl}

Recordá que las cancelaciones o reprogramaciones se realizan con al menos 2 horas de anticipación.

¡Te esperamos!
Rove Barbería
`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0c0a09; color: #f5f5f4; margin: 0; padding: 24px;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 560px; margin: 0 auto; background-color: #1c1917; border-radius: 12px; border: 1px solid #292524; overflow: hidden;">
    <tr>
      <td style="padding: 32px 28px; background: linear-gradient(180deg, #1c1917 0%, #171412 100%); border-bottom: 1px solid #292524;">
        <h1 style="color: #f5f5f4; font-size: 22px; font-weight: 700; margin: 0 0 8px 0; letter-spacing: -0.02em;">Rove Barbería</h1>
        <p style="color: #a8a29e; font-size: 15px; margin: 0;">¡Tu turno está confirmado, ${escapeHtml(payload.customerName)}!</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 28px;">
        <table width="100%" border="0" cellspacing="0" cellpadding="10" style="background-color: #292524; border-radius: 8px; margin-bottom: 24px;">
          <tr>
            <td style="color: #a8a29e; font-size: 14px; width: 35%;">Servicio:</td>
            <td style="color: #f5f5f4; font-size: 15px; font-weight: 600;">${escapeHtml(payload.serviceName)}</td>
          </tr>
          <tr>
            <td style="color: #a8a29e; font-size: 14px;">Fecha y hora:</td>
            <td style="color: #f5f5f4; font-size: 15px; font-weight: 600;">${escapeHtml(fullStr)}</td>
          </tr>
          <tr>
            <td style="color: #a8a29e; font-size: 14px;">Duración:</td>
            <td style="color: #f5f5f4; font-size: 14px;">${escapeHtml(payload.serviceDurationMinutes)} minutos</td>
          </tr>
          <tr>
            <td style="color: #a8a29e; font-size: 14px;">Precio:</td>
            <td style="color: #e7e5e4; font-size: 15px; font-weight: 600;">${escapeHtml(formattedPrice)}</td>
          </tr>
        </table>

        <div style="text-align: center; margin: 32px 0 20px 0;">
          <a href="${escapeHtml(cancellationUrl)}" style="background-color: #292524; color: #f87171; text-decoration: none; padding: 12px 22px; border-radius: 6px; font-size: 14px; font-weight: 600; display: inline-block; border: 1px solid #44403c;">
            Cancelar o reprogramar turno
          </a>
        </div>
        <p style="color: #78716c; font-size: 12px; text-align: center; margin: 0;">
          Las cancelaciones se realizan con un mínimo de 2 horas de anticipación.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding: 20px 28px; background-color: #171412; border-top: 1px solid #292524; text-align: center;">
        <p style="color: #78716c; font-size: 12px; margin: 0;">Rove Barbería — Mar del Plata, Argentina</p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}

/**
 * Genera el email de notificación operativa para el barbero (HTML y Texto plano).
 * EXCLUYE expresamente el token de cancelación del cliente.
 */
export function renderBarberNotificationEmail(options: {
  payload: BarberBookingPayload;
}): {
  subject: string;
  html: string;
  text: string;
} {
  const { payload } = options;
  const { fullStr } = formatDateTimeBuenosAires(payload.startAt);
  const formattedPrice = formatPriceArs(payload.servicePriceAmount, payload.currency);

  const subject = `Nuevo turno confirmado — ${payload.customerName} (${payload.serviceName})`;

  const text = `Nuevo turno reservado en Rove Barbería:

Cliente: ${payload.customerName}
Teléfono: ${payload.customerPhone}
Email: ${payload.customerEmail}

Servicio: ${payload.serviceName}
Fecha y hora: ${fullStr}
Duración: ${payload.serviceDurationMinutes} minutos
Precio: ${formattedPrice}
`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0c0a09; color: #f5f5f4; margin: 0; padding: 24px;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 560px; margin: 0 auto; background-color: #1c1917; border-radius: 12px; border: 1px solid #292524; overflow: hidden;">
    <tr>
      <td style="padding: 28px; background-color: #171412; border-bottom: 1px solid #292524;">
        <h1 style="color: #f5f5f4; font-size: 20px; font-weight: 700; margin: 0 0 6px 0;">Nuevo turno confirmado</h1>
        <p style="color: #a8a29e; font-size: 14px; margin: 0;">Un cliente reservó un turno en tu agenda.</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 24px 28px;">
        <h3 style="color: #e7e5e4; font-size: 15px; margin: 0 0 12px 0;">Datos del cliente:</h3>
        <ul style="color: #d6d3d1; font-size: 14px; margin: 0 0 20px 0; padding-left: 20px; line-height: 1.6;">
          <li><strong>Nombre:</strong> ${escapeHtml(payload.customerName)}</li>
          <li><strong>Teléfono:</strong> ${escapeHtml(payload.customerPhone)}</li>
          <li><strong>Email:</strong> ${escapeHtml(payload.customerEmail)}</li>
        </ul>

        <h3 style="color: #e7e5e4; font-size: 15px; margin: 0 0 12px 0;">Detalles del turno:</h3>
        <table width="100%" border="0" cellspacing="0" cellpadding="8" style="background-color: #292524; border-radius: 8px;">
          <tr>
            <td style="color: #a8a29e; font-size: 13px; width: 35%;">Servicio:</td>
            <td style="color: #f5f5f4; font-size: 14px; font-weight: 600;">${escapeHtml(payload.serviceName)}</td>
          </tr>
          <tr>
            <td style="color: #a8a29e; font-size: 13px;">Fecha y hora:</td>
            <td style="color: #f5f5f4; font-size: 14px; font-weight: 600;">${escapeHtml(fullStr)}</td>
          </tr>
          <tr>
            <td style="color: #a8a29e; font-size: 13px;">Duración:</td>
            <td style="color: #f5f5f4; font-size: 14px;">${escapeHtml(payload.serviceDurationMinutes)} min</td>
          </tr>
          <tr>
            <td style="color: #a8a29e; font-size: 13px;">Precio:</td>
            <td style="color: #f5f5f4; font-size: 14px; font-weight: 600;">${escapeHtml(formattedPrice)}</td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding: 16px 28px; background-color: #171412; border-top: 1px solid #292524; text-align: center;">
        <p style="color: #78716c; font-size: 12px; margin: 0;">Panel Rove Barbería</p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}
