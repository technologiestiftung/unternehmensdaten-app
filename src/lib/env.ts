/** Read a required environment variable at request time, never at build time. */
export function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Environment variable ${name} is not set`);
  return value;
}
