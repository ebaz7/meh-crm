
import React, { useState, useMemo } from 'react';
import { TradeRecord } from '../../types';
import { formatCurrency } from '../../constants';
import { Printer, FileDown, Search, Filter, ShieldCheck, CheckCircle2, XCircle } from 'lucide-react';
import PrintGuaranteeReport from '../print/PrintGuaranteeReport'; // Import New Print Component

interface Props {
    records: TradeRecord[];
}

interface GuaranteeItem {
    id: string; // Unique ID composed of recordId + index
    fileNumber: string;
    company: string;
    section: string; // 'Currency' or 'Customs'
    bank: string;
    chequeNumber: string;
    amount: number;
    dueDate: string;
    isDelivered: boolean; // Status
    description: string;
}

const GuaranteeReport: React.FC<Props> = ({ records }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'delivered' | 'pending'>('all');
    const [sectionFilter, setSectionFilter] = useState<'all' | 'Currency' | 'Customs'>('all');
    const [showPrintModal, setShowPrintModal] = useState(false); // State for Print Modal

    // 1. Extract and Flatten Data
    const guaranteeData = useMemo(() => {
        const list: GuaranteeItem[] = [];

        records.forEach(r => {
            // A. Currency Purchase Guarantees
            if (r.currencyPurchaseData?.guaranteeCheque && r.currencyPurchaseData.guaranteeCheque.chequeNumber) {
                const g = r.currencyPurchaseData.guaranteeCheque;
                list.push({
                    id: `${r.id}_currency`,
                    fileNumber: r.fileNumber,
                    company: r.company || '-',
                    section: 'ارزی (رفع تعهد)',
                    bank: g.bank || '-',
                    chequeNumber: g.chequeNumber,
                    amount: g.amount || 0,
                    dueDate: g.dueDate || '-',
                    isDelivered: !!g.isDelivered,
                    description: 'ضمانت خرید ارز'
                });
            }

            // B. Customs (Green Leaf) Guarantees
            if (r.greenLeafData?.guarantees) {
                r.greenLeafData.guarantees.forEach((g, idx) => {
                    // Only process if it has a cheque number or guarantee number
                    if (g.chequeNumber || g.guaranteeNumber) {
                        list.push({
                            id: `${r.id}_customs_${g.id}`,
                            fileNumber: r.fileNumber,
                            company: r.company || '-',
                            section: 'گمرک (برگ سبز)',
                            bank: g.chequeBank || g.guaranteeBank || '-',
                            chequeNumber: g.chequeNumber || g.guaranteeNumber, // Use guarantee number if cheque is missing
                            amount: (g.chequeAmount || 0) + (g.cashAmount || 0), // Total guarantee value
                            dueDate: g.chequeDate || g.cashDate || '-',
                            isDelivered: !!g.isDelivered,
                            description: `ضمانت کوتاژ ${r.greenLeafData?.duties.find(d => d.id === g.relatedDutyId)?.cottageNumber || '-'}`
                        });
                    }
                });
            }
        });

        return list;
    }, [records]);

    // 2. Filter Data
    const filteredData = useMemo(() => {
        return guaranteeData.filter(item => {
            const matchesSearch = 
                item.fileNumber.includes(searchTerm) || 
                item.chequeNumber.includes(searchTerm) || 
                item.bank.includes(searchTerm) ||
                item.company.includes(searchTerm);
            
            const matchesStatus = 
                statusFilter === 'all' ? true : 
                statusFilter === 'delivered' ? item.isDelivered : 
                !item.isDelivered;

            const matchesSection = 
                sectionFilter === 'all' ? true : 
                sectionFilter === 'Currency' ? item.section.includes('ارزی') :
                item.section.includes('گمرک');

            return matchesSearch && matchesStatus && matchesSection;
        });
    }, [guaranteeData, searchTerm, statusFilter, sectionFilter]);

    // 3. Totals
    const totalAmount = filteredData.reduce((sum, item) => sum + item.amount, 0);

    return (
        <div className="bg-white p-4 rounded-lg shadow-sm border h-full flex flex-col">
            
            {/* Show Print Modal when active */}
            {showPrintModal && (
                <PrintGuaranteeReport 
                    data={filteredData} 
                    totalAmount={totalAmount} 
                    onClose={() => setShowPrintModal(false)} 
                />
            )}

            {/* Header / Filters */}
            <div className="bg-gray-100 p-3 rounded mb-4 border border-gray-200 flex flex-col md:flex-row gap-4 justify-between items-end md:items-center">
                <div className="flex flex-wrap gap-3 flex-1 w-full">
                    <div className="relative">
                        <Search className="absolute right-2 top-2.5 text-gray-400" size={16}/>
                        <input 
                            className="w-48 pl-2 pr-8 py-2 border rounded-lg text-sm" 
                            placeholder="جستجو (شماره چک، پرونده...)" 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    
                    <div className="flex items-center gap-2 bg-white border rounded px-2 py-1">
                        <Filter size={16} className="text-gray-500"/>
                        <select className="bg-transparent text-sm outline-none" value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}>
                            <option value="all">همه وضعیت‌ها</option>
                            <option value="pending">نزد سازمان (در جریان)</option>
                            <option value="delivered">عودت شده (آزاد)</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-2 bg-white border rounded px-2 py-1">
                        <ShieldCheck size={16} className="text-gray-500"/>
                        <select className="bg-transparent text-sm outline-none" value={sectionFilter} onChange={e => setSectionFilter(e.target.value as any)}>
                            <option value="all">همه بخش‌ها</option>
                            <option value="Currency">ارزی (رفع تعهد)</option>
                            <option value="Customs">گمرکی (برگ سبز)</option>
                        </select>
                    </div>
                </div>

                <div className="flex gap-2">
                    {/* Trigger Print Modal */}
                    <button onClick={() => setShowPrintModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2 text-sm font-bold shadow-sm transition-transform active:scale-95">
                        <Printer size={16}/> چاپ / PDF
                    </button>
                </div>
            </div>

            {/* Interactive Table (View Mode) */}
            <div className="flex-1 overflow-auto bg-white border rounded-lg">
                <table className="w-full border-collapse text-center text-sm">
                    <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="p-3 text-gray-600 font-bold border-b">ردیف</th>
                            <th className="p-3 text-gray-600 font-bold border-b">شماره پرونده</th>
                            <th className="p-3 text-gray-600 font-bold border-b">شرکت</th>
                            <th className="p-3 text-gray-600 font-bold border-b">بخش</th>
                            <th className="p-3 text-gray-600 font-bold border-b">بانک</th>
                            <th className="p-3 text-gray-600 font-bold border-b">شماره چک</th>
                            <th className="p-3 text-gray-600 font-bold border-b">سررسید</th>
                            <th className="p-3 text-gray-600 font-bold border-b">مبلغ (ریال)</th>
                            <th className="p-3 text-gray-600 font-bold border-b">وضعیت</th>
                            <th className="p-3 text-gray-600 font-bold border-b">توضیحات</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredData.length === 0 ? (
                            <tr><td colSpan={10} className="p-8 text-center text-gray-400">موردی یافت نشد</td></tr>
                        ) : (
                            filteredData.map((item, idx) => (
                                <tr key={item.id} className="hover:bg-blue-50/50 transition-colors">
                                    <td className="p-3 text-gray-500">{idx + 1}</td>
                                    <td className="p-3 font-bold text-gray-800">{item.fileNumber}</td>
                                    <td className="p-3 text-gray-700">{item.company}</td>
                                    <td className="p-3">
                                        <span className={`text-xs px-2 py-1 rounded border ${item.section.includes('ارزی') ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                                            {item.section}
                                        </span>
                                    </td>
                                    <td className="p-3 text-gray-700">{item.bank}</td>
                                    <td className="p-3 font-mono font-bold dir-ltr text-gray-800">{item.chequeNumber}</td>
                                    <td className="p-3 dir-ltr font-mono text-gray-600">{item.dueDate}</td>
                                    <td className="p-3 font-mono dir-ltr font-bold text-blue-600">{formatCurrency(item.amount)}</td>
                                    <td className="p-3">
                                        <div className={`flex items-center justify-center gap-1 px-2 py-1 rounded text-xs font-bold ${item.isDelivered ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {item.isDelivered ? <CheckCircle2 size={14}/> : <XCircle size={14}/>}
                                            {item.isDelivered ? 'عودت شده' : 'نزد سازمان'}
                                        </div>
                                    </td>
                                    <td className="p-3 text-gray-500 text-xs">{item.description}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t sticky bottom-0">
                        <tr>
                            <td colSpan={7} className="p-3 text-left font-bold text-gray-700 pl-6">جمع کل مبلغ تضمین:</td>
                            <td className="p-3 font-mono font-black text-lg text-blue-800 dir-ltr">{formatCurrency(totalAmount)}</td>
                            <td colSpan={2}></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
};

export default GuaranteeReport;
