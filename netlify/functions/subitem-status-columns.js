// netlify/functions/subitem-status-columns.js
const fetch = require('node-fetch');

exports.handler = async (event) => {
  console.log('=== REMOTE OPTIONS CALLED ===', JSON.stringify(event.body || event));

  try {
    const body = JSON.parse(event.body || '{}');
    const payload = body.payload || body;

    // Try to get any boardId monday provides (usually the parent board)
    let boardId = payload.boardId || payload.contextBoardId || 
                  (payload.dependencyData && payload.dependencyData.boardId);

    // Fallback to your known parent board ID
    if (!boardId) {
      boardId = "18404010318";
      console.log('No boardId from monday — using fallback parent board:', boardId);
    } else {
      console.log('Parent boardId received:', boardId);
    }

    const token = process.env.MONDAY_API_TOKEN;
    if (!token) {
      console.error('MONDAY_API_TOKEN missing');
      return { statusCode: 500, body: JSON.stringify({ error: 'Token missing' }) };
    }

    // === Resolve the REAL subitems board ID ===
    let finalBoardId = boardId;

    const subitemsQuery = `
      query {
        boards(ids: [${boardId}]) {
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
    console.log('Subitems resolution result:', JSON.stringify(data));

    const subitemsColumn = data.data?.boards?.[0]?.columns?.[0];
    if (subitemsColumn && subitemsColumn.settings_str) {
      try {
        const settings = JSON.parse(subitemsColumn.settings_str);
        finalBoardId = settings.boardId || (settings.boardIds && settings.boardIds[0]);
        console.log('✅ Resolved real subitems boardId:', finalBoardId);
      } catch (e) {
        console.error('Failed to parse settings_str');
      }
    } else {
      console.log('⚠️ Could not resolve subitems board — falling back to parent board');
    }

    // === Fetch ONLY status columns from the subitems board ===
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
    console.log('Columns query result:', JSON.stringify(data));

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
    console.error('CRITICAL ERROR:', err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};