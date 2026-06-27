// src/app/admin/settings/page.tsx
import { SettingsForm } from './SettingsForm'

export default function AdminSettingsPage() {
  return (
    <section style={{ marginTop: 'var(--space-5)' }}>
      <h1 style={{ color: 'var(--text-strong)' }}>Settings</h1>
      <SettingsForm />
    </section>
  )
}
