/**
 * GitHub API Proxy for Vercel
 * Deploy: vercel --prod
 * Then: git config url."https://[app].vercel.app/".insteadOf https://github.com/
 * Or use directly: GET /api?q=/repos/owner/repo/actions/runs
 */
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';

module.exports = async (req, res) => {
  const url = new URL(req.url, 'https://placeholder');
  
  // GET /api?path=/repos/owner/repo/actions/runs
  const path = url.searchParams.get('path') || '/';
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  const targetUrl = `https://api.github.com/${cleanPath}`;

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'CloverTools-Proxy/1.0',
        'X-GitHub-Api-Version': '2022-11-28',
      }
    });
    
    const data = await response.json();
    
    // Set CORS headers to allow browser access
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    
    if (req.method === 'OPTIONS') {
      return res.status(204).send('');
    }
    
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
