// netlify/functions/action-handler.js

import axios from "axios";

const MONDAY_API_URL = "https://api.monday.com/v2";
const API_KEY = process.env.MONDAY_API_KEY;

export const handler = async (event, context) => {
  try {
    const body = JSON.parse(event.body);
    const { itemId, boardId, parentColumn, subitemColumn } =
      body.payload.inputFields;

    // 1. Fetch parent item to get the new status value
    const parentQuery = `
      query {
        items(ids: ${itemId}) {
          column_values(ids: "${parentColumn}") {
            id
            text
            value
          }
          subitems {
            id
          }
        }
      }
    `;

    const parentRes = await axios.post(
      MONDAY_API_URL,
      { query: parentQuery },
      { headers: { Authorization: API_KEY } }
    );

    const parentData = parentRes.data.data.items[0];
    const newStatusValue = parentData.column_values[0].value;
    const subitems = parentData.subitems;

    // 2. Update each subitem
    for (const sub of subitems) {
      const mutation = `
        mutation {
          change_simple_column_value(
            item_id: ${sub.id},
            column_id: "${subitemColumn}",
            value: ${JSON.stringify(newStatusValue)}
          ) {
            id
          }
        }
      `;

      await axios.post(
        MONDAY_API_URL,
        { query: mutation },
        { headers: { Authorization: API_KEY } }
      );
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true })
    };

  } catch (err) {
    console.error("Action handler error:", err);

    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
