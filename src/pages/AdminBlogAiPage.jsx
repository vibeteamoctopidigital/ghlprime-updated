'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bot, Check, CheckCircle2, ExternalLink, Loader2, Play, XCircle } from 'lucide-react'
import AdminShell from '../components/AdminShell'
import { getSession, signOut } from '../lib/auth'
import { fetchBlogAiRuns, fetchBlogAiSettings, runBlogAiNow, saveBlogAiSettings } from '../lib/blogAiApi'
import '../styles/admin-extras.css'

// Blog-writing settings + Run Now + Recent Runs only. The Claude/Codex
// account-connection UI (accounts list, "connect in browser" flows, Codex
// panel) lives on its own page now see AdminAiConnectionsPage.jsx since
// the customer asked for the two concerns to be split apart.

// Mirrors RUN_STEPS in the backend's blogAi.engine.ts — the engine writes
// `current_step` onto the run row as it advances, and this page polls it.
const RUN_STEP_LABELS = [
  { key: 'researching', label: 'Researching topic' },
  { key: 'writing', label: 'Writing post' },
  { key: 'reviewing_content', label: 'Checking rules' },
  { key: 'generating_image', label: 'Cover image' },
  { key: 'saving_draft', label: 'Saving draft' },
]

const initialSettingsForm = {
  instructions: '',
  keywords: '',
  advanced_instructions: '',
  auto_publish: false,
  auto_blog_enabled: true,
  schedule_hour: 10,
  schedule_minute: 0,
  posts_per_day: 1,
}

function mapSettingsToForm(settings) {
  return {
    instructions: settings.instructions || '',
    keywords: settings.keywords || '',
    advanced_instructions: settings.advanced_instructions || '',
    auto_publish: Boolean(settings.auto_publish),
    auto_blog_enabled: settings.auto_blog_enabled !== false,
    schedule_hour: settings.schedule_hour ?? 10,
    schedule_minute: settings.schedule_minute ?? 0,
    posts_per_day: settings.posts_per_day ?? 1,
  }
}

// The backend's validation schema expects camelCase keys (see
// updateSettingsSchema in blogAi.validators.ts) while this form's state and
// the rest of the API's wire format use snake_case — this is the one place
// that bridges the two on the way out, so a mismatch here can't silently
// drop a field (numbers are coerced too: raw <input> values arrive as
// strings from onChange).
function buildSettingsPayload(form) {
  return {
    instructions: form.instructions,
    keywords: form.keywords,
    advancedInstructions: form.advanced_instructions,
    autoBlogEnabled: form.auto_blog_enabled,
    scheduleHour: Number(form.schedule_hour),
    scheduleMinute: Number(form.schedule_minute),
    postsPerDay: Number(form.posts_per_day),
  }
}

/** UTC hour/minute -> what that same instant reads as in the admin's own browser timezone, for the helper hint under the schedule inputs. */
function formatLocalEquivalent(hour, minute) {
  const utcDate = new Date(Date.UTC(2000, 0, 1, Number(hour) || 0, Number(minute) || 0))
  if (Number.isNaN(utcDate.getTime())) return ''
  return utcDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function formatDateTime(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

function RunStatusBadge({ status }) {
  if (status === 'success') {
    return <span className="admin-blog-status-badge published"><CheckCircle2 size={13} /> Success</span>
  }
  if (status === 'running') {
    return <span className="admin-blog-status-badge draft"><Loader2 size={13} className="admin-spin" /> Running</span>
  }
  return (
    <span
      className="admin-blog-status-badge draft"
      style={{ color: '#ff9b9b', background: 'rgba(248,113,113,.1)', borderColor: 'rgba(248,113,113,.32)' }}
    >
      <XCircle size={13} /> Failed
    </span>
  )
}

export default function AdminBlogAiPage() {
  const [session, setSession] = useState(undefined)
  const [settingsForm, setSettingsForm] = useState(initialSettingsForm)
  const [runs, setRuns] = useState([])
  const [status, setStatus] = useState(null) // { type: 'status' | 'error', message }
  const [savingSettings, setSavingSettings] = useState(false)
  const [runningNow, setRunningNow] = useState(false)
  const [runStep, setRunStep] = useState(null)

  async function loadAll() {
    const [settingsRes, runsRes] = await Promise.all([
      fetchBlogAiSettings(),
      fetchBlogAiRuns(50),
    ])

    if (settingsRes.data) setSettingsForm(mapSettingsToForm(settingsRes.data))
    if (Array.isArray(runsRes.data)) setRuns(runsRes.data)
  }

  useEffect(() => {
    getSession().then(setSession)
    fetchBlogAiSettings().then(({ data }) => { if (data) setSettingsForm(mapSettingsToForm(data)) })
    fetchBlogAiRuns(50).then(({ data }) => { if (Array.isArray(data)) setRuns(data) })
  }, [])

  async function handleSignOut() {
    await signOut()
    setSession(null)
  }

  async function handleSaveSettings(event) {
    event.preventDefault()
    setSavingSettings(true)
    setStatus(null)

    const { data, error } = await saveBlogAiSettings(buildSettingsPayload(settingsForm))

    if (error) {
      setStatus({ type: 'error', message: error.message || 'Failed to save settings' })
      setSavingSettings(false)
      return
    }

    setSettingsForm(mapSettingsToForm(data))
    setStatus({ type: 'status', message: 'Settings saved.' })
    setSavingSettings(false)
  }

  async function handleRunNow() {
    setRunningNow(true)
    setRunStep(null)
    setStatus(null)

    // The run is a single long request with no intermediate response, so
    // progress comes from polling the run row the engine is updating as it
    // moves through each phase (see RUN_STEPS in blogAi.engine.ts). The row
    // is created before any work starts, so the newest run is this one.
    const poll = window.setInterval(async () => {
      const { data } = await fetchBlogAiRuns(1)
      const latest = Array.isArray(data) ? data[0] : null
      if (latest?.status === 'running') setRunStep(latest.current_step || null)
    }, 2000)

    const { data, error } = await runBlogAiNow()

    window.clearInterval(poll)
    setRunStep(null)

    if (error) {
      setStatus({ type: 'error', message: error.message || 'Run failed to start' })
      setRunningNow(false)
      return
    }

    if (data.success) {
      setStatus({
        type: 'status',
        message: `Generated “${data.draft?.title}” — waiting for your review in the Blog Library.`,
      })
    } else {
      setStatus({ type: 'error', message: data.error || 'Run failed' })
    }

    await loadAll()
    setRunningNow(false)
  }

  return (
    <AdminShell session={session} onSignOut={handleSignOut} loadingText="Loading Auto Blog...">
      <div className="admin-hero-panel refined-admin-hero">
        <div>
          <span className="auth-kicker"><Bot size={16} /> Auto Blog</span>
          <h1>Let AI write SEO-optimized blog posts using your own Claude Code / Codex logins.</h1>
          <p>Generated posts save as drafts for review by default. Enable auto-publish below if you want them to go live automatically.</p>
        </div>
        <div className="admin-top-actions">
          <Link href="/admin/blog" className="secondary-pill">Blog Library</Link>
          <Link href="/admin/ai-connections" className="secondary-pill">AI Connections</Link>
          <button type="button" className="primary-pill" onClick={handleRunNow} disabled={runningNow}>
            {runningNow ? <><Loader2 size={16} className="admin-spin" /> Running...</> : <><Play size={16} /> Run Now</>}
          </button>
        </div>
      </div>

      {runningNow ? (
        <div className="admin-run-progress">
          {RUN_STEP_LABELS.map((step, index) => {
            const currentIndex = RUN_STEP_LABELS.findIndex((entry) => entry.key === runStep)
            const state = currentIndex < 0
              ? (index === 0 ? 'active' : 'pending')
              : index < currentIndex ? 'done' : index === currentIndex ? 'active' : 'pending'

            return (
              <span key={step.key} className={`admin-run-step is-${state}`}>
                {state === 'done' ? <Check size={13} /> : null}
                {state === 'active' ? <Loader2 size={13} className="admin-spin" /> : null}
                {step.label}
              </span>
            )
          })}
        </div>
      ) : null}

      {status ? <div className={status.type === 'error' ? 'form-error' : 'form-status'}>{status.message}</div> : null}

      <form className="admin-form-card futuristic-card refined-admin-card" onSubmit={handleSaveSettings}>
        <div className="admin-card-head">
          <h2>Generation Settings</h2>
          <span>Shared by every run manual or scheduled</span>
        </div>

        <div className="admin-form-grid">
          <label className="full-width">
            <span>Instructions</span>
            <textarea
              rows="4"
              placeholder="e.g. Write in a confident, practical tone for GoHighLevel agency owners. Favor concrete examples over theory."
              value={settingsForm.instructions}
              onChange={(event) => setSettingsForm((current) => ({ ...current, instructions: event.target.value }))}
            />
          </label>
          <label className="full-width">
            <span>Keywords</span>
            <textarea
              rows="2"
              placeholder="gohighlevel automation, ai agents for agencies, crm workflows"
              value={settingsForm.keywords}
              onChange={(event) => setSettingsForm((current) => ({ ...current, keywords: event.target.value }))}
            />
          </label>
          <label className="full-width">
            <span>Advanced instructions</span>
            <textarea
              rows="4"
              placeholder="Anything else to steer the model internal linking rules, formatting preferences, topics to avoid, etc."
              value={settingsForm.advanced_instructions}
              onChange={(event) => setSettingsForm((current) => ({ ...current, advanced_instructions: event.target.value }))}
            />
          </label>

          <div className="full-width admin-team-assignment-box refined-assignment-box">
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={settingsForm.auto_blog_enabled}
                onChange={(event) => setSettingsForm((current) => ({ ...current, auto_blog_enabled: event.target.checked }))}
              />
              <span>Automatic daily generation</span>
            </label>
            <p className="admin-empty-note">
              {settingsForm.auto_blog_enabled
                ? 'On: a new post generates automatically every day at the scheduled time below.'
                : 'Off: the daily schedule is paused nothing generates on its own. "Run Now" above still works any time.'}
            </p>
          </div>

          <label>
            <span>Schedule hour (UTC)</span>
            <input
              type="number"
              min="0"
              max="23"
              disabled={!settingsForm.auto_blog_enabled}
              value={settingsForm.schedule_hour}
              onChange={(event) => setSettingsForm((current) => ({ ...current, schedule_hour: event.target.value }))}
            />
          </label>

          <label>
            <span>Schedule minute (UTC)</span>
            <input
              type="number"
              min="0"
              max="59"
              disabled={!settingsForm.auto_blog_enabled}
              value={settingsForm.schedule_minute}
              onChange={(event) => setSettingsForm((current) => ({ ...current, schedule_minute: event.target.value }))}
            />
          </label>

          <label>
            <span>Posts per day</span>
            <input
              type="number"
              min="1"
              max="10"
              value={settingsForm.posts_per_day}
              onChange={(event) => setSettingsForm((current) => ({ ...current, posts_per_day: event.target.value }))}
            />
          </label>

          <div className="full-width">
            <p className="admin-empty-note">
              That&apos;s {formatLocalEquivalent(settingsForm.schedule_hour, settingsForm.schedule_minute)} in your own timezone right now.
              {' '}If a scheduled run fails, it automatically retries (up to 3 attempts total) before giving up for the day and emailing an alert.
              {' '}Scheduled runs only ever use a connected Claude/Codex subscription login never a paid API key, even if one is configured as a manual-run fallback.
            </p>
          </div>

          <div className="full-width admin-team-assignment-box refined-assignment-box">
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={settingsForm.auto_publish}
                onChange={(event) => setSettingsForm((current) => ({ ...current, auto_publish: event.target.checked }))}
              />
              <span>Auto-publish generated posts</span>
            </label>
            <p className="admin-empty-note">
              {settingsForm.auto_publish
                ? 'On: new posts publish automatically as soon as they generate.'
                : 'Off (default): new posts save as drafts for review in the Blog Library nothing goes live automatically.'}
            </p>
          </div>
        </div>

        <div className="team-edit-actions admin-form-actions">
          <button className="primary-pill large auth-submit" type="submit" disabled={savingSettings}>
            {savingSettings ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>

      <div className="admin-list-card futuristic-card refined-admin-card">
        <div className="admin-card-head admin-section-head">
          <h2>Recent Runs</h2>
          <span className="admin-list-meta">{runs.length} shown</span>
        </div>
        <div className="admin-blog-table-wrap">
          <table className="admin-blog-table">
            <thead>
              <tr>
                <th>Started</th>
                <th>Status</th>
                <th>Provider</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id}>
                  <td>{formatDateTime(run.started_at)}</td>
                  <td><RunStatusBadge status={run.status} /></td>
                  <td>{run.provider || ''}{run.account_label ? ` · ${run.account_label}` : ''}</td>
                  <td>
                    {run.blog_post_id && run.blog_post_published ? (
                      <Link href={`/blog/${run.blog_post_slug}`} className="text-link admin-open-link">
                        {run.blog_post_title || 'View post'} <ExternalLink size={13} />
                      </Link>
                    ) : run.blog_post_id ? (
                      <Link href="/admin/blog" className="text-link admin-open-link">
                        {run.blog_post_title || 'Draft saved'} (draft review in Blog Library)
                      </Link>
                    ) : (
                      <span style={{ color: run.error ? '#ffb0b0' : undefined }}>{run.error || ''}</span>
                    )}
                  </td>
                </tr>
              ))}
              {!runs.length ? (
                <tr><td colSpan={4} className="admin-blog-empty">No runs yet. Click “Run Now” above to generate the first post.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  )
}
