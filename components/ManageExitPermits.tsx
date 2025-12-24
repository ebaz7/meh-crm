
import React, { useState, useEffect } from 'react';
import { ExitPermit, ExitPermitStatus, User, UserRole, SystemSettings } from '../types';
import { getExitPermits, updateExitPermitStatus, deleteExitPermit } from '../services/storageService';
import { getRolePermissions, getUsers } from '../services/authService'; 
import { formatDate } from '../constants';
import { Eye, Trash2, Search, CheckCircle, Truck, XCircle, Edit, Clock, Loader2, PackageCheck, RefreshCw, ArchiveRestore } from 'lucide-react';
import PrintExitPermit from './PrintExitPermit';
import EditExitPermitModal from './EditExitPermitModal';
import { apiCall } from '../services/apiService'; 

interface Props {
  currentUser: User;
  settings?: SystemSettings;
  statusFilter?: 'pending' | null;
}

const ManageExitPermits: React.FC<Props> = ({ currentUser, settings, statusFilter }) => {
  const [permits, setPermits] = useState<ExitPermit[]>([]);
  const [viewPermit, setViewPermit] = useState<ExitPermit | null>(null);
  const [editingPermit, setEditingPermit] = useState<ExitPermit | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'current' | 'archive'>('current');
  const [activeStatusFilter, setActiveStatusFilter] = useState<'pending' | null>(statusFilter || null);
  
  const [showExitTimeInput, setShowExitTimeInput] = useState<string | null>(null); 
  const [exitTimeValue, setExitTimeValue] = useState('');
  const [isProcessingId, setIsProcessingId] = useState<string | null>(null);

  const [permitForAutoSend, setPermitForAutoSend] = useState<ExitPermit | null>(null);
  
  // Calculate permissions with fallbacks to ensure buttons show even if settings lag
  const permissions = getRolePermissions(currentUser.role, settings || null);

  useEffect(() => { loadData(); }, []);
  useEffect(() => { if (statusFilter) setActiveStatusFilter(statusFilter); }, [statusFilter]);

  const loadData = async () => { setPermits(await getExitPermits()); };

  const canApprove = (p: ExitPermit) => {
      if (activeTab === 'archive' && !permissions.canEditExitArchive) return false;
      
      // Stage 1: CEO Approval (After Sales Manager Request)
      if (p.status === ExitPermitStatus.PENDING_CEO && (
          currentUser.role === UserRole.CEO || 
          currentUser.role === UserRole.ADMIN ||
          permissions.canApproveExitCeo
      )) return true;
      
      // Stage 2: Factory Manager Approval
      if (p.status === ExitPermitStatus.PENDING_FACTORY && (
          currentUser.role === UserRole.FACTORY_MANAGER || 
          currentUser.role === UserRole.ADMIN ||
          permissions.canApproveExitFactory
      )) return true;
      
      // Stage 3: Warehouse Supervisor Approval
      if (p.status === ExitPermitStatus.PENDING_WAREHOUSE) {
          if (currentUser.role === UserRole.WAREHOUSE_KEEPER) return true;
          if (currentUser.role === UserRole.ADMIN) return true;
          if (currentUser.role === UserRole.CEO) return true;
          if (permissions.canApproveExitWarehouse) return true;
          if (permissions.canManageWarehouse) return true;
          return false;
      }
      
      // Stage 4: Security Approval (Final Exit)
      if (p.status === ExitPermitStatus.PENDING_SECURITY && (
          currentUser.role === UserRole.SECURITY_GUARD || 
          currentUser.role === UserRole.SECURITY_HEAD || 
          currentUser.role === UserRole.ADMIN ||
          permissions.canViewSecurity ||
          permissions.canApproveExitSecurity // NEW PERMISSION CHECK
      )) return true;
      
      return false;
  };

  const canEdit = (p: ExitPermit) => {
      if (currentUser.role === UserRole.ADMIN) return true;
      if (p.status === ExitPermitStatus.EXITED) return false;
      if (permissions.canEditAll) return true;
      if (permissions.canEditOwn && p.requester === currentUser.fullName) return true;
      return false;
  };

  const generateFullCaption = (permit: ExitPermit, header: string) => {
      let c = `${header}\n`;
      c += `🔢 شماره مجوز: ${permit.permitNumber}\n`;
      c += `📅 تاریخ: ${formatDate(permit.date)}\n`;
      c += `📦 کالا: ${permit.goodsName}\n`;
      c += `🔢 تعداد: ${permit.cartonCount || 0} کارتن\n`;
      c += `⚖️ وزن: ${permit.weight || 0} کیلوگرم\n`;
      c += `👤 گیرنده: ${permit.recipientName}\n`;
      c += `🚛 راننده: ${permit.driverName || '-'}\n`;
      c += `🔢 پلاک: ${permit.plateNumber || '-'}\n`;
      
      const addr = permit.destinations && permit.destinations.length > 0 ? permit.destinations[0].address : permit.destinationAddress;
      if (addr) c += `📍 مقصد: ${addr}\n`;
      
      if (permit.exitTime) c += `🕒 ساعت خروج: ${permit.exitTime}\n`;
      
      return c;
  };

  // --- APPROVAL FLOW HANDLER ---
  const handleApproveAction = async (id: string, currentStatus: ExitPermitStatus) => {
      let nextStatus = currentStatus;
      let extra: any = {};

      // 1. PENDING_CEO -> PENDING_FACTORY (CEO Approves)
      if (currentStatus === ExitPermitStatus.PENDING_CEO) nextStatus = ExitPermitStatus.PENDING_FACTORY;
      
      // 2. PENDING_FACTORY -> PENDING_WAREHOUSE (Factory Manager Approves)
      else if (currentStatus === ExitPermitStatus.PENDING_FACTORY) nextStatus = ExitPermitStatus.PENDING_WAREHOUSE; 
      
      // 3. PENDING_WAREHOUSE -> PENDING_SECURITY (Warehouse Supervisor Approves)
      else if (currentStatus === ExitPermitStatus.PENDING_WAREHOUSE) nextStatus = ExitPermitStatus.PENDING_SECURITY; 
      
      // 4. PENDING_SECURITY -> EXITED (Security Approves & Enters Exit Time)
      else if (currentStatus === ExitPermitStatus.PENDING_SECURITY) {
          if (!exitTimeValue) { alert("لطفا ابتدا ساعت خروج را وارد کنید."); return; }
          nextStatus = ExitPermitStatus.EXITED;
          extra.exitTime = exitTimeValue;
      }
      
      const permitToApprove = permits.find(p => p.id === id);
      if (!permitToApprove) return;

      if(window.confirm('آیا تایید می‌کنید؟')) {
          setIsProcessingId(id); // LOCK UI
          try {
              // 1. Update Database
              await updateExitPermitStatus(id, nextStatus, currentUser, extra);
              
              // 2. Prepare Mock Object for Rendering
              const updatedPermitMock = { ...permitToApprove, status: nextStatus, ...extra };
              
              // Simulate Signatures for the generated image
              if (nextStatus === ExitPermitStatus.PENDING_FACTORY) updatedPermitMock.approverCeo = currentUser.fullName;
              
              if (nextStatus === ExitPermitStatus.PENDING_WAREHOUSE) {
                   updatedPermitMock.approverCeo = permitToApprove.approverCeo || 'تایید شده';
                   updatedPermitMock.approverFactory = currentUser.fullName;
              }
              
              if (nextStatus === ExitPermitStatus.PENDING_SECURITY) {
                  updatedPermitMock.approverCeo = permitToApprove.approverCeo || 'تایید شده';
                  updatedPermitMock.approverFactory = permitToApprove.approverFactory || 'تایید شده';
                  updatedPermitMock.approverWarehouse = currentUser.fullName; // Stamp Warehouse
              }
              
              if (nextStatus === ExitPermitStatus.EXITED) {
                  updatedPermitMock.approverCeo = permitToApprove.approverCeo || 'تایید شده';
                  updatedPermitMock.approverFactory = permitToApprove.approverFactory || 'تایید شده';
                  updatedPermitMock.approverWarehouse = permitToApprove.approverWarehouse || 'تایید شده';
                  updatedPermitMock.approverSecurity = currentUser.fullName; 
              }

              // 3. Trigger Render
              setPermitForAutoSend(updatedPermitMock);

              // 4. Wait for Render (Async Delay) to ensure DOM is ready
              await new Promise(resolve => setTimeout(resolve, 2000));

              // 5. Capture and Send
              const element = document.getElementById(`print-permit-${updatedPermitMock.id}`);
              if (element) {
                  try {
                      // @ts-ignore
                      const canvas = await window.html2canvas(element, { scale: 2, backgroundColor: '#ffffff' });
                      const base64 = canvas.toDataURL('image/png').split(',')[1];
                      const users = await getUsers();

                      // --- LOGIC PER STATUS ---
                      
                      // CASE A: CEO Approved -> Goes to Factory Manager
                      if (nextStatus === ExitPermitStatus.PENDING_FACTORY) {
                          const caption = generateFullCaption(updatedPermitMock, "✍️ *مجوز خروج توسط مدیرعامل تایید شد*");
                          const target = users.find(u => u.role === UserRole.FACTORY_MANAGER && u.phoneNumber);
                          if (target) {
                              try { await apiCall('/send-whatsapp', 'POST', { number: target.phoneNumber!, message: caption, mediaData: { data: base64, mimeType: 'image/png' } }); } catch (err) {}
                          }
                      } 
                      // CASE B: Factory Approved -> Goes to Warehouse Supervisor
                      else if (nextStatus === ExitPermitStatus.PENDING_WAREHOUSE) {
                          const caption = generateFullCaption(updatedPermitMock, "🏭 *تایید مدیر کارخانه انجام شد* (ارسال به سرپرست انبار)");
                          const warehouseUsers = users.filter(u => u.role === UserRole.WAREHOUSE_KEEPER && u.phoneNumber);
                          for (const whUser of warehouseUsers) {
                            try { await apiCall('/send-whatsapp', 'POST', { number: whUser.phoneNumber!, message: caption, mediaData: { data: base64, mimeType: 'image/png' } }); } catch (err) {}
                          }
                      }
                      // CASE C: Warehouse Approved -> Goes to Security
                      else if (nextStatus === ExitPermitStatus.PENDING_SECURITY) {
                          const caption = generateFullCaption(updatedPermitMock, "📦 *تایید سرپرست انبار انجام شد* (ارسال به انتظامات)");
                          const securityUsers = users.filter(u => (u.role === UserRole.SECURITY_GUARD || u.role === UserRole.SECURITY_HEAD) && u.phoneNumber);
                          for (const sec of securityUsers) {
                            try { await apiCall('/send-whatsapp', 'POST', { number: sec.phoneNumber!, message: caption, mediaData: { data: base64, mimeType: 'image/png' } }); } catch (err) {}
                          }
                      }
                      // CASE D: Security Approved (Final Exit) -> Archive
                      else if (nextStatus === ExitPermitStatus.EXITED) {
                          const caption = generateFullCaption(updatedPermitMock, "✅ *خروج نهایی بار از کارخانه ثبت شد*");
                          
                          // Send to Requester
                          const target = users.find(u => u.fullName === updatedPermitMock.requester && u.phoneNumber);
                          if (target) { try { await apiCall('/send-whatsapp', 'POST', { number: target.phoneNumber!, message: caption, mediaData: { data: base64, mimeType: 'image/png' } }); } catch(e) {} }
                          
                          // Send to Group
                          if (settings?.exitPermitNotificationGroup) {
                              try { await apiCall('/send-whatsapp', 'POST', { number: settings.exitPermitNotificationGroup, message: caption, mediaData: { data: base64, mimeType: 'image/png' } }); } catch(e) {}
                          }
                      }
                  } catch (e) { console.error("Error in auto-send logic", e); }
              }
              
              // 6. Cleanup
              setPermitForAutoSend(null);
              setExitTimeValue('');
              setShowExitTimeInput(null);
              loadData();
              setViewPermit(null);

          } catch (e) {
              alert("خطا در عملیات");
          } finally {
              setIsProcessingId(null); // UNLOCK UI ONLY AFTER EVERYTHING IS DONE
          }
      }
  };

  // --- FORCE ARCHIVE (For Legacy Permits) ---
  const handleForceArchive = async (id: string) => {
      if (!confirm('⚠️ آیا اطمینان دارید؟ این عملیات مجوز را مستقیماً به بایگانی می‌برد (مناسب برای مجوزهای قدیمی).')) return;
      
      const time = prompt('لطفا ساعت خروج را وارد کنید:', new Date().toLocaleTimeString('fa-IR', {hour:'2-digit', minute:'2-digit'}));
      if (!time) return;

      try {
          // Force status update to EXITED
          await updateExitPermitStatus(id, ExitPermitStatus.EXITED, currentUser, { exitTime: time });
          loadData();
          alert('مجوز با موفقیت بایگانی شد.');
      } catch (e) {
          alert('خطا در بایگانی دستی');
      }
  };

  const handleReject = async (id: string) => {
      const reason = prompt('دلیل رد درخواست:');
      if (reason) {
          await updateExitPermitStatus(id, ExitPermitStatus.REJECTED, currentUser, { rejectionReason: reason });
          loadData();
          setViewPermit(null);
      }
  };

  const getStatusBadge = (status: ExitPermitStatus) => {
      switch(status) {
          case ExitPermitStatus.PENDING_CEO: return <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-[10px] font-bold">انتظار مدیرعامل</span>;
          case ExitPermitStatus.PENDING_FACTORY: return <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-[10px] font-bold">انتظار مدیر کارخانه</span>;
          case ExitPermitStatus.PENDING_WAREHOUSE: return <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-[10px] font-bold">انتظار سرپرست انبار</span>;
          case ExitPermitStatus.PENDING_SECURITY: return <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded text-[10px] font-bold">انتظار انتظامات</span>;
          case ExitPermitStatus.EXITED: return <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-[10px] font-bold">خارج شده</span>;
          case ExitPermitStatus.REJECTED: return <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-[10px] font-bold">رد شده</span>;
      }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in relative">
        
        {/* --- GLOBAL BLOCKING LOADER FOR APPROVALS --- */}
        {isProcessingId && (
            <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center backdrop-blur-sm cursor-wait">
                <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-6 animate-scale-in max-w-sm text-center border-4 border-orange-100">
                    <div className="relative w-24 h-24">
                        <div className="absolute inset-0 border-4 border-gray-100 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-t-orange-600 border-r-orange-600 rounded-full animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Truck size={40} className="text-orange-600 animate-pulse" />
                        </div>
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-gray-800 mb-2">درحال پردازش و ارسال...</h3>
                        <div className="space-y-1 text-sm text-gray-500 font-medium">
                            <p>سیستم در حال تولید تصویر مجوز و ارسال به واتساپ است.</p>
                            <p className="text-orange-600 font-bold animate-pulse">لطفا صبر کنید تا عملیات کاملاً تمام شود.</p>
                        </div>
                    </div>
                </div>
            </div>
        )}
        
        {permitForAutoSend && (
            <div className="hidden-print-export" style={{position: 'absolute', top: '-9999px', left: '-9999px', width: '210mm'}}>
                <PrintExitPermit permit={permitForAutoSend} onClose={()=>{}} embed settings={settings} />
            </div>
        )}
        <div className="p-6 border-b flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Truck size={24} className="text-orange-600"/> کارتابل خروج بار</h2>
            <div className="flex justify-between items-center gap-2">
                <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button onClick={() => setActiveTab('current')} className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'current' ? 'bg-white shadow text-orange-600' : 'text-gray-500'}`}>جاری</button>
                    <button onClick={() => setActiveTab('archive')} className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'archive' ? 'bg-white shadow text-green-600' : 'text-gray-500'}`}>بایگانی</button>
                </div>
                <button onClick={() => loadData()} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 transition-colors" title="بروزرسانی">
                    <RefreshCw size={18} />
                </button>
            </div>
            <div className="relative w-full md:w-64"><Search className="absolute right-3 top-2.5 text-gray-400" size={18}/><input className="w-full pl-4 pr-10 py-2 border rounded-xl text-sm" placeholder="جستجو..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/></div>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
                <thead className="bg-gray-5 text-gray-600"><tr><th className="p-4">شماره</th><th className="p-4">تاریخ</th><th className="p-4">کالا</th><th className="p-4">گیرنده</th><th className="p-4">ساعت خروج</th><th className="p-4">وضعیت</th><th className="p-4 text-center">عملیات</th></tr></thead>
                <tbody>
                    {permits.filter(p => activeTab === 'archive' ? (p.status === ExitPermitStatus.EXITED || p.status === ExitPermitStatus.REJECTED) : (p.status !== ExitPermitStatus.EXITED && p.status !== ExitPermitStatus.REJECTED)).filter(p => p.goodsName?.includes(searchTerm) || p.permitNumber.toString().includes(searchTerm)).map(p => (
                        <tr key={p.id} className="border-b hover:bg-gray-50 transition-colors">
                            <td className="p-4 font-bold text-orange-600">#{p.permitNumber}</td>
                            <td className="p-4 text-xs">{formatDate(p.date)}</td>
                            <td className="p-4 font-bold text-xs">{p.goodsName}</td>
                            <td className="p-4 text-xs">{p.recipientName}</td>
                            <td className="p-4 font-mono font-bold text-blue-600">{p.exitTime || '-'}</td>
                            <td className="p-4">{getStatusBadge(p.status)}</td>
                            <td className="p-4 text-center">
                                <div className="flex justify-center gap-2">
                                    <button onClick={() => setViewPermit(p)} className="bg-blue-100 text-blue-600 p-2 rounded-lg hover:bg-blue-200" title="مشاهده"><Eye size={16}/></button>
                                    
                                    {isProcessingId === p.id ? (
                                        <div className="flex items-center gap-1 text-[10px] font-bold text-blue-600 animate-pulse"><Loader2 size={14} className="animate-spin"/> صبر کنید...</div>
                                    ) : (
                                        <>
                                            {/* Security Time Entry Logic */}
                                            {p.status === ExitPermitStatus.PENDING_SECURITY && (
                                                currentUser.role === UserRole.SECURITY_GUARD || 
                                                currentUser.role === UserRole.SECURITY_HEAD || 
                                                currentUser.role === UserRole.ADMIN ||
                                                permissions.canApproveExitSecurity // Check custom permission
                                            ) && (
                                                <div className="flex items-center gap-2 bg-amber-50 p-1 rounded-lg border border-amber-200">
                                                    <input className="w-16 border rounded p-1 text-[10px] text-center font-mono" placeholder="ساعت" value={showExitTimeInput === p.id ? exitTimeValue : ''} onFocus={() => { setShowExitTimeInput(p.id); setExitTimeValue(new Date().toLocaleTimeString('fa-IR', {hour:'2-digit', minute:'2-digit'})); }} onChange={e => setExitTimeValue(e.target.value)}/>
                                                    <button onClick={() => handleApproveAction(p.id, p.status)} className="bg-amber-600 text-white p-1 rounded hover:bg-amber-700" title="ثبت خروج"><CheckCircle size={14}/></button>
                                                </div>
                                            )}
                                            
                                            {/* Normal Approval Button */}
                                            {p.status !== ExitPermitStatus.PENDING_SECURITY && canApprove(p) && (
                                                <button onClick={() => handleApproveAction(p.id, p.status)} className="bg-green-100 text-green-600 p-2 rounded-lg hover:bg-green-200" title="تایید مرحله بعدی"><CheckCircle size={16}/></button>
                                            )}

                                            {/* ADMIN FORCE ARCHIVE (LEGACY FIX) */}
                                            {currentUser.role === UserRole.ADMIN && p.status !== ExitPermitStatus.EXITED && (
                                                <button onClick={() => handleForceArchive(p.id)} className="bg-gray-100 text-gray-600 p-2 rounded-lg hover:bg-gray-200 border border-gray-300" title="بایگانی دستی (مجوزهای قدیمی)"><ArchiveRestore size={16}/></button>
                                            )}
                                        </>
                                    )}

                                    {canEdit(p) && <button onClick={() => setEditingPermit(p)} className="bg-amber-50 text-amber-600 p-2 rounded-lg hover:bg-amber-100"><Edit size={16}/></button>}
                                    {(p.status !== ExitPermitStatus.EXITED && p.status !== ExitPermitStatus.REJECTED && canApprove(p)) && <button onClick={() => handleReject(p.id)} className="bg-red-50 text-red-600 p-2 rounded-lg hover:bg-red-100" title="رد درخواست"><XCircle size={16}/></button>}
                                    {currentUser.role === UserRole.ADMIN && <button onClick={async () => { if(confirm('حذف نهایی؟')) { await deleteExitPermit(p.id); loadData(); } }} className="text-red-300 hover:text-red-500 p-2"><Trash2 size={16}/></button>}
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
        {viewPermit && (
            <PrintExitPermit 
                permit={viewPermit} 
                onClose={() => setViewPermit(null)} 
                settings={settings} 
                onApprove={canApprove(viewPermit) ? () => handleApproveAction(viewPermit.id, viewPermit.status) : undefined} 
                onReject={(viewPermit.status !== ExitPermitStatus.EXITED && canApprove(viewPermit)) ? () => handleReject(viewPermit.id) : undefined}
                onEdit={canEdit(viewPermit) ? () => { setEditingPermit(viewPermit); setViewPermit(null); } : undefined}
            />
        )}
        {editingPermit && <EditExitPermitModal permit={editingPermit} onClose={() => setEditingPermit(null)} onSave={loadData} />}
    </div>
  );
};
export default ManageExitPermits;
