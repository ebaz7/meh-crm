
import React, { useState, useEffect } from 'react';
import { PaymentOrder, OrderStatus, User, UserRole, SystemSettings, PaymentMethod } from '../types';
import { updateOrderStatus, deleteOrder } from '../services/storageService';
import { getRolePermissions } from '../services/authService';
import { formatCurrency, formatDate, getStatusLabel, jalaliToGregorian, formatNumberString, deformatNumberString } from '../constants';
import { Eye, Trash2, Search, Filter, FileSpreadsheet, Paperclip, ListChecks, Archive, X, Building2, Calculator } from 'lucide-react';
import PrintVoucher from './PrintVoucher';
import EditOrderModal from './EditOrderModal';
import { apiCall } from '../services/apiService';

interface ManageOrdersProps {
  orders: PaymentOrder[];
  refreshData: () => void;
  currentUser: User;
  initialTab?: 'current' | 'archive';
  settings?: SystemSettings;
  statusFilter?: OrderStatus | 'pending_all' | null;
}

const ManageOrders: React.FC<ManageOrdersProps> = ({ orders, refreshData, currentUser, initialTab = 'current', settings, statusFilter }) => {
  const [activeTab, setActiveTab] = useState<'current' | 'archive'>(initialTab);
  const [viewOrder, setViewOrder] = useState<PaymentOrder | null>(null); 
  const [editingOrder, setEditingOrder] = useState<PaymentOrder | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [showFilters, setShowFilters] = useState(false);
  const [amountRange, setAmountRange] = useState({ min: '', max: '' });
  const [dateRange, setDateRange] = useState({
      from: { year: 1402, month: 1, day: 1 },
      to: { year: 1405, month: 12, day: 29 },
      enabled: false
  });
  const [companyFilter, setCompanyFilter] = useState(''); // NEW: Company Filter
  
  const [currentStatusFilter, setCurrentStatusFilter] = useState<OrderStatus | 'pending_all' | null>(statusFilter || null);

  useEffect(() => {
      setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
      if (statusFilter) {
          setCurrentStatusFilter(statusFilter);
          if (statusFilter === OrderStatus.APPROVED_CEO) {
              setActiveTab('archive');
          } else {
              setActiveTab('current');
          }
      }
  }, [statusFilter]);

  const permissions = getRolePermissions(currentUser.role, settings || null);
  const availableCompanies = settings?.companies?.map(c => c.name) || settings?.companyNames || [];

  const canApprove = (order: PaymentOrder): boolean => {
    if (order.status === OrderStatus.APPROVED_CEO) return false;
    if (order.status === OrderStatus.REJECTED) return false;

    if (order.status === OrderStatus.PENDING && permissions.canApproveFinancial) return true;
    if (order.status === OrderStatus.APPROVED_FINANCE && permissions.canApproveManager) return true;
    if (order.status === OrderStatus.APPROVED_MANAGER && permissions.canApproveCeo) return true;
    
    return false;
  };

  const canEdit = (order: PaymentOrder): boolean => {
      if (order.status === OrderStatus.APPROVED_CEO && currentUser.role !== UserRole.ADMIN) return false;
      if (currentUser.role === UserRole.ADMIN) return true;
      if (currentUser.role === UserRole.USER) {
          return permissions.canEditOwn && order.requester === currentUser.fullName && (order.status === OrderStatus.PENDING || order.status === OrderStatus.REJECTED);
      }
      if (permissions.canEditAll) return true;
      if (permissions.canEditOwn && order.requester === currentUser.fullName && (order.status === OrderStatus.PENDING || order.status === OrderStatus.REJECTED)) return true;
      return false;
  };

  const canDelete = (order: PaymentOrder): boolean => {
      if (currentUser.role === UserRole.ADMIN) return true;
      if (order.status === OrderStatus.APPROVED_CEO) return false;
      if (currentUser.role === UserRole.USER) {
          return permissions.canDeleteOwn && order.requester === currentUser.fullName && (order.status === OrderStatus.PENDING || order.status === OrderStatus.REJECTED);
      }
      if (permissions.canDeleteAll) return true;
      if (permissions.canDeleteOwn && order.requester === currentUser.fullName && (order.status === OrderStatus.PENDING || order.status === OrderStatus.REJECTED)) return true;
      return false;
  };

  const getNextStatus = (current: OrderStatus): OrderStatus => {
      if (current === OrderStatus.PENDING) return OrderStatus.APPROVED_FINANCE;
      if (current === OrderStatus.APPROVED_FINANCE) return OrderStatus.APPROVED_MANAGER;
      if (current === OrderStatus.APPROVED_MANAGER) return OrderStatus.APPROVED_CEO;
      return current;
  };

  const handleApprove = async (id: string, currentStatus: OrderStatus) => {
    const nextStatus = getNextStatus(currentStatus);
    if (window.confirm(`آیا تایید مرحله "${getStatusLabel(nextStatus)}" را انجام می‌دهید؟`)) {
        await updateOrderStatus(id, nextStatus, currentUser); 
        refreshData();
        setViewOrder(null); 
    }
  };

  const handleReject = async (id: string) => {
      const reason = window.prompt('لطفا دلیل رد درخواست را وارد کنید:');
      if (reason !== null) {
          await updateOrderStatus(id, OrderStatus.REJECTED, currentUser, reason || 'بدون توضیح');
          refreshData();
          setViewOrder(null); 
      }
  };

  // NEW: Handle Revoke (Reset to Pending)
  const handleRevoke = async (id: string) => {
      if (window.confirm('آیا از ابطال وضعیت رد شده و ارسال مجدد به چرخه تایید (مدیر مالی) اطمینان دارید؟')) {
          // Manually reset fields to restart workflow
          const resetUpdates = {
              status: OrderStatus.PENDING,
              approverFinancial: null,
              approverManager: null,
              approverCeo: null,
              rejectionReason: null,
              rejectedBy: null,
              updatedAt: Date.now()
          };
          
          try {
              // Using direct apiCall to ensure fields are nulled out properly as updateOrderStatus implies forward progression
              await apiCall(`/orders/${id}`, 'PUT', resetUpdates);
              refreshData();
              setViewOrder(null);
              alert('دستور پرداخت با موفقیت به چرخه تایید بازگشت.');
          } catch (e) {
              alert('خطا در عملیات ابطال.');
          }
      }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('آیا از حذف این دستور پرداخت اطمینان دارید؟ این عملیات غیرقابل بازگشت است.')) {
      await deleteOrder(id);
      refreshData();
    }
  };

  const handleEdit = (order: PaymentOrder) => {
      setEditingOrder(order);
      setViewOrder(null);
  };

  const handleExportCSV = () => {
      if (filteredOrders.length === 0) {
          alert("هیچ سفارشی موجود نیست.");
          return;
      }
      const headers = ["شماره دستور", "تاریخ", "گیرنده", "مبلغ", "شرکت پرداخت کننده", "بانک/روش", "شرح", "وضعیت", "درخواست کننده"];
      const rows = filteredOrders.map(o => {
          const banks = o.paymentDetails.map(d => d.bankName || d.method).join(', ');
          return [o.trackingNumber, formatDate(o.date), o.payee, o.totalAmount, o.payingCompany || '-', banks, o.description, getStatusLabel(o.status), o.requester];
      });
      const csvContent = [headers.join(','), ...rows.map(r => r.map(f => `"${String(f).replace(/"/g, '""')}"`).join(','))].join('\n');
      const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `export_${activeTab}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const parseISODate = (iso: string) => new Date(iso);
  const getFilterDate = (d: {year: number, month: number, day: number}) => {
      return jalaliToGregorian(d.year, d.month, d.day);
  };

  const getOrdersForTab = () => {
      let tabOrders = orders;
      if (activeTab === 'archive') {
          tabOrders = orders.filter(o => o.status === OrderStatus.APPROVED_CEO);
      } else {
          tabOrders = orders.filter(o => o.status !== OrderStatus.APPROVED_CEO);
      }

      if (!permissions.canViewAll) {
          return tabOrders.filter(o => o.requester === currentUser.fullName);
      }
      return tabOrders;
  };

  const filteredOrders = getOrdersForTab().filter(order => {
    if (currentStatusFilter) {
        if (currentStatusFilter === 'pending_all') {
            if (order.status === OrderStatus.APPROVED_CEO || order.status === OrderStatus.REJECTED) return false;
        } else {
            if (order.status !== currentStatusFilter) return false;
        }
    }
    
    // NEW: Company Filter
    if (companyFilter && order.payingCompany !== companyFilter) return false;

    const term = searchTerm.toLowerCase();
    if (!order.payee.toLowerCase().includes(term) && !order.description.toLowerCase().includes(term) && !order.trackingNumber.toString().includes(term)) return false;
    if (amountRange.min && order.totalAmount < deformatNumberString(amountRange.min)) return false;
    if (amountRange.max && order.totalAmount > deformatNumberString(amountRange.max)) return false;
    if (dateRange.enabled) {
        const orderDate = parseISODate(order.date);
        const fromDate = getFilterDate(dateRange.from);
        const toDate = getFilterDate(dateRange.to);
        orderDate.setHours(0,0,0,0);
        fromDate.setHours(0,0,0,0);
        toDate.setHours(23,59,59,999);
        if (orderDate < fromDate || orderDate > toDate) return false;
    }
    return true;
  });

  const totalFilteredAmount = filteredOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const totalFilteredCount = filteredOrders.length;

  const canExport = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGER;
  const years = Array.from({ length: 11 }, (_, i) => 1400 + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in">
        <div className="p-4 md:p-6 border-b border-gray-100 flex flex-col gap-4">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div className="flex bg-gray-100 p-1 rounded-lg w-full lg:w-auto">
                    <button onClick={() => { setActiveTab('current'); setCurrentStatusFilter(null); }} className={`flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'current' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}><ListChecks size={18} /> کارتابل جاری</button>
                    <button onClick={() => { setActiveTab('archive'); setCurrentStatusFilter(null); }} className={`flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'archive' ? 'bg-white shadow text-green-600' : 'text-gray-500 hover:text-gray-700'}`}><Archive size={18} /> بایگانی نهایی</button>
                </div>
                <div className="flex flex-col md:flex-row items-center gap-3 w-full lg:w-auto">
                    {currentStatusFilter && <div className="bg-amber-100 text-amber-700 px-3 py-2 rounded-lg text-xs flex items-center justify-between w-full md:w-auto gap-2"><span>فیلتر: {currentStatusFilter === 'pending_all' ? 'همه' : getStatusLabel(currentStatusFilter)}</span><button onClick={() => setCurrentStatusFilter(null)}><X size={14}/></button></div>}
                    <div className="relative w-full md:w-64"><Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} /><input type="text" placeholder="جستجو..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-4 pr-10 py-2.5 border rounded-xl text-sm outline-none"/></div>
                    <div className="flex gap-2 w-full md:w-auto">
                        <button onClick={() => setShowFilters(!showFilters)} className={`flex-1 md:flex-none p-2.5 rounded-xl border flex items-center justify-center ${showFilters ? 'bg-blue-50 text-blue-600' : 'bg-white'}`}><Filter size={20}/></button>
                        {canExport && <button onClick={handleExportCSV} className="flex-1 md:flex-none bg-green-600 text-white p-2.5 rounded-xl flex items-center justify-center"><FileSpreadsheet size={20}/></button>}
                    </div>
                </div>
            </div>
            
            {showFilters && (
                <div className="bg-gray-50 rounded-xl p-4 border grid grid-cols-1 md:grid-cols-3 gap-6 text-sm animate-fade-in">
                    <div>
                        <label className="block font-bold mb-2 flex items-center gap-2"><Building2 size={16}/> شرکت پرداخت کننده (محل پرداخت):</label>
                        <select className="w-full border rounded p-2 bg-white" value={companyFilter} onChange={e => setCompanyFilter(e.target.value)}>
                            <option value="">-- همه شرکت‌ها --</option>
                            {availableCompanies.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block font-bold mb-2">مبلغ (ریال):</label>
                        <div className="flex gap-2">
                            <input placeholder="از..." className="w-full border rounded p-2 dir-ltr" value={formatNumberString(amountRange.min)} onChange={e=>setAmountRange({...amountRange, min:deformatNumberString(e.target.value).toString()})}/>
                            <span className="self-center">تا</span>
                            <input placeholder="تا..." className="w-full border rounded p-2 dir-ltr" value={formatNumberString(amountRange.max)} onChange={e=>setAmountRange({...amountRange, max:deformatNumberString(e.target.value).toString()})}/>
                        </div>
                    </div>
                    <div>
                         <div className="flex justify-between items-center mb-2"><label className="font-bold text-gray-700">محدوده تاریخ (شمسی):</label><div className="flex items-center gap-2"><input type="checkbox" id="enableDate" checked={dateRange.enabled} onChange={e => setDateRange({...dateRange, enabled: e.target.checked})}/><label htmlFor="enableDate" className="text-xs text-gray-500 cursor-pointer">فعال‌سازی</label></div></div>
                         <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${!dateRange.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                             <div><span className="text-xs text-gray-500 block mb-1">از تاریخ:</span><div className="flex gap-1"><select className="border rounded px-1 py-1 w-full text-xs" value={dateRange.from.year} onChange={e => setDateRange({...dateRange, from: {...dateRange.from, year: Number(e.target.value)}})}>{years.map(y => <option key={y} value={y}>{y}</option>)}</select><select className="border rounded px-1 py-1 w-full text-xs" value={dateRange.from.month} onChange={e => setDateRange({...dateRange, from: {...dateRange.from, month: Number(e.target.value)}})}>{months.map(m => <option key={m} value={m}>{m}</option>)}</select><select className="border rounded px-1 py-1 w-full text-xs" value={dateRange.from.day} onChange={e => setDateRange({...dateRange, from: {...dateRange.from, day: Number(e.target.value)}})}>{days.map(d => <option key={d} value={d}>{d}</option>)}</select></div></div>
                             <div><span className="text-xs text-gray-500 block mb-1">تا تاریخ:</span><div className="flex gap-1"><select className="border rounded px-1 py-1 w-full text-xs" value={dateRange.to.year} onChange={e => setDateRange({...dateRange, to: {...dateRange.to, year: Number(e.target.value)}})}>{years.map(y => <option key={y} value={y}>{y}</option>)}</select><select className="border rounded px-1 py-1 w-full text-xs" value={dateRange.to.month} onChange={e => setDateRange({...dateRange, to: {...dateRange.to, month: Number(e.target.value)}})}>{months.map(m => <option key={m} value={m}>{m}</option>)}</select><select className="border rounded px-1 py-1 w-full text-xs" value={dateRange.to.day} onChange={e => setDateRange({...dateRange, to: {...dateRange.to, day: Number(e.target.value)}})}>{days.map(d => <option key={d} value={d}>{d}</option>)}</select></div></div>
                         </div>
                    </div>
                </div>
            )}
        </div>

        {/* Summary Bar */}
        <div className="bg-blue-50 border-b border-blue-100 p-3 flex flex-wrap justify-between items-center text-sm px-6">
            <div className="flex items-center gap-2 text-blue-800 font-bold">
                <Calculator size={18}/>
                <span>خلاصه گزارش فیلتر شده:</span>
            </div>
            <div className="flex gap-6">
                <div className="bg-white px-3 py-1 rounded-lg border border-blue-200">
                    <span className="text-gray-500 text-xs ml-2">تعداد کل:</span>
                    <span className="font-mono font-bold text-blue-700">{totalFilteredCount}</span>
                </div>
                <div className="bg-white px-3 py-1 rounded-lg border border-blue-200">
                    <span className="text-gray-500 text-xs ml-2">مجموع مبلغ:</span>
                    <span className="font-mono font-bold text-blue-700 text-lg">{formatCurrency(totalFilteredAmount)}</span>
                </div>
            </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right min-w-[800px]">
            <thead className="bg-gray-50 text-gray-600 font-medium">
              <tr>
                <th className="px-6 py-4">ش. دستور</th>
                <th className="px-6 py-4">تاریخ</th>
                <th className="px-6 py-4">گیرنده / شرح</th>
                <th className="px-6 py-4">شرکت پرداخت کننده</th>
                <th className="px-6 py-4">بانک / روش</th>
                <th className="px-6 py-4">مبلغ کل</th>
                <th className="px-6 py-4">وضعیت</th>
                <th className="px-6 py-4 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredOrders.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-8 text-gray-400">موردی یافت نشد</td></tr>
              ) : (
                  filteredOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="px-6 py-4 font-mono text-gray-500">#{order.trackingNumber}</td>
                        <td className="px-6 py-4 text-gray-700">{formatDate(order.date)}</td>
                        <td className="px-6 py-4 font-medium text-gray-900 max-w-[200px]"><div className="truncate font-bold">{order.payee}</div><div className="text-xs text-gray-500 truncate mt-1">{order.description}</div><div className="flex gap-1 mt-1">{order.attachments?.map((a,i) => <a key={i} href={a.data} target="_blank" className="text-blue-500 text-[10px] bg-blue-50 px-1 rounded flex items-center"><Paperclip size={10}/></a>)}</div></td>
                        <td className="px-6 py-4 text-xs font-bold text-gray-700">{order.payingCompany || '-'}</td>
                        <td className="px-6 py-4 text-xs text-gray-600">
                            {order.paymentDetails.map((d, i) => (
                                <div key={i} className="truncate max-w-[120px]" title={d.bankName || d.method}>
                                    {d.bankName ? d.bankName : d.method === PaymentMethod.CASH ? 'صندوق' : d.method}
                                </div>
                            ))}
                        </td>
                        <td className="px-6 py-4 font-bold text-gray-900">{formatCurrency(order.totalAmount)}</td>
                        <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${order.status === OrderStatus.APPROVED_CEO ? 'bg-green-50 text-green-700 border-green-200' : order.status === OrderStatus.REJECTED ? 'bg-red-50 text-red-700 border-red-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>{getStatusLabel(order.status)}</span>
                            {order.status === OrderStatus.REJECTED && order.rejectionReason && (
                                <div className="text-[10px] text-red-500 mt-1 max-w-[140px] truncate" title={order.rejectionReason}>دلیل: {order.rejectionReason}</div>
                            )}
                        </td>
                        <td className="px-6 py-4"><div className="flex justify-center items-center gap-2">
                             <button 
                                onClick={() => setViewOrder(order)} 
                                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs transition-colors shadow-sm"
                             >
                                <Eye size={16}/> مشاهده
                             </button>
                             {canDelete(order) && <button onClick={() => handleDelete(order.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors" title="حذف"><Trash2 size={16}/></button>}
                        </div></td>
                      </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {viewOrder && (
          <PrintVoucher 
            order={viewOrder} 
            onClose={() => setViewOrder(null)} 
            settings={settings}
            onApprove={canApprove(viewOrder) ? () => handleApprove(viewOrder.id, viewOrder.status) : undefined}
            onReject={canApprove(viewOrder) ? () => handleReject(viewOrder.id) : undefined}
            onEdit={canEdit(viewOrder) ? () => handleEdit(viewOrder) : undefined}
            onRevoke={viewOrder.status === OrderStatus.REJECTED && (canEdit(viewOrder) || currentUser.role === UserRole.ADMIN) ? () => handleRevoke(viewOrder.id) : undefined}
          />
      )}
      
      {editingOrder && <EditOrderModal order={editingOrder} onClose={() => setEditingOrder(null)} onSave={refreshData} />}
    </>
  );
};

export default ManageOrders;
