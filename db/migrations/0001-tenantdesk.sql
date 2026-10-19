-- TenantDesk: tenants, memberships, projects, audit entries.
-- Isolation is enforced twice: the app filters by tenant_id, and RLS checks both the
-- active tenant (app.tenant_id) and that the signed-in user (app.user_id) is a member.
-- Both settings are set per transaction with set_config(..., true).

CREATE TABLE tenant (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{1,40}$'),
  name text NOT NULL
);

CREATE TABLE membership (
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
  PRIMARY KEY (tenant_id, user_id)
);
CREATE INDEX membership_user_idx ON membership (user_id);

CREATE TABLE project (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- lets audit_entry reference (tenant_id, id), so an audit row can't point across tenants
  UNIQUE (tenant_id, id)
);
-- names are unique per tenant, not globally
CREATE UNIQUE INDEX project_tenant_name_idx ON project (tenant_id, lower(name));
CREATE INDEX project_tenant_created_idx ON project (tenant_id, created_at DESC, id);

CREATE TABLE audit_entry (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  actor_user_id text NOT NULL REFERENCES "user"(id),
  action text NOT NULL CHECK (action IN ('project.create', 'project.rename')),
  project_id uuid NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, project_id) REFERENCES project (tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX audit_entry_tenant_created_idx ON audit_entry (tenant_id, created_at DESC);

-- helpers read the per-transaction settings; nullif because an unset setting reads back as ''
CREATE FUNCTION app_user_id() RETURNS text LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('app.user_id', true), '') $$;
CREATE FUNCTION app_tenant_id() RETURNS uuid LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('app.tenant_id', true), '')::uuid $$;

ALTER TABLE tenant ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant FORCE ROW LEVEL SECURITY;
ALTER TABLE membership ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership FORCE ROW LEVEL SECURITY;
ALTER TABLE project ENABLE ROW LEVEL SECURITY;
ALTER TABLE project FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_entry ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_entry FORCE ROW LEVEL SECURITY;

-- a user sees only their own memberships
CREATE POLICY membership_self ON membership FOR SELECT
  USING (user_id = (SELECT app_user_id()));

-- a user sees only tenants they belong to
CREATE POLICY tenant_member ON tenant FOR SELECT
  USING (EXISTS (SELECT 1 FROM membership m WHERE m.tenant_id = tenant.id AND m.user_id = (SELECT app_user_id())));

-- read: active tenant, and the user is a member of it
CREATE POLICY project_read ON project FOR SELECT
  USING (tenant_id = (SELECT app_tenant_id())
    AND EXISTS (SELECT 1 FROM membership m WHERE m.tenant_id = project.tenant_id AND m.user_id = (SELECT app_user_id())));

-- write: same, and the user is an admin or editor; viewers are refused by the database too
CREATE POLICY project_insert ON project FOR INSERT
  WITH CHECK (tenant_id = (SELECT app_tenant_id())
    AND EXISTS (SELECT 1 FROM membership m WHERE m.tenant_id = project.tenant_id AND m.user_id = (SELECT app_user_id()) AND m.role IN ('admin', 'editor')));
CREATE POLICY project_update ON project FOR UPDATE
  USING (tenant_id = (SELECT app_tenant_id())
    AND EXISTS (SELECT 1 FROM membership m WHERE m.tenant_id = project.tenant_id AND m.user_id = (SELECT app_user_id()) AND m.role IN ('admin', 'editor')))
  WITH CHECK (tenant_id = (SELECT app_tenant_id()));

CREATE POLICY audit_read ON audit_entry FOR SELECT
  USING (tenant_id = (SELECT app_tenant_id())
    AND EXISTS (SELECT 1 FROM membership m WHERE m.tenant_id = audit_entry.tenant_id AND m.user_id = (SELECT app_user_id())));
-- the actor must be the signed-in user; no UPDATE or DELETE policy, so audit is append-only
CREATE POLICY audit_insert ON audit_entry FOR INSERT
  WITH CHECK (tenant_id = (SELECT app_tenant_id()) AND actor_user_id = (SELECT app_user_id())
    AND EXISTS (SELECT 1 FROM membership m WHERE m.tenant_id = audit_entry.tenant_id AND m.user_id = (SELECT app_user_id()) AND m.role IN ('admin', 'editor')));
