/**
 * AdminShell — layout for authenticated admin pages
 * Darker navy header, sidebar nav on desktop, hamburger drawer on mobile.
 */

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { canAccessAdmin } from '@/lib/auth/roles'
import { useAdminAccess } from './admin-access-context'

interface AdminShellProps {
  children: React.ReactNode
  activePath?: string
}

const NAV_ITEMS = [
  { href: '/admin', label: 'Needs Attention' },
  { href: '/admin/applications', label: 'Applications' },
  { href: '/admin/financial-aid', label: 'Financial Aid' },
  { href: '/admin/registrations', label: 'Registrations' },
  { href: '/admin/registrations-iq', label: 'IQ Registrations' },
  { href: '/admin/reports', label: 'Reports' },
  { href: '/admin/payments', label: 'Payments' },
  { href: '/admin/sponsors', label: 'Sponsors' },
  { href: '/admin/teams', label: 'Teams' },
  { href: '/admin/vex-stats', label: 'VEX Competition Record' },
  { href: '/admin/combat', label: 'Combat Results' },
  { href: '/admin/cavitt', label: 'Cavitt / 9537' },
  { href: '/admin/iq-teams', label: 'IQ Teams' },
  { href: '/admin/families', label: 'Families' },
  { href: '/admin/volunteers', label: 'Volunteers' },
  { href: '/admin/slack', label: 'Slack' },
  { href: '/admin/google-groups', label: 'Google Groups' },
  { href: '/admin/sync', label: 'Sync Issues' },
  { href: '/admin/settings', label: 'Settings' },
  { href: '/admin/admins', label: 'Admins' },
  { href: '/admin/import', label: 'Import' },
  { href: '/admin/import-applicants', label: 'Import Applicants' },
  { href: '/admin/import-volunteers', label: 'Import Volunteers' },
  { href: '/admin/import-teams', label: 'Import Teams' },
]

export function AdminShell({ children, activePath = '/admin' }: AdminShellProps) {
  const [open, setOpen] = useState(false)
  const { roles, isSuper } = useAdminAccess()
  const navItems = NAV_ITEMS.filter((item) => canAccessAdmin(roles, isSuper, item.href))

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-bg-light)' }}>
      {/* Header */}
      <header
        style={{
          backgroundColor: 'var(--color-navy-darker)',
          padding: '0 1rem',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <button
            type="button"
            className="admin-menu-btn"
            aria-label="Toggle menu"
            onClick={() => setOpen((o) => !o)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-gold)',
              fontSize: '1.4rem',
              lineHeight: 1,
              cursor: 'pointer',
              padding: 0,
              alignItems: 'center',
            }}
          >
            ☰
          </button>
          <span className="font-display" style={{ color: 'var(--color-gold)', fontSize: '1rem', fontWeight: 700 }}>
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

        <Link href="/dashboard" style={{ color: 'var(--color-blue-gray)', fontSize: '0.8125rem', textDecoration: 'none' }}>
          Exit admin
        </Link>
      </header>

      <div style={{ display: 'flex' }}>
        {/* Backdrop (mobile, when drawer open) */}
        <div className={`admin-overlay${open ? ' admin-overlay--open' : ''}`} onClick={() => setOpen(false)} />

        {/* Sidebar / drawer */}
        <nav
          className={`admin-nav${open ? ' admin-nav--open' : ''}`}
          style={{
            width: '200px',
            minHeight: 'calc(100vh - 52px)',
            backgroundColor: 'var(--color-navy-deep)',
            padding: '1.25rem 0',
            flexShrink: 0,
          }}
        >
          {navItems.map((item) => {
            const isActive = activePath === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                style={{
                  display: 'block',
                  padding: '0.625rem 1.25rem',
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
        <main className="admin-main" style={{ flex: 1, padding: '1.75rem 2rem', minWidth: 0 }}>
          {children}
        </main>
      </div>
    </div>
  )
}
