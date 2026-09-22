// Splits a post's HTML content into "before" and "after" halves so a CTA
// banner can sit between them, without ever cutting the HTML mid-tag.
//
// Two ways a post says where the banner goes:
//
//   1. A slot the Blog Writer's importer left behind — the writer places a
//      [[CTA]] token at one natural break and the importer swaps it for an
//      empty paragraph carrying CTA_PLACEHOLDER_CLASS. That is the writer's
//      own choice of position and it wins outright.
//   2. Nothing. Hand-written posts, and everything written before the slot
//      existed, are split after the third block element instead, which is
//      good enough for where a banner visually belongs.
//
// Only ever called for posts that actually have a cta_variant; a post without
// one renders exactly as it always has.

/** Must match CTA_PLACEHOLDER_CLASS in the backend's lib/image-placement.ts. */
export const CTA_PLACEHOLDER_CLASS = 'ghl-cta-placeholder'

const SLOT_RE = /<p\b[^>]*\bclass=["'][^"']*\bghl-cta-placeholder\b[^"']*["'][^>]*>\s*<\/p>/i

const BLOCK_CLOSE_TAGS = ['</p>', '</h2>', '</h3>', '</ul>', '</ol>', '</blockquote>', '</figure>', '</table>']

export function splitContentForCta(html, { afterBlocks = 3 } = {}) {
  if (!html || typeof html !== 'string') return { before: html || '', after: '' }

  // The writer's own slot, when there is one.
  const slot = SLOT_RE.exec(html)
  if (slot) {
    return { before: html.slice(0, slot.index), after: html.slice(slot.index + slot[0].length) }
  }

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
    // Short post — the banner goes at the very end instead of not appearing.
    return { before: html, after: '' }
  }

  const cut = breakpoints[afterBlocks - 1]
  return { before: html.slice(0, cut), after: html.slice(cut) }
}
