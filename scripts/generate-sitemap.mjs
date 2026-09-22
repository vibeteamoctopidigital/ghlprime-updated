// Posts merged into a canonical URL and 301-redirected in vercel.json.
// Excluded here so the sitemap never advertises a redirecting URL.
const MERGED_BLOG_SLUGS = new Set([
  'how-to-set-up-gohighlevel-saas-mode',
  '5-gohighlevel-automation-workflows-every-agency-needs',
])

﻿import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')
const publicDir = path.join(root, 'public')

const LASTMOD = '2026-05-31'

function toDateOnly(value) {
  if (!value) return LASTMOD
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? LASTMOD : d.toISOString().slice(0, 10)
}

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

// Best-effort: append published blog post URLs from the live API. Never
// throw — if the API is unreachable, we just keep the static routes above.
// The backend dropped Supabase for a self-hosted Postgres+Prisma API (see
// backend commit "removed supabase and migrate with prisma"), so this reads
// straight from that API instead of Supabase's REST endpoint, which is no
// longer the source of truth and was silently leaving new posts out of the
// sitemap.
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
    // .env not present â€” fall through to process.env
  }
  if (!base) base = process.env.VITE_API_URL || ''
  return base || 'https://api.ghlprime.com'
}

try {
  const base = await readApiBase()
  const res = await fetch(`${base}/api/blog`)
  if (res.ok) {
    const payload = await res.json()
    const rows = payload?.data
    if (Array.isArray(rows)) {
      for (const row of rows) {
        if (row && row.slug) {
          if (MERGED_BLOG_SLUGS.has(row.slug)) continue
          routes.push({
            loc: `https://ghlprime.com/blog/${row.slug}`,
            changefreq: 'monthly',
            priority: '0.7',
            lastmod: toDateOnly(row.updated_at || row.published_at),
          })
        }
      }
      console.log(`Added ${rows.length} published blog post URLs from the API.`)
    }
  } else {
    console.log(`Skipping blog slugs: API responded ${res.status}.`)
  }
} catch (error) {
  console.log(`Skipping blog slugs: ${error?.message || 'fetch failed'}.`)
}

// Best-effort: append published case study URLs from the live API. Never
// throw — if the API is unreachable, we fall back to the 3 local-fallback
// slugs only. The 3 fallbacks are always included and de-duped against the DB.
const caseStudyFallbackSlugs = [
]
const caseStudySlugMap = new Map()
try {
  const base = await readApiBase()
  const res = await fetch(`${base}/api/case-studies`)
  if (res.ok) {
    const payload = await res.json()
    const rows = payload?.data
    if (Array.isArray(rows)) {
      for (const row of rows) {
        if (row && row.slug) caseStudySlugMap.set(row.slug, toDateOnly(row.updated_at))
      }
      console.log(`Added ${caseStudySlugMap.size} published case study slugs from the API.`)
    }
  } else {
    console.log(`Skipping case study slugs: API responded ${res.status}.`)
  }
} catch (error) {
  console.log(`Skipping case study slugs: ${error?.message || 'fetch failed'}.`)
}
// Always include the 3 local-fallback slugs (de-duped against the DB results).
for (const slug of caseStudyFallbackSlugs) if (!caseStudySlugMap.has(slug)) caseStudySlugMap.set(slug, LASTMOD)
for (const [slug, lastmod] of caseStudySlugMap) {
  routes.push({ loc: `https://ghlprime.com/case-studies/${slug}`, changefreq: 'yearly', priority: '0.7', lastmod })
}

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

await fs.mkdir(publicDir, { recursive: true })
await fs.writeFile(path.join(publicDir, 'sitemap.xml'), xml, 'utf8')
console.log(`sitemap.xml generated (${routes.length} urls)`)