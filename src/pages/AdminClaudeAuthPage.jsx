'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle2, KeyRound, Loader2, LogOut, RefreshCw, XCircle } from 'lucide-react'
import AdminShell from '../components/AdminShell'
import { getSession, signOut } from '../lib/auth'
import {
  cancelClaudeLogin,
  fetchClaudeAuthStatus,
  logoutClaudeAccount,
  pollClaudeLogin,
  startClaudeLogin,
  submitClaudeLoginCode,
} from '../lib/claudeAuthApi'
import '../styles/admin-extras.css'

const POLL_MS = 3_000

/**
 * Claude Account — which Anthropic login the Blog Writer's CLI runs under.
 *
 * The flow mirrors `claude setup-token` on a server: start it here, open the
 * shown URL in any browser, sign in with the Claude subscription, paste the
 * code back, done. One session at a time; the backend holds the PTY.
 */
export default function AdminClaudeAuthPage() {
  const [session, setSession] = useState(undefined)
  const [status, setStatus] = useState(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [code, setCode] = useState('')
  const [loginActive, setLoginActive] = useState(false)
  const pollTimer = useRef(null)

  const refreshStatus = useCallback(async () => {
    const { data } = await fetchClaudeAuthStatus()
    if (data) {
      setStatus(data)
      setLoginActive(Boolean(data.login?.login_in_progress))
    }
  }, [])

  useEffect(() => {
    getSession().then(setSession)
    refreshStatus()
  }, [refreshStatus])

  // While a login session is open, poll so the URL appears the moment the CLI
  // prints it and the card flips to "logged in" the moment the code lands.
  useEffect(() => {
    if (!loginActive) return undefined
    pollTimer.current = setInterval(async () => {
      const { data } = await pollClaudeLogin()
      if (!data) return
      setStatus((prev) => (prev ? { ...prev, login: data, loggedIn: data.loggedIn } : prev))
      if (data.loggedIn) {
        setLoginActive(false)
        setMessage('Login complete — the Blog Writer can use this account now.')
        refreshStatus()
      }
    }, POLL_MS)
    return () => clearInterval(pollTimer.current)
  }, [loginActive, refreshStatus])

  async function handleSignOut() {
    await signOut()
    setSession(null)
  }

  async function handleStartLogin() {
    setBusy(true)
    setMessage('')
    const { data, error } = await startClaudeLogin()
    setBusy(false)
    if (error) {
      setMessage(`Could not start login: ${error.message}`)
      return
    }
    if (data?.error) {
      setMessage(data.error)
      return
    }
    setLoginActive(true)
    setMessage('Login session running — open the URL below in your browser, sign in, and paste the code back here.')
    await refreshStatus()
  }

  async function handleSubmitCode(e) {
    e.preventDefault()
    if (!code.trim()) return
    setBusy(true)
    const { data, error } = await submitClaudeLoginCode(code.trim())
    setBusy(false)
    if (error || !data?.accepted) {
      setMessage(`Code not accepted: ${error?.message || data?.error || 'unknown error'}`)
      return
    }
    setCode('')
    setMessage('Code submitted — confirming the login...')
  }

  async function handleCancelLogin() {
    setBusy(true)
    await cancelClaudeLogin()
    setBusy(false)
    setLoginActive(false)
    setMessage('Login cancelled — the previously stored account is unchanged.')
  }

  async function handleLogout() {
    setBusy(true)
    const { error } = await logoutClaudeAccount()
    setBusy(false)
    if (error) {
      setMessage(`Logout failed: ${error.message}`)
      return
    }
    setMessage('Logged out — the Blog Writer will pause until a new login completes.')
    await refreshStatus()
  }

  const loggedIn = Boolean(status?.loggedIn)
  const loginUrl = status?.login?.url || null

  return (
    <AdminShell session={session} onSignOut={handleSignOut}>
      <div className="blog-writer-topbar">
        <div>
          <h2>Claude Account</h2>
          <span className="admin-list-meta">The Anthropic login the AI Blog Writer uses — manage it here, no SSH needed</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span className={`admin-blog-status-badge ${loggedIn ? 'online' : 'offline'}`}>
            <span className="status-dot" aria-hidden="true" />
            {loggedIn ? 'Connected' : 'Not logged in'}
          </span>
          <button type="button" className="team-edit-btn" onClick={refreshStatus} disabled={busy}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {message ? (
        <p className="admin-list-meta" style={{ marginBottom: '1rem' }}>{message}</p>
      ) : null}

      <div className="blog-writer-section">
        <h3>Account</h3>
        {status ? (
          <div className="blog-writer-queue-row">
            <div className="grow">
              <strong>{status.email || 'No account connected'}</strong>
              <span>
                {status.subscriptionType ? `Plan: ${status.subscriptionType}` : 'Plan: unknown'}
                {status.authMethod ? ` · auth: ${status.authMethod}` : ''}
                {loggedIn ? ' · the writer uses this account' : ' · log in to enable the writer'}
              </span>
            </div>
            {loggedIn ? (
              <button type="button" className="team-edit-btn danger" onClick={handleLogout} disabled={busy}>
                <LogOut size={14} /> Log out
              </button>
            ) : (
              <button type="button" className="primary-pill" onClick={handleStartLogin} disabled={busy || loginActive}>
                <KeyRound size={16} /> Connect account
              </button>
            )}
          </div>
        ) : (
          <p className="blog-writer-empty">Loading account status...</p>
        )}
      </div>

      {loginActive ? (
        <div className="blog-writer-section">
          <h3>
            <Loader2 size={16} style={{ verticalAlign: '-3px', marginRight: '0.4rem' }} />
            Login in progress
          </h3>
          {loginUrl ? (
            <p style={{ wordBreak: 'break-all' }}>
              <a href={loginUrl} target="_blank" rel="noreferrer" className="text-link">
                Open the sign-in page
              </a>{' '}
              <span className="admin-list-meta">(opens claude.com in a new tab — sign in with the Claude subscription, copy the code it shows)</span>
            </p>
          ) : (
            <p className="admin-list-meta">Waiting for the sign-in URL...</p>
          )}
          {status?.login?.output_tail ? (
            <pre className="blog-writer-empty" style={{ whiteSpace: 'pre-wrap', maxHeight: '8rem', overflow: 'auto' }}>
              {status.login.output_tail}
            </pre>
          ) : null}
          <form className="blog-writer-inline-form" onSubmit={handleSubmitCode}>
            <input
              type="text"
              placeholder="Paste the code from the browser"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <button type="submit" className="primary-pill" disabled={busy || !code.trim()}>
              Submit code
            </button>
            <button type="button" className="team-edit-btn danger" onClick={handleCancelLogin} disabled={busy}>
              <XCircle size={14} /> Cancel
            </button>
          </form>
        </div>
      ) : null}

      <div className="blog-writer-section">
        <h3>Host</h3>
        {status ? (
          <div className="blog-writer-queue-row">
            <div className="grow">
              <strong>{status.claude_bin}</strong>
              <span>
                The CLI binary the writer spawns on this host
                {status.pty_available ? '' : ' · node-pty missing: login must be done over SSH (`claude setup-token`)'}
              </span>
            </div>
            {status.pty_available ? (
              <span className="admin-blog-status-badge online"><span className="status-dot" aria-hidden="true" />Login ready</span>
            ) : (
              <span className="admin-blog-status-badge offline"><span className="status-dot" aria-hidden="true" />PTY unavailable</span>
            )}
          </div>
        ) : null}
      </div>

      {loggedIn ? (
        <p className="admin-list-meta">
          <CheckCircle2 size={14} style={{ verticalAlign: '-2px' }} /> Switching accounts? Log out first, then connect the new one — the Blog Writer picks up whichever account is stored here.
        </p>
      ) : null}
    </AdminShell>
  )
}
