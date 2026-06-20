import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Placer Robotics Hub',
    template: '%s | Placer Robotics Hub',
  },
  description: 'Registration and family portal for Placer Advanced Robotics and Technology.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-light)' }}>
        {children}
      </body>
    </html>
  )
}
