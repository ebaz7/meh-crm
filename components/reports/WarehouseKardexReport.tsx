
import React, { useState, useMemo, useEffect } from 'react';
import { WarehouseItem, WarehouseTransaction } from '../../types';
import { formatDate, formatCurrency, formatNumberString, parsePersianDate, jalaliToGregorian } from '../../constants';
import { Filter, Printer, FileDown, Search, ArrowDownCircle, ArrowUpCircle, X, Loader2 } from 'lucide-react';

interface Props {
    items: WarehouseItem[];
    transactions: WarehouseTransaction[];
    companies: string[];
}

const WarehouseKardexReport: React.FC<Props> = ({ items, transactions, companies }) => {
    // Filters
    const [selectedCompany, setSelectedCompany] = useState<string>('');
    const [selectedItem, setSelectedItem] = useState<string>('');
    const [dateRange, setDateRange] = useState({ from: '', to: '' });
    const [txType, setTxType] = useState<'ALL' | 'IN' | 'OUT'>('ALL');
    const [isGenerating, setIsGenerating] = useState(false);

    // Initial Filter Setup
    useEffect(() => {
        if (companies.length > 0 && !selectedCompany) setSelectedCompany(companies[0]);
        if (items.length > 0 && !selectedItem) setSelectedItem(items[0].id);
    }, [companies, items]);

    // Calculation Logic
    const kardexRows = useMemo(() => {
        if (!selectedCompany || !selectedItem) return [];

        // 1. Filter Transactions
        let filteredTxs = transactions.filter(tx => {
            if (tx.company !== selectedCompany) return false;
            if (tx.status === 'REJECTED') return false; // Exclude rejected
            if (txType !== 'ALL' && tx.type !== txType) return false;
            
            // Check if transaction contains the selected item
            const hasItem = tx.items.some(i => i.itemId === selectedItem);
            if (!hasItem) return false;

            // Date Filter
            if (dateRange.from) {
                const txDate = new Date(tx.date);
                const fromDate = parsePersianDate(dateRange.from);
                if (fromDate && txDate < fromDate) return false;
            }
            if (dateRange.to) {
                const txDate = new Date(tx.date);
                const toDate = parsePersianDate(dateRange.to);
                if (toDate) {
                    toDate.setHours(23, 59, 59);
                    if (txDate > toDate) return false;
                }
            }

            return true;
        });

        // 2. Sort Ascending (Oldest First) for running balance
        filteredTxs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // 3. Process Rows & Balance
        let runningBalance = 0;
        const rows = filteredTxs.map(tx => {
            const txItem = tx.items.find(i => i.itemId === selectedItem);
            const qty = txItem ? txItem.quantity : 0;
            const weight = txItem ? txItem.weight : 0;

            const inQty = tx.type === 'IN' ? qty : 0;
            const outQty = tx.type === 'OUT' ? qty : 0;

            runningBalance += (inQty - outQty);

            return {
                id: tx.id,
                date: tx.date,
                number: tx.number || tx.proformaNumber || '-',
                type: tx.type,
                description: tx.type === 'IN' 
                    ? `پروفرما: ${tx.proformaNumber}` 
                    : `گیرنده: ${tx.recipientName || '-'} | مقصد: ${tx.destination || '-'}`,
                in: inQty,
                out: outQty,
                balance: runningBalance,
                weight: weight
            };
        });

        return rows;
    }, [transactions, selectedCompany, selectedItem, dateRange, txType]);

    const activeItemName = items.find(i => i.id === selectedItem)?.name || '-';

    // Print & PDF
    const handlePrint = () => {
        const content = document.getElementById('kardex-print-area');
        if (!content) return;
        
        const printWindow = window.open('', '_blank', 'width=1100,height=800');
        if (!printWindow) return;

        const html = `
            <html dir="rtl" lang="fa">
            <head>
                <title>کاردکس کالا - ${activeItemName}</title>
                <style>
                    body { font-family: 'Tahoma', sans-serif; padding: 20px; }
                    table { width: 100%; border-collapse: collapse; font-size: 11px; }
                    th, td { border: 1px solid #333; padding: 5px; text-align: center; }
                    th { background-color: #f0f0f0; }
                    .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }
                    .meta { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 12px; font-weight: bold; }
                    .balance { direction: ltr; font-family: monospace; font-weight: bold; }
                    .in-row { background-color: #f0fdf4; }
                    .out-row { background-color: #fef2f2; }
                    @media print { .no-print { display: none; } }
                </style>
            </head>
            <body>
                ${content.innerHTML}
            </body>
            </html>
        `;
        
        printWindow.document.write(html);
        printWindow.document.close();
        setTimeout(() => printWindow.print(), 500);
    };

    const handleDownloadPDF = async () => {
        setIsGenerating(true);
        const element = document.getElementById('kardex-print-area');
        if (!element) { setIsGenerating(false); return; }
        
        try {
            // @ts-ignore
            const canvas = await window.html2canvas(element, { scale: 2, backgroundColor: '#ffffff' });
            const imgData = canvas.toDataURL('image/png');
            // @ts-ignore
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = 210;
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`Kardex_${activeItemName}_${new Date().toISOString().slice(0,10)}.pdf`);
        } catch (e) {
            alert('خطا در ایجاد PDF');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="space-y-4 h-full flex flex-col">
            {/* Filter Bar */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4 items-end no-print">
                <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">شرکت</label>
                        <select className="w-full border rounded p-2 text-sm" value={selectedCompany} onChange={e => setSelectedCompany(e.target.value)}>
                            {companies.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">کالا</label>
                        <select className="w-full border rounded p-2 text-sm" value={selectedItem} onChange={e => setSelectedItem(e.target.value)}>
                            {items.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">نوع تراکنش</label>
                        <select className="w-full border rounded p-2 text-sm" value={txType} onChange={e => setTxType(e.target.value as any)}>
                            <option value="ALL">همه (ورود و خروج)</option>
                            <option value="IN">فقط ورودی</option>
                            <option value="OUT">فقط خروجی</option>
                        </select>
                    </div>
                    <div className="flex gap-1">
                        <div className="flex-1">
                            <label className="text-xs font-bold text-gray-500 block mb-1">از تاریخ</label>
                            <input className="w-full border rounded p-2 text-sm dir-ltr" placeholder="1403/01/01" value={dateRange.from} onChange={e => setDateRange({...dateRange, from: e.target.value})} />
                        </div>
                        <div className="flex-1">
                            <label className="text-xs font-bold text-gray-500 block mb-1">تا تاریخ</label>
                            <input className="w-full border rounded p-2 text-sm dir-ltr" placeholder="1403/12/29" value={dateRange.to} onChange={e => setDateRange({...dateRange, to: e.target.value})} />
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleDownloadPDF} disabled={isGenerating} className="bg-red-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-red-700 text-sm h-[38px]">
                        {isGenerating ? <Loader2 size={16} className="animate-spin"/> : <FileDown size={16}/>} PDF
                    </button>
                    <button onClick={handlePrint} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 text-sm h-[38px]">
                        <Printer size={16}/> چاپ
                    </button>
                </div>
            </div>

            {/* Report Display Area */}
            <div className="flex-1 bg-gray-50 border rounded-xl overflow-hidden relative">
                <div className="absolute inset-0 overflow-auto flex justify-center p-4">
                    <div id="kardex-print-area" className="bg-white p-8 shadow-lg min-h-[297mm] w-[210mm] text-black">
                        
                        {/* Header */}
                        <div className="header">
                            <h2 className="text-xl font-black mb-1">کاردکس تعدادی کالا</h2>
                            <p className="text-sm text-gray-600">گزارش گردش انبار</p>
                        </div>

                        {/* Meta */}
                        <div className="meta bg-gray-100 p-2 rounded border border-gray-300">
                            <div>شرکت: {selectedCompany}</div>
                            <div>کالا: {activeItemName}</div>
                            <div>تاریخ گزارش: {new Date().toLocaleDateString('fa-IR')}</div>
                        </div>

                        {/* Table */}
                        <table className="w-full border-collapse text-center text-[10px]">
                            <thead>
                                <tr className="bg-gray-800 text-white">
                                    <th className="p-2 border-gray-600">ردیف</th>
                                    <th className="p-2 border-gray-600">تاریخ</th>
                                    <th className="p-2 border-gray-600">نوع</th>
                                    <th className="p-2 border-gray-600">شماره سند</th>
                                    <th className="p-2 border-gray-600 w-1/3">شرح / طرف حساب</th>
                                    <th className="p-2 border-gray-600 bg-green-700">وارده</th>
                                    <th className="p-2 border-gray-600 bg-red-700">صادره</th>
                                    <th className="p-2 border-gray-600 bg-blue-800">مانده</th>
                                </tr>
                            </thead>
                            <tbody>
                                {kardexRows.length === 0 ? (
                                    <tr><td colSpan={8} className="p-4 text-gray-400">گردشی برای این کالا یافت نشد.</td></tr>
                                ) : (
                                    kardexRows.map((row, idx) => (
                                        <tr key={row.id} className={row.type === 'IN' ? 'in-row' : 'out-row'}>
                                            <td>{idx + 1}</td>
                                            <td className="font-mono">{formatDate(row.date)}</td>
                                            <td>{row.type === 'IN' ? <span className="text-green-700 font-bold flex items-center justify-center gap-1"><ArrowDownCircle size={10}/> ورود</span> : <span className="text-red-700 font-bold flex items-center justify-center gap-1"><ArrowUpCircle size={10}/> خروج</span>}</td>
                                            <td className="font-mono font-bold">{row.number}</td>
                                            <td className="text-right pr-2">{row.description}</td>
                                            <td className="font-mono font-bold text-green-700 text-lg">{row.in > 0 ? row.in : '-'}</td>
                                            <td className="font-mono font-bold text-red-700 text-lg">{row.out > 0 ? row.out : '-'}</td>
                                            <td className="balance bg-gray-100 text-blue-800 text-lg">{row.balance}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            <tfoot>
                                <tr className="bg-gray-800 text-white font-bold">
                                    <td colSpan={5} className="p-2 text-left pl-4">جمع کل</td>
                                    <td className="p-2 dir-ltr font-mono">{kardexRows.reduce((a,b)=>a+b.in,0)}</td>
                                    <td className="p-2 dir-ltr font-mono">{kardexRows.reduce((a,b)=>a+b.out,0)}</td>
                                    <td className="p-2 dir-ltr font-mono bg-blue-900">{kardexRows.length > 0 ? kardexRows[kardexRows.length-1].balance : 0}</td>
                                </tr>
                            </tfoot>
                        </table>

                        <div className="mt-8 pt-4 border-t border-black flex justify-between text-[10px] text-gray-500">
                            <div>امضاء انباردار</div>
                            <div>امضاء مدیر انبار</div>
                            <div>سیستم مدیریت هوشمند انبار</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WarehouseKardexReport;
