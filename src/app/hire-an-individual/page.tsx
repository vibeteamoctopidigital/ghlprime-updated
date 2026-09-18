import type { Metadata } from 'next'
import HireIndividualPage from '../../pages/HireIndividualPage'

export const metadata: Metadata = {
  title: 'Hire an Individual GoHighLevel Specialist | GHL Prime',
  description:
    'Hire one dedicated, GHL-certified specialist matched to your exact need automation, funnel design, AI agents, or custom development. No agency-wide retainer required.',
  keywords:
    'hire a GoHighLevel specialist, hire a GHL expert, hire GoHighLevel automation specialist, hire an individual freelancer GHL',
  alternates: { canonical: 'https://ghlprime.com/hire-an-individual' },
  openGraph: {
    siteName: 'GHL Prime',
    locale: 'en_US',
    title: 'Hire an Individual GoHighLevel Specialist | GHL Prime',
    description:
      'Hire one dedicated, GHL-certified specialist matched to your exact need automation, funnel design, AI agents, or custom development.',
    url: 'https://ghlprime.com/hire-an-individual',
    images: ['https://ghlprime.com/og-ghlprime-gohighlevel-expert-agency.png'],
    type: 'website',
  },
  twitter: {
    images: ['https://ghlprime.com/og-ghlprime-gohighlevel-expert-agency.png'],
  },
  other: {
    'last-modified': '2026-09-18',
  },
}

export default function Page() {
  return <HireIndividualPage />
}
