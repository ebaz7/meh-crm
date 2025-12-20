
import { PaymentOrder, User, UserRole, OrderStatus, SystemSettings, ChatMessage, ChatGroup, GroupTask, TradeRecord, ExitPermit, ExitPermitStatus, WarehouseItem, WarehouseTransaction, SecurityLog, PersonnelDelay, SecurityIncident, SecurityStatus } from '../types';
import { apiCall } from './apiService';

// --- SETTINGS ---
// Fix: Added missing getSettings export
export const getSettings = async (): Promise<SystemSettings> => {
    return await apiCall<SystemSettings>('/settings');
};

// Fix: Added missing saveSettings export
export const saveSettings = async (settings: SystemSettings): Promise<SystemSettings> => {
    return await apiCall<SystemSettings>('/settings', 'POST', settings);
};

// Fix: Added missing restoreSystemData export
export const restoreSystemData = async (fileData: string): Promise<{ success: boolean }> => {
    return await apiCall<{ success: boolean }>('/full-restore', 'POST', { fileData });
};

// --- UPLOAD ---
// Fix: Added missing uploadFile export
export const uploadFile = async (fileName: string, fileData: string): Promise<{ fileName: string, url: string }> => {
    return await apiCall<{ fileName: string, url: string }>('/upload', 'POST', { fileName, fileData });
};

// --- ORDERS ---
export const getOrders = async (): Promise<PaymentOrder[]> => {
    return await apiCall<PaymentOrder[]>('/orders');
};

export const saveOrder = async (order: PaymentOrder): Promise<PaymentOrder[]> => {
    return await apiCall<PaymentOrder[]>('/orders', 'POST', order);
};

export const editOrder = async (updatedOrder: PaymentOrder): Promise<PaymentOrder[]> => {
    return await apiCall<PaymentOrder[]>(`/orders/${updatedOrder.id}`, 'PUT', updatedOrder);
};

export const updateOrderStatus = async (id: string, status: OrderStatus, approverUser: User, rejectionReason?: string): Promise<PaymentOrder[]> => {
  const orders = await getOrders();
  const order = orders.find(o => o.id === id);
  if (order) {
      const updates: any = { status };
      
      // Strict Signature Logic based on STATUS, not just ROLE
      if (status === OrderStatus.APPROVED_FINANCE) {
          if (approverUser.role === UserRole.FINANCIAL || approverUser.role === UserRole.ADMIN) {
              updates.approverFinancial = approverUser.fullName;
          }
      } else if (status === OrderStatus.APPROVED_MANAGER) {
          if (approverUser.role === UserRole.MANAGER || approverUser.role === UserRole.ADMIN) {
              updates.approverManager = approverUser.fullName;
          }
      } else if (status === OrderStatus.APPROVED_CEO) {
          if (approverUser.role === UserRole.CEO || approverUser.role === UserRole.ADMIN) {
              updates.approverCeo = approverUser.fullName;
          }
      }

      if (status === OrderStatus.REJECTED) {
          if (rejectionReason) updates.rejectionReason = rejectionReason;
          updates.rejectedBy = approverUser.fullName; 
      }
      const updatedOrder = { ...order, ...updates };
      return await apiCall<PaymentOrder[]>(`/orders/${id}`, 'PUT', updatedOrder);
  }
  return orders;
};

export const deleteOrder = async (id: string): Promise<PaymentOrder[]> => {
    return await apiCall<PaymentOrder[]>(`/orders/${id}`, 'DELETE');
};

// Fix: Added missing getNextTrackingNumber export
export const getNextTrackingNumber = async (): Promise<number> => {
    try {
        const response = await apiCall<{ nextTrackingNumber: number }>('/next-tracking-number');
        return response.nextTrackingNumber;
    } catch(e) {
        const settings = await getSettings();
        return (settings.currentTrackingNumber || 1000) + 1;
    }
};

// --- EXIT PERMITS ---
export const getExitPermits = async (): Promise<ExitPermit[]> => {
    return await apiCall<ExitPermit[]>('/exit-permits');
};

export const saveExitPermit = async (permit: ExitPermit): Promise<ExitPermit[]> => {
    return await apiCall<ExitPermit[]>('/exit-permits', 'POST', permit);
};

export const editExitPermit = async (updatedPermit: ExitPermit): Promise<ExitPermit[]> => {
    return await apiCall<ExitPermit[]>(`/exit-permits/${updatedPermit.id}`, 'PUT', updatedPermit);
};

export const updateExitPermitStatus = async (id: string, status: ExitPermitStatus, approverUser: User, extra?: { rejectionReason?: string, exitTime?: string }): Promise<ExitPermit[]> => {
    const permits = await getExitPermits();
    const permit = permits.find(p => p.id === id);
    if(permit) {
        const updates: any = { status };
        
        // CEO Stage
        if (status === ExitPermitStatus.PENDING_FACTORY && (approverUser.role === UserRole.CEO || approverUser.role === UserRole.ADMIN)) {
            updates.approverCeo = approverUser.fullName;
        }
        
        // Factory Manager Stage
        if (status === ExitPermitStatus.PENDING_SECURITY && (approverUser.role === UserRole.FACTORY_MANAGER || approverUser.role === UserRole.ADMIN)) {
            updates.approverFactory = approverUser.fullName;
        }

        // Security Guard Stage (Final)
        if (status === ExitPermitStatus.EXITED && (approverUser.role === UserRole.SECURITY_GUARD || approverUser.role === UserRole.SECURITY_HEAD || approverUser.role === UserRole.ADMIN)) {
            updates.approverSecurity = approverUser.fullName;
            if (extra?.exitTime) updates.exitTime = extra.exitTime;
        }

        if (status === ExitPermitStatus.REJECTED) {
            updates.rejectionReason = extra?.rejectionReason || 'بدون دلیل';
            updates.rejectedBy = approverUser.fullName;
        }
        const updatedPermit = { ...permit, ...updates };
        return await apiCall<ExitPermit[]>(`/exit-permits/${id}`, 'PUT', updatedPermit);
    }
    return permits;
};

export const deleteExitPermit = async (id: string): Promise<ExitPermit[]> => {
    return await apiCall<ExitPermit[]>(`/exit-permits/${id}`, 'DELETE');
};

// Fix: Added missing getNextExitPermitNumber export
export const getNextExitPermitNumber = async (): Promise<number> => {
    try {
        const response = await apiCall<{ nextNumber: number }>('/next-exit-permit-number');
        return response.nextNumber;
    } catch(e) {
        const settings = await getSettings();
        return (settings.currentExitPermitNumber || 1000) + 1;
    }
};

// --- WAREHOUSE ---
// Fix: Added missing getWarehouseItems export
export const getWarehouseItems = async (): Promise<WarehouseItem[]> => {
    return await apiCall<WarehouseItem[]>('/warehouse/items');
};

// Fix: Added missing saveWarehouseItem export
export const saveWarehouseItem = async (item: WarehouseItem): Promise<WarehouseItem[]> => {
    return await apiCall<WarehouseItem[]>('/warehouse/items', 'POST', item);
};

// Fix: Added missing updateWarehouseItem export
export const updateWarehouseItem = async (item: WarehouseItem): Promise<WarehouseItem[]> => {
    return await apiCall<WarehouseItem[]>(`/warehouse/items/${item.id}`, 'PUT', item);
};

// Fix: Added missing deleteWarehouseItem export
export const deleteWarehouseItem = async (id: string): Promise<WarehouseItem[]> => {
    return await apiCall<WarehouseItem[]>(`/warehouse/items/${id}`, 'DELETE');
};

// Fix: Added missing getWarehouseTransactions export
export const getWarehouseTransactions = async (): Promise<WarehouseTransaction[]> => {
    return await apiCall<WarehouseTransaction[]>('/warehouse/transactions');
};

// Fix: Added missing saveWarehouseTransaction export
export const saveWarehouseTransaction = async (tx: WarehouseTransaction): Promise<WarehouseTransaction[]> => {
    return await apiCall<WarehouseTransaction[]>('/warehouse/transactions', 'POST', tx);
};

// Fix: Added missing updateWarehouseTransaction export
export const updateWarehouseTransaction = async (tx: WarehouseTransaction): Promise<WarehouseTransaction[]> => {
    return await apiCall<WarehouseTransaction[]>(`/warehouse/transactions/${tx.id}`, 'PUT', tx);
};

// Fix: Added missing deleteWarehouseTransaction export
export const deleteWarehouseTransaction = async (id: string): Promise<WarehouseTransaction[]> => {
    return await apiCall<WarehouseTransaction[]>(`/warehouse/transactions/${id}`, 'DELETE');
};

// Fix: Added missing getNextBijakNumber export
export const getNextBijakNumber = async (company: string): Promise<number> => {
    try {
        const response = await apiCall<{ nextNumber: number }>(`/next-bijak-number?company=${encodeURIComponent(company)}`);
        return response.nextNumber;
    } catch(e) {
        const settings = await getSettings();
        return (settings.warehouseSequences?.[company] || 1000) + 1;
    }
};

// --- CHAT & MESSAGES ---
// Fix: Added missing getMessages export
export const getMessages = async (): Promise<ChatMessage[]> => {
    return await apiCall<ChatMessage[]>('/chat');
};

// Fix: Added missing sendMessage export
export const sendMessage = async (msg: ChatMessage): Promise<ChatMessage[]> => {
    return await apiCall<ChatMessage[]>('/chat', 'POST', msg);
};

// Fix: Added missing deleteMessage export
export const deleteMessage = async (id: string): Promise<ChatMessage[]> => {
    return await apiCall<ChatMessage[]>(`/chat/${id}`, 'DELETE');
};

// Fix: Added missing updateMessage export
export const updateMessage = async (msg: ChatMessage): Promise<ChatMessage[]> => {
    return await apiCall<ChatMessage[]>(`/chat/${msg.id}`, 'PUT', msg);
};

// Fix: Added missing getGroups export
export const getGroups = async (): Promise<ChatGroup[]> => {
    return await apiCall<ChatGroup[]>('/groups');
};

// Fix: Added missing createGroup export
export const createGroup = async (group: ChatGroup): Promise<ChatGroup[]> => {
    return await apiCall<ChatGroup[]>('/groups', 'POST', group);
};

// Fix: Added missing deleteGroup export
export const deleteGroup = async (id: string): Promise<ChatGroup[]> => {
    return await apiCall<ChatGroup[]>(`/groups/${id}`, 'DELETE');
};

// Fix: Added missing updateGroup export
export const updateGroup = async (group: ChatGroup): Promise<ChatGroup[]> => {
    return await apiCall<ChatGroup[]>(`/groups/${group.id}`, 'PUT', group);
};

// Fix: Added missing getTasks export
export const getTasks = async (): Promise<GroupTask[]> => {
    return await apiCall<GroupTask[]>('/tasks');
};

// Fix: Added missing createTask export
export const createTask = async (task: GroupTask): Promise<GroupTask[]> => {
    return await apiCall<GroupTask[]>('/tasks', 'POST', task);
};

// Fix: Added missing updateTask export
export const updateTask = async (task: GroupTask): Promise<GroupTask[]> => {
    return await apiCall<GroupTask[]>(`/tasks/${task.id}`, 'PUT', task);
};

// Fix: Added missing deleteTask export
export const deleteTask = async (id: string): Promise<GroupTask[]> => {
    return await apiCall<GroupTask[]>(`/tasks/${id}`, 'DELETE');
};

// --- TRADE ---
// Fix: Added missing getTradeRecords export
export const getTradeRecords = async (): Promise<TradeRecord[]> => {
    return await apiCall<TradeRecord[]>('/trade');
};

// Fix: Added missing saveTradeRecord export
export const saveTradeRecord = async (record: TradeRecord): Promise<TradeRecord[]> => {
    return await apiCall<TradeRecord[]>('/trade', 'POST', record);
};

// Fix: Added missing updateTradeRecord export
export const updateTradeRecord = async (record: TradeRecord): Promise<TradeRecord[]> => {
    return await apiCall<TradeRecord[]>(`/trade/${record.id}`, 'PUT', record);
};

// Fix: Added missing deleteTradeRecord export
export const deleteTradeRecord = async (id: string): Promise<TradeRecord[]> => {
    return await apiCall<TradeRecord[]>(`/trade/${id}`, 'DELETE');
};

// --- SECURITY ---
// Fix: Added missing getSecurityLogs export
export const getSecurityLogs = async (): Promise<SecurityLog[]> => {
    return await apiCall<SecurityLog[]>('/security/logs');
};

// Fix: Added missing saveSecurityLog export
export const saveSecurityLog = async (log: SecurityLog): Promise<SecurityLog[]> => {
    return await apiCall<SecurityLog[]>('/security/logs', 'POST', log);
};

// Fix: Added missing updateSecurityLog export
export const updateSecurityLog = async (log: SecurityLog): Promise<SecurityLog[]> => {
    return await apiCall<SecurityLog[]>(`/security/logs/${log.id}`, 'PUT', log);
};

// Fix: Added missing getPersonnelDelays export
export const getPersonnelDelays = async (): Promise<PersonnelDelay[]> => {
    return await apiCall<PersonnelDelay[]>('/security/delays');
};

// Fix: Added missing savePersonnelDelay export
export const savePersonnelDelay = async (delay: PersonnelDelay): Promise<PersonnelDelay[]> => {
    return await apiCall<PersonnelDelay[]>('/security/delays', 'POST', delay);
};

// Fix: Added missing updatePersonnelDelay export
export const updatePersonnelDelay = async (delay: PersonnelDelay): Promise<PersonnelDelay[]> => {
    return await apiCall<PersonnelDelay[]>(`/security/delays/${delay.id}`, 'PUT', delay);
};

// Fix: Added missing getSecurityIncidents export
export const getSecurityIncidents = async (): Promise<SecurityIncident[]> => {
    return await apiCall<SecurityIncident[]>('/security/incidents');
};

// Fix: Added missing saveSecurityIncident export
export const saveSecurityIncident = async (incident: SecurityIncident): Promise<SecurityIncident[]> => {
    return await apiCall<SecurityIncident[]>('/security/incidents', 'POST', incident);
};

// Fix: Added missing updateSecurityIncident export
export const updateSecurityIncident = async (incident: SecurityIncident): Promise<SecurityIncident[]> => {
    return await apiCall<SecurityIncident[]>(`/security/incidents/${incident.id}`, 'PUT', incident);
};
