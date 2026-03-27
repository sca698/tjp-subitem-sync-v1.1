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

    // Step 4: Handle a real event (Calc Meth column changed)
    console.log("Trigger received:", JSON.stringify(body, null, 2));

    // Step 5: Acknowledge receipt to Monday
    return {
        statusCode: 200,
        body: JSON.stringify({ message: "Trigger received successfully" })
    };

};