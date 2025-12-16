
import React, { useState, useEffect, useRef } from 'react';
import { getSettings, saveSettings, restoreSystemData, uploadFile } from '../services/storageService';
import { SystemSettings, UserRole, RolePermissions, Company, Contact, CompanyBank, User } from '../types';
import { Settings as SettingsIcon, Save, Loader2, Database, Bell, Plus, Trash2, Building, ShieldCheck, Landmark, Package, AppWindow, BellRing, BellOff, Send, Image as ImageIcon, Pencil, X, Check, MessageCircle, Calendar, Phone, LogOut, RefreshCw, Users, FolderSync, BrainCircuit, Smartphone, Link, Truck, MessageSquare, DownloadCloud, UploadCloud, Warehouse, FileDigit, Briefcase, FileText, Container } from 'lucide-react';
import { apiCall } from '../services/apiService';
import { requestNotificationPermission, setNotificationPreference, isNotificationEnabledInApp } from '../services/notificationService';
import { getUsers, updateUser } from '../services/authService';
import { generateUUID } from '../constants';

// Internal QRCode Component to avoid build dependency issues with 'react-qr-code'
const QRCode = ({ value, size }: { value: string, size: number }) => { 
    return <img src={`https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}`} alt="QR Code" width={size} height={size} className="mix-blend-multiply" />; 
};

const Settings: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<'system' | 'data' | 'integrations' | 'whatsapp' | 'permissions' | 'warehouse' | 'commerce'>('system');
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
      insuranceCompanies: [] 
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [restoring, setRestoring] = useState(false);
  
  // Company Editing State
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyLogo, setNewCompanyLogo] = useState('');
  const [newCompanyShowInWarehouse, setNewCompanyShowInWarehouse] = useState(true);
  const [newCompanyBanks, setNewCompanyBanks] = useState<CompanyBank[]>([]);
  const [newCompanyLetterhead, setNewCompanyLetterhead] = useState('');
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  
  // Local states for adding banks to a company
  const [tempBankName, setTempBankName] = useState('');
  const [tempAccountNum, setTempAccountNum] = useState('');

  // Commerce Local States
  const [newInsuranceCompany, setNewInsuranceCompany] = useState('');

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
                              letterhead: newCompanyLetterhead
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
                      letterhead: newCompanyLetterhead
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
          letterhead: newCompanyLetterhead
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
      setEditingCompanyId(c.id); 
  };

  const resetCompanyForm = () => {
      setNewCompanyName(''); 
      setNewCompanyLogo(''); 
      setNewCompanyShowInWarehouse(true);
      setNewCompanyBanks([]);
      setNewCompanyLetterhead('');
      setEditingCompanyId(null); 
      setTempBankName('');
      setTempAccountNum('');
  };

  const handleRemoveCompany = (id: string) => { if(confirm("حذف؟")) { const updated = (settings.companies || []).filter(c => c.id !== id); setSettings({ ...settings, companies: updated, companyNames: updated.map(c => c.name) }); } };
  
  // Company Bank Management
  const addCompanyBank = () => {
      if (!tempBankName) return;
      const newBank: CompanyBank = { id: generateUUID(), bankName: tempBankName, accountNumber: tempAccountNum };
      setNewCompanyBanks([...newCompanyBanks, newBank]);
      setTempBankName('');
      setTempAccountNum('');
  };
  const removeCompanyBank = (id: string) => {
      setNewCompanyBanks(newCompanyBanks.filter(b => b.id !== id));
  };

  // Operating Banks
  const handleAddOperatingBank = () => { if (newOperatingBank.trim() && !(settings.operatingBankNames || []).includes(newOperatingBank.trim())) { setSettings({ ...settings, operatingBankNames: [...(settings.operatingBankNames || []), newOperatingBank.trim()] }); setNewOperatingBank(''); } };
  const handleRemoveOperatingBank = (name: string) => { setSettings({ ...settings, operatingBankNames: (settings.operatingBankNames || []).filter(b => b !== name) }); };

  const handleAddCommodity = () => { if (newCommodity.trim() && !settings.commodityGroups.includes(newCommodity.trim())) { setSettings({ ...settings, commodityGroups: [...settings.commodityGroups, newCommodity.trim()] }); setNewCommodity(''); } };
  const handleRemoveCommodity = (name: string) => { setSettings({ ...settings, commodityGroups: settings.commodityGroups.filter(c => c !== name) }); };
  
  // INSURANCE COMPANIES
  const handleAddInsuranceCompany = () => { if (newInsuranceCompany.trim() && !(settings.insuranceCompanies || []).includes(newInsuranceCompany.trim())) { setSettings({ ...settings, insuranceCompanies: [...(settings.insuranceCompanies || []), newInsuranceCompany.trim()] }); setNewInsuranceCompany(''); } };
  const handleRemoveInsuranceCompany = (name: string) => { setSettings({ ...settings, insuranceCompanies: (settings.insuranceCompanies || []).filter(c => c !== name) }); };

  const handlePermissionChange = (role: string, field: keyof RolePermissions, value: boolean) => { setSettings({ ...settings, rolePermissions: { ...settings.rolePermissions, [role]: { ...settings.rolePermissions[role], [field]: value } } }); };
  const handleIconChange = async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; setUploadingIcon(true); const reader = new FileReader(); reader.onload = async (ev) => { try { const res = await uploadFile(file.name, ev.target?.result as string); setSettings({ ...settings, pwaIcon: res.url }); } catch (error) { alert('خطا'); } finally { setUploadingIcon(false); } }; reader.readAsDataURL(file); };
  const handleToggleNotifications = async () => { if (!isSecure) { alert("HTTPS لازم است"); return; } if (notificationsEnabled) { setNotificationPreference(false); setNotificationsEnabled(false); } else { const granted = await requestNotificationPermission(); if (granted) { setNotificationPreference(true); setNotificationsEnabled(true); } } };

  const handleDownloadBackup = (includeFiles: boolean) => { 
      window.location.href = `/api/full-backup?includeFiles=${includeFiles}`; 
  };
  
  const handleRestoreClick = () => { if (confirm('بازگردانی اطلاعات کامل (شامل عکس‌ها)؟ همه اطلاعات فعلی پاک می‌شود.')) fileInputRef.current?.click(); };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; setRestoring(true); const reader = new FileReader(); reader.onload = async (ev) => { const base64 = ev.target?.result as string; try { const response = await apiCall<{success: boolean}>('/full-restore', 'POST', { fileData: base64 }); if (response.success) { alert('بازگردانی کامل با موفقیت انجام شد. سیستم رفرش می‌شود.'); window.location.reload(); } } catch (error) { alert('خطا در بازگردانی فایل Zip'); } finally { setRestoring(false); } }; reader.readAsDataURL(file); };

  const roles = [ 
      { id: UserRole.USER, label: 'کاربر عادی' }, 
      { id: UserRole.FINANCIAL, label: 'مدیر مالی' }, 
      { id: UserRole.MANAGER, label: 'مدیر داخلی' }, 
      { id: UserRole.CEO, label: 'مدیر عامل' }, 
      { id: UserRole.SALES_MANAGER, label: 'مدیر فروش' },
      { id: UserRole.FACTORY_MANAGER, label: 'مدیر کارخانه' },
      { id: UserRole.WAREHOUSE_KEEPER, label: 'انباردار' },
      { id: UserRole.ADMIN, label: 'مدیر سیستم' }, 
  ];
  
  const permissionsList = [ 
      { id: 'canCreatePaymentOrder', label: 'ثبت دستور پرداخت جدید' }, 
      { id: 'canViewPaymentOrders', label: 'مشاهده کارتابل پرداخت' },
      { id: 'canViewExitPermits', label: 'مشاهده کارتابل خروج بار' },
      { id: 'canViewAll', label: 'مشاهده تمام دستورات (همه کاربران)' }, 
      { id: 'canEditOwn', label: 'ویرایش دستور خود' }, 
      { id: 'canDeleteOwn', label: 'حذف دستور خود' }, 
      { id: 'canEditAll', label: 'ویرایش تمام دستورات' }, 
      { id: 'canDeleteAll', label: 'حذف تمام دستورات' }, 
      { id: 'canApproveFinancial', label: 'تایید مرحله مالی' }, 
      { id: 'canApproveManager', label: 'تایید مرحله مدیریت' }, 
      { id: 'canApproveCeo', label: 'تایید مرحله نهایی' }, 
      { id: 'canManageTrade', label: 'دسترسی به بخش بازرگانی' }, 
      { id: 'canManageSettings', label: 'دسترسی به تنظیمات سیستم' },
      { id: 'canCreateExitPermit', label: 'ثبت درخواست خروج بار' },
      { id: 'canApproveExitCeo', label: 'تایید خروج بار (مدیرعامل)' },
      { id: 'canApproveExitFactory', label: 'تایید خروج بار (کارخانه)' },
      { id: 'canViewExitArchive', label: 'مشاهده بایگانی خروج بار' },
      { id: 'canEditExitArchive', label: 'اصلاح اسناد بایگانی خروج' },
      { id: 'canManageWarehouse', label: 'مدیریت انبار (ورود/خروج)' },
      { id: 'canViewWarehouseReports', label: 'مشاهده گزارشات انبار' }
  ];

  const getMergedContactOptions = () => {
      return [...(settings.savedContacts || []), ...appUsers as Contact[]];
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col md:flex-row min-h-[600px] mb-20 animate-fade-in">
        
        <div className="w-full md:w-64 bg-gray-50 border-b md:border-b-0 md:border-l border-gray-200 p-4">
            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2 px-2"><SettingsIcon size={24} className="text-blue-600"/> تنظیمات</h2>
            <nav className="space-y-1">
                <button onClick={() => setActiveCategory('system')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeCategory === 'system' ? 'bg-white shadow text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-100'}`}><AppWindow size={18}/> عمومی و سیستم</button>
                <button onClick={() => setActiveCategory('data')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeCategory === 'data' ? 'bg-white shadow text-indigo-700 font-bold' : 'text-gray-600 hover:bg-gray-100'}`}><Database size={18}/> اطلاعات پایه</button>
                <button onClick={() => setActiveCategory('commerce')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeCategory === 'commerce' ? 'bg-white shadow text-rose-700 font-bold' : 'text-gray-600 hover:bg-gray-100'}`}><Container size={18}/> تنظیمات بازرگانی</button>
                <button onClick={() => setActiveCategory('warehouse')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeCategory === 'warehouse' ? 'bg-white shadow text-orange-700 font-bold' : 'text-gray-600 hover:bg-gray-100'}`}><Warehouse size={18}/> انبار</button>
                <button onClick={() => setActiveCategory('integrations')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeCategory === 'integrations' ? 'bg-white shadow text-purple-700 font-bold' : 'text-gray-600 hover:bg-gray-100'}`}><Link size={18}/> اتصالات (API)</button>
                <button onClick={() => setActiveCategory('whatsapp')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeCategory === 'whatsapp' ? 'bg-white shadow text-green-700 font-bold' : 'text-gray-600 hover:bg-gray-100'}`}><MessageCircle size={18}/> مدیریت واتساپ</button>
                <button onClick={() => setActiveCategory('permissions')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeCategory === 'permissions' ? 'bg-white shadow text-amber-700 font-bold' : 'text-gray-600 hover:bg-gray-100'}`}><ShieldCheck size={18}/> دسترسی‌ها</button>
            </nav>
        </div>

        <div className="flex-1 p-6 md:p-8 overflow-y-auto max-h-[calc(100vh-100px)]">
            <form onSubmit={handleSave} className="space-y-8 max-w-4xl mx-auto">
                
                {/* 1. SYSTEM SETTINGS */}
                {activeCategory === 'system' && (
                    <div className="space-y-8 animate-fade-in">
                        <div className="space-y-4">
                            <h3 className="font-bold text-gray-800 border-b pb-2">تنظیمات ظاهری و اعلان‌ها</h3>
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 rounded-xl border border-gray-200 overflow-hidden flex items-center justify-center bg-gray-50">{settings.pwaIcon ? <img src={settings.pwaIcon} className="w-full h-full object-cover" /> : <ImageIcon className="text-gray-300" />}</div>
                                <div>
                                    <input type="file" ref={iconInputRef} className="hidden" accept="image/*" onChange={handleIconChange} />
                                    <button type="button" onClick={() => iconInputRef.current?.click()} className="text-blue-600 text-sm hover:underline font-bold" disabled={uploadingIcon}>{uploadingIcon ? '...' : 'تغییر آیکون برنامه'}</button>
                                </div>
                            </div>
                            <button type="button" onClick={handleToggleNotifications} className={`w-full md:w-auto px-4 py-2 rounded-lg border flex items-center justify-center gap-2 transition-colors ${notificationsEnabled ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 text-gray-600'}`}>{notificationsEnabled ? <BellRing size={18} /> : <BellOff size={18} />}<span>{notificationsEnabled ? 'نوتیفیکیشن‌ها فعال است' : 'فعال‌سازی نوتیفیکیشن'}</span></button>
                        </div>
                        <div className="space-y-4">
                            <h3 className="font-bold text-gray-800 border-b pb-2 flex items-center gap-2"><Truck size={20}/> شماره‌گذاری اسناد</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div><label className="text-sm font-bold text-gray-700 block mb-1">شروع شماره دستور پرداخت</label><input type="number" className="w-full border rounded-lg p-2 dir-ltr text-left" value={settings.currentTrackingNumber} onChange={(e) => setSettings({...settings, currentTrackingNumber: Number(e.target.value)})} /></div>
                                <div><label className="text-sm font-bold text-gray-700 block mb-1">شروع شماره مجوز خروج</label><input type="number" className="w-full border rounded-lg p-2 dir-ltr text-left" value={settings.currentExitPermitNumber} onChange={(e) => setSettings({...settings, currentExitPermitNumber: Number(e.target.value)})} /></div>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <h3 className="font-bold text-gray-800 border-b pb-2">مدیریت داده‌ها و بک‌آپ</h3>
                            <div className="flex flex-wrap gap-4 items-center">
                                <div className="flex flex-col gap-2 w-full md:w-auto">
                                    <button type="button" onClick={() => handleDownloadBackup(true)} className="bg-indigo-600 text-white px-6 py-3 rounded-xl hover:bg-indigo-700 flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 transition-transform hover:scale-105"><DownloadCloud size={20} /> دانلود بک‌آپ کامل (با فایل‌ها)</button>
                                    <button type="button" onClick={() => handleDownloadBackup(false)} className="bg-blue-500 text-white px-6 py-3 rounded-xl hover:bg-blue-600 flex items-center justify-center gap-2 shadow-lg shadow-blue-200 transition-transform hover:scale-105"><FileDigit size={20} /> دانلود بک‌آپ سبک (فقط دیتابیس)</button>
                                </div>
                                <button type="button" onClick={handleRestoreClick} disabled={restoring} className="bg-gray-800 text-white px-6 py-3 rounded-xl hover:bg-gray-900 flex items-center gap-2 shadow-lg shadow-gray-300 transition-transform hover:scale-105 disabled:opacity-70 h-[52px]">{restoring ? <Loader2 size={20} className="animate-spin"/> : <UploadCloud size={20} />} بازگردانی فایل Zip</button>
                                <input type="file" ref={fileInputRef} className="hidden" accept=".zip" onChange={handleFileChange} />
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. COMMERCE SETTINGS (NEW) */}
                {activeCategory === 'commerce' && (
                    <div className="space-y-8 animate-fade-in">
                        <div className="space-y-2">
                            <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2"><ShieldCheck size={18}/> شرکت‌های بیمه</h3>
                            <p className="text-xs text-gray-500 mb-2">لیست شرکت‌های بیمه جهت انتخاب در پرونده‌های بازرگانی</p>
                            <div className="flex gap-2"><input className="flex-1 border rounded-lg p-2 text-sm" placeholder="نام شرکت بیمه..." value={newInsuranceCompany} onChange={(e) => setNewInsuranceCompany(e.target.value)} /><button type="button" onClick={handleAddInsuranceCompany} className="bg-rose-600 text-white p-2 rounded-lg"><Plus size={18} /></button></div>
                            <div className="flex flex-wrap gap-2">{(settings.insuranceCompanies || []).map((comp, idx) => (<div key={idx} className="bg-rose-50 text-rose-700 px-2 py-1 rounded text-xs flex items-center gap-1 border border-rose-100"><span>{comp}</span><button type="button" onClick={() => handleRemoveInsuranceCompany(comp)} className="hover:text-red-500"><X size={12} /></button></div>))}</div>
                        </div>
                    </div>
                )}

                {/* 3. WAREHOUSE SETTINGS */}
                {activeCategory === 'warehouse' && (
                    <div className="space-y-8 animate-fade-in">
                        <div className="space-y-4">
                            <h3 className="font-bold text-gray-800 border-b pb-2 flex items-center gap-2"><Warehouse size={20}/> تنظیمات انبار و ارسال خودکار</h3>
                            <div className="space-y-6">
                                {settings.companies?.filter(c => c.showInWarehouse !== false).map(company => (
                                    <div key={company.id} className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                        <h4 className="font-bold text-base text-gray-800 mb-3 border-b pb-2 flex justify-between"><span>شرکت: {company.name}</span>{company.logo && <img src={company.logo} className="h-6 object-contain"/>}</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div><label className="text-xs font-bold text-blue-700 block mb-1">مدیر فروش (جهت ارسال با قیمت)</label><select className="w-full border rounded-lg p-2 text-sm bg-white" value={settings.companyNotifications?.[company.name]?.salesManager || ''} onChange={e => setSettings({...settings, companyNotifications: {...settings.companyNotifications, [company.name]: { ...settings.companyNotifications?.[company.name], salesManager: e.target.value }}})}><option value="">-- ارسال نشود --</option>{getMergedContactOptions().map(c => (<option key={`${company.id}_sm_${c.number}`} value={c.number}>{c.name} {c.isGroup ? '(گروه)' : ''}</option>))}</select></div>
                                            <div><label className="text-xs font-bold text-orange-700 block mb-1">گروه انبار (جهت ارسال بدون قیمت)</label><select className="w-full border rounded-lg p-2 text-sm bg-white" value={settings.companyNotifications?.[company.name]?.warehouseGroup || ''} onChange={e => setSettings({...settings, companyNotifications: {...settings.companyNotifications, [company.name]: { ...settings.companyNotifications?.[company.name], warehouseGroup: e.target.value }}})}><option value="">-- ارسال نشود --</option>{getMergedContactOptions().map(c => (<option key={`${company.id}_wg_${c.number}`} value={c.number}>{c.name} {c.isGroup ? '(گروه)' : ''}</option>))}</select></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* 4. BASIC DATA */}
                {activeCategory === 'data' && (
                    <div className="space-y-8 animate-fade-in">
                        <div className="space-y-4">
                            <h3 className="font-bold text-gray-800 border-b pb-2 flex items-center gap-2"><Building size={20}/> مدیریت شرکت‌ها و بانک‌ها</h3>
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                
                                {/* Company Inputs */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <div><label className="text-xs font-bold block mb-1 text-gray-500">نام شرکت</label><input type="text" className="w-full border rounded-lg p-2 text-sm" placeholder="نام شرکت..." value={newCompanyName} onChange={(e) => setNewCompanyName(e.target.value)} /></div>
                                    <div className="flex items-end gap-2">
                                        <div className="w-10 h-10 border rounded bg-white flex items-center justify-center overflow-hidden cursor-pointer" onClick={() => companyLogoInputRef.current?.click()} title="لوگو">{newCompanyLogo ? <img src={newCompanyLogo} className="w-full h-full object-cover"/> : <ImageIcon size={16} className="text-gray-300"/>}</div>
                                        <div className={`flex items-center gap-2 bg-white px-2 py-2 rounded border cursor-pointer flex-1 h-[42px] ${newCompanyShowInWarehouse ? 'border-green-200 bg-green-50 text-green-700' : ''}`} onClick={() => setNewCompanyShowInWarehouse(!newCompanyShowInWarehouse)}><input type="checkbox" checked={newCompanyShowInWarehouse} onChange={e => setNewCompanyShowInWarehouse(e.target.checked)} className="w-4 h-4"/><span className="text-xs font-bold select-none">نمایش در انبار</span></div>
                                        <input type="file" ref={companyLogoInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload}/>
                                    </div>
                                </div>

                                {/* Letterhead Upload */}
                                <div className="mb-4">
                                    <label className="text-xs font-bold block mb-1 text-gray-500 flex items-center gap-1">
                                        <FileText size={14}/> تصویر کامل سربرگ A4 (زمینه نامه)
                                    </label>
                                    <p className="text-[10px] text-gray-400 mb-2">
                                        لطفا تصویر کامل یک صفحه A4 (شامل هدر، فوتر، حاشیه‌ها و پس‌زمینه) را آپلود کنید. این تصویر به عنوان زمینه کل صفحه در چاپ‌ها استفاده می‌شود.
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <input type="file" ref={companyLetterheadInputRef} className="hidden" accept="image/*" onChange={handleLetterheadUpload} />
                                        <button type="button" onClick={() => companyLetterheadInputRef.current?.click()} className="bg-white border text-gray-600 px-3 py-2 rounded-lg text-xs font-bold hover:bg-gray-100 flex items-center gap-2" disabled={isUploadingLetterhead}>
                                            {isUploadingLetterhead ? <Loader2 size={14} className="animate-spin"/> : <UploadCloud size={14}/>}
                                            {newCompanyLetterhead ? 'تغییر فایل سربرگ' : 'آپلود تصویر کامل A4 (JPG/PNG)'}
                                        </button>
                                        {newCompanyLetterhead && <span className="text-xs text-green-600 font-bold flex items-center gap-1"><Check size={14}/> آپلود شد</span>}
                                    </div>
                                    {newCompanyLetterhead && (
                                        <div className="mt-4 w-40 aspect-[210/297] bg-white border border-gray-300 shadow-md mx-auto relative group overflow-hidden rounded-sm">
                                            <img src={newCompanyLetterhead} className="w-full h-full object-cover"/>
                                            <div className="absolute inset-0 bg-black/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <span className="bg-white/90 text-gray-800 text-[10px] px-2 py-1 rounded shadow">پیش‌نمایش A4</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Bank Management for this Company */}
                                <div className="bg-white border rounded-xl p-3 mb-4">
                                    <label className="text-xs font-bold block mb-2 text-blue-600 flex items-center gap-1"><Landmark size={14}/> تعریف بانک‌های این شرکت</label>
                                    <div className="flex gap-2 mb-2 items-end">
                                        <input className="flex-1 border rounded p-1.5 text-sm" placeholder="نام بانک" value={tempBankName} onChange={e => setTempBankName(e.target.value)} />
                                        <input className="flex-1 border rounded p-1.5 text-sm dir-ltr text-left" placeholder="شماره حساب/کارت" value={tempAccountNum} onChange={e => setTempAccountNum(e.target.value)} />
                                        <button type="button" onClick={addCompanyBank} className="bg-blue-50 text-blue-600 p-1.5 rounded border border-blue-100 hover:bg-blue-100"><Plus size={18}/></button>
                                    </div>
                                    <div className="space-y-1">
                                        {newCompanyBanks.map((bank, idx) => (
                                            <div key={bank.id || idx} className="flex justify-between items-center bg-gray-50 px-2 py-1 rounded text-xs border">
                                                <span>{bank.bankName} - <span className="font-mono">{bank.accountNumber}</span></span>
                                                <button type="button" onClick={() => removeCompanyBank(bank.id)} className="text-red-400 hover:text-red-600"><X size={14}/></button>
                                            </div>
                                        ))}
                                        {newCompanyBanks.length === 0 && <div className="text-xs text-gray-400 text-center py-2">هنوز بانکی تعریف نشده است</div>}
                                    </div>
                                </div>

                                <button type="button" onClick={handleSaveCompany} className={`w-full text-white px-4 py-2 rounded-lg text-sm h-10 font-bold shadow-sm ${editingCompanyId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>{editingCompanyId ? 'ذخیره تغییرات شرکت' : 'افزودن شرکت'}</button>
                                
                                {editingCompanyId && <button type="button" onClick={resetCompanyForm} className="w-full mt-2 text-gray-600 bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-lg text-sm font-bold">انصراف</button>}

                                <div className="space-y-2 mt-6 max-h-64 overflow-y-auto border-t pt-4">
                                    <h4 className="text-xs font-bold text-gray-500 mb-2">لیست شرکت‌های تعریف شده:</h4>
                                    {settings.companies?.map(c => (
                                        <div key={c.id} className="flex flex-col bg-white p-3 rounded border shadow-sm gap-2">
                                            <div className="flex justify-between items-center">
                                                <div className="flex items-center gap-2">
                                                    {c.logo && <img src={c.logo} className="w-6 h-6 object-contain"/>}
                                                    <span className="text-sm font-bold">{c.name}</span>
                                                    {c.showInWarehouse === false && <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded font-bold border border-red-200">مخفی در انبار</span>}
                                                </div>
                                                <div className="flex gap-1">
                                                    <button type="button" onClick={() => handleEditCompany(c)} className="text-blue-500 p-1 hover:bg-blue-50 rounded"><Pencil size={14}/></button>
                                                    <button type="button" onClick={() => handleRemoveCompany(c.id)} className="text-red-500 p-1 hover:bg-red-50 rounded"><Trash2 size={14}/></button>
                                                </div>
                                            </div>
                                            {(c.banks && c.banks.length > 0) && (
                                                <div className="text-[10px] text-gray-500 flex flex-wrap gap-1">
                                                    <span className="font-bold">بانک‌ها:</span> 
                                                    {c.banks.map(b => <span key={b.id} className="bg-gray-100 px-1 rounded">{b.bankName}</span>)}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2"><Briefcase size={18}/> بانک‌های عامل (بازرگانی)</h3>
                                <div className="flex gap-2"><input className="flex-1 border rounded-lg p-2 text-sm" placeholder="نام بانک عامل..." value={newOperatingBank} onChange={(e) => setNewOperatingBank(e.target.value)} /><button type="button" onClick={handleAddOperatingBank} className="bg-blue-600 text-white p-2 rounded-lg"><Plus size={18} /></button></div>
                                <div className="flex flex-wrap gap-2">{(settings.operatingBankNames || []).map((bank, idx) => (<div key={idx} className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs flex items-center gap-1 border border-blue-100"><span>{bank}</span><button type="button" onClick={() => handleRemoveOperatingBank(bank)} className="hover:text-red-500"><X size={12} /></button></div>))}</div>
                            </div>
                            <div className="space-y-2">
                                <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2"><Package size={18}/> گروه‌های کالایی</h3>
                                <div className="flex gap-2"><input className="flex-1 border rounded-lg p-2 text-sm" placeholder="نام گروه..." value={newCommodity} onChange={(e) => setNewCommodity(e.target.value)} /><button type="button" onClick={handleAddCommodity} className="bg-amber-600 text-white p-2 rounded-lg"><Plus size={18} /></button></div>
                                <div className="flex flex-wrap gap-2">{settings.commodityGroups.map((group, idx) => (<div key={idx} className="bg-amber-50 text-amber-700 px-2 py-1 rounded text-xs flex items-center gap-1 border border-amber-100"><span>{group}</span><button type="button" onClick={() => handleRemoveCommodity(group)} className="hover:text-red-500"><X size={12} /></button></div>))}</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 5. INTEGRATIONS */}
                {activeCategory === 'integrations' && (
                    <div className="space-y-8 animate-fade-in">
                        <div className="space-y-4">
                            <h3 className="font-bold text-gray-800 border-b pb-2 flex items-center gap-2"><BrainCircuit size={20} className="text-purple-600"/> هوش مصنوعی (Gemini)</h3>
                            <div><label className="text-sm text-gray-600 block mb-1">کلید دسترسی (API Key)</label><input type="password" className="w-full border rounded-lg p-2 dir-ltr text-left" value={settings.geminiApiKey || ''} onChange={(e) => setSettings({...settings, geminiApiKey: e.target.value})} /></div>
                        </div>
                        <div className="space-y-4">
                            <h3 className="font-bold text-gray-800 border-b pb-2 flex items-center gap-2"><Send size={20} className="text-blue-500"/> ربات تلگرام</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div><label className="text-sm text-gray-600 block mb-1">توکن ربات (Bot Token)</label><input type="text" className="w-full border rounded-lg p-2 dir-ltr text-left" value={settings.telegramBotToken || ''} onChange={(e) => setSettings({...settings, telegramBotToken: e.target.value})} /></div>
                                <div><label className="text-sm text-gray-600 block mb-1">آیدی عددی مدیر (Admin ID)</label><input type="text" className="w-full border rounded-lg p-2 dir-ltr text-left" value={settings.telegramAdminId || ''} onChange={(e) => setSettings({...settings, telegramAdminId: e.target.value})} /></div>
                            </div>
                        </div>
                    </div>
                )}
                
                {/* 6. WHATSAPP */}
                {activeCategory === 'whatsapp' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className={`bg-${whatsappStatus?.ready ? 'green' : 'amber'}-50 border border-${whatsappStatus?.ready ? 'green' : 'amber'}-200 rounded-xl p-6 flex flex-col md:flex-row items-center gap-6`}>
                            {refreshingWA ? (
                                <div className="flex flex-col items-center gap-2 text-gray-500">
                                    <Loader2 size={32} className="animate-spin"/>
                                    <span className="text-sm">در حال بررسی وضعیت...</span>
                                </div>
                            ) : whatsappStatus?.ready ? (
                                <>
                                    <div className="bg-green-100 p-4 rounded-full text-green-600"><Check size={32}/></div>
                                    <div className="flex-1 text-center md:text-right">
                                        <h3 className="font-bold text-lg text-green-800 mb-1">واتساپ متصل است</h3>
                                        <p className="text-sm text-green-700">شماره متصل: {whatsappStatus.user ? `+${whatsappStatus.user}` : 'ناشناس'}</p>
                                    </div>
                                    <button type="button" onClick={handleWhatsappLogout} className="bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-100 transition-colors">خروج از حساب</button>
                                </>
                            ) : (
                                <>
                                    <div className="bg-white p-2 rounded-lg border shadow-sm">
                                        {whatsappStatus?.qr ? <QRCode value={whatsappStatus.qr} size={160} /> : <div className="w-40 h-40 flex items-center justify-center text-gray-400 text-xs">در حال دریافت QR...</div>}
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-bold text-lg text-amber-800 mb-2">اتصال به واتساپ</h3>
                                        <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1">
                                            <li>واتساپ را در گوشی خود باز کنید</li>
                                            <li>به تنظیمات و سپس Linked Devices بروید</li>
                                            <li>دکمه Link a Device را بزنید</li>
                                            <li>کد QR روبرو را اسکن کنید</li>
                                        </ol>
                                        <button type="button" onClick={checkWhatsappStatus} className="mt-4 text-blue-600 text-xs font-bold hover:underline">بروزرسانی وضعیت</button>
                                    </div>
                                </>
                            )}
                        </div>
                        
                        <div className="space-y-4">
                            <h3 className="font-bold text-gray-800 border-b pb-2 flex justify-between items-center">
                                <span>دفترچه تلفن و گروه‌ها</span>
                                <button type="button" onClick={handleFetchGroups} disabled={fetchingGroups || !whatsappStatus?.ready} className="text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded hover:bg-blue-100 disabled:opacity-50">{fetchingGroups ? '...' : 'بروزرسانی لیست گروه‌ها'}</button>
                            </h3>
                            
                            <div className="flex gap-2 mb-2">
                                <input className="flex-1 border rounded-lg p-2 text-sm" placeholder="نام مخاطب" value={contactName} onChange={e => setContactName(e.target.value)} />
                                <input className="flex-1 border rounded-lg p-2 text-sm dir-ltr" placeholder="شماره (98912...)" value={contactNumber} onChange={e => setContactNumber(e.target.value)} />
                                <button type="button" onClick={() => setIsGroupContact(!isGroupContact)} className={`px-3 rounded-lg border ${isGroupContact ? 'bg-orange-50 border-orange-200 text-orange-600' : 'bg-white text-gray-500'}`}>{isGroupContact ? 'گروه' : 'شخص'}</button>
                                <button type="button" onClick={handleAddContact} className="bg-green-600 text-white px-4 rounded-lg"><Plus size={20}/></button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-60 overflow-y-auto">
                                {settings.savedContacts?.map(contact => (
                                    <div key={contact.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-200 group hover:border-blue-300 transition-colors">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className={`p-2 rounded-full shrink-0 ${contact.isGroup ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                                                {contact.isGroup ? <Users size={16}/> : <Smartphone size={16}/>}
                                            </div>
                                            <div className="truncate">
                                                <div className="font-bold text-sm text-gray-800 truncate" title={contact.name}>{contact.name}</div>
                                                <div className="text-xs text-gray-500 font-mono">{contact.number}</div>
                                            </div>
                                        </div>
                                        <button onClick={() => handleDeleteContact(contact.id)} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity p-1"><Trash2 size={16}/></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* 7. PERMISSIONS */}
                {activeCategory === 'permissions' && (
                    <div className="space-y-8 animate-fade-in">
                        <h3 className="font-bold text-gray-800 border-b pb-2 flex items-center gap-2"><ShieldCheck size={20}/> مدیریت دسترسی نقش‌ها</h3>
                        <div className="space-y-6">
                            {roles.map(role => (
                                <div key={role.id} className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                    <h4 className="font-bold text-sm text-gray-800 mb-3 border-b pb-2">{role.label}</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {permissionsList.map(perm => (
                                            <label key={`${role.id}-${perm.id}`} className="flex items-center gap-2 cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    className="w-4 h-4 text-blue-600 rounded"
                                                    checked={settings.rolePermissions?.[role.id]?.[perm.id as keyof RolePermissions] ?? false}
                                                    onChange={(e) => handlePermissionChange(role.id, perm.id as keyof RolePermissions, e.target.checked)}
                                                />
                                                <span className="text-xs text-gray-700">{perm.label}</span>
                                            </label>
                                        ))}
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