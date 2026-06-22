import type { Metadata } from 'next'
import { AuthForm } from '@/components/auth/AuthForm'

export const metadata: Metadata = {
  title: 'Sign in — 31Repairs',
}

export default function LoginPage() {
  return (
    <section className="section">
      <div className="container">
        <AuthForm mode="login" />
      </div>
    </section>
  )
}
