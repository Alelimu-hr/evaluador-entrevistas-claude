import './globals.css'
import { Fraunces } from 'next/font/google'

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
})

const TITULO = 'Asistente de Empleabilidad — Herramientas gratis con IA'
const DESCRIPCION =
  'Practicá entrevistas, optimizá tu CV y tu LinkedIn, armá tu plan de carrera y preparate para negociar tu oferta. Gratis, con tu propia API Key de Gemini.'

export const metadata = {
  metadataBase: new URL('https://chelaburo.com'),
  title: TITULO,
  description: DESCRIPCION,
  openGraph: {
    title: TITULO,
    description: DESCRIPCION,
    url: 'https://chelaburo.com',
    siteName: 'Asistente de Empleabilidad',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
    locale: 'es_AR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITULO,
    description: DESCRIPCION,
    images: ['/og-image.png'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={fraunces.variable}>
      <body>{children}</body>
    </html>
  )
}
