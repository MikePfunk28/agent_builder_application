import { UserRole } from "../users";

export const ADMIN_ROLES: UserRole[] = [UserRole.ADMIN];
export const MODERATOR_ROLES: UserRole[] = [UserRole.ADMIN];

export function isAdmin( role: UserRole ): boolean {
    return role === UserRole.ADMIN;
}

export function hasPermission( userRole: UserRole, requiredRole: UserRole ): boolean {
    const roleHierarchy: Record<UserRole, number> = {
        [UserRole.GUEST]: 0,
        [UserRole.USER]: 1,
        [UserRole.PAID]: 2,
        [UserRole.ADMIN]: 3,
    };
    return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}
