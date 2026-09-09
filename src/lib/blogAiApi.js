import { apiGet, apiPost, apiPut } from './apiClient'

// Auto Blog generation-settings + run API. Everything about *connecting*
// Claude/Codex accounts (accounts CRUD, the "connect in browser" flows,
// Codex status/disconnect, bulk test) lives in aiConnectionsApi.js instead —
// this file only covers what's left on AdminBlogAiPage.jsx: the shared
// generation settings, "Run Now", and the run history table.

const BASE = '/api/admin/blog-ai'

export async function fetchBlogAiSettings() {
  const { data, error } = await apiGet(`${BASE}/settings`, { auth: true })
  return { data, error }
}

export async function saveBlogAiSettings(payload) {
  const { data, error } = await apiPut(`${BASE}/settings`, payload, { auth: true })
  return { data, error }
}

export async function runBlogAiNow() {
  const { data, error } = await apiPost(`${BASE}/run-now`, undefined, { auth: true })
  return { data, error }
}

export async function fetchBlogAiRuns(limit = 50) {
  const { data, error } = await apiGet(`${BASE}/runs?limit=${encodeURIComponent(limit)}`, { auth: true })
  return { data, error }
}

// -- AI drafts ---------------------------------------------------------------
//
// Generated posts land in blog_ai_drafts, NOT blog_posts — nothing reaches
// the live blog table until it's approved here (or passes the automated
// checker once its review window expires). The Blog Library page lists these
// alongside real posts so there's one place to see everything.

export async function fetchBlogAiDrafts(status = 'pending_review', limit = 50) {
  const query = new URLSearchParams({ limit: String(limit) })
  if (status) query.set('status', status)

  const { data, error } = await apiGet(`${BASE}/drafts?${query.toString()}`, { auth: true })
  return { data, error }
}

export async function approveBlogAiDraft(id) {
  const { data, error } = await apiPost(`${BASE}/drafts/${encodeURIComponent(id)}/approve`, undefined, { auth: true })
  return { data, error }
}

export async function rejectBlogAiDraft(id) {
  const { data, error } = await apiPost(`${BASE}/drafts/${encodeURIComponent(id)}/reject`, undefined, { auth: true })
  return { data, error }
}
