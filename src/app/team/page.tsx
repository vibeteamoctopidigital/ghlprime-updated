import type { Metadata } from 'next'
import TeamPage from '../../pages/TeamPage'

export const metadata: Metadata = {
  title: 'Meet the GHL Prime Team Certified GoHighLevel Specialists',
  description:
    "Our GoHighLevel-certified team averages 4+ years of GHL experience. Meet the founders and specialists delivering backend execution under your agency's brand.",
  keywords:
    'GHL Prime team, GoHighLevel specialists, certified GoHighLevel admins, GoHighLevel experts, automation engineers',
  alternates: { canonical: 'https://ghlprime.com/team' },
  openGraph: {
    siteName: 'GHL Prime',
    locale: 'en_US',
    title: 'Meet the GHL Prime Team Certified GoHighLevel Specialists',
    description:
      "Our GoHighLevel-certified team averages 4+ years of GHL experience. Meet the founders and specialists delivering backend execution under your agency's brand.",
    url: 'https://ghlprime.com/team',
    images: ['https://ghlprime.com/og-ghlprime-gohighlevel-expert-agency.jpeg'],
    type: 'website',
  },
  twitter: {
    images: ['https://ghlprime.com/og-ghlprime-gohighlevel-expert-agency.jpeg'],
  },
  other: {
    'last-modified': '2026-05-24',
  },
}

export default function Page() {
  return <TeamPage />
}
