// netlify/functions/subitem-status-columns.js
const fetch = require('node-fetch');

exports.handler = async (event) => {
  console.log('=== REMOTE OPTIONS CALLED ===', JSON.stringify(event.body || event));

  try {
    const boardId = "18404010318";   // ← Your parent board ID (change only if needed)

    console.log('Using fixed parent boardId:', boardId);

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
    console.error('ERROR:', err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};