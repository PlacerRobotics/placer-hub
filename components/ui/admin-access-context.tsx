'use client'

import { createContext, useContext } from 'react'

type Access = { roles: string[]; isSuper: boolean }
const AdminAccessContext = createContext<Access>({ roles: [], isSuper: false })

export function AdminAccessProvider({ roles, isSuper, children }: { roles: string[]; isSuper: boolean; children: React.ReactNode }) {
  return <AdminAccessContext.Provider value={{ roles, isSuper }}>{children}</AdminAccessContext.Provider>
}

export function useAdminAccess() {
  return useContext(AdminAccessContext)
}
