'use client'
import { useEffect, useState } from 'react'
import { applyTheme, getInitialTheme, type Theme } from '@/lib/theme'
import styles from './ThemeToggle.module.css'

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('dark')
  useEffect(() => {
    setTheme(getInitialTheme())
  }, [])

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    setTheme(next)
  }

  return (
    <button
      type="button"
      className={styles.toggle}
      onClick={toggle}
      aria-label={`Switch theme (currently ${theme})`}
    >
      {theme === 'dark' ? '☀' : '☾'}
    </button>
  )
}
