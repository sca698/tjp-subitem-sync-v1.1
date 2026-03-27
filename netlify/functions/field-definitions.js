const fetch = require("node-fetch");
const { getStore } = require("@netlify/blobs");

const MONDAY_API_URL = "https://api.monday.com/v2";
const MONDAY_API_TOKEN = process.env.MONDAY_API_TOKEN;

async function callMondayAPI(query) {
    const response = await fetch(MONDAY_API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": MONDAY_API_TOKEN
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

    // Step 4: Extract the integrationId from the payload
    const integrationId = body.payload?.integrationId;
    console.log("Integration ID:", integrationId);

    if (!integrationId) {
        console.error("No integrationId found in payload");
        return {
            statusCode: 400,
            body: JSON.stringify({ error: "No integrationId provided" })
        };
    }

    // Step 5: Look up the boardId from Netlify Blobs
    let boardId = null;
    try {
        const store = getStore("integration-board-map");
        boardId = await store.get(String(integrationId));
        console.log(`Retrieved boardId: ${boardId} for integrationId: ${integrationId}`);
    } catch (error) {
        console.error("Error retrieving boardId from store:", error);
    }

    if (!boardId) {
        console.error("No boardId found for integrationId:", integrationId);
        return {
            statusCode: 200,
            body: JSON.stringify([])
        };
    }

    try {
        // Step 6: Get the subitem board ID from the parent board
        const subitemBoardQuery = `
            query {
                boards(ids: ${boardId}) {
                    columns {
                        id
                        type
                        settings_str
                    }
                }
            }
        `;

        const subitemBoardData = await callMondayAPI(subitemBoardQuery);
        const columns = subitemBoardData?.data?.boards?.[0]?.columns || [];
        console.log("Columns found:", columns.length);

        const subitemColumn = columns.find(col => col.type === "subtasks");

        if (!subitemColumn) {
            console.error("No subitem column found on board");
            return {
                statusCode: 200,
                body: JSON.stringify([])
            };
        }

        const settings = JSON.parse(subitemColumn.settings_str);
        const subitemBoardId = settings.boardIds?.[0];
        console.log("Subitem board ID:", subitemBoardId);

        if (!subitemBoardId) {
            console.error("No subitem board ID found in settings");
            return {
                statusCode: 200,
                body: JSON.stringify([])
            };
        }

        // Step 7: Query the subitem board for status columns
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

        const subitemData = await callMondayAPI(subitemColumnsQuery);
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
        console.error("Error fetching subitem columns:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Failed to fetch subitem columns" })
        };
    }

};