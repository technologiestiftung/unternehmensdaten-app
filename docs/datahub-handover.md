# Hand-over to the Data Hub team

What the hub team needs to run this app and the database behind it. Send changes to
datahub@ts.berlin. Items marked **open** are questions, not decisions.

## 1. The app image

| | |
|---|---|
| image | `ghcr.io/technologiestiftung/unternehmensdaten-app` |
| staging | tag `:main`, rebuilt on every merge to `main` (also `:sha-<commit>` per build) |
| prod | a fixed version tag, e.g. `:1.4.0`; `:1.4` follows the newest patch of 1.4. No `:latest` |
| port | 3000 (HTTP) |
| user | non-root, uid 1001 |
| storage | none; the app is stateless |
| health | `GET /api/auth/providers` returns 200 with no login |
| requested domain | **open**, e.g. `unternehmen.data-hub.berlin` |

Environment, per environment (see `.env.example` for meanings):

| variable | staging / prod value | secret? |
|---|---|---|
| `NEXTAUTH_URL` | the public URL of that environment | no |
| `NEXTAUTH_SECRET` | 32 random bytes, different per environment | **yes** |
| `KEYCLOAK_ISSUER` | `https://idm.data-hub.berlin/realms/tsb-prd` (**open**: the right realm) | no |
| `KEYCLOAK_CLIENT_ID` | `unternehmensdaten-app` | no |
| `KEYCLOAK_CLIENT_SECRET` | from the client in item 2 | **yes** |
| `HASURA_GRAPHQL_URL` | the hub's Hasura endpoint, cluster-internal if possible | no |

## 2. Keycloak client

A **confidential** OpenID Connect client `unternehmensdaten-app` with:

- valid redirect URI `<NEXTAUTH_URL>/api/auth/callback/keycloak`
- post-logout redirect `<NEXTAUTH_URL>/*`
- standard flow on, direct access grants **off** (they are on locally only, for testing)
- a realm role `user` for everyone who may use the app

Hasura reads the realm roles from `realm_access.roles` and the user id from `sub`. The local
reference is `keycloak/datahub-realm.json` in the unternehmensdatenbank repo.

## 3. Database (in the unternehmensdatenbank repo)

- Postgres 15 with PostGIS; one database for staging and one for prod
- three logins: owner (Flyway), writer (Airflow), reader (Hasura). The migrations take the
  role names as Flyway placeholders `writer_role` / `reader_role`, so any naming works
- migrations: `db/migrations/`, run with Flyway against staging first, then prod

## 4. Hasura

- metadata: `hasura/metadata/` in the unternehmensdatenbank repo, applied as-is
- source connection: the **reader** login of the matching database
- JWT config: the Keycloak realm's JWKS; claims map as in that repo's `docker-compose.yml`
  (`HASURA_GRAPHQL_JWT_SECRET`)

## 5. Airflow

- DAGs: `airflow/dags/` in the unternehmensdatenbank repo
- connection string: env `PG_DSN`, as the **writer** login
- Python packages: `airflow/requirements.txt`. **Open**: baked into the shared image, or per task
  with `@task.virtualenv` as the hub's own DAGs do

## Open questions

1. Domain for the app.
2. Realm: `tsb-prd` for both staging and prod, or one each?
3. Does the hub have a central Hasura we add a source to, or do we get our own instance?
4. DAG prefix per team in the shared Airflow?
5. Is pulling from ghcr.io allowed, or must images go to a hub registry?
6. Do you roll out new images with Keel automatically, or update tags by hand? Our suggestion:
   staging follows `:main` (Keel `force` policy, polling), prod is pinned to an exact version
   and changed on request.
