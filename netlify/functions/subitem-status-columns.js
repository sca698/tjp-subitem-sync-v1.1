const payload = body.payload || body;
const dep = payload.dependencyData || {};

const boardId = 
  dep.subitemsBoardId || 
  dep.boardId || 
  payload.subitemsBoardId || 
  payload.boardId || 
  payload.contextBoardId;

console.log('=== Remote Options Debug ===');
console.log('boardId received:', boardId);
console.log('dependencyData keys:', Object.keys(dep));
console.log('full payload keys:', Object.keys(payload));

if (!boardId) {
  return {
    statusCode: 400,
    body: JSON.stringify({ error: 'No boardId received - check dependency key' })
  };
}