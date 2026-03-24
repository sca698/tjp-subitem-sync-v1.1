exports.handler = async (event) => {
  console.log('=== REMOTE OPTIONS ENDPOINT CALLED ===', JSON.stringify(event.body || event));

  try {
    const body = JSON.parse(event.body || '{}');
    const payload = body.payload || body;

    // HARD-CODED BOARD ID FOR TESTING — replace with a real board ID that has subitems + status columns
    const boardId = "18404010318";   // ← CHANGE THIS LINE

    console.log('Using hard-coded boardId:', boardId);

    if (!boardId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No boardId provided' })
      };
    }

    // Rest of your existing code (GraphQL query, filter status columns, return options)
    const mondayToken = process.env.MONDAY_API_TOKEN;
    if (!mondayToken) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'MONDAY_API_TOKEN missing' })
      };
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
        body: JSON.stringify({ error: 'GraphQL failed', details: result.errors })
      };
    }

    const columns = result.data?.boards?.[0]?.columns || [];

    const statusColumns = columns
      .filter(col => col.type === 'status')
      .map(col => ({
        value: col.id,
        title: col.title,
      }));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        options: statusColumns,
      }),
    };

  } catch (error) {
    console.error('Error in subitem-status-columns:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};