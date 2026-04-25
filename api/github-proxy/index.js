const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

module.exports = async (req, res) => {
  const url = new URL(req.url, `https://${req.headers.host}`);
  const path = url.searchParams.get('path') || '/';
  
  if (req.method === 'GET') {
    try {
      const r = await fetch(`https://api.github.com${path}`, {
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github+json',
          'User-Agent': 'CloverTools-Proxy'
        }
      });
      const data = await r.json();
      res.status(r.status).json(data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
    return;
  }
  
  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const r = await fetch(`https://api.github.com${path}`, {
        method: 'POST',
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'User-Agent': 'CloverTools-Proxy'
        },
        body: JSON.stringify(body)
      });
      const data = await r.json();
      res.status(r.status).json(data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
    return;
  }
  
  res.status(405).json({ error: 'Method not allowed' });
};
