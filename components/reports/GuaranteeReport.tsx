
import React, { useState, useMemo } from 'react';
import { TradeRecord } from '../../types';
import { formatCurrency, formatNumberString } from '../../constants';
import { Printer, FileDown, Search, Filter, ShieldCheck, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { generatePdf } from '../../utils/pdfGenerator';

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
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

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
                    // Only process if it has a cheque number
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

    // 4. Print Logic
    const elementId = 'guarantee-report-print-area';

    const handlePrint = () => {
        setIsGeneratingPdf(true);
        setTimeout(() => {
            window.print();
            setIsGeneratingPdf(false);
        }, 500);
    };

    const handleDownloadPDF = async () => {
        setIsGeneratingPdf(true);
        await generatePdf({
            elementId: elementId,
            filename: `Guarantee_Cheques_${new Date().toISOString().slice(0,10)}.pdf`,
            format: 'A4',
            orientation: 'landscape',
            onComplete: () => setIsGeneratingPdf(false),
            onError: () => { alert('خطا در ایجاد PDF'); setIsGeneratingPdf(false); }
        });
    };

    return (
        <div className="bg-white p-4 rounded-lg shadow-sm border h-full flex flex-col">
            
            {/* Header / Filters */}
            <div className="bg-gray-100 p-3 rounded mb-4 border border-gray-200 no-print flex flex-col md:flex-row gap-4 justify-between items-end md:items-center">
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
                    <button onClick={handleDownloadPDF} disabled={isGeneratingPdf} className="bg-red-600 text-white px-3 py-2 rounded hover:bg-red-700 flex items-center gap-1 text-xs">{isGeneratingPdf ? <Loader2 size={14} className="animate-spin"/> : <FileDown size={14}/>} PDF</button>
                    <button onClick={handlePrint} className="bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 flex items-center gap-1 text-xs"><Printer size={14}/> چاپ</button>
                </div>
            </div>

            {/* Content Table */}
            <div className="flex-1 overflow-auto flex justify-center bg-gray-50 p-4">
                <div id={elementId} className="printable-content bg-white p-8 shadow-2xl relative text-black" 
                    style={{ 
                        width: '297mm', // Landscape
                        minHeight: '210mm', 
                        direction: 'rtl', 
                        padding: '10mm', 
                        boxSizing: 'border-box' 
                    }}>
                    
                    {/* Report Header */}
                    <div className="border border-black mb-4">
                        <div className="bg-gray-200 font-black py-3 border-b border-black text-center text-lg">گزارش جامع چک‌های تضمین و ضمانت‌نامه‌ها</div>
                        <div className="flex justify-between px-4 py-2 bg-gray-50 text-xs font-bold">
                            <span>تاریخ گزارش: {new Date().toLocaleDateString('fa-IR')}</span>
                            <span>تعداد کل: {filteredData.length} فقره</span>
                        </div>
                    </div>

                    <table className="w-full border-collapse text-center border border-black text-[11px]">
                        <thead>
                            <tr className="bg-gray-800 text-white">
                                <th className="border border-gray-600 p-2 w-10">ردیف</th>
                                <th className="border border-gray-600 p-2">شماره پرونده</th>
                                <th className="border border-gray-600 p-2">شرکت</th>
                                <th className="border border-gray-600 p-2">بخش (نوع)</th>
                                <th className="border border-gray-600 p-2">بانک</th>
                                <th className="border border-gray-600 p-2">شماره چک/ضمانت</th>
                                <th className="border border-gray-600 p-2">تاریخ سررسید</th>
                                <th className="border border-gray-600 p-2">مبلغ (ریال)</th>
                                <th className="border border-gray-600 p-2 w-24">وضعیت</th>
                                <th className="border border-gray-600 p-2 w-1/5">توضیحات</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredData.length === 0 ? (
                                <tr><td colSpan={10} className="p-4 text-gray-400 border border-gray-300">موردی یافت نشد</td></tr>
                            ) : (
                                filteredData.map((item, idx) => (
                                    <tr key={item.id} className="hover:bg-gray-50">
                                        <td className="border border-black p-2">{idx + 1}</td>
                                        <td className="border border-black p-2 font-bold">{item.fileNumber}</td>
                                        <td className="border border-black p-2">{item.company}</td>
                                        <td className="border border-black p-2">{item.section}</td>
                                        <td className="border border-black p-2">{item.bank}</td>
                                        <td className="border border-black p-2 font-mono font-bold dir-ltr">{item.chequeNumber}</td>
                                        <td className="border border-black p-2 dir-ltr">{item.dueDate}</td>
                                        <td className="border border-black p-2 font-mono dir-ltr font-bold">{formatCurrency(item.amount)}</td>
                                        <td className={`border border-black p-2 font-bold ${item.isDelivered ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'}`}>
                                            <div className="flex items-center justify-center gap-1">
                                                {item.isDelivered ? <CheckCircle2 size={12}/> : <XCircle size={12}/>}
                                                {item.isDelivered ? 'عودت شده' : 'نزد سازمان'}
                                            </div>
                                        </td>
                                        <td className="border border-black p-2 text-right">{item.description}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        <tfoot>
                            <tr className="bg-gray-800 text-white font-bold text-sm">
                                <td colSpan={7} className="border border-black p-2 text-left pl-4">جمع کل مبلغ تضمین</td>
                                <td className="border border-black p-2 dir-ltr font-mono">{formatCurrency(totalAmount)}</td>
                                <td colSpan={2} className="border border-black p-2"></td>
                            </tr>
                        </tfoot>
                    </table>

                    <div className="mt-8 text-center text-[10px] text-gray-400">
                        سیستم مدیریت مالی و بازرگانی - گزارش سیستمی
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GuaranteeReport;
