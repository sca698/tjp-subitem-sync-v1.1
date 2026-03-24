// netlify/functions/trigger-parent-status-change.js
const fetch = require('node-fetch');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const payload = body.payload || body;   // monday sometimes wraps differently

    // === 1. SUBSCRIBE (monday calls this when user adds the recipe) ===
    if (payload.webhookUrl) {
      console.log('Subscribe received - webhookUrl:', payload.webhookUrl);
      console.log('Input fields from recipe:', payload.inputFields || payload.inboundFieldValues);

      // You can store the webhookUrl + subscriptionId in a DB if needed for unsubscribe logic
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true })
      };
    }

    // === 2. UNSUBSCRIBE (optional - monday calls this when recipe is removed) ===
    if (payload.unsubscribe || payload.subscriptionId && !payload.webhookUrl) {
      console.log('Unsubscribe received for subscriptionId:', payload.subscriptionId);
      // Add cleanup logic here if you stored anything
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true })
      };
    }

    // === 3. ACTUAL TRIGGER FIRE (you POST here from your monday webhook listener) ===
    // Expect these values from your monday "column changed" webhook event
    const {
      boardId,      // from monday event or context
      itemId,
      columnId,     // the parent status column that changed
      newValue      // the new status value (object or string)
    } = payload;

    if (!boardId || !itemId || !columnId || !newValue) {
      console.error('Missing required fields for trigger fire:', { boardId, itemId, columnId });
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing boardId, itemId, columnId or newValue' })
      };
    }

    // Build the payload that monday expects - this passes data to your Action
    const triggerPayload = {
      trigger: {
        outputFields: {
          boardId: String(boardId),           // ← This is what you already have as output field
          itemId: String(itemId),
          columnId: String(columnId),
          newValue: typeof newValue === 'string' 
            ? newValue 
            : JSON.stringify(newValue)        // must be sent as string
        }
      }
    };

    console.log('Firing trigger with outputFields:', triggerPayload.trigger.outputFields);

    // Call the webhookUrl that monday provided during subscribe
    const webhookUrl = payload.webhookUrl || body.webhookUrl;

    if (!webhookUrl) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'webhookUrl is missing' })
      };
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Authorization header is usually not needed here - monday handles it via the URL
      },
      body: JSON.stringify(triggerPayload)
    });

    const responseText = await response.text();
    console.log('Webhook response status:', response.status, responseText);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: true, 
        webhookStatus: response.status 
      })
    };

  } catch (error) {
    console.error('Trigger endpoint error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error', 
        message: error.message 
      })
    };
  }
};