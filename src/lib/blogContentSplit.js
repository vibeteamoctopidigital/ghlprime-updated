// Splits a post's HTML content into "before" and "after" halves so a CTA
// banner can sit between them, without ever cutting the HTML mid-tag.
//
// Only ever called for posts that actually have a cta_variant (every
// pre-existing post has this as null/undefined, since it's one of the new
// optional Blog Writer columns) — see BlogPostPage.jsx's usage. A post
// without one renders exactly as it always has.

const BLOCK_CLOSE_TAGS = ['</p>', '</h2>', '</h3>', '</ul>', '</ol>', '</blockquote>', '</figure>']

/**
 * Finds every index right after a top-level block element closes, then picks
 * the one closest to (but not past) the target paragraph count — "paragraph"
 * here loosely means "one block element," which is good enough for where a
 * CTA banner visually belongs.
 */
export function splitContentForCta(html, { afterBlocks = 3 } = {}) {
  if (!html || typeof html !== 'string') return { before: html || '', after: '' }

  const breakpoints = []
  let searchFrom = 0
  for (let i = 0; i < 200; i += 1) {
    let nearest = -1
    let nearestTag = null
    for (const tag of BLOCK_CLOSE_TAGS) {
      const idx = html.indexOf(tag, searchFrom)
      if (idx !== -1 && (nearest === -1 || idx < nearest)) {
        nearest = idx
        nearestTag = tag
      }
    }
    if (nearest === -1) break
    const end = nearest + nearestTag.length
    breakpoints.push(end)
    searchFrom = end
  }

  if (breakpoints.length <= afterBlocks) {
    // Short post — not enough blocks to split meaningfully. The banner goes
    // at the very end instead of not appearing at all.
    return { before: html, after: '' }
  }

  const cut = breakpoints[afterBlocks - 1]
  return { before: html.slice(0, cut), after: html.slice(cut) }
}
