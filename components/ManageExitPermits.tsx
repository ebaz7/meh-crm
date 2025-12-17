
import React, { useState, useEffect } from 'react';
import { ExitPermit, ExitPermitStatus, User, UserRole, SystemSettings } from '../types';
import { getExitPermits, updateExitPermitStatus, deleteExitPermit } from '../services/storageService';
import { getRolePermissions, getUsers } from '../services/authService'; 
import { formatDate } from '../constants';
import { Eye, Trash2, Search, CheckCircle, Truck, AlertCircle, XCircle, Archive, ListChecks, X, Edit } from 'lucide-react';
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
  
  // State for Auto-Send Rendering (Hidden)
  const [permitForAutoSend, setPermitForAutoSend] = useState<ExitPermit | null>(null);
  
  const permissions = getRolePermissions(currentUser.role, settings || null);

  useEffect(() => { loadData(); }, []);
  
  // Sync filter from props if it changes
  useEffect(() => {
      if (statusFilter) setActiveStatusFilter(statusFilter);
  }, [statusFilter]);

  const loadData = async () => { setPermits(await getExitPermits()); };

  const canApprove = (p: ExitPermit) => {
      // Archive Items generally shouldn't be approved again
      if (activeTab === 'archive' && !permissions.canEditExitArchive) return false;

      if (p.status === ExitPermitStatus.PENDING_CEO && (currentUser.role === UserRole.CEO || currentUser.role === UserRole.ADMIN)) return true;
      if (p.status === ExitPermitStatus.PENDING_FACTORY && (currentUser.role === UserRole.FACTORY_MANAGER || currentUser.role === UserRole.ADMIN)) return true;
      return false;
  };

  const canReject = (p: ExitPermit) => {
      if (activeTab === 'archive' && !permissions.canEditExitArchive) return false;
      if (p.status === ExitPermitStatus.EXITED || p.status === ExitPermitStatus.REJECTED) return false;
      return canApprove(p);
  };

  const canEdit = (p: ExitPermit) => {
      if (currentUser.role === UserRole.ADMIN) return true;
      if (p.status === ExitPermitStatus.EXITED) return false; // Usually finalized shouldn't be edited by users
      if (currentUser.role === UserRole.USER) {
          return permissions.canEditOwn && p.requester === currentUser.fullName;
      }
      if (permissions.canEditAll) return true;
      if (permissions.canEditOwn && p.requester === currentUser.fullName) return true;
      return false;
  };

  const handleApprove = async (id: string, currentStatus: ExitPermitStatus) => {
      let nextStatus = currentStatus;
      if (currentStatus === ExitPermitStatus.PENDING_CEO) nextStatus = ExitPermitStatus.PENDING_FACTORY;
      else if (currentStatus === ExitPermitStatus.PENDING_FACTORY) nextStatus = ExitPermitStatus.EXITED;
      
      const permitToApprove = permits.find(p => p.id === id);
      if (!permitToApprove) return;

      if(window.confirm('آیا تایید می‌کنید؟')) {
          // 1. Update Database Status
          await updateExitPermitStatus(id, nextStatus, currentUser);
          
          // 2. Prepare Mock Object for Image Generation (simulate signatures immediately)
          const updatedPermitMock = { ...permitToApprove, status: nextStatus };
          
          if (nextStatus === ExitPermitStatus.PENDING_FACTORY) {
              // CEO just approved
              updatedPermitMock.approverCeo = currentUser.fullName; 
          } else if (nextStatus === ExitPermitStatus.EXITED) {
              // Factory Manager just approved
              if (!updatedPermitMock.approverCeo) updatedPermitMock.approverCeo = permitToApprove.approverCeo || 'تایید شده'; // Ensure CEO sig remains
              updatedPermitMock.approverFactory = currentUser.fullName; 
          }

          // Check if this is a Correction
          const isCorrection = permitToApprove.updatedAt && permitToApprove.createdAt && permitToApprove.updatedAt > (permitToApprove.createdAt + 60000);
          const suffix = isCorrection ? ' (اصلاحیه)' : '';

          // 3. Trigger Render & Send Process
          setPermitForAutoSend(updatedPermitMock);

          setTimeout(async () => {
              const element = document.getElementById(`print-permit-${updatedPermitMock.id}`);
              if (element) {
                  try {
                      // @ts-ignore
                      const canvas = await window.html2canvas(element, { scale: 2, backgroundColor: '#ffffff' });
                      const base64 = canvas.toDataURL('image/png').split(',')[1];

                      // A. NOTIFY FACTORY MANAGER (Standard Flow)
                      if (nextStatus === ExitPermitStatus.PENDING_FACTORY) {
                          const caption = `🏭 *مجوز خروج تایید شد${suffix} (جهت اقدام)*\n🔹 شماره: ${updatedPermitMock.permitNumber}\n👤 گیرنده: ${updatedPermitMock.recipientName || 'چند مقصد'}\n✍️ تایید کننده: ${currentUser.fullName}\n\nلطفا نسبت به خروج بار اقدام نمایید.`;
                          
                          // 1. Send to Factory Manager User
                          const users = await getUsers();
                          const targetUser = users.find(u => u.role === UserRole.FACTORY_MANAGER && u.phoneNumber);
                          if (targetUser) {
                              await apiCall('/send-whatsapp', 'POST', { number: targetUser.phoneNumber, message: caption, mediaData: { data: base64, mimeType: 'image/png', filename: `Permit_${updatedPermitMock.permitNumber}.png` } });
                          }

                          // 2. Send to Exit Notification Group (Warehouse/Security) - NEW FEATURE
                          if (settings?.exitPermitNotificationGroup) {
                              await apiCall('/send-whatsapp', 'POST', { 
                                  number: settings.exitPermitNotificationGroup, 
                                  message: caption, 
                                  mediaData: { data: base64, mimeType: 'image/png', filename: `Permit_${updatedPermitMock.permitNumber}_WH.png` } 
                              });
                          }
                      } 
                      // B. NOTIFY CEO (Completion)
                      else if (nextStatus === ExitPermitStatus.EXITED) {
                          const caption = `✅ *بار از کارخانه خارج شد (بایگانی)*\n🔹 شماره: ${updatedPermitMock.permitNumber}\n👤 گیرنده: ${updatedPermitMock.recipientName || 'چند مقصد'}\n🏭 تایید خروج: ${currentUser.fullName}\n\nفرآیند این مجوز تکمیل شد.`;
                          const users = await getUsers();
                          const targetUser = users.find(u => u.role === UserRole.CEO && u.phoneNumber);
                          if (targetUser) {
                              await apiCall('/send-whatsapp', 'POST', { number: targetUser.phoneNumber, message: caption, mediaData: { data: base64, mimeType: 'image/png', filename: `Permit_${updatedPermitMock.permitNumber}.png` } });
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
          await updateExitPermitStatus(id, ExitPermitStatus.REJECTED, currentUser, reason);
          loadData();
          setViewPermit(null);
      }
  };

  const handleDelete = async (id: string) => { if(confirm('حذف شود؟')) { await deleteExitPermit(id); loadData(); } };

  const handleEditSave = () => {
      setEditingPermit(null);
      loadData();
  };

  const getSearchString = (p: ExitPermit) => {
      const legacyGoods = p.goodsName || '';
      const itemsGoods = p.items?.map(i => i.goodsName).join(' ') || '';
      const legacyRec = p.recipientName || '';
      const destsRec = p.destinations?.map(d => d.recipientName).join(' ') || '';
      return `${p.permitNumber} ${legacyGoods} ${itemsGoods} ${legacyRec} ${destsRec}`;
  };

  const filtered = permits.filter(p => {
      // 1. Filter by Tab
      if (activeTab === 'current') {
          if (p.status === ExitPermitStatus.EXITED || p.status === ExitPermitStatus.REJECTED) return false;
      } else {
          if (p.status !== ExitPermitStatus.EXITED && p.status !== ExitPermitStatus.REJECTED) return false;
      }

      // 2. Status Filter (from Dashboard)
      if (activeStatusFilter === 'pending') {
          if (p.status !== ExitPermitStatus.PENDING_CEO && p.status !== ExitPermitStatus.PENDING_FACTORY) return false;
      }

      // 3. Filter by Search
      return getSearchString(p).includes(searchTerm);
  });

  const getStatusBadge = (status: ExitPermitStatus) => {
      switch(status) {
          case ExitPermitStatus.PENDING_CEO: return <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">منتظر مدیرعامل</span>;
          case ExitPermitStatus.PENDING_FACTORY: return <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">منتظر خروج (کارخانه)</span>;
          case ExitPermitStatus.EXITED: return <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">خارج شده</span>;
          case ExitPermitStatus.REJECTED: return <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs">رد شده</span>;
      }
  };

  const renderGoodsSummary = (p: ExitPermit) => {
      if (p.items && p.items.length > 0) {
          if (p.items.length === 1) return <span className="font-bold">{p.items[0].goodsName}</span>;
          return <span className="font-bold" title={p.items.map(i=>i.goodsName).join(', ')}>{p.items.length} قلم کالا ({p.items[0].goodsName}...)</span>;
      }
      return <span className="font-bold">{p.goodsName}</span>; 
  };

  const renderRecipientSummary = (p: ExitPermit) => {
      if (p.destinations && p.destinations.length > 0) {
          if (p.destinations.length === 1) return p.destinations[0].recipientName;
          return <span title={p.destinations.map(d=>d.recipientName).join(', ')}>{p.destinations.length} مقصد ({p.destinations[0].recipientName}...)</span>;
      }
      return p.recipientName; 
  };

  const renderStats = (p: ExitPermit) => {
      let cartons = p.cartonCount || 0;
      let weight = p.weight || 0;
      if (p.items && p.items.length > 0) {
          cartons = p.items.reduce((acc, i) => acc + (Number(i.cartonCount)||0), 0);
          weight = p.items.reduce((acc, i) => acc + (Number(i.weight)||0), 0);
      }
      return `${cartons} کارتن (${weight} KG)`;
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in relative">
        {/* Hidden Render for Auto Send - Add class hidden-print-export */}
        {permitForAutoSend && (
            <div className="hidden-print-export" style={{position: 'absolute', top: '-9999px', left: '-9999px', width: '800px'}}>
                <PrintExitPermit permit={permitForAutoSend} onClose={()=>{}} embed settings={settings} />
            </div>
        )}

        <div className="p-6 border-b flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Truck size={24} className="text-orange-600"/> کارتابل خروج بار</h2>
            
            <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                {activeStatusFilter && <div className="bg-orange-100 text-orange-800 px-3 py-2 rounded-lg text-sm flex items-center gap-2"><span>فیلتر: در انتظار تایید</span><button onClick={() => setActiveStatusFilter(null)}><X size={14}/></button></div>}
                
                <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button onClick={() => { setActiveTab('current'); setActiveStatusFilter(null); }} className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'current' ? 'bg-white shadow text-orange-600' : 'text-gray-500 hover:text-gray-700'}`}>
                        <ListChecks size={18} /> کارتابل جاری
                    </button>
                    {permissions.canViewExitArchive !== false && (
                        <button onClick={() => { setActiveTab('archive'); setActiveStatusFilter(null); }} className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'archive' ? 'bg-white shadow text-green-600' : 'text-gray-500 hover:text-gray-700'}`}>
                            <Archive size={18} /> بایگانی
                        </button>
                    )}
                </div>
                
                <div className="relative w-full md:w-64">
                    <Search className="absolute right-3 top-2.5 text-gray-400" size={18}/>
                    <input className="w-full pl-4 pr-10 py-2 border rounded-xl text-sm" placeholder="جستجو (شماره، کالا...)" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
                </div>
            </div>
        </div>
        
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
                <thead className="bg-gray-5 text-gray-600"><tr><th className="p-4">شماره</th><th className="p-4">تاریخ</th><th className="p-4">کالا</th><th className="p-4">گیرنده</th><th className="p-4">تعداد/وزن</th><th className="p-4">وضعیت</th><th className="p-4 text-center">عملیات</th></tr></thead>
                <tbody>
                    {filtered.length === 0 ? (
                        <tr><td colSpan={7} className="p-8 text-center text-gray-400">موردی یافت نشد.</td></tr>
                    ) : (
                        filtered.map(p => (
                            <tr key={p.id} className="border-b hover:bg-gray-50">
                                <td className="p-4 font-bold text-orange-600">#{p.permitNumber}</td>
                                <td className="p-4">{formatDate(p.date)}</td>
                                <td className="p-4">{renderGoodsSummary(p)}</td>
                                <td className="p-4">{renderRecipientSummary(p)}</td>
                                <td className="p-4">{renderStats(p)}</td>
                                <td className="p-4">{getStatusBadge(p.status)}</td>
                                <td className="p-4 text-center flex justify-center gap-2">
                                    <button onClick={() => setViewPermit(p)} className="bg-blue-100 text-blue-600 p-2 rounded-lg hover:bg-blue-200" title="مشاهده"><Eye size={16}/></button>
                                    
                                    {canEdit(p) && (
                                        <button onClick={() => setEditingPermit(p)} className="bg-amber-100 text-amber-600 p-2 rounded-lg hover:bg-amber-200" title="ویرایش">
                                            <Edit size={16}/>
                                        </button>
                                    )}

                                    {(currentUser.role === UserRole.ADMIN || (activeTab === 'current' && p.status === ExitPermitStatus.PENDING_CEO && p.requester === currentUser.fullName)) && <button onClick={() => handleDelete(p.id)} className="bg-red-100 text-red-600 p-2 rounded-lg hover:bg-red-200"><Trash2 size={16}/></button>}
                                    
                                    {canApprove(p) && <button onClick={() => handleApprove(p.id, p.status)} className="bg-green-100 text-green-600 p-2 rounded-lg hover:bg-green-200" title="تایید سریع"><CheckCircle size={16}/></button>}
                                </td>
                            </tr>
                        ))
                    )}
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

        {editingPermit && (
            <EditExitPermitModal
                permit={editingPermit}
                onClose={() => setEditingPermit(null)}
                onSave={handleEditSave}
            />
        )}
    </div>
  );
};

export default ManageExitPermits;