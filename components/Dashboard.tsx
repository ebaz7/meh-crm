
import React, { useState, useMemo } from 'react';
import { PaymentOrder, OrderStatus, PaymentMethod, SystemSettings, User } from '../types';
import { formatCurrency, parsePersianDate, formatNumberString, getShamsiDateFromIso, jalaliToGregorian, getCurrentShamsiDate } from '../constants';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { TrendingUp, Clock, CheckCircle, Activity, Building2, X, XCircle, Banknote, Calendar as CalendarIcon, Share2, Plus, CalendarDays, Loader2, Send, ShieldCheck, ArrowUpRight, List, ChevronLeft, ChevronRight, Briefcase, Settings } from 'lucide-react';
import { getRolePermissions } from '../services/authService';

interface DashboardProps {
  orders: PaymentOrder[];
  settings?: SystemSettings;
  currentUser: User;
  onViewArchive?: () => void;
  onFilterByStatus?: (status: OrderStatus | 'pending_all') => void;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];
const MONTHS = [ 'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند' ];

const Dashboard: React.FC<DashboardProps> = ({ orders, settings, currentUser, onViewArchive, onFilterByStatus }) => {
  const [showBankReport, setShowBankReport] = useState(false);
  const [bankReportTab, setBankReportTab] = useState<'summary' | 'timeline'>('summary');

  // Permission Check: Defaults to false if settings not loaded yet to prevent crash, but strictly checks logic
  const permissions = settings ? getRolePermissions(currentUser.role, settings, currentUser) : { canViewPaymentOrders: false };
  const hasPaymentAccess = permissions.canViewPaymentOrders === true;

  const completedOrders = orders.filter(o => o.status === OrderStatus.APPROVED_CEO);
  const totalAmount = completedOrders.reduce((sum, order) => sum + order.totalAmount, 0);
  
  const countPending = orders.filter(o => o.status === OrderStatus.PENDING).length;
  const countFin = orders.filter(o => o.status === OrderStatus.APPROVED_FINANCE).length;
  const countMgr = orders.filter(o => o.status === OrderStatus.APPROVED_MANAGER).length;
  const countRejected = orders.filter(o => o.status === OrderStatus.REJECTED).length;

  // Only show active cartable items if user has access. Otherwise empty array.
  const activeCartable = hasPaymentAccess ? orders
    .filter(o => o.status !== OrderStatus.APPROVED_CEO && o.status !== OrderStatus.REJECTED)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 10) : [];

  const handleWidgetClick = (status: OrderStatus | 'pending_all') => {
      if (hasPaymentAccess && onFilterByStatus) {
          onFilterByStatus(status);
      }
  };

  const handleArchiveClick = () => {
      if (hasPaymentAccess && onViewArchive) {
          onViewArchive();
      }
  };

  const statusWidgets = [
    { 
      key: OrderStatus.PENDING, 
      label: 'کارتابل مالی', 
      count: countPending, 
      icon: Clock, 
      color: 'text-amber-600', 
      bg: 'bg-amber-50', 
      border: 'border-amber-100', 
      barColor: 'bg-amber-500'
    },
    { 
      key: OrderStatus.APPROVED_FINANCE, 
      label: 'کارتابل مدیریت', 
      count: countFin, 
      icon: Activity, 
      color: 'text-blue-600', 
      bg: 'bg-blue-50', 
      border: 'border-blue-100',
      barColor: 'bg-blue-500'
    },
    { 
      key: OrderStatus.APPROVED_MANAGER, 
      label: 'کارتابل مدیرعامل', 
      count: countMgr, 
      icon: ShieldCheck, 
      color: 'text-indigo-600', 
      bg: 'bg-indigo-50', 
      border: 'border-indigo-100',
      barColor: 'bg-indigo-500'
    },
    { 
      key: OrderStatus.REJECTED, 
      label: 'رد شده', 
      count: countRejected, 
      icon: XCircle, 
      color: 'text-red-600', 
      bg: 'bg-red-50', 
      border: 'border-red-100',
      barColor: 'bg-red-500'
    },
    { 
      key: OrderStatus.APPROVED_CEO, 
      label: 'بایگانی', 
      count: completedOrders.length, 
      icon: CheckCircle, 
      color: 'text-green-600', 
      bg: 'bg-green-50', 
      border: 'border-green-100',
      barColor: 'bg-green-500'
    }
  ];

  const methodDataRaw: Record<string, number> = {};
  orders.forEach(order => { order.paymentDetails.forEach(detail => { methodDataRaw[detail.method] = (methodDataRaw[detail.method] || 0) + detail.amount; }); });
  const methodData = Object.keys(methodDataRaw).map(key => ({ name: key, amount: methodDataRaw[key] }));

  const bankStats = useMemo(() => {
    const stats: Record<string, number> = {};
    completedOrders.forEach(order => { order.paymentDetails.forEach(detail => { if (detail.bankName && detail.bankName.trim() !== '') { const normalizedName = detail.bankName.trim(); stats[normalizedName] = (stats[normalizedName] || 0) + detail.amount; } }); });
    return Object.entries(stats).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [completedOrders]);

  const bankTimeline = useMemo(() => {
      const groups: Record<string, { label: string, total: number, count: number, days: Record<string, { total: number, items: any[] }> }> = {};
      completedOrders.forEach(order => {
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
  }, [completedOrders]);

  const topBank = bankStats.length > 0 ? bankStats[0] : { name: '-', value: 0 };
  const mostActiveMonth = bankTimeline.length > 0 ? bankTimeline[0] : { label: '-', total: 0 };

  return (
    <div className="space-y-6 pb-20 md:pb-0 animate-fade-in">
        {/* Status Widgets */}
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
                <h3 className="font-bold text-gray-800 flex items-center gap-2"><Activity size={20} className="text-orange-500"/> آخرین فعالیت‌ها (کارتابل جاری)</h3>
                {onViewArchive && hasPaymentAccess && <button onClick={handleArchiveClick} className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-700 font-bold bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">مشاهده آرشیو <ArrowUpRight size={14}/></button>}
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
                            کارتابل شما خالی است.
                        </div>
                    ) : (
                        activeCartable.map(order => (
                            <div key={order.id} className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between group">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${order.status === OrderStatus.REJECTED ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
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
                                    <div className={`text-[10px] mt-1 px-2 py-0.5 rounded inline-block ${order.status === OrderStatus.PENDING ? 'bg-amber-100 text-amber-700' : 'bg-blue-50 text-blue-600'}`}>
                                        {order.status}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>

        {/* Bank Report Modal */}
        {showBankReport && hasPaymentAccess && (
            <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden">
                    <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2"><Banknote size={20}/> گزارش تفصیلی بانک‌ها</h3>
                        <button onClick={() => setShowBankReport(false)} className="p-1 hover:bg-gray-200 rounded-full transition-colors"><X size={20} className="text-gray-500"/></button>
                    </div>
                    
                    <div className="p-2 border-b flex gap-2 overflow-x-auto bg-white">
                        <button onClick={() => setBankReportTab('summary')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${bankReportTab === 'summary' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}>خلاصه عملکرد</button>
                        <button onClick={() => setBankReportTab('timeline')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${bankReportTab === 'timeline' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}>ریش‌سفید زمانی (تایم‌لاین)</button>
                    </div>

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
                                                    <td className="p-3 font-mono text-gray-500 dir-ltr">{((bank.value / totalAmount) * 100).toFixed(1)}%</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6 relative">
                                <div className="absolute top-0 bottom-0 right-4 w-0.5 bg-gray-200"></div>
                                {bankTimeline.map((monthData, idx) => (
                                    <div key={idx} className="relative pr-8">
                                        <div className="absolute right-2 top-0 w-4 h-4 rounded-full bg-indigo-500 border-4 border-white shadow-sm"></div>
                                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                            <div className="flex justify-between items-center mb-3 pb-2 border-b">
                                                <h4 className="font-bold text-gray-800">{monthData.label}</h4>
                                                <span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded text-xs font-mono font-bold">{formatCurrency(monthData.total)}</span>
                                            </div>
                                            <div className="space-y-3">
                                                {monthData.days.map((day, dIdx) => (
                                                    <div key={dIdx} className="text-sm">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-gray-300"></div>
                                                            <span className="font-bold text-gray-600 text-xs">{day.day} ام</span>
                                                            <span className="text-[10px] text-gray-400">({formatCurrency(day.total)})</span>
                                                        </div>
                                                        <div className="mr-3 space-y-1">
                                                            {day.items.map((item: any, i: number) => (
                                                                <div key={i} className="flex justify-between items-center bg-gray-50 p-2 rounded text-xs hover:bg-gray-100 transition-colors">
                                                                    <div className="truncate flex-1 ml-2">
                                                                        <span className="text-gray-800 font-bold">{item.bank}</span>
                                                                        <span className="text-gray-500 mx-1">➜</span>
                                                                        <span className="text-gray-700">{item.payee}</span>
                                                                    </div>
                                                                    <div className="font-mono text-gray-600 whitespace-nowrap">{formatCurrency(item.amount)}</div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default Dashboard;
