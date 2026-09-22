'use client'

import { AlertCircle, Check, ExternalLink, RotateCw, X } from 'lucide-react'
import { Badge, Button, Card, CardContent, CardHeader, Spinner } from './ui'

/**
 * What one pass through the queue produced: what came out of it, and what did
 * not. Successes and failures are separated rather than interleaved by time —
 * a run of forty posts with three problems buried in chronological order hides
 * exactly the three rows worth looking at. Stays through the whole run.
 */
export function RunSummary({ written, skipped, finished, remaining, running, closeable, clearedAt, onClose, onRetry, busy }) {
  const done = finished
  const total = done + remaining
  const capped = finished > written.length + skipped.length
  const since = clearedAt ? new Date(clearedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : ''

  return (
    <Card>
      <CardHeader>
        <div className="bw-row bw-between">
          <h3 className="bw-title">
            {running ? <Spinner size={16} /> : null}
            {since ? `Finished since ${since}` : 'Finished'}
          </h3>
          <div className="bw-row">
            <span className="bw-hint">
              {remaining > 0 ? `${done} of ${total} done` : `${done} written`}
              {capped ? ` · showing the latest ${written.length + skipped.length}` : ''}
            </span>
            {closeable ? (
              <Button variant="icon" onClick={onClose} disabled={busy} aria-label="Close this summary">
                <X size={14} />
              </Button>
            ) : null}
          </div>
        </div>
        {total > 0 ? (
          <div className="bw-bar bw-bar-thin">
            <div className="bw-bar-fill" style={{ width: `${Math.round((done / total) * 100)}%` }} />
          </div>
        ) : null}
      </CardHeader>

      <CardContent className="bw-stack">
        {skipped.length > 0 ? (
          <div className="bw-stack-sm">
            <h4 className="bw-subtitle bw-amber">Not written ({skipped.length})</h4>
            <div className="bw-list bw-list-amber">
              {skipped.map((topic) => (
                <div key={topic.id} className="bw-list-row bw-align-start">
                  <div className="bw-grow bw-stack-xs">
                    <p className="bw-row bw-text bw-truncate">
                      <AlertCircle size={14} className="bw-amber bw-shrink" />
                      {topic.topic}
                    </p>
                    {topic.skipReason ? <p className="bw-hint">{topic.skipReason}</p> : null}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => onRetry(topic.id)} disabled={busy}>
                    <RotateCw size={14} /> Retry
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {written.length > 0 ? (
          <div className="bw-stack-sm">
            <h4 className="bw-subtitle">Written ({written.length})</h4>
            <div className="bw-list">
              {written.map((topic) => (
                <div key={topic.id} className="bw-list-row">
                  <p className="bw-row bw-text bw-truncate bw-grow">
                    <Check size={14} className="bw-emerald bw-shrink" />
                    {topic.topic}
                  </p>
                  <div className="bw-row bw-shrink">
                    {topic.postStatus === 'published' ? <Badge tone="live">live</Badge> : topic.postStatus === 'draft' ? <Badge tone="outline">draft</Badge> : null}
                    {topic.blogSlug ? (
                      <a
                        href={topic.postStatus === 'published' ? `/blog/${topic.blogSlug}` : '/admin/blog'}
                        target={topic.postStatus === 'published' ? '_blank' : undefined}
                        rel={topic.postStatus === 'published' ? 'noopener noreferrer' : undefined}
                        className="bw-link bw-row"
                      >
                        {topic.postStatus === 'published' ? 'View post' : 'Open draft'}
                        <ExternalLink size={12} />
                      </a>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {done === 0 ? (
          <p className="bw-hint">Nothing written yet. {running ? 'The first post is being worked on.' : ''}</p>
        ) : null}
      </CardContent>
    </Card>
  )
}
