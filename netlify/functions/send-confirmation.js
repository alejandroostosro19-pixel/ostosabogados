// send-confirmation.js - CON RESEND

const { Resend } = require('resend');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const data = JSON.parse(event.body);
        
        // Configurar Resend
        const resend = new Resend(process.env.RESEND_API_KEY);

        const { folio, tipo, empresa, empleado, ubicacion, userEmail } = data;

        // ========================================
        // EMAIL 1: A LA EMPRESA (usuario logueado)
        // ========================================
        const emailToCompany = await resend.emails.send({
            from: 'Ostos Abogados <registros@ostosabogados.com>',
            to: userEmail,
            subject: `Confirmación de Registro - Folio ${folio}`,
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #1a5c3a; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .folio-box { background: white; border: 2px solid #1a5c3a; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
        .folio-number { font-size: 24px; font-weight: bold; color: #1a5c3a; }
        .info-box { background: #e8f5e9; padding: 15px; border-left: 4px solid #1a5c3a; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 0.9rem; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>OSTOS ABOGADOS</h1>
            <p>Confirmación de Registro</p>
        </div>
        <div class="content">
            <h2>Estimado Cliente,</h2>
            <p>Su caso ha sido registrado exitosamente en nuestro sistema.</p>
            
            <div class="folio-box">
                <div style="color: #666; margin-bottom: 10px;">Número de Folio</div>
                <div class="folio-number">${folio}</div>
            </div>

            <div class="info-box">
                <strong>Detalles del Registro:</strong><br>
                <strong>Tipo:</strong> ${tipo === 'demanda' ? 'Demanda Laboral' : 'Citatorio'}<br>
                <strong>Empresa:</strong> ${empresa}<br>
                <strong>Empleado:</strong> ${empleado}<br>
                <strong>Oficina:</strong> ${ubicacion}
            </div>

            <div class="info-box">
                <strong>📞 Próximos pasos:</strong><br>
                Un abogado de nuestro equipo se pondrá en contacto con usted en los próximos 5 días hábiles para darle seguimiento a su caso.
            </div>

            <p><strong>Importante:</strong> Por favor conserve este número de folio para futuras referencias.</p>
        </div>
        <div class="footer">
            <p>Este es un correo automático, por favor no responder.</p>
            <p><strong>Ostos Abogados</strong><br>
            Sistema de Seguimiento y Control</p>
        </div>
    </div>
</body>
</html>
            `
        });

        // ========================================
        // EMAIL 2: A OSTOS ABOGADOS
        // ========================================
        const emailToOstos = await resend.emails.send({
            from: 'Sistema Registro <registros@ostosabogados.com>',
            to: 'registros@ostosabogados.com',
            subject: `Nuevo Registro - ${folio}`,
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #1a5c3a; color: white; padding: 20px; text-align: center; }
        .content { background: #fff; padding: 20px; border: 1px solid #ddd; }
        .field { margin: 10px 0; padding: 10px; background: #f5f5f5; border-left: 3px solid #1a5c3a; }
        .field strong { color: #1a5c3a; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>🔔 Nuevo Registro Creado</h2>
        </div>
        <div class="content">
            <div class="field">
                <strong>Folio:</strong> ${folio}
            </div>
            <div class="field">
                <strong>Tipo:</strong> ${tipo === 'demanda' ? 'Demanda Laboral' : 'Citatorio'}
            </div>
            <div class="field">
                <strong>Empresa:</strong> ${empresa}
            </div>
            <div class="field">
                <strong>Empleado:</strong> ${empleado}
            </div>
            <div class="field">
                <strong>Oficina:</strong> ${ubicacion}
            </div>
            <div class="field">
                <strong>Creado por:</strong> ${userEmail}
            </div>
            <div class="field">
                <strong>Fecha:</strong> ${new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}
            </div>
        </div>
    </div>
</body>
</html>
            `
        });

        console.log('✅ Emails enviados exitosamente');
        console.log('Email 1 ID:', emailToCompany.id);
        console.log('Email 2 ID:', emailToOstos.id);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Emails enviados correctamente',
                emailIds: {
                    company: emailToCompany.id,
                    ostos: emailToOstos.id
                }
            })
        };

    } catch (error) {
        console.error('❌ Error enviando emails:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Error enviando emails',
                details: error.message
            })
        };
    }
};
