const fetch = require("node-fetch");

const MONDAY_API_URL = "https://api.monday.com/v2";
const MONDAY_API_TOKEN = process.env.MONDAY_API_TOKEN;

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

    // Step 3: Handle Monday's challenge request
    if (body.challenge) {
        return {
            statusCode: 200,
            body: JSON.stringify({ challenge: body.challenge })
        };
    }

    // Step 4: Extract the board ID from the payload
    const boardId = body.data?.boardId;

    if (!boardId) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: "No board ID provided" })
        };
    }

    try {
        // Step 5: Query Monday for the subitem board ID
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

        const response = await fetch(MONDAY_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": MONDAY_API_TOKEN
            },
            body: JSON.stringify({ query: subitemBoardQuery })
        });

        const data = await response.json();
        console.log("Board query response:", JSON.stringify(data, null, 2));

        // Step 6: Find the subitem board ID from settings_str
        const columns = data?.data?.boards?.[0]?.columns || [];
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

        const subitemResponse = await fetch(MONDAY_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": MONDAY_API_TOKEN
            },
            body: JSON.stringify({ query: subitemColumnsQuery })
        });

        const subitemData = await subitemResponse.json();
        console.log("Subitem board query response:", JSON.stringify(subitemData, null, 2));

        const subitemColumns = subitemData?.data?.boards?.[0]?.columns || [];

        // Step 8: Filter to status columns only
        const statusColumns = subitemColumns.filter(col => col.type === "color");

        // Step 9: Format the response for Monday's recipe builder
        const options = statusColumns.map(col => ({
            value: col.id,
            title: col.title
        }));

        console.log("Returning status columns:", JSON.stringify(options, null, 2));

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