import type { APIRequestContext } from '@playwright/test'

export interface ResetResult {
  sessionToken: string
  expiresAt: string
}

export async function resetAndGetSession(request: APIRequestContext, baseURL: string): Promise<ResetResult> {
  const response = await request.post(`${baseURL}/api/test/reset`)
  if (!response.ok()) {
    throw new Error(`Failed to reset: ${response.status()} ${await response.text()}`)
  }
  const data = await response.json()
  return { sessionToken: data.sessionToken, expiresAt: data.expiresAt }
}
