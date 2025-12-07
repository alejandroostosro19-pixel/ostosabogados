// netlify/functions/upload.js
const { ClientSecretCredential } = require("@azure/identity");
const { Client } = require("@microsoft/microsoft-graph-client");
const { TokenCredentialAuthenticationProvider } = require("@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials");

// Handler de la función
exports.handler = async (event, context) => {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    // Manejar preflight request
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    // Solo aceptar POST
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        // Parsear el body
        const { folio, tipo, fileName, fileContent, datos, additionalFiles } = JSON.parse(event.body);

        console.log(`Procesando archivo: ${fileName} (${folio})`);

        // Validar datos requeridos
        if (!folio || !tipo || !fileName || !fileContent || !datos || !datos.ubicacion) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Faltan datos requeridos (incluyendo ubicación)' })
            };
        }

        // Credenciales desde variables de entorno
        const credential = new ClientSecretCredential(
            process.env.AZURE_TENANT_ID,
            process.env.AZURE_CLIENT_ID,
            process.env.AZURE_CLIENT_SECRET
        );

        // Crear cliente de Graph API
        const authProvider = new TokenCredentialAuthenticationProvider(credential, {
            scopes: ['https://graph.microsoft.com/.default']
        });

        const client = Client.initWithMiddleware({
            authProvider: authProvider
        });

        // Convertir base64 a buffer
        const fileBuffer = Buffer.from(fileContent, 'base64');

        // Determinar carpeta con ubicación y folio
        const tipoFolder = tipo === 'citatorio' ? 'Citatorios' : 'Demandas';
        const ubicacion = datos.ubicacion; // "Veracruz" o "CDMX"
        const folderPath = `${tipoFolder}/${ubicacion}/${folio}`; // Nueva estructura con carpeta por folio
        
        // Subir PDF a OneDrive del usuario específico
        const userId = process.env.OSTOS_USER_ID; // Object ID de alejandroostos
        const pdfPath = `/users/${userId}/drive/root:/RegistrosLaborales/${folderPath}/${fileName}:/content`;

        console.log(`Subiendo PDF a: ${pdfPath}`);

        await client
            .api(pdfPath)
            .put(fileBuffer);

        console.log('PDF subido exitosamente');

        // Subir archivos adicionales (si existen)
        if (additionalFiles && additionalFiles.length > 0) {
            console.log(`Subiendo ${additionalFiles.length} archivos adicionales...`);
            
            for (const adicional of additionalFiles) {
                const adicionalBuffer = Buffer.from(adicional.fileContent, 'base64');
                const adicionalPath = `/users/${userId}/drive/root:/RegistrosLaborales/${folderPath}/${adicional.fileName}:/content`;
                
                console.log(`Subiendo archivo adicional: ${adicional.fileName}`);
                
                await client
                    .api(adicionalPath)
                    .put(adicionalBuffer);
            }
            
            console.log('Archivos adicionales subidos exitosamente');
        }

        // Crear archivo JSON con datos
        const jsonFileName = fileName.replace('.pdf', '.json');
        const jsonPath = `/users/${userId}/drive/root:/RegistrosLaborales/${folderPath}/${jsonFileName}:/content`;
        
        const jsonData = {
            folio: folio,
            tipo: tipo,
            fechaRegistro: new Date().toISOString(),
            ...datos
        };

        const jsonBuffer = Buffer.from(JSON.stringify(jsonData, null, 2), 'utf-8');

        console.log(`Subiendo JSON a: ${jsonPath}`);

        await client
            .api(jsonPath)
            .put(jsonBuffer);

        console.log('JSON subido exitosamente');

        // Respuesta exitosa
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Archivos subidos exitosamente',
                folio: folio,
                files: {
                    pdf: fileName,
                    json: jsonFileName
                }
            })
        };

    } catch (error) {
        console.error('Error en la función:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: error.message,
                details: error.toString()
            })
        };
    }
};
