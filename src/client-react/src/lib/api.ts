import type { BootstrapDataset } from './domain'

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export interface Me {
  upn: string
  displayName: string
  role: 'admin' | 'user'
}

export interface BootstrapResponse {
  dataset: BootstrapDataset
  user: Me
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'same-origin' })
  if (res.status === 401) {
    // Matches vanilla client behaviour (session expiry in non-dev auth modes).
    // Navigation is fire-and-forget; the throw prevents callers proceeding with
    // undefined data while the redirect happens. Callers must not swallow ApiError(401).
    window.location.href = '/login'
    throw new ApiError(401, 'unauthenticated')
  }
  // Response body deliberately discarded — matches the vanilla client's convention ('HTTP '+status); server 500 bodies are generic by design.
  if (!res.ok) throw new ApiError(res.status, `${url} failed with ${res.status}`)
  return (await res.json()) as T
}

export const getMe = () => getJson<Me>('/api/me')
export const getBootstrap = () => getJson<BootstrapResponse>('/api/bootstrap')
