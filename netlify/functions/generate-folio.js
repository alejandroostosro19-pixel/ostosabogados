// generate-folio-simple.js - Versión simplificada usando la función upload existente

const { Client } = require('@microsoft/microsoft-graph-client');
const { ClientSecretCredential } = require('@azure/identity');

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
        const { tipo } = JSON.parse(event.body);
        
        if (!tipo || !['citatorio', 'demanda'].includes(tipo)) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Tipo inválido' })
            };
        }

        // Usar ClientSecretCredential (igual que en upload.js)
        const credential = new ClientSecretCredential(
            process.env.AZURE_TENANT_ID,
            process.env.AZURE_CLIENT_ID,
            process.env.AZURE_CLIENT_SECRET
        );

        const client = Client.initWithMiddleware({
            authProvider: {
                getAccessToken: async () => {
                    const tokenResponse = await credential.getToken('https://graph.microsoft.com/.default');
                    return tokenResponse.token;
                }
            }
        });

        // Determinar carpeta y prefijo
        const folderName = tipo === 'citatorio' ? 'Citatorios' : 'Demandas';
        const prefix = tipo === 'citatorio' ? 'CIT' : 'DEM';
        const year = new Date().getFullYear();

        const userId = process.env.OSTOS_USER_ID;

        let allFolios = [];

        try {
            // Buscar subcarpetas en Citatorios o Demandas (Veracruz, Orizaba, CDMX)
            const ubicaciones = ['Veracruz', 'Orizaba', 'CDMX'];
            
            for (const ubicacion of ubicaciones) {
                try {
                    const folderPath = `RegistrosLaborales/${folderName}/${ubicacion}`;
                    
                    // Obtener carpetas (folios) en cada ubicación
                    const foliosResponse = await client
                        .api(`/users/${userId}/drive/root:/${folderPath}:/children`)
                        .select('name,folder')
                        .get();

                    const folios = foliosResponse.value
                        .filter(item => item.folder && item.name.startsWith(prefix))
                        .map(item => item.name);

                    allFolios = allFolios.concat(folios);
                } catch (error) {
                    console.log(`No hay folios en ${ubicacion} o carpeta no existe:`, error.message);
                }
            }
        } catch (error) {
            console.log('Error al consultar folios:', error.message);
        }

        // Extraer números de folios existentes
        const regex = new RegExp(`${prefix}-(\\d{4})-(\\d{4})`);
        const numerosExistentes = allFolios
            .map(folio => {
                const match = folio.match(regex);
                if (match && match[1] === year.toString()) {
                    return parseInt(match[2]);
                }
                return 0;
            })
            .filter(num => num > 0);

        // Encontrar el número más alto
        const ultimoNumero = numerosExistentes.length > 0 
            ? Math.max(...numerosExistentes) 
            : 0;

        // Generar nuevo folio
        const nuevoNumero = ultimoNumero + 1;
        const consecutivo = String(nuevoNumero).padStart(4, '0');
        const nuevoFolio = `${prefix}-${year}-${consecutivo}`;

        console.log(`Folios existentes: ${allFolios.length}`);
        console.log(`Último número: ${ultimoNumero}`);
        console.log(`Nuevo folio: ${nuevoFolio}`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                folio: nuevoFolio,
                numero: nuevoNumero,
                foliosExistentes: allFolios.length
            })
        };

    } catch (error) {
        console.error('Error generando folio:', error);
        console.error('Error details:', error.message);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Error generando folio',
                details: error.message
            })
        };
    }
};
