
import React, { useState, useEffect } from 'react';
import { ExitPermit, ExitPermitStatus, User, UserRole, SystemSettings } from '../types';
import { getExitPermits, updateExitPermitStatus, deleteExitPermit } from '../services/storageService';
import { getRolePermissions, getUsers } from '../services/authService'; 
import { formatDate } from '../constants';
import { Eye, Trash2, Search, CheckCircle, Truck, XCircle, Edit, Clock, Loader2 } from 'lucide-react';
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
  
  const permissions = getRolePermissions(currentUser.role, settings || null);

  useEffect(() => { loadData(); }, []);
  useEffect(() => { if (statusFilter) setActiveStatusFilter(statusFilter); }, [statusFilter]);

  const loadData = async () => { setPermits(await getExitPermits()); };

  const canApprove = (p: ExitPermit) => {
      if (activeTab === 'archive' && !permissions.canEditExitArchive) return false;
      if (p.status === ExitPermitStatus.PENDING_CEO && (currentUser.role === UserRole.CEO || currentUser.role === UserRole.ADMIN)) return true;
      if (p.status === ExitPermitStatus.PENDING_FACTORY && (currentUser.role === UserRole.FACTORY_MANAGER || currentUser.role === UserRole.ADMIN)) return true;
      if (p.status === ExitPermitStatus.PENDING_SECURITY && (currentUser.role === UserRole.SECURITY_GUARD || currentUser.role === UserRole.SECURITY_HEAD || currentUser.role === UserRole.ADMIN)) return true;
      return false;
  };

  const canEdit = (p: ExitPermit) => {
      if (currentUser.role === UserRole.ADMIN) return true;
      if (p.status === ExitPermitStatus.EXITED) return false;
      if (permissions.canEditAll) return true;
      if (permissions.canEditOwn && p.requester === currentUser.fullName) return true;
      return false;
  };

  const handleApproveAction = async (id: string, currentStatus: ExitPermitStatus) => {
      let nextStatus = currentStatus;
      let extra: any = {};

      // Determine Next Status
      if (currentStatus === ExitPermitStatus.PENDING_CEO) nextStatus = ExitPermitStatus.PENDING_FACTORY;
      else if (currentStatus === ExitPermitStatus.PENDING_FACTORY) nextStatus = ExitPermitStatus.PENDING_SECURITY;
      else if (currentStatus === ExitPermitStatus.PENDING_SECURITY) {
          if (!exitTimeValue) { alert("لطفا ابتدا ساعت خروج را وارد کنید."); return; }
          nextStatus = ExitPermitStatus.EXITED;
          extra.exitTime = exitTimeValue;
      }
      
      const permitToApprove = permits.find(p => p.id === id);
      if (!permitToApprove) return;

      if(window.confirm('آیا تایید می‌کنید؟')) {
          setIsProcessingId(id);
          try {
              // 1. Update Database
              await updateExitPermitStatus(id, nextStatus, currentUser, extra);
              
              // 2. Prepare Mock Object for Printing (Immediate UI Feedback)
              const updatedPermitMock = { ...permitToApprove, status: nextStatus, ...extra };
              
              // Fill approver names based on transition
              if (nextStatus === ExitPermitStatus.PENDING_FACTORY) {
                  updatedPermitMock.approverCeo = currentUser.fullName;
              }
              if (nextStatus === ExitPermitStatus.PENDING_SECURITY) {
                  updatedPermitMock.approverCeo = permitToApprove.approverCeo || 'تایید شده';
                  updatedPermitMock.approverFactory = currentUser.fullName;
              }
              if (nextStatus === ExitPermitStatus.EXITED) {
                  updatedPermitMock.approverCeo = permitToApprove.approverCeo || 'تایید شده';
                  updatedPermitMock.approverFactory = permitToApprove.approverFactory || 'تایید شده';
                  updatedPermitMock.approverSecurity = currentUser.fullName;
                  updatedPermitMock.exitTime = extra.exitTime; // Critical for print
              }

              // 3. Trigger Render for Screenshot
              setPermitForAutoSend(updatedPermitMock);

              // 4. Wait for Render & Send Notification
              setTimeout(async () => {
                  const element = document.getElementById(`print-permit-${updatedPermitMock.id}`);
                  if (element) {
                      try {
                          // @ts-ignore
                          const canvas = await window.html2canvas(element, { 
                              scale: 2, 
                              backgroundColor: '#ffffff',
                              windowWidth: 1200 // Ensure desktop layout for clarity
                          });
                          const base64 = canvas.toDataURL('image/png').split(',')[1];
                          const users = await getUsers();

                          // LOGIC FOR SENDING MESSAGES (Mutually Exclusive)
                          if (nextStatus === ExitPermitStatus.PENDING_FACTORY) {
                              // Send to Factory Manager
                              const caption = `✍️ *تایید مدیرعامل انجام شد*\n🔹 شماره مجوز: ${updatedPermitMock.permitNumber}\n📦 کالا: ${updatedPermitMock.goodsName}\n\nمنتظر تایید مدیر کارخانه جهت خروج.`;
                              const target = users.find(u => u.role === UserRole.FACTORY_MANAGER && u.phoneNumber);
                              if (target?.phoneNumber) await apiCall('/send-whatsapp', 'POST', { number: target.phoneNumber, message: caption, mediaData: { data: base64, mimeType: 'image/png' } });
                          
                          } else if (nextStatus === ExitPermitStatus.PENDING_SECURITY) {
                              // Send to Security Group/Head
                              const caption = `🏭 *تایید مدیر کارخانه انجام شد*\n🔹 شماره مجوز: ${updatedPermitMock.permitNumber}\n\nارسال به انتظامات جهت ثبت ساعت و خروج نهایی بار.`;
                              const securityUsers = users.filter(u => (u.role === UserRole.SECURITY_GUARD || u.role === UserRole.SECURITY_HEAD) && u.phoneNumber);
                              // Send to unique numbers to avoid spam if multiple roles exist
                              const uniqueNumbers = [...new Set(securityUsers.map(u => u.phoneNumber))];
                              for (const num of uniqueNumbers) {
                                  if(num) await apiCall('/send-whatsapp', 'POST', { number: num, message: caption, mediaData: { data: base64, mimeType: 'image/png' } });
                              }

                          } else if (nextStatus === ExitPermitStatus.EXITED) {
                              // FINAL EXIT - GUARANTEED GROUP SEND
                              let caption = `✅ *خروج نهایی بار از کارخانه ثبت شد*\n`;
                              caption += `🔹 شماره مجوز: ${updatedPermitMock.permitNumber}\n`;
                              caption += `📅 تاریخ: ${formatDate(updatedPermitMock.date)}\n`;
                              caption += `📦 کالا: ${updatedPermitMock.goodsName}\n`;
                              caption += `🔢 تعداد: ${updatedPermitMock.cartonCount || 0} کارتن\n`;
                              caption += `👤 گیرنده: ${updatedPermitMock.recipientName}\n`;
                              caption += `🚛 راننده: ${updatedPermitMock.driverName || '-'}\n`;
                              caption += `🕒 ساعت خروج: ${extra.exitTime}\n`;
                              caption += `✍️ تایید نهایی: ${currentUser.fullName}`;

                              // 1. Send to Requester
                              const requesterUser = users.find(u => u.fullName === updatedPermitMock.requester && u.phoneNumber);
                              if (requesterUser?.phoneNumber) {
                                  await apiCall('/send-whatsapp', 'POST', { number: requesterUser.phoneNumber, message: caption, mediaData: { data: base64, mimeType: 'image/png' } });
                              }
                              
                              // 2. GUARANTEED Send to Notification Group (Warehouse/Logistics Group)
                              if (settings?.exitPermitNotificationGroup) {
                                  console.log("Sending final exit report to group:", settings.exitPermitNotificationGroup);
                                  await apiCall('/send-whatsapp', 'POST', { number: settings.exitPermitNotificationGroup, message: caption, mediaData: { data: base64, mimeType: 'image/png' } });
                              }
                          }
                      } catch (e) { console.error("Notification Error:", e); }
                  }
                  
                  // Cleanup
                  setPermitForAutoSend(null);
                  setExitTimeValue('');
                  setShowExitTimeInput(null);
                  setIsProcessingId(null);
                  loadData();
                  setViewPermit(null);
                  alert("عملیات با موفقیت انجام شد.");
              }, 2500); // Increased delay to ensure rendering matches state
          } catch (e) {
              alert("خطا در تایید");
              setIsProcessingId(null);
          }
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
          case ExitPermitStatus.PENDING_SECURITY: return <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded text-[10px] font-bold">انتظار انتظامات</span>;
          case ExitPermitStatus.EXITED: return <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-[10px] font-bold">خارج شده</span>;
          case ExitPermitStatus.REJECTED: return <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-[10px] font-bold">رد شده</span>;
      }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in relative">
        {permitForAutoSend && (
            <div className="hidden-print-export" style={{position: 'absolute', top: '-9999px', left: '-9999px', width: '210mm'}}>
                <PrintExitPermit permit={permitForAutoSend} onClose={()=>{}} embed settings={settings} />
            </div>
        )}
        <div className="p-6 border-b flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Truck size={24} className="text-orange-600"/> کارتابل خروج بار</h2>
            <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button onClick={() => setActiveTab('current')} className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'current' ? 'bg-white shadow text-orange-600' : 'text-gray-500'}`}>جاری</button>
                    <button onClick={() => setActiveTab('archive')} className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'archive' ? 'bg-white shadow text-green-600' : 'text-gray-500'}`}>بایگانی</button>
                </div>
                <div className="relative w-full md:w-64"><Search className="absolute right-3 top-2.5 text-gray-400" size={18}/><input className="w-full pl-4 pr-10 py-2 border rounded-xl text-sm" placeholder="جستجو..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/></div>
            </div>
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
                                        <div className="flex items-center gap-1 text-[10px] font-bold text-blue-600 animate-pulse"><Loader2 size={14} className="animate-spin"/> در حال تایید...</div>
                                    ) : (
                                        <>
                                            {p.status === ExitPermitStatus.PENDING_SECURITY && (currentUser.role === UserRole.SECURITY_GUARD || currentUser.role === UserRole.SECURITY_HEAD || currentUser.role === UserRole.ADMIN) && (
                                                <div className="flex items-center gap-2 bg-amber-50 p-1 rounded-lg border border-amber-200">
                                                    <input className="w-16 border rounded p-1 text-[10px] text-center font-mono" placeholder="ساعت" value={showExitTimeInput === p.id ? exitTimeValue : ''} onFocus={() => { setShowExitTimeInput(p.id); setExitTimeValue(new Date().toLocaleTimeString('fa-IR', {hour:'2-digit', minute:'2-digit'})); }} onChange={e => setExitTimeValue(e.target.value)}/>
                                                    <button onClick={() => handleApproveAction(p.id, p.status)} className="bg-amber-600 text-white p-1 rounded hover:bg-amber-700" title="ثبت خروج"><CheckCircle size={14}/></button>
                                                </div>
                                            )}
                                            {p.status !== ExitPermitStatus.PENDING_SECURITY && canApprove(p) && (
                                                <button onClick={() => handleApproveAction(p.id, p.status)} className="bg-green-100 text-green-600 p-2 rounded-lg hover:bg-green-200" title="تایید مرحله بعدی"><CheckCircle size={16}/></button>
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
