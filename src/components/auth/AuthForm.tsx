'use client'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { registerWithEmail, loginWithEmail, loginWithGoogle } from '@/lib/firebase/auth'
import styles from './AuthForm.module.css'

interface FormValues {
  name?: string
  mobile?: string
  email: string
  password: string
}

// Name + mobile are required only when registering; login just needs email + password.
function makeSchema(isRegister: boolean) {
  return z.object({
    name: isRegister ? z.string().trim().min(1, 'Enter your name') : z.string().optional(),
    mobile: isRegister
      ? z.string().regex(/^\d{7,15}$/, 'Enter a valid mobile number (digits only)')
      : z.string().optional(),
    email: z.string().email('Enter a valid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
  })
}

export function AuthForm({ mode }: { mode: 'register' | 'login' }) {
  const router = useRouter()
  const [formError, setFormError] = useState<string | null>(null)
  const isRegister = mode === 'register'

  const schema = useMemo(() => makeSchema(isRegister), [isRegister])
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) as Resolver<FormValues> })

  async function onSubmit(values: FormValues) {
    setFormError(null)
    try {
      if (isRegister) {
        await registerWithEmail(
          values.name?.trim() || '',
          values.email,
          values.password,
          values.mobile?.trim() || '',
        )
      } else {
        await loginWithEmail(values.email, values.password)
      }
      router.push('/account')
    } catch (err) {
      setFormError(messageFor(err))
    }
  }

  async function onGoogle() {
    setFormError(null)
    try {
      await loginWithGoogle()
      router.push('/account')
    } catch (err) {
      setFormError(messageFor(err))
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
      <h1 className={styles.heading}>{isRegister ? 'Create your account' : 'Welcome back'}</h1>

      {isRegister && (
        <div className={styles.field}>
          <label className={styles.label} htmlFor="name">Full name</label>
          <input className={styles.input} id="name" type="text" autoComplete="name"
            placeholder="Thabo Modise" {...register('name')} />
          {errors.name && <p className={styles.error}>{errors.name.message}</p>}
        </div>
      )}

      {isRegister && (
        <div className={styles.field}>
          <label className={styles.label} htmlFor="mobile">Mobile number</label>
          <input
            className={styles.input}
            id="mobile"
            type="tel"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="tel"
            placeholder="71234567"
            {...register('mobile', {
              // Strip anything that isn't a digit as the user types.
              onChange: (e) => {
                e.target.value = e.target.value.replace(/\D/g, '')
              },
            })}
          />
          {errors.mobile && <p className={styles.error}>{errors.mobile.message}</p>}
        </div>
      )}

      <div className={styles.field}>
        <label className={styles.label} htmlFor="email">Email</label>
        <input className={styles.input} id="email" type="email" autoComplete="email"
          placeholder="you@example.com" {...register('email')} />
        {errors.email && <p className={styles.error}>{errors.email.message}</p>}
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="password">Password</label>
        <input className={styles.input} id="password" type="password"
          autoComplete={isRegister ? 'new-password' : 'current-password'}
          placeholder="••••••••" {...register('password')} />
        {errors.password && <p className={styles.error}>{errors.password.message}</p>}
      </div>

      {formError && <p className={styles.error} role="alert">{formError}</p>}

      <Button type="submit" block disabled={isSubmitting}>
        {isSubmitting ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}
      </Button>

      <div className={styles.divider}><span>or</span></div>

      <Button type="button" variant="secondary" block onClick={onGoogle} disabled={isSubmitting}>
        Continue with Google
      </Button>

      <p className={styles.switch}>
        {isRegister ? (
          <>Already have an account? <Link href="/login">Sign in</Link></>
        ) : (
          <>New to 31Repairs? <Link href="/register">Create an account</Link></>
        )}
      </p>
    </form>
  )
}

function messageFor(err: unknown): string {
  const code = (err as { code?: string })?.code ?? ''
  switch (code) {
    case 'auth/email-already-in-use':
      return 'That email is already registered. Try signing in instead.'
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect email or password.'
    case 'auth/popup-closed-by-user':
      return 'Google sign-in was cancelled.'
    case 'permission-denied':
      return 'We could not save your profile. Please try again or contact us.'
    default:
      return 'Something went wrong. Please try again.'
  }
}
