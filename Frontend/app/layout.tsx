import './globals.css'
import { Fraunces } from 'next/font/google'

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
})

export const metadata = {
  title: 'Asistente de Empleabilidad — Herramientas gratis con IA',
  description:
    'Practicá entrevistas, optimizá tu CV y tu LinkedIn, armá tu plan de carrera y preparate para negociar tu oferta. Gratis, con tu propia API Key de Gemini.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={fraunces.variable}>
      <body>{children}</body>
    </html>
  )
}
