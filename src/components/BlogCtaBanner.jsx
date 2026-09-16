'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

// Copy keyed by cta_variant -- the writer session picks whichever framing
// fits the post's angle (see .claude/commands/write-blog.md step 4). Falls
// back to a generic variant for anything it wrote that doesn't match one of
// these keys exactly, so a new/misspelled variant never renders nothing.
const VARIANTS = {
  automation: {
    heading: 'Want this automated for your agency?',
    body: 'GHL Prime builds and runs the exact kind of workflow this post covers — set up once, running 24/7 under your brand.',
  },
  support: {
    heading: 'Need a team who actually handles this?',
    body: 'GHL Prime is your dedicated GoHighLevel team: setup, troubleshooting, and 24/7 client support, without hiring in-house.',
  },
  ai_agents: {
    heading: 'Curious what an AI agent could do here?',
    body: 'We build and deploy AI agents inside GoHighLevel for agencies just like yours — voice, chat, and workflow automation included.',
  },
  general: {
    heading: 'Hire a Dedicated GoHighLevel Team',
    body: 'GHL Prime builds, automates, and supports your agency’s GoHighLevel setup, so you can focus on clients instead of tickets.',
  },
}

export default function BlogCtaBanner({ variant }) {
  const copy = VARIANTS[variant] || VARIANTS.general

  return (
    <aside className="blog-cta-banner" aria-label="Get started with GHL Prime">
      <div>
        <strong>{copy.heading}</strong>
        <p>{copy.body}</p>
      </div>
      <Link href="/booking" className="primary-pill">
        Get a free consultation <ArrowRight size={16} />
      </Link>
    </aside>
  )
}
