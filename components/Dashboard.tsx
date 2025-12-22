
import React, { useState, useMemo, useEffect } from 'react';
import { PaymentOrder, OrderStatus, SystemSettings, User, ExitPermit, ExitPermitStatus, WarehouseTransaction, UserRole } from '../types';
import { formatCurrency, getShamsiDateFromIso } from '../constants';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { TrendingUp, Clock, CheckCircle, Activity, XCircle, Banknote, Calendar as CalendarIcon, ShieldCheck, ArrowUpRight, CheckSquare, Truck, Package, ListChecks } from 'lucide-react';
import { getRolePermissions } from '../services/authService';
import { getExitPermits, getWarehouseTransactions } from '../services/storageService';

interface DashboardProps {
  orders: PaymentOrder[];
  settings?: SystemSettings;
  currentUser: User;
  onViewArchive?: () => void;
  onFilterByStatus?: (status: OrderStatus | 'pending_all') => void;
  onGoToPaymentApprovals: () => void;
  onGoToExitApprovals: () => void;
  onGoToBijakApprovals: () => void;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];
const MONTHS = [ 'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند' ];

const Dashboard: React.FC<DashboardProps> = ({ orders, settings, currentUser, onViewArchive, onFilterByStatus, onGoToPaymentApprovals, onGoToExitApprovals, onGoToBijakApprovals }) => {
  const [showBankReport, setShowBankReport] = useState(false);
  const [bankReportTab, setBankReportTab] = useState<'summary' | 'timeline'>('summary');
  
  // Data for additional counts
  const [exitPermits, setExitPermits] = useState<ExitPermit[]>([]);
  const [warehouseTxs, setWarehouseTxs] = useState<WarehouseTransaction[]>([]);

  useEffect(() => {
      const fetchData = async () => {
          const [exits, txs] = await Promise.all([getExitPermits(), getWarehouseTransactions()]);
          setExitPermits(exits || []);
          setWarehouseTxs(txs || []);
      };
      fetchData();
  }, []);

  // Permission Check
  const permissions = settings ? getRolePermissions(currentUser.role, settings, currentUser) : { canViewPaymentOrders: false };
  const hasPaymentAccess = permissions.canViewPaymentOrders === true;

  // --- CALC PENDING COUNTS FOR ACTION CARDS ---
  
  // 1. Payment Pending Count (Based on user role)
  let pendingPaymentCount = 0;
  if (currentUser.role === UserRole.FINANCIAL || currentUser.role === UserRole.ADMIN) {
      pendingPaymentCount += orders.filter(o => o.status === OrderStatus.PENDING).length;
  }
  if (currentUser.role === UserRole.MANAGER || currentUser.role === UserRole.ADMIN) {
      pendingPaymentCount += orders.filter(o => o.status === OrderStatus.APPROVED_FINANCE).length;
  }
  if (currentUser.role === UserRole.CEO || currentUser.role === UserRole.ADMIN) {
      // CEO needs to approve normal flow AND void requests
      pendingPaymentCount += orders.filter(o => o.status === OrderStatus.APPROVED_MANAGER || o.status === OrderStatus.PENDING_CANCELLATION).length;
  }

  // 2. Exit Pending Count
  let pendingExitCount = 0;
  if (currentUser.role === UserRole.CEO || currentUser.role === UserRole.ADMIN) {
      pendingExitCount += exitPermits.filter(p => p.status === ExitPermitStatus.PENDING_CEO).length;
  }
  if (currentUser.role === UserRole.FACTORY_MANAGER || currentUser.role === UserRole.ADMIN) {
      pendingExitCount += exitPermits.filter(p => p.status === ExitPermitStatus.PENDING_FACTORY).length;
  }

  // 3. Bijak Pending Count
  let pendingBijakCount = 0;
  if (currentUser.role === UserRole.CEO || currentUser.role === UserRole.ADMIN) {
      pendingBijakCount += warehouseTxs.filter(t => t.type === 'OUT' && t.status === 'PENDING').length;
  }

  const showActionSection = pendingPaymentCount > 0 || pendingExitCount > 0 || pendingBijakCount > 0;

  // ... (Existing Charts logic) ...
  const completedOrders = orders.filter(o => o.status === OrderStatus.APPROVED_CEO || o.status === OrderStatus.VOIDED); // Include VOIDED in history count
  const totalAmount = completedOrders.filter(o => o.status === OrderStatus.APPROVED_CEO).reduce((sum, order) => sum + order.totalAmount, 0); // Sum only real approved ones
  const countPending = orders.filter(o => o.status === OrderStatus.PENDING).length;
  const countFin = orders.filter(o => o.status === OrderStatus.APPROVED_FINANCE).length;
  const countMgr = orders.filter(o => o.status === OrderStatus.APPROVED_MANAGER).length;
  const countRejected = orders.filter(o => o.status === OrderStatus.REJECTED).length;

  const activeCartable = hasPaymentAccess ? orders
    .filter(o => o.status !== OrderStatus.APPROVED_CEO && o.status !== OrderStatus.VOIDED && o.status !== OrderStatus.REJECTED)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 10) : [];

  const handleWidgetClick = (status: OrderStatus | 'pending_all') => {
      if (hasPaymentAccess && onFilterByStatus) {
          onFilterByStatus(status);
      }
  };

  const statusWidgets = [
    { key: OrderStatus.PENDING, label: 'کارتابل مالی', count: countPending, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', barColor: 'bg-amber-500' },
    { key: OrderStatus.APPROVED_FINANCE, label: 'کارتابل مدیریت', count: countFin, icon: Activity, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', barColor: 'bg-blue-500' },
    { key: OrderStatus.APPROVED_MANAGER, label: 'کارتابل مدیرعامل', count: countMgr, icon: ShieldCheck, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100', barColor: 'bg-indigo-500' },
    { key: OrderStatus.REJECTED, label: 'رد شده', count: countRejected, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100', barColor: 'bg-red-500' },
    { key: OrderStatus.APPROVED_CEO, label: 'بایگانی', count: completedOrders.length, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-100', barColor: 'bg-green-500' }
  ];

  const methodDataRaw: Record<string, number> = {};
  orders.forEach(order => { order.paymentDetails.forEach(detail => { methodDataRaw[detail.method] = (methodDataRaw[detail.method] || 0) + detail.amount; }); });
  const methodData = Object.keys(methodDataRaw).map(key => ({ name: key, amount: methodDataRaw[key] }));

  const bankStats = useMemo(() => {
    const stats: Record<string, number> = {};
    // Only approved orders for stats
    orders.filter(o => o.status === OrderStatus.APPROVED_CEO).forEach(order => { order.paymentDetails.forEach(detail => { if (detail.bankName && detail.bankName.trim() !== '') { const normalizedName = detail.bankName.trim(); stats[normalizedName] = (stats[normalizedName] || 0) + detail.amount; } }); });
    return Object.entries(stats).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [orders]);

  const bankTimeline = useMemo(() => {
      const groups: Record<string, { label: string, total: number, count: number, days: Record<string, { total: number, items: any[] }> }> = {};
      orders.filter(o => o.status === OrderStatus.APPROVED_CEO).forEach(order => {
          const dateParts = getShamsiDateFromIso(order.date);
          const monthKey = `${dateParts.year}/${String(dateParts.month).padStart(2, '0')}`;
          const monthLabel = `${MONTHS[dateParts.month - 1]} ${dateParts.year}`;
          if (!groups[monthKey]) { groups[monthKey] = { label: monthLabel, total: 0, count: 0, days: {} }; }
          order.paymentDetails.forEach(detail => {
              if (detail.bankName) {
                  const dayKey = String(dateParts.day).padStart(2, '0');
                  if (!groups[monthKey].days[dayKey]) { groups[monthKey].days[dayKey] = { total: 0, items: [] }; }
                  const amount = detail.amount;
                  groups[monthKey].total += amount;
                  groups[monthKey].count += 1;
                  groups[monthKey].days[dayKey].total += amount;
                  groups[monthKey].days[dayKey].items.push({ id: detail.id, bank: detail.bankName, payee: order.payee, amount: amount, desc: order.description, tracking: order.trackingNumber });
              }
          });
      });
      return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0])).map(([key, data]) => ({ key, ...data, days: Object.entries(data.days).sort((a, b) => Number(b[0]) - Number(a[0])).map(([day, dayData]) => ({ day, ...dayData })) }));
  }, [orders]);

  const topBank = bankStats.length > 0 ? bankStats[0] : { name: '-', value: 0 };
  const mostActiveMonth = bankTimeline.length > 0 ? bankTimeline[0] : { label: '-', total: 0 };

  return (
    <div className="space-y-6 pb-20 md:pb-0 animate-fade-in">
        
        {/* ACTIONABLE CARTABLE SECTION */}
        {showActionSection && (
            <div className="mb-8">
                <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2"><ListChecks className="text-blue-600"/> کارتابل و وظایف من</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {pendingPaymentCount > 0 && (
                        <div onClick={onGoToPaymentApprovals} className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg shadow-blue-200 cursor-pointer transform hover:scale-105 transition-all relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Banknote size={80}/></div>
                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="bg-white/20 p-3 rounded-xl"><CheckSquare size={24} className="text-white"/></div>
                                    <span className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full animate-pulse">{pendingPaymentCount} مورد</span>
                                </div>
                                <h3 className="text-2xl font-bold mb-1">تایید دستور پرداخت</h3>
                                <p className="text-blue-100 text-sm opacity-90">درخواست‌های منتظر تایید شما</p>
                            </div>
                        </div>
                    )}

                    {pendingExitCount > 0 && (
                        <div onClick={onGoToExitApprovals} className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-6 text-white shadow-lg shadow-orange-200 cursor-pointer transform hover:scale-105 transition-all relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Truck size={80}/></div>
                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="bg-white/20 p-3 rounded-xl"><ShieldCheck size={24} className="text-white"/></div>
                                    <span className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full animate-pulse">{pendingExitCount} مورد</span>
                                </div>
                                <h3 className="text-2xl font-bold mb-1">تایید مجوز خروج</h3>
                                <p className="text-orange-100 text-sm opacity-90">درخواست‌های خروج بار</p>
                            </div>
                        </div>
                    )}

                    {pendingBijakCount > 0 && (
                        <div onClick={onGoToBijakApprovals} className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg shadow-purple-200 cursor-pointer transform hover:scale-105 transition-all relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Package size={80}/></div>
                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="bg-white/20 p-3 rounded-xl"><Activity size={24} className="text-white"/></div>
                                    <span className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full animate-pulse">{pendingBijakCount} مورد</span>
                                </div>
                                <h3 className="text-2xl font-bold mb-1">تایید بیجک انبار</h3>
                                <p className="text-purple-100 text-sm opacity-90">حواله‌های صادر شده از انبار</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* Status Widgets (Overview) */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {statusWidgets.map((widget) => (
                <div key={widget.key} onClick={() => handleWidgetClick(widget.key === OrderStatus.APPROVED_CEO ? 'pending_all' : widget.key as any)} className={`bg-white p-4 rounded-2xl border ${widget.border} shadow-sm transition-all relative overflow-hidden group ${hasPaymentAccess ? 'cursor-pointer hover:shadow-md' : 'opacity-80 cursor-default'}`}>
                    <div className={`absolute top-0 right-0 w-1.5 h-full ${widget.barColor}`}></div>
                    <div className="flex justify-between items-start mb-2">
                        <div className={`p-2 rounded-xl ${widget.bg} ${widget.color}`}>
                            <widget.icon size={20} />
                        </div>
                        <span className="text-2xl font-black text-gray-800 font-mono">{widget.count}</span>
                    </div>
                    <h3 className="text-xs font-bold text-gray-500">{widget.label}</h3>
                </div>
            ))}
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col">
                <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2"><PieChart size={20} className="text-blue-500"/> توزیع روش‌های پرداخت</h3>
                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie data={methodData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="amount">
                                {methodData.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                            </Pie>
                            <Tooltip formatter={(value: number) => formatCurrency(value)} />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2"><BarChart size={20} className="text-indigo-500"/> پرداخت‌ها بر اساس بانک</h3>
                    {hasPaymentAccess && <button onClick={() => setShowBankReport(true)} className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg font-bold hover:bg-indigo-100 transition-colors">گزارش کامل</button>}
                </div>
                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={bankStats.slice(0, 5)}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" tick={{fontSize: 10}} />
                            <YAxis tick={{fontSize: 10}} tickFormatter={(value) => `${value/1000000}M`} />
                            <Tooltip formatter={(value: number) => formatCurrency(value)} cursor={{fill: '#f3f4f6'}} />
                            <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={40} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>

        {/* Active Cartable List */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <h3 className="font-bold text-gray-800 flex items-center gap-2"><Activity size={20} className="text-orange-500"/> آخرین فعالیت‌ها (پرداخت)</h3>
                {onViewArchive && hasPaymentAccess && <button onClick={onViewArchive} className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-700 font-bold bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">مشاهده آرشیو <ArrowUpRight size={14}/></button>}
            </div>
            
            {!hasPaymentAccess ? (
                <div className="p-8 text-center text-gray-400 text-sm flex flex-col items-center gap-2">
                    <ShieldCheck size={32} className="opacity-20"/>
                    دسترسی به جزئیات پرداخت محدود شده است.
                </div>
            ) : (
                <div className="divide-y divide-gray-100">
                    {activeCartable.length === 0 ? (
                        <div className="p-8 text-center text-gray-400 text-sm flex flex-col items-center gap-2">
                            <CheckCircle size={32} className="opacity-20"/>
                            موردی وجود ندارد.
                        </div>
                    ) : (
                        activeCartable.map(order => (
                            <div key={order.id} className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between group">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${order.status === OrderStatus.REJECTED ? 'bg-red-100 text-red-600' : order.status === OrderStatus.PENDING_CANCELLATION ? 'bg-gray-200 text-gray-600 animate-pulse' : 'bg-blue-100 text-blue-600'}`}>
                                        {order.trackingNumber % 100}
                                    </div>
                                    <div>
                                        <div className="font-bold text-gray-800 text-sm">{order.payee}</div>
                                        <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                                            <span>{new Date(order.date).toLocaleDateString('fa-IR')}</span>
                                            <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                            <span>{order.requester}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-bold text-gray-900 font-mono text-sm">{formatCurrency(order.totalAmount)}</div>
                                    <div className={`text-[10px] mt-1 px-2 py-0.5 rounded inline-block ${order.status === OrderStatus.PENDING ? 'bg-amber-100 text-amber-700' : order.status === OrderStatus.PENDING_CANCELLATION ? 'bg-gray-100 text-gray-800 border border-gray-300' : 'bg-blue-50 text-blue-600'}`}>
                                        {order.status === OrderStatus.PENDING_CANCELLATION ? 'در انتظار ابطال' : order.status}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>

        {/* Bank Report Modal (Existing) */}
        {showBankReport && hasPaymentAccess && (
            <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden">
                    <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2"><Banknote size={20}/> گزارش تفصیلی بانک‌ها</h3>
                        <button onClick={() => setShowBankReport(false)} className="p-1 hover:bg-gray-200 rounded-full transition-colors"><XCircle size={20} className="text-gray-500"/></button>
                    </div>
                    {/* ... (Keep existing bank report content) ... */}
                    <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
                        {bankReportTab === 'summary' ? (
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-white p-4 rounded-xl border border-indigo-100 shadow-sm flex items-center gap-4">
                                        <div className="bg-indigo-100 p-3 rounded-full text-indigo-600"><TrendingUp size={24}/></div>
                                        <div><div className="text-xs text-gray-500 font-bold">پر تراکنش‌ترین بانک</div><div className="text-lg font-black text-gray-800">{topBank.name}</div><div className="text-xs text-indigo-600 font-mono">{formatCurrency(topBank.value)}</div></div>
                                    </div>
                                    <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-sm flex items-center gap-4">
                                        <div className="bg-emerald-100 p-3 rounded-full text-emerald-600"><CalendarIcon size={24}/></div>
                                        <div><div className="text-xs text-gray-500 font-bold">ماه پرخرج</div><div className="text-lg font-black text-gray-800">{mostActiveMonth.label}</div><div className="text-xs text-emerald-600 font-mono">{formatCurrency(mostActiveMonth.total)}</div></div>
                                    </div>
                                </div>
                                <div className="bg-white rounded-xl border overflow-hidden">
                                    <table className="w-full text-sm text-right">
                                        <thead className="bg-gray-100 text-gray-600"><tr><th className="p-3">نام بانک</th><th className="p-3">مجموع پرداختی</th><th className="p-3">درصد از کل</th></tr></thead>
                                        <tbody className="divide-y">
                                            {bankStats.map((bank, idx) => (
                                                <tr key={idx} className="hover:bg-gray-50">
                                                    <td className="p-3 font-bold text-gray-800">{bank.name}</td>
                                                    <td className="p-3 font-mono text-gray-600">{formatCurrency(bank.value)}</td>
                                                    <td className="p-3 font-mono text-gray-500 dir-ltr">{totalAmount > 0 ? ((bank.value / totalAmount) * 100).toFixed(1) : 0}%</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            <div>گزارش زمانی (همانند قبل)</div>
                        )}
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default Dashboard;
