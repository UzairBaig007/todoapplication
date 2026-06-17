'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { verifySession } from '@/lib/dal'
import { isTodoStatus, type TodoStatus } from '@/lib/todo'

export async function createTodo(formData: FormData) {
  const { userId } = await verifySession()
  const title = formData.get('title')?.toString().trim()
  if (!title) return

  const note = formData.get('note')?.toString().trim() || null

  await prisma.todo.create({
    data: { title, note, userId },
  })
  revalidatePath('/')
}

export async function updateTodoStatus(id: number, status: string) {
  const { userId } = await verifySession()
  if (!isTodoStatus(status)) return

  await prisma.todo.update({
    where: { id, userId },
    data: { status: status as TodoStatus },
  })
  revalidatePath('/')
}

export async function updateTodo(
  id: number,
  title: string,
  note: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { userId } = await verifySession()
  const trimmedTitle = title.trim()
  if (!trimmedTitle) {
    return { ok: false, error: 'Title cannot be empty' }
  }

  const trimmedNote = note?.trim() || null

  await prisma.todo.update({
    where: { id, userId },
    data: { title: trimmedTitle, note: trimmedNote },
  })
  revalidatePath('/')
  return { ok: true }
}

export async function deleteTodo(id: number) {
  const { userId } = await verifySession()
  await prisma.todo.delete({ where: { id, userId } })
  revalidatePath('/')
}

export async function clearCompletedTodos() {
  const { userId } = await verifySession()
  await prisma.todo.deleteMany({
    where: { status: 'done', userId },
  })
  revalidatePath('/')
}
