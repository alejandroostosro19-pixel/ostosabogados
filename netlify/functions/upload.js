// netlify/functions/upload.js
const { ClientSecretCredential } = require("@azure/identity");
const { Client } = require("@microsoft/microsoft-graph-client");
const { TokenCredentialAuthenticationProvider } = require("@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials");

exports.handler = async (event, context) => {
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
        const { folio, folderPath, datos } = JSON.parse(event.body);

        console.log('Guardando JSON metadata para:', folio);

        if (!folio || !folderPath || !datos) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Faltan datos requeridos' })
            };
        }

        // Credenciales
        const credential = new ClientSecretCredential(
            process.env.AZURE_TENANT_ID,
            process.env.AZURE_CLIENT_ID,
            process.env.AZURE_CLIENT_SECRET
        );

        const authProvider = new TokenCredentialAuthenticationProvider(credential, {
            scopes: ['https://graph.microsoft.com/.default']
        });

        const client = Client.initWithMiddleware({ authProvider });

        const userId = process.env.OSTOS_USER_ID;

        // Crear archivo JSON con metadata
        const jsonFileName = `${folio}.json`;
        const jsonPath = `/users/${userId}/drive/root:/RegistrosLaborales/${folderPath}/${jsonFileName}:/content`;
        
        const jsonData = {
            folio: folio,
            fechaRegistro: new Date().toISOString(),
            ...datos
        };

        const jsonBuffer = Buffer.from(JSON.stringify(jsonData, null, 2), 'utf-8');

        console.log(`Subiendo JSON a: ${jsonPath}`);

        await client
            .api(jsonPath)
            .put(jsonBuffer);

        console.log('JSON metadata guardado exitosamente');

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Metadata guardada exitosamente',
                folio: folio
            })
        };

    } catch (error) {
        console.error('Error guardando metadata:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Error guardando metadata',
                details: error.message 
            })
        };
    }
};
