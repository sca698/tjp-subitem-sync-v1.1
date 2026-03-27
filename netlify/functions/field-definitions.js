const fetch = require("node-fetch");

const MONDAY_API_URL = "https://api.monday.com/v2";
const MONDAY_API_TOKEN = process.env.MONDAY_API_TOKEN;

function decodeJWT(token) {
    try {
        const base64Payload = token.split('.')[1];
        const payload = Buffer.from(base64Payload, 'base64').toString('utf8');
        return JSON.parse(payload);
    } catch (error) {
        console.error("Failed to decode JWT:", error);
        return null;
    }
}

async function callMondayAPI(query, token) {
    const response = await fetch(MONDAY_API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": token
        },
        body: JSON.stringify({ query })
    });
    return response.json();
}

exports.handler = async (event) => {

    // Step 1: Only allow POST requests
    if (event.httpMethod !== "POST") {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: "Method not allowed" })
        };
    }

    // Step 2: Parse the incoming request body
    const body = JSON.parse(event.body);
    console.log("Payload received:", JSON.stringify(body, null, 2));

    // Step 3: Handle Monday's challenge request
    if (body.challenge) {
        return {
            statusCode: 200,
            body: JSON.stringify({ challenge: body.challenge })
        };
    }

    // Step 4: Extract the short lived token from the JWT
    const authHeader = event.headers.authorization;
    const jwtPayload = decodeJWT(authHeader);
    const shortLivedToken = jwtPayload?.shortLivedToken;

    if (!shortLivedToken) {
        console.error("No short lived token found");
        return {
            statusCode: 401,
            body: JSON.stringify({ error: "No short lived token" })
        };
    }

    // Step 5: Extract the integrationId from the payload
    const integrationId = body.payload?.integrationId;
    console.log("Integration ID:", integrationId);

    try {
        // Step 6: Query Monday for boards that have subitems
        // We query all non-subitem boards and find the one with our integration
        const boardsQuery = `
            query {
                boards(limit: 100) {
                    id
                    name
                    type
                }
            }
        `;

       const boardsData = await callMondayAPI(boardsQuery, MONDAY_API_TOKEN);
        console.log("Boards response:", JSON.stringify(boardsData, null, 2));

        const boards = boardsData?.data?.boards || [];
        console.log(`Found ${boards.length} boards`);

        // Step 7: For each board find the one with our integrationId
        // We do this by checking each board's integrations
        let targetBoardId = null;

        for (const board of boards) {
            const integrationsQuery = `
                query {
                    boards(ids: ${board.id}) {
                        integrations {
                            id
                        }
                    }
                }
            `;

            const intData = await callMondayAPI(integrationsQuery, MONDAY_API_TOKEN);
            const integrations = intData?.data?.boards?.[0]?.integrations || [];
            const match = integrations.find(i => String(i.id) === String(integrationId));

            if (match) {
                targetBoardId = board.id;
                console.log(`Found matching board: ${board.id}`);
                break;
            }
        }

        if (!targetBoardId) {
            console.error("Could not find board for integration");
            return {
                statusCode: 200,
                body: JSON.stringify([])
            };
        }

        // Step 8: Get the subitem board ID from the target board
        const subitemBoardQuery = `
            query {
                boards(ids: ${targetBoardId}) {
                    columns {
                        id
                        type
                        settings_str
                    }
                }
            }
        `;

        const subitemBoardData = await callMondayAPI(subitemBoardQuery, MONDAY_API_TOKEN);
        const columns = subitemBoardData?.data?.boards?.[0]?.columns || [];
        const subitemColumn = columns.find(col => col.type === "subtasks");

        if (!subitemColumn) {
            console.error("No subitem column found");
            return {
                statusCode: 200,
                body: JSON.stringify([])
            };
        }

        const settings = JSON.parse(subitemColumn.settings_str);
        const subitemBoardId = settings.boardIds?.[0];

        if (!subitemBoardId) {
            console.error("No subitem board ID found");
            return {
                statusCode: 200,
                body: JSON.stringify([])
            };
        }

        // Step 9: Query the subitem board for status columns
        const subitemColumnsQuery = `
            query {
                boards(ids: ${subitemBoardId}) {
                    columns {
                        id
                        title
                        type
                    }
                }
            }
        `;

        const subitemData = await callMondayAPI(subitemColumnsQuery, MONDAY_API_TOKEN);
        const subitemColumns = subitemData?.data?.boards?.[0]?.columns || [];
        const statusColumns = subitemColumns.filter(col => col.type === "color");

        const options = statusColumns.map(col => ({
            value: col.id,
            title: col.title
        }));

        console.log("Returning options:", JSON.stringify(options, null, 2));

        return {
            statusCode: 200,
            body: JSON.stringify(options)
        };

    } catch (error) {
        console.error("Error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Failed to fetch subitem columns" })
        };
    }
};