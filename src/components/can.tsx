import type { ReactNode } from "react";
import { auth } from "@/auth";
import { hasPermission, type Permission } from "@/lib/rbac";

/**
 * Componente servidor que condiciona el render según el permiso del usuario.
 *
 * Uso correcto (en un Server Component):
 *
 *   <Can permission="approvals:decide">
 *     <ApproveRejectButtons approvalId={a.id} />
 *   </Can>
 *
 * Uso incorrecto:
 *   - NO usar dentro de Client Components ("use client").
 *     En ese caso pasar el rol como prop y usar hasPermission() directo.
 */
export async function Can({
  permission,
  children,
  fallback = null,
}: {
  permission: Permission;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const session = await auth();
  const role = (session?.user as any)?.role as string | undefined;

  if (!hasPermission(role, permission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}