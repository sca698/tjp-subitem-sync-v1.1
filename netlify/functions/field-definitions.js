const fetch = require("node-fetch");

// Monday API configuration
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

    // Step 5: Query Monday for all subitem columns on this board
    const query = `
        query {
            boards(ids: ${boardId}) {
                columns {
                    id
                    title
                    type
                    settings_str
                }
            }
        }
    `;

    try {
        const response = await fetch(MONDAY_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": MONDAY_API_TOKEN
            },
            body: JSON.stringify({ query })
        });

        const data = await response.json();
        const columns = data?.data?.boards?.[0]?.columns || [];

        // Step 6: Filter to status columns only
        const statusColumns = columns.filter(col => col.type === "color");

        // Step 7: Format the response for Monday's recipe builder
        const options = statusColumns.map(col => ({
            value: col.id,
            title: col.title
        }));

        return {
            statusCode: 200,
            body: JSON.stringify(options)
        };

    } catch (error) {
        console.error("Error fetching columns:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Failed to fetch columns" })
        };
    }

};