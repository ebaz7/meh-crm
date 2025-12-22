
import React, { useState, useEffect } from 'react';
import { PaymentOrder, OrderStatus, User, UserRole, SystemSettings, PaymentMethod } from '../types';
import { updateOrderStatus, deleteOrder, saveOrder, getOrders } from '../services/storageService';
import { getRolePermissions } from '../services/authService';
import { formatCurrency, formatDate, getStatusLabel } from '../constants';
import { Search, CheckCircle, XCircle, Trash2, Eye, Printer, Filter, Archive, Edit, AlertTriangle, FileDown, Ban } from 'lucide-react';
import EditOrderModal from './EditOrderModal';
import PrintVoucher from './PrintVoucher';

interface ManageOrdersProps {
  orders: PaymentOrder[];
  refreshData: () => void;
  currentUser: User;
  initialTab?: 'current' | 'archive';
  settings?: SystemSettings;
  statusFilter?: OrderStatus | 'pending_all' | null;
}

const ManageOrders: React.FC<ManageOrdersProps> = ({ orders, refreshData, currentUser, initialTab = 'current', settings, statusFilter }) => {
  const [selectedOrder, setSelectedOrder] = useState<PaymentOrder | null>(null);
  const [editingOrder, setEditingOrder] = useState<PaymentOrder | null>(null);
  const [activeTab, setActiveTab] = useState<'current' | 'archive'>(initialTab);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<OrderStatus | 'all'>('all');
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
      if (initialTab) setActiveTab(initialTab);
      if (statusFilter) {
          if (statusFilter === 'pending_all') {
              // Special filter for dashboard action card
              setFilterStatus('all'); // Logic handled in render filtering
          } else {
              setFilterStatus(statusFilter);
          }
      }
  }, [initialTab, statusFilter]);

  const permissions = settings ? getRolePermissions(currentUser.role, settings, currentUser) : null;

  const canApprove = (order: PaymentOrder) => {
      // Normal Flow
      if (order.status === OrderStatus.PENDING && permissions?.canApproveFinancial) return true;
      if (order.status === OrderStatus.APPROVED_FINANCE && permissions?.canApproveManager) return true;
      if (order.status === OrderStatus.APPROVED_MANAGER && permissions?.canApproveCeo) return true;
      
      // Void Flow
      if (order.status === OrderStatus.PENDING_VOID_FINANCE && permissions?.canApproveFinancial) return true;
      if (order.status === OrderStatus.PENDING_VOID_MANAGER && permissions?.canApproveManager) return true;
      if (order.status === OrderStatus.PENDING_VOID_CEO && permissions?.canApproveCeo) return true;

      return false;
  };

  const handleApprove = async (order: PaymentOrder) => {
      // Determine Next Status based on Current Status
      let nextStatus: OrderStatus | null = null;
      let confirmMsg = 'آیا از تایید این دستور پرداخت اطمینان دارید؟';

      // Normal Approval
      if (order.status === OrderStatus.PENDING) nextStatus = OrderStatus.APPROVED_FINANCE;
      else if (order.status === OrderStatus.APPROVED_FINANCE) nextStatus = OrderStatus.APPROVED_MANAGER;
      else if (order.status === OrderStatus.APPROVED_MANAGER) nextStatus = OrderStatus.APPROVED_CEO;
      
      // Void Approval (Cancellation Workflow)
      else if (order.status === OrderStatus.PENDING_VOID_FINANCE) { nextStatus = OrderStatus.PENDING_VOID_MANAGER; confirmMsg = 'آیا تایید ابطال (مرحله مالی) را انجام می‌دهید؟'; }
      else if (order.status === OrderStatus.PENDING_VOID_MANAGER) { nextStatus = OrderStatus.PENDING_VOID_CEO; confirmMsg = 'آیا تایید ابطال (مرحله مدیریت) را انجام می‌دهید؟'; }
      else if (order.status === OrderStatus.PENDING_VOID_CEO) { nextStatus = OrderStatus.VOIDED; confirmMsg = 'آیا ابطال نهایی این دستور را تایید می‌کنید؟ (این عملیات غیرقابل بازگشت است)'; }

      if (nextStatus && window.confirm(confirmMsg)) {
          setProcessingId(order.id);
          await updateOrderStatus(order.id, nextStatus, currentUser);
          refreshData();
          setProcessingId(null);
      }
  };

  const handleReject = async (order: PaymentOrder) => {
      const reason = prompt('لطفا دلیل رد کردن را وارد کنید:');
      if (reason) {
          setProcessingId(order.id);
          await updateOrderStatus(order.id, OrderStatus.REJECTED, currentUser, reason);
          refreshData();
          setProcessingId(null);
      }
  };

  const handleVoidRequest = async (order: PaymentOrder) => {
      if (window.confirm('آیا از درخواست ابطال این دستور اطمینان دارید؟ (این درخواست مجدداً تمام مراحل تایید را طی خواهد کرد)')) {
          setProcessingId(order.id);
          await updateOrderStatus(order.id, OrderStatus.PENDING_VOID_FINANCE, currentUser);
          refreshData();
          setProcessingId(null);
      }
  };

  const handleDelete = async (id: string) => {
      if (window.confirm('آیا از حذف این مورد اطمینان دارید؟')) {
          setProcessingId(id);
          await deleteOrder(id);
          refreshData();
          setProcessingId(null);
      }
  };

  const filteredOrders = orders.filter(order => {
      // 1. Search
      const searchMatch = 
          order.payee.includes(searchTerm) || 
          order.trackingNumber.toString().includes(searchTerm) ||
          order.description?.includes(searchTerm) ||
          (order.payingCompany && order.payingCompany.includes(searchTerm));
      if (!searchMatch) return false;

      // 2. Tab Filter
      // Archive includes APPROVED_CEO and VOIDED
      const isArchivedStatus = order.status === OrderStatus.APPROVED_CEO || order.status === OrderStatus.VOIDED;
      if (activeTab === 'current' && isArchivedStatus) return false;
      if (activeTab === 'archive' && !isArchivedStatus) return false;

      // 3. Status Dropdown Filter
      if (filterStatus !== 'all' && order.status !== filterStatus) return false;

      // 4. Permission Filter (View Own Only logic)
      if (permissions && !permissions.canViewAll && order.requester !== currentUser.fullName) return false;

      // 5. Special Dashboard Action Filter
      if (statusFilter === 'pending_all') {
          // Show only items this user can approve
          return canApprove(order);
      }

      return true;
  }).sort((a, b) => b.createdAt - a.createdAt);

  const getStatusColor = (status: OrderStatus) => {
      switch (status) {
          case OrderStatus.PENDING: return 'bg-amber-100 text-amber-800 border-amber-200';
          case OrderStatus.APPROVED_FINANCE: return 'bg-blue-100 text-blue-800 border-blue-200';
          case OrderStatus.APPROVED_MANAGER: return 'bg-indigo-100 text-indigo-800 border-indigo-200';
          case OrderStatus.APPROVED_CEO: return 'bg-green-100 text-green-800 border-green-200';
          case OrderStatus.REJECTED: return 'bg-red-100 text-red-800 border-red-200';
          // Void Colors
          case OrderStatus.PENDING_VOID_FINANCE: 
          case OrderStatus.PENDING_VOID_MANAGER: 
          case OrderStatus.PENDING_VOID_CEO: 
              return 'bg-gray-100 text-gray-800 border-gray-400 border-dashed animate-pulse';
          case OrderStatus.VOIDED: return 'bg-gray-200 text-gray-500 border-gray-300 line-through';
          default: return 'bg-gray-100 text-gray-800';
      }
  };

  const isVoidStatus = (s: OrderStatus) => 
      s === OrderStatus.PENDING_VOID_FINANCE || 
      s === OrderStatus.PENDING_VOID_MANAGER || 
      s === OrderStatus.PENDING_VOID_CEO;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 h-full flex flex-col animate-fade-in relative">
        {editingOrder && <EditOrderModal order={editingOrder} onClose={() => setEditingOrder(null)} onSave={refreshData} />}
        {selectedOrder && (
            <PrintVoucher 
                order={selectedOrder} 
                onClose={() => setSelectedOrder(null)} 
                settings={settings}
                onApprove={canApprove(selectedOrder) ? () => handleApprove(selectedOrder) : undefined}
                onReject={(selectedOrder.status !== OrderStatus.APPROVED_CEO && selectedOrder.status !== OrderStatus.VOIDED && selectedOrder.status !== OrderStatus.REJECTED && canApprove(selectedOrder)) ? () => handleReject(selectedOrder) : undefined}
                onEdit={(permissions?.canEditAll || (permissions?.canEditOwn && selectedOrder.requester === currentUser.fullName && !isVoidStatus(selectedOrder.status) && selectedOrder.status !== OrderStatus.APPROVED_CEO && selectedOrder.status !== OrderStatus.VOIDED)) ? () => { setEditingOrder(selectedOrder); setSelectedOrder(null); } : undefined}
            />
        )}

        {/* Header & Controls */}
        <div className="p-6 border-b border-gray-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gray-50/50">
            <div className="flex items-center gap-3">
                <div className="bg-blue-50 p-2 rounded-lg text-blue-600"><Archive size={24} /></div>
                <div><h2 className="text-xl font-bold text-gray-800">مدیریت دستور پرداخت‌ها</h2></div>
            </div>
            
            <div className="flex flex-wrap gap-3 w-full md:w-auto">
                {/* Tabs */}
                <div className="bg-gray-200 p-1 rounded-lg flex text-sm font-bold">
                    <button onClick={() => setActiveTab('current')} className={`px-4 py-2 rounded-md transition-all ${activeTab === 'current' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>جاری</button>
                    <button onClick={() => setActiveTab('archive')} className={`px-4 py-2 rounded-md transition-all ${activeTab === 'archive' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>بایگانی</button>
                </div>

                {/* Filter Status */}
                <div className="relative">
                    <select className="appearance-none bg-white border border-gray-300 text-gray-700 py-2 pl-3 pr-8 rounded-lg leading-tight focus:outline-none focus:bg-white focus:border-gray-500 text-sm h-full" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)}>
                        <option value="all">همه وضعیت‌ها</option>
                        {Object.values(OrderStatus).map(status => <option key={status} value={status}>{getStatusLabel(status)}</option>)}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700"><Filter size={14} /></div>
                </div>

                {/* Search */}
                <div className="relative flex-1 md:w-64">
                    <input type="text" placeholder="جستجو (شماره، ذینفع...)" className="w-full pl-4 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none"><Search size={16} className="text-gray-400" /></div>
                </div>
            </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
            <table className="w-full text-right text-sm">
                <thead className="bg-gray-100 text-gray-600 font-bold sticky top-0 z-10">
                    <tr>
                        <th className="p-4 border-b">شماره</th>
                        <th className="p-4 border-b">تاریخ</th>
                        <th className="p-4 border-b">ذینفع</th>
                        <th className="p-4 border-b">مبلغ (ریال)</th>
                        <th className="p-4 border-b">شرکت</th>
                        <th className="p-4 border-b">وضعیت</th>
                        <th className="p-4 border-b text-center">عملیات</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {filteredOrders.length === 0 ? (
                        <tr><td colSpan={7} className="p-8 text-center text-gray-400">هیچ موردی یافت نشد.</td></tr>
                    ) : (
                        filteredOrders.map((order) => (
                            <tr key={order.id} className="hover:bg-blue-50/30 transition-colors group">
                                <td className="p-4 font-mono font-bold text-blue-600">#{order.trackingNumber}</td>
                                <td className="p-4 font-mono text-gray-500 text-xs">{new Date(order.date).toLocaleDateString('fa-IR')}</td>
                                <td className="p-4 font-bold text-gray-800">{order.payee}</td>
                                <td className="p-4 font-mono font-bold">{formatCurrency(order.totalAmount).replace(' ریال', '')}</td>
                                <td className="p-4 text-xs text-gray-600">{order.payingCompany}</td>
                                <td className="p-4">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(order.status)}`}>
                                        {getStatusLabel(order.status)}
                                    </span>
                                </td>
                                <td className="p-4 text-center">
                                    <div className="flex items-center justify-center gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => setSelectedOrder(order)} className="p-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded transition-colors" title="مشاهده جزئیات"><Eye size={16} /></button>
                                        
                                        {/* VOID REQUEST BUTTON (For Requester/Admin if Rejected) */}
                                        {order.status === OrderStatus.REJECTED && (order.requester === currentUser.fullName || currentUser.role === UserRole.ADMIN) && (
                                            <button onClick={() => handleVoidRequest(order)} className="p-1.5 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded transition-colors" title="درخواست ابطال"><Ban size={16}/></button>
                                        )}

                                        {/* APPROVE BUTTON (Works for normal approval AND Void approval) */}
                                        {canApprove(order) && (
                                            <button onClick={() => handleApprove(order)} className={`p-1.5 rounded transition-colors ${isVoidStatus(order.status) ? 'text-red-600 bg-red-50 hover:bg-red-100 border border-red-200' : 'text-green-600 bg-green-50 hover:bg-green-100'}`} title={isVoidStatus(order.status) ? "تایید ابطال" : "تایید"}>
                                                {isVoidStatus(order.status) ? <XCircle size={16}/> : <CheckCircle size={16} />}
                                            </button>
                                        )}
                                        
                                        {/* EDIT BUTTON */}
                                        {((permissions?.canEditAll) || (permissions?.canEditOwn && order.requester === currentUser.fullName && !isVoidStatus(order.status) && order.status !== OrderStatus.APPROVED_CEO && order.status !== OrderStatus.VOIDED)) && (
                                            <button onClick={() => setEditingOrder(order)} className="p-1.5 text-amber-600 bg-amber-50 hover:bg-amber-100 rounded transition-colors" title="ویرایش"><Edit size={16} /></button>
                                        )}
                                        
                                        {/* DELETE BUTTON */}
                                        {permissions?.canDeleteAll && (
                                            <button onClick={() => handleDelete(order.id)} className="p-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded transition-colors" title="حذف"><Trash2 size={16} /></button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    </div>
  );
};

export default ManageOrders;
