# unternehmensdaten-app

The web app for the Berlin company database. It shows one record per company, with the target
columns, the federal grants (Förderungen) and comments by colleagues. It runs on the
**Berlin Data Hub** (data-hub.berlin).

The app has **no database access of its own**. It is a Next.js server that:

1. logs the user in with **Keycloak** (OpenID Connect),
2. asks **Hasura** for data with the user's Keycloak token, and
3. lets Hasura's permissions decide what that user may read and write.

The data, the database schema and the Hasura permissions live in the other repo,
[unternehmensdatenbank](https://github.com/technologiestiftung/unternehmensdatenbank)
(`db/migrations/`, `hasura/metadata/`). This repo is only the screen in front of them.

```
browser ──login──▶ Keycloak
   │                  ▲ token
   ▼                  │
this app (Next.js) ───┴──▶ Hasura ──reader role──▶ Postgres (v_company_profile, company_comments)
```

## Run it locally

You need the local Data Hub from the `unternehmensdatenbank` repo running first:

```bash
cd ../unternehmensdatenbank
./scripts/dev-up.sh
docker compose --profile datahub up -d     # Keycloak :8180, Hasura :8090
```

Then:

```bash
cp .env.example .env.local
# put a real secret into NEXTAUTH_SECRET: openssl rand -base64 32
npm install
npm run dev                                # http://localhost:3100
```

Log in as **`dev` / `dev`** (a local test user from `keycloak/datahub-realm.json` in the other
repo). Port 3100, not 3000, so it does not collide with other local apps. The local Keycloak
client only accepts redirects to `localhost:3100`.

## Commands

| | |
|---|---|
| `npm run dev` | dev server on :3100 |
| `npm run lint` · `npm run typecheck` · `npm test` | the checks CI runs |
| `npm run build` | production build (`.next/standalone`) |
| `docker build -t unternehmensdaten-app .` | the image the Data Hub runs |

## Configuration

Every setting is an environment variable read **at request time**. Nothing is baked into the
image, so one image serves staging and prod. The full list with explanations is in
[.env.example](.env.example):

| variable | what |
|---|---|
| `NEXTAUTH_URL` | the app's public URL |
| `NEXTAUTH_SECRET` | encrypts the session cookie; secret |
| `KEYCLOAK_ISSUER` | realm URL |
| `KEYCLOAK_CLIENT_ID` · `KEYCLOAK_CLIENT_SECRET` | the app's confidential client; the secret is secret |
| `HASURA_GRAPHQL_URL` | Hasura's `/v1/graphql` endpoint |

## Images

`.github/workflows/ci.yml` checks every pull request. A push to `main` publishes
`ghcr.io/technologiestiftung/unternehmensdaten-app:main` and `:sha-<commit>`. A tag `v1.2.3`
publishes `:1.2.3` and `:latest`. What the Data Hub team needs from us is in
[docs/datahub-handover.md](docs/datahub-handover.md).

## Testing the image locally

The container starts and redirects to the login:

```bash
docker run --rm -p 3101:3000 --env-file .env.local \
  -e NEXTAUTH_URL=http://localhost:3101 \
  -e KEYCLOAK_ISSUER=http://host.docker.internal:8180/realms/datahub \
  -e HASURA_GRAPHQL_URL=http://host.docker.internal:8090/v1/graphql \
  unternehmensdaten-app
```

A **full login** from the container does not work locally, and that is expected. The browser reaches
Keycloak at `localhost`, the container reaches it at `host.docker.internal`, and the token's issuer
can only match one of the two. On the Data Hub both use the same public hostname. Use `npm run dev`
for the full flow.
