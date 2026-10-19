'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn, signUp } from '@/lib/auth-client'

// Minimal email + password form. One form for both: "Create account" also signs the user in.
export default function SignInPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(form: FormData, mode: 'in' | 'up') {
    setPending(true)
    setError(null)
    const email = String(form.get('email'))
    const password = String(form.get('password'))
    const res =
      mode === 'up'
        ? await signUp.email({ email, password, name: email.split('@')[0] })
        : await signIn.email({ email, password })
    setPending(false)
    if (res.error) return setError(res.error.message ?? 'Sign-in failed')
    router.push('/')
    router.refresh()
  }

  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="mb-4 text-xl font-semibold">Sign in</h1>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          const mode = (e.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'up' ? 'up' : 'in'
          submit(new FormData(e.currentTarget), mode)
        }}
      >
        <label className="flex flex-col gap-1">
          Email
          <input name="email" type="email" required className="rounded border px-2 py-1" />
        </label>
        <label className="flex flex-col gap-1">
          Password
          <input name="password" type="password" required minLength={8} className="rounded border px-2 py-1" />
        </label>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button type="submit" value="in" disabled={pending} className="rounded bg-black px-3 py-1 text-white">
            Sign in
          </button>
          <button type="submit" value="up" disabled={pending} className="rounded border px-3 py-1">
            Create account
          </button>
        </div>
      </form>
    </main>
  )
}
