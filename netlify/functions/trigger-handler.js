const { getStore } = require("@netlify/blobs");

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

    // Step 4: Log the full payload so we can see what Monday sends
    console.log("Trigger received:", JSON.stringify(body, null, 2));

    // Step 5: If this is a subscribe call, store the boardId
    const integrationId = body.payload?.integrationId || body.payload?.webhookId;
    const boardId = body.payload?.inputFields?.boardId || body.payload?.boardId;

    console.log("Integration ID:", integrationId);
    console.log("Board ID:", boardId);

    // Step 6: Store the mapping if we have both values
    if (integrationId && boardId) {
        try {
            const store = getStore({
                name: "integration-board-map",
                siteID: process.env.NETLIFY_SITE_ID,
                token: process.env.NETLIFY_TOKEN
            });
            await store.set(String(integrationId), String(boardId));
            console.log(`Stored mapping: integrationId ${integrationId} -> boardId ${boardId}`);
        } catch (error) {
            console.error("Error storing mapping:", error);
        }
    }

    // Step 7: Acknowledge receipt to Monday
    return {
        statusCode: 200,
        body: JSON.stringify({ message: "Trigger received successfully" })
    };

};