import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { encrypt } from '@/lib/session'

const TEST_EMAIL = 'test@example.com'
const TEST_PASSWORD = 'TestPass123!'

function isTestDatabase() {
  const url = process.env.DATABASE_URL ?? ''
  return url.includes('test.db')
}

export async function POST() {
  if (!isTestDatabase()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await prisma.todo.deleteMany()
  await prisma.user.deleteMany()

  const hashedPassword = await bcrypt.hash(TEST_PASSWORD, 12)
  const user = await prisma.user.create({
    data: { email: TEST_EMAIL, password: hashedPassword },
  })

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  const sessionToken = await encrypt({ userId: user.id, expiresAt: expiresAt.toISOString() })

  return NextResponse.json({ ok: true, sessionToken, expiresAt: expiresAt.toISOString() })
}
