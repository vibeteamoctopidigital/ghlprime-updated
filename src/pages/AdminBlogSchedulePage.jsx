'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bot, Calendar } from 'lucide-react'
import AdminShell from '../components/AdminShell'
import { getSession, signOut } from '../lib/auth'
import { BlogScheduleManager } from '../components/blogWriter/BlogScheduleManager'
import { ToastProvider } from '../components/blogWriter/ToastProvider'
import '../styles/admin-extras.css'
import '../styles/blog-writer.css'

/**
 * Scheduled blogs.
 *
 * The timer itself does not live here, or anywhere in the website. It runs
 * inside the watcher on the machine with Claude Code, because a schedule that
 * fires where nothing is listening produces a request nobody will ever pick
 * up. This screen only records when a run is wanted and what it may draw from.
 */
export default function AdminBlogSchedulePage() {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    getSession().then(setSession)
  }, [])

  async function handleSignOut() {
    await signOut()
    setSession(null)
  }

  return (
    <AdminShell session={session} onSignOut={handleSignOut} loadingText="Loading the schedules...">
      <ToastProvider>
        <div className="admin-hero-panel refined-admin-hero">
          <div>
            <span className="auth-kicker">
              <Calendar size={16} /> Scheduled Blogs
            </span>
            <h1>Write a post every morning without anyone pressing anything.</h1>
            <p>The writer has to be running for this to happen — its status is shown on the AI Blog Writer page and at the top of this one.</p>
          </div>
          <div className="admin-top-actions">
            <Link href="/admin/blog-writer" className="secondary-pill">
              <Bot size={16} /> AI Blog Writer
            </Link>
          </div>
        </div>

        <div className="bw-page">
          <BlogScheduleManager />
        </div>
      </ToastProvider>
    </AdminShell>
  )
}
