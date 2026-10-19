import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { HttpError, listMyTenants, listProjects } from '@/lib/projects'
import { TopBar } from '../../top-bar'
import { Projects } from './projects'

const roleLine = {
  admin: 'You are an admin here. You can create and rename projects.',
  editor: 'You are an editor here. You can create and rename projects.',
  viewer: 'You can read projects here. An admin can make changes.',
}

export default async function TenantPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect('/sign-in')
  let data
  try {
    data = await listProjects(session.user.id, slug)
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound()
    throw e
  }
  const tenants = await listMyTenants(session.user.id)

  return (
    <>
      <TopBar email={session.user.email} tenants={tenants} active={slug} />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="font-display text-5xl font-semibold leading-none tracking-tight break-words sm:text-6xl">
          {data.tenantName}
        </h1>
        <div className="mt-5 h-px w-16 bg-gold" />
        <p className="mt-5 text-muted">{roleLine[data.role]}</p>
        <Projects slug={slug} canWrite={data.role !== 'viewer'} initial={data.projects} />
      </main>
    </>
  )
}
