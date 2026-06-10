import { TodoForm } from "./components/TodoForm";
import { TodoList } from "./components/TodoList";

export default function Home() {
  return (
    <div className="flex flex-1 items-start justify-center bg-zinc-50 px-4 py-16 dark:bg-black">
      <main className="w-full max-w-lg">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Todos
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Manage tasks with status, notes, and editing.
          </p>
        </header>

        <section className="mb-6">
          <TodoForm />
        </section>

        <section>
          <TodoList />
        </section>
      </main>
    </div>
  );
}
