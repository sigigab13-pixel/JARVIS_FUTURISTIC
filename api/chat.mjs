export default async function handler(req, res) {
  try {
    const { handleApi } = await import('../server/server.mjs');
    const url = new URL(req.url || '/api/chat', `https://${req.headers.host || 'localhost'}`);
    await handleApi(req, res, url.pathname, url);
  } catch (error) {
    console.error('JARVIS chat API module/handler error:', error?.stack || error);
    if (!res.headersSent) {
      res.statusCode = Number(error?.statusCode) || 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({
        error: error instanceof Error ? error.message : 'JARVIS chat request failed.',
      }));
    }
  }
}
