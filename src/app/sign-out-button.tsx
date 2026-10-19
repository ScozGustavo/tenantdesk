'use client'

import { useRouter } from 'next/navigation'
import { signOut } from '@/lib/auth-client'

export function SignOutButton() {
  const router = useRouter()
  return (
    <button
      className="rounded-md border border-line px-3 py-1.5 text-sm text-muted hover:border-field hover:text-platinum"
      onClick={async () => {
        await signOut()
        router.push('/sign-in')
        router.refresh()
      }}
    >
      Sign out
    </button>
  )
}
