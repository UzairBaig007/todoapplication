import path from 'path'
import { config as loadEnv } from 'dotenv'
import { test as base } from '@playwright/test'
import { resetAndGetSession } from './helpers/reset'

const projectRoot = path.resolve(__dirname, '..')
loadEnv({ path: path.join(projectRoot, '.env.test'), override: true })

export const test = base.extend({
  page: async ({ page, request, baseURL }, use) => {
    if (!baseURL) {
      throw new Error('baseURL is required for E2E tests')
    }
    const { sessionToken, expiresAt } = await resetAndGetSession(request, baseURL)
    await page.context().addCookies([
      {
        name: 'session',
        value: sessionToken,
        domain: new URL(baseURL).hostname,
        path: '/',
        httpOnly: true,
        secure: false,
        expires: Math.floor(new Date(expiresAt).getTime() / 1000),
      },
    ])
    await use(page)
  },
})

export { expect } from '@playwright/test'
