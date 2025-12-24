
import React, { useState, useEffect, useRef } from 'react';
import { getSettings, saveSettings, restoreSystemData, uploadFile } from '../services/storageService';
import { SystemSettings, UserRole, RolePermissions, Company, Contact, CompanyBank, User, CustomRole, PrintTemplate } from '../types';
import { Settings as SettingsIcon, Save, Loader2, Database, Bell, Plus, Trash2, Building, ShieldCheck, Landmark, Package, AppWindow, BellRing, BellOff, Send, Image as ImageIcon, Pencil, X, Check, MessageCircle, Calendar, Phone, LogOut, RefreshCw, Users, FolderSync, BrainCircuit, Smartphone, Link, Truck, MessageSquare, DownloadCloud, UploadCloud, Warehouse, FileDigit, Briefcase, FileText, Container, Printer, LayoutTemplate, ChevronDown, ChevronRight, Lock, ChevronUp } from 'lucide-react';
import { apiCall } from '../services/apiService';
import { requestNotificationPermission, setNotificationPreference, isNotificationEnabledInApp } from '../services/notificationService';
import { getUsers, updateUser } from '../services/authService';
import { generateUUID } from '../constants';
import PrintTemplateDesigner from './PrintTemplateDesigner';

// Internal QRCode Component to avoid build dependency issues with 'react-qr-code'
const QRCode = ({ value, size }: { value: string, size: number }) => { 
    return <img src={`https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}`} alt="QR Code" width={size} height={size} className="mix-blend-multiply" />; 
};

const Settings: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<'system' | 'data' | 'integrations' | 'whatsapp' | 'permissions' | 'warehouse' | 'commerce' | 'templates'>('system');
  const [settings, setSettings] = useState<SystemSettings>({ 
      currentTrackingNumber: 1000, 
      currentExitPermitNumber: 1000, 
      companyNames: [], 
      companies: [], 
      defaultCompany: '', 
      bankNames: [], 
      operatingBankNames: [], 
      commodityGroups: [], 
      rolePermissions: {}, 
      customRoles: [], 
      savedContacts: [], 
      pwaIcon: '', 
      telegramBotToken: '', 
      telegramAdminId: '', 
      smsApiKey: '', 
      smsSenderNumber: '', 
      googleCalendarId: '', 
      whatsappNumber: '', 
      geminiApiKey: '',
      warehouseSequences: {},
      companyNotifications: {},
      defaultWarehouseGroup: '',
      defaultSalesManager: '',
      insuranceCompanies: [],
      exitPermitNotificationGroup: '',
      printTemplates: [] // Init
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [restoring, setRestoring] = useState(false);
  
  // Designer State
  const [showDesigner, setShowDesigner] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PrintTemplate | null>(null);

  // Company Editing State
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyLogo, setNewCompanyLogo] = useState('');
  const [newCompanyShowInWarehouse, setNewCompanyShowInWarehouse] = useState(true);
  const [newCompanyBanks, setNewCompanyBanks] = useState<CompanyBank[]>([]);
  const [newCompanyLetterhead, setNewCompanyLetterhead] = useState('');
  
  // New Company Fields
  const [newCompanyRegNum, setNewCompanyRegNum] = useState('');
  const [newCompanyNatId, setNewCompanyNatId] = useState('');
  const [newCompanyAddress, setNewCompanyAddress] = useState('');
  const [newCompanyPhone, setNewCompanyPhone] = useState('');
  const [newCompanyFax, setNewCompanyFax] = useState(''); // NEW
  const [newCompanyPostalCode, setNewCompanyPostalCode] = useState(''); // NEW
  const [newCompanyEcoCode, setNewCompanyEcoCode] = useState(''); // NEW

  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [editingBankId, setEditingBankId] = useState<string | null>(null); // For editing specific bank inside company
  
  // Local states for adding/editing banks
  const [tempBankName, setTempBankName] = useState('');
  const [tempAccountNum, setTempAccountNum] = useState('');
  const [tempBankSheba, setTempBankSheba] = useState('');
  const [tempBankLayout, setTempBankLayout] = useState<string>(''); // Default Template
  const [tempInternalLayout, setTempInternalLayout] = useState<string>(''); // Internal Transfer Template (Legacy)
  const [tempInternalWithdrawalLayout, setTempInternalWithdrawalLayout] = useState<string>(''); // New
  const [tempInternalDepositLayout, setTempInternalDepositLayout] = useState<string>(''); // New
  const [tempDualPrint, setTempDualPrint] = useState(false); // Dual Print Toggle

  // Commerce Local States
  const [newInsuranceCompany, setNewInsuranceCompany] = useState('');

  // Custom Role Local State
  const [newRoleName, setNewRoleName] = useState('');

  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingLetterhead, setIsUploadingLetterhead] = useState(false);
  const companyLogoInputRef = useRef<HTMLInputElement>(null);
  const companyLetterheadInputRef = useRef<HTMLInputElement>(null);

  const [whatsappStatus, setWhatsappStatus] = useState<{ready: boolean, qr: string | null, user: string | null} | null>(null);
  const [refreshingWA, setRefreshingWA] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [isGroupContact, setIsGroupContact] = useState(false);
  const [fetchingGroups, setFetchingGroups] = useState(false);
  const [newOperatingBank, setNewOperatingBank] = useState('');
  const [newCommodity, setNewCommodity] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const iconInputRef = useRef<HTMLInputElement>(null);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const isSecure = window.isSecureContext;
  
  // App Users to merge into contacts list and manage access
  const [appUsers, setAppUsers] = useState<(Contact | User)[]>([]); // Mixed list or handle separately
  
  // Collapsed state for permission groups
  const [expandedPermGroups, setExpandedPermGroups] = useState<Record<string, boolean>>({});

  useEffect(() => { 
      loadSettings(); 
      setNotificationsEnabled(isNotificationEnabledInApp()); 
      checkWhatsappStatus();
      loadAppUsers();
  }, []);

  const loadSettings = async () => { 
      try { 
          const data = await getSettings(); 
          let safeData = { ...data };
          safeData.currentExitPermitNumber = safeData.currentExitPermitNumber || 1000;
          safeData.companies = safeData.companies || [];
          safeData.operatingBankNames = safeData.operatingBankNames || [];
          safeData.insuranceCompanies = safeData.insuranceCompanies || [];
          if (safeData.companyNames?.length > 0 && safeData.companies.length === 0) {
              safeData.companies = safeData.companyNames.map(name => ({ id: generateUUID(), name, showInWarehouse: true, banks: [] }));
          }
          if(!safeData.warehouseSequences) safeData.warehouseSequences = {};
          if(!safeData.companyNotifications) safeData.companyNotifications = {};
          if(!safeData.customRoles) safeData.customRoles = [];
          if(!safeData.printTemplates) safeData.printTemplates = [];
          setSettings(safeData); 
      } catch (e) { console.error("Failed to load settings"); } 
  };

  const loadAppUsers = async () => {
      try {
          const users = await getUsers();
          const contacts = users
              .filter(u => u.phoneNumber)
              .map(u => ({
                  id: u.id,
                  name: `(کاربر) ${u.fullName}`,
                  number: u.phoneNumber!,
                  isGroup: false
              }));
          setAppUsers(contacts);
      } catch (e) { console.error("Failed to load users"); }
  };

  const checkWhatsappStatus = async () => {
      setRefreshingWA(true);
      try {
          const status = await apiCall<{ready: boolean, qr: string | null, user: string | null}>('/whatsapp/status');
          setWhatsappStatus(status);
      } catch (e) { console.error("Failed to check WA status"); } finally { setRefreshingWA(false); }
  };

  const handleWhatsappLogout = async () => {
      if(!confirm('آیا مطمئن هستید؟')) return;
      try { await apiCall('/whatsapp/logout', 'POST'); setTimeout(checkWhatsappStatus, 2000); } catch (e) { alert('خطا'); }
  };

  const handleFetchGroups = async () => {
      if (!whatsappStatus?.ready) { alert("واتساپ متصل نیست."); return; }
      setFetchingGroups(true);
      try {
          const response = await apiCall<{success: boolean, groups: {id: string, name: string}[]}>('/whatsapp/groups');
          if (response.success && response.groups) {
              const existingIds = new Set((settings.savedContacts || []).map(c => c.number));
              const newGroups = response.groups.filter(g => !existingIds.has(g.id)).map(g => ({ id: generateUUID(), name: g.name, number: g.id, isGroup: true }));
              if (newGroups.length > 0) {
                  setSettings({ ...settings, savedContacts: [...(settings.savedContacts || []), ...newGroups] });
                  alert(`${newGroups.length} گروه اضافه شد.`);
              } else alert("گروه جدیدی یافت نشد.");
          }
      } catch (e) { alert("خطا در دریافت."); } finally { setFetchingGroups(false); }
  };

  useEffect(() => {
      let interval: any;
      if (activeCategory === 'whatsapp' && whatsappStatus && !whatsappStatus.ready) {
          interval = setInterval(checkWhatsappStatus, 3000); 
      }
      return () => clearInterval(interval);
  }, [activeCategory, whatsappStatus]);

  const handleSave = async (e: React.FormEvent) => { 
      e.preventDefault(); setLoading(true); 
      try { 
          // 1. Check if there are pending company edits in the form that weren't "Added/Edited"
          let currentCompanies = [...(settings.companies || [])];
          
          if (activeCategory === 'data' && (newCompanyName.trim() || editingCompanyId)) {
              // Apply the pending edit/add automatically
              if (editingCompanyId) {
                  currentCompanies = currentCompanies.map(c =>
                      c.id === editingCompanyId
                          ? { 
                              ...c, 
                              name: newCompanyName.trim(), 
                              logo: newCompanyLogo, 
                              showInWarehouse: newCompanyShowInWarehouse,
                              banks: newCompanyBanks,
                              letterhead: newCompanyLetterhead,
                              registrationNumber: newCompanyRegNum,
                              nationalId: newCompanyNatId,
                              address: newCompanyAddress,
                              phone: newCompanyPhone,
                              fax: newCompanyFax,
                              postalCode: newCompanyPostalCode,
                              economicCode: newCompanyEcoCode
                            }
                          : c
                  );
              } else if (newCompanyName.trim()) {
                  currentCompanies = [...currentCompanies, {
                      id: generateUUID(),
                      name: newCompanyName.trim(),
                      logo: newCompanyLogo,
                      showInWarehouse: newCompanyShowInWarehouse,
                      banks: newCompanyBanks,
                      letterhead: newCompanyLetterhead,
                      registrationNumber: newCompanyRegNum,
                      nationalId: newCompanyNatId,
                      address: newCompanyAddress,
                      phone: newCompanyPhone,
                      fax: newCompanyFax,
                      postalCode: newCompanyPostalCode,
                      economicCode: newCompanyEcoCode
                  }];
              }
              // Clear form
              resetCompanyForm();
          }

          // 2. Prepare Settings Object
          const syncedSettings = { 
              ...settings, 
              companies: currentCompanies,
              companyNames: currentCompanies.map(c => c.name) 
          };

          await saveSettings(syncedSettings); 
          setSettings(syncedSettings);
          setMessage('ذخیره شد ✅'); setTimeout(() => setMessage(''), 3000); 
      } catch (e) { setMessage('خطا ❌'); } finally { setLoading(false); } 
  };

  const handleAddContact = () => { if (!contactName.trim() || !contactNumber.trim()) return; const newContact: Contact = { id: generateUUID(), name: contactName.trim(), number: contactNumber.trim(), isGroup: isGroupContact }; setSettings({ ...settings, savedContacts: [...(settings.savedContacts || []), newContact] }); setContactName(''); setContactNumber(''); setIsGroupContact(false); };
  const handleDeleteContact = (id: string) => { setSettings({ ...settings, savedContacts: (settings.savedContacts || []).filter(c => c.id !== id) }); };
  
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; setIsUploadingLogo(true); const reader = new FileReader(); reader.onload = async (ev) => { try { const result = await uploadFile(file.name, ev.target?.result as string); setNewCompanyLogo(result.url); } catch (error) { alert('خطا در آپلود'); } finally { setIsUploadingLogo(false); } }; reader.readAsDataURL(file); };
  const handleLetterheadUpload = async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; setIsUploadingLetterhead(true); const reader = new FileReader(); reader.onload = async (ev) => { try { const result = await uploadFile(file.name, ev.target?.result as string); setNewCompanyLetterhead(result.url); } catch (error) { alert('خطا در آپلود'); } finally { setIsUploadingLetterhead(false); } }; reader.readAsDataURL(file); };

  const handleSaveCompany = () => { 
      if (!newCompanyName.trim()) return; 
      let updatedCompanies = settings.companies || []; 
      const companyData = { 
          id: editingCompanyId || generateUUID(), 
          name: newCompanyName.trim(), 
          logo: newCompanyLogo, 
          showInWarehouse: newCompanyShowInWarehouse,
          banks: newCompanyBanks,
          letterhead: newCompanyLetterhead,
          registrationNumber: newCompanyRegNum,
          nationalId: newCompanyNatId,
          address: newCompanyAddress,
          phone: newCompanyPhone,
          fax: newCompanyFax,
          postalCode: newCompanyPostalCode,
          economicCode: newCompanyEcoCode
      };

      if (editingCompanyId) {
          updatedCompanies = updatedCompanies.map(c => c.id === editingCompanyId ? companyData : c); 
      } else {
          updatedCompanies = [...updatedCompanies, companyData]; 
      }
      setSettings({ ...settings, companies: updatedCompanies, companyNames: updatedCompanies.map(c => c.name) }); 
      resetCompanyForm();
  };

  const handleEditCompany = (c: Company) => { 
      setNewCompanyName(c.name); 
      setNewCompanyLogo(c.logo || ''); 
      setNewCompanyShowInWarehouse(c.showInWarehouse !== false);
      setNewCompanyBanks(c.banks || []);
      setNewCompanyLetterhead(c.letterhead || '');
      setNewCompanyRegNum(c.registrationNumber || '');
      setNewCompanyNatId(c.nationalId || '');
      setNewCompanyAddress(c.address || '');
      setNewCompanyPhone(c.phone || '');
      setNewCompanyFax(c.fax || '');
      setNewCompanyPostalCode(c.postalCode || '');
      setNewCompanyEcoCode(c.economicCode || '');
      setEditingCompanyId(c.id); 
  };

  const resetCompanyForm = () => {
      setNewCompanyName(''); 
      setNewCompanyLogo(''); 
      setNewCompanyShowInWarehouse(true);
      setNewCompanyBanks([]);
      setNewCompanyLetterhead('');
      setNewCompanyRegNum('');
      setNewCompanyNatId('');
      setNewCompanyAddress('');
      setNewCompanyPhone('');
      setNewCompanyFax('');
      setNewCompanyPostalCode('');
      setNewCompanyEcoCode('');
      setEditingCompanyId(null); 
      
      resetBankForm();
  };

  const resetBankForm = () => {
      setTempBankName('');
      setTempAccountNum('');
      setTempBankSheba('');
      setTempBankLayout('');
      setTempInternalLayout('');
      setTempInternalWithdrawalLayout('');
      setTempInternalDepositLayout('');
      setTempDualPrint(false);
      setEditingBankId(null);
  };

  const handleRemoveCompany = (id: string) => { if(confirm("حذف؟")) { const updated = (settings.companies || []).filter(c => c.id !== id); setSettings({ ...settings, companies: updated, companyNames: updated.map(c => c.name) }); } };
  
  // Company Bank Management
  const addOrUpdateCompanyBank = () => {
      if (!tempBankName) return;
      const bankData: CompanyBank = { 
          id: editingBankId || generateUUID(), 
          bankName: tempBankName, 
          accountNumber: tempAccountNum,
          sheba: tempBankSheba,
          formLayoutId: tempBankLayout,
          internalTransferTemplateId: tempInternalLayout, // Keep for backward compat
          enableDualPrint: tempDualPrint,
          internalWithdrawalTemplateId: tempInternalWithdrawalLayout,
          internalDepositTemplateId: tempInternalDepositLayout
      };

      if (editingBankId) {
          setNewCompanyBanks(newCompanyBanks.map(b => b.id === editingBankId ? bankData : b));
      } else {
          setNewCompanyBanks([...newCompanyBanks, bankData]);
      }
      resetBankForm();
  };

  const editCompanyBank = (bank: CompanyBank) => {
      setTempBankName(bank.bankName);
      setTempAccountNum(bank.accountNumber);
      setTempBankSheba(bank.sheba || '');
      setTempBankLayout(bank.formLayoutId || '');
      setTempInternalLayout(bank.internalTransferTemplateId || '');
      setTempDualPrint(bank.enableDualPrint || false);
      setTempInternalWithdrawalLayout(bank.internalWithdrawalTemplateId || '');
      setTempInternalDepositLayout(bank.internalDepositTemplateId || '');
      setEditingBankId(bank.id);
  };

  const removeCompanyBank = (id: string) => {
      setNewCompanyBanks(newCompanyBanks.filter(b => b.id !== id));
      if (editingBankId === id) resetBankForm();
  };

  // Operating Banks
  const handleAddOperatingBank = () => { if (newOperatingBank.trim() && !(settings.operatingBankNames || []).includes(newOperatingBank.trim())) { setSettings({ ...settings, operatingBankNames: [...(settings.operatingBankNames || []), newOperatingBank.trim()] }); setNewOperatingBank(''); } };
  const handleRemoveOperatingBank = (name: string) => { setSettings({ ...settings, operatingBankNames: (settings.operatingBankNames || []).filter(b => b !== name) }); };

  const handleAddCommodity = () => { if (newCommodity.trim() && !settings.commodityGroups.includes(newCommodity.trim())) { setSettings({ ...settings, commodityGroups: [...settings.commodityGroups, newCommodity.trim()] }); setNewCommodity(''); } };
  const handleRemoveCommodity = (name: string) => { setSettings({ ...settings, commodityGroups: settings.commodityGroups.filter(c => c !== name) }); };
  
  // INSURANCE COMPANIES
  const handleAddInsuranceCompany = () => { if (newInsuranceCompany.trim() && !(settings.insuranceCompanies || []).includes(newInsuranceCompany.trim())) { setSettings({ ...settings, insuranceCompanies: [...(settings.insuranceCompanies || []), newInsuranceCompany.trim()] }); setNewInsuranceCompany(''); } };
  const handleRemoveInsuranceCompany = (name: string) => { setSettings({ ...settings, insuranceCompanies: (settings.insuranceCompanies || []).filter(c => c !== name) }); };

  // CUSTOM ROLES MANAGEMENT
  const handleAddRole = () => {
      if (!newRoleName.trim()) return;
      // Generate a distinct ID for the custom role
      const roleId = `role_${Date.now()}`;
      const newRole: CustomRole = { id: roleId, label: newRoleName.trim() };
      setSettings({
          ...settings,
          customRoles: [...(settings.customRoles || []), newRole]
      });
      setNewRoleName('');
  };

  const handleRemoveRole = (roleId: string) => {
      if (!confirm("آیا از حذف این نقش اطمینان دارید؟")) return;
      const updatedRoles = (settings.customRoles || []).filter(r => r.id !== roleId);
      // Clean up permissions for this role
      const updatedPermissions = { ...settings.rolePermissions };
      delete updatedPermissions[roleId];
      
      setSettings({
          ...settings,
          customRoles: updatedRoles,
          rolePermissions: updatedPermissions
      });
  };

  const handlePermissionChange = (role: string, field: keyof RolePermissions, value: boolean) => { setSettings({ ...settings, rolePermissions: { ...settings.rolePermissions, [role]: { ...settings.rolePermissions[role], [field]: value } } }); };
  const handleIconChange = async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; setUploadingIcon(true); const reader = new FileReader(); reader.onload = async (ev) => { try { const res = await uploadFile(file.name, ev.target?.result as string); setSettings({ ...settings, pwaIcon: res.url }); } catch (error) { alert('خطا'); } finally { setUploadingIcon(false); } }; reader.readAsDataURL(file); };
  const handleToggleNotifications = async () => { if (!isSecure) { alert("HTTPS لازم است"); return; } if (notificationsEnabled) { setNotificationPreference(false); setNotificationsEnabled(false); } else { const granted = await requestNotificationPermission(); if (granted) { setNotificationPreference(true); setNotificationsEnabled(true); } } };

  const handleDownloadBackup = (includeFiles: boolean) => { 
      window.location.href = `/api/full-backup?includeFiles=${includeFiles}`; 
  };
  
  const handleRestoreClick = () => { if (confirm('بازگردانی اطلاعات کامل (شامل عکس‌ها)؟ همه اطلاعات فعلی پاک می‌شود.')) fileInputRef.current?.click(); };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; setRestoring(true); const reader = new FileReader(); reader.onload = async (ev) => { const base64 = ev.target?.result as string; try { const response = await apiCall<{success: boolean}>('/full-restore', 'POST', { fileData: base64 }); if (response.success) { alert('بازگردانی کامل با موفقیت انجام شد. سیستم رفرش می‌شود.'); window.location.reload(); } } catch (error) { alert('خطا در بازگردانی فایل Zip'); } finally { setRestoring(false); } }; reader.readAsDataURL(file); };

  // PRINT TEMPLATE HANDLERS
  const handleSaveTemplate = (template: PrintTemplate) => {
      const existing = settings.printTemplates || [];
      const updated = editingTemplate 
          ? existing.map(t => t.id === template.id ? template : t)
          : [...existing, template];
      
      setSettings({ ...settings, printTemplates: updated });
      setShowDesigner(false);
      setEditingTemplate(null);
  };

  const handleEditTemplate = (t: PrintTemplate) => {
      setEditingTemplate(t);
      setShowDesigner(true);
  };

  const handleDeleteTemplate = (id: string) => {
      if(!confirm('حذف قالب؟')) return;
      const updated = (settings.printTemplates || []).filter(t => t.id !== id);
      setSettings({ ...settings, printTemplates: updated });
  };

  const defaultRoles = [ 
      { id: UserRole.USER, label: 'کاربر عادی' }, 
      { id: UserRole.FINANCIAL, label: 'مدیر مالی' }, 
      { id: UserRole.MANAGER, label: 'مدیر داخلی' }, 
      { id: UserRole.CEO, label: 'مدیر عامل' }, 
      { id: UserRole.SALES_MANAGER, label: 'مدیر فروش' },
      { id: UserRole.FACTORY_MANAGER, label: 'مدیر کارخانه' },
      { id: UserRole.WAREHOUSE_KEEPER, label: 'انباردار' },
      { id: UserRole.SECURITY_HEAD, label: 'سرپرست انتظامات' },
      { id: UserRole.SECURITY_GUARD, label: 'نگهبان' },
      { id: UserRole.ADMIN, label: 'مدیر سیستم' }, 
  ];

  // Combine default and custom roles for the permissions editor
  const allRoles = [...defaultRoles, ...(settings.customRoles || [])];
  
  // -- NEW PERMISSION GROUPS DEFINITION --
  const PERMISSION_GROUPS = [
      {
          id: 'payment',
          title: 'ماژول پرداخت',
          icon: Landmark,
          color: 'blue',
          items: [
              { id: 'canCreatePaymentOrder', label: 'ثبت دستور پرداخت جدید' },
              { id: 'canViewPaymentOrders', label: 'مشاهده کارتابل پرداخت' },
              { id: 'canApproveFinancial', label: 'تایید مرحله مالی' },
              { id: 'canApproveManager', label: 'تایید مرحله مدیریت' },
              { id: 'canApproveCeo', label: 'تایید مرحله نهایی (مدیرعامل)' }
          ]
      },
      {
          id: 'exit',
          title: 'ماژول خروج کارخانه',
          icon: Truck,
          color: 'orange',
          items: [
              { id: 'canCreateExitPermit', label: 'ثبت درخواست خروج بار' },
              { id: 'canViewExitPermits', label: 'مشاهده کارتابل خروج' },
              { id: 'canApproveExitCeo', label: 'تایید خروج (مدیرعامل)' },
              { id: 'canApproveExitFactory', label: 'تایید خروج (مدیر کارخانه)' },
              { id: 'canApproveExitWarehouse', label: 'تایید خروج (سرپرست انبار)' },
              { id: 'canApproveExitSecurity', label: 'تایید نهایی خروج (انتظامات)' }, // NEW PERMISSION ADDED
              { id: 'canViewExitArchive', label: 'مشاهده بایگانی خروج' },
              { id: 'canEditExitArchive', label: 'اصلاح اسناد بایگانی (Admin)' }
          ]
      },
      {
          id: 'warehouse',
          title: 'ماژول انبار',
          icon: Warehouse,
          color: 'green',
          items: [
              { id: 'canManageWarehouse', label: 'مدیریت انبار (ورود/خروج)' },
              { id: 'canViewWarehouseReports', label: 'مشاهده گزارشات انبار' },
              { id: 'canApproveBijak', label: 'تایید نهایی بیجک (مدیریت)' }
          ]
      },
      {
          id: 'security',
          title: 'ماژول انتظامات',
          icon: ShieldCheck,
          color: 'purple',
          items: [
              { id: 'canViewSecurity', label: 'مشاهده ماژول انتظامات' },
              { id: 'canCreateSecurityLog', label: 'ثبت گزارشات (نگهبان)' },
              { id: 'canApproveSecuritySupervisor', label: 'تایید گزارشات (سرپرست)' }
          ]
      },
      {
          id: 'general',
          title: 'عمومی و مدیریتی',
          icon: Lock,
          color: 'gray',
          items: [
              { id: 'canViewAll', label: 'مشاهده تمام دستورات (همه کاربران)' },
              { id: 'canEditOwn', label: 'ویرایش دستور خود' },
              { id: 'canDeleteOwn', label: 'حذف دستور خود' },
              { id: 'canEditAll', label: 'ویرایش تمام دستورات' },
              { id: 'canDeleteAll', label: 'حذف تمام دستورات' },
              { id: 'canManageTrade', label: 'دسترسی به بخش بازرگانی' },
              { id: 'canManageSettings', label: 'دسترسی به تنظیمات سیستم' }
          ]
      }
  ];

  const togglePermissionGroup = (roleId: string, groupItems: {id: string}[], isChecked: boolean) => {
      const newPermissions = { ...settings.rolePermissions?.[roleId] || {} };
      groupItems.forEach(item => {
          newPermissions[item.id as keyof RolePermissions] = isChecked;
      });
      setSettings({
          ...settings,
          rolePermissions: { ...settings.rolePermissions, [roleId]: newPermissions }
      });
  };

  const getMergedContactOptions = () => {
      return [...(settings.savedContacts || []), ...appUsers as Contact[]];
  };

  const toggleGroupExpand = (key: string) => {
      setExpandedPermGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (showDesigner) {
      return <PrintTemplateDesigner onSave={handleSaveTemplate} onCancel={() => setShowDesigner(false)} initialTemplate={editingTemplate} />;
  }

  // ... (render return structure remains same, justPERMISSION_GROUPS updated)
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col md:flex-row min-h-[600px] mb-20 animate-fade-in">
        
        <div className="w-full md:w-64 bg-gray-50 border-b md:border-b-0 md:border-l border-gray-200 p-4">
            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2 px-2"><SettingsIcon size={24} className="text-blue-600"/> تنظیمات</h2>
            <nav className="space-y-1">
                <button onClick={() => setActiveCategory('system')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeCategory === 'system' ? 'bg-white shadow text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-100'}`}><AppWindow size={18}/> عمومی و سیستم</button>
                <button onClick={() => setActiveCategory('data')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeCategory === 'data' ? 'bg-white shadow text-indigo-700 font-bold' : 'text-gray-600 hover:bg-gray-100'}`}><Database size={18}/> اطلاعات پایه</button>
                <button onClick={() => setActiveCategory('templates')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeCategory === 'templates' ? 'bg-white shadow text-teal-700 font-bold' : 'text-gray-600 hover:bg-gray-100'}`}><LayoutTemplate size={18}/> قالب‌های چاپ</button>
                <button onClick={() => setActiveCategory('commerce')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeCategory === 'commerce' ? 'bg-white shadow text-rose-700 font-bold' : 'text-gray-600 hover:bg-gray-100'}`}><Container size={18}/> تنظیمات بازرگانی</button>
                <button onClick={() => setActiveCategory('warehouse')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeCategory === 'warehouse' ? 'bg-white shadow text-orange-700 font-bold' : 'text-gray-600 hover:bg-gray-100'}`}><Warehouse size={18}/> انبار</button>
                <button onClick={() => setActiveCategory('integrations')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeCategory === 'integrations' ? 'bg-white shadow text-purple-700 font-bold' : 'text-gray-600 hover:bg-gray-100'}`}><Link size={18}/> اتصالات (API)</button>
                <button onClick={() => setActiveCategory('whatsapp')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeCategory === 'whatsapp' ? 'bg-white shadow text-green-700 font-bold' : 'text-gray-600 hover:bg-gray-100'}`}><MessageCircle size={18}/> مدیریت واتساپ</button>
                <button onClick={() => setActiveCategory('permissions')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeCategory === 'permissions' ? 'bg-white shadow text-amber-700 font-bold' : 'text-gray-600 hover:bg-gray-100'}`}><ShieldCheck size={18}/> دسترسی‌ها و نقش‌ها</button>
            </nav>
        </div>

        <div className="flex-1 p-6 md:p-8 overflow-y-auto max-h-[calc(100vh-100px)]">
            <form onSubmit={handleSave} className="space-y-8 max-w-4xl mx-auto">
                {/* ... (Existing sections 1-6) ... */}
                
                {/* 7. PERMISSIONS */}
                {activeCategory === 'permissions' && (
                    <div className="space-y-8 animate-fade-in">
                        
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 mb-6">
                            <h3 className="font-bold text-blue-800 mb-3 flex items-center gap-2"><Users size={20}/> تعریف نقش‌های کاربری سفارشی</h3>
                            <div className="flex gap-2">
                                <input 
                                    className="flex-1 border rounded-lg p-2 text-sm bg-white" 
                                    placeholder="نام نقش جدید (مثال: انتظامات، کارشناس فروش...)" 
                                    value={newRoleName} 
                                    onChange={(e) => setNewRoleName(e.target.value)} 
                                />
                                <button type="button" onClick={handleAddRole} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 flex items-center gap-1">
                                    <Plus size={18}/> افزودن نقش
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-2 mt-3">
                                {settings.customRoles?.map(role => (
                                    <div key={role.id} className="bg-white px-3 py-1.5 rounded-lg border border-blue-100 text-blue-800 text-sm font-bold flex items-center gap-2 shadow-sm">
                                        <span>{role.label}</span>
                                        <button type="button" onClick={() => handleRemoveRole(role.id)} className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded p-0.5"><X size={14}/></button>
                                    </div>
                                ))}
                                {(!settings.customRoles || settings.customRoles.length === 0) && (
                                    <span className="text-xs text-gray-500">هیچ نقش سفارشی تعریف نشده است.</span>
                                )}
                            </div>
                        </div>

                        <h3 className="font-bold text-gray-800 border-b pb-2 flex items-center gap-2"><ShieldCheck size={20}/> مدیریت دسترسی نقش‌ها</h3>
                        <div className="space-y-6">
                            {allRoles.map(role => (
                                <div key={role.id} className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                    <div className="flex justify-between items-center mb-3 border-b pb-2">
                                        <h4 className="font-bold text-sm text-gray-800">{role.label}</h4>
                                    </div>
                                    
                                    <div className="space-y-3">
                                        {PERMISSION_GROUPS.map(group => {
                                            const groupKey = `${role.id}-${group.id}`;
                                            const isExpanded = expandedPermGroups[groupKey]; 

                                            const allChecked = group.items.every(item => settings.rolePermissions?.[role.id]?.[item.id as keyof RolePermissions]);

                                            const headerColorClass = 
                                                group.color === 'blue' ? 'bg-blue-100 text-blue-900 border-blue-200' :
                                                group.color === 'orange' ? 'bg-orange-100 text-orange-900 border-orange-200' :
                                                group.color === 'green' ? 'bg-green-100 text-green-900 border-green-200' :
                                                group.color === 'purple' ? 'bg-purple-100 text-purple-900 border-purple-200' :
                                                'bg-gray-200 text-gray-800 border-gray-300';

                                            return (
                                                <div key={group.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden transition-all duration-200">
                                                    <div 
                                                        className={`p-3 flex items-center justify-between cursor-pointer select-none border-b ${headerColorClass}`} 
                                                        onClick={() => toggleGroupExpand(groupKey)}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-1 bg-white/50 rounded hover:bg-white transition-colors" onClick={(e) => e.stopPropagation()}>
                                                                <input 
                                                                    type="checkbox" 
                                                                    className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                                                                    checked={allChecked}
                                                                    onChange={(e) => togglePermissionGroup(role.id, group.items, e.target.checked)}
                                                                    title="انتخاب/لغو انتخاب همه موارد این گروه"
                                                                />
                                                            </div>
                                                            <div className="flex items-center gap-2 font-bold text-xs">
                                                                <group.icon size={18}/> {group.title}
                                                            </div>
                                                        </div>
                                                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                                    </div>
                                                    
                                                    {isExpanded && (
                                                        <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-2 bg-white animate-fade-in">
                                                            {group.items.map(item => (
                                                                <label key={`${role.id}-${item.id}`} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors border border-transparent hover:border-gray-100">
                                                                    <input 
                                                                        type="checkbox" 
                                                                        className="w-4 h-4 text-blue-600 rounded border-gray-300"
                                                                        checked={settings.rolePermissions?.[role.id]?.[item.id as keyof RolePermissions] ?? false}
                                                                        onChange={(e) => handlePermissionChange(role.id, item.id as keyof RolePermissions, e.target.checked)}
                                                                    />
                                                                    <span className="text-xs text-gray-700 font-medium">{item.label}</span>
                                                                </label>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex justify-end pt-4 border-t sticky bottom-0 bg-white p-4 shadow-inner md:shadow-none md:static">
                    <button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-600/20 transition-all disabled:opacity-70">
                        {loading ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />} ذخیره تنظیمات
                    </button>
                </div>
            </form>
        </div>
        {message && (<div className={`fixed bottom-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full text-white text-sm font-bold shadow-2xl z-[100] animate-bounce ${message.includes('خطا') ? 'bg-red-600' : 'bg-green-600'}`}>{message}</div>)}
    </div>
  );
};
export default Settings;
