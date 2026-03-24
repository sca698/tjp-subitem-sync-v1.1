// netlify/functions/subitem-status-columns.js
const fetch = require('node-fetch');

exports.handler = async (event) => {
  console.log('=== REMOTE OPTIONS CALLED ===', JSON.stringify(event.body || event));

  try {
    const body = JSON.parse(event.body || '{}');
    const payload = body.payload || body;
    const dep = payload.dependencyData || {};

    // Get parent boardId from any place monday might send it
    let parentBoardId = dep.subitemsBoardId || dep.boardId || payload.boardId || payload.contextBoardId;

    console.log('Parent boardId received:', parentBoardId);

    if (!parentBoardId) {
      console.error('No parent boardId found');
      return { statusCode: 400, body: JSON.stringify({ error: 'boardId required' }) };
    }

    const token = process.env.MONDAY_API_TOKEN;
    if (!token) {
      console.error('MONDAY_API_TOKEN is missing');
      return { statusCode: 500, body: JSON.stringify({ error: 'Token missing' }) };
    }

    // Try to resolve the REAL subitems board ID
    let finalBoardId = parentBoardId; // fallback

    const subitemsQuery = `
      query {
        boards(ids: [${parentBoardId}]) {
          columns(types: [subtasks]) {
            settings_str
          }
        }
      }
    `;

    let res = await fetch('https://api.monday.com/v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': token },
      body: JSON.stringify({ query: subitemsQuery })
    });

    let data = await res.json();
    console.log('Subitems resolution query result:', JSON.stringify(data, null, 2));

    const subitemsColumn = data.data?.boards?.[0]?.columns?.[0];
    if (subitemsColumn && subitemsColumn.settings_str) {
      try {
        const settings = JSON.parse(subitemsColumn.settings_str);
        finalBoardId = settings.boardId || (settings.boardIds && settings.boardIds[0]);
        console.log('Resolved subitems boardId:', finalBoardId);
      } catch (e) {
        console.error('Failed to parse settings_str:', e);
      }
    } else {
      console.log('No subitems column found or no settings_str — using parent board as fallback');
    }

    // Now fetch columns from the final (subitems) board
    const columnsQuery = `
      query {
        boards(ids: [${finalBoardId}]) {
          columns {
            id
            title
            type
          }
        }
      }
    `;

    res = await fetch('https://api.monday.com/v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': token },
      body: JSON.stringify({ query: columnsQuery })
    });

    data = await res.json();
    console.log('Columns query result:', JSON.stringify(data, null, 2));

    const columns = data.data?.boards?.[0]?.columns || [];
    const statusColumns = columns
      .filter(col => col.type === 'status')
      .map(col => ({ value: col.id, title: col.title }));

    console.log(`Returning ${statusColumns.length} subitem status columns`);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ options: statusColumns })
    };

  } catch (err) {
    console.error('CRITICAL ERROR:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};