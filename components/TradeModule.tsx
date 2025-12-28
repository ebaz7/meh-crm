
import React, { useState, useEffect } from 'react';
import { TradeRecord, User, SystemSettings } from '../types';
import { getTradeRecords, updateTradeRecord, saveTradeRecord, deleteTradeRecord } from '../services/storageService';
import { ShieldCheck, Save, Plus, Trash2, Edit, X, Search, FileText, ArrowRight, Loader2 } from 'lucide-react';
import { formatNumberString, deformatNumberString, formatCurrency } from '../constants';
import AllocationReport from './AllocationReport';
import CurrencyReport from './reports/CurrencyReport';
import CompanyPerformanceReport from './reports/CompanyPerformanceReport';
import GuaranteeReport from './reports/GuaranteeReport';
import InsuranceLedgerReport from './reports/InsuranceLedgerReport';

interface Props {
    currentUser: User;
    settings?: SystemSettings;
}

const TradeModule: React.FC<Props> = ({ currentUser, settings }) => {
    const [records, setRecords] = useState<TradeRecord[]>([]);
    const [view, setView] = useState<'list' | 'edit' | 'reports'>('list');
    const [selectedRecord, setSelectedRecord] = useState<TradeRecord | null>(null);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Currency Guarantee State
    const [currencyGuarantee, setCurrencyGuarantee] = useState({
        number: '',
        bank: '',
        amount: '',
        date: '',
        isDelivered: false
    });

    const [reportType, setReportType] = useState<string>('allocation');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await getTradeRecords();
            setRecords(data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleEditRecord = (record: TradeRecord) => {
        setSelectedRecord(record);
        if (record.currencyPurchaseData?.guaranteeCheque) {
            const g = record.currencyPurchaseData.guaranteeCheque;
            setCurrencyGuarantee({
                number: g.chequeNumber || '',
                bank: g.bank || '',
                amount: g.amount ? formatNumberString(g.amount) : '',
                date: g.dueDate || '',
                isDelivered: !!g.isDelivered
            });
        } else {
            setCurrencyGuarantee({ number: '', bank: '', amount: '', date: '', isDelivered: false });
        }
        setView('edit');
    };

    const handleSaveCurrencyGuarantee = async () => {
        if (!selectedRecord) return;
        const updatedRecord: TradeRecord = {
            ...selectedRecord,
            currencyPurchaseData: {
                ...(selectedRecord.currencyPurchaseData || {}),
                guaranteeCheque: {
                    chequeNumber: currencyGuarantee.number,
                    bank: currencyGuarantee.bank,
                    amount: deformatNumberString(currencyGuarantee.amount),
                    dueDate: currencyGuarantee.date,
                    isDelivered: currencyGuarantee.isDelivered
                }
            } as any
        };
        await updateTradeRecord(updatedRecord);
        setSelectedRecord(updatedRecord);
        alert('اطلاعات چک ضمانت ذخیره شد.');
        loadData();
    };

    const handleToggleCurrencyGuaranteeDelivery = async () => {
        const newVal = !currencyGuarantee.isDelivered;
        setCurrencyGuarantee(prev => ({ ...prev, isDelivered: newVal }));
        // Note: Actual save happens when clicking the save button, or we can auto-save here.
        // For consistency with the snippet logic, we might just update state or trigger save.
        // Let's just update the state here and let the user click save, or better yet, trigger the save directly if intended.
        // But the snippet just shows a toggle button visually updating style.
    };

    const handleUpdateRecord = async (record: TradeRecord, updates: Partial<TradeRecord>) => {
        const updated = { ...record, ...updates };
        await updateTradeRecord(updated);
        setRecords(records.map(r => r.id === updated.id ? updated : r));
        if (selectedRecord && selectedRecord.id === updated.id) {
            setSelectedRecord(updated);
        }
    };

    const filteredRecords = records.filter(r => 
        r.fileNumber.includes(searchTerm) || 
        r.company?.includes(searchTerm) || 
        r.goodsName.includes(searchTerm)
    );

    if (view === 'reports') {
        return (
            <div className="bg-white p-6 rounded-xl shadow-sm border space-y-6">
                <div className="flex justify-between items-center border-b pb-4">
                    <h2 className="text-xl font-bold text-gray-800">گزارشات بازرگانی</h2>
                    <div className="flex gap-2">
                        <select className="border rounded p-2 text-sm" value={reportType} onChange={e => setReportType(e.target.value)}>
                            <option value="allocation">گزارش تخصیص ارز</option>
                            <option value="currency">گزارش خرید ارز</option>
                            <option value="performance">عملکرد شرکت‌ها</option>
                            <option value="guarantee">گزارش ضمانت‌ها</option>
                            <option value="insurance">صورتحساب بیمه</option>
                        </select>
                        <button onClick={() => setView('list')} className="text-gray-500 hover:text-gray-700 px-4 py-2 rounded border">بازگشت</button>
                    </div>
                </div>
                {reportType === 'allocation' && <AllocationReport records={records} onUpdateRecord={handleUpdateRecord} settings={settings} />}
                {reportType === 'currency' && <CurrencyReport records={records} />}
                {reportType === 'performance' && <CompanyPerformanceReport records={records} />}
                {reportType === 'guarantee' && <GuaranteeReport records={records} />}
                {reportType === 'insurance' && <InsuranceLedgerReport records={records} settings={settings} />}
            </div>
        );
    }

    if (view === 'edit' && selectedRecord) {
        return (
            <div className="space-y-6">
                <div className="bg-white p-4 rounded-xl shadow-sm border flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-800">ویرایش پرونده: {selectedRecord.fileNumber}</h2>
                    <button onClick={() => setView('list')} className="text-gray-500 hover:text-gray-700 flex items-center gap-1 text-sm font-bold"><ArrowRight size={16}/> بازگشت</button>
                </div>

                {/* --- Snippet Content: Guarantee Cheque Section --- */}
                <div className="bg-white p-6 rounded-xl shadow-sm border space-y-4">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2"><ShieldCheck size={20} className="text-purple-600"/> چک ضمانت ارزی (رفع تعهد)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 items-end bg-purple-50 p-4 rounded-lg">
                            <div className="space-y-1"><label className="text-xs font-bold text-gray-700">شماره چک</label><input className="w-full border rounded p-2 text-sm dir-ltr" value={currencyGuarantee.number} onChange={e => setCurrencyGuarantee({...currencyGuarantee, number: e.target.value})} /></div>
                            <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-700">نام بانک</label>
                            <select className="w-full border rounded p-2 text-sm" value={currencyGuarantee.bank} onChange={e => setCurrencyGuarantee({...currencyGuarantee, bank: e.target.value})}>
                                <option value="">انتخاب</option>
                                {/* Filter banks based on the selected company */}
                                {settings?.companies?.find(c => c.name === selectedRecord?.company)?.banks?.map(b => {
                                    const val = `${b.bankName}${b.accountNumber ? ` - ${b.accountNumber}` : ''}`;
                                    return <option key={b.id} value={val}>{val}</option>;
                                })}
                            </select>
                            </div>
                            <div className="space-y-1"><label className="text-xs font-bold text-gray-700">مبلغ (ریال)</label><input className="w-full border rounded p-2 text-sm dir-ltr" value={currencyGuarantee.amount} onChange={e => setCurrencyGuarantee({...currencyGuarantee, amount: formatNumberString(deformatNumberString(e.target.value).toString())})} /></div>
                            <div className="space-y-1"><label className="text-xs font-bold text-gray-700">تاریخ سررسید</label><input className="w-full border rounded p-2 text-sm dir-ltr" placeholder="1403/xx/xx" value={currencyGuarantee.date} onChange={e => setCurrencyGuarantee({...currencyGuarantee, date: e.target.value})} /></div>
                            <button onClick={handleSaveCurrencyGuarantee} className="bg-purple-600 text-white p-2 rounded-lg text-sm font-bold hover:bg-purple-700 h-[38px]"><Save size={16} /></button>
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-bold text-gray-700">وضعیت چک:</label>
                        <button onClick={handleToggleCurrencyGuaranteeDelivery} className={`px-3 py-1 rounded text-xs font-bold transition-colors ${currencyGuarantee.isDelivered ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-red-100 text-red-700 border border-red-300'}`}>
                            {currencyGuarantee.isDelivered ? 'عودت داده شد (رفع تعهد)' : 'نزد بانک (در جریان)'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Default View: List
    return (
        <div className="bg-white rounded-xl shadow-sm border p-6 min-h-[600px]">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800">مدیریت پرونده‌های بازرگانی</h2>
                <div className="flex gap-2">
                    <button onClick={() => setView('reports')} className="bg-blue-50 text-blue-600 px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold hover:bg-blue-100"><FileText size={18}/> گزارشات</button>
                    {/* Add New Record Button would go here */}
                </div>
            </div>

            <div className="mb-4 relative">
                <Search className="absolute right-3 top-2.5 text-gray-400" size={18} />
                <input 
                    className="w-full border rounded-xl pl-4 pr-10 py-2.5 text-sm" 
                    placeholder="جستجو در پرونده‌ها..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm text-right">
                    <thead className="bg-gray-100 text-gray-600">
                        <tr>
                            <th className="p-3 rounded-r-lg">شماره پرونده</th>
                            <th className="p-3">شرکت</th>
                            <th className="p-3">کالا</th>
                            <th className="p-3">وضعیت</th>
                            <th className="p-3 text-center rounded-l-lg">عملیات</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {loading ? (
                            <tr><td colSpan={5} className="p-8 text-center"><Loader2 className="animate-spin inline-block text-blue-600"/> در حال بارگذاری...</td></tr>
                        ) : filteredRecords.length === 0 ? (
                            <tr><td colSpan={5} className="p-8 text-center text-gray-400">موردی یافت نشد</td></tr>
                        ) : (
                            filteredRecords.map(record => (
                                <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="p-3 font-bold">{record.fileNumber}</td>
                                    <td className="p-3">{record.company}</td>
                                    <td className="p-3">{record.goodsName}</td>
                                    <td className="p-3"><span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">{record.status}</span></td>
                                    <td className="p-3 text-center">
                                        <button onClick={() => handleEditRecord(record)} className="text-blue-600 hover:text-blue-800 bg-blue-50 p-2 rounded-lg transition-colors"><Edit size={16}/></button>
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

export default TradeModule;
