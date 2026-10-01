/**
 * Sitemap Rebuilder Utility
 * 
 * This module provides a client-safe way to trigger sitemap rebuilds
 * after new blog posts are published via the AI Blog Writer or manual publishing.
 */

interface RebuildResponse {
  success: boolean
  message?: string
  error?: string
  details?: string
}

/**
 * Triggers an immediate sitemap regeneration
 * Should be called after publishing new blog posts
 * 
 * @param adminSecret - The admin secret for authentication (from env vars)
 * @returns Response object indicating success or failure
 */
export async function rebuildSitemap(adminSecret: string): Promise<RebuildResponse> {
  if (!adminSecret) {
    console.warn('[sitemapRebuilder] No admin secret provided')
    return {
      success: false,
      error: 'Admin secret not configured',
    }
  }

  try {
    const baseUrl = typeof window === 'undefined' 
      ? process.env.VITE_API_URL || 'http://localhost:3000'
      : window.location.origin

    const response = await fetch(`${baseUrl}/api/admin/rebuild-sitemap`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminSecret}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      return {
        success: false,
        error: error.error || `HTTP ${response.status}`,
        details: error.details,
      }
    }

    const data = await response.json() as RebuildResponse
    return data
  } catch (error: any) {
    console.error('[sitemapRebuilder] Failed to rebuild sitemap:', error)
    return {
      success: false,
      error: 'Network error while rebuilding sitemap',
      details: error?.message,
    }
  }
}

/**
 * Health check for the sitemap rebuild endpoint
 */
export async function checkSitemapEndpoint(adminSecret: string): Promise<boolean> {
  if (!adminSecret) return false

  try {
    const baseUrl = typeof window === 'undefined' 
      ? process.env.VITE_API_URL || 'http://localhost:3000'
      : window.location.origin

    const response = await fetch(`${baseUrl}/api/admin/rebuild-sitemap`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${adminSecret}`,
      },
    })

    return response.ok
  } catch {
    return false
  }
}
