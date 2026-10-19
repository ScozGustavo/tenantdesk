import { headers } from 'next/headers'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { SignOutButton } from './sign-out-button'

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() })

  return (
    <main className="mx-auto max-w-xl p-6">
      {session ? (
        <div className="flex items-center justify-between">
          <p>
            Signed in as <strong>{session.user.email}</strong>
          </p>
          <SignOutButton />
        </div>
      ) : (
        <Link href="/sign-in" className="underline">
          Sign in
        </Link>
      )}
    </main>
  )
}
