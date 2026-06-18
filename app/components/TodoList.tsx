import { connection } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifySession } from '@/lib/dal'
import { ClearCompletedButton } from './ClearCompletedButton'
import { FilterableTodoList } from './FilterableTodoList'

export async function TodoList() {
  await connection()
  const { userId } = await verifySession()

  const [todos, doneCount] = await Promise.all([
    prisma.todo.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.todo.count({
      where: { status: 'done', userId },
    }),
  ])

  if (todos.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-zinc-500">
        No todos yet. Add one above!
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <ClearCompletedButton count={doneCount} />
      </div>
      <FilterableTodoList todos={todos} />
    </div>
  )
}
