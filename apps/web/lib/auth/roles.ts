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

