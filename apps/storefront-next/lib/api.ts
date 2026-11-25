import "server-only";

const API_BASE_URL = process.env.API_BASE_URL;

export async function apiGet<T>(path: string): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error("API_BASE_URL is not configured for the Next.js server.");
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const base = API_BASE_URL.endsWith("/") ? API_BASE_URL : `${API_BASE_URL}/`;
  const response = await fetch(new URL(normalizedPath.slice(1), base), {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Laravel API request failed with status ${response.status}.`);
  }

  return response.json() as Promise<T>;
}
