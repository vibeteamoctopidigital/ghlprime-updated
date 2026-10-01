import { NextRequest, NextResponse } from 'next/server'
import { execSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

// Get the project root directory
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '../../../../../..')

/**
 * POST /api/admin/rebuild-sitemap
 * 
 * Rebuilds the sitemap.xml file immediately after new blog posts are published.
 * This ensures search engines pick up new content immediately without waiting
 * for the next scheduled build/deployment.
 * 
 * Authentication: Requires ADMIN_SECRET header
 * 
 * Usage:
 * curl -X POST https://ghlprime.com/api/admin/rebuild-sitemap \
 *   -H "Authorization: Bearer YOUR_ADMIN_SECRET"
 */
export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const authHeader = request.headers.get('authorization')
    const adminSecret = process.env.ADMIN_SECRET

    if (!adminSecret) {
      return NextResponse.json(
        { error: 'ADMIN_SECRET not configured' },
        { status: 500 }
      )
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid Authorization header' },
        { status: 401 }
      )
    }

    const token = authHeader.slice(7)
    if (token !== adminSecret) {
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      )
    }

    // Run the sitemap generation script
    console.log('[rebuild-sitemap] Starting sitemap regeneration...')
    
    try {
      const output = execSync(
        `node ${path.join(projectRoot, 'scripts/generate-sitemap.mjs')}`,
        {
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
          cwd: projectRoot,
          timeout: 30000, // 30 second timeout
        }
      )

      console.log('[rebuild-sitemap] Sitemap regeneration successful')
      console.log('[rebuild-sitemap] Output:', output)

      return NextResponse.json(
        {
          success: true,
          message: 'Sitemap regenerated successfully',
          details: output,
        },
        { status: 200 }
      )
    } catch (execError: any) {
      const errorMsg = execError?.stderr || execError?.message || 'Unknown error'
      console.error('[rebuild-sitemap] Execution error:', errorMsg)

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to regenerate sitemap',
          details: errorMsg,
        },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('[rebuild-sitemap] Unexpected error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Unexpected error during sitemap rebuild',
        details: error?.message || 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/rebuild-sitemap
 * 
 * Health check endpoint - returns the current sitemap status
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const adminSecret = process.env.ADMIN_SECRET

    if (!adminSecret || !authHeader?.startsWith('Bearer ') || authHeader.slice(7) !== adminSecret) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      {
        status: 'ready',
        message: 'Sitemap rebuild endpoint is available. Send POST request to rebuild.',
        endpoint: '/api/admin/rebuild-sitemap',
      },
      { status: 200 }
    )
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Unknown error' },
      { status: 500 }
    )
  }
}
