import Link from 'next/link'
import { SignOutButton } from './sign-out-button'

type Tenant = { slug: string; name: string }

// shared header: wordmark, the user's organizations, who is signed in
export function TopBar({ email, tenants, active }: { email: string; tenants: Tenant[]; active?: string }) {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-4 sm:px-6">
        <Link href="/" className="font-display text-2xl font-semibold tracking-tight text-platinum">
          TenantDesk
        </Link>
        {tenants.length > 0 && (
          <nav aria-label="Organizations" className="order-3 flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto">
            {tenants.map((t) => (
              <Link
                key={t.slug}
                href={`/t/${t.slug}`}
                aria-current={t.slug === active ? 'page' : undefined}
                className="shrink-0 rounded-md px-3 py-1.5 text-sm text-muted hover:text-platinum aria-[current=page]:bg-raised aria-[current=page]:text-gold-soft"
              >
                {t.name}
              </Link>
            ))}
          </nav>
        )}
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden max-w-56 truncate text-sm text-muted md:inline">{email}</span>
          <SignOutButton />
        </div>
      </div>
    </header>
  )
}
