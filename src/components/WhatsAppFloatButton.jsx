'use client'

import { usePathname } from 'next/navigation'
import './whatsapp-float.css'

// The site's real US contact number (same one in the footer's phone link and
// the Organization/LocalBusiness schema in App.jsx: +1-505-207-5189) -- kept
// in sync with SiteFooter.jsx's "Talk to Founder" link, which points here too.
const WHATSAPP_NUMBER = '15052075189'
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}`

export default function WhatsAppFloatButton() {
  const pathname = usePathname()
  const isAuthLayout = pathname === '/login' || pathname.startsWith('/admin')

  if (isAuthLayout) return null

  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="whatsapp-float"
      aria-label="Chat with us on WhatsApp"
      title="Chat with us on WhatsApp"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="whatsapp-float-icon">
        <path
          fill="currentColor"
          d="M17.47 14.38c-.29-.15-1.7-.84-1.97-.93c-.26-.1-.46-.15-.65.14c-.2.3-.75.94-.91 1.13c-.17.2-.34.22-.63.08c-.29-.15-1.22-.45-2.33-1.44c-.86-.77-1.44-1.71-1.61-2c-.17-.3-.02-.46.13-.6c.13-.13.3-.34.44-.51c.15-.17.2-.3.3-.49c.1-.2.05-.37-.02-.52c-.08-.15-.65-1.58-.9-2.16c-.24-.58-.48-.5-.65-.5c-.17-.01-.37-.01-.56-.01c-.2 0-.52.07-.79.37c-.27.3-1.04 1.02-1.04 2.48c0 1.46 1.07 2.87 1.22 3.07c.15.2 2.1 3.2 5.08 4.49c.71.3 1.26.49 1.69.62c.71.23 1.36.2 1.87.12c.57-.09 1.7-.7 1.94-1.37c.24-.67.24-1.25.17-1.37c-.07-.12-.26-.2-.55-.34Z"
        />
        <path
          fill="currentColor"
          d="M12.02 2C6.5 2 2.03 6.44 2.03 11.92c0 1.75.46 3.44 1.32 4.94L2 22l5.29-1.38a10.05 10.05 0 0 0 4.73 1.2h.01c5.52 0 9.99-4.44 9.99-9.92C21.99 6.44 17.53 2 12.02 2Zm5.86 15.73a8.25 8.25 0 0 1-5.86 2.43a8.3 8.3 0 0 1-4.22-1.15l-.3-.18l-3.14.82l.84-3.06l-.2-.32a8.16 8.16 0 0 1-1.27-4.35c0-4.53 3.7-8.22 8.26-8.22c2.2 0 4.27.86 5.83 2.41a8.14 8.14 0 0 1 2.42 5.81c0 4.53-3.7 8.22-8.26 8.22Z"
        />
      </svg>
    </a>
  )
}
