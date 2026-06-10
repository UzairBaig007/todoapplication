import type { APIRequestContext } from "@playwright/test";

export async function resetTodos(request: APIRequestContext, baseURL: string) {
  const response = await request.post(`${baseURL}/api/test/reset`);
  if (!response.ok()) {
    throw new Error(`Failed to reset todos: ${response.status()} ${await response.text()}`);
  }
}
