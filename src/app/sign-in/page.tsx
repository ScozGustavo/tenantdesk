'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from '@/lib/auth-client'

// email + password sign-in; accounts are seeded, there is no public sign-up
export default function SignInPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setPending(true)
    setError(null)
    const res = await signIn.email({ email: String(form.get('email')), password: String(form.get('password')) })
    setPending(false)
    if (res.error) return setError(res.error.message ?? 'Sign-in failed. Check your email and password.')
    router.push('/')
    router.refresh()
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-12">
      <h1 className="font-display text-5xl font-semibold tracking-tight">TenantDesk</h1>
      <div className="mt-4 h-px w-16 bg-gold" />
      <p className="mt-4 text-muted">Sign in to see your organization&apos;s projects.</p>
      <form onSubmit={submit} className="mt-8 flex flex-col gap-4 rounded-lg border border-line bg-charcoal p-5">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Email
          <input name="email" type="email" autoComplete="email" required
            className="rounded-md border border-field bg-navy px-3 py-2 font-normal text-platinum focus:border-gold focus:outline-none" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Password
          <input name="password" type="password" autoComplete="current-password" required minLength={8}
            className="rounded-md border border-field bg-navy px-3 py-2 font-normal text-platinum focus:border-gold focus:outline-none" />
        </label>
        {error && <p role="alert" className="border-l-2 border-danger pl-3 text-sm text-danger">{error}</p>}
        <button type="submit" disabled={pending}
          className="mt-1 rounded-md bg-gold px-4 py-2 text-sm font-medium text-navy hover:bg-gold-soft disabled:cursor-wait disabled:opacity-60">
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  )
}
