'use client'

import { SecondaryButton } from '@/components/ui'

export default function RosterDownload() {
  return (
    <SecondaryButton
      onClick={() => {
        window.location.href = '/api/admin/roster-export'
      }}
    >
      Download Roster
    </SecondaryButton>
  )
}
