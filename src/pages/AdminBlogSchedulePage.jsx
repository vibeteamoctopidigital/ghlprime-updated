'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import AdminShell from '../components/AdminShell'
import { getSession, signOut } from '../lib/auth'
import {
  createBlogSchedule,
  deleteBlogSchedule,
  fetchBlogSchedules,
  updateBlogSchedule,
} from '../lib/blogWriterApi'
import '../styles/admin-extras.css'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const initialForm = {
  label: '',
  hour: 6,
  minute: 0,
  days_of_week: [],
  keywords: '',
  posts_per_run: 1,
  research_mode: 'keyword',
  category: '',
}

function formatTime(hour, minute) {
  const h = String(hour).padStart(2, '0')
  const m = String(minute).padStart(2, '0')
  return `${h}:${m} UTC`
}

export default function AdminBlogSchedulePage() {
  const [session, setSession] = useState(undefined)
  const [schedules, setSchedules] = useState([])
  const [form, setForm] = useState(initialForm)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function refresh() {
    const { data } = await fetchBlogSchedules()
    setSchedules(data)
  }

  useEffect(() => {
    getSession().then(setSession)
    fetchBlogSchedules().then(({ data }) => setSchedules(data))
  }, [])

  async function handleSignOut() {
    await signOut()
    setSession(null)
  }

  function toggleDay(day) {
    setForm((f) => ({
      ...f,
      days_of_week: f.days_of_week.includes(day)
        ? f.days_of_week.filter((d) => d !== day)
        : [...f.days_of_week, day].sort(),
    }))
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!form.label.trim() || !form.keywords.trim()) return

    setBusy(true)
    const { error } = await createBlogSchedule({
      label: form.label.trim(),
      hour: Number(form.hour),
      minute: Number(form.minute),
      days_of_week: form.days_of_week,
      keywords: form.keywords.split('\n').map((k) => k.trim()).filter(Boolean),
      posts_per_run: Number(form.posts_per_run),
      research_mode: form.research_mode,
      category: form.category.trim() || undefined,
    })
    setBusy(false)

    if (error) {
      setMessage(`Could not create schedule: ${error.message}`)
      return
    }
    setForm(initialForm)
    await refresh()
  }

  async function handleToggleEnabled(schedule) {
    setBusy(true)
    const { error } = await updateBlogSchedule(schedule.id, { enabled: !schedule.enabled })
    setBusy(false)
    if (error) {
      setMessage(`Could not update schedule: ${error.message}`)
      return
    }
    await refresh()
  }

  async function handleDelete(id) {
    setBusy(true)
    const { error } = await deleteBlogSchedule(id)
    setBusy(false)
    if (error) {
      setMessage(`Could not delete schedule: ${error.message}`)
      return
    }
    await refresh()
  }

  return (
    <AdminShell session={session} onSignOut={handleSignOut}>
      <div className="blog-writer-topbar">
        <div>
          <h2>Blog Schedules</h2>
          <span className="admin-list-meta">Recurring topics the Blog Writer works through automatically</span>
        </div>
      </div>

      {message ? <p className="admin-list-meta" style={{ marginBottom: '1rem' }}>{message}</p> : null}

      <div className="blog-writer-section">
        <h3>New schedule</h3>
        <form onSubmit={handleCreate}>
          <div className="blog-writer-inline-form">
            <input
              type="text"
              placeholder="Label (e.g. Daily GHL topics)"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
            />
            <input
              type="number"
              min="0"
              max="23"
              value={form.hour}
              onChange={(e) => setForm({ ...form, hour: e.target.value })}
              title="Hour (UTC, 0-23)"
            />
            <input
              type="number"
              min="0"
              max="59"
              value={form.minute}
              onChange={(e) => setForm({ ...form, minute: e.target.value })}
              title="Minute (0-59)"
            />
            <input
              type="number"
              min="1"
              max="20"
              value={form.posts_per_run}
              onChange={(e) => setForm({ ...form, posts_per_run: e.target.value })}
              title="Posts per run"
            />
            <select value={form.research_mode} onChange={(e) => setForm({ ...form, research_mode: e.target.value })}>
              <option value="keyword">Write from keyword</option>
              <option value="sources">Research real sources first</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.9rem' }}>
            {DAY_LABELS.map((label, day) => (
              <button
                type="button"
                key={label}
                className="team-edit-btn"
                style={form.days_of_week.includes(day) ? { borderColor: 'rgba(96,165,250,.6)', color: '#cfe2ff' } : undefined}
                onClick={() => toggleDay(day)}
              >
                {label}
              </button>
            ))}
            <span className="admin-list-meta" style={{ alignSelf: 'center' }}>
              {form.days_of_week.length === 0 ? '(every day if none selected)' : ''}
            </span>
          </div>

          <textarea
            placeholder="One keyword/topic per line"
            rows={4}
            value={form.keywords}
            onChange={(e) => setForm({ ...form, keywords: e.target.value })}
            style={{ width: '100%', marginBottom: '0.9rem' }}
          />

          <button type="submit" className="primary-pill" disabled={busy || !form.label.trim() || !form.keywords.trim()}>
            <Plus size={16} /> Create schedule
          </button>
        </form>
      </div>

      <div className="blog-writer-section">
        <h3>Schedules ({schedules.length})</h3>
        {schedules.length ? (
          schedules.map((schedule) => (
            <div className="blog-writer-schedule-card" key={schedule.id}>
              <div className="schedule-head">
                <strong>{schedule.label}</strong>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" className="team-edit-btn" onClick={() => handleToggleEnabled(schedule)} disabled={busy}>
                    {schedule.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                  <button type="button" className="team-edit-btn danger" onClick={() => handleDelete(schedule.id)} disabled={busy}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="schedule-meta">
                {formatTime(schedule.hour, schedule.minute)}
                {' · '}
                {schedule.days_of_week?.length ? schedule.days_of_week.map((d) => DAY_LABELS[d]).join(', ') : 'Every day'}
                {' · '}
                {schedule.posts_per_run} post{schedule.posts_per_run === 1 ? '' : 's'}/run
                {' · '}
                {schedule.keywords?.length || 0} keyword(s)
                {' · next: '}
                {schedule.keywords?.[schedule.next_keyword_index] || '—'}
              </div>
            </div>
          ))
        ) : (
          <p className="blog-writer-empty">No schedules yet — create one above.</p>
        )}
      </div>
    </AdminShell>
  )
}
