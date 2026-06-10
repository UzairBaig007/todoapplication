"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { isTodoStatus, type TodoStatus } from "@/lib/todo";

export async function createTodo(formData: FormData) {
  const title = formData.get("title")?.toString().trim();
  if (!title) return;

  const note = formData.get("note")?.toString().trim() || null;

  await prisma.todo.create({
    data: { title, note },
  });
  revalidatePath("/");
}

export async function updateTodoStatus(id: number, status: string) {
  if (!isTodoStatus(status)) return;

  await prisma.todo.update({
    where: { id },
    data: { status: status as TodoStatus },
  });
  revalidatePath("/");
}

export async function updateTodo(
  id: number,
  title: string,
  note: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) {
    return { ok: false, error: "Title cannot be empty" };
  }

  const trimmedNote = note?.trim() || null;

  await prisma.todo.update({
    where: { id },
    data: { title: trimmedTitle, note: trimmedNote },
  });
  revalidatePath("/");
  return { ok: true };
}

export async function deleteTodo(id: number) {
  await prisma.todo.delete({ where: { id } });
  revalidatePath("/");
}

export async function clearCompletedTodos() {
  await prisma.todo.deleteMany({
    where: { status: "done" },
  });
  revalidatePath("/");
}
