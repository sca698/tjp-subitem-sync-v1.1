// netlify/functions/trigger-parent-status-change.js
const fetch = require('node-fetch');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const payload = body.payload || body;   // monday sometimes wraps it

    // This is called by monday when the recipe is added/edited (subscribe)
    if (payload.webhookUrl) {
      // Store the webhookUrl + subscriptionId somewhere (e.g. database) 
      // so your real webhook listener can POST to it later.
      console.log('Subscribe received:', payload.webhookUrl);

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true })
      };
    }

    // === REAL TRIGGER FIRED (you POST here from your monday webhook handler) ===
    const { boardId, itemId, columnId, newValue } = payload;   // values you send when status changes

    if (!boardId || !itemId || !columnId || !newValue) {
      return { statusCode: 400, body: 'Missing required fields' };
    }

    // Send the outputFields to monday.com so they flow to the Action
    const triggerPayload = {
      trigger: {
        outputFields: {
          boardId: String(boardId),
          itemId: String(itemId),
          columnId: String(columnId),
          newValue: typeof newValue === 'string' ? newValue : JSON.stringify(newValue)   // must be string
        }
      }
    };

    // Call the monday-provided webhookUrl that was stored earlier
    // In practice you will POST this from wherever you listen to monday's column change webhook
    const response = await fetch(payload.webhookUrl || body.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(triggerPayload)
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, status: response.status })
    };

  } catch (error) {
    console.error('Trigger error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};