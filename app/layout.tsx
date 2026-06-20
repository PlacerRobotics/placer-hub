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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Goldman:wght@400;700&family=Inter:wght@400;500;600;700&display=swap"
        />
      </head>
      <body className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-light)' }}>
        {children}
      </body>
    </html>
  )
}
