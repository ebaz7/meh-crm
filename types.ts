
export enum PaymentMethod {
  CASH = 'نقد',
  CHEQUE = 'چک',
  TRANSFER = 'حواله بانکی',
  POS = 'کارتخوان',
  SATNA = 'ساتنا',
  PAYA = 'پایا',
  INTERNAL_TRANSFER = 'حواله داخلی'
}

export enum OrderStatus {
  PENDING = 'در انتظار بررسی مالی', 
  APPROVED_FINANCE = 'تایید مالی / در انتظار مدیریت', 
  APPROVED_MANAGER = 'تایید مدیریت / در انتظار مدیرعامل', 
  APPROVED_CEO = 'تایید نهایی', 
  REJECTED = 'رد شده',
  // Revocation Workflow
  REVOCATION_PENDING_FINANCE = 'درخواست ابطال / منتظر تایید مالی',
  REVOCATION_PENDING_MANAGER = 'تایید ابطال مالی / منتظر مدیریت',
  REVOCATION_PENDING_CEO = 'تایید ابطال مدیریت / منتظر مدیرعامل',
  REVOKED = 'باطل شده (نهایی)'
}

export enum ExitPermitStatus {
  PENDING_CEO = 'در انتظار تایید مدیرعامل',
  PENDING_FACTORY = 'تایید مدیرعامل / در انتظار مدیر کارخانه',
  PENDING_SECURITY = 'تایید کارخانه / در انتظار تایید انتظامات',
  EXITED = 'خارج شده (بایگانی)',
  REJECTED = 'رد شده'
}

// Security Module Statuses
export enum SecurityStatus {
  PENDING_SUPERVISOR = 'در انتظار تایید سرپرست انتظامات',
  APPROVED_SUPERVISOR_CHECK = 'تایید اولیه سرپرست (چک شد)', 
  PENDING_FACTORY = 'تایید سرپرست / در انتظار مدیر کارخانه',
  APPROVED_FACTORY_CHECK = 'تایید اولیه مدیر کارخانه (منتظر امضای نهایی)', 
  PENDING_CEO = 'تایید کارخانه / در انتظار مدیرعامل',
  ARCHIVED = 'بایگانی شده (نهایی)',
  REJECTED = 'رد شده'
}

export enum UserRole {
  ADMIN = 'admin',        
  CEO = 'ceo',            
  MANAGER = 'manager',    
  FINANCIAL = 'financial',
  SALES_MANAGER = 'sales_manager', 
  FACTORY_MANAGER = 'factory_manager',
  WAREHOUSE_KEEPER = 'warehouse_keeper', 
  SECURITY_GUARD = 'security_guard',
  SECURITY_HEAD = 'security_head',
  USER = 'user'           
}

export interface User {
  id: string;
  username: string;
  password: string;
  fullName: string;
  role: string;
  canManageTrade?: boolean; 
  receiveNotifications?: boolean; 
  avatar?: string; 
  telegramChatId?: string; 
  phoneNumber?: string; 
}

export interface PaymentDetail {
  id: string;
  amount: number;
  method: PaymentMethod;
  chequeNumber?: string;
  chequeDate?: string; 
  bankName?: string;
  description?: string;
  // SATNA & Paya Fields
  sheba?: string;
  recipientBank?: string;
  paymentId?: string;
  // Internal Transfer Fields
  destinationAccount?: string; // Card or Account Number
  destinationOwner?: string;
}

export interface PaymentOrder {
  id: string;
  trackingNumber: number;
  date: string; 
  payee: string; 
  totalAmount: number; 
  description: string;
  status: OrderStatus;
  payingCompany?: string; 
  paymentLocation?: string; // NEW: Place of Issue/Payment
  paymentDetails: PaymentDetail[];
  requester: string;
  approverFinancial?: string;
  approverManager?: string;
  approverCeo?: string;
  rejectionReason?: string;
  rejectedBy?: string; 
  attachments?: { fileName: string; data: string; }[];
  createdAt: number;
  updatedAt?: number; 
}

// DYNAMIC PRINT TEMPLATE TYPES
export interface PrintField {
    id: string;
    key: string; // e.g., 'amount', 'date_day', 'sheba'
    label: string; // For UI
    x: number; // mm
    y: number; // mm
    width?: number; // mm
    fontSize: number; // px
    letterSpacing?: number; // px (for Sheba boxes)
    align?: 'right' | 'center' | 'left';
    isBold?: boolean;
}

export interface PrintTemplate {
    id: string;
    name: string; // e.g., "Refah Bank Satna"
    width: number; // mm (210 for A4)
    height: number; // mm (297 for A4)
    pageSize: 'A4' | 'A5'; // NEW
    orientation: 'portrait' | 'landscape'; // NEW
    backgroundImage?: string; // Base64 of the form
    fields: PrintField[];
}

export interface ExitPermitItem {
  id: string;
  goodsName: string;
  cartonCount: number;
  weight: number;
}

export interface ExitPermitDestination {
  id: string;
  recipientName: string;
  address: string;
  phone?: string;
}

export interface ExitPermit {
  id: string;
  permitNumber: number;
  date: string;
  requester: string; 
  items: ExitPermitItem[];
  destinations: ExitPermitDestination[];
  goodsName?: string;
  cartonCount?: number;
  weight?: number; 
  recipientName?: string;
  destinationAddress?: string;
  plateNumber?: string; 
  driverName?: string; 
  description?: string;
  exitTime?: string; // Recorded by security in final stage
  status: ExitPermitStatus;
  approverSecurity?: string; 
  approverFactory?: string;
  approverCeo?: string;
  rejectionReason?: string;
  rejectedBy?: string;
  createdAt: number;
  updatedAt?: number;
}

// ... rest of types remain same ...
export interface WarehouseItem { id: string; code: string; name: string; unit: string; containerCapacity?: number; description?: string; }
export interface WarehouseTransactionItem { itemId: string; itemName: string; quantity: number; weight: number; unitPrice?: number; }
export interface WarehouseTransaction { id: string; type: 'IN' | 'OUT'; date: string; company: string; number: number; proformaNumber?: string; recipientName?: string; driverName?: string; plateNumber?: string; destination?: string; items: WarehouseTransactionItem[]; description?: string; status?: 'PENDING' | 'APPROVED' | 'REJECTED'; approvedBy?: string; rejectionReason?: string; rejectedBy?: string; createdAt: number; createdBy: string; updatedAt?: number; }
export interface DailySecurityMeta { dailyDescription?: string; morningGuard?: { name: string; entry: string; exit: string }; eveningGuard?: { name: string; entry: string; exit: string }; nightGuard?: { name: string; entry: string; exit: string }; isFactoryDailyApproved?: boolean; isCeoDailyApproved?: boolean; isDelaySupervisorApproved?: boolean; isDelayFactoryApproved?: boolean; isDelayCeoApproved?: boolean; }
export interface SecurityLog { id: string; rowNumber: number; date: string; shift: string; origin: string; entryTime: string; exitTime: string; driverName: string; plateNumber: string; goodsName: string; quantity: string; destination: string; receiver: string; workDescription: string; permitProvider: string; registrant: string; status: SecurityStatus; approverSupervisor?: string; approverFactory?: string; approverCeo?: string; rejectionReason?: string; createdAt: number; }
export interface PersonnelDelay { id: string; date: string; personnelName: string; unit: string; arrivalTime: string; delayAmount: string; repeatCount?: string; instruction?: string; registrant: string; status: SecurityStatus; approverSupervisor?: string; approverFactory?: string; approverCeo?: string; rejectionReason?: string; createdAt: number; }
export interface SecurityIncident { id: string; reportNumber: string; date: string; subject: string; description: string; shift: string; registrant: string; status: SecurityStatus; witnesses?: string; shiftManagerOpinion?: string; approverSupervisor?: string; approverFactory?: string; approverCeo?: string; hrAction?: string; safetyAction?: string; rejectionReason?: string; createdAt: number; }
export interface RolePermissions { canViewAll: boolean; canCreatePaymentOrder: boolean; canViewPaymentOrders: boolean; canViewExitPermits: boolean; canApproveFinancial: boolean; canApproveManager: boolean; canApproveCeo: boolean; canEditOwn: boolean; canEditAll: boolean; canDeleteOwn: boolean; canDeleteAll: boolean; canManageTrade: boolean; canManageSettings?: boolean; canCreateExitPermit?: boolean; canApproveExitCeo?: boolean; canApproveExitFactory?: boolean; canViewExitArchive?: boolean; canEditExitArchive?: boolean; canManageWarehouse?: boolean; canViewWarehouseReports?: boolean; canApproveBijak?: boolean; canViewSecurity?: boolean; canCreateSecurityLog?: boolean; canApproveSecuritySupervisor?: boolean; }

// Updated CompanyBank to include form layout
export interface CompanyBank { 
    id: string; 
    bankName: string; 
    accountNumber: string; 
    sheba?: string; // Source Sheba
    formLayoutId?: string; // ID of the dynamic template
}

export interface Company { 
    id: string; 
    name: string; 
    logo?: string; 
    showInWarehouse?: boolean; 
    banks?: CompanyBank[]; 
    letterhead?: string;
    // Legal Info for Bank Forms
    registrationNumber?: string;
    nationalId?: string;
    address?: string;
    phone?: string;
}
export interface Contact { id: string; name: string; number: string; isGroup?: boolean; }
export interface CustomRole { id: string; label: string; }
export interface SystemSettings { currentTrackingNumber: number; currentExitPermitNumber: number; companyNames: string[]; companies?: Company[]; defaultCompany: string; bankNames: string[]; operatingBankNames?: string[]; commodityGroups: string[]; rolePermissions: Record<string, RolePermissions>; customRoles?: CustomRole[]; savedContacts?: Contact[]; pwaIcon?: string; telegramBotToken?: string; telegramAdminId?: string; smsApiKey?: string; smsSenderNumber?: string; googleCalendarId?: string; whatsappNumber?: string; geminiApiKey?: string; insuranceCompanies?: string[]; warehouseSequences?: Record<string, number>; exitPermitNotificationGroup?: string; companyNotifications?: Record<string, { salesManager?: string; warehouseGroup?: string; }>; defaultWarehouseGroup?: string; defaultSalesManager?: string; dailySecurityMeta?: Record<string, DailySecurityMeta>; printTemplates?: PrintTemplate[]; }
export interface DashboardStats { totalPending: number; totalApproved: number; totalAmount: number; }
export interface ChatMessage { id: string; sender: string; senderUsername: string; recipient?: string; groupId?: string; role: string; message: string; timestamp: number; attachment?: { fileName: string; url: string; }; audioUrl?: string; isEdited?: boolean; replyTo?: { id: string; sender: string; message: string; }; }
export interface ChatGroup { id: string; name: string; members: string[]; createdBy: string; icon?: string; }
export interface GroupTask { id: string; groupId: string; title: string; assignee?: string; isCompleted: boolean; createdBy: string; createdAt: number; }
export interface AppNotification { id: string; title: string; message: string; timestamp: number; read: boolean; }
export enum TradeStage { LICENSES = 'مجوزها و پروفرما', INSURANCE = 'بیمه', ALLOCATION_QUEUE = 'در صف تخصیص ارز', ALLOCATION_APPROVED = 'تخصیص یافته', CURRENCY_PURCHASE = 'خرید ارز', SHIPPING_DOCS = 'اسناد حمل', INSPECTION = 'گواهی بازرسی', CLEARANCE_DOCS = 'ترخیصیه و قبض انبار', GREEN_LEAF = 'برگ سبز', INTERNAL_SHIPPING = 'حمل داخلی', AGENT_FEES = 'هزینه‌های ترخیص', FINAL_COST = 'قیمت تمام شده' }
export interface TradeStageData { stage: TradeStage; isCompleted: boolean; description: string; costRial: number; costCurrency: number; currencyType: string; attachments: { fileName: string; url: string }[]; updatedAt: number; updatedBy: string; queueDate?: string; currencyRate?: number; allocationDate?: string; allocationExpiry?: string; allocationCode?: string; }
export interface TradeItem { id: string; name: string; weight: number; unitPrice: number; totalPrice: number; hsCode?: string; }
export interface InsuranceEndorsement { id: string; date: string; amount: number; description: string; }
export interface InspectionPayment { id: string; part: string; amount: number; bank: string; date: string; description?: string; }
export interface InspectionCertificate { id: string; part: string; certificateNumber: string; company: string; amount: number; description?: string; }
export interface InspectionData { inspectionCompany?: string; certificateNumber?: string; totalInvoiceAmount?: number; certificates: InspectionCertificate[]; payments: InspectionPayment[]; }
export interface WarehouseReceipt { id: string; number: string; part: string; issueDate: string; }
export interface ClearancePayment { id: string; part: string; amount: number; date: string; bank: string; payingBank?: string; }
export interface ClearanceData { receipts: WarehouseReceipt[]; payments: ClearancePayment[]; }
export interface GreenLeafCustomsDuty { id: string; cottageNumber: string; part: string; amount: number; paymentMethod: 'Bank' | 'Guarantee'; bank?: string; date?: string; }
export interface GreenLeafGuarantee { id: string; relatedDutyId: string; guaranteeNumber: string; guaranteeBank?: string; chequeNumber?: string; chequeBank?: string; chequeDate?: string; chequeAmount?: number; isDelivered?: boolean; cashAmount: number; cashBank?: string; cashDate?: string; part?: string; }
export interface GreenLeafTax { id: string; part: string; amount: number; bank: string; date: string; }
export interface GreenLeafRoadToll { id: string; part: string; amount: number; bank: string; date: string; }
export interface GreenLeafData { duties: GreenLeafCustomsDuty[]; guarantees: GreenLeafGuarantee[]; taxes: GreenLeafTax[]; roadTolls: GreenLeafRoadToll[]; }
export interface ShippingPayment { id: string; part: string; amount: number; date: string; bank: string; description?: string; }
export interface InternalShippingData { payments: ShippingPayment[]; }
export interface AgentPayment { id: string; agentName: string; amount: number; bank: string; date: string; part: string; description?: string; }
export interface AgentData { payments: AgentPayment[]; }
export interface CurrencyPayment { id: string; date: string; amount: number; bank: string; type: 'PAYMENT' | 'REFUND'; description?: string; }
export interface TradeTransaction { id: string; date: string; amount: number; bank?: string; description: string; }
export interface CurrencyTranche { id: string; date: string; amount: number; currencyType: string; rate?: number; rialAmount?: number; currencyFee?: number; brokerName?: string; exchangeName?: string; isDelivered?: boolean; deliveryDate?: string; returnAmount?: number; returnDate?: string; receivedAmount?: number; }
export interface CurrencyPurchaseData { guaranteeCheque?: { chequeNumber: string; amount: number; dueDate: string; bank: string; isReturned?: boolean; returnDate?: string; isDelivered?: boolean; }; payments: CurrencyPayment[]; tranches?: CurrencyTranche[]; purchasedAmount: number; purchasedCurrencyType?: string; purchaseDate?: string; brokerName?: string; exchangeName?: string; deliveredAmount: number; deliveredCurrencyType?: string; deliveryDate?: string; recipientName?: string; remittedAmount: number; isDelivered: boolean; }
export type ShippingDocType = 'Commercial Invoice' | 'Packing List' | 'Certificate of Origin' | 'Bill of Lading';
export type DocStatus = 'Draft' | 'Final';
export interface InvoiceItem { id: string; name: string; weight: number; unitPrice: number; totalPrice: number; part?: string; }
export interface PackingItem { id: string; description: string; netWeight: number; grossWeight: number; packageCount: number; part: string; }
export interface ShippingDocument { id: string; type: ShippingDocType; status: DocStatus; documentNumber: string; documentDate: string; partNumber?: string; invoiceItems?: InvoiceItem[]; amount?: number; freightCost?: number; currency?: string; packingItems?: PackingItem[]; netWeight?: number; grossWeight?: number; packagesCount?: number; chamberOfCommerce?: string; vesselName?: string; portOfLoading?: string; portOfDischarge?: string; description?: string; attachments: { fileName: string; url: string }[]; createdAt: number; createdBy: string; }
export interface TradeRecord { id: string; company?: string; fileNumber: string; registrationNumber?: string; registrationDate?: string; registrationExpiry?: string; currencyAllocationType?: string; allocationCurrencyRank?: 'Type1' | 'Type2'; isPriority?: boolean; commodityGroup?: string; sellerName: string; mainCurrency?: string; items: TradeItem[]; freightCost: number; exchangeRate?: number; operatingBank?: string; licenseData?: { transactions: TradeTransaction[]; registrationCost?: number; bankName?: string; paymentDate?: string; }; insuranceData?: { policyNumber: string; company: string; cost: number; bank: string; endorsements?: InsuranceEndorsement[]; isPaid?: boolean; paymentDate?: string; }; inspectionData?: InspectionData; clearanceData?: ClearanceData; greenLeafData?: GreenLeafData; internalShippingData?: InternalShippingData; agentData?: AgentData; currencyPurchaseData?: CurrencyPurchaseData; shippingDocuments?: ShippingDocument[]; startDate: string; status: 'Active' | 'Completed' | 'Cancelled'; isCommitmentFulfilled?: boolean; isArchived?: boolean; stages: Record<string, TradeStageData>; createdAt: number; createdBy: string; goodsName?: string; orderNumber?: string; }