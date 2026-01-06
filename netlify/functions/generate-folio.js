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
            process.env.TENANT_ID,
            process.env.CLIENT_ID,
            process.env.CLIENT_SECRET
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

        const driveId = process.env.DRIVE_ID;
        const folderId = process.env.FOLDER_ID;

        let allFolios = [];

        try {
            // Buscar carpeta de tipo (Citatorios o Demandas)
            const tipoFolderResponse = await client
                .api(`/drives/${driveId}/items/${folderId}/children`)
                .filter(`name eq '${folderName}'`)
                .get();

            if (tipoFolderResponse.value && tipoFolderResponse.value.length > 0) {
                const tipoFolderId = tipoFolderResponse.value[0].id;

                // Obtener todas las ubicaciones (Veracruz, Orizaba, CDMX)
                const ubicacionesResponse = await client
                    .api(`/drives/${driveId}/items/${tipoFolderId}/children`)
                    .get();

                // Para cada ubicación, obtener los folios
                for (const ubicacion of ubicacionesResponse.value) {
                    if (ubicacion.folder) {
                        const foliosResponse = await client
                            .api(`/drives/${driveId}/items/${ubicacion.id}/children`)
                            .select('name')
                            .get();

                        const folios = foliosResponse.value
                            .filter(item => item.folder && item.name.startsWith(prefix))
                            .map(item => item.name);

                        allFolios = allFolios.concat(folios);
                    }
                }
            }
        } catch (error) {
            console.log('No hay folios previos o error al consultar:', error.message);
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
