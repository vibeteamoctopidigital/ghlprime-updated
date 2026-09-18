'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, CheckCircle2, X } from 'lucide-react'
import SiteFooter from '../components/SiteFooter'
import { socialConfig } from '../components/socialConfig'
import { fetchTeamPageExperts } from '../lib/teamApi'

import '../components/pages-v2/pages-v2.css'
import '../components/pages-v2/immersive.css'
import '../styles/hire-individual.css'

// Dedicated GHL workflow for this page's leads -- separate from /contact's
// webhook so these route into their own pipeline in GoHighLevel.
const WEBHOOK_URL = 'https://services.leadconnectorhq.com/hooks/tc4QYWapkvuynWNE4abr/webhook-trigger/c6234973-e5db-4010-bdab-8dee59f04f6a'

const STEPS = [
  { id: 1, title: 'Your details' },
  { id: 2, title: 'What you need' },
  { id: 3, title: 'Budget & timeline' },
]

const SERVICE_OPTIONS = [
  'GHL Setup & Configuration',
  'Workflow Automation',
  'Funnel & Landing Page Design',
  'SaaS CRM Launch',
  'White-Label Support',
  'Vibe Coding & Custom Dev',
  'AI Agent Builder',
  'Custom SaaS Development',
  'Figma to Code',
  'Web & Mobile App Development',
  'SaaS Customer Support',
  'Something else',
]

const BUDGET_OPTIONS = [
  'Under $500/mo',
  '$500 - $1,500/mo',
  '$1,500 - $3,000/mo',
  '$3,000 - $6,000/mo',
  '$6,000+/mo',
]

const TIMELINE_OPTIONS = ['As soon as possible', 'Within the next month', 'Just exploring for now']

// The founders already have their own dedicated spotlight on /team -- this
// page is for individually-hireable specialists, so they're excluded here
// even if they also happen to exist as a "Meet the Experts" row.
const EXCLUDED_NAMES = new Set(['Jewel Rana', 'Niyamul Islam Sajal'])

// Experts (team_page_members) only store name/title/image_url -- no skills
// column (verified against the backend's team.routes.ts expert schema).
// Skills are derived from the job title/role: split it into its own phrases
// first (those become the person's top, most prominent skills), then top up
// with related skills pulled from the keyword dictionary below, matched
// against words in that same title, until every card shows at least 4 --
// never just the one or two words the raw title happened to contain.
const SKILL_KEYWORDS = [
  { match: /automat/i, skills: ['Workflow Automation', 'Trigger & Webhook Logic', 'Process Optimization'] },
  { match: /\bai\b|artificial intelligence/i, skills: ['AI Agent Design', 'Prompt Engineering', 'Conversational Flows'] },
  { match: /develop|engineer|vibe cod/i, skills: ['Custom Development', 'API Integrations', 'Code Quality'] },
  { match: /design/i, skills: ['UI/UX Design', 'Landing Page Design', 'Visual Branding'] },
  { match: /support/i, skills: ['Client Support', 'Ticket Resolution', 'Client Onboarding'] },
  { match: /crm/i, skills: ['CRM Configuration', 'Pipeline Setup'] },
  { match: /ghl|gohighlevel|go high level/i, skills: ['GoHighLevel Setup', 'Sub-Account Management'] },
  { match: /market/i, skills: ['Campaign Strategy', 'Lead Generation'] },
  { match: /sales/i, skills: ['Sales Enablement', 'Deal Pipeline Management'] },
  { match: /funnel/i, skills: ['Funnel Design', 'Conversion Optimization'] },
  { match: /project|manag/i, skills: ['Project Management', 'Client Communication'] },
  { match: /qa|quality/i, skills: ['Quality Assurance', 'Testing & QA'] },
  { match: /data|analy/i, skills: ['Data Analysis', 'Reporting Dashboards'] },
  { match: /content|copy|writ/i, skills: ['Content Strategy', 'Copywriting'] },
  { match: /video|edit/i, skills: ['Video Editing', 'Motion Graphics'] },
  { match: /saas/i, skills: ['SaaS Onboarding', 'Account Configuration'] },
]

// Always applicable, used to fill any card that still needs more skills
// once the title itself and the keyword matches above are exhausted.
const GENERAL_SKILLS = ['GoHighLevel Platform', 'Client Communication', 'Process Documentation', 'Team Collaboration']

function skillsFor(person) {
  const source = person.title || person.role || ''
  const seen = new Set()
  const names = []

  const addName = (name) => {
    const key = name.trim().toLowerCase()
    if (!name.trim() || seen.has(key)) return
    seen.add(key)
    names.push(name.trim())
  }

  source.split(/\s*(?:&|,|\/| and )\s*/i).forEach(addName)

  for (const { match, skills } of SKILL_KEYWORDS) {
    if (names.length >= 4) break
    if (match.test(source)) skills.forEach(addName)
  }

  for (const skill of GENERAL_SKILLS) {
    if (names.length >= 4) break
    addName(skill)
  }

  return names.slice(0, 4).map((name, i) => ({ name, level: Math.max(78, 92 - i * 5) }))
}

const SPRING = { type: 'spring', stiffness: 120, damping: 20, mass: 0.9 }
const heroStack = { hidden: {}, show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } } }
const heroLine = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: SPRING } }
const heroLineProps = { variants: heroLine }

function CheckboxGroup({ question, values, onToggle }) {
  return (
    <div className="hire-checkbox-group" role="group" aria-label={question}>
      <span className="hire-field-label">{question}</span>
      <div className="hire-checkbox-list">
        {SERVICE_OPTIONS.map((opt) => {
          const checked = values.includes(opt)
          return (
            <label key={opt} className={`hire-checkbox-option${checked ? ' is-selected' : ''}`}>
              <input type="checkbox" checked={checked} onChange={() => onToggle(opt)} />
              <span>{opt}</span>
            </label>
          )
        })}
      </div>
    </div>
  )
}

function RadioGroup({ name, label, options, value, onChange }) {
  return (
    <div className="hire-radio-group" role="radiogroup" aria-label={label}>
      <span className="hire-field-label">{label}</span>
      <div className="hire-radio-list">
        {options.map((opt) => (
          <label key={opt} className={`hire-radio-option${value === opt ? ' is-selected' : ''}`}>
            <input type="radio" name={name} value={opt} checked={value === opt} onChange={(e) => onChange(e.target.value)} />
            <span>{opt}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

function SpecialistCard({ person, index, onRequest }) {
  const skills = skillsFor(person)
  const role = person.role || person.title
  const firstName = person.name.split(' ')[0]
  const socialLinks = socialConfig.filter(({ key }) => person[key])

  return (
    <motion.article
      className="hire-specialist-card"
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ ...SPRING, delay: (index % 6) * 0.06 }}
    >
      <div className="hire-specialist-media">
        <span className="hire-specialist-photo">
          <img src={person.image_url} alt={person.name} loading="lazy" decoding="async" />
          {person.years_experience ? (
            <span className="hire-specialist-years">
              <strong>{person.years_experience}</strong>yrs
            </span>
          ) : null}
        </span>
        {socialLinks.length ? (
          <div className="hire-specialist-socials">
            {socialLinks.map(({ key, label, svg }) => (
              <a
                key={key}
                href={person[key]}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${person.name} on ${label}`}
                title={label}
                className="hire-social-link"
              >
                {svg}
              </a>
            ))}
          </div>
        ) : null}
      </div>

      <div className="hire-specialist-body">
        <span className="hire-specialist-role-tag">{role}</span>
        <h3 className="hire-specialist-name">{person.name}</h3>
        {person.description ? <p className="hire-specialist-bio">{person.description}</p> : null}
      </div>

      {skills.length ? (
        <div className="hire-skill-bars">
          {skills.map((skill, i) => (
            <div className="hire-skill-bar-row" key={skill.name}>
              <div className="hire-skill-bar-head">
                <span className="hire-skill-bar-name">{skill.name}</span>
                <span className="hire-skill-bar-pct">{skill.level}%</span>
              </div>
              <div className="hire-skill-bar-track">
                <motion.div
                  className="hire-skill-bar-fill"
                  initial={{ width: 0 }}
                  whileInView={{ width: `${skill.level}%` }}
                  viewport={{ once: true, amount: 0.6 }}
                  transition={{ duration: 0.8, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="hire-specialist-action">
        <button type="button" className="hire-specialist-cta" onClick={() => onRequest(person.name)}>
          Hire {firstName} Now <ArrowRight size={15} />
        </button>
        <span className="hire-specialist-action-note">Reply within 1 business day</span>
      </div>
    </motion.article>
  )
}

export default function HireIndividualPage() {
  const router = useRouter()
  const [experts, setExperts] = useState([])
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    services: [],
    otherService: '',
    budget: '',
    timeline: '',
    notes: '',
    preferredSpecialist: '',
  })

  useEffect(() => {
    fetchTeamPageExperts().then(setExperts)
  }, [])

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const toggleService = (opt) => {
    setForm((f) => ({
      ...f,
      services: f.services.includes(opt) ? f.services.filter((s) => s !== opt) : [...f.services, opt],
    }))
  }

  const requestSpecialist = (name) => {
    update('preferredSpecialist', name)
    document.getElementById('hire-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const isStepValid = (s = step) => {
    if (s === 1) {
      const phoneDigits = form.phone.replace(/\D/g, '')
      return form.name.trim().length > 0 && /\S+@\S+\.\S+/.test(form.email) && phoneDigits.length >= 5
    }
    if (s === 2) return form.services.length > 0
    if (s === 3) return form.budget.length > 0 && form.timeline.length > 0
    return true
  }

  const next = () => setStep((s) => Math.min(3, s + 1))
  const back = () => setStep((s) => Math.max(1, s - 1))

  const handleSubmit = async () => {
    if (step !== 3 || submitting || !isStepValid(3)) return
    setSubmitting(true)
    setSubmitError('')
    const services = form.services.includes('Something else') && form.otherService.trim()
      ? [...form.services.filter((s) => s !== 'Something else'), `Other: ${form.otherService.trim()}`]
      : form.services

    try {
      await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'ghlprime.com/hire-an-individual',
          submitted_at: new Date().toISOString(),
          name: form.name,
          email: form.email,
          phone: form.phone,
          company_name: form.company || null,
          services_needed: services.join(', '),
          monthly_budget: form.budget,
          timeline: form.timeline,
          notes: form.notes || null,
          preferred_specialist: form.preferredSpecialist || null,
        }),
      })
      router.push('/contact/thank-you')
    } catch (err) {
      setSubmitError('Something went wrong sending your request. Please try again or email info@ghlprime.com.')
      setSubmitting(false)
    }
  }

  const blockEnter = (e) => {
    if (e.key !== 'Enter') return
    const tag = (e.target.tagName || '').toUpperCase()
    if (tag === 'TEXTAREA') return
    e.preventDefault()
    if (step < 3 && isStepValid()) next()
  }

  const people = experts.filter((person) => !EXCLUDED_NAMES.has(person.name))

  return (
    <main className="hire-page pv2">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://ghlprime.com' },
            { '@type': 'ListItem', position: 2, name: 'Hire an Individual', item: 'https://ghlprime.com/hire-an-individual' },
          ],
        }) }} />

      {/* ---------------------------------------------------------------- hero */}
      <section className="pv2-section is-tint pv2-hero">
        <span className="pv2-bloom one" aria-hidden="true" />
        <span className="pv2-bloom two" aria-hidden="true" />
        <div className="pv2-inner hire-hero-grid">
          <motion.div variants={heroStack} initial="hidden" animate="show">
            <motion.span className="pv2-eyebrow" {...heroLineProps}>Hire an Individual</motion.span>
            <motion.h1 {...heroLineProps}>Bring a Dedicated GHL Prime Specialist Onto Your Team.</motion.h1>
            <motion.p className="pv2-lede" {...heroLineProps}>
              Skip the agency-wide retainer. Hire one certified specialist matched to exactly what you need
              automation, funnel design, AI agents, or custom development under the same vetting and leadership
              review that backs our full team.
            </motion.p>
            <motion.div className="hire-trust-row" {...heroLineProps}>
              <span>GHL-Certified specialists</span>
              <span>·</span>
              <span>Two-layer leadership review</span>
              <span>·</span>
              <span>No contracts</span>
            </motion.div>
          </motion.div>

          <motion.div
            id="hire-form"
            className="hire-form-card"
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING, delay: 0.15 }}
          >
            <ol className="hire-progress">
              {STEPS.map((s) => {
                const state = s.id === step ? 'is-current' : s.id < step ? 'is-done' : ''
                return (
                  <li key={s.id} className={`hire-step ${state}`}>
                    <span className="hire-step-num">{s.id < step ? <CheckCircle2 size={14} /> : s.id}</span>
                    <span className="hire-step-label">{s.title}</span>
                  </li>
                )
              })}
            </ol>

            <div className="hire-form" onKeyDown={blockEnter}>
              {step === 1 && (
                <fieldset className="hire-fieldset">
                  <legend className="hire-heading">Step 1 Your details</legend>
                  <label className="hire-field">
                    <span>Your name <em className="hire-required">*</em></span>
                    <input type="text" required value={form.name} onChange={(e) => update('name', e.target.value)} autoComplete="name" />
                  </label>
                  <label className="hire-field">
                    <span>Email address <em className="hire-required">*</em></span>
                    <input type="email" required value={form.email} onChange={(e) => update('email', e.target.value)} autoComplete="email" />
                  </label>
                  <label className="hire-field">
                    <span>Phone number <em className="hire-required">*</em></span>
                    <input type="tel" required value={form.phone} onChange={(e) => update('phone', e.target.value)} autoComplete="tel" placeholder="+1 555 555 5555" />
                  </label>
                  <label className="hire-field">
                    <span>Company / agency name <em>(optional)</em></span>
                    <input type="text" value={form.company} onChange={(e) => update('company', e.target.value)} autoComplete="organization" />
                  </label>
                </fieldset>
              )}

              {step === 2 && (
                <fieldset className="hire-fieldset">
                  <legend className="hire-heading">Step 2 What do you need help with?</legend>
                  <CheckboxGroup question="Select every service you want this specialist to cover" values={form.services} onToggle={toggleService} />
                  {form.services.includes('Something else') ? (
                    <label className="hire-field">
                      <span>Tell us what you need <em>(optional)</em></span>
                      <input type="text" value={form.otherService} onChange={(e) => update('otherService', e.target.value)} placeholder="e.g. Zapier migration" />
                    </label>
                  ) : null}
                </fieldset>
              )}

              {step === 3 && (
                <fieldset className="hire-fieldset">
                  <legend className="hire-heading">Step 3 Budget & timeline</legend>
                  {form.preferredSpecialist ? (
                    <span className="hire-chip">
                      Requested: {form.preferredSpecialist}
                      <button type="button" aria-label="Clear requested specialist" onClick={() => update('preferredSpecialist', '')}>
                        <X size={12} />
                      </button>
                    </span>
                  ) : null}
                  <RadioGroup name="budget" label="What is your monthly budget for this?" options={BUDGET_OPTIONS} value={form.budget} onChange={(v) => update('budget', v)} />
                  <RadioGroup name="timeline" label="When do you need to get started?" options={TIMELINE_OPTIONS} value={form.timeline} onChange={(v) => update('timeline', v)} />
                  <label className="hire-field">
                    <span>Anything else we should know? <em>(optional)</em></span>
                    <textarea rows={3} value={form.notes} onChange={(e) => update('notes', e.target.value)} placeholder="e.g. we need someone who can start within Central Time business hours..." />
                  </label>
                  {submitError ? <p className="hire-error">{submitError}</p> : null}
                </fieldset>
              )}

              <div className="hire-actions">
                {step > 1 ? (
                  <button type="button" className="secondary-pill" onClick={back} disabled={submitting}>
                    <ArrowLeft size={16} /> Back
                  </button>
                ) : <span />}
                {step < 3 ? (
                  <button type="button" className="primary-pill" onClick={next} disabled={!isStepValid()}>
                    Next <ArrowRight size={16} />
                  </button>
                ) : (
                  <button type="button" className="primary-pill" onClick={handleSubmit} disabled={submitting || !isStepValid(3)}>
                    {submitting ? 'Sending...' : 'Send request'} <ArrowRight size={16} />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ------------------------------------------------------------ overview */}
      <section className="pv2-section is-white">
        <div className="pv2-inner">
          <motion.div
            className="pv2-head centered"
            initial={{ opacity: 0, y: 26 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={SPRING}
          >
            <span className="pv2-eyebrow">Overview</span>
            <h2>What It Means to <span className="pv2-hl">Hire an Individual</span></h2>
            <p>You get one specialist, matched to your exact need, backed by the same standards that run our full team engagements not a generalist spread thin across ten accounts.</p>
          </motion.div>

          <div className="pv2-grid three">
            <motion.div className="pv2-card" initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.3 }} transition={SPRING}>
              <h3>One Dedicated Specialist</h3>
              <p>Your hire works your account as their primary focus, not a side task squeezed between five other clients.</p>
            </motion.div>
            <motion.div className="pv2-card" initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.3 }} transition={{ ...SPRING, delay: 0.08 }}>
              <h3>GHL-Certified & Vetted</h3>
              <p>Every specialist passes the same certification and technical assessment we require for our own team no exceptions for solo hires.</p>
            </motion.div>
            <motion.div className="pv2-card" initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.3 }} transition={{ ...SPRING, delay: 0.16 }}>
              <h3>Two-Layer Leadership Review</h3>
              <p>Deliverables still pass through our COO and CEO review before they reach you, even on a single-specialist engagement.</p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- specialists */}
      <section className="pv2-section is-paper">
        <div className="pv2-inner">
          <motion.div
            className="pv2-head centered"
            initial={{ opacity: 0, y: 26 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={SPRING}
          >
            <span className="pv2-eyebrow">Meet the Team</span>
            <h2>Specialists You Can <span className="pv2-hl">Hire Individually</span></h2>
            <p>Every person below can be requested directly. Tell us who caught your eye or let us match you based on your answers above.</p>
          </motion.div>

          <div className="hire-specialist-grid">
            {people.map((person, index) => (
              <SpecialistCard key={person.id || person.name} person={person} index={index} onRequest={requestSpecialist} />
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ how it works */}
      <section className="pv2-section is-white" aria-labelledby="hire-how-heading">
        <div className="pv2-inner">
          <motion.div
            className="pv2-head centered"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={SPRING}
          >
            <span className="pv2-eyebrow">How It Works</span>
            <h2 id="hire-how-heading">From Request to <span className="pv2-hl">Kickoff Call</span></h2>
          </motion.div>

          <ol className="iv-track">
            <motion.span
              className="iv-track-rail"
              aria-hidden="true"
              initial={{ scaleY: 0 }}
              whileInView={{ scaleY: 1 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.9, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            />
            {[
              { title: 'Tell Us What You Need', text: 'Submit the 3-step request above with the services, budget, and timeline that fit your project.' },
              { title: 'We Match You With a Specialist', text: 'Leadership reviews your request and matches you with the specialist whose specialty fits best sometimes the one you requested by name.' },
              { title: 'Kickoff Within 1 Business Day', text: 'You get a reply and a kickoff call scheduled within one business day, no lengthy sales process.' },
            ].map(({ title, text }, i) => (
              <motion.li
                key={title}
                style={{ transformPerspective: 900 }}
                initial={{ opacity: 0, z: -120, y: 20 }}
                whileInView={{ opacity: 1, z: 0, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ ...SPRING, delay: i * 0.14 }}
              >
                <motion.span
                  className="iv-track-node"
                  initial={{ scale: 0.4, rotate: -35, opacity: 0 }}
                  whileInView={{ scale: 1, rotate: 0, opacity: 1 }}
                  viewport={{ once: true, amount: 0.6 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 16, mass: 0.7, delay: i * 0.14 + 0.1 }}
                >
                  {String(i + 1).padStart(2, '0')}
                </motion.span>
                <div className="iv-track-body">
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </motion.li>
            ))}
          </ol>
        </div>
      </section>

      {/* ------------------------------------------------------------------ cta */}
      <section className="pv2-section is-tint">
        <div className="pv2-inner">
          <motion.div
            className="pv2-cta"
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={SPRING}
          >
            <span className="iv-aurora a1" aria-hidden="true" />
            <span className="iv-aurora a2" aria-hidden="true" />
            <span className="pv2-eyebrow" style={{ position: 'relative', zIndex: 2 }}>Not sure which specialist you need?</span>
            <h2>Talk to Us First and We&rsquo;ll Point You to the Right Person.</h2>
            <div className="pv2-cta-actions">
              <a href="#hire-form" className="primary-pill large">Start Your Request <ArrowRight size={16} /></a>
              <Link href="/contact" className="secondary-pill large">Contact Us Instead</Link>
            </div>
          </motion.div>
        </div>
      </section>

      <SiteFooter />
    </main>
  )
}
