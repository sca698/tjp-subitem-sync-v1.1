// /api/trigger-handler.js

export const config = {
  runtime: "nodejs20.x"
};

import axios from "axios";

export default async function handler(req, res) {
  try {
    const body = req.body;

    // Monday sends a "challenge" during subscription
    if (body.type === "url_verification") {
      return res.status(200).json({ challenge: body.challenge });
    }

    // Subscription event
    if (body.type === "subscribe") {
      return res.status(200).json({
        webhookUrl: "https://tjp-subitem-sync.vercel.app/api/trigger-handler"
      });
    }

    // Unsubscribe event
    if (body.type === "unsubscribe") {
      return res.status(200).json({ ok: true });
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

      return res.status(200).json({ ok: true });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Trigger handler error:", err);
    return res.status(500).json({ error: err.message });
  }
}
