# Sitemap Rebuild Setup

## Problem
When new blog posts are published via the AI Blog Writer or manually, the `sitemap.xml` file was not automatically updated. Sitemaps are only regenerated during the build process (`npm run build`), which meant new blog post URLs would not be indexed by search engines until the next deployment.

## Solution
We've implemented an **on-demand sitemap regeneration system** with two components:

### 1. API Endpoint (`/api/admin/rebuild-sitemap`)
A secure Next.js API route that rebuilds the sitemap immediately upon request.

**Location**: `src/app/api/admin/rebuild-sitemap/route.ts`

**Authentication**: Requires `ADMIN_SECRET` environment variable

**Endpoints**:
- `POST /api/admin/rebuild-sitemap` — Trigger sitemap rebuild
- `GET /api/admin/rebuild-sitemap` — Health check

### 2. Utility Module (`src/lib/sitemapRebuilder.ts`)
Provides TypeScript functions to trigger sitemap rebuilds from blog publishing workflows.

**Functions**:
- `rebuildSitemap(adminSecret)` — Trigger rebuild and return result
- `checkSitemapEndpoint(adminSecret)` — Verify endpoint availability

## Setup Instructions

### Step 1: Set Environment Variable
Add to your `.env` or Vercel project settings:

```env
ADMIN_SECRET=your-secure-random-string-here
```

Generate a secure secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 2: Integrate into Blog Publishing Flow
In your blog publishing API or admin component, call the rebuild function after a post is published:

```typescript
import { rebuildSitemap } from '@/lib/sitemapRebuilder'

// After saving blog post
const adminSecret = process.env.NEXT_PUBLIC_ADMIN_SECRET || process.env.ADMIN_SECRET
if (adminSecret) {
  const result = await rebuildSitemap(adminSecret)
  if (result.success) {
    console.log('Sitemap updated with new blog post')
  } else {
    console.warn('Failed to rebuild sitemap:', result.error)
  }
}
```

### Step 3: (Optional) Add to Deployment Pipeline
For CI/CD automation, rebuild the sitemap after deployment:

```yaml
# Example: GitHub Actions
- name: Rebuild Sitemap
  run: |
    curl -X POST https://ghlprime.com/api/admin/rebuild-sitemap \
      -H "Authorization: Bearer ${{ secrets.ADMIN_SECRET }}"
```

## Testing

### Manual Test
```bash
# Test the endpoint
curl -X POST http://localhost:3000/api/admin/rebuild-sitemap \
  -H "Authorization: Bearer your-admin-secret" \
  -H "Content-Type: application/json"
```

### Verification
After rebuild:
1. Check `public/sitemap.xml` contains your new blog posts
2. Submit updated sitemap to Google Search Console:
   - Go to [Google Search Console](https://search.google.com/search-console)
   - Select your property
   - Click "Sitemaps" in the left menu
   - Submit `https://ghlprime.com/sitemap.xml`

## How It Works

### Build Time (Original)
1. Run `npm run build`
2. `scripts/generate-sitemap.mjs` executes
3. Fetches blog posts from API
4. Generates `public/sitemap.xml`
5. Deploy the updated sitemap

### On-Demand (New)
1. New blog post is published
2. Blog publishing code calls `/api/admin/rebuild-sitemap` via the utility
3. API endpoint executes `scripts/generate-sitemap.mjs` immediately
4. Returns success/failure response
5. Updated `public/sitemap.xml` is immediately available

## Deployment on Vercel

### 1. Add ADMIN_SECRET to Vercel Project
```bash
vercel env add ADMIN_SECRET
```

### 2. Redeploy Current Production
```bash
vercel redeploy --prod
```

### 3. Verify Endpoint is Active
```bash
curl -I https://ghlprime.com/api/admin/rebuild-sitemap
```

## Troubleshooting

### Endpoint Returns 500 Error
- **Check**: `ADMIN_SECRET` is set in environment variables
- **Check**: Vercel has the latest deployment with the new API route
- **Check**: Server logs for execution errors

### Sitemap Not Updating
- **Check**: `rebuild-sitemap.mjs` script runs without errors
- **Check**: API can reach the backend at `VITE_API_URL`
- **Check**: Blog posts have valid `slug` field in database

### "Unauthorized" Error (401)
- **Check**: Authorization header is `Bearer YOUR_SECRET`
- **Check**: The token matches `ADMIN_SECRET` exactly
- **Check**: No extra whitespace in token

## Files Changed/Added

```
src/app/api/admin/rebuild-sitemap/route.ts  [NEW] API endpoint
src/lib/sitemapRebuilder.ts                 [NEW] Utility module
scripts/rebuild-sitemap.mjs                 [NEW] Standalone script
SITEMAP_DEPLOYMENT.md                       [NEW] This documentation
package.json                                [UNCHANGED] No new dependencies
```

## Future Enhancements

1. **Automatic Rebuild on Publish**: Integrate rebuild call into blog publishing workflow
2. **Webhook Support**: Accept webhooks from blog backend to trigger rebuilds
3. **Schedule Periodic Rebuilds**: Run sitemap rebuild on a cron schedule (e.g., daily)
4. **Search Engine Pinging**: Auto-notify Google/Bing of sitemap updates
5. **Monitoring**: Track rebuild success/failures and alert on issues

## References

- [sitemap.xml Location](https://github.com/vibeteamoctopidigital/ghlprime-updated/blob/main/scripts/generate-sitemap.mjs)
- [Blog API Endpoint](https://api.ghlprime.com/api/blog)
- [Google Search Console](https://search.google.com/search-console)
- [Sitemap Protocol](https://www.sitemaps.org/)
