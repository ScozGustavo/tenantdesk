'use client'

import { useRouter } from 'next/navigation'
import { signOut } from '@/lib/auth-client'

export function SignOutButton() {
  const router = useRouter()
  return (
    <button
      className="rounded border px-3 py-1"
      onClick={async () => {
        await signOut()
        router.refresh()
      }}
    >
      Sign out
    </button>
  )
}
