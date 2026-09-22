'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bot, Calendar } from 'lucide-react'
import AdminShell from '../components/AdminShell'
import { getSession, signOut } from '../lib/auth'
import { BlogWriterManager } from '../components/blogWriter/BlogWriterManager'
import { ToastProvider } from '../components/blogWriter/ToastProvider'
import '../styles/admin-extras.css'
import '../styles/blog-writer.css'

/**
 * The AI Blog Writer.
 *
 * Data is fetched by the manager rather than here, because the screen polls:
 * whether the writer is online changes while someone is looking at the page,
 * and a snapshot would show a stale "online" long after the machine went to
 * sleep.
 */
export default function AdminBlogWriterPage() {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    getSession().then(setSession)
  }, [])

  async function handleSignOut() {
    await signOut()
    setSession(null)
  }

  return (
    <AdminShell session={session} onSignOut={handleSignOut} loadingText="Loading the blog writer...">
      <ToastProvider>
        <div className="admin-hero-panel refined-admin-hero">
          <div>
            <span className="auth-kicker">
              <Bot size={16} /> AI Blog Writer
            </span>
            <h1>Line up what should be written next.</h1>
            <p>
              Posts are written on the machine running Claude Code and land under Blog — as drafts, or published outright if you have switched that on.
            </p>
          </div>
          <div className="admin-top-actions">
            <Link href="/admin/blog-schedules" className="secondary-pill">
              <Calendar size={16} /> Blog Schedules
            </Link>
            <Link href="/admin/blog" className="secondary-pill">
              Blog Library
            </Link>
          </div>
        </div>

        <div className="bw-page">
          <BlogWriterManager />
        </div>
      </ToastProvider>
    </AdminShell>
  )
}
