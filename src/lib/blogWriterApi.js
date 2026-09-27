// Data layer for /admin/blog-writer and /admin/blog-schedules.
//
// Matches the real backend at GHL-Prime-Backend/src/modules/blog-writer
// (blogWriter.routes.ts / .service.ts / .validators.ts) — that module was
// rewritten from scratch at some point after this file was first written
// against an older, simpler contract (settings/requests/topics with a
// target_keyword field), which no longer exists on the server. Every helper
// below was checked directly against that source, not guessed from the
// route names alone: /status does not exist at all (there is no public
// status route — "is the writer online" is a field on GET /state's
// response), POST /requests is actually POST /request (singular, and takes
// { topicId?, all? } rather than { topic_id, ad_hoc_title }), and schedules
// are keyed by a single time+timezone string rather than hour/minute/
// days_of_week. The backend lives in a separate repo and must not be
// changed from here — every fix below is on this side only.
//
// Every route is admin-gated on the backend, so every call passes
// { auth: true }.

import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from './apiClient'

const BASE = '/api/blog-writer'

/** Everything the writer screen needs in one call: queue, defaults, writer
 * online/offline, the active (running/waiting) request, the last 5 finished
 * runs, the batch in progress, and the run summary. */
export async function fetchBlogWriterState() {
  const { data, error } = await apiGet(`${BASE}/state`, { auth: true })
  return { data, error }
}

export async function fetchBlogDefaults() {
  const { data, error } = await apiGet(`${BASE}/defaults`, { auth: true })
  return { data: data?.defaults || null, error }
}

/** The backend's defaultsSchema requires all five fields on every save —
 * always send the full, merged defaults object, not just the changed key. */
export async function saveBlogDefaults(defaults) {
  const { data, error } = await apiPut(`${BASE}/defaults`, defaults, { auth: true })
  return { data: data?.defaults || null, error }
}

/** Clears every queued topic's per-topic override so it follows the
 * defaults again (does not copy the current defaults onto each row). */
export async function applyBlogDefaults() {
  const { data, error } = await apiPost(`${BASE}/defaults/apply`, {}, { auth: true })
  return { data, error }
}

/** { topic, notes?, imageCount?, words?, ctaVariant? } — lands at the end of the queue. */
export async function createBlogTopic(payload) {
  const { data, error } = await apiPost(`${BASE}/topics`, payload, { auth: true })
  return { data, error }
}

export async function bulkAddBlogTopics(topics) {
  const { data, error } = await apiPost(`${BASE}/topics/bulk`, { topics }, { auth: true })
  return { data, error }
}

export async function reorderBlogTopics(ids) {
  const { data, error } = await apiPost(`${BASE}/topics/reorder`, { ids }, { auth: true })
  return { data, error }
}

/** Only send the fields that changed — PATCH semantics, every key optional. */
export async function updateBlogTopic(id, payload) {
  const { data, error } = await apiPatch(`${BASE}/topics/${encodeURIComponent(id)}`, payload, { auth: true })
  return { data, error }
}

export async function deleteBlogTopic(id) {
  const { error } = await apiDelete(`${BASE}/topics/${encodeURIComponent(id)}`, { auth: true })
  return { error }
}

export async function importBlogSheet(payload) {
  const { data, error } = await apiPost(`${BASE}/import-sheet`, payload, { auth: true })
  return { data, error }
}

/** "Write next post" ({}), a specific topic ({ topicId }), or the whole
 * queue as a batch ({ all: true }). Refused (409) if the writer is offline
 * or a request is already in flight. */
export async function requestBlogWrite(payload = {}) {
  const { data, error } = await apiPost(`${BASE}/request`, payload, { auth: true })
  return { data, error }
}

/** Stops the batch after the post being written right now finishes. */
export async function stopBlogBatch() {
  const { data, error } = await apiDelete(`${BASE}/batch`, { auth: true })
  return { data, error }
}

export async function closeBlogSummary() {
  const { data, error } = await apiDelete(`${BASE}/summary`, { auth: true })
  return { data, error }
}

/** Dismiss a finished (done/failed) run from the recent list. */
export async function dismissBlogRun(id) {
  const { data, error } = await apiDelete(`${BASE}/runs/${encodeURIComponent(id)}`, { auth: true })
  return { data, error }
}

export async function retryBlogRun(id) {
  const { data, error } = await apiPost(`${BASE}/runs/${encodeURIComponent(id)}/retry`, {}, { auth: true })
  return { data, error }
}

export async function fetchBlogSchedules() {
  const { data, error } = await apiGet(`${BASE}/schedules`, { auth: true })
  return { data: data?.schedules || [], error }
}

/** { name?, enabled?, mode? ('queue'|'sources'), time? ('HH:MM'), timezone? (IANA), postsPerDay? } */
export async function createBlogSchedule(payload) {
  const { data, error } = await apiPost(`${BASE}/schedules`, payload, { auth: true })
  return { data, error }
}

export async function updateBlogSchedule(id, payload) {
  const { data, error } = await apiPatch(`${BASE}/schedules/${encodeURIComponent(id)}`, payload, { auth: true })
  return { data, error }
}

/** Deleting a schedule returns its keywords to the main queue. */
export async function deleteBlogSchedule(id) {
  const { data, error } = await apiDelete(`${BASE}/schedules/${encodeURIComponent(id)}`, { auth: true })
  return { data, error }
}

export async function fetchScheduleKeywords(id, { skip, limit } = {}) {
  const params = new URLSearchParams()
  if (skip != null) params.set('skip', String(skip))
  if (limit != null) params.set('limit', String(limit))
  const qs = params.toString()
  const { data, error } = await apiGet(`${BASE}/schedules/${encodeURIComponent(id)}/keywords${qs ? `?${qs}` : ''}`, { auth: true })
  return { data, error }
}

/** { topics: string, splitCommas?: boolean } — topics is raw pasted text, one per line. */
export async function addScheduleKeywords(id, payload) {
  const { data, error } = await apiPost(`${BASE}/schedules/${encodeURIComponent(id)}/keywords`, payload, { auth: true })
  return { data, error }
}

/** Moves the whole main queue into a schedule (existing or new). */
export async function transferBlogQueue(payload = {}) {
  const { data, error } = await apiPost(`${BASE}/transfer`, payload, { auth: true })
  return { data, error }
}
