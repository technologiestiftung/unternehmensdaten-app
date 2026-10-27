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

## Staging and production

| what you do | workflow | image | environment |
|---|---|---|---|
| open a pull request | `ci.yml`: lint, typecheck, test, build | — | — |
| merge to `main` | `ci.yml`: the same, then the image is built | `:main`, `:sha-<commit>` | **staging** |
| **Actions → Create release → Run workflow** on `main`, pick patch / minor / major | `release.yml`: checks again, tags `vX.Y.Z`, publishes a GitHub Release with notes generated from the merged PRs, builds the image after approval | `:X.Y.Z`, `:X.Y` | **production** |

The next version is worked out from the existing `vX.Y.Z` tags. The workflow refuses to reuse one,
so a production tag and its image never change. The hub can pin `:1.4.0` and roll back to
`:1.3.2`. There is no `:latest`: with two environments on one platform it would name neither. A
hotfix is a new patch release from `main`.

### One-time repo settings

1. Settings → Environments → `production` → required reviewers: whoever approves a prod release.
   Without reviewers the production image is built straight after the tag.
2. Settings → Branches → protect `main` (pull requests only), so everything released went through
   a reviewed PR and `ci.yml`.

What the Data Hub team needs from us is in [docs/datahub-handover.md](docs/datahub-handover.md).

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
