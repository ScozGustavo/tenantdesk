import { headers } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { listMyTenants } from '@/lib/projects'
import { TopBar } from './top-bar'

const roleText = { admin: 'Admin', editor: 'Editor', viewer: 'Viewer, read only' }

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect('/sign-in')
  const tenants = await listMyTenants(session.user.id)

  return (
    <>
      <TopBar email={session.user.email} tenants={tenants} />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">Your organizations</h1>
        <div className="mt-4 h-px w-16 bg-gold" />
        {tenants.length === 0 ? (
          <p className="mt-8 max-w-prose text-muted">
            You aren&apos;t a member of any organization yet. Ask an admin to add you.
          </p>
        ) : (
          <ul className="mt-8 divide-y divide-line border-y border-line">
            {tenants.map((t) => (
              <li key={t.slug}>
                <Link href={`/t/${t.slug}`} className="group flex items-baseline justify-between gap-4 py-5">
                  <span className="font-display text-2xl font-medium group-hover:text-gold-soft">{t.name}</span>
                  <span className="text-sm text-muted">{roleText[t.role]}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  )
}
