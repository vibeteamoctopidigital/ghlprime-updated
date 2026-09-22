'use client'

import { useMemo } from 'react'
import { CTA_VARIANTS, DEFAULT_TIMEZONE, RANDOM_CTA_VARIANT, WORD_OPTIONS } from '../../lib/blogWriterRules'
import { Select } from './ui'

/** Enough zones to keep the dropdown useful where Intl.supportedValuesOf is missing. */
const FALLBACK_TIMEZONES = [
  'UTC',
  'Asia/Dhaka',
  'Asia/Kolkata',
  'Asia/Karachi',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Australia/Sydney',
]

/**
 * How long a generated post should be. One component for every place that
 * offers the choice, so they all offer the same lengths. `inherit` turns on a
 * "Default" row carrying null, for the per-topic override where "whatever the
 * queue says" is a real and common answer.
 */
export function WordLengthSelect({ id, value, onChange, inherit = false, inheritLabel, className }) {
  return (
    <Select
      id={id}
      className={className}
      value={value === null || value === undefined ? 'inherit' : String(value)}
      onChange={(event) => onChange(event.target.value === 'inherit' ? null : Number(event.target.value))}
    >
      {inherit ? <option value="inherit">Default{inheritLabel ? ` (${inheritLabel})` : ''}</option> : null}
      {WORD_OPTIONS.map((option) => (
        <option key={option} value={String(option)}>
          {option.toLocaleString()} words
        </option>
      ))}
    </Select>
  )
}

/**
 * Which CTA banner a post ends with. GHL Prime's banners are a small set of
 * copy variants (see the site's BlogCtaBanner), so a labelled dropdown says
 * everything a gallery would. `inherit` adds an "Inherit" row for a per-topic
 * or per-schedule override; "Random" picks a different banner per post.
 */
export function CtaVariantSelect({ id, value, onChange, inherit = false, inheritLabel, className }) {
  const current = value === '' || value === null || value === undefined ? (inherit ? 'inherit' : '') : value
  const known = CTA_VARIANTS.some((variant) => variant.id === current) || current === RANDOM_CTA_VARIANT || current === 'inherit'
  const selected = CTA_VARIANTS.find((variant) => variant.id === current)

  return (
    <div className="bw-cta-select">
      <Select
        id={id}
        className={className}
        value={known ? current : ''}
        onChange={(event) => onChange(event.target.value === 'inherit' ? '' : event.target.value)}
      >
        {inherit ? <option value="inherit">Inherit{inheritLabel ? ` (${inheritLabel})` : ''}</option> : null}
        {CTA_VARIANTS.map((variant) => (
          <option key={variant.id} value={variant.id}>
            {variant.label}
          </option>
        ))}
        <option value={RANDOM_CTA_VARIANT}>Random — a different banner per post</option>
        {!known ? <option value="">Unknown banner “{current}”</option> : null}
      </Select>
      {selected ? <span className="bw-hint bw-cta-hint">{selected.hint}</span> : null}
    </div>
  )
}

/**
 * Which timezone a schedule's daily time is read in.
 *
 * The browser knows every zone the server will accept — both sides ask Intl,
 * and the server refuses what Intl does not recognise — so the list is
 * generated rather than typed. That is the whole point of the control: a
 * schedule whose zone was saved as "Bangladesh" or "GMT+6" is a schedule
 * that quietly never fires, and a free-text box made that a typo away.
 *
 * A stored value the list does not carry keeps its own row rather than being
 * swapped for something else the moment the card renders — the same courtesy
 * CtaVariantSelect pays an unknown banner.
 */
export function TimezoneSelect({ id, value, onChange, className }) {
  const zones = useMemo(() => {
    try {
      return Intl.supportedValuesOf('timeZone')
    } catch {
      return FALLBACK_TIMEZONES
    }
  }, [])

  const current = value || DEFAULT_TIMEZONE
  const known = zones.includes(current)

  return (
    <Select id={id} className={className} value={current} onChange={(event) => onChange(event.target.value)}>
      {known ? null : <option value={current}>{current}</option>}
      {zones.map((zone) => (
        <option key={zone} value={zone}>
          {zone}
        </option>
      ))}
    </Select>
  )
}
