'use client'

import { AlertCircle, CalendarClock, Check, PauseCircle, RotateCw, X } from 'lucide-react'
import {
  FAILURE_LABELS,
  RUN_PHASES,
  RUN_PHASE_LABELS,
  compactTokens,
  costDetail,
  costSummary,
  relativeFuture,
  relativeTime,
  totalTokens,
  visibleBatchRows,
  batchIsVisible,
} from '../../lib/blogWriterRules'
import { Badge, Button, Card, CardContent, CardHeader, Spinner } from './ui'
import { cn } from './hooks'

// What the writer is doing, shared by both screens that need to say so. The
// AI Blog Writer shows it because someone just pressed a button; Scheduled
// Blogs shows it because a run may have started without anyone pressing
// anything.

/**
 * What the run is doing, step by step. Every line comes from a tool the
 * writer actually called. There is deliberately no percentage and no bar:
 * nothing here knows how long a piece of research will take. The whole
 * sequence is drawn at once, with what has not happened yet greyed out.
 */
export function RunProgress({ request }) {
  const reached = new Map(request.steps.map((step) => [step.phase, step]))
  const currentIndex = RUN_PHASES.indexOf(request.phase)
  const started = request.startedAt ?? request.createdAt

  // A paused run is still the active run, and must not look like a working one.
  const paused = request.status === 'waiting'

  return (
    <Card>
      <CardHeader>
        <div className="bw-row bw-between">
          <h3 className="bw-title">
            {paused ? <PauseCircle size={16} className="bw-amber" /> : <Spinner size={16} />}
            {paused ? 'Paused, will continue on its own' : 'Writing a post'}
          </h3>
          <span className="bw-hint">
            {request.requestedBy.startsWith('schedule') ? 'Scheduled run' : 'Started'} {relativeTime(started)}
          </span>
        </div>
        {request.topicLabel ? <p className="bw-hint bw-truncate">{request.topicLabel}</p> : null}
        {paused ? (
          <p className="bw-hint bw-amber">
            {request.failureKind === 'limit'
              ? 'The Claude usage limit was reached.'
              : request.failureKind === 'timeout'
                ? 'The last attempt timed out.'
                : 'The writer was interrupted.'}{' '}
            {request.retryAfter ? `Trying again ${relativeFuture(request.retryAfter)}.` : 'Trying again shortly.'} Nothing to do — it picks
            itself back up.
          </p>
        ) : null}
      </CardHeader>
      <CardContent>
        <ol className="bw-phases">
          {RUN_PHASES.filter((phase) => phase !== 'done').map((phase, index) => {
            const step = reached.get(phase)
            const isCurrent = phase === request.phase
            // A phase can be skipped, so "before the current one" is what counts as done.
            const isPast = index < currentIndex
            const detail = isCurrent ? request.detail : (step?.detail ?? '')
            return (
              <li key={phase} className={cn('bw-phase', isCurrent && 'is-current', isPast && 'is-past', !isCurrent && !isPast && 'is-future')}>
                <span className="bw-phase-icon" aria-hidden="true">
                  {isPast ? <Check size={15} /> : isCurrent ? <Spinner size={15} /> : <span className="bw-dot" />}
                </span>
                <span>
                  {RUN_PHASE_LABELS[phase]}
                  {detail ? <span className="bw-hint"> — {detail}</span> : null}
                </span>
              </li>
            )
          })}
        </ol>
        <p className="bw-hint bw-mt">A post takes a few minutes. You can leave this page; it carries on without you.</p>
      </CardContent>
    </Card>
  )
}

/**
 * The last few runs, whether or not they produced anything. A failed run
 * leaves nothing in the blog list, so without this the only evidence of it is
 * its absence.
 */
export function RunHistory({ runs, onDismiss, onRetry }) {
  return (
    <div className="bw-stack-sm">
      <h3 className="bw-subtitle">Recent runs</h3>
      <div className="bw-list">
        {runs.map((run) => (
          <div key={run.id} className="bw-list-row bw-align-start">
            <div className="bw-grow bw-stack-xs">
              <p className="bw-row bw-text">
                {run.status === 'done' ? <Check size={14} className="bw-emerald" /> : <AlertCircle size={14} className="bw-amber" />}
                {run.status === 'done' ? run.blogSlug || 'Finished' : FAILURE_LABELS[run.failureKind] || 'Failed'}
                {run.requestedBy.startsWith('schedule') ? <Badge tone="muted">scheduled</Badge> : null}
              </p>
              {run.topicLabel ? <p className="bw-hint bw-truncate">{run.topicLabel}</p> : null}
              {run.usage ? (
                <p className="bw-mono bw-hint" title={costDetail(run.usage)}>
                  {costSummary(run.usage)}
                </p>
              ) : null}
              {run.error ? <pre className="bw-error-tail">{run.error}</pre> : null}
            </div>
            <div className="bw-row bw-shrink">
              <span className="bw-hint">{relativeTime(run.finishedAt)}</span>
              {onRetry && run.status === 'failed' ? (
                <Button variant="ghost" size="sm" onClick={() => onRetry(run.id)}>
                  <RotateCw size={14} /> Retry
                </Button>
              ) : null}
              {onDismiss ? (
                <Button variant="icon" onClick={() => onDismiss(run.id)} aria-label="Dismiss this run">
                  <X size={14} />
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Whether anything is actually listening, and the button that depends on it.
 * Prominent by design: the machine sleeps, the watcher stops, and the button
 * would otherwise keep accepting clicks that nothing will ever read.
 */
export function WriterStatus({ online, lastSeen, pending, queuedCount, schedules, busy = false, batchRunning = false, onRequest, onRequestAll, onStopBatch }) {
  // A run in progress outranks the heartbeat.
  const state = pending ? 'writing' : online ? 'online' : 'offline'
  const running = schedules.filter((schedule) => schedule.enabled)

  const label = state === 'writing' ? 'Writing a post' : state === 'online' ? 'Writer online' : 'Writer offline'
  const explanation =
    state === 'writing'
      ? 'This takes a few minutes. The draft appears under Blog when it is finished.'
      : state === 'online'
        ? 'Posts are written on the machine running Claude Code and arrive here as drafts.'
        : 'Nothing is listening, so the button is disabled. Start the writer on the machine running Claude Code.'

  return (
    <div className={cn('bw-status', state === 'offline' ? 'is-offline' : 'is-online')}>
      <div className="bw-stack-xs">
        <div className="bw-row">
          <span aria-hidden="true" className={cn('bw-status-dot', state === 'writing' && 'is-pulsing')} />
          <span className="bw-text bw-strong">{label}</span>
          {state !== 'writing' ? <span className="bw-hint">last seen {relativeTime(lastSeen)}</span> : null}
        </div>
        <p className="bw-hint">{explanation}</p>
        {running.length > 0 ? (
          <p className="bw-hint bw-row">
            <CalendarClock size={12} />
            Also runs {running.map((schedule) => `${schedule.name} at ${schedule.time}`).join(', ')}
          </p>
        ) : null}
      </div>

      {onRequest ? (
        <div className="bw-row">
          {batchRunning ? (
            <Button variant="outline" onClick={onStopBatch} disabled={busy} busy={busy}>
              Stop after this post
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={onRequest} disabled={!online || pending || queuedCount === 0 || busy}>
                {pending ? 'Writing…' : 'Write next post'}
              </Button>
              {onRequestAll && queuedCount > 1 ? (
                <Button variant="primary" onClick={onRequestAll} disabled={!online || pending || queuedCount === 0 || busy} busy={busy}>
                  Write all {queuedCount}
                </Button>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* A batch, post by post                                                      */
/* -------------------------------------------------------------------------- */


/**
 * Today's batch as a list: what is written, what is being written, what is
 * waiting, what is still to come — with what each one cost. For an upcoming
 * batch, the rows are what it will write and the header says when.
 */
export function BatchProgress({ batch, clearedAt, onClose, onStop, busy = false, upcoming }) {
  const rows = upcoming ? batch.rows : visibleBatchRows(batch, clearedAt)
  const running = Boolean(batch.id)
  if (!upcoming && !batchIsVisible(batch, clearedAt)) return null
  if (upcoming && rows.length === 0) return null

  const done = rows.filter((row) => row.status === 'done')
  const total = batch.total || batch.rows.length
  const spent = done.reduce((sum, row) => sum + (row.usage?.costUsd ?? 0), 0)
  const tokens = done.reduce((sum, row) => sum + (row.usage ? totalTokens(row.usage) : 0), 0)
  const title = upcoming ? 'Next batch' : batch.scheduleName ? `${batch.scheduleName} — today's batch` : 'This batch'

  return (
    <Card className="bw-batch">
      <CardHeader>
        <div className="bw-row bw-between">
          <div className="bw-title">
            {upcoming ? <CalendarClock size={16} className="bw-muted" /> : running ? <Spinner size={16} /> : <Check size={16} className="bw-emerald" />}
            {title}
          </div>
          <div className="bw-row">
            <span className="bw-hint bw-tabular">
              {upcoming ? `${total} post${total === 1 ? '' : 's'} · runs daily at ${upcoming.runsAt}` : `${done.length} of ${total} done`}
              {!upcoming && spent > 0 ? ` · ${compactTokens(tokens)} tokens · $${spent.toFixed(2)}` : ''}
              {!upcoming && batch.startedAt ? ` · started ${relativeTime(batch.startedAt)}` : ''}
            </span>
            {onStop && running ? (
              <Button variant="outline" size="sm" disabled={busy} onClick={onStop}>
                Stop after this post
              </Button>
            ) : null}
            {onClose ? (
              <Button variant="icon" disabled={busy} onClick={onClose} aria-label="Close this batch">
                <X size={14} />
              </Button>
            ) : null}
          </div>
        </div>
        {!upcoming && total > 0 ? (
          <div className="bw-bar">
            <div className="bw-bar-fill" style={{ width: `${Math.min(100, Math.round((done.length / total) * 100))}%` }} />
          </div>
        ) : null}
      </CardHeader>
      <CardContent>
        <ol className="bw-list">
          {rows.map((row, index) => (
            <li key={row.id} className="bw-list-row bw-align-start">
              <span className="bw-index">{index + 1}</span>
              <span className="bw-shrink bw-row-icon">
                <BatchRowIcon status={row.status} />
              </span>
              <div className="bw-grow bw-stack-xs">
                <p className="bw-text bw-truncate">{row.topic || '(untitled)'}</p>
                <p className="bw-hint bw-truncate" title={row.usage ? costDetail(row.usage) : undefined}>
                  <BatchRowLine row={row} />
                </p>
              </div>
              {row.status === 'done' && row.blogSlug ? (
                <span className="bw-row bw-shrink">
                  {row.postStatus ? <Badge tone={row.postStatus === 'published' ? 'live' : 'muted'}>{row.postStatus === 'published' ? 'live' : row.postStatus}</Badge> : null}
                  <a href={`/blog/${row.blogSlug}`} target="_blank" rel="noreferrer" className="bw-link">
                    View post
                  </a>
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  )
}

function BatchRowIcon({ status }) {
  switch (status) {
    case 'done':
      return <Check size={14} className="bw-emerald" />
    case 'failed':
      return <AlertCircle size={14} className="bw-amber" />
    case 'running':
    case 'pending':
      return <Spinner size={14} />
    case 'waiting':
      return <PauseCircle size={14} className="bw-amber" />
    default:
      return <span className="bw-ring" />
  }
}

/** The one line under a row that says where it is. */
function BatchRowLine({ row }) {
  switch (row.status) {
    case 'done':
      return <>{row.usage ? costSummary(row.usage) : 'written'}</>
    case 'failed':
      return <>{FAILURE_LABELS[row.failureKind] || 'Failed'}</>
    case 'running':
      return <>writing… {row.detail}</>
    case 'pending':
      return <>starting…</>
    case 'waiting':
      return (
        <>
          {row.failureKind === 'limit' ? 'waiting for the Claude usage limit' : 'waiting to retry'}
          {row.retryAfter ? ` · resumes ${relativeFuture(row.retryAfter)}` : ''}
        </>
      )
    default:
      return <>queued</>
  }
}
