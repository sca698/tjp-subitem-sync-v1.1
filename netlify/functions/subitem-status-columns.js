// netlify/functions/subitem-status-columns.js
const fetch = require('node-fetch');

exports.handler = async (event) => {
  console.log('=== REMOTE OPTIONS CALLED ===', JSON.stringify(event.body || event));

  try {
    const body = JSON.parse(event.body || '{}');
    const payload = body.payload || body;

    // Try to get any boardId monday provides (context or dependency)
    let boardId = payload.boardId || payload.contextBoardId || 
                  (payload.dependencyData && payload.dependencyData.boardId);

    // Fallback to your known parent board ID (the one you used when it worked before)
    if (!boardId) {
      boardId = "18404010318";   // ← CHANGE THIS to your actual parent board ID
      console.log('No boardId from monday — using fallback parent board:', boardId);
    } else {
      console.log('Using boardId from monday:', boardId);
    }

    const token = process.env.MONDAY_API_TOKEN;
    if (!token) {
      console.error('MONDAY_API_TOKEN missing');
      return { statusCode: 500, body: JSON.stringify({ error: 'Token missing' }) };
    }

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

    const res = await fetch('https://api.monday.com/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token,
      },
      body: JSON.stringify({ query }),
    });

    const data = await res.json();
    console.log('GraphQL result:', JSON.stringify(data));

    const columns = data.data?.boards?.[0]?.columns || [];
    const statusColumns = columns
      .filter(col => col.type === 'status')
      .map(col => ({ value: col.id, title: col.title }));

    console.log(`Returning ${statusColumns.length} status columns`);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ options: statusColumns })
    };

  } catch (err) {
    console.error('ERROR in endpoint:', err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};