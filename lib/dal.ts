import 'server-only'

import { cache } from 'react'
import { redirect } from 'next/navigation'
import { decrypt, getSessionToken } from '@/lib/session'

export const verifySession = cache(async () => {
  const token = await getSessionToken()
  const session = await decrypt(token)

  if (!session?.userId) {
    redirect('/login')
  }

  return { userId: session.userId }
})
