
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
  
  // Exit Time Entry state for Security
  const [showExitTimeInput, setShowExitTimeInput] = useState<string | null>(null); // Permit ID
  const [exitTimeValue, setExitTimeValue] = useState('');

  const [permitForAutoSend, setPermitForAutoSend] = useState<ExitPermit | null>(null);
  const [deletedPermitForAutoSend, setDeletedPermitForAutoSend] = useState<ExitPermit | null>(null);
  
  const permissions = getRolePermissions(currentUser.role, settings || null);

  useEffect(() => { loadData(); }, []);
  useEffect(() => { if (statusFilter) setActiveStatusFilter(statusFilter); }, [statusFilter]);

  const loadData = async () => { setPermits(await getExitPermits()); };

  const canApprove = (p: ExitPermit) => {
      if (activeTab === 'archive' && !permissions.canEditExitArchive) return false;

      // Stage 1: Security Guard Approval
      if (p.status === ExitPermitStatus.PENDING_SECURITY && (currentUser.role === UserRole.SECURITY_GUARD || currentUser.role === UserRole.SECURITY_HEAD || currentUser.role === UserRole.ADMIN)) return true;
      
      // Stage 2: Factory Manager Approval
      if (p.status === ExitPermitStatus.PENDING_FACTORY && (currentUser.role === UserRole.FACTORY_MANAGER || currentUser.role === UserRole.ADMIN)) return true;
      
      // Stage 3: CEO Final Approval
      if (p.status === ExitPermitStatus.PENDING_CEO && (currentUser.role === UserRole.CEO || currentUser.role === UserRole.ADMIN)) return true;
      
      return false;
  };

  const canReject = (p: ExitPermit) => {
      if (activeTab === 'archive' && !permissions.canEditExitArchive) return false;
      if (p.status === ExitPermitStatus.EXITED || p.status === ExitPermitStatus.REJECTED) return false;
      return canApprove(p);
  };

  const canEdit = (p: ExitPermit) => {
      if (currentUser.role === UserRole.ADMIN) return true;
      if (p.status === ExitPermitStatus.EXITED) return false;
      if (currentUser.role === UserRole.USER) {
          return permissions.canEditOwn && p.requester === currentUser.fullName;
      }
      if (permissions.canEditAll) return true;
      if (permissions.canEditOwn && p.requester === currentUser.fullName) return true;
      return false;
  };

  const handleApproveAction = async (id: string, currentStatus: ExitPermitStatus) => {
      let nextStatus = currentStatus;
      let extra: any = {};

      if (currentStatus === ExitPermitStatus.PENDING_SECURITY) {
          if (!exitTimeValue) {
               alert("لطفا ابتدا ساعت خروج را وارد کنید.");
               return;
          }
          nextStatus = ExitPermitStatus.PENDING_FACTORY;
          extra.exitTime = exitTimeValue;
      }
      else if (currentStatus === ExitPermitStatus.PENDING_FACTORY) nextStatus = ExitPermitStatus.PENDING_CEO;
      else if (currentStatus === ExitPermitStatus.PENDING_CEO) nextStatus = ExitPermitStatus.EXITED;
      
      const permitToApprove = permits.find(p => p.id === id);
      if (!permitToApprove) return;

      if(window.confirm('آیا تایید می‌کنید؟')) {
          await updateExitPermitStatus(id, nextStatus, currentUser, extra);
          
          const updatedPermitMock = { ...permitToApprove, status: nextStatus, ...extra };
          
          if (nextStatus === ExitPermitStatus.PENDING_FACTORY) updatedPermitMock.approverSecurity = currentUser.fullName;
          if (nextStatus === ExitPermitStatus.PENDING_CEO) {
              updatedPermitMock.approverSecurity = permitToApprove.approverSecurity || 'تایید شده';
              updatedPermitMock.approverFactory = currentUser.fullName;
          }
          if (nextStatus === ExitPermitStatus.EXITED) {
              updatedPermitMock.approverSecurity = permitToApprove.approverSecurity || 'تایید شده';
              updatedPermitMock.approverFactory = permitToApprove.approverFactory || 'تایید شده';
              updatedPermitMock.approverCeo = currentUser.fullName; 
          }

          setPermitForAutoSend(updatedPermitMock);

          setTimeout(async () => {
              const element = document.getElementById(`print-permit-${updatedPermitMock.id}`);
              if (element) {
                  try {
                      // @ts-ignore
                      const canvas = await window.html2canvas(element, { scale: 2, backgroundColor: '#ffffff' });
                      const base64 = canvas.toDataURL('image/png').split(',')[1];
                      const users = await getUsers();

                      if (nextStatus === ExitPermitStatus.PENDING_FACTORY) {
                          const caption = `🏭 *مجوز خروج توسط انتظامات تایید شد*\n🔹 شماره: ${updatedPermitMock.permitNumber}\n🕒 ساعت خروج: ${extra.exitTime}\n✍️ تایید: ${currentUser.fullName}\n\nمنتظر تایید مدیر کارخانه.`;
                          const target = users.find(u => u.role === UserRole.FACTORY_MANAGER && u.phoneNumber);
                          if (target) await apiCall('/send-whatsapp', 'POST', { number: target.phoneNumber!, message: caption, mediaData: { data: base64, mimeType: 'image/png' } });
                      } 
                      else if (nextStatus === ExitPermitStatus.PENDING_CEO) {
                          const caption = `✍️ *تایید مدیر کارخانه انجام شد*\n🔹 شماره: ${updatedPermitMock.permitNumber}\n✍️ تایید: ${currentUser.fullName}\n\nمنتظر تایید نهایی مدیرعامل.`;
                          const target = users.find(u => u.role === UserRole.CEO && u.phoneNumber);
                          if (target) await apiCall('/send-whatsapp', 'POST', { number: target.phoneNumber!, message: caption, mediaData: { data: base64, mimeType: 'image/png' } });
                      }
                      else if (nextStatus === ExitPermitStatus.EXITED) {
                          const caption = `✅ *تایید نهایی خروج انجام شد*\n🔹 شماره: ${updatedPermitMock.permitNumber}\n✍️ مدیرعامل: ${currentUser.fullName}\n\nفرآیند تکمیل و بایگانی شد.`;
                          const target = users.find(u => u.fullName === updatedPermitMock.requester && u.phoneNumber);
                          if (target) await apiCall('/send-whatsapp', 'POST', { number: target.phoneNumber!, message: caption, mediaData: { data: base64, mimeType: 'image/png' } });
                      }
                  } catch (e) { console.error(e); }
              }
              setPermitForAutoSend(null);
              setExitTimeValue('');
              setShowExitTimeInput(null);
              loadData();
              setViewPermit(null);
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

  const handleDelete = async (id: string) => {
      if(!confirm('آیا مطمئن هستید که می‌خواهید این مجوز را حذف کنید؟')) return;
      const p = permits.find(x => x.id === id);
      if (p && (p.status !== ExitPermitStatus.PENDING_SECURITY && p.status !== ExitPermitStatus.REJECTED)) {
          const deletedMock = { ...p, status: 'DELETED' as any };
          setDeletedPermitForAutoSend(deletedMock);
          setTimeout(async () => {
              const element = document.getElementById(`print-permit-del-${id}`);
              if (element) {
                  try {
                      // @ts-ignore
                      const canvas = await window.html2canvas(element, { scale: 2, backgroundColor: '#ffffff' });
                      const base64 = canvas.toDataURL('image/png').split(',')[1];
                      let warning = `❌❌ *مجوز خروج ابطال شد* ❌❌\n🔢 شماره: ${p.permitNumber}\n🗑️ ابطال: ${currentUser.fullName}`;
                      const users = await getUsers();
                      const target = users.find(u => u.role === UserRole.FACTORY_MANAGER && u.phoneNumber);
                      if (target) await apiCall('/send-whatsapp', 'POST', { number: target.phoneNumber!, message: warning, mediaData: { data: base64, mimeType: 'image/png' } });
                  } catch (e) { }
              }
              await deleteExitPermit(id);
              setDeletedPermitForAutoSend(null);
              loadData();
          }, 1500);
      } else {
          await deleteExitPermit(id);
          loadData();
      }
  };

  const getStatusBadge = (status: ExitPermitStatus) => {
      switch(status) {
          case ExitPermitStatus.PENDING_SECURITY: return <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded text-xs font-bold">انتظار انتظامات</span>;
          case ExitPermitStatus.PENDING_FACTORY: return <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-bold">انتظار مدیر کارخانه</span>;
          case ExitPermitStatus.PENDING_CEO: return <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-bold">انتظار مدیرعامل</span>;
          case ExitPermitStatus.EXITED: return <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-bold">خارج شده</span>;
          case ExitPermitStatus.REJECTED: return <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-bold">رد شده</span>;
      }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in relative">
        {permitForAutoSend && (
            <div className="hidden-print-export" style={{position: 'absolute', top: '-9999px', left: '-9999px', width: '800px'}}>
                <PrintExitPermit permit={permitForAutoSend} onClose={()=>{}} embed settings={settings} />
            </div>
        )}
        {deletedPermitForAutoSend && (
            <div className="hidden-print-export" style={{position: 'absolute', top: '-9999px', left: '-9999px', width: '800px'}}>
                <div id={`print-permit-del-${deletedPermitForAutoSend.id}`}>
                    <PrintExitPermit permit={deletedPermitForAutoSend} onClose={()=>{}} embed settings={settings} />
                </div>
            </div>
        )}

        <div className="p-6 border-b flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Truck size={24} className="text-orange-600"/> کارتابل خروج بار (۴ مرحله‌ای)</h2>
            
            <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button onClick={() => { setActiveTab('current'); setActiveStatusFilter(null); }} className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'current' ? 'bg-white shadow text-orange-600' : 'text-gray-500 hover:text-gray-700'}`}>جاری</button>
                    <button onClick={() => { setActiveTab('archive'); setActiveStatusFilter(null); }} className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'archive' ? 'bg-white shadow text-green-600' : 'text-gray-500 hover:text-gray-700'}`}>بایگانی</button>
                </div>
                <div className="relative w-full md:w-64">
                    <Search className="absolute right-3 top-2.5 text-gray-400" size={18}/>
                    <input className="w-full pl-4 pr-10 py-2 border rounded-xl text-sm" placeholder="جستجو..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
                </div>
            </div>
        </div>
        
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
                <thead className="bg-gray-5 text-gray-600"><tr><th className="p-4">شماره</th><th className="p-4">تاریخ</th><th className="p-4">کالا</th><th className="p-4">گیرنده</th><th className="p-4">ساعت خروج</th><th className="p-4">وضعیت</th><th className="p-4 text-center">عملیات</th></tr></thead>
                <tbody>
                    {permits.filter(p => activeTab === 'archive' ? (p.status === ExitPermitStatus.EXITED || p.status === ExitPermitStatus.REJECTED) : (p.status !== ExitPermitStatus.EXITED && p.status !== ExitPermitStatus.REJECTED)).filter(p => p.goodsName?.includes(searchTerm) || p.permitNumber.toString().includes(searchTerm)).map(p => (
                        <tr key={p.id} className="border-b hover:bg-gray-50">
                            <td className="p-4 font-bold text-orange-600">#{p.permitNumber}</td>
                            <td className="p-4 text-xs">{formatDate(p.date)}</td>
                            <td className="p-4 font-bold text-xs">{p.goodsName}</td>
                            <td className="p-4 text-xs">{p.recipientName}</td>
                            <td className="p-4 font-mono font-bold text-blue-600">{p.exitTime || '-'}</td>
                            <td className="p-4">{getStatusBadge(p.status)}</td>
                            <td className="p-4 text-center">
                                <div className="flex justify-center gap-2">
                                    <button onClick={() => setViewPermit(p)} className="bg-blue-100 text-blue-600 p-2 rounded-lg hover:bg-blue-200" title="مشاهده"><Eye size={16}/></button>
                                    
                                    {/* Exit Time Input for Security */}
                                    {p.status === ExitPermitStatus.PENDING_SECURITY && (currentUser.role === UserRole.SECURITY_GUARD || currentUser.role === UserRole.SECURITY_HEAD || currentUser.role === UserRole.ADMIN) && (
                                        <div className="flex items-center gap-2 bg-amber-50 p-1 rounded-lg border border-amber-200">
                                            <input 
                                                className="w-20 border rounded p-1 text-xs text-center font-mono" 
                                                placeholder="ساعت" 
                                                value={showExitTimeInput === p.id ? exitTimeValue : ''} 
                                                onFocus={() => { setShowExitTimeInput(p.id); setExitTimeValue(new Date().toLocaleTimeString('fa-IR', {hour:'2-digit', minute:'2-digit'})); }}
                                                onChange={e => setExitTimeValue(e.target.value)}
                                            />
                                            <button onClick={() => handleApproveAction(p.id, p.status)} className="bg-amber-600 text-white p-1 rounded hover:bg-amber-700"><CheckCircle size={14}/></button>
                                        </div>
                                    )}

                                    {/* Standard Approval for Factory/CEO */}
                                    {p.status !== ExitPermitStatus.PENDING_SECURITY && canApprove(p) && (
                                        <button onClick={() => handleApproveAction(p.id, p.status)} className="bg-green-100 text-green-600 p-2 rounded-lg hover:bg-green-200" title="تایید"><CheckCircle size={16}/></button>
                                    )}

                                    {canReject(p) && <button onClick={() => handleReject(p.id)} className="bg-red-100 text-red-600 p-2 rounded-lg hover:bg-red-200" title="رد"><XCircle size={16}/></button>}
                                    {canEdit(p) && <button onClick={() => setEditingPermit(p)} className="bg-gray-100 text-gray-600 p-2 rounded-lg hover:bg-gray-200"><Edit size={16}/></button>}
                                    {(currentUser.role === UserRole.ADMIN) && <button onClick={() => handleDelete(p.id)} className="text-red-400 hover:text-red-600 p-2"><Trash2 size={16}/></button>}
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
                onReject={canReject(viewPermit) ? () => handleReject(viewPermit.id) : undefined}
            />
        )}

        {editingPermit && <EditExitPermitModal permit={editingPermit} onClose={() => setEditingPermit(null)} onSave={loadData} />}
    </div>
  );
};

export default ManageExitPermits;
