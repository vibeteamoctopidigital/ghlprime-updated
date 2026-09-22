'use client'

import { useCallback, useState } from 'react'
import { ArrowDown, ArrowUp, CalendarClock, Globe, Link2, Plus, Search, Trash2 } from 'lucide-react'
import {
  DEFAULT_PER_DAY,
  DEFAULT_TIME,
  DEFAULT_TIMEZONE,
  KIND_META,
  MAX_IMAGES,
  MAX_PER_DAY,
  MAX_PER_RUN,
  MIN_IMAGES,
  MIN_PER_DAY,
  MIN_PER_RUN,
  projectFinish,
} from '../../lib/blogWriterRules'
import {
  applyBlogWriterDefaults,
  bulkAddBlogTopics,
  closeBlogSummary,
  createBlogTopic,
  deleteBlogTopic,
  dismissBlogRun,
  fetchBlogWriterState,
  importBlogSheet,
  reorderBlogTopics,
  requestBlogWrite,
  retryBlogRun,
  saveBlogWriterDefaults,
  stopBlogBatch,
  transferBlogQueue,
  updateBlogTopic,
} from '../../lib/blogWriterApi'
import { Badge, Button, Card, CardContent, CardFooter, CardHeader, Empty, Hint, Input, Label, Select, Spinner, Switch, Textarea } from './ui'
import { usePolling, useToast } from './hooks'
import { CtaVariantSelect, WordLengthSelect } from './pickers'
import { RunHistory, RunProgress, WriterStatus } from './RunProgressCard'
import { RunSummary } from './RunSummary'

/**
 * The AI Blog Writer.
 *
 * Editors line up what should be written and in what order. Nothing here
 * writes anything: generation runs in a Claude Code session on the watcher's
 * machine, and this screen only records the ask. That distinction is the
 * single most important thing the UI has to convey, so the writer's own status
 * is shown prominently, the button refuses to fire when nothing is listening,
 * and the empty state says where posts actually come from.
 */

const KIND_ICONS = { keyword: Search, link: Link2, site: Globe }

export function BlogWriterManager() {
  const toast = useToast()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)
  const [newTopic, setNewTopic] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [bulk, setBulk] = useState('')
  const [sheetUrl, setSheetUrl] = useState('')

  /** Refetch. Returns whether a run is in flight, which sets the poll rate. */
  const load = useCallback(
    async (quiet = false) => {
      const { data: payload, error } = await fetchBlogWriterState()
      setLoading(false)
      if (error) {
        // A failed background refresh is not worth a toast every 20 seconds.
        if (!quiet) toast.error(error.message || 'Could not load the queue.')
        return false
      }
      setData(payload)
      return Boolean(payload.activeRequest)
    },
    [toast],
  )

  usePolling(load)

  /** Run one mutation with a busy marker, a toast on failure, and a refresh. */
  async function act(marker, run, { success, failure } = {}) {
    setBusy(marker)
    try {
      const { data: result, error } = await run()
      if (error) throw error
      if (success) toast.success(typeof success === 'function' ? success(result) : success)
      await load(true)
      return result
    } catch (error) {
      toast.error(error.message || failure || 'Something went wrong.')
      await load(true)
      return null
    } finally {
      setBusy(null)
    }
  }

  const patch = (id, body) => act(id, () => updateBlogTopic(id, body), { failure: 'Could not save.' })

  async function addTopic() {
    const topic = newTopic.trim()
    if (!topic) return
    const result = await act('new', () => createBlogTopic({ topic, notes: newNotes.trim() }), { failure: 'Could not add the topic.' })
    if (result) {
      setNewTopic('')
      setNewNotes('')
    }
  }

  async function applyDefaults() {
    await act('apply', applyBlogWriterDefaults, {
      success: (json) =>
        json?.updated ? `${json.updated} topic${json.updated === 1 ? '' : 's'} now follow the defaults.` : 'Every queued topic already follows the defaults.',
      failure: 'Could not update the queue.',
    })
  }

  async function importSheet() {
    const url = sheetUrl.trim()
    if (!url) return
    const result = await act('sheet', () => importBlogSheet({ url }), {
      success: (json) => {
        // Every number reported: "added 0" on a sheet of 900 rows is alarming
        // until you know 61 were done and the rest were already queued.
        const parts = [`Added ${json?.added ?? 0}`]
        if (json?.done) parts.push(`${json.done} already written`)
        if (json?.duplicates) parts.push(`${json.duplicates} already queued`)
        return `${parts.join(', ')}.`
      },
      failure: 'Could not read that sheet.',
    })
    if (result) setSheetUrl('')
  }

  async function addBulk() {
    const text = bulk.trim()
    if (!text) return
    const result = await act('bulk', () => bulkAddBlogTopics([text]), {
      success: (json) => `Added ${json?.added ?? 0} topic${json?.added === 1 ? '' : 's'}${json?.duplicates ? `, ${json.duplicates} already queued` : ''}.`,
      failure: 'Could not add the topics.',
    })
    if (result) setBulk('')
  }

  /** Drop a finished run from the list. Refused by the server while one is going. */
  async function dismissRun(id) {
    setData((prev) => (prev ? { ...prev, recentRuns: prev.recentRuns.filter((entry) => entry.id !== id) } : prev))
    const { error } = await dismissBlogRun(id)
    if (error) {
      toast.error(error.message || 'Could not dismiss that run.')
      await load(true)
    }
  }

  const retryRun = (id) => act(id, () => retryBlogRun(id), { success: 'Queued again. The writer will pick it up.', failure: 'Could not retry that run.' })
  const removeTopic = (id) => act(id, () => deleteBlogTopic(id), { failure: 'Could not remove the topic.' })

  async function move(index, direction) {
    if (!data) return
    const queued = data.topics
    const target = index + direction
    if (target < 0 || target >= queued.length) return

    const reordered = [...queued]
    ;[reordered[index], reordered[target]] = [reordered[target], reordered[index]]

    // Applied locally first so the row moves under the cursor.
    setData({ ...data, topics: reordered })
    const { error } = await reorderBlogTopics(reordered.map((topic) => topic.id))
    if (error) toast.error(error.message || 'Could not save the new order.')
    await load(true)
  }

  async function saveDefaults(next) {
    setData((prev) => (prev ? { ...prev, defaults: next } : prev))
    const { error } = await saveBlogWriterDefaults(next)
    if (error) {
      toast.error(error.message || 'Could not save the defaults.')
      await load(true)
    }
  }

  const requestWrite = () => act('request', () => requestBlogWrite({}), { success: 'Asked the writer for the next post.', failure: 'Could not send the request.' })
  const requestAll = () => act('request', () => requestBlogWrite({ all: true }), { success: 'Working through the queue. One post at a time.', failure: 'Could not start the run.' })
  const stopBatch = () => act('request', stopBlogBatch, { success: 'Stopping. The post being written will finish first.', failure: 'Could not stop the run.' })
  const closeSummary = () => act('request', closeBlogSummary, { failure: 'Could not close the summary.' })
  const retryTopic = (id) => act(id, () => updateBlogTopic(id, { status: 'queued' }), { success: 'Back in the queue.', failure: 'Could not put that topic back.' })

  if (loading) {
    return (
      <p className="bw-hint bw-row">
        <Spinner /> Loading the queue…
      </p>
    )
  }

  if (!data) return <p className="bw-hint">The queue could not be loaded.</p>

  // `queued` is the page the server sent, `queuedTotal` is how many there are.
  const queued = data.topics
  const queuedTotal = data.counts.queued
  const overridingTotal = data.counts.overriding
  const pending = Boolean(data.activeRequest)
  const batchRunning = Boolean(data.batch.id)

  // Everything finished since the summary was last closed. A row with no
  // timestamp at all counts as OLD, not new.
  const cleared = data.summary.clearedAt ? new Date(data.summary.clearedAt).getTime() : 0
  const sinceClear = (topic) => {
    if (!cleared) return true
    if (!topic.finishedAt) return false
    return new Date(topic.finishedAt).getTime() > cleared
  }
  const written = data.finished.filter((topic) => topic.status === 'done' && sinceClear(topic))
  const skipped = data.finished.filter((topic) => topic.status === 'skipped' && sinceClear(topic))
  const showSummary = written.length + skipped.length > 0 || batchRunning

  return (
    <div className="bw-stack-lg">
      <Card>
        <CardHeader>
          <h3 className="bw-title">Defaults</h3>
          <Hint>Every topic uses these unless it sets its own.</Hint>
        </CardHeader>
        <CardContent className="bw-grid-4">
          <div className="bw-field">
            <Label htmlFor="bw-per-run">Posts per run</Label>
            <Input
              id="bw-per-run"
              type="number"
              min={MIN_PER_RUN}
              max={MAX_PER_RUN}
              value={data.defaults.postsPerRun}
              onChange={(event) => void saveDefaults({ ...data.defaults, postsPerRun: Number(event.target.value) })}
            />
            <Hint>Capped at {MAX_PER_RUN}. Each post is real research, and the third is already weaker than the first.</Hint>
          </div>

          <div className="bw-field">
            <Label htmlFor="bw-images">Images per post</Label>
            <Input
              id="bw-images"
              type="number"
              min={MIN_IMAGES}
              max={MAX_IMAGES}
              value={data.defaults.imageCount}
              onChange={(event) => void saveDefaults({ ...data.defaults, imageCount: Number(event.target.value) })}
            />
            <Hint>The cover counts first, so 3 means a cover plus two in the article. Free Pexels stock.</Hint>
          </div>

          <div className="bw-field">
            <Label htmlFor="bw-words">Length</Label>
            <WordLengthSelect id="bw-words" value={data.defaults.words} onChange={(words) => void saveDefaults({ ...data.defaults, words: words ?? data.defaults.words })} />
            <Hint>A midpoint, not a goal. A short post that says one thing well beats a long one padded to reach a number.</Hint>
          </div>

          <div className="bw-field">
            <Label htmlFor="bw-cta">CTA banner</Label>
            <CtaVariantSelect id="bw-cta" value={data.defaults.ctaVariant} onChange={(variant) => void saveDefaults({ ...data.defaults, ctaVariant: variant })} />
            <Hint>The banner new posts start with, unless a topic picks its own.</Hint>
          </div>

          <div className="bw-field">
            <Label htmlFor="bw-auto-publish">Publish automatically</Label>
            <div className="bw-row bw-switch-row">
              <Switch id="bw-auto-publish" checked={data.defaults.autoPublish} onCheckedChange={(autoPublish) => void saveDefaults({ ...data.defaults, autoPublish })} />
              <span className="bw-text">{data.defaults.autoPublish ? 'On' : 'Off'}</span>
            </div>
            <Hint>
              {data.defaults.autoPublish
                ? 'Posts go live without anyone reading them first — but only if they pass the audit. Anything that fails waits here as a draft.'
                : 'Posts arrive as drafts for you to read and publish.'}
            </Hint>
          </div>
        </CardContent>

        {queuedTotal > 0 ? (
          <CardFooter>
            <Hint>
              {overridingTotal === 0 ? (
                <>
                  All {queuedTotal} queued {queuedTotal === 1 ? 'topic uses' : 'topics use'} these settings. Changes here apply to them straight away.
                </>
              ) : (
                <>
                  {overridingTotal} of {queuedTotal} queued {overridingTotal === 1 ? 'topic has' : 'topics have'} their own settings and ignore these.
                </>
              )}
            </Hint>
            <Button variant="outline" size="sm" disabled={overridingTotal === 0 || busy === 'apply'} busy={busy === 'apply'} onClick={() => void applyDefaults()}>
              Apply to all {queuedTotal}
            </Button>
          </CardFooter>
        ) : null}
      </Card>

      <Card>
        <CardHeader>
          <h3 className="bw-title">Import from a Google Sheet</h3>
          <Hint>
            Reads a content calendar and queues what is left to write. The focus keyword becomes the topic and the headline becomes its note. Rows marked{' '}
            <strong>Done</strong> are skipped, so this is safe to run again whenever the sheet grows.
          </Hint>
        </CardHeader>
        <CardContent className="bw-stack-sm">
          <div className="bw-row-form">
            <Input
              value={sheetUrl}
              onChange={(event) => setSheetUrl(event.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/…"
              onKeyDown={(event) => {
                if (event.key === 'Enter') void importSheet()
              }}
            />
            <Button variant="primary" onClick={() => void importSheet()} disabled={!sheetUrl.trim() || busy === 'sheet'} busy={busy === 'sheet'}>
              {busy === 'sheet' ? null : <Plus size={15} />} Import
            </Button>
          </div>
          <Hint>
            Open the calendar tab first and copy the URL from the address bar — the link carries the tab you were on. The sheet has to be shared as “anyone with the
            link can view”.
          </Hint>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="bw-title">Paste a list</h3>
          <Hint>A column out of a spreadsheet, or one keyword, link or site per line, up to a thousand at a time. They go to the end of the queue in the order given.</Hint>
        </CardHeader>
        <CardContent className="bw-stack-sm">
          <Textarea
            rows={4}
            placeholder={'gohighlevel a2p 10dlc registration\nhow much does white label ghl support cost\ntechcrunch.com'}
            value={bulk}
            onChange={(event) => setBulk(event.target.value)}
          />
          <div>
            <Button onClick={() => void addBulk()} disabled={!bulk.trim() || busy === 'bulk'} busy={busy === 'bulk'}>
              {busy === 'bulk' ? null : <Plus size={15} />} Add all to queue
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="bw-title">Add a topic</h3>
          <Hint>A keyword to rank for, an article URL to write from, or a bare domain to pick a story out of.</Hint>
        </CardHeader>
        <CardContent className="bw-stack-sm">
          <div className="bw-grid-2">
            <Input
              placeholder="e.g. gohighlevel workflow automation for agencies"
              value={newTopic}
              onChange={(event) => setNewTopic(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void addTopic()
              }}
            />
            <Input
              placeholder="Optional: angle, stance, what to emphasise"
              value={newNotes}
              onChange={(event) => setNewNotes(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void addTopic()
              }}
            />
          </div>
          <div>
            <Button variant="primary" onClick={() => void addTopic()} disabled={!newTopic.trim() || busy === 'new'} busy={busy === 'new'}>
              {busy === 'new' ? null : <Plus size={15} />} Add to queue
            </Button>
          </div>
        </CardContent>
      </Card>

      <WriterStatus
        online={data.writer.online}
        lastSeen={data.writer.lastSeen}
        pending={pending}
        queuedCount={queuedTotal}
        schedules={data.schedules}
        busy={busy === 'request'}
        batchRunning={batchRunning}
        onRequest={requestWrite}
        onRequestAll={requestAll}
        onStopBatch={stopBatch}
      />

      {showSummary ? (
        <RunSummary
          written={written}
          skipped={skipped}
          finished={data.summary.finished}
          remaining={queuedTotal}
          running={batchRunning}
          closeable={data.summary.closeable}
          clearedAt={data.summary.clearedAt}
          onClose={() => void closeSummary()}
          onRetry={(id) => void retryTopic(id)}
          busy={busy === 'request'}
        />
      ) : null}

      {data.activeRequest ? <RunProgress request={data.activeRequest} /> : null}

      {!data.activeRequest && data.recentRuns.length > 0 ? (
        <RunHistory runs={data.recentRuns} onDismiss={(id) => void dismissRun(id)} onRetry={(id) => void retryRun(id)} />
      ) : null}

      {/* Only the rows that are anyone's to move: a schedule's own rows for today are not. */}
      <QueueSchedulePlan queuedTotal={queuedTotal - data.counts.scheduled} schedules={data.schedules} onReload={() => load(true)} />

      <div className="bw-stack-sm">
        <h3 className="bw-title">
          Queue {queuedTotal > 0 ? <span className="bw-muted">({queuedTotal})</span> : null}
        </h3>

        {queuedTotal === 0 ? (
          <Empty>Nothing queued. Add a topic above, then ask the writer for it.</Empty>
        ) : (
          <>
            {queuedTotal > queued.length ? (
              <Hint className="bw-note">
                Showing the next {queued.length} of {queuedTotal}. They are written from the top down, so the rest follow in order.
              </Hint>
            ) : null}
            {queued.map((topic, index) => (
              <TopicRow
                key={topic.id}
                topic={topic}
                defaults={data.defaults}
                busy={busy === topic.id}
                isFirst={index === 0}
                isLast={index === queued.length - 1}
                onMove={(direction) => void move(index, direction)}
                onPatch={(body) => void patch(topic.id, body)}
                onRemove={() => void removeTopic(topic.id)}
              />
            ))}
          </>
        )}
      </div>
    </div>
  )
}

/** One queued topic, editable in place. */
function TopicRow({ topic, defaults, busy, isFirst, isLast, onMove, onPatch, onRemove }) {
  const [notes, setNotes] = useState(topic.notes)
  const meta = KIND_META[topic.kind] || KIND_META.keyword
  const Icon = KIND_ICONS[topic.kind] || Search

  return (
    <div className="bw-topic">
      <div className="bw-topic-move">
        <Button variant="icon" disabled={isFirst || busy} onClick={() => onMove(-1)} aria-label="Move up">
          <ArrowUp size={14} />
        </Button>
        <Button variant="icon" disabled={isLast || busy} onClick={() => onMove(1)} aria-label="Move down">
          <ArrowDown size={14} />
        </Button>
      </div>

      <div className="bw-grow bw-stack-sm">
        <div className="bw-row bw-wrap">
          <span className="bw-text bw-strong bw-break">{topic.topic}</span>
          <Badge tone="muted">
            <Icon size={12} /> {meta.label}
          </Badge>
          {topic.scheduleName ? (
            <Badge tone="outline">
              <CalendarClock size={12} /> {topic.scheduleName} · today
            </Badge>
          ) : null}
        </div>
        <Hint>{meta.hint}</Hint>

        <Input
          value={notes}
          placeholder="Angle, stance, what to emphasise"
          onChange={(event) => setNotes(event.target.value)}
          // Saved on blur rather than per keystroke: notes are edited in bursts.
          onBlur={() => {
            if (notes !== topic.notes) onPatch({ notes })
          }}
        />

        <div className="bw-row bw-wrap bw-gap-lg">
          <div className="bw-row">
            <Label htmlFor={`bw-img-${topic.id}`} className="bw-label-inline">
              Images
            </Label>
            <Input
              id={`bw-img-${topic.id}`}
              type="number"
              min={MIN_IMAGES}
              max={MAX_IMAGES}
              className="bw-input-sm bw-w-20"
              placeholder={String(defaults.imageCount)}
              value={topic.imageCount ?? ''}
              onChange={(event) => onPatch({ imageCount: event.target.value === '' ? null : Number(event.target.value) })}
            />
            {topic.imageCount === null ? <span className="bw-hint">default</span> : null}
          </div>

          <div className="bw-row">
            <Label htmlFor={`bw-words-${topic.id}`} className="bw-label-inline">
              Length
            </Label>
            <WordLengthSelect
              id={`bw-words-${topic.id}`}
              value={topic.words}
              onChange={(words) => onPatch({ words })}
              inherit
              inheritLabel={`${defaults.words.toLocaleString()} words`}
              className="bw-input-sm"
            />
          </div>

          <div className="bw-row bw-grow-min">
            <Label className="bw-label-inline">CTA</Label>
            <CtaVariantSelect value={topic.ctaVariant} onChange={(variant) => onPatch({ ctaVariant: variant })} inherit inheritLabel={defaults.ctaVariant} className="bw-input-sm" />
          </div>
        </div>
      </div>

      <Button variant="icon" className="bw-danger" disabled={busy} onClick={onRemove} aria-label="Remove topic" busy={busy}>
        {busy ? null : <Trash2 size={15} />}
      </Button>
    </div>
  )
}

/**
 * Hand the whole queue to a schedule. A move, not a copy, and the screen being
 * empty afterwards is the point. Each row keeps the length, images and banner
 * it was set up with.
 */
function QueueSchedulePlan({ queuedTotal, schedules, onReload }) {
  const toast = useToast()
  // Only keyword schedules can take a backlog.
  const targets = schedules.filter((schedule) => schedule.mode === 'queue')
  // Defaults to the keyword schedule that already exists, when there is one.
  const [target, setTarget] = useState(targets[0]?.id ?? '')
  const [perDay, setPerDay] = useState(DEFAULT_PER_DAY)
  const [time, setTime] = useState(DEFAULT_TIME)
  const [busy, setBusy] = useState(false)

  async function transfer() {
    setBusy(true)
    try {
      const { data: json, error } = await transferBlogQueue(
        target
          ? { scheduleId: target }
          : {
              postsPerDay: perDay,
              time,
              // The browser's own zone: "07:00" means seven where the person choosing it lives.
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE,
            },
      )
      if (error) throw error
      const left = json?.remaining ? `, ${json.remaining} left behind because the schedule is full` : ''
      toast.success(`Moved ${json?.moved ?? 0} topics to the schedule${left}.`)
      await onReload()
    } catch (error) {
      toast.error(error.message || 'Could not transfer the queue.')
    } finally {
      setBusy(false)
    }
  }

  if (queuedTotal === 0) return null

  return (
    <Card>
      <CardHeader>
        <h3 className="bw-title">
          {queuedTotal} {queuedTotal === 1 ? 'topic is' : 'topics are'} waiting
        </h3>
        <Hint>
          Move the whole queue to a schedule and let it publish a few a day. The topics leave this screen — the schedule holds them from then on, and writes them off
          the top each morning.
        </Hint>
      </CardHeader>
      <CardContent className="bw-stack-sm">
        <div className="bw-row bw-wrap bw-align-end">
          {targets.length > 0 ? (
            <div className="bw-field">
              <Label htmlFor="bw-transfer-target">Into</Label>
              <Select id="bw-transfer-target" value={target} onChange={(event) => setTarget(event.target.value)}>
                <option value="">A new schedule</option>
                {targets.map((schedule) => (
                  <option key={schedule.id} value={schedule.id}>
                    {schedule.name}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}

          {!target ? (
            <>
              <div className="bw-field">
                <Label htmlFor="bw-queue-per-day">Posts a day</Label>
                <Input id="bw-queue-per-day" type="number" className="bw-w-24" min={MIN_PER_DAY} max={MAX_PER_DAY} value={perDay} onChange={(event) => setPerDay(Number(event.target.value))} />
              </div>
              <div className="bw-field">
                <Label htmlFor="bw-queue-time">Starting at</Label>
                <Input id="bw-queue-time" type="time" className="bw-w-32" value={time} onChange={(event) => setTime(event.target.value)} />
              </div>
            </>
          ) : null}

          <Button variant="primary" disabled={busy || (!target && (perDay < MIN_PER_DAY || perDay > MAX_PER_DAY))} busy={busy} onClick={() => void transfer()}>
            {busy ? null : <CalendarClock size={15} />} Transfer all {queuedTotal} to a schedule
          </Button>
        </div>

        <Hint>
          {target ? "Added to the end of that schedule's list, in this order." : `${projectFinish(queuedTotal, perDay)}.`} Each topic keeps its own length, images and
          banner. This queue will be empty afterwards — the list lives on the Blog Schedules page, where you can page through it, change the rate, or switch it off.
        </Hint>
      </CardContent>
    </Card>
  )
}
