import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const siteUrl = (env.VITE_SITE_URL || 'https://cv-creater.netlify.app').replace(/\/$/, '')

  return {
    plugins: [
      react(),
      {
        name: 'seo-index-and-files',
        transformIndexHtml(html) {
          return html.replaceAll('%SITE_URL%', siteUrl)
        },
        closeBundle() {
          const outDir = path.resolve(process.cwd(), 'dist')
          const robots = [
            'User-agent: *',
            'Allow: /',
            '',
            `Sitemap: ${siteUrl}/sitemap.xml`,
            '',
          ].join('\n')
          const sitemap = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
            '  <url>',
            `    <loc>${siteUrl}/</loc>`,
            '    <changefreq>weekly</changefreq>',
            '    <priority>1.0</priority>',
            '  </url>',
            '</urlset>',
            '',
          ].join('\n')
          if (fs.existsSync(outDir)) {
            fs.writeFileSync(path.join(outDir, 'robots.txt'), robots, 'utf8')
            fs.writeFileSync(path.join(outDir, 'sitemap.xml'), sitemap, 'utf8')
          }
        },
      },
    ],
  }
})
