/**
 * Rebuild Sitemap Script
 * 
 * This script regenerates the sitemap.xml file by fetching the latest blog posts
 * from the API. Can be run standalone or triggered via the API endpoint.
 * 
 * Usage:
 *   node scripts/rebuild-sitemap.mjs
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

// Import the existing sitemap generation logic
// (This is similar to generate-sitemap.mjs but can be called on-demand)

const MERGED_BLOG_SLUGS = new Set([
  'how-to-set-up-gohighlevel-saas-mode',
  '5-gohighlevel-automation-workflows-every-agency-needs',
])

const LASTMOD = new Date().toISOString().slice(0, 10)

function toDateOnly(value) {
  if (!value) return LASTMOD
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? LASTMOD : d.toISOString().slice(0, 10)
}

async function readApiBase() {
  let base = ''
  try {
    const envPath = path.join(root, '.env')
    const raw = await fs.readFile(envPath, 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const idx = trimmed.indexOf('=')
      if (idx === -1) continue
      const key = trimmed.slice(0, idx).trim()
      let value = trimmed.slice(idx + 1).trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      if (key === 'VITE_API_URL') base = value
    }
  } catch {
    // .env not present – fall through to process.env
  }
  if (!base) base = process.env.VITE_API_URL || ''
  return base || 'https://api.ghlprime.com'
}

async function rebuildSitemap() {
  const routes = [
    { loc: 'https://ghlprime.com/', changefreq: 'weekly', priority: '1.0' },
    { loc: 'https://ghlprime.com/services', changefreq: 'monthly', priority: '0.9' },
    { loc: 'https://ghlprime.com/services/vibe-coding', changefreq: 'monthly', priority: '0.8' },
    { loc: 'https://ghlprime.com/services/ai-agent-builder', changefreq: 'monthly', priority: '0.8' },
    { loc: 'https://ghlprime.com/services/custom-saas-development', changefreq: 'monthly', priority: '0.8' },
    { loc: 'https://ghlprime.com/services/figma-to-code', changefreq: 'monthly', priority: '0.8' },
    { loc: 'https://ghlprime.com/services/saas-customer-support', changefreq: 'monthly', priority: '0.8' },
    { loc: 'https://ghlprime.com/services/ghl-setup', changefreq: 'monthly', priority: '0.8' },
    { loc: 'https://ghlprime.com/services/automation', changefreq: 'monthly', priority: '0.8' },
    { loc: 'https://ghlprime.com/services/saas-crm', changefreq: 'monthly', priority: '0.8' },
    { loc: 'https://ghlprime.com/services/white-label-support', changefreq: 'monthly', priority: '0.8' },
    { loc: 'https://ghlprime.com/services/app-development', changefreq: 'monthly', priority: '0.8' },
    { loc: 'https://ghlprime.com/case-studies', changefreq: 'weekly', priority: '0.9' },
    { loc: 'https://ghlprime.com/blog', changefreq: 'weekly', priority: '0.8' },
    { loc: 'https://ghlprime.com/gallery', changefreq: 'monthly', priority: '0.7' },
    { loc: 'https://ghlprime.com/faq', changefreq: 'monthly', priority: '0.8' },
    { loc: 'https://ghlprime.com/about', changefreq: 'monthly', priority: '0.8' },
    { loc: 'https://ghlprime.com/team', changefreq: 'monthly', priority: '0.7' },
    { loc: 'https://ghlprime.com/contact', changefreq: 'monthly', priority: '0.7' },
    { loc: 'https://ghlprime.com/booking', changefreq: 'monthly', priority: '0.8' },
    { loc: 'https://ghlprime.com/privacy-policy', changefreq: 'yearly', priority: '0.3' },
    { loc: 'https://ghlprime.com/terms', changefreq: 'yearly', priority: '0.3' },
  ]

  // Fetch blog posts from the live API
  try {
    const base = await readApiBase()
    const res = await fetch(`${base}/api/blog`)
    if (res.ok) {
      const payload = await res.json()
      const rows = payload?.data
      if (Array.isArray(rows)) {
        let addedCount = 0
        for (const row of rows) {
          if (row && row.slug) {
            if (MERGED_BLOG_SLUGS.has(row.slug)) continue
            routes.push({
              loc: `https://ghlprime.com/blog/${row.slug}`,
              changefreq: 'monthly',
              priority: '0.7',
              lastmod: toDateOnly(row.updated_at || row.published_at),
            })
            addedCount++
          }
        }
        console.log(`✓ Added ${addedCount} blog posts to sitemap`)
      }
    } else {
      console.warn(`✗ API returned ${res.status} - using static routes only`)
    }
  } catch (error) {
    console.warn(`✗ API fetch failed: ${error?.message || 'unknown error'} - using static routes only`)
  }

  // Fetch case studies from the live API
  const caseStudySlugMap = new Map()
  try {
    const base = await readApiBase()
    const res = await fetch(`${base}/api/case-studies`)
    if (res.ok) {
      const payload = await res.json()
      const rows = payload?.data
      if (Array.isArray(rows)) {
        for (const row of rows) {
          if (row && row.slug) {
            caseStudySlugMap.set(row.slug, toDateOnly(row.updated_at))
          }
        }
        console.log(`✓ Added ${caseStudySlugMap.size} case studies to sitemap`)
      }
    } else {
      console.warn(`✗ API returned ${res.status} for case studies`)
    }
  } catch (error) {
    console.warn(`✗ Case studies fetch failed: ${error?.message || 'unknown error'}`)
  }

  for (const [slug, lastmod] of caseStudySlugMap) {
    routes.push({
      loc: `https://ghlprime.com/case-studies/${slug}`,
      changefreq: 'yearly',
      priority: '0.7',
      lastmod,
    })
  }

  // Generate XML
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes
  .map(
    (r) =>
      `  <url><loc>${r.loc}</loc><lastmod>${r.lastmod || LASTMOD}</lastmod><changefreq>${r.changefreq}</changefreq><priority>${r.priority}</priority></url>`,
  )
  .join('\n')}
</urlset>
`

  // Write sitemap
  const publicDir = path.join(root, 'public')
  await fs.mkdir(publicDir, { recursive: true })
  await fs.writeFile(path.join(publicDir, 'sitemap.xml'), xml, 'utf8')

  console.log(`✓ Sitemap generated successfully with ${routes.length} URLs`)
  return routes.length
}

// Run the rebuild
rebuildSitemap()
  .then((count) => {
    console.log(`[${new Date().toISOString()}] Sitemap rebuild complete: ${count} URLs`)
    process.exit(0)
  })
  .catch((error) => {
    console.error(`✗ Sitemap rebuild failed:`, error)
    process.exit(1)
  })
