// The AI Blog Writer's rules and labels, as the admin screens need them.
//
// Mirrors GHL-Prime-New/src/modules/blog-writer/lib/{rules,cta-variants,
// run-schedule}.ts. The numbers here let a button be disabled before a request
// is made and a count be shown before the server answers; the server clamps and
// validates the same way, so the two never disagree about what is allowed. If a
// limit changes there, change it here.

export const MIN_IMAGES = 0
export const MAX_IMAGES = 6

export const MIN_PER_RUN = 1
export const MAX_PER_RUN = 3

export const MIN_PER_DAY = 1
export const MAX_PER_DAY = 25
export const DEFAULT_PER_DAY = 10

export const WORD_OPTIONS = [500, 1000, 2000]
export const DEFAULT_WORDS = 500

export const DEFAULT_TIME = '07:00'
export const DEFAULT_TIMEZONE = 'Asia/Dhaka'

export const RUN_MODES = ['queue', 'sources']
export const RUN_MODE_LABELS = {
  queue: 'From its keyword list',
  sources: 'From saved sites',
}

/** The CTA banners a post can end with. Ids match the site's BlogCtaBanner. */
export const CTA_VARIANTS = [
  { id: 'none', label: 'No banner', hint: 'End the post with no call to action at all.' },
  { id: 'general', label: 'Hire a dedicated GoHighLevel team', hint: 'The default: GHL Prime builds, automates and supports your agency’s GoHighLevel setup.' },
  { id: 'automation', label: 'Want this automated?', hint: 'For workflow and automation posts.' },
  { id: 'support', label: 'Need a team who handles this?', hint: 'For setup, troubleshooting and support posts.' },
  { id: 'ai_agents', label: 'Curious what an AI agent could do here?', hint: 'For AI and voice posts.' },
]
export const RANDOM_CTA_VARIANT = 'random'
export const DEFAULT_CTA_VARIANT = 'general'

/** The phases a run reports, in the order they happen. */
export const RUN_PHASES = ['starting', 'standard', 'research', 'writing', 'audit', 'images', 'saving', 'done']
export const RUN_PHASE_LABELS = {
  starting: 'Starting the writer',
  standard: 'Reading the writing standard',
  research: 'Researching',
  writing: 'Writing the draft',
  audit: 'Auditing against the rules',
  images: 'Fetching images',
  saving: 'Saving to Blog',
  done: 'Finished',
}

/** Why a run stopped, said to an editor rather than to a developer. */
export const FAILURE_LABELS = {
  'nothing-to-write': 'Nothing worth writing was found',
  'no-post': 'Finished without saving a post',
  limit: 'Gave up after retrying the usage limit',
  timeout: 'Kept timing out',
  error: 'The run broke',
}

export const KIND_META = {
  keyword: { label: 'Keyword', hint: 'Researched from scratch' },
  link: { label: 'Article', hint: 'Written from this article' },
  site: { label: 'Site', hint: 'A story is picked from this site' },
}

/** Short, human relative time. "never" reads better than an empty cell. */
export function relativeTime(iso) {
  if (!iso) return 'never'
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return `${Math.max(seconds, 0)}s ago`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h ago`
  return `${Math.round(seconds / 86400)}d ago`
}

/** "in 20m" for a time still ahead. The mirror of relativeTime. */
export function relativeFuture(iso) {
  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000)
  if (seconds <= 60) return 'in under a minute'
  if (seconds < 3600) return `in ${Math.round(seconds / 60)}m`
  return `in ${Math.round(seconds / 3600)}h`
}

/** "used today" / "used 3d ago" for a site's last use. */
export function relativeDays(iso) {
  if (!iso) return 'not yet used'
  const days = Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days < 1) return 'used today'
  if (days === 1) return 'used yesterday'
  return `used ${days}d ago`
}

/** 1_240_000 -> "1.2M". Token counts here run to millions. */
export function compactTokens(value) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`
  return String(value)
}

export function duration(ms) {
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}

/** All four counters: the run was billed for all of them. */
export function totalTokens(usage) {
  return usage.inputTokens + usage.cacheCreationTokens + usage.cacheReadTokens + usage.outputTokens
}

/** What an editor wants: how many tokens, what it cost, how long it took. */
export function costSummary(usage) {
  return [`${compactTokens(totalTokens(usage))} tokens`, `$${usage.costUsd.toFixed(2)}`, duration(usage.durationMs)].join(' · ')
}

/** The breakdown, for whoever wants to know where the tokens went. Hover only. */
export function costDetail(usage) {
  const models = (usage.models || []).map((model) => model.replace(/^claude-/, '').replace(/-\d{8}$/, '')).join(', ')
  return [
    `${compactTokens(usage.inputTokens + usage.cacheCreationTokens)} sent to the model`,
    `${compactTokens(usage.cacheReadTokens)} re-read from cache each step`,
    `${compactTokens(usage.outputTokens)} written back`,
    `= ${compactTokens(totalTokens(usage))} tokens billed in total`,
    '',
    models ? `${usage.turns} steps, on ${models}` : `${usage.turns} steps`,
  ].join('\n')
}

/** How long a backlog lasts at a given rate. "finishes 27 Nov" is the half that gets acted on. */
export function projectFinish(queued, perDay) {
  if (queued === 0) return 'nothing waiting'
  if (perDay < 1) return `${queued} waiting`

  const days = Math.ceil(queued / perDay)
  const finish = new Date()
  finish.setDate(finish.getDate() + days - 1)

  const when = finish.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: finish.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  })

  if (days === 1) return `${queued} waiting · all of it today`
  return `${queued} waiting · ${perDay} a day · ${days} days · finishes ${when}`
}

/**
 * Turn typed text into keywords, the same way the server does, so the number
 * on the button is the number that gets added. Newlines always separate;
 * commas only when asked; `| notes` after a keyword is steering.
 */
export function parseKeywordText(text, splitCommas) {
  const out = []
  for (const line of text.split('\n')) {
    const cleaned = line.trim().replace(/^[-*•]\s*/, '')
    if (!cleaned) continue
    const [topicPart = '', ...rest] = cleaned.split('|')
    const notes = rest.join('|').trim()
    const topics = splitCommas ? topicPart.split(',') : [topicPart]
    for (const topic of topics) {
      const trimmed = topic.trim()
      if (!trimmed) continue
      out.push({ topic: trimmed, notes })
    }
  }
  return out
}

/** One line on what the last scan made of a site. */
export function describeScan(scan) {
  const when = relativeDays(scan.at).replace(/^used /, '').replace(/^not yet used$/, '')
  if (scan.found === 0) return `${scan.error || 'nothing found'} (${when || 'last scan'})`
  const parts = [`${scan.found} headline${scan.found === 1 ? '' : 's'}`]
  if (scan.shown < scan.found) parts.push(`${scan.shown} shown`)
  if (scan.picked > 0) parts.push(`${scan.picked} picked`)
  return `${parts.join(', ')} ${when}`.trim()
}

/** The batch rows still worth showing: everything unfinished, plus what finished after the last close. */
export function visibleBatchRows(batch, clearedAt) {
  const cleared = clearedAt ? new Date(clearedAt).getTime() : 0
  return batch.rows.filter((row) => {
    if (row.status !== 'done' && row.status !== 'failed') return true
    if (!cleared) return true
    return row.finishedAt ? new Date(row.finishedAt).getTime() > cleared : false
  })
}

/** Whether a batch block has anything to say. */
export function batchIsVisible(batch, clearedAt) {
  return Boolean(batch.id) || visibleBatchRows(batch, clearedAt).length > 0
}
