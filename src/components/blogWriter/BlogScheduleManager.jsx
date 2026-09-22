'use client'

import { useCallback, useEffect, useState } from 'react'
import { CalendarClock, ChevronLeft, ChevronRight, FileSpreadsheet, Globe, Inbox, ListTodo, Plus, Trash2 } from 'lucide-react'
import {
  MAX_IMAGES,
  MAX_PER_DAY,
  MIN_IMAGES,
  MIN_PER_DAY,
  RUN_MODES,
  RUN_MODE_LABELS,
  describeScan,
  parseKeywordText,
  projectFinish,
  relativeDays,
  batchIsVisible,
} from '../../lib/blogWriterRules'
import {
  addScheduleKeywords,
  closeBlogSummary,
  createBlogSchedule,
  deleteBlogSchedule,
  dismissBlogRun,
  fetchBlogSchedules,
  fetchBlogWriterState,
  fetchScheduleKeywords,
  importBlogSheet,
  saveBlogWriterDefaults,
  stopBlogBatch,
  updateBlogSchedule,
} from '../../lib/blogWriterApi'
import { Button, Card, CardContent, CardHeader, Empty, Hint, Input, Label, Spinner, Switch, Textarea } from './ui'
import { cn, usePolling, useToast } from './hooks'
import { CtaVariantSelect, TimezoneSelect, WordLengthSelect } from './pickers'
import { BatchProgress, RunHistory, RunProgress, WriterStatus } from './RunProgressCard'

/**
 * The alarms, each self-contained. A schedule carries its own keywords and
 * its own sites; `mode` decides which of the two lists it reads, and only the
 * list in use is shown.
 */

const MODE_HINTS = {
  queue: 'Writes the keywords below, in order, a set number each day — then stops until tomorrow and takes them off the list as it goes.',
  sources:
    'Each day, reads the headlines on every site below, picks the stories a business reader would want a post on, and writes the best ones one at a time. Fewer than asked for on a quiet day.',
}

const MODE_ICONS = { queue: ListTodo, sources: Globe }

/** Rows per page in the keyword list. Matches the endpoint's own default. */
const QUEUE_PAGE = 25

export function BlogScheduleManager() {
  const toast = useToast()
  const [schedules, setSchedules] = useState([])
  const [run, setRun] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)

  /**
   * Everything this screen needs, in one round trip. A failed part comes back
   * undefined rather than blanking the other: the schedules and the run
   * status are independent.
   */
  const load = useCallback(
    async (quiet = false) => {
      const [schedulesRes, runRes] = await Promise.all([fetchBlogSchedules(), fetchBlogWriterState()])
      setLoading(false)
      if (schedulesRes.data) setSchedules(schedulesRes.data.schedules)
      if (runRes.data) setRun(runRes.data)
      if ((schedulesRes.error || runRes.error) && !quiet) toast.error('Could not load the schedules.')
      return Boolean(runRes.data?.activeRequest)
    },
    [toast],
  )

  usePolling(load)

  /** Save one part of one schedule. Applied locally first, put back by the reload if refused. */
  const patchSchedule = useCallback(
    async (id, body) => {
      setSchedules((prev) => prev.map((schedule) => (schedule.id === id ? { ...schedule, ...body } : schedule)))
      setBusy(id)
      const { error } = await updateBlogSchedule(id, body)
      if (error) {
        toast.error(error.message || 'Could not save the change.')
        await load(true)
      }
      setBusy(null)
    },
    [load, toast],
  )

  async function addSchedule() {
    setBusy('new-schedule')
    const { error } = await createBlogSchedule({ name: `Schedule ${schedules.length + 1}` })
    if (error) toast.error(error.message || 'Could not add the schedule.')
    await load(true)
    setBusy(null)
  }

  async function removeSchedule(id) {
    setBusy(id)
    const { data, error } = await deleteBlogSchedule(id)
    if (error) toast.error(error.message || 'Could not remove the schedule.')
    // Said out loud, because the keywords have moved to a screen the person
    // deleting the schedule is not looking at.
    else if (data?.returned) toast.success(`Schedule removed. Its ${data.returned} keywords went back to the AI Blog Writer queue.`)
    await load(true)
    setBusy(null)
  }

  /** Site-wide, not per schedule: whether writing reaches readers unread is one decision about the site. */
  const setAutoPublish = useCallback(
    async (autoPublish) => {
      const defaults = run?.defaults
      if (!defaults) return
      setRun((prev) => (prev ? { ...prev, defaults: { ...prev.defaults, autoPublish } } : prev))
      const { error } = await saveBlogWriterDefaults({ ...defaults, autoPublish })
      if (error) {
        toast.error(error.message || 'Could not save that.')
        await load(true)
      }
    },
    [run?.defaults, load, toast],
  )

  async function closeBatch() {
    setBusy('summary')
    const { error } = await closeBlogSummary()
    if (error) toast.error(error.message || 'Could not close that.')
    await load(true)
    setBusy(null)
  }

  async function stopBatch() {
    setBusy('summary')
    const { error } = await stopBlogBatch()
    if (error) toast.error(error.message || 'Could not stop the batch.')
    else toast.success('Stopping after this post. Unwritten keywords go back to the schedule.')
    await load(true)
    setBusy(null)
  }

  async function dismissRun(id) {
    setRun((prev) => (prev ? { ...prev, recentRuns: prev.recentRuns.filter((entry) => entry.id !== id) } : prev))
    const { error } = await dismissBlogRun(id)
    if (error) {
      toast.error(error.message || 'Could not dismiss that run.')
      await load(true)
    }
  }

  if (loading) {
    return (
      <p className="bw-hint bw-row">
        <Spinner /> Loading the schedules…
      </p>
    )
  }

  const queuedCount = run?.counts.queued ?? 0
  const dailyPosts = schedules.filter((schedule) => schedule.enabled).reduce((total, schedule) => total + schedule.postsPerDay, 0)

  return (
    <div className="bw-stack-lg">
      {run ? <WriterStatus online={run.writer.online} lastSeen={run.writer.lastSeen} pending={Boolean(run.activeRequest)} queuedCount={queuedCount} schedules={schedules} /> : null}

      {run?.activeRequest ? <RunProgress request={run.activeRequest} /> : null}

      {run && !run.activeRequest && !batchIsVisible(run.batch, run.summary.clearedAt) && run.recentRuns.length > 0 ? (
        <RunHistory runs={run.recentRuns} onDismiss={(id) => void dismissRun(id)} />
      ) : null}

      <div className="bw-stack-sm">
        {schedules.length === 0 ? (
          <Empty>No schedules yet. Add one to publish the queue a few posts a day, one for its own keywords, or one for news sites.</Empty>
        ) : (
          schedules.map((schedule) => (
            <ScheduleCard
              key={schedule.id}
              schedule={schedule}
              busy={busy === schedule.id}
              defaults={run?.defaults ?? null}
              batch={run?.batch ?? null}
              clearedAt={run?.summary.clearedAt ?? ''}
              batchBusy={busy === 'summary'}
              onCloseBatch={() => void closeBatch()}
              onStopBatch={() => void stopBatch()}
              onPatch={(body) => void patchSchedule(schedule.id, body)}
              onRemove={() => {
                if (
                  schedule.keywordCount > 0 &&
                  !window.confirm(
                    `Delete "${schedule.name}"? Its ${schedule.keywordCount} keywords go back to the AI Blog Writer queue — nothing is lost, but this schedule stops writing them.`,
                  )
                ) {
                  return
                }
                void removeSchedule(schedule.id)
              }}
              onReload={() => load(true)}
              onSetAutoPublish={setAutoPublish}
            />
          ))
        )}

        <div>
          <Button onClick={() => void addSchedule()} disabled={busy === 'new-schedule'} busy={busy === 'new-schedule'}>
            {busy === 'new-schedule' ? null : <Plus size={15} />} Add schedule
          </Button>
        </div>
      </div>

      {dailyPosts > 12 ? (
        <p className="bw-warning">
          These schedules add up to <strong>{dailyPosts} posts a day</strong>. Each one is a separate research run, so this is where the subscription&apos;s usage
          limit starts deciding your pace rather than you.
        </p>
      ) : null}
    </div>
  )
}

/** One alarm, with the list its mode uses. */
function ScheduleCard({ schedule, busy, defaults, batch, clearedAt, batchBusy, onCloseBatch, onStopBatch, onPatch, onRemove, onReload, onSetAutoPublish }) {
  const Icon = MODE_ICONS[schedule.mode] || ListTodo

  // This card's batch: the day's run if it is this schedule's and still worth
  // showing, otherwise what the next run will write — the same block, so
  // nothing moves around the page.
  const ownBatch = Boolean(batch && batch.scheduleId === schedule.id && batchIsVisible(batch, clearedAt))

  const upcoming =
    !ownBatch && schedule.mode === 'queue'
      ? {
          id: '',
          total: Math.min(schedule.postsPerDay, schedule.keywordCount),
          shownId: '',
          scheduleName: schedule.name,
          scheduleId: schedule.id,
          startedAt: null,
          rows: schedule.keywords.slice(0, schedule.postsPerDay).map((keyword, index) => ({
            id: `upcoming-${index}`,
            status: 'queued',
            topic: keyword.topic,
            blogSlug: '',
            postStatus: '',
            detail: '',
            failureKind: '',
            retryAfter: null,
            finishedAt: null,
            usage: null,
          })),
        }
      : null

  return (
    <Card className={cn('bw-schedule', !schedule.enabled && 'is-paused')}>
      <CardHeader>
        <div className="bw-row bw-between">
          <div className="bw-row bw-grow-min">
            <Icon size={16} className="bw-muted bw-shrink" />
            {/* Uncontrolled, reading its value on blur: a controlled copy would fight whatever is being typed. */}
            <Input
              className="bw-input-title"
              defaultValue={schedule.name}
              onBlur={(event) => {
                if (event.target.value !== schedule.name) onPatch({ name: event.target.value })
              }}
              aria-label="Schedule name"
            />
          </div>
          <div className="bw-row">
            <span className={cn('bw-hint', schedule.enabled && 'bw-emerald')}>{schedule.enabled ? `Runs daily at ${schedule.time}` : 'Paused'}</span>
            <Switch checked={schedule.enabled} disabled={busy} onCheckedChange={(enabled) => onPatch({ enabled })} aria-label={`Enable ${schedule.name}`} />
            <Button variant="icon" className="bw-danger" disabled={busy} onClick={onRemove} aria-label={`Remove ${schedule.name}`}>
              <Trash2 size={15} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="bw-stack">
        <div className="bw-field">
          <Label className="bw-label-inline">What it writes</Label>
          <div className="bw-segmented" role="group">
            {RUN_MODES.map((mode) => (
              <button key={mode} type="button" disabled={busy} onClick={() => onPatch({ mode })} className={cn(schedule.mode === mode && 'is-active')}>
                {RUN_MODE_LABELS[mode]}
              </button>
            ))}
          </div>
          <Hint>{MODE_HINTS[schedule.mode]}</Hint>
        </div>

        <div className="bw-grid-5">
          <div className="bw-field">
            <Label htmlFor={`bw-time-${schedule.id}`}>Time</Label>
            <Input
              id={`bw-time-${schedule.id}`}
              type="time"
              defaultValue={schedule.time}
              // Saved on blur: a time field emits a value on every digit.
              onBlur={(event) => {
                if (event.target.value !== schedule.time) onPatch({ time: event.target.value })
              }}
            />
          </div>

          <div className="bw-field">
            <Label htmlFor={`bw-tz-${schedule.id}`}>Timezone</Label>
            <TimezoneSelect
              id={`bw-tz-${schedule.id}`}
              value={schedule.timezone}
              onChange={(timezone) => {
                if (timezone !== schedule.timezone) onPatch({ timezone })
              }}
            />
          </div>

          <div className="bw-field">
            <Label htmlFor={`bw-day-${schedule.id}`}>Posts per day</Label>
            <Input
              id={`bw-day-${schedule.id}`}
              type="number"
              min={MIN_PER_DAY}
              max={MAX_PER_DAY}
              defaultValue={schedule.postsPerDay}
              onBlur={(event) => {
                const value = Number(event.target.value)
                if (value !== schedule.postsPerDay) onPatch({ postsPerDay: value })
              }}
            />
          </div>

          <div className="bw-field">
            <Label htmlFor={`bw-img-${schedule.id}`}>Images</Label>
            <Input
              id={`bw-img-${schedule.id}`}
              type="number"
              min={MIN_IMAGES}
              max={MAX_IMAGES}
              defaultValue={schedule.imageCount}
              onBlur={(event) => {
                const value = Number(event.target.value)
                if (value !== schedule.imageCount) onPatch({ imageCount: value })
              }}
            />
          </div>

          <div className="bw-field">
            <Label htmlFor={`bw-words-${schedule.id}`}>Length</Label>
            <WordLengthSelect id={`bw-words-${schedule.id}`} value={schedule.words} onChange={(words) => onPatch({ words: words ?? schedule.words })} />
          </div>

          <div className="bw-field">
            <Label>CTA banner</Label>
            <CtaVariantSelect value={schedule.ctaVariant} onChange={(ctaVariant) => onPatch({ ctaVariant })} inherit inheritLabel={defaults?.ctaVariant} />
          </div>
        </div>

        {ownBatch && batch ? <BatchProgress batch={batch} clearedAt={clearedAt} busy={batchBusy} onClose={onCloseBatch} onStop={onStopBatch} /> : null}

        {upcoming ? <BatchProgress batch={upcoming} clearedAt="" upcoming={{ runsAt: schedule.time }} /> : null}

        {!ownBatch && schedule.mode === 'sources' ? (
          <p className="bw-hint bw-row">
            <CalendarClock size={12} />
            Next batch: up to {schedule.postsPerDay} stor{schedule.postsPerDay === 1 ? 'y' : 'ies'} from {schedule.sites.filter((site) => site.enabled).length} site(s), daily at{' '}
            {schedule.time}.
          </p>
        ) : null}

        {schedule.mode === 'queue' ? (
          <div className="bw-stack">
            <KeywordBacklog schedule={schedule} defaults={defaults} offset={upcoming ? upcoming.rows.length : 0} onReload={onReload} onSetAutoPublish={onSetAutoPublish} />
            <SheetImport schedule={schedule} onPatch={onPatch} onReload={onReload} />
          </div>
        ) : (
          <SiteList schedule={schedule} busy={busy} onPatch={onPatch} />
        )}

        {schedule.lastRunDay ? (
          <p className="bw-hint bw-row">
            <CalendarClock size={12} /> Last acted on {schedule.lastRunDay}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

/**
 * The schedule's backlog: what it will write, in order, and by when. Paged
 * rather than shown whole — a transferred backlog is hundreds of rows.
 */
function KeywordBacklog({ schedule, defaults, offset, onReload, onSetAutoPublish }) {
  const toast = useToast()
  const [page, setPage] = useState(0)
  const [rows, setRows] = useState(schedule.keywords.slice(offset))
  const [total, setTotal] = useState(schedule.keywordCount)
  const [adding, setAdding] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchScheduleKeywords(schedule.id, { skip: offset + page * QUEUE_PAGE, limit: QUEUE_PAGE }).then(({ data, error }) => {
      if (cancelled) return
      if (error || !data) setRows([])
      else {
        setRows(data.keywords)
        setTotal(data.total)
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [page, offset, schedule.id, schedule.keywordCount])

  async function addKeywords(splitCommas) {
    const text = adding.trim()
    if (!text) return
    setBusy(true)
    const { data, error } = await addScheduleKeywords(schedule.id, { topics: text, splitCommas })
    if (error) toast.error(error.message || 'Could not add those.')
    else {
      const parts = [`Added ${data?.added ?? 0}`]
      if (data?.duplicates) parts.push(`${data.duplicates} already on the list`)
      if (data?.overflowed) parts.push(`${data.overflowed} over the limit`)
      toast.success(`${parts.join(', ')}.`)
      setAdding('')
      await onReload()
    }
    setBusy(false)
  }

  // What each button would add, counted with the same function the server
  // parses with. Only worth two buttons when they disagree.
  const asSeparate = parseKeywordText(adding, true).length
  const asTyped = parseKeywordText(adding, false).length
  const commaSplits = asSeparate !== asTyped

  const listed = Math.max(0, total - offset)
  const pages = Math.max(1, Math.ceil(listed / QUEUE_PAGE))
  const start = offset + page * QUEUE_PAGE

  return (
    <div className="bw-panel bw-stack-sm">
      <div className="bw-row bw-between">
        <div className="bw-row bw-text bw-strong">
          <Inbox size={15} className="bw-muted" />
          {total === 0 ? 'No keywords yet' : projectFinish(total, schedule.postsPerDay)}
        </div>

        {defaults ? (
          <div className="bw-row">
            <Label htmlFor={`bw-pub-${schedule.id}`} className="bw-label-inline">
              Publish automatically
            </Label>
            <Switch id={`bw-pub-${schedule.id}`} checked={defaults.autoPublish} onCheckedChange={onSetAutoPublish} aria-label="Publish written posts automatically" />
          </div>
        ) : null}
      </div>

      {total > 0 ? (
        <>
          <Hint>
            {offset > 0 ? 'The rest of the list, after the batch above.' : 'The list, in order.'} Each day this takes the next {schedule.postsPerDay} from the top, writes
            them one at a time, and stops until tomorrow. Written keywords leave the list.{' '}
            {defaults?.autoPublish ? 'Finished posts go live without being read first.' : 'Finished posts wait as drafts until someone publishes them.'}
          </Hint>

          {listed === 0 ? <Empty>Everything left is in the next batch above.</Empty> : null}

          <ol className={cn('bw-list', listed === 0 && 'bw-hidden')}>
            {loading && rows.length === 0 ? (
              <li className="bw-list-row bw-hint">
                <Spinner size={12} /> Reading the list…
              </li>
            ) : (
              rows.map((row, index) => (
                <li key={`${start + index}-${row.topic}`} className="bw-list-row">
                  {/* The row's real position, not its position on this page. */}
                  <span className="bw-index bw-index-wide">{start + index + 1}</span>
                  <span className="bw-grow bw-text bw-truncate">
                    {row.topic}
                    {row.notes ? <span className="bw-hint bw-ml"> {row.notes}</span> : null}
                  </span>
                </li>
              ))
            )}
          </ol>

          <div className="bw-row bw-between bw-hint">
            <span>
              {start + 1}–{Math.min(start + QUEUE_PAGE, total)} of {total}
              {offset > 0 ? ` · first ${offset} in the batch above` : ''}
            </span>
            <div className="bw-row">
              <Button
                variant="icon"
                disabled={page === 0 || loading}
                onClick={() => {
                  setLoading(true)
                  setPage((current) => Math.max(0, current - 1))
                }}
                aria-label="Previous page"
              >
                <ChevronLeft size={14} />
              </Button>
              <span className="bw-tabular">
                {page + 1} / {pages}
              </span>
              <Button
                variant="icon"
                disabled={page + 1 >= pages || loading}
                onClick={() => {
                  setLoading(true)
                  setPage((current) => current + 1)
                }}
                aria-label="Next page"
              >
                <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        </>
      ) : null}

      <div className="bw-field">
        <Label htmlFor={`bw-kw-${schedule.id}`} className="bw-label-inline">
          Add keywords
        </Label>
        <Textarea
          id={`bw-kw-${schedule.id}`}
          rows={3}
          value={adding}
          placeholder={'gohighlevel a2p 10dlc registration\nwhite label ghl support pricing | lean practical'}
          onChange={(event) => setAdding(event.target.value)}
        />
        <div className="bw-row bw-between bw-wrap">
          <Hint>
            One per line. Add <code>| notes</code> after a keyword to steer the angle. They go to the end of the list.
            {commaSplits ? <> That has commas in it, so pick whether they separate keywords or belong inside one.</> : null}
          </Hint>

          <div className="bw-row bw-shrink">
            <Button size="sm" disabled={!adding.trim() || busy} busy={busy} onClick={() => void addKeywords(commaSplits)}>
              {busy ? null : <Plus size={14} />}
              {commaSplits ? `Add ${asSeparate} separate` : asTyped > 0 ? `Add ${asTyped}` : 'Add'}
            </Button>
            {commaSplits ? (
              <Button variant="outline" size="sm" disabled={!adding.trim() || busy} onClick={() => void addKeywords(false)}>
                <Plus size={14} /> Add {asTyped} as typed
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Import this schedule's keywords from its own content calendar. Nothing is
 * fetched except when Import is pressed.
 */
function SheetImport({ schedule, onPatch, onReload }) {
  const toast = useToast()
  const [url, setUrl] = useState(schedule.sheetUrl)
  const [importing, setImporting] = useState(false)

  async function runImport() {
    const trimmed = url.trim()
    if (!trimmed) return
    setImporting(true)
    const { data, error } = await importBlogSheet({ url: trimmed, scheduleId: schedule.id })
    if (error) toast.error(error.message || 'Could not read that sheet.')
    else {
      // Remembered only once it has actually worked.
      if (trimmed !== schedule.sheetUrl) onPatch({ sheetUrl: trimmed })
      const parts = [`Added ${data?.added ?? 0}`]
      if (data?.duplicates) parts.push(`${data.duplicates} already listed or written`)
      if (data?.done) parts.push(`${data.done} marked done in the sheet`)
      if (data?.overflowed) parts.push(`${data.overflowed} over this schedule's limit`)
      toast.success(`${parts.join(', ')}.`)
      await onReload()
    }
    setImporting(false)
  }

  return (
    <div className="bw-field">
      <Label htmlFor={`bw-sheet-${schedule.id}`} className="bw-row">
        <FileSpreadsheet size={14} className="bw-muted" /> This schedule&apos;s content calendar
      </Label>
      <div className="bw-row-form">
        <Input
          id={`bw-sheet-${schedule.id}`}
          value={url}
          placeholder="https://docs.google.com/spreadsheets/d/…"
          onChange={(event) => setUrl(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void runImport()
          }}
        />
        <Button disabled={!url.trim() || importing} busy={importing} onClick={() => void runImport()}>
          {importing ? null : <Plus size={15} />} Import
        </Button>
      </div>
      <Hint>
        Open the calendar tab first and copy the URL from the address bar — the link carries the tab you were on. The sheet has to be shared as “anyone with the link
        can view”. Rows already written, or already on this list, are skipped, so it is safe to run again after the sheet grows.
      </Hint>
    </div>
  )
}

/**
 * This schedule's own publications. A site is switched off rather than
 * deleted when it is temporarily unwanted, which keeps its place in the rotation.
 */
function SiteList({ schedule, busy, onPatch }) {
  const toast = useToast()
  const [newUrl, setNewUrl] = useState('')
  const [newNotes, setNewNotes] = useState('')

  function add() {
    const url = newUrl.trim()
    if (!url) return
    if (schedule.sites.some((site) => site.url.toLowerCase() === url.toLowerCase())) {
      toast.error('That site is already on this schedule.')
      return
    }
    onPatch({ sites: [...schedule.sites, { url, notes: newNotes.trim(), enabled: true, lastUsedAt: null, lastScan: null }] })
    setNewUrl('')
    setNewNotes('')
  }

  function update(index, changes) {
    onPatch({ sites: schedule.sites.map((site, i) => (i === index ? { ...site, ...changes } : site)) })
  }

  return (
    <div className="bw-stack-sm">
      <Label className="bw-label-inline">Sites</Label>

      <div className="bw-grid-2">
        <Input
          placeholder="techcrunch.com or ft.com/technology"
          value={newUrl}
          onChange={(event) => setNewUrl(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') add()
          }}
        />
        <Input
          placeholder="Optional: what to prefer from this site"
          value={newNotes}
          onChange={(event) => setNewNotes(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') add()
          }}
        />
      </div>
      <div>
        <Button size="sm" onClick={add} disabled={!newUrl.trim() || busy}>
          <Plus size={14} /> Add site
        </Button>
      </div>
      <Hint>A section page beats a homepage: ft.com/technology is all stories the picker can use, while ft.com is mostly news it will skip.</Hint>

      {schedule.sites.length === 0 ? (
        <Empty>No sites on this schedule. It has nothing to write from.</Empty>
      ) : (
        <div className="bw-list">
          {schedule.sites.map((site, index) => (
            <div key={site.url} className="bw-list-row bw-align-start">
              <Globe size={15} className="bw-muted bw-shrink bw-mt-xs" />
              <div className="bw-grow bw-stack-xs">
                <p className="bw-text bw-strong bw-truncate">{site.url}</p>
                <p className="bw-hint">
                  {relativeDays(site.lastUsedAt)}
                  {site.lastScan ? <> · {describeScan(site.lastScan)}</> : null}
                </p>
                <Input
                  className="bw-input-sm"
                  defaultValue={site.notes}
                  placeholder="What to prefer from this site"
                  onBlur={(event) => {
                    if (event.target.value !== site.notes) update(index, { notes: event.target.value })
                  }}
                />
              </div>
              <Switch checked={site.enabled} disabled={busy} onCheckedChange={(enabled) => update(index, { enabled })} aria-label={`Use ${site.url}`} />
              <Button variant="icon" className="bw-danger" disabled={busy} onClick={() => onPatch({ sites: schedule.sites.filter((_, i) => i !== index) })} aria-label={`Remove ${site.url}`}>
                <Trash2 size={15} />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
