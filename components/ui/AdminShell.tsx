/**
 * AdminShell — layout for authenticated admin pages
 * Darker navy header, sidebar nav on desktop, queue-first layout
 */

import Link from 'next/link'

interface AdminShellProps {
  children: React.ReactNode
  activePath?: string
}

const NAV_ITEMS = [
  { href: '/admin', label: 'Needs Attention' },
  { href: '/admin/applications', label: 'Applications' },
  { href: '/admin/financial-aid', label: 'Financial Aid' },
  { href: '/admin/registrations', label: 'Registrations' },
  { href: '/admin/payments', label: 'Payments' },
  { href: '/admin/sponsors', label: 'Sponsors' },
  { href: '/admin/teams', label: 'Teams' },
  { href: '/admin/iq-teams', label: 'IQ Teams' },
  { href: '/admin/families', label: 'Families' },
  { href: '/admin/volunteers', label: 'Volunteers' },
  { href: '/admin/sync', label: 'Sync Issues' },
  { href: '/admin/settings', label: 'Settings' },
  { href: '/admin/admins', label: 'Admins' },
  { href: '/admin/import', label: 'Import' },
  { href: '/admin/import-applicants', label: 'Import Applicants' },
  { href: '/admin/import-volunteers', label: 'Import Volunteers' },
  { href: '/admin/import-teams', label: 'Import Teams' },
]

export function AdminShell({ children, activePath = '/admin' }: AdminShellProps) {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-bg-light)' }}>
      {/* Header */}
      <header
        style={{
          backgroundColor: 'var(--color-navy-darker)',
          padding: '0 1.5rem',
          height: '52px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span
            className="font-display"
            style={{ color: 'var(--color-gold)', fontSize: '1rem', fontWeight: 700 }}
          >
            Placer Robotics
          </span>
          <span
            style={{
              backgroundColor: 'rgba(242,195,82,0.15)',
              color: 'var(--color-gold)',
              fontSize: '0.6875rem',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: '999px',
              letterSpacing: '0.05em',
              textTransform: 'uppercase' as const,
            }}
          >
            Admin
          </span>
        </div>

        <Link
          href="/dashboard"
          style={{ color: 'var(--color-blue-gray)', fontSize: '0.8125rem', textDecoration: 'none' }}
        >
          Exit admin
        </Link>
      </header>

      <div style={{ display: 'flex' }}>
        {/* Sidebar */}
        <nav
          style={{
            width: '200px',
            minHeight: 'calc(100vh - 52px)',
            backgroundColor: 'var(--color-navy-deep)',
            padding: '1.25rem 0',
            flexShrink: 0,
          }}
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activePath === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'block',
                  padding: '0.5rem 1.25rem',
                  fontSize: '0.875rem',
                  color: isActive ? 'var(--color-gold)' : 'var(--color-blue-gray)',
                  textDecoration: 'none',
                  backgroundColor: isActive ? 'rgba(242,195,82,0.08)' : 'transparent',
                  borderLeft: isActive ? '2px solid var(--color-gold)' : '2px solid transparent',
                  transition: 'color 0.15s',
                }}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Main content */}
        <main style={{ flex: 1, padding: '1.75rem 2rem', minWidth: 0 }}>
          {children}
        </main>
      </div>
    </div>
  )
}
