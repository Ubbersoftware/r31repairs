import type { Metadata } from 'next'
import { AuthForm } from '@/components/auth/AuthForm'

export const metadata: Metadata = {
  title: 'Sign in — 31Repairs',
}

export default function LoginPage() {
  return <AuthForm mode="login" />
}
