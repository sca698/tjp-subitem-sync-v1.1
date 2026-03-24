// netlify/functions/subitem-status-columns.js
const fetch = require('node-fetch');

exports.handler = async (event) => {
  console.log('=== REMOTE OPTIONS ENDPOINT CALLED ===', JSON.stringify(event.body || event));

  try {
    const body = JSON.parse(event.body || '{}');
    const payload = body.payload || body;
    const dep = payload.dependencyData || {};

    // Get parent boardId from anywhere monday might send it
    let parentBoardId = dep.subitemsBoardId || dep.boardId || payload.boardId || payload.contextBoardId;

    if (!parentBoardId) {
      console.error('No parent boardId received');
      return { statusCode: 400, body: JSON.stringify({ error: 'boardId required' }) };
    }

    console.log('Parent boardId:', parentBoardId);

    const mondayToken = process.env.MONDAY_API_TOKEN;

    // Step 1: Find the REAL subitems board ID
    const subitemsQuery = `
      query {
        boards(ids: [${parentBoardId}]) {
          columns(ids: ["subitems", "subitems0", "subitems1", "subitems2"]) {  // try common IDs
            id
            settings_str
          }
        }
      }
    `;

    let response = await fetch('https://api.monday.com/v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': mondayToken },
      body: JSON.stringify({ query: subitemsQuery })
    });

    let result = await response.json();
    let subitemsColumn = result.data?.boards?.[0]?.columns?.find(c => c.settings_str);

    let subitemsBoardId = null;
    if (subitemsColumn && subitemsColumn.settings_str) {
      const settings = JSON.parse(subitemsColumn.settings_str);
      subitemsBoardId = settings.boardIds ? settings.boardIds[0] : settings.boardId;
    }

    const finalBoardId = subitemsBoardId || parentBoardId;  // fallback to parent if no subitems board found
    console.log('Using subitems boardId:', finalBoardId);

    // Step 2: Get ONLY status columns from the subitems board
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

    response = await fetch('https://api.monday.com/v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': mondayToken },
      body: JSON.stringify({ query: columnsQuery })
    });

    result = await response.json();
    const columns = result.data?.boards?.[0]?.columns || [];

    const statusColumns = columns
      .filter(col => col.type === 'status')
      .map(col => ({ value: col.id, title: col.title }));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ options: statusColumns })
    };

  } catch (error) {
    console.error('Remote options error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};