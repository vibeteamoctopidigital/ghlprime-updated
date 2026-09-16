// Data layer for /admin/blog-writer and /admin/blog-schedules — same
// fetch-wrapper pattern every other admin *Api.js file already uses
// (see blogApi.js). Every route here is admin-gated on the backend, so
// every call passes { auth: true }.

import { apiDelete, apiGet, apiPost, apiPut } from './apiClient'

const BASE = '/api/blog-writer'

export async function fetchBlogWriterStatus() {
  const { data, error } = await apiGet(`${BASE}/status`, { auth: true })
  return { data, error }
}

export async function fetchBlogWriterSettings() {
  const { data, error } = await apiGet(`${BASE}/settings`, { auth: true })
  return { data, error }
}

export async function updateBlogWriterSettings(payload) {
  const { data, error } = await apiPut(`${BASE}/settings`, payload, { auth: true })
  return { data, error }
}

export async function stopBlogWriterQueue() {
  const { data, error } = await apiPost(`${BASE}/stop`, {}, { auth: true })
  return { data, error }
}

export async function fetchBlogTopics() {
  const { data, error } = await apiGet(`${BASE}/topics`, { auth: true })
  return { data: data || [], error }
}

export async function createBlogTopic(payload) {
  const { data, error } = await apiPost(`${BASE}/topics`, payload, { auth: true })
  return { data, error }
}

export async function deleteBlogTopic(id) {
  const { error } = await apiDelete(`${BASE}/topics/${encodeURIComponent(id)}`, { auth: true })
  return { error }
}

export async function fetchBlogWriteRequests({ status, cursor, limit } = {}) {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (cursor) params.set('cursor', cursor)
  if (limit) params.set('limit', String(limit))
  const qs = params.toString()

  const { data, error } = await apiGet(`${BASE}/requests${qs ? `?${qs}` : ''}`, { auth: true })
  return { data: data?.data || [], nextCursor: data?.next_cursor || null, error }
}

/** Queues "write next post" — either { topic_id } from the queue, or { ad_hoc_title } typed straight in. */
export async function createBlogWriteRequest(payload) {
  const { data, error } = await apiPost(`${BASE}/requests`, payload, { auth: true })
  return { data, error }
}

export async function retryBlogWriteRequest(id) {
  const { data, error } = await apiPost(`${BASE}/requests/${encodeURIComponent(id)}/retry`, {}, { auth: true })
  return { data, error }
}

export async function fetchBlogSchedules() {
  const { data, error } = await apiGet(`${BASE}/schedules`, { auth: true })
  return { data: data || [], error }
}

export async function createBlogSchedule(payload) {
  const { data, error } = await apiPost(`${BASE}/schedules`, payload, { auth: true })
  return { data, error }
}

export async function updateBlogSchedule(id, payload) {
  const { data, error } = await apiPut(`${BASE}/schedules/${encodeURIComponent(id)}`, payload, { auth: true })
  return { data, error }
}

export async function deleteBlogSchedule(id) {
  const { error } = await apiDelete(`${BASE}/schedules/${encodeURIComponent(id)}`, { auth: true })
  return { error }
}
