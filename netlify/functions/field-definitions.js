const fetch = require("node-fetch");

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

    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
    }

    const body = JSON.parse(event.body);
    console.log("Payload received:", JSON.stringify(body, null, 2));

    if (body.challenge) {
        return { statusCode: 200, body: JSON.stringify({ challenge: body.challenge }) };
    }

    const boardId = body.payload?.inboundFieldValues?.boardId;
    if (!boardId) {
        console.error("No boardId found in payload");
        return { statusCode: 400, body: JSON.stringify({ error: "No boardId provided" }) };
    }

    try {
        // Get the subitem board ID from the parent board
        const parentBoardData = await callMondayAPI(`
            query {
                boards(ids: ${boardId}) {
                    columns { id type settings_str }
                }
            }
        `);

        const columns = parentBoardData?.data?.boards?.[0]?.columns || [];
        const subitemColumn = columns.find(col => col.type === "subtasks");

        if (!subitemColumn) {
            console.error("No subitem column found on board");
            return { statusCode: 200, body: JSON.stringify([]) };
        }

        const subitemBoardId = JSON.parse(subitemColumn.settings_str).boardIds?.[0];
        console.log("Subitem board ID:", subitemBoardId);

        if (!subitemBoardId) {
            console.error("No subitem board ID found in settings");
            return { statusCode: 200, body: JSON.stringify([]) };
        }

        // Query the subitem board for status columns
        const subitemData = await callMondayAPI(`
            query {
                boards(ids: ${subitemBoardId}) {
                    columns { id title type }
                }
            }
        `);

        const options = (subitemData?.data?.boards?.[0]?.columns || [])
            .filter(col => col.type === "color")
            .map(col => ({ value: col.id, title: col.title }));

        console.log("Returning options:", JSON.stringify(options, null, 2));
        return { statusCode: 200, body: JSON.stringify(options) };

    } catch (error) {
        console.error("Error fetching subitem columns:", error);
        return { statusCode: 500, body: JSON.stringify({ error: "Failed to fetch subitem columns" }) };
    }

};
