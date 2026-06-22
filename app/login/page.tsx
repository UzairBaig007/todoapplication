import { LoginForm } from './LoginForm'

export default function LoginPage() {
  return (
    <div className="flex flex-1 items-start justify-center bg-zinc-50 px-4 py-16 dark:bg-black">
      <main className="w-full max-w-sm">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Sign In</h1>
          <p className="mt-1 text-sm text-zinc-500">Welcome back to My Third Todo App.</p>
        </header>
        <LoginForm />
      </main>
    </div>
  )
}
