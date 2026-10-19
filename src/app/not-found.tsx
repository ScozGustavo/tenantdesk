import Link from 'next/link'

// one message for missing and forbidden, so the page never confirms what exists
export default function NotFound() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
      <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">Nothing here</h1>
      <div className="mt-4 h-px w-16 bg-gold" />
      <p className="mt-6 max-w-prose text-muted">
        This page doesn&apos;t exist, or your account doesn&apos;t have access to it.
      </p>
      <Link href="/" className="mt-8 inline-block rounded-md bg-gold px-4 py-2 text-sm font-medium text-navy hover:bg-gold-soft">
        Go to your organizations
      </Link>
    </main>
  )
}
