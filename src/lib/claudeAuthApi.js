// Data layer for /admin/claude-auth — same fetch-wrapper pattern as
// blogWriterApi.js. Every route here is admin-gated on the backend, so every
// call passes { auth: true }.

import { apiDelete, apiGet, apiPost } from './apiClient'

const BASE = '/api/claude-auth'

export async function fetchClaudeAuthStatus() {
  const { data, error } = await apiGet(`${BASE}/status`, { auth: true })
  return { data, error }
}

/** Starts the PTY login session; returns { started, url, error } in `data`. */
export async function startClaudeLogin() {
  const { data, error } = await apiPost(`${BASE}/login`, {}, { auth: true })
  return { data, error }
}

/** Polls the in-flight session: URL, terminal tail, whether login completed. */
export async function pollClaudeLogin() {
  const { data, error } = await apiGet(`${BASE}/login`, { auth: true })
  return { data, error }
}

export async function submitClaudeLoginCode(code) {
  const { data, error } = await apiPost(`${BASE}/login/code`, { code }, { auth: true })
  return { data, error }
}

export async function cancelClaudeLogin() {
  const { data, error } = await apiDelete(`${BASE}/login`, { auth: true })
  return { data, error }
}

export async function logoutClaudeAccount() {
  const { data, error } = await apiPost(`${BASE}/logout`, {}, { auth: true })
  return { data, error }
}
