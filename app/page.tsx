import { redirect } from 'next/navigation'
import { TodoForm } from './components/TodoForm'
import { TodoList } from './components/TodoList'
import { verifySession } from '@/lib/dal'
import { logout } from './actions/auth'
import { prisma } from '@/lib/prisma'

export default async function Home() {
  const { userId } = await verifySession()
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
  if (!user) redirect('/login')

  return (
    <div className="flex flex-1 items-start justify-center bg-zinc-50 px-4 py-16 dark:bg-black">
      <main className="w-full max-w-lg">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              My Third Todo App
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Manage tasks with status, notes, and editing.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span data-testid="user-email" className="text-xs text-zinc-500">{user.email}</span>
            <form action={logout}>
              <button
                type="submit"
                data-testid="sign-out-button"
                className="text-xs text-zinc-500 underline underline-offset-2 hover:text-foreground"
              >
                Sign Out
              </button>
            </form>
          </div>
        </header>

        <section className="mb-6">
          <TodoForm />
        </section>

        <section>
          <TodoList />
        </section>
      </main>
    </div>
  )
}
