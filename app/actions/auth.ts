'use server'

import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { createSession, deleteSession } from '@/lib/session'

export type AuthState =
  | { errors?: { email?: string[]; password?: string[]; confirmPassword?: string[] }; message?: string }
  | undefined

export async function signup(state: AuthState, formData: FormData): Promise<AuthState> {
  const email = formData.get('email')?.toString().trim().toLowerCase() ?? ''
  const password = formData.get('password')?.toString() ?? ''
  const confirmPassword = formData.get('confirmPassword')?.toString() ?? ''

  const errors: { email?: string[]; password?: string[]; confirmPassword?: string[] } = {}

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = ['Please enter a valid email address.']
  }
  if (password.length < 8) {
    errors.password = ['Password must be at least 8 characters.']
  }
  if (password !== confirmPassword) {
    errors.confirmPassword = ['Passwords do not match.']
  }

  if (Object.keys(errors).length > 0) return { errors }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return { errors: { email: ['An account with this email already exists.'] } }
  }

  const hashedPassword = await bcrypt.hash(password, 12)
  const user = await prisma.user.create({ data: { email, password: hashedPassword } })

  await createSession(user.id)
  redirect('/')
}

export async function login(state: AuthState, formData: FormData): Promise<AuthState> {
  const email = formData.get('email')?.toString().trim().toLowerCase() ?? ''
  const password = formData.get('password')?.toString() ?? ''

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    return { message: 'Invalid email or password.' }
  }

  const passwordMatch = await bcrypt.compare(password, user.password)
  if (!passwordMatch) {
    return { message: 'Invalid email or password.' }
  }

  await createSession(user.id)
  redirect('/')
}

export async function logout() {
  await deleteSession()
  redirect('/login')
}
