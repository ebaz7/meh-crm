
import { User, UserRole, SystemSettings, RolePermissions } from '../types';
import { apiCall } from './apiService';

const CURRENT_USER_KEY = 'app_current_user';

export const getUsers = async (): Promise<User[]> => {
    return await apiCall<User[]>('/users');
};

export const saveUser = async (user: User): Promise<User[]> => {
    return await apiCall<User[]>('/users', 'POST', user);
};

export const updateUser = async (user: User): Promise<User[]> => {
    return await apiCall<User[]>(`/users/${user.id}`, 'PUT', user);
};

export const deleteUser = async (id: string): Promise<User[]> => {
    return await apiCall<User[]>(`/users/${id}`, 'DELETE');
};

export const login = async (username: string, password: string): Promise<User | null> => {
    try {
        const user = await apiCall<User>('/login', 'POST', { username, password });
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
        return user;
    } catch (e) {
        return null;
    }
};

export const logout = (): void => {
  localStorage.removeItem(CURRENT_USER_KEY);
};

export const getCurrentUser = (): User | null => {
  const stored = localStorage.getItem(CURRENT_USER_KEY);
  return stored ? JSON.parse(stored) : null;
};

export const hasPermission = (user: User | null, permissionType: string): boolean => {
  if (!user) return false;
  if (permissionType === 'manage_users') return user.role === UserRole.ADMIN;
  return false;
};

export const getRolePermissions = (userRole: string, settings: SystemSettings | null, userObject?: User): RolePermissions => {
    // Check if it's a standard/default role
    const isStandardRole = Object.values(UserRole).includes(userRole as UserRole);

    const defaults: RolePermissions = {
        canViewAll: isStandardRole && (userRole !== UserRole.USER && userRole !== UserRole.SALES_MANAGER && userRole !== UserRole.WAREHOUSE_KEEPER && userRole !== UserRole.SECURITY_GUARD && userRole !== UserRole.SECURITY_HEAD),
        
        // Creation Permission: False for custom roles by default
        canCreatePaymentOrder: isStandardRole && (userRole !== UserRole.FACTORY_MANAGER && userRole !== UserRole.WAREHOUSE_KEEPER && userRole !== UserRole.SALES_MANAGER && userRole !== UserRole.SECURITY_GUARD && userRole !== UserRole.SECURITY_HEAD), 
        
        // Default View Permissions for Payments
        canViewPaymentOrders: isStandardRole && (userRole === UserRole.ADMIN || userRole === UserRole.CEO || userRole === UserRole.MANAGER || userRole === UserRole.FINANCIAL),
        
        // Exit Permits
        canViewExitPermits: isStandardRole && (userRole === UserRole.ADMIN || userRole === UserRole.CEO || userRole === UserRole.SALES_MANAGER || userRole === UserRole.FACTORY_MANAGER || userRole === UserRole.WAREHOUSE_KEEPER || userRole === UserRole.SECURITY_HEAD),

        canApproveFinancial: isStandardRole && (userRole === UserRole.FINANCIAL || userRole === UserRole.ADMIN),
        canApproveManager: isStandardRole && (userRole === UserRole.MANAGER || userRole === UserRole.ADMIN),
        canApproveCeo: isStandardRole && (userRole === UserRole.CEO || userRole === UserRole.ADMIN),
        
        canEditOwn: true,
        canEditAll: isStandardRole && (userRole === UserRole.ADMIN || userRole === UserRole.CEO),
        canDeleteOwn: true,
        canDeleteAll: isStandardRole && (userRole === UserRole.ADMIN),
        
        canManageTrade: isStandardRole && (userRole === UserRole.ADMIN || userRole === UserRole.CEO || userRole === UserRole.MANAGER),
        
        canManageSettings: isStandardRole && (userRole === UserRole.ADMIN),
        
        canCreateExitPermit: isStandardRole && (userRole === UserRole.SALES_MANAGER || userRole === UserRole.ADMIN || userRole === UserRole.CEO),
        canApproveExitCeo: isStandardRole && (userRole === UserRole.CEO || userRole === UserRole.ADMIN),
        canApproveExitFactory: isStandardRole && (userRole === UserRole.FACTORY_MANAGER || userRole === UserRole.ADMIN),
        // FIX: Broaden Warehouse approval default to include CEO and Factory Manager as overrides
        canApproveExitWarehouse: isStandardRole && (
            userRole === UserRole.WAREHOUSE_KEEPER || 
            userRole === UserRole.ADMIN || 
            userRole === UserRole.CEO || 
            userRole === UserRole.FACTORY_MANAGER
        ),
        
        canApproveExitSecurity: isStandardRole && (
            userRole === UserRole.SECURITY_GUARD ||
            userRole === UserRole.SECURITY_HEAD ||
            userRole === UserRole.ADMIN ||
            userRole === UserRole.CEO
        ),
        
        canViewExitArchive: isStandardRole && (userRole === UserRole.ADMIN || userRole === UserRole.CEO || userRole === UserRole.FACTORY_MANAGER || userRole === UserRole.SECURITY_HEAD || userRole === UserRole.WAREHOUSE_KEEPER),
        canEditExitArchive: isStandardRole && (userRole === UserRole.ADMIN),

        // Warehouse Permissions
        canManageWarehouse: isStandardRole && (userRole === UserRole.ADMIN || userRole === UserRole.WAREHOUSE_KEEPER), 
        
        canViewWarehouseReports: isStandardRole && (userRole === UserRole.ADMIN || userRole === UserRole.WAREHOUSE_KEEPER || userRole === UserRole.FACTORY_MANAGER || userRole === UserRole.CEO || userRole === UserRole.SALES_MANAGER),
        
        // Bijak Approval
        canApproveBijak: isStandardRole && (userRole === UserRole.ADMIN || userRole === UserRole.CEO),

        // Security Defaults
        canViewSecurity: isStandardRole && (userRole === UserRole.ADMIN || userRole === UserRole.CEO || userRole === UserRole.FACTORY_MANAGER || userRole === UserRole.SECURITY_HEAD || userRole === UserRole.SECURITY_GUARD),
        canCreateSecurityLog: isStandardRole && (userRole === UserRole.SECURITY_GUARD || userRole === UserRole.SECURITY_HEAD || userRole === UserRole.ADMIN),
        canApproveSecuritySupervisor: isStandardRole && (userRole === UserRole.SECURITY_HEAD || userRole === UserRole.ADMIN)
    };

    // If role has explicit settings, override defaults
    if (settings && settings.rolePermissions && settings.rolePermissions[userRole]) {
        // Merge defaults with custom settings (custom takes precedence)
        // For custom roles (not standard), defaults are minimal (mostly false/null) except canEditOwn.
        const merged = { ...defaults, ...settings.rolePermissions[userRole] };
        
        if (userObject && userObject.canManageTrade) merged.canManageTrade = true;
        return merged;
    }
    
    // If no settings exist for this role, return defaults. 
    // For custom roles, defaults are minimal (mostly false/null) except canEditOwn.
    if (userObject && userObject.canManageTrade) defaults.canManageTrade = true;
    return defaults;
};