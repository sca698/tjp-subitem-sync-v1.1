// netlify/functions/trigger-handler.js

import axios from "axios";

export const handler = async (event, context) => {
  try {
    const body = JSON.parse(event.body);

    // Monday sends a "challenge" during subscription
    if (body.type === "url_verification") {
      return {
        statusCode: 200,
        body: JSON.stringify({ challenge: body.challenge })
      };
    }

    // Subscription event
    if (body.type === "subscribe") {
      return {
        statusCode: 200,
        body: JSON.stringify({
          webhookUrl: `${process.env.URL}/.netlify/functions/trigger-handler`
        })
      };
    }

    // Unsubscribe event
    if (body.type === "unsubscribe") {
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true })
      };
    }

    // Webhook event: a column changed
    if (body.event) {
      const { boardId, itemId, columnId } = body.event;
      const { parentColumn } = body.payload.inputFields;

      // Only emit the trigger if the selected parent column changed
      if (columnId === parentColumn) {
        await axios.post(body.payload.url, {
          itemId,
          boardId,
          parentColumn
        });
      }

      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true })
    };

  } catch (err) {
    console.error("Trigger handler error:", err);

    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
