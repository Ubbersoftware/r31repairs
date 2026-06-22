'use client'
import { createContext, useEffect, useState } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { auth } from '@/lib/firebase/client'

export type Role = 'customer' | 'owner'
export interface AuthClaims {
  role: Role
}
export interface AuthState {
  user: User | null
  claims: AuthClaims | null
  loading: boolean
}

export const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, claims: null, loading: true })

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setState({ user: null, claims: null, loading: false })
        return
      }
      // Read the custom claim (role) from the ID token; owners are granted it via setOwner.
      const token = await user.getIdTokenResult()
      const role = (token.claims.role as Role) ?? 'customer'
      setState({ user, claims: { role }, loading: false })
    })
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}
