'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import AdminShell from '../components/AdminShell'
import { getSession, signOut } from '../lib/auth'
import {
  addScheduleKeywords,
  createBlogSchedule,
  deleteBlogSchedule,
  fetchBlogSchedules,
  updateBlogSchedule,
} from '../lib/blogWriterApi'
import '../styles/admin-extras.css'

// Mirrors GHL-Prime-Backend's src/modules/blog-writer/lib/run-schedule.ts
// RUN_MODES/RUN_MODE_LABELS -- the two repos don't share code, so this list
// is kept in sync by hand.
const MODE_OPTIONS = [
  { value: 'queue', label: 'From its keyword list' },
  { value: 'sources', label: 'From saved sites' },
]

const initialForm = {
  name: '',
  time: '07:00',
  timezone: 'Asia/Dhaka',
  postsPerDay: 1,
  enabled: false,
  mode: 'queue',
  keywords: '',
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
    refresh()
  }, [])

  async function handleSignOut() {
    await signOut()
    setSession(null)
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!form.name.trim()) return

    setBusy(true)
    const { data, error } = await createBlogSchedule({
      name: form.name.trim(),
      enabled: form.enabled,
      mode: form.mode,
      time: form.time,
      timezone: form.timezone.trim(),
      postsPerDay: Number(form.postsPerDay),
    })

    if (error) {
      setBusy(false)
      setMessage(`Could not create schedule: ${error.message}`)
      return
    }

    // Keywords are added in a second call -- createSchedule's own payload
    // has no room for them on this backend.
    if (form.mode === 'queue' && form.keywords.trim()) {
      const { error: keywordError } = await addScheduleKeywords(data.id, {
        topics: form.keywords.trim(),
        splitCommas: false,
      })
      if (keywordError) {
        setBusy(false)
        setMessage(`Schedule created, but could not add keywords: ${keywordError.message}`)
        setForm(initialForm)
        await refresh()
        return
      }
    }

    setBusy(false)
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
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              type="text"
              placeholder="Time (HH:MM, 24h)"
              value={form.time}
              onChange={(e) => setForm({ ...form, time: e.target.value })}
              title="Time of day this schedule runs, in its own timezone"
            />
            <input
              type="text"
              placeholder="Timezone (e.g. America/Denver)"
              value={form.timezone}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
              title="IANA timezone name"
            />
            <input
              type="number"
              min="1"
              max="20"
              value={form.postsPerDay}
              onChange={(e) => setForm({ ...form, postsPerDay: e.target.value })}
              title="Posts per day"
            />
            <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
              {MODE_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.2rem 0 0.9rem' }}>
            <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
            Enabled immediately
          </label>

          {form.mode === 'queue' ? (
            <textarea
              placeholder="One keyword/topic per line (optional -- can be added later)"
              rows={4}
              value={form.keywords}
              onChange={(e) => setForm({ ...form, keywords: e.target.value })}
              style={{ width: '100%', marginBottom: '0.9rem' }}
            />
          ) : (
            <p className="admin-list-meta" style={{ marginBottom: '0.9rem' }}>
              Site-sourced schedules pick their own stories from saved publications — add sites after creating it.
            </p>
          )}

          <button type="submit" className="primary-pill" disabled={busy || !form.name.trim()}>
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
                <strong>{schedule.name}</strong>
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
                {schedule.time} {schedule.timezone}
                {' · '}
                {MODE_OPTIONS.find((m) => m.value === schedule.mode)?.label || schedule.mode}
                {' · '}
                {schedule.postsPerDay} post{schedule.postsPerDay === 1 ? '' : 's'}/day
                {schedule.mode === 'queue' ? (
                  <>
                    {' · '}
                    {schedule.keywordCount} keyword(s)
                    {' · next: '}
                    {schedule.keywords?.[0]?.topic || '—'}
                  </>
                ) : (
                  <>
                    {' · '}
                    {schedule.sites?.length || 0} site(s)
                  </>
                )}
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
