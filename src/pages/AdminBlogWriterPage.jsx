'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ExternalLink, Play, Plus, RefreshCw, Square, Trash2 } from 'lucide-react'
import AdminShell from '../components/AdminShell'
import { getSession, signOut } from '../lib/auth'
import {
  createBlogTopic,
  createBlogWriteRequest,
  deleteBlogTopic,
  fetchBlogTopics,
  fetchBlogWriteRequests,
  fetchBlogWriterSettings,
  fetchBlogWriterStatus,
  retryBlogWriteRequest,
  stopBlogWriterQueue,
  updateBlogWriterSettings,
} from '../lib/blogWriterApi'
import '../styles/admin-extras.css'

const STATUS_POLL_MS = 15_000
const REQUESTS_POLL_MS = 10_000

function StatusBadge({ status }) {
  if (!status) return null

  let label = 'Offline'
  let variant = 'offline'
  if (status.online) {
    if (status.running_count > 0) {
      label = 'Writing now'
      variant = 'online'
    } else if (status.waiting_count > 0) {
      label = 'Paused'
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

const STATUS_LABELS = {
  pending: 'Waiting for the watcher',
  running: 'Writing now',
  waiting: 'Paused, will retry automatically',
  completed: 'Done',
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
  const [status, setStatus] = useState(null)
  const [topics, setTopics] = useState([])
  const [requests, setRequests] = useState([])
  const [settings, setSettings] = useState(null)
  const [newTopicTitle, setNewTopicTitle] = useState('')
  const [newTopicKeyword, setNewTopicKeyword] = useState('')
  const [adHocTitle, setAdHocTitle] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const refreshStatus = useCallback(async () => {
    const { data } = await fetchBlogWriterStatus()
    if (data) setStatus(data)
  }, [])

  const refreshTopics = useCallback(async () => {
    const { data } = await fetchBlogTopics()
    setTopics(data)
  }, [])

  const refreshRequests = useCallback(async () => {
    const { data } = await fetchBlogWriteRequests({ limit: 20 })
    setRequests(data)
  }, [])

  useEffect(() => {
    getSession().then(setSession)
    fetchBlogWriterSettings().then(({ data }) => setSettings(data))
    fetchBlogWriterStatus().then(({ data }) => data && setStatus(data))
    fetchBlogTopics().then(({ data }) => setTopics(data))
    fetchBlogWriteRequests({ limit: 20 }).then(({ data }) => setRequests(data))
  }, [])

  // Live-ish polling: fast enough that a phase actually advancing on screen
  // feels real, slow enough it's not hammering the API from an open tab.
  useEffect(() => {
    const statusTimer = setInterval(refreshStatus, STATUS_POLL_MS)
    const requestsTimer = setInterval(refreshRequests, REQUESTS_POLL_MS)
    return () => {
      clearInterval(statusTimer)
      clearInterval(requestsTimer)
    }
  }, [refreshStatus, refreshRequests])

  async function handleSignOut() {
    await signOut()
    setSession(null)
  }

  async function handleAddTopic(e) {
    e.preventDefault()
    if (!newTopicTitle.trim()) return
    setBusy(true)
    const { error } = await createBlogTopic({
      title: newTopicTitle.trim(),
      target_keyword: newTopicKeyword.trim() || undefined,
    })
    setBusy(false)
    if (error) {
      setMessage(`Could not add topic: ${error.message}`)
      return
    }
    setNewTopicTitle('')
    setNewTopicKeyword('')
    await refreshTopics()
  }

  async function handleDeleteTopic(id) {
    setBusy(true)
    const { error } = await deleteBlogTopic(id)
    setBusy(false)
    if (error) {
      setMessage(`Could not delete topic: ${error.message}`)
      return
    }
    await refreshTopics()
  }

  async function handleWriteFromTopic(topicId) {
    setBusy(true)
    const { error } = await createBlogWriteRequest({ topic_id: topicId })
    setBusy(false)
    if (error) {
      setMessage(`Could not queue that topic: ${error.message}`)
      return
    }
    setMessage('Queued — the watcher will pick it up on its next poll.')
    await Promise.all([refreshTopics(), refreshRequests()])
  }

  async function queueAdHoc() {
    if (!adHocTitle.trim()) return
    setBusy(true)
    const { error } = await createBlogWriteRequest({ ad_hoc_title: adHocTitle.trim() })
    setBusy(false)
    if (error) {
      setMessage(`Could not queue that: ${error.message}`)
      return
    }
    setAdHocTitle('')
    setMessage('Queued — the watcher will pick it up on its next poll.')
    await refreshRequests()
  }

  async function handleAdHocWrite(e) {
    e.preventDefault()
    await queueAdHoc()
  }

  async function handleRetry(id) {
    setBusy(true)
    const { error } = await retryBlogWriteRequest(id)
    setBusy(false)
    if (error) {
      setMessage(`Could not retry: ${error.message}`)
      return
    }
    await refreshRequests()
  }

  async function handleStop() {
    setBusy(true)
    await stopBlogWriterQueue()
    setBusy(false)
    setMessage('Stop requested — the post in progress will finish, the next one will wait for a normal poll.')
  }

  /**
   * The one obvious button: whatever's typed into the ad-hoc box wins if
   * present, otherwise it runs the front of the topic queue. Only disabled
   * when neither exists — there's nothing to run yet.
   */
  async function handleRunNow() {
    const nextTopic = topics.find((t) => t.status === 'pending' || t.status === 'queued')

    if (adHocTitle.trim()) {
      await queueAdHoc()
      return
    }
    if (nextTopic) {
      await handleWriteFromTopic(nextTopic.id)
      return
    }
    setMessage('Nothing to run yet — type something above or add a topic to the queue first.')
  }

  async function handleSettingsChange(field, value) {
    const next = { ...settings, [field]: value }
    setSettings(next)
    const { error } = await updateBlogWriterSettings({ [field]: value })
    if (error) setMessage(`Could not save settings: ${error.message}`)
  }

  const pendingTopics = topics.filter((t) => t.status === 'pending' || t.status === 'queued')

  return (
    <AdminShell session={session} onSignOut={handleSignOut}>
      <div className="blog-writer-topbar">
        <div>
          <h2>Blog Writer</h2>
          <span className="admin-list-meta">AI blog publishing via your Claude subscription — no metered API billing</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <StatusBadge status={status} />
          <button type="button" className="primary-pill" onClick={handleRunNow} disabled={busy}>
            <Play size={16} /> Run Now
          </button>
          <button type="button" className="team-edit-btn" onClick={handleStop} disabled={busy}>
            <Square size={14} /> Stop
          </button>
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

      <div className="blog-writer-section">
        <h3>Topic queue ({pendingTopics.length})</h3>
        <form className="blog-writer-inline-form" onSubmit={handleAddTopic}>
          <input
            type="text"
            placeholder="Topic title"
            value={newTopicTitle}
            onChange={(e) => setNewTopicTitle(e.target.value)}
          />
          <input
            type="text"
            placeholder="Target keyword (optional)"
            value={newTopicKeyword}
            onChange={(e) => setNewTopicKeyword(e.target.value)}
          />
          <button type="submit" className="team-edit-btn" disabled={busy || !newTopicTitle.trim()}>
            <Plus size={14} /> Add to queue
          </button>
        </form>

        {pendingTopics.length ? (
          pendingTopics.map((topic) => (
            <div className="blog-writer-queue-row" key={topic.id}>
              <div className="grow">
                <strong>{topic.title}</strong>
                <span>{topic.target_keyword ? `Keyword: ${topic.target_keyword}` : 'No target keyword'} · {topic.status}</span>
              </div>
              <button type="button" className="team-edit-btn" onClick={() => handleWriteFromTopic(topic.id)} disabled={busy || topic.status === 'queued'}>
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
        {requests.length ? (
          requests.map((req) => (
            <div className="blog-writer-queue-row" key={req.id} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div className="grow">
                  <strong>{req.topic?.title || req.ad_hoc_title || 'Untitled'}</strong>
                  <span>{STATUS_LABELS[req.status] || req.status} · queued {formatDate(req.created_at)}{req.error ? ` · ${req.error}` : ''}</span>
                </div>
                {req.blog_post ? (
                  <Link href={`/blog/${req.blog_post.slug}`} className="text-link admin-open-link" target="_blank">
                    {req.blog_post.published ? 'View post' : 'View draft'} <ExternalLink size={13} />
                  </Link>
                ) : null}
                {req.status === 'failed' ? (
                  <button type="button" className="team-edit-btn" onClick={() => handleRetry(req.id)} disabled={busy}>
                    <RefreshCw size={14} /> Retry
                  </button>
                ) : null}
              </div>
              {req.status === 'running' || req.status === 'waiting' ? <PhaseList steps={req.steps} phase={req.phase} /> : null}
            </div>
          ))
        ) : (
          <p className="blog-writer-empty">No runs yet.</p>
        )}
      </div>

      {settings ? (
        <div className="blog-writer-section">
          <h3>Settings</h3>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.9rem' }}>
            <input
              type="checkbox"
              checked={settings.auto_publish_enabled}
              onChange={(e) => handleSettingsChange('auto_publish_enabled', e.target.checked)}
            />
            Auto-publish when the audit passes (otherwise every post saves as a draft for review)
          </label>
          <div className="blog-writer-inline-form">
            <label style={{ flex: '1 1 160px' }}>
              Model
              <input
                type="text"
                value={settings.default_model}
                onChange={(e) => setSettings({ ...settings, default_model: e.target.value })}
                onBlur={(e) => handleSettingsChange('default_model', e.target.value)}
              />
            </label>
            <label style={{ flex: '1 1 160px' }}>
              Min SEO score
              <input
                type="number"
                min="0"
                max="100"
                value={settings.min_seo_score}
                onChange={(e) => setSettings({ ...settings, min_seo_score: Number(e.target.value) })}
                onBlur={(e) => handleSettingsChange('min_seo_score', Number(e.target.value))}
              />
            </label>
            <label style={{ flex: '1 1 160px' }}>
              Max internal links
              <input
                type="number"
                min="0"
                value={settings.max_internal_links}
                onChange={(e) => setSettings({ ...settings, max_internal_links: Number(e.target.value) })}
                onBlur={(e) => handleSettingsChange('max_internal_links', Number(e.target.value))}
              />
            </label>
          </div>
        </div>
      ) : null}
    </AdminShell>
  )
}
