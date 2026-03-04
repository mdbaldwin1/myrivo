import type { GlobalUserRole, StoreMemberRole } from "@/types/database";

const storeRoleOrder: Record<StoreMemberRole | "support", number> = {
  customer: 0,
  staff: 1,
  admin: 2,
  owner: 3,
  support: 4
};

const globalRoleOrder: Record<GlobalUserRole, number> = {
  user: 0,
  support: 1,
  admin: 2
};

export function hasStoreRole(currentRole: StoreMemberRole | "support", requiredRole: StoreMemberRole | "support") {
  return storeRoleOrder[currentRole] >= storeRoleOrder[requiredRole];
}

export function hasGlobalRole(currentRole: GlobalUserRole, requiredRole: GlobalUserRole) {
  return globalRoleOrder[currentRole] >= globalRoleOrder[requiredRole];
}

export type StorePermission =
  | "store.manage_members"
  | "store.manage_domains"
  | "store.manage_billing"
  | "store.manage_content"
  | "store.manage_pickup"
  | "store.manage_catalog"
  | "store.manage_orders";

const storePermissionMinimumRole: Record<StorePermission, StoreMemberRole> = {
  "store.manage_members": "admin",
  "store.manage_domains": "admin",
  "store.manage_billing": "admin",
  "store.manage_content": "staff",
  "store.manage_pickup": "staff",
  "store.manage_catalog": "staff",
  "store.manage_orders": "staff"
};

function parsePermissionOverride(permissionsJson: Record<string, unknown> | null | undefined, permission: StorePermission): boolean | null {
  if (!permissionsJson || typeof permissionsJson !== "object" || Array.isArray(permissionsJson)) {
    return null;
  }

  const wildcard = permissionsJson["*"];
  if (typeof wildcard === "boolean") {
    return wildcard;
  }

  const explicit = permissionsJson[permission];
  if (typeof explicit === "boolean") {
    return explicit;
  }

  return null;
}

export function hasStorePermission(
  currentRole: StoreMemberRole | "support",
  permissionsJson: Record<string, unknown> | null | undefined,
  permission: StorePermission
) {
  if (currentRole === "support") {
    return true;
  }

  const override = parsePermissionOverride(permissionsJson, permission);
  if (override !== null) {
    return override;
  }

  return hasStoreRole(currentRole, storePermissionMinimumRole[permission]);
}
