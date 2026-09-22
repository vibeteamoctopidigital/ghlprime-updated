// Data layer for /admin/blog-writer and /admin/blog-schedules — the same
// fetch-wrapper pattern every other admin *Api.js file uses. Every route is
// admin-gated on the backend, so every call passes { auth: true }.
//
// Every helper resolves to `{ data, error }`; callers throw `error` into their
// own toast. The shapes of `data` are the backend's blogWriter.service.ts
// return values, one to one.

import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from './apiClient'

const BASE = '/api/blog-writer'
const AUTH = { auth: true }

/** Everything the writer screen needs in one round trip. */
export const fetchBlogWriterState = () => apiGet(`${BASE}/state`, AUTH)

export const createBlogTopic = (payload) => apiPost(`${BASE}/topics`, payload, AUTH)
export const bulkAddBlogTopics = (topics) => apiPost(`${BASE}/topics/bulk`, { topics }, AUTH)
export const updateBlogTopic = (id, payload) => apiPatch(`${BASE}/topics/${encodeURIComponent(id)}`, payload, AUTH)
export const deleteBlogTopic = (id) => apiDelete(`${BASE}/topics/${encodeURIComponent(id)}`, AUTH)
export const reorderBlogTopics = (ids) => apiPost(`${BASE}/topics/reorder`, { ids }, AUTH)

export const fetchBlogWriterDefaults = () => apiGet(`${BASE}/defaults`, AUTH)
export const saveBlogWriterDefaults = (defaults) => apiPut(`${BASE}/defaults`, defaults, AUTH)
export const applyBlogWriterDefaults = () => apiPost(`${BASE}/defaults/apply`, {}, AUTH)

export const importBlogSheet = (payload) => apiPost(`${BASE}/import-sheet`, payload, AUTH)

/** "Write next post" ({}), "Write all" ({ all: true }), or one topic ({ topicId }). */
export const requestBlogWrite = (payload = {}) => apiPost(`${BASE}/request`, payload, AUTH)
export const stopBlogBatch = () => apiDelete(`${BASE}/batch`, AUTH)
export const closeBlogSummary = () => apiDelete(`${BASE}/summary`, AUTH)

export const dismissBlogRun = (id) => apiDelete(`${BASE}/runs/${encodeURIComponent(id)}`, AUTH)
export const retryBlogRun = (id) => apiPost(`${BASE}/runs/${encodeURIComponent(id)}/retry`, {}, AUTH)

export const fetchBlogSchedules = () => apiGet(`${BASE}/schedules`, AUTH)
export const createBlogSchedule = (payload = {}) => apiPost(`${BASE}/schedules`, payload, AUTH)
export const updateBlogSchedule = (id, payload) => apiPatch(`${BASE}/schedules/${encodeURIComponent(id)}`, payload, AUTH)
export const deleteBlogSchedule = (id) => apiDelete(`${BASE}/schedules/${encodeURIComponent(id)}`, AUTH)

export const fetchScheduleKeywords = (id, { skip = 0, limit } = {}) => {
  const params = new URLSearchParams({ skip: String(skip) })
  if (limit) params.set('limit', String(limit))
  return apiGet(`${BASE}/schedules/${encodeURIComponent(id)}/keywords?${params.toString()}`, AUTH)
}
export const addScheduleKeywords = (id, payload) => apiPost(`${BASE}/schedules/${encodeURIComponent(id)}/keywords`, payload, AUTH)

export const transferBlogQueue = (payload = {}) => apiPost(`${BASE}/transfer`, payload, AUTH)
