// netlify/functions/action-update-subitem-status.js
const fetch = require('node-fetch');

const MONDAY_API_TOKEN = process.env.MONDAY_API_TOKEN;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const inputFields = body.payload?.inputFields || body.inputFields || {};

    const {
      boardId,           // parent board
      itemId,            // the parent item that changed
      columnId,          // parent status column (for reference)
      newValue,          // the new status value (as stringified JSON)
      subitemStatusColumn   // your custom field → the chosen subitem status column ID
    } = inputFields;

    if (!boardId || !itemId || !subitemStatusColumn || !newValue) {
      return { statusCode: 400, body: 'Missing required input fields' };
    }

    // Parse the new status value (it comes as string from trigger)
    let columnValue;
    try {
      columnValue = JSON.parse(newValue);
    } catch (e) {
      columnValue = { label: newValue };   // fallback if it's just a label
    }

    // 1. Get the subitems of this parent item
    const query = `
      query {
        items(ids: [${itemId}]) {
          subitems {
            id
            board { id }
          }
        }
      }
    `;

    let response = await fetch('https://api.monday.com/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': MONDAY_API_TOKEN
      },
      body: JSON.stringify({ query })
    });

    const result = await response.json();
    const subitems = result.data?.items?.[0]?.subitems || [];

    if (subitems.length === 0) {
      return { statusCode: 200, body: JSON.stringify({ message: 'No subitems found' }) };
    }

    // 2. Update each subitem's chosen status column
    const mutations = subitems.map(sub => `
      change_column_value(
        board_id: ${sub.board.id || boardId},
        item_id: ${sub.id},
        column_id: "${subitemStatusColumn}",
        value: ${JSON.stringify(JSON.stringify(columnValue))}
      ) {
        id
      }
    `).join('\n');

    const mutation = `mutation { ${mutations} }`;

    response = await fetch('https://api.monday.com/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': MONDAY_API_TOKEN
      },
      body: JSON.stringify({ query: mutation })
    });

    const mutationResult = await response.json();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        updatedSubitems: subitems.length,
        result: mutationResult
      })
    };

  } catch (error) {
    console.error('Action error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};