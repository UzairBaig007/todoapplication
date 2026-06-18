'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { signup, type AuthState } from '@/app/actions/auth'

export function SignupForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(signup, undefined)

  return (
    <form action={action} className="flex flex-col gap-4">
      {state?.message && (
        <p data-testid="auth-error" className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {state.message}
        </p>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium text-foreground">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          data-testid="email-input"
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm text-foreground outline-none ring-foreground/20 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
        {state?.errors?.email && (
          <p className="text-xs text-red-600">{state.errors.email[0]}</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium text-foreground">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          data-testid="password-input"
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm text-foreground outline-none ring-foreground/20 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
        {state?.errors?.password && (
          <p className="text-xs text-red-600">{state.errors.password[0]}</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">Confirm Password</label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          autoComplete="new-password"
          data-testid="confirm-password-input"
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm text-foreground outline-none ring-foreground/20 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
        {state?.errors?.confirmPassword && (
          <p className="text-xs text-red-600">{state.errors.confirmPassword[0]}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        data-testid="submit-button"
        className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
      >
        {pending ? 'Creating account…' : 'Create Account'}
      </button>

      <p className="text-center text-sm text-zinc-500">
        Already have an account?{' '}
        <Link href="/login" className="text-foreground underline underline-offset-2">
          Sign in
        </Link>
      </p>
    </form>
  )
}
