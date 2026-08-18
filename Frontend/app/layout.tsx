import './globals.css'

export const metadata = {
  title: 'Simulador de Entrevistas',
  description: 'Practicá entrevistas laborales con feedback de IA',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
