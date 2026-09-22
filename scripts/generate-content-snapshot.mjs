import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { blogPosts } from '../src/data/blogPosts.js'
import { caseStudies } from '../src/data/caseStudies.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')
const outPath = path.join(root, 'src', 'data', 'contentSnapshot.json')

// Read the existing committed snapshot defensively. This is the second-priority
// source: if the live API fetch returns nothing, we must NOT downgrade to
// the tiny local fallback arrays — we keep whatever real data is already on disk.
let existingSnapshot = { blogPosts: [], caseStudies: [] }
try {
  const raw = await fs.readFile(outPath, 'utf8')
  const parsed = JSON.parse(raw)
  if (parsed && Array.isArray(parsed.blogPosts)) existingSnapshot.blogPosts = parsed.blogPosts
  if (parsed && Array.isArray(parsed.caseStudies)) existingSnapshot.caseStudies = parsed.caseStudies
} catch {
  // no existing snapshot — fine
}

// Best-effort API base resolution — mirrors generate-sitemap.mjs. NEVER
// throws: a missing/unreadable .env or a failed fetch must not fail the
// build. The backend dropped Supabase for a self-hosted Postgres+Prisma API
// (see backend commit "removed supabase and migrate with prisma"), so this
// reads straight from that API instead of Supabase's REST endpoint, which is
// no longer the source of truth.
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
    // .env not present — fall through to process.env
  }
  if (!base) base = process.env.VITE_API_URL || ''
  return base || 'https://api.ghlprime.com'
}

function sortByPublishedAtDesc(posts) {
  return [...posts].sort((a, b) => {
    const aTime = a.published_at ? new Date(a.published_at).getTime() : 0
    const bTime = b.published_at ? new Date(b.published_at).getTime() : 0
    return bTime - aTime
  })
}

const fallbackBlogPosts = sortByPublishedAtDesc(blogPosts.filter((post) => post.published !== false))
const fallbackCaseStudies = [...caseStudies]

async function fetchRows(base, apiPath) {
  const res = await fetch(`${base}${apiPath}`)
  if (!res.ok) {
    console.log(`API responded ${res.status} for ${apiPath}.`)
    return null
  }
  const payload = await res.json()
  const rows = payload?.data
  return Array.isArray(rows) ? rows : null
}

// Priority for what gets written (per array, independently):
//   1. Live API fetch result, if non-empty (set below).
//   2. Existing committed snapshot, if non-empty (defaulted here).
//   3. Local fallback arrays (blogPosts.js / caseStudies.js).
// Initialising to existing-then-local guarantees the catch / no-creds paths
// leave the real committed data in place rather than downgrading it.
let snapshotBlogPosts = existingSnapshot.blogPosts.length ? existingSnapshot.blogPosts : fallbackBlogPosts
let snapshotCaseStudies = existingSnapshot.caseStudies.length ? existingSnapshot.caseStudies : fallbackCaseStudies
let usedFreshBlogPosts = false
let usedFreshCaseStudies = false

try {
  const base = await readApiBase()

  const fetchedPosts = await fetchRows(base, '/api/blog')
  if (fetchedPosts && fetchedPosts.length) {
    snapshotBlogPosts = sortByPublishedAtDesc(fetchedPosts)
    usedFreshBlogPosts = true
    console.log('Using live blog posts from the API.')
  } else {
    console.log('No live blog rows — keeping existing-snapshot-or-local blog posts.')
  }

  const fetchedStudies = await fetchRows(base, '/api/case-studies')
  if (fetchedStudies && fetchedStudies.length) {
    snapshotCaseStudies = fetchedStudies
    usedFreshCaseStudies = true
    console.log('Using live case studies from the API.')
  } else {
    console.log('No live case studies — keeping existing-snapshot-or-local case studies.')
  }
} catch (error) {
  console.log(`Snapshot fetch failed (${error?.message || 'unknown error'}) — using local fallback content.`)
}

if ((!usedFreshBlogPosts || !usedFreshCaseStudies) && (existingSnapshot.blogPosts.length || existingSnapshot.caseStudies.length)) {
  console.log(
    `Preserving existing committed snapshot (${existingSnapshot.blogPosts.length} posts / ${existingSnapshot.caseStudies.length} studies) — no fresh data fetched for one or both.`,
  )
}

const snapshot = {
  generatedAt: new Date().toISOString(),
  blogPosts: snapshotBlogPosts,
  caseStudies: snapshotCaseStudies,
}

try {
  await fs.mkdir(path.dirname(outPath), { recursive: true })
  await fs.writeFile(outPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')
  console.log(
    `contentSnapshot.json written (${snapshot.blogPosts.length} blog posts, ${snapshot.caseStudies.length} case studies).`,
  )
} catch (error) {
  console.log(`Failed to write contentSnapshot.json: ${error?.message || 'unknown error'}.`)
}
