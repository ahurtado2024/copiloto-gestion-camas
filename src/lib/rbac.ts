export type Role =
  | "admin"
  | "encargada"
  | "aseo"
  | "jefatura"
  | "viewer";

export type Permission =
  | "beds:view"
  | "beds:mutate"
  | "tasks:view"
  | "tasks:update"
  | "approvals:view"
  | "approvals:decide"
  | "conflicts:view"
  | "conflicts:resolve"
  | "mail:view"
  | "mail:sync"
  | "mail:draft"
  | "mail:send"
  | "sheets:view"
  | "sheets:sync"
  | "metrics:view"
  | "turno:view"
  | "registro:view"
  | "agenda:view"
  | "agenda:edit"
  | "settings:view"
  | "settings:edit"
  | "telegram:use";

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    "beds:view", "beds:mutate",
    "tasks:view", "tasks:update",
    "approvals:view", "approvals:decide",
    "conflicts:view", "conflicts:resolve",
    "mail:view", "mail:sync", "mail:draft", "mail:send",
    "sheets:view", "sheets:sync",
    "metrics:view", "turno:view", "registro:view",
    "agenda:view", "agenda:edit",
    "settings:view", "settings:edit",
    "telegram:use",
  ],

  encargada: [
    "beds:view", "beds:mutate",
    "tasks:view", "tasks:update",
    "approvals:view", "approvals:decide",
    "conflicts:view", "conflicts:resolve",
    "mail:view", "mail:sync", "mail:draft", "mail:send",
    "sheets:view", "sheets:sync",
    "metrics:view", "turno:view", "registro:view",
    "agenda:view", "agenda:edit",
    "settings:view", "settings:edit",
    "telegram:use",
  ],

  aseo: [
    "beds:view",
    "tasks:view", "tasks:update",
    "approvals:view",
    "mail:view",
    "sheets:view",
    "turno:view",
    "telegram:use",
  ],

  jefatura: [
    "beds:view",
    "tasks:view",
    "approvals:view",
    "conflicts:view",
    "mail:view",
    "sheets:view",
    "metrics:view",
    "turno:view",
    "registro:view",
    "agenda:view",
    "settings:view",
    "telegram:use",
  ],

  viewer: [
    "beds:view",
    "tasks:view",
    "approvals:view",
    "conflicts:view",
    "mail:view",
    "metrics:view",
    "turno:view",
    "agenda:view",
  ],
};

export function hasPermission(role: string | undefined, permission: Permission): boolean {
  if (!role) return false;
  const perms = ROLE_PERMISSIONS[role as Role];
  if (!perms) return false;
  return perms.includes(permission);
}

export function requirePermission(role: string | undefined, permission: Permission) {
  return hasPermission(role, permission);
}