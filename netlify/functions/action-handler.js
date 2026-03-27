const fetch = require("node-fetch");

// Monday API configuration
const MONDAY_API_URL = "https://api.monday.com/v2";
const MONDAY_API_TOKEN = process.env.MONDAY_API_TOKEN;

// Helper function to call Monday's GraphQL API
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

    // Step 3: Handle Monday's challenge request
    if (body.challenge) {
        return {
            statusCode: 200,
            body: JSON.stringify({ challenge: body.challenge })
        };
    }

    // Step 4: Extract the payload values we need
        const itemId = body.payload?.inputFields?.itemId;
        const boardId = body.payload?.inputFields?.boardId;
        const newStatusIndex = body.payload?.inputFields?.statusColumnValue?.index;
        const subitemColumnId = body.payload?.inputFields?.subitemColumnId;

    console.log("Action received:", JSON.stringify(body, null, 2));

    // Step 5: Validate we have everything we need
    if (!itemId || !boardId || newStatusIndex === undefined || !subitemColumnId) {
        console.error("Missing required fields:", { itemId, boardId, newStatusIndex, subitemColumnId });
        return {
            statusCode: 400,
            body: JSON.stringify({ error: "Missing required fields" })
        };
    }

    try {
        // Step 6: Query Monday for all subitems of the parent item
        const subitemsQuery = `
            query {
                items(ids: ${itemId}) {
                    subitems {
                        id
                        name
                        board {
                            id
                        }
                    }
                }
            }
        `;

        const subitemsData = await callMondayAPI(subitemsQuery);
        const subitems = subitemsData?.data?.items?.[0]?.subitems || [];

        console.log(`Found ${subitems.length} subitems for item ${itemId}`);

        // Step 7: If no subitems found, exit gracefully
        if (subitems.length === 0) {
            return {
                statusCode: 200,
                body: JSON.stringify({ message: "No subitems found" })
            };
        }

        // Step 8: Update each subitem's status column
        for (const subitem of subitems) {
            const columnValue = JSON.stringify(
                JSON.stringify({ index: newStatusIndex })
            );

            const updateMutation = `
                mutation {
                    change_column_value(
                        item_id: ${subitem.id},
                        board_id: ${subitem.board.id},
                        column_id: "${subitemColumnId}",
                        value: ${columnValue}
                    ) {
                        id
                    }
                }
            `;

            const updateResult = await callMondayAPI(updateMutation);
            console.log(`Updated subitem ${subitem.id}:`, JSON.stringify(updateResult));
        }

        // Step 9: Return success
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: `Successfully updated ${subitems.length} subitems`
            })
        };

    } catch (error) {
        console.error("Error in action handler:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Failed to update subitems" })
        };
    }

};