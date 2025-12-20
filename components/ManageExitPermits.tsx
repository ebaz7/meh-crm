import React, { useState, useEffect } from 'react';
import { ExitPermit, ExitPermitStatus, User, UserRole, SystemSettings } from '../types';
import { getExitPermits, updateExitPermitStatus, deleteExitPermit } from '../services/storageService';
import { getRolePermissions, getUsers } from '../services/authService'; 
import { formatDate } from '../constants';
import { Eye, Trash2, Search, CheckCircle, Truck, AlertCircle, XCircle, Archive, ListChecks, X, Edit, Clock } from 'lucide-react';
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
  
  const [permitForAutoSend, setPermitForAutoSend] = useState<ExitPermit | null>(null);
  const permissions = getRolePermissions(currentUser.role, settings || null);

  useEffect(() => { loadData(); }, []);
  
  useEffect(() => {
      if (statusFilter) setActiveStatusFilter(statusFilter);
  }, [statusFilter]);

  const loadData = async () => { setPermits(await getExitPermits()); };

  const canApprove = (p: ExitPermit) => {
      if (activeTab === 'archive' && !permissions.canEditExitArchive) return false;

      // مرحله ۱: تایید مدیرعامل
      if (p.status === ExitPermitStatus.PENDING_CEO && (currentUser.role === UserRole.CEO || currentUser.role === UserRole.ADMIN)) return true;
      
      // مرحله ۲: تایید مدیر کارخانه
      if (p.status === ExitPermitStatus.PENDING_FACTORY && (currentUser.role === UserRole.FACTORY_MANAGER || currentUser.role === UserRole.ADMIN)) return true;

      // مرحله ۳: تایید انتظامات (ثبت ساعت خروج بار)
      if (p.status === ExitPermitStatus.PENDING_SECURITY && (currentUser.role === UserRole.SECURITY_GUARD || currentUser.role === UserRole.SECURITY_HEAD || currentUser.role === UserRole.ADMIN)) return true;

      return false;
  };

  const canReject = (p: ExitPermit) => {
      if (activeTab === 'archive' && !permissions.canEditExitArchive) return false;
      if (p.status === ExitPermitStatus.EXITED || p.status === ExitPermitStatus.REJECTED) return false;
      return canApprove(p);
  };

  const handleApprove = async (id: string, currentStatus: ExitPermitStatus) => {
      let nextStatus = currentStatus;
      let exitTime: string | undefined;

      if (currentStatus === ExitPermitStatus.PENDING_CEO) {
          nextStatus = ExitPermitStatus.PENDING_FACTORY;
      } else if (currentStatus === ExitPermitStatus.PENDING_FACTORY) {
          nextStatus = ExitPermitStatus.PENDING_SECURITY;
      } else if (currentStatus === ExitPermitStatus.PENDING_SECURITY) {
          // مرحله نهایی: دریافت ساعت خروج توسط انتظامات
          const time = prompt('لطفا ساعت دقیق خروج بار از کارخانه را وارد کنید (مثلا ۱۴:۳۰):', new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }));
          if (time === null) return; 
          exitTime = time;
          nextStatus = ExitPermitStatus.EXITED;
      }
      
      const permitToApprove = permits.find(p => p.id === id);
      if (!permitToApprove) return;

      if(window.confirm('آیا تایید مرحله جاری را انجام می‌دهید؟')) {
          await updateExitPermitStatus(id, nextStatus, currentUser, { exitTime });
          
          const updatedPermitMock = { ...permitToApprove, status: nextStatus, exitTime };
          if (nextStatus === ExitPermitStatus.PENDING_FACTORY) updatedPermitMock.approverCeo = currentUser.fullName;
          if (nextStatus === ExitPermitStatus.PENDING_SECURITY) {
              updatedPermitMock.approverCeo = permitToApprove.approverCeo;
              updatedPermitMock.approverFactory = currentUser.fullName;
          }
          if (nextStatus === ExitPermitStatus.EXITED) {
              updatedPermitMock.approverCeo = permitToApprove.approverCeo;
              updatedPermitMock.approverFactory = permitToApprove.approverFactory;
              updatedPermitMock.approverSecurity = currentUser.fullName;
          }

          setPermitForAutoSend(updatedPermitMock);

          setTimeout(async () => {
              const element = document.getElementById(`print-permit-${updatedPermitMock.id}`);
              if (element) {
                  try {
                      // @ts-ignore
                      const canvas = await window.html2canvas(element, { scale: 2, backgroundColor: '#ffffff' });
                      const base64 = canvas.toDataURL('image/png').split(',')[1];

                      if (nextStatus === ExitPermitStatus.PENDING_FACTORY) {
                          const caption = `🏭 *تایید مدیرعامل / ارسال به مدیر کارخانه*\n🔹 شماره: ${updatedPermitMock.permitNumber}\n👤 گیرنده: ${updatedPermitMock.recipientName || 'چند مقصد'}\n✍️ تایید کننده: ${currentUser.fullName}`;
                          const users = await getUsers();
                          const targetUser = users.find(u => u.role === UserRole.FACTORY_MANAGER && u.phoneNumber);
                          if (targetUser) await apiCall('/send-whatsapp', 'POST', { number: targetUser.phoneNumber, message: caption, mediaData: { data: base64, mimeType: 'image/png', filename: `Permit_${updatedPermitMock.permitNumber}.png` } });
                      } 
                      else if (nextStatus === ExitPermitStatus.PENDING_SECURITY) {
                          const caption = `👮 *تایید کارخانه / در انتظار خروج نهایی*\n🔹 شماره: ${updatedPermitMock.permitNumber}\n👤 گیرنده: ${updatedPermitMock.recipientName || 'چند مقصد'}\n\nبار آماده خروج فیزیکی است.`;
                          if (settings?.exitPermitNotificationGroup) {
                              await apiCall('/send-whatsapp', 'POST', { number: settings.exitPermitNotificationGroup, message: caption, mediaData: { data: base64, mimeType: 'image/png', filename: `Permit_Security_${updatedPermitMock.permitNumber}.png` } });
                          }
                      }
                      else if (nextStatus === ExitPermitStatus.EXITED) {
                          const caption = `✅ *خروج بار قطعی*\n🔹 شماره: ${updatedPermitMock.permitNumber}\n👤 گیرنده: ${updatedPermitMock.recipientName || 'چند مقصد'}\n⏰ ساعت خروج: ${exitTime}\n👮 تایید انتظامات: ${currentUser.fullName}\n\nبار از کارخانه خارج شد.`;
                          
                          // ارسال به مدیر فروش (درخواست کننده)
                          const users = await getUsers();
                          const salesManager = users.find(u => u.fullName === updatedPermitMock.requester && u.phoneNumber);
                          if (salesManager) {
                              await apiCall('/send-whatsapp', 'POST', { number: salesManager.phoneNumber, message: caption, mediaData: { data: base64, mimeType: 'image/png', filename: `Final_Exit_${updatedPermitMock.permitNumber}.png` } });
                          }

                          // ارسال به گروه ورود و خروج تنظیم شده در تنظیمات انبار
                          if (settings?.exitPermitNotificationGroup) {
                              await apiCall('/send-whatsapp', 'POST', { number: settings.exitPermitNotificationGroup, message: caption, mediaData: { data: base64, mimeType: 'image/png', filename: `Final_Exit_${updatedPermitMock.permitNumber}.png` } });
                          }
                      }
                  } catch (e) { console.error("Auto send failed", e); } 
                  finally { setPermitForAutoSend(null); loadData(); setViewPermit(null); }
              } else { setPermitForAutoSend(null); loadData(); setViewPermit(null); }
          }, 1500); 
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

  const filtered = permits.filter(p => {
      if (activeTab === 'current') { if (p.status === ExitPermitStatus.EXITED || p.status === ExitPermitStatus.REJECTED) return false; }
      else { if (p.status !== ExitPermitStatus.EXITED && p.status !== ExitPermitStatus.REJECTED) return false; }
      if (activeStatusFilter === 'pending') { if (p.status === ExitPermitStatus.EXITED || p.status === ExitPermitStatus.REJECTED) return false; }
      return p.goodsName?.toLowerCase().includes(searchTerm.toLowerCase()) || p.permitNumber.toString().includes(searchTerm);
  });

  const getStatusBadge = (status: ExitPermitStatus) => {
      switch(status) {
          case ExitPermitStatus.PENDING_CEO: return <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">منتظر مدیرعامل</span>;
          case ExitPermitStatus.PENDING_FACTORY: return <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">منتظر مدیر کارخانه</span>;
          case ExitPermitStatus.PENDING_SECURITY: return <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs">منتظر انتظامات (خروج)</span>;
          case ExitPermitStatus.EXITED: return <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">خارج شده</span>;
          case ExitPermitStatus.REJECTED: return <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs">رد شده</span>;
      }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in relative">
        {permitForAutoSend && (
            <div className="hidden-print-export" style={{position: 'absolute', top: '-9999px', left: '-9999px', width: '800px'}}>
                <PrintExitPermit permit={permitForAutoSend} onClose={()=>{}} embed settings={settings} />
            </div>
        )}
        <div className="p-6 border-b flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Truck size={24} className="text-orange-600"/> کارتابل خروج بار</h2>
            <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button onClick={() => setActiveTab('current')} className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'current' ? 'bg-white shadow text-orange-600' : 'text-gray-500 hover:text-gray-700'}`}><ListChecks size={18} /> جاری</button>
                    <button onClick={() => setActiveTab('archive')} className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'archive' ? 'bg-white shadow text-green-600' : 'text-gray-500 hover:text-gray-700'}`}><Archive size={18} /> بایگانی</button>
                </div>
                <div className="relative w-full md:w-64">
                    <Search className="absolute right-3 top-2.5 text-gray-400" size={18}/>
                    <input className="w-full pl-4 pr-10 py-2 border rounded-xl text-sm" placeholder="جستجو..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
                </div>
            </div>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
                <thead className="bg-gray-5 text-gray-600"><tr><th className="p-4">شماره</th><th className="p-4">تاریخ</th><th className="p-4">کالا</th><th className="p-4">وضعیت</th><th className="p-4 text-center">عملیات</th></tr></thead>
                <tbody>
                    {filtered.map(p => (
                        <tr key={p.id} className="border-b hover:bg-gray-50">
                            <td className="p-4 font-bold text-orange-600">#{p.permitNumber}</td>
                            <td className="p-4">{formatDate(p.date)}</td>
                            <td className="p-4 font-bold">{p.items?.[0]?.goodsName || p.goodsName}</td>
                            <td className="p-4">{getStatusBadge(p.status)}</td>
                            <td className="p-4 text-center flex justify-center gap-2">
                                <button onClick={() => setViewPermit(p)} className="bg-blue-100 text-blue-600 p-2 rounded-lg hover:bg-blue-200" title="مشاهده"><Eye size={16}/></button>
                                {canApprove(p) && <button onClick={() => handleApprove(p.id, p.status)} className="bg-green-100 text-green-600 p-2 rounded-lg hover:bg-green-200" title="تایید مرحله"><CheckCircle size={16}/></button>}
                                {canReject(p) && <button onClick={() => handleReject(p.id)} className="bg-red-100 text-red-600 p-2 rounded-lg hover:bg-red-200" title="رد درخواست"><XCircle size={16}/></button>}
                                {(currentUser.role === UserRole.ADMIN) && <button onClick={() => deleteExitPermit(p.id).then(()=>loadData())} className="bg-red-50 text-red-400 p-2 rounded-lg hover:bg-red-100"><Trash2 size={16}/></button>}
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
                onApprove={canApprove(viewPermit) ? () => handleApprove(viewPermit.id, viewPermit.status) : undefined}
                onReject={canReject(viewPermit) ? () => handleReject(viewPermit.id) : undefined}
                settings={settings}
            />
        )}
        {editingPermit && <EditExitPermitModal permit={editingPermit} onClose={() => setEditingPermit(null)} onSave={() => { setEditingPermit(null); loadData(); }} />}
    </div>
  );
};

export default ManageExitPermits;
