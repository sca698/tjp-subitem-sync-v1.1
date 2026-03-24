// netlify/functions/subitem-status-columns.js
const fetch = require('node-fetch'); // Make sure this is installed

exports.handler = async (event) => {
  // Only allow POST requests from monday.com
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const payload = body.payload || {};

    // Get the subitems boardId from dependencyData (recommended) or fallback to boardId
    const boardId = payload.dependencyData?.boardId || payload.boardId;

    if (!boardId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'boardId is required in dependencyData or payload' }),
      };
    }

    // Your monday.com API token (store this securely in Netlify environment variables!)
    const mondayToken = process.env.MONDAY_API_TOKEN;
    if (!mondayToken) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'MONDAY_API_TOKEN environment variable is missing' }),
      };
    }

    // GraphQL query to fetch columns on the board
    const query = `
      query {
        boards(ids: [${boardId}]) {
          columns {
            id
            title
            type
          }
        }
      }
    `;

    const response = await fetch('https://api.monday.com/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': mondayToken,
      },
      body: JSON.stringify({ query }),
    });

    const result = await response.json();

    if (result.errors) {
      console.error('GraphQL errors:', result.errors);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'GraphQL query failed', details: result.errors }),
      };
    }

    const columns = result.data?.boards?.[0]?.columns || [];

    // Filter ONLY status columns
    const statusColumns = columns
      .filter(col => col.type === 'status')
      .map(col => ({
        value: col.id,      // monday.com expects "value" for the column ID
        title: col.title,   // Human-readable name shown in the dropdown
      }));

    // Return in the exact format monday.com requires for List fields
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        options: statusColumns,
      }),
    };

  } catch (error) {
    console.error('Error in subitem-status-columns function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error', message: error.message }),
    };
  }
};