export default async function sitemapRoutes(app: any) {
  app.get('/sitemap.xml', async (req: any, reply: any) => {
    const baseUrl = 'https://yourcaptions.com';
    const today = new Date().toISOString().split('T')[0];

    const staticPages = [
      { url: '/',           priority: '1.0', changefreq: 'weekly' },
      { url: '/features',   priority: '0.9', changefreq: 'monthly' },
      { url: '/pricing',    priority: '0.9', changefreq: 'weekly' },
      { url: '/templates',  priority: '0.8', changefreq: 'weekly' },
      { url: '/about',      priority: '0.7', changefreq: 'monthly' },
      { url: '/hindi-caption-generator', priority: '0.8', changefreq: 'monthly' },
      { url: '/youtube-caption-generator', priority: '0.8', changefreq: 'monthly' },
      { url: '/instagram-reels-captions', priority: '0.8', changefreq: 'monthly' },
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
  ${staticPages.map(page => `
  <url>
    <loc>${baseUrl}${page.url}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
    <xhtml:link rel="alternate" hreflang="en" href="${baseUrl}${page.url}"/>
    <xhtml:link rel="alternate" hreflang="en-IN" href="https://yourcaptions.in${page.url}"/>
  </url>`).join('')}
</urlset>`;

    reply.header('Content-Type', 'application/xml');
    reply.send(xml);
  });

  app.get('/robots.txt', (req: any, reply: any) => {
    reply.type('text/plain').send(`
User-agent: *
Allow: /
Disallow: /dashboard
Disallow: /editor
Disallow: /settings
Disallow: /admin
Disallow: /api/

Sitemap: https://yourcaptions.com/sitemap.xml
Sitemap: https://yourcaptions.in/sitemap.xml
    `.trim());
  });
}
