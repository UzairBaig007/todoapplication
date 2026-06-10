import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function isTestDatabase() {
  const url = process.env.DATABASE_URL ?? "";
  return url.includes("test.db");
}

export async function POST() {
  if (!isTestDatabase()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.todo.deleteMany();
  return NextResponse.json({ ok: true });
}
