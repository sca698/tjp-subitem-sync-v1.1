import axios from "axios";

export const handler = async (event, context) => {
  try {
    const body = JSON.parse(event.body);
    const { itemId, boardId, columnId } = body.payload;

    // 1. Fetch subitems for this parent item
    const query = `
      query ($itemId: [ID!]) {
        items (ids: $itemId) {
          subitems {
            id
          }
        }
      }
    `;

    const variables = { itemId };

    const response = await axios.post(
      "https://api.monday.com/v2",
      { query, variables },
      {
        headers: {
          Authorization: process.env.MONDAY_API_KEY,
          "Content-Type": "application/json"
        }
      }
    );

    const subitems = response.data.data.items[0].subitems || [];

    // 2. Extract subitem IDs
    const subitemids = subitems.map(s => s.id);

    // 3. Return trigger output fields
    return {
      statusCode: 200,
      body: JSON.stringify({
        itemId,
        boardId,
        columnId,
        subitemids   // <-- This is the new field Monday needs
      })
    };

  } catch (error) {
    console.error("Trigger handler error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Trigger handler failed" })
    };
  }
};
