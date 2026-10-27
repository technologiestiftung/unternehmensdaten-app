import { getServerSession, type NextAuthOptions, type Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import KeycloakProvider from "next-auth/providers/keycloak";
import { redirect } from "next/navigation";
import { env } from "./env";
import { needsRefresh } from "./token";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    userId?: string;
    error?: "RefreshFailed";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    error?: "RefreshFailed";
  }
}

async function refresh(token: JWT): Promise<JWT> {
  const response = await fetch(`${env("KEYCLOAK_ISSUER")}/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: env("KEYCLOAK_CLIENT_ID"),
      client_secret: env("KEYCLOAK_CLIENT_SECRET"),
      refresh_token: token.refreshToken ?? "",
    }),
  });
  if (!response.ok) return { ...token, error: "RefreshFailed" };
  const fresh = await response.json();
  return {
    ...token,
    accessToken: fresh.access_token,
    refreshToken: fresh.refresh_token ?? token.refreshToken,
    expiresAt: Math.floor(Date.now() / 1000) + fresh.expires_in,
    error: undefined,
  };
}

/** A function, not a constant, so a missing variable fails the request instead of `next build`. */
export function authOptions(): NextAuthOptions {
  return {
    providers: [
      KeycloakProvider({
        issuer: env("KEYCLOAK_ISSUER"),
        clientId: env("KEYCLOAK_CLIENT_ID"),
        clientSecret: env("KEYCLOAK_CLIENT_SECRET"),
      }),
    ],
    secret: env("NEXTAUTH_SECRET"),
    callbacks: {
      async jwt({ token, account }) {
        if (account) {
          return {
            ...token,
            accessToken: account.access_token,
            refreshToken: account.refresh_token,
            expiresAt: account.expires_at,
          };
        }
        return needsRefresh(token.expiresAt) ? refresh(token) : token;
      },
      async session({ session, token }) {
        // The access token is what Hasura checks. It reaches the browser only through the
        // httpOnly session cookie and /api/auth/session, never through storage.
        return { ...session, accessToken: token.accessToken, userId: token.sub, error: token.error };
      },
    },
  };
}

/** The signed-in session, or a redirect to the Keycloak login. */
export async function requireSession(): Promise<Session & { accessToken: string }> {
  const session = await getServerSession(authOptions());
  if (!session?.accessToken || session.error) redirect("/api/auth/signin");
  return session as Session & { accessToken: string };
}
