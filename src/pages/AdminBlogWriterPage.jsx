'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ExternalLink, Play, Plus, RefreshCw, Square, Trash2, X } from 'lucide-react'
import AdminShell from '../components/AdminShell'
import { getSession, signOut } from '../lib/auth'
import {
  createBlogTopic,
  deleteBlogTopic,
  dismissBlogRun,
  fetchBlogWriterState,
  requestBlogWrite,
  retryBlogRun,
  saveBlogDefaults,
  stopBlogBatch,
} from '../lib/blogWriterApi'
import '../styles/admin-extras.css'

const STATE_POLL_MS = 10_000

// Mirrors GHL-Prime-Backend's src/modules/blog-writer/lib/cta-variants.ts —
// that file is the source of truth; kept here only as the dropdown's option
// list since the two repos don't share code.
const CTA_VARIANTS = [
  { id: 'none', label: 'No banner' },
  { id: 'general', label: 'Hire a dedicated GoHighLevel team' },
  { id: 'automation', label: 'Want this automated?' },
  { id: 'support', label: 'Need a team who handles this?' },
  { id: 'ai_agents', label: 'Curious what an AI agent could do here?' },
]

function StatusBadge({ writer, activeRequest }) {
  if (!writer) return null

  let label = 'Offline'
  let variant = 'offline'
  if (writer.online) {
    if (activeRequest?.status === 'running') {
      label = 'Writing now'
      variant = 'online'
    } else if (activeRequest?.status === 'waiting') {
      label = 'Paused (usage limit)'
      variant = 'paused'
    } else {
      label = 'Online'
      variant = 'online'
    }
  }

  return (
    <span className={`admin-blog-status-badge ${variant}`}>
      <span className="status-dot" aria-hidden="true" />
      {label}
    </span>
  )
}

function PhaseList({ steps, phase }) {
  const ALL = ['reading_standard', 'researching', 'writing', 'auditing', 'images', 'saving']
  const LABELS = {
    reading_standard: 'Standard',
    researching: 'Research',
    writing: 'Writing',
    auditing: 'Audit',
    images: 'Images',
    saving: 'Saving',
  }
  const doneSet = new Set((Array.isArray(steps) ? steps : []).map((s) => s.phase))

  return (
    <div className="admin-run-progress">
      {ALL.map((p) => (
        <span
          key={p}
          className={`admin-run-step ${p === phase ? 'is-active' : ''} ${doneSet.has(p) && p !== phase ? 'is-done' : ''}`}
        >
          {LABELS[p]}
        </span>
      ))}
    </div>
  )
}

const RUN_STATUS_LABELS = {
  pending: 'Waiting for the watcher',
  running: 'Writing now',
  waiting: 'Paused, will retry automatically',
  done: 'Done',
  failed: 'Failed',
}

function formatDate(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function AdminBlogWriterPage() {
  const [session, setSession] = useState(undefined)
  const [state, setState] = useState(null)
  const [newTopicTitle, setNewTopicTitle] = useState('')
  const [newTopicNotes, setNewTopicNotes] = useState('')
  const [adHocTitle, setAdHocTitle] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const refreshState = useCallback(async () => {
    const { data } = await fetchBlogWriterState()
    if (data) setState(data)
  }, [])

  useEffect(() => {
    getSession().then(setSession)
    refreshState()
  }, [refreshState])

  // A single endpoint now covers topics, the active run, and recent runs, so
  // one poll loop replaces the old separate status/requests timers.
  useEffect(() => {
    const timer = setInterval(refreshState, STATE_POLL_MS)
    return () => clearInterval(timer)
  }, [refreshState])

  async function handleSignOut() {
    await signOut()
    setSession(null)
  }

  async function handleAddTopic(e) {
    e.preventDefault()
    if (!newTopicTitle.trim()) return
    setBusy(true)
    const { error } = await createBlogTopic({
      topic: newTopicTitle.trim(),
      notes: newTopicNotes.trim() || undefined,
    })
    setBusy(false)
    if (error) {
      setMessage(`Could not add topic: ${error.message}`)
      return
    }
    setNewTopicTitle('')
    setNewTopicNotes('')
    await refreshState()
  }

  async function handleDeleteTopic(id) {
    setBusy(true)
    const { error } = await deleteBlogTopic(id)
    setBusy(false)
    if (error) {
      setMessage(`Could not delete topic: ${error.message}`)
      return
    }
    await refreshState()
  }

  async function handleWriteFromTopic(topicId) {
    setBusy(true)
    const { error } = await requestBlogWrite({ topicId })
    setBusy(false)
    if (error) {
      setMessage(`Could not queue that topic: ${error.message}`)
      return
    }
    setMessage('Queued — the watcher will pick it up on its next poll.')
    await refreshState()
  }

  // There is no "write this exact text right now" route on the backend —
  // only a topic id can be requested. Typing ad hoc text creates a topic
  // first, then immediately requests a write for the new topic's id, which
  // gives the same "type something, get it written now" result the old UI
  // promised without inventing an endpoint that doesn't exist.
  async function queueAdHoc() {
    if (!adHocTitle.trim()) return
    setBusy(true)
    const { data, error } = await createBlogTopic({ topic: adHocTitle.trim() })
    if (error) {
      setBusy(false)
      setMessage(`Could not queue that: ${error.message}`)
      return
    }
    const { error: writeError } = await requestBlogWrite({ topicId: data.id })
    setBusy(false)
    if (writeError) {
      setMessage(`Added to the queue, but could not start it: ${writeError.message}`)
      await refreshState()
      return
    }
    setAdHocTitle('')
    setMessage('Queued — the watcher will pick it up on its next poll.')
    await refreshState()
  }

  async function handleAdHocWrite(e) {
    e.preventDefault()
    await queueAdHoc()
  }

  async function handleRetry(id) {
    setBusy(true)
    const { error } = await retryBlogRun(id)
    setBusy(false)
    if (error) {
      setMessage(`Could not retry: ${error.message}`)
      return
    }
    await refreshState()
  }

  async function handleDismiss(id) {
    setBusy(true)
    const { error } = await dismissBlogRun(id)
    setBusy(false)
    if (error) {
      setMessage(`Could not dismiss: ${error.message}`)
      return
    }
    await refreshState()
  }

  async function handleStopBatch() {
    setBusy(true)
    await stopBlogBatch()
    setBusy(false)
    setMessage('Batch stopped — the post being written now will finish; nothing after it will start.')
    await refreshState()
  }

  /** The one obvious button: whatever's typed into the ad-hoc box wins if
   * present, otherwise it requests the front of the topic queue. */
  async function handleRunNow() {
    if (adHocTitle.trim()) {
      await queueAdHoc()
      return
    }
    if (state?.topics?.length) {
      await handleWriteFromTopic(state.topics[0].id)
      return
    }
    setMessage('Nothing to run yet — type something above or add a topic to the queue first.')
  }

  async function handleDefaultsChange(field, value) {
    if (!state?.defaults) return
    const next = { ...state.defaults, [field]: value }
    setState((s) => ({ ...s, defaults: next }))
    // The backend's defaultsSchema requires every field on each save.
    const { error } = await saveBlogDefaults(next)
    if (error) setMessage(`Could not save defaults: ${error.message}`)
  }

  const topics = state?.topics || []
  const activeRequest = state?.activeRequest || null
  const recentRuns = state?.recentRuns || []
  const defaults = state?.defaults || null
  const batch = state?.batch

  return (
    <AdminShell session={session} onSignOut={handleSignOut}>
      <div className="blog-writer-topbar">
        <div>
          <h2>Blog Writer</h2>
          <span className="admin-list-meta">AI blog publishing via your Claude subscription — no metered API billing</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <StatusBadge writer={state?.writer} activeRequest={activeRequest} />
          <button type="button" className="primary-pill" onClick={handleRunNow} disabled={busy}>
            <Play size={16} /> Run Now
          </button>
          {batch?.id ? (
            <button type="button" className="team-edit-btn" onClick={handleStopBatch} disabled={busy}>
              <Square size={14} /> Stop batch
            </button>
          ) : null}
        </div>
      </div>

      {message ? (
        <p className="admin-list-meta" style={{ marginBottom: '1rem' }}>{message}</p>
      ) : null}

      <div className="blog-writer-section">
        <h3>Write something right now</h3>
        <form className="blog-writer-inline-form" onSubmit={handleAdHocWrite}>
          <input
            type="text"
            placeholder="Write about..."
            value={adHocTitle}
            onChange={(e) => setAdHocTitle(e.target.value)}
          />
          <button type="submit" className="primary-pill" disabled={busy || !adHocTitle.trim()}>
            <Plus size={16} /> Write next post
          </button>
        </form>
      </div>

      {activeRequest ? (
        <div className="blog-writer-section">
          <h3>Currently writing</h3>
          <div className="blog-writer-queue-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <div className="grow">
              <strong>{activeRequest.topicLabel || 'Untitled'}</strong>
              <span>{RUN_STATUS_LABELS[activeRequest.status] || activeRequest.status}{activeRequest.detail ? ` · ${activeRequest.detail}` : ''}</span>
            </div>
            <PhaseList steps={activeRequest.steps} phase={activeRequest.phase} />
          </div>
        </div>
      ) : null}

      <div className="blog-writer-section">
        <h3>Topic queue ({topics.length})</h3>
        <form className="blog-writer-inline-form" onSubmit={handleAddTopic}>
          <input
            type="text"
            placeholder="Topic"
            value={newTopicTitle}
            onChange={(e) => setNewTopicTitle(e.target.value)}
          />
          <input
            type="text"
            placeholder="Notes (optional)"
            value={newTopicNotes}
            onChange={(e) => setNewTopicNotes(e.target.value)}
          />
          <button type="submit" className="team-edit-btn" disabled={busy || !newTopicTitle.trim()}>
            <Plus size={14} /> Add to queue
          </button>
        </form>

        {topics.length ? (
          topics.map((topic) => (
            <div className="blog-writer-queue-row" key={topic.id}>
              <div className="grow">
                <strong>{topic.topic}</strong>
                <span>{topic.notes || 'No notes'}{topic.scheduleName ? ` · from schedule "${topic.scheduleName}"` : ''}</span>
              </div>
              <button
                type="button"
                className="team-edit-btn"
                onClick={() => handleWriteFromTopic(topic.id)}
                disabled={busy || Boolean(activeRequest)}
              >
                Write next post
              </button>
              <button type="button" className="team-edit-btn danger" onClick={() => handleDeleteTopic(topic.id)} disabled={busy}>
                <Trash2 size={14} />
              </button>
            </div>
          ))
        ) : (
          <p className="blog-writer-empty">No topics queued. Add one above, or set up a recurring schedule.</p>
        )}
      </div>

      <div className="blog-writer-section">
        <h3>Recent runs</h3>
        {recentRuns.length ? (
          recentRuns.map((run) => (
            <div className="blog-writer-queue-row" key={run.id} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div className="grow">
                  <strong>{run.topicLabel || 'Untitled'}</strong>
                  <span>{RUN_STATUS_LABELS[run.status] || run.status}{run.finishedAt ? ` · ${formatDate(run.finishedAt)}` : ''}{run.error ? ` · ${run.error}` : ''}</span>
                </div>
                {run.blogSlug ? (
                  <Link href={`/blog/${run.blogSlug}`} className="text-link admin-open-link" target="_blank">
                    View post <ExternalLink size={13} />
                  </Link>
                ) : null}
                {run.status === 'failed' ? (
                  <button type="button" className="team-edit-btn" onClick={() => handleRetry(run.id)} disabled={busy}>
                    <RefreshCw size={14} /> Retry
                  </button>
                ) : null}
                <button type="button" className="team-edit-btn" onClick={() => handleDismiss(run.id)} disabled={busy} title="Dismiss">
                  <X size={14} />
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="blog-writer-empty">No runs yet.</p>
        )}
      </div>

      {defaults ? (
        <div className="blog-writer-section">
          <h3>Queue defaults</h3>
          <span className="admin-list-meta" style={{ display: 'block', marginBottom: '0.9rem' }}>
            Applied to any queued topic that doesn't override it itself.
          </span>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.9rem' }}>
            <input
              type="checkbox"
              checked={defaults.autoPublish}
              onChange={(e) => handleDefaultsChange('autoPublish', e.target.checked)}
            />
            Auto-publish when the audit passes (otherwise every post saves as a draft for review)
          </label>
          <div className="blog-writer-inline-form">
            <label style={{ flex: '1 1 140px' }}>
              Posts per run
              <input
                type="number"
                min="1"
                value={defaults.postsPerRun}
                onChange={(e) => setState((s) => ({ ...s, defaults: { ...s.defaults, postsPerRun: Number(e.target.value) } }))}
                onBlur={(e) => handleDefaultsChange('postsPerRun', Number(e.target.value))}
              />
            </label>
            <label style={{ flex: '1 1 140px' }}>
              Images per post
              <input
                type="number"
                min="0"
                value={defaults.imageCount}
                onChange={(e) => setState((s) => ({ ...s, defaults: { ...s.defaults, imageCount: Number(e.target.value) } }))}
                onBlur={(e) => handleDefaultsChange('imageCount', Number(e.target.value))}
              />
            </label>
            <label style={{ flex: '1 1 140px' }}>
              Words per post
              <input
                type="number"
                min="0"
                value={defaults.words}
                onChange={(e) => setState((s) => ({ ...s, defaults: { ...s.defaults, words: Number(e.target.value) } }))}
                onBlur={(e) => handleDefaultsChange('words', Number(e.target.value))}
              />
            </label>
            <label style={{ flex: '1 1 220px' }}>
              CTA banner
              <select
                value={defaults.ctaVariant}
                onChange={(e) => handleDefaultsChange('ctaVariant', e.target.value)}
              >
                {CTA_VARIANTS.map((v) => (
                  <option key={v.id} value={v.id}>{v.label}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
      ) : null}
    </AdminShell>
  )
}
