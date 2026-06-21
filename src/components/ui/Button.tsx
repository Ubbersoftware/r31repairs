import Link from 'next/link'
import type { ComponentProps, ReactNode } from 'react'
import styles from './Button.module.css'

type Variant = 'primary' | 'secondary' | 'ghost'

type BaseProps = {
  variant?: Variant
  size?: 'md' | 'lg'
  block?: boolean
  className?: string
  children?: ReactNode
}

type ButtonProps = BaseProps & Omit<ComponentProps<'button'>, keyof BaseProps> & { href?: undefined }
type LinkProps = BaseProps & Omit<ComponentProps<typeof Link>, keyof BaseProps> & { href: string }

export function Button(props: ButtonProps | LinkProps) {
  const { variant = 'primary', size = 'md', block, className, ...rest } = props
  const cls = [
    styles.btn,
    styles[variant],
    size === 'lg' && styles.lg,
    block && styles.block,
    className,
  ]
    .filter(Boolean)
    .join(' ')

  if (typeof props.href === 'string') {
    return <Link className={cls} {...(rest as ComponentProps<typeof Link>)} />
  }
  return <button className={cls} {...(rest as ComponentProps<'button'>)} />
}
