'use client'

import { useState } from 'react'
import type { Project } from '@/lib/projects'

async function send(url: string, method: string, name: string): Promise<Project> {
  let res: Response
  try {
    res = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }) })
  } catch {
    throw new Error("Couldn't reach the server. Check your connection and try again.")
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`)
  return data
}

// same rules as the server's zod schema, checked early for quick feedback
function invalid(name: string) {
  if (!name.trim()) return 'Name is required'
  if (name.trim().length > 80) return 'Name must be 80 characters or fewer'
  return null
}

// validate, then send; tracks pending and the error message for one form
function useSubmit(name: string, fn: () => Promise<void>) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function run(e: React.FormEvent) {
    e.preventDefault()
    const problem = invalid(name)
    if (problem) return setError(problem)
    setPending(true)
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setPending(false)
    }
  }
  return { pending, error, setError, run }
}

const field =
  'min-w-0 flex-1 rounded-md border border-field bg-navy px-3 py-2 text-platinum placeholder:text-muted/70 focus:border-gold focus:outline-none aria-[invalid=true]:border-danger'
const primary =
  'shrink-0 rounded-md bg-gold px-4 py-2 text-sm font-medium text-navy hover:bg-gold-soft disabled:cursor-wait disabled:opacity-60'
const quiet = 'shrink-0 rounded-md px-3 py-2 text-sm text-muted hover:text-platinum'

function Alert({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} role="alert" className="border-l-2 border-danger pl-3 text-sm text-danger">
      {children}
    </p>
  )
}

export function Projects({ slug, canWrite, initial }: { slug: string; canWrite: boolean; initial: Project[] }) {
  const [projects, setProjects] = useState(initial)
  const [name, setName] = useState('')
  const base = `/api/t/${slug}/projects`
  const { pending, error, run } = useSubmit(name, async () => {
    const p = await send(base, 'POST', name)
    setProjects((ps) => [p, ...ps])
    setName('')
  })

  return (
    <section className="mt-10">
      {canWrite && (
        <form onSubmit={run} noValidate className="mb-8 rounded-lg border border-line bg-charcoal p-4 sm:p-5">
          <label htmlFor="new-project" className="mb-2 block text-sm font-medium">
            New project
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="new-project"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Roadmap"
              maxLength={120}
              aria-invalid={!!error}
              aria-describedby={error ? 'new-project-error' : undefined}
              className={field}
            />
            <button disabled={pending} className={primary}>
              {pending ? 'Creating…' : 'Create project'}
            </button>
          </div>
          {error && <div className="mt-3"><Alert id="new-project-error">{error}</Alert></div>}
        </form>
      )}

      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-display text-2xl font-medium">Projects</h2>
        <span className="text-sm text-muted">{projects.length === 1 ? '1 project' : `${projects.length} projects`}</span>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-lg border border-dashed border-field px-5 py-10 text-center">
          <p className="font-display text-xl">No projects yet</p>
          <p className="mt-1 text-sm text-muted">
            {canWrite ? 'Create the first one with the form above.' : 'When an admin creates one, it shows up here.'}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {projects.map((p) => (
            <Row key={p.id} project={p} url={`${base}/${p.id}`} canWrite={canWrite}
              onSaved={(np) => setProjects((ps) => ps.map((x) => (x.id === np.id ? np : x)))} />
          ))}
        </ul>
      )}
    </section>
  )
}

function Row({ project, url, canWrite, onSaved }: {
  project: Project
  url: string
  canWrite: boolean
  onSaved: (p: Project) => void
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(project.name)
  const { pending, error, setError, run } = useSubmit(name, async () => {
    onSaved(await send(url, 'PATCH', name))
    setEditing(false)
  })
  const errorId = `rename-error-${project.id}`
  const cancel = () => { setEditing(false); setError(null) }

  if (!editing) {
    return (
      <li className="flex items-center justify-between gap-3 px-1 py-4">
        <span className="min-w-0 truncate text-lg">{project.name}</span>
        {canWrite && (
          <button onClick={() => { setName(project.name); setEditing(true) }} className={quiet}>
            Rename
          </button>
        )}
      </li>
    )
  }
  return (
    <li className="px-1 py-4">
      <form onSubmit={run} noValidate className="flex flex-col gap-2">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            aria-label={`New name for ${project.name}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') cancel() }}
            maxLength={120}
            autoFocus
            aria-invalid={!!error}
            aria-describedby={error ? errorId : undefined}
            className={field}
          />
          <div className="flex gap-2">
            <button disabled={pending} className={primary}>{pending ? 'Saving…' : 'Save name'}</button>
            <button type="button" onClick={cancel} className={quiet}>Cancel</button>
          </div>
        </div>
        {error && <Alert id={errorId}>{error}</Alert>}
      </form>
    </li>
  )
}
