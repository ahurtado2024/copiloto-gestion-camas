import { auth } from "@/auth";

export async function getCurrentSession() {
  return await auth();
}

export async function getCurrentRole() {
  const session = await auth();
  return (session?.user as any)?.role as string | undefined;
}

export async function getCurrentUserId() {
  const session = await auth();
  return (session?.user as any)?.id as string | undefined;
}