import nodemailer from 'nodemailer';

/**
 * EmailService — Servicio de envío de correos institucionales
 *
 * Configuración vía variables de entorno (.env):
 *   MAIL_HOST      — smtp.office365.com  (Outlook/Microsoft 365)
 *   MAIL_PORT      — 587
 *   MAIL_USER      — correo remitente institucional (ej. sacc5i@puebla.gob.mx)
 *   MAIL_PASS      — contraseña de aplicación de Outlook
 *   MAIL_FROM_NAME — nombre visible del remitente (ej. C5i Puebla)
 *   MAIL_TEST_OVERRIDE — si está definido, todos los correos se redirigen a esta dirección (para pruebas)
 */
class EmailService {
  constructor() {
    this.transporter = null;
    this._init();
  }

  _init() {
    const user = process.env.MAIL_USER;
    const pass = process.env.MAIL_PASS;

    if (!user || !pass) {
      console.warn('⚠️  MAIL_USER o MAIL_PASS no configurados — el servicio de correo está DESHABILITADO');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST || 'smtp.office365.com',
      port: parseInt(process.env.MAIL_PORT || '587'),
      secure: false, // STARTTLS en puerto 587
      auth: { user, pass },
      tls: {
        // Microsoft 365 requiere esto para TLS negociación
        rejectUnauthorized: false
      }
    });

    console.log(`✅ EmailService inicializado — remitente: ${user}`);
    if (process.env.MAIL_TEST_OVERRIDE) {
      console.warn(`⚠️  MAIL_TEST_OVERRIDE activo — todos los correos irán a: ${process.env.MAIL_TEST_OVERRIDE}`);
    }
  }

  get estaDisponible() {
    return !!this.transporter;
  }

  /**
   * Enviar notificación de cita biométrica con PDF adjunto
   * @returns {Promise<boolean>} true si se envió correctamente
   */
  async enviarNotificacionCita(cita, persona, destinatario, pdfBuffer) {
    if (!this.transporter) {
      console.warn('EmailService no configurado — correo omitido');
      return false;
    }

    const emailDestino = process.env.MAIL_TEST_OVERRIDE || destinatario;
    const fromName = process.env.MAIL_FROM_NAME || 'C5i Puebla';
    const fromUser = process.env.MAIL_USER;

    try {
      await this.transporter.sendMail({
        from: `"${fromName}" <${fromUser}>`,
        to: emailDestino,
        subject: `Cita Biométrica Programada — ${cita.folio_cita}`,
        html: this._generarHtmlCita(cita, persona),
        attachments: [
          {
            filename: `Acuse_${cita.folio_cita}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf'
          }
        ]
      });
      console.log(`✅ Correo enviado a: ${emailDestino} (folio: ${cita.folio_cita})`);
      return true;
    } catch (err) {
      console.error(`❌ Error al enviar correo [${cita.folio_cita}]:`, err.message);
      return false;
    }
  }

  /**
   * Generar HTML institucional para la notificación de cita
   */
  _generarHtmlCita(cita, persona) {
    const fechaObj = new Date(cita.fecha_cita);
    const fechaFormateada = fechaObj.toLocaleDateString('es-MX', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      timeZone: 'America/Mexico_City'
    });
    const horaFormateada = fechaObj.toLocaleTimeString('es-MX', {
      hour: '2-digit', minute: '2-digit', hour12: true,
      timeZone: 'America/Mexico_City'
    });
    const nombreCompleto = persona.nombre_completo ||
      `${persona.nombre} ${persona.apellido_paterno} ${persona.apellido_materno || ''}`.trim();

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Notificación de Cita — C5i Puebla</title>
</head>
<body style="margin:0;padding:0;background-color:#f2f2f2;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f2f2;padding:24px 0;">
  <tr><td align="center">
  <table role="presentation" width="620" cellpadding="0" cellspacing="0"
    style="max-width:620px;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.10);">

    <!-- ══ CABECERA INSTITUCIONAL ══ -->
    <tr>
      <td style="background:linear-gradient(135deg,#6e1530 0%,#8b1f42 100%);padding:28px 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <p style="margin:0 0 2px;color:#c9a87a;font-size:10px;letter-spacing:2.5px;text-transform:uppercase;">
                Gobierno del Estado de Puebla
              </p>
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;line-height:1.3;">
                Secretaría de Seguridad Pública
              </h1>
              <p style="margin:5px 0 0;color:#e0c8a0;font-size:12px;">
                C5i · Centro de Comando, Control, Comunicaciones, Cómputo e Inteligencia
              </p>
            </td>
            <td align="right" valign="middle" width="90">
              <div style="display:inline-block;border:2px solid #c9a87a;border-radius:8px;padding:7px 14px;color:#f5e0b0;font-size:14px;font-weight:700;letter-spacing:1.5px;">
                SACC5i
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Banda dorada -->
    <tr><td style="background:#b3a060;height:3px;font-size:0;line-height:0;">&nbsp;</td></tr>

    <!-- ══ TÍTULO ══ -->
    <tr>
      <td style="padding:28px 32px 16px;">
        <h2 style="margin:0;color:#6e1530;font-size:20px;font-weight:700;">
          Notificación de Cita Biométrica
        </h2>
        <p style="margin:8px 0 0;color:#666666;font-size:14px;line-height:1.6;">
          El siguiente elemento de seguridad tiene programada su cita para la
          <strong>toma de datos biométricos</strong>. Se requiere presentarse en el lugar
          y hora indicados con los documentos señalados.
        </p>
      </td>
    </tr>

    <!-- ══ DATOS DEL ELEMENTO ══ -->
    <tr>
      <td style="padding:0 32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
          style="background:#fdf6f0;border:1px solid #e8d0c0;border-radius:8px;">
          <tr>
            <td style="padding:18px 22px;">
              <p style="margin:0 0 3px;color:#999;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;">
                Elemento registrado
              </p>
              <p style="margin:0;color:#1a1a1a;font-size:17px;font-weight:700;">${nombreCompleto}</p>
              <p style="margin:5px 0 0;color:#555;font-size:13px;">
                ${persona.puesto_nombre || 'Puesto no especificado'}
                &nbsp;·&nbsp;
                Oficio C3: <strong>${persona.numero_oficio_c3 || 'N/A'}</strong>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- ══ DETALLES DE CITA ══ -->
    <tr>
      <td style="padding:0 32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
          style="background:#6e1530;border-radius:10px;overflow:hidden;">
          <tr>
            <td style="padding:22px 26px;">
              <p style="margin:0 0 16px;color:#e0c8a0;font-size:10px;letter-spacing:2.5px;text-transform:uppercase;">
                Detalles de la cita programada
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="50%" style="padding-bottom:14px;vertical-align:top;">
                    <p style="margin:0;color:#c9a87a;font-size:10px;text-transform:uppercase;letter-spacing:1px;">Fecha</p>
                    <p style="margin:4px 0 0;color:#ffffff;font-size:14px;font-weight:600;line-height:1.4;">${fechaFormateada}</p>
                  </td>
                  <td width="50%" style="padding-bottom:14px;vertical-align:top;">
                    <p style="margin:0;color:#c9a87a;font-size:10px;text-transform:uppercase;letter-spacing:1px;">Hora</p>
                    <p style="margin:4px 0 0;color:#ffffff;font-size:14px;font-weight:600;">${horaFormateada}</p>
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="padding-bottom:14px;vertical-align:top;">
                    <p style="margin:0;color:#c9a87a;font-size:10px;text-transform:uppercase;letter-spacing:1px;">Lugar</p>
                    <p style="margin:4px 0 0;color:#ffffff;font-size:14px;font-weight:600;">${cita.lugar}</p>
                  </td>
                </tr>
                <tr>
                  <td colspan="2">
                    <p style="margin:0;color:#c9a87a;font-size:10px;text-transform:uppercase;letter-spacing:1px;">Folio de cita</p>
                    <p style="margin:4px 0 0;color:#f5d080;font-size:18px;font-weight:700;font-family:'Courier New',Courier,monospace;letter-spacing:2px;">${cita.folio_cita}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- ══ DOCUMENTOS REQUERIDOS ══ -->
    <tr>
      <td style="padding:0 32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
          style="border:1px solid #ddd;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="background:#f8f8f8;padding:12px 20px;border-bottom:1px solid #e0e0e0;">
              <strong style="color:#333;font-size:13px;">Documentos requeridos para la cita</strong>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 20px 12px;">
              <ul style="margin:0;padding-left:22px;color:#444;font-size:13px;line-height:2.0;">
                <li>Identificación oficial vigente (INE / Cédula Profesional / Pasaporte)</li>
                <li>CURP impreso y legible</li>
                <li>Comprobante de domicilio reciente (no mayor a 3 meses)</li>
                <li>Acta de nacimiento (original o copia certificada)</li>
                <li>Número de oficio C3: <strong>${persona.numero_oficio_c3 || 'Ver expediente'}</strong></li>
                <li>Este acuse impreso o en dispositivo (folio: <strong>${cita.folio_cita}</strong>)</li>
              </ul>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- ══ NOTA IMPORTANTE ══ -->
    <tr>
      <td style="padding:0 32px 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="background:#fff8e1;border-left:4px solid #f0a800;border-radius:0 6px 6px 0;padding:12px 16px;">
              <p style="margin:0;font-size:12px;color:#555;line-height:1.7;">
                <strong>Importante:</strong> Presentarse 10 minutos antes del horario indicado.
                La cita no podrá ser reprogramada sin aviso previo con al menos
                <strong>24 horas de anticipación</strong>. En caso de no asistir sin aviso,
                se registrará como inasistencia en el expediente del elemento.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- ══ PIE DE PÁGINA ══ -->
    <tr>
      <td style="background:#f5f5f5;border-top:1px solid #e0d0cc;padding:18px 32px;">
        <p style="margin:0;color:#999;font-size:11px;text-align:center;line-height:1.8;">
          C5i · Centro de Comando, Control, Comunicaciones, Cómputo e Inteligencia<br>
          Gobierno del Estado de Puebla — Secretaría de Seguridad Pública<br>
          <em>Este mensaje es generado automáticamente. Por favor no responder a este correo.</em><br>
          Folio de notificación: <strong>${cita.folio_cita}</strong> · ${new Date().toLocaleDateString('es-MX')}
        </p>
      </td>
    </tr>

  </table>
  </td></tr>
  </table>
</body>
</html>`;
  }
}

export default new EmailService();
