// generate-folio.js - Genera folios únicos consultando OneDrive

const { Client } = require('@microsoft/microsoft-graph-client');
require('isomorphic-fetch');

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
                body: JSON.stringify({ error: 'Tipo inválido. Debe ser "citatorio" o "demanda"' })
            };
        }

        // Obtener access token
        const tokenResponse = await fetch(`https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: process.env.CLIENT_ID,
                client_secret: process.env.CLIENT_SECRET,
                scope: 'https://graph.microsoft.com/.default',
                grant_type: 'client_credentials'
            })
        });

        if (!tokenResponse.ok) {
            throw new Error('Error obteniendo token de acceso');
        }

        const { access_token } = await tokenResponse.json();

        // Configurar cliente de Graph
        const client = Client.init({
            authProvider: (done) => {
                done(null, access_token);
            }
        });

        // Determinar carpeta y prefijo
        const folderName = tipo === 'citatorio' ? 'Citatorios' : 'Demandas';
        const prefix = tipo === 'citatorio' ? 'CIT' : 'DEM';
        const year = new Date().getFullYear();

        // Obtener lista de carpetas en la carpeta principal
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

                        // Extraer nombres de carpetas (folios)
                        const folios = foliosResponse.value
                            .filter(item => item.folder && item.name.startsWith(prefix))
                            .map(item => item.name);

                        allFolios = allFolios.concat(folios);
                    }
                }
            }
        } catch (error) {
            console.log('No hay folios previos o error al consultar:', error.message);
            // Si no hay carpetas, empezamos desde 0
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
