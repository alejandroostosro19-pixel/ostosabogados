// netlify/functions/create-upload-session.js
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
        const { fileName, folderPath } = JSON.parse(event.body);

        if (!fileName || !folderPath) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'fileName y folderPath son requeridos' })
            };
        }

        console.log(`Creando sesión de subida para: ${folderPath}/${fileName}`);

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
        
        // Crear sesión de subida en OneDrive
        const uploadSession = await client
            .api(`/users/${userId}/drive/root:/RegistrosLaborales/${folderPath}/${fileName}:/createUploadSession`)
            .post({
                item: {
                    "@microsoft.graph.conflictBehavior": "replace"
                }
            });

        console.log('Sesión de subida creada exitosamente');

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                uploadUrl: uploadSession.uploadUrl,
                expirationDateTime: uploadSession.expirationDateTime
            })
        };

    } catch (error) {
        console.error('Error creando sesión de subida:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Error creando sesión de subida',
                details: error.message 
            })
        };
    }
};
