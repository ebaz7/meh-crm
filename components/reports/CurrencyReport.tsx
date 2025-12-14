
import React, { useState, useEffect } from 'react';
import { TradeRecord } from '../../types';
import { formatNumberString, deformatNumberString, parsePersianDate, getCurrentShamsiDate } from '../../constants';
import { FileSpreadsheet, Printer, FileDown, Filter, RefreshCw, X, Loader2 } from 'lucide-react';

interface CurrencyReportProps {
    records: TradeRecord[];
}

interface ExchangeRates {
    eurToUsd: number;
    aedToUsd: number;
    cnyToUsd: number;
    tryToUsd: number;
}

const STORAGE_KEY_RATES = 'currency_report_rates_v1';

const CurrencyReport: React.FC<CurrencyReportProps> = ({ records }) => {
    // -- State --
    const [rates, setRates] = useState<ExchangeRates>({
        eurToUsd: 1.08,
        aedToUsd: 0.272,
        cnyToUsd: 0.14,
        tryToUsd: 0.03
    });
    
    const [selectedYear, setSelectedYear] = useState<number>(getCurrentShamsiDate().year);
    const [searchTerm, setSearchTerm] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [showRates, setShowRates] = useState(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    // Advanced Filters
    const [filters, setFilters] = useState({
        company: '',
        bank: '',
        currencyType: ''
    });

    // Helper Data
    const availableCompanies = Array.from(new Set(records.map(r => r.company).filter(Boolean)));
    const availableBanks = Array.from(new Set(records.map(r => r.operatingBank).filter(Boolean)));
    const years = Array.from({ length: 5 }, (_, i) => getCurrentShamsiDate().year - 2 + i);

    useEffect(() => {
        const savedRates = localStorage.getItem(STORAGE_KEY_RATES);
        if (savedRates) setRates(JSON.parse(savedRates));
    }, []);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY_RATES, JSON.stringify(rates));
    }, [rates]);

    const getWeeksPassed = (year: number) => {
        const currentShamsi = getCurrentShamsiDate();
        if (year < currentShamsi.year) return 52;
        if (year > currentShamsi.year) return 0;
        
        // Calculate weeks passed in current year
        // Approx: Month * 4.3 + Day/7
        const daysPassed = (currentShamsi.month - 1) * 30 + currentShamsi.day + (currentShamsi.month > 6 ? 6 : 0); // Roughly
        // More precise logic for first 6 months (31 days)
        let totalDays = 0;
        for (let m = 1; m < currentShamsi.month; m++) {
            totalDays += (m <= 6 ? 31 : 30);
        }
        totalDays += currentShamsi.day;
        
        const weeks = totalDays / 7;
        return weeks > 0 ? weeks : 1; 
    };

    const weeksPassed = getWeeksPassed(selectedYear);

    // -- Data Processing (Flatten Tranches) --
    const processedRows = React.useMemo(() => {
        let rows: any[] = [];

        records.forEach(r => {
            // Filter by record-level fields
            if (filters.company && r.company !== filters.company) return;
            if (filters.bank && r.operatingBank !== filters.bank) return;
            
            // NOTE: Removed exclusion of 'Completed'/'Archived' status as per request.

            const tranches = r.currencyPurchaseData?.tranches || [];
            
            // Backward compatibility
            if (tranches.length === 0 && (r.currencyPurchaseData?.purchasedAmount || 0) > 0) {
                // Filter by YEAR
                const pDate = r.currencyPurchaseData?.purchaseDate;
                if (!pDate) return;
                const pYear = parseInt(pDate.split('/')[0]);
                if (pYear !== selectedYear) return;

                rows.push({
                    recordId: r.id,
                    fileNumber: r.fileNumber,
                    orderNumber: r.orderNumber || r.fileNumber,
                    registrationNumber: r.registrationNumber,
                    goodsName: r.goodsName,
                    company: r.company,
                    currencyType: r.currencyPurchaseData?.purchasedCurrencyType || r.mainCurrency || 'EUR',
                    originalAmount: r.currencyPurchaseData?.purchasedAmount || 0,
                    purchaseDate: pDate,
                    rate: 0,
                    exchangeName: r.currencyPurchaseData?.exchangeName || '-',
                    isDelivered: r.currencyPurchaseData?.isDelivered,
                    bank: r.operatingBank,
                    trackingCode: '-',
                    deliveredAmount: r.currencyPurchaseData?.deliveredAmount || 0,
                    returnAmount: 0,
                    returnDate: '-'
                });
            } else {
                tranches.forEach(t => {
                    const pDate = t.date;
                    if (!pDate) return;
                    const pYear = parseInt(pDate.split('/')[0]);
                    if (pYear !== selectedYear) return;

                    rows.push({
                        recordId: r.id,
                        fileNumber: r.fileNumber,
                        orderNumber: r.orderNumber || r.fileNumber,
                        registrationNumber: r.registrationNumber,
                        goodsName: r.goodsName,
                        company: r.company,
                        currencyType: t.currencyType,
                        originalAmount: t.amount,
                        purchaseDate: t.date,
                        rate: t.rate || 0,
                        exchangeName: t.exchangeName || '-',
                        brokerName: t.brokerName || '-',
                        isDelivered: t.isDelivered,
                        bank: r.operatingBank,
                        trackingCode: t.id.substring(0, 5).toUpperCase(),
                        deliveredAmount: t.isDelivered ? t.amount : 0,
                        returnAmount: 0,
                        returnDate: '-'
                    });
                });
            }
        });

        // Search Filter
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            rows = rows.filter(row => 
                row.fileNumber.toLowerCase().includes(term) ||
                row.goodsName.toLowerCase().includes(term) ||
                row.company.toLowerCase().includes(term) ||
                row.exchangeName.toLowerCase().includes(term)
            );
        }

        // Currency Filter
        if (filters.currencyType) {
            rows = rows.filter(row => row.currencyType === filters.currencyType);
        }

        // Calculate USD and Rial
        return rows.map(row => {
            let usdRate = 1;
            if (row.currencyType === 'EUR') usdRate = rates.eurToUsd;
            else if (row.currencyType === 'AED') usdRate = rates.aedToUsd;
            else if (row.currencyType === 'CNY') usdRate = rates.cnyToUsd;
            else if (row.currencyType === 'TRY') usdRate = rates.tryToUsd;
            else if (row.currencyType === 'USD') usdRate = 1;

            const usdAmount = row.originalAmount * usdRate;
            const rialAmount = row.originalAmount * (row.rate || 0);

            return { ...row, usdAmount, rialAmount };
        });
    }, [records, filters, searchTerm, rates, selectedYear]);

    // -- Totals --
    const totalOriginal = processedRows.reduce((sum, r) => sum + r.originalAmount, 0);
    const totalUSD = processedRows.reduce((sum, r) => sum + r.usdAmount, 0);
    const totalRial = processedRows.reduce((sum, r) => sum + r.rialAmount, 0);

    // -- Summary By Company --
    const summaryByCompany = React.useMemo(() => {
        const summary: Record<string, number> = {};
        processedRows.forEach(row => {
            const comp = row.company || 'نامشخص';
            summary[comp] = (summary[comp] || 0) + row.usdAmount;
        });
        return Object.entries(summary).map(([name, total]) => ({
            name,
            total,
            weeklyAvg: weeksPassed > 0 ? total / weeksPassed : 0
        })).sort((a,b) => b.total - a.total);
    }, [processedRows, weeksPassed]);

    // -- Export Handlers --
    const handlePrint = () => {
        const style = document.getElementById('page-size-style');
        if (style) style.innerHTML = '@page { size: A4 landscape; margin: 0; }';
        setTimeout(() => window.print(), 500);
    };

    const handleDownloadPDF = async () => {
        setIsGeneratingPdf(true);
        const element = document.getElementById('currency-report-print-area');
        if (!element) { setIsGeneratingPdf(false); return; }
        try {
            // @ts-ignore
            const canvas = await window.html2canvas(element, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
            const imgData = canvas.toDataURL('image/png');
            // @ts-ignore
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
            const pdfWidth = 297;
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`Currency_Report_${selectedYear}.pdf`);
        } catch (e) { console.error(e); alert('خطا در ایجاد PDF'); }
        finally { setIsGeneratingPdf(false); }
    };

    const handleExportExcel = () => {
        // Simple CSV Export
        const headers = ["ردیف", "شرح کالا", "شماره پرونده", "شرکت", "دلار معادل", "تاریخ"];
        const rows = [headers.join(",")];
        processedRows.forEach((r, idx) => {
            rows.push(`${idx+1},"${r.goodsName}","${r.fileNumber}","${r.company}",${r.usdAmount},${r.purchaseDate}`);
        });
        const blob = new Blob(["\uFEFF" + rows.join("\n")], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `Currency_Report_${selectedYear}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const formatUSD = (val: number) => val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

    return (
        <div className="bg-white p-4 rounded-lg shadow-sm border h-full flex flex-col">
            {/* Controls */}
            <div className="bg-gray-100 p-3 rounded mb-4 border border-gray-200 no-print">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex gap-2 items-center flex-wrap">
                        <div className="flex items-center gap-2 bg-white border rounded px-2 py-1">
                            <span className="text-xs font-bold text-gray-600">سال مالی:</span>
                            <select className="bg-transparent text-sm font-bold outline-none" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
                                {years.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                        <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm ${showFilters ? 'bg-blue-200 text-blue-800' : 'bg-white border text-gray-700'}`}>
                            <Filter size={16}/> فیلترها
                        </button>
                        <button onClick={() => setShowRates(!showRates)} className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm ${showRates ? 'bg-indigo-200 text-indigo-800' : 'bg-white border text-gray-700'}`}>
                            <RefreshCw size={16}/> نرخ تبدیل
                        </button>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleExportExcel} className="bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700 flex items-center gap-1 text-xs"><FileSpreadsheet size={14}/> اکسل</button>
                        <button onClick={handleDownloadPDF} disabled={isGeneratingPdf} className="bg-red-600 text-white px-3 py-1.5 rounded hover:bg-red-700 flex items-center gap-1 text-xs">{isGeneratingPdf ? <Loader2 size={14} className="animate-spin"/> : <FileDown size={14}/>} PDF</button>
                        <button onClick={handlePrint} className="bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 flex items-center gap-1 text-xs"><Printer size={14}/> چاپ</button>
                    </div>
                </div>

                {/* Filters Panel */}
                {showFilters && (
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-white p-3 rounded border animate-fade-in">
                        <div><label className="text-[10px] font-bold block mb-1">جستجو</label><input className="w-full border rounded p-1 text-sm" placeholder="..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
                        <div><label className="text-[10px] font-bold block mb-1">شرکت</label><select className="w-full border rounded p-1 text-sm" value={filters.company} onChange={e => setFilters({...filters, company: e.target.value})}><option value="">همه</option>{availableCompanies.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                        <div><label className="text-[10px] font-bold block mb-1">بانک</label><select className="w-full border rounded p-1 text-sm" value={filters.bank} onChange={e => setFilters({...filters, bank: e.target.value})}><option value="">همه</option>{availableBanks.map(b => <option key={b} value={b}>{b}</option>)}</select></div>
                        <div><label className="text-[10px] font-bold block mb-1">نوع ارز</label><select className="w-full border rounded p-1 text-sm" value={filters.currencyType} onChange={e => setFilters({...filters, currencyType: e.target.value})}><option value="">همه</option><option value="EUR">یورو</option><option value="AED">درهم</option><option value="CNY">یوان</option><option value="USD">دلار</option></select></div>
                        <div className="md:col-span-4 flex justify-end"><button onClick={() => { setFilters({company:'', bank:'', currencyType:'', startDate:'', endDate:''}); setSearchTerm(''); }} className="text-xs text-red-500 flex items-center gap-1"><X size={12}/> پاک کردن فیلترها</button></div>
                    </div>
                )}

                {/* Rates Panel */}
                {showRates && (
                    <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 bg-white p-3 rounded border border-indigo-100 animate-fade-in">
                        <div><label className="block text-[10px] text-gray-500 font-bold">یورو به دلار (EUR)</label><input type="number" step="0.01" className="w-full border rounded p-1 text-center dir-ltr font-bold text-sm" value={rates.eurToUsd} onChange={e => setRates({...rates, eurToUsd: parseFloat(e.target.value) || 0})} /></div>
                        <div><label className="block text-[10px] text-gray-500 font-bold">درهم به دلار (AED)</label><input type="number" step="0.001" className="w-full border rounded p-1 text-center dir-ltr font-bold text-sm" value={rates.aedToUsd} onChange={e => setRates({...rates, aedToUsd: parseFloat(e.target.value) || 0})} /></div>
                        <div><label className="block text-[10px] text-gray-500 font-bold">یوان به دلار (CNY)</label><input type="number" step="0.001" className="w-full border rounded p-1 text-center dir-ltr font-bold text-sm" value={rates.cnyToUsd} onChange={e => setRates({...rates, cnyToUsd: parseFloat(e.target.value) || 0})} /></div>
                        <div><label className="block text-[10px] text-gray-500 font-bold">لیر به دلار (TRY)</label><input type="number" step="0.001" className="w-full border rounded p-1 text-center dir-ltr font-bold text-sm" value={rates.tryToUsd} onChange={e => setRates({...rates, tryToUsd: parseFloat(e.target.value) || 0})} /></div>
                    </div>
                )}
            </div>

            {/* Report Table Area (Printable) */}
            <div className="flex-1 overflow-auto flex justify-center">
                <div id="currency-report-print-area" className="printable-content bg-white w-full max-w-[297mm] p-4 text-black text-[10px] relative">
                    
                    {/* Header */}
                    <div className="border border-black mb-1 text-center">
                        <div className="bg-gray-200 font-bold py-2 border-b border-black text-sm">
                            گزارش جامع خرید ارز - سال {selectedYear}
                        </div>
                        <div className="flex justify-between px-2 py-1 bg-white">
                            <span>تاریخ گزارش: {new Date().toLocaleDateString('fa-IR')}</span>
                            {filters.company && <span>شرکت: {filters.company}</span>}
                        </div>
                    </div>

                    {/* Main Table */}
                    <table className="w-full border-collapse border border-black text-center mb-4">
                        <thead>
                            <tr className="bg-gray-100">
                                <th rowSpan={2} className="border border-black p-1 w-8">ردیف</th>
                                <th rowSpan={2} className="border border-black p-1">شرح کالا</th>
                                <th rowSpan={2} className="border border-black p-1">شماره سفارش<br/>(پرونده)</th>
                                <th rowSpan={2} className="border border-black p-1">شماره ثبت<br/>سفارش</th>
                                <th rowSpan={2} className="border border-black p-1">نام شرکت</th>
                                <th colSpan={3} className="border border-black p-1 bg-blue-50">ارز خریداری شده</th>
                                <th rowSpan={2} className="border border-black p-1">تاریخ<br/>خرید ارز</th>
                                <th rowSpan={2} className="border border-black p-1">ارز خریداری شده<br/>(ریال)</th>
                                <th rowSpan={2} className="border border-black p-1">محل ارسال<br/>(صرافی)</th>
                                <th rowSpan={2} className="border border-black p-1">کد رهگیری<br/>(تراکنش)</th>
                                <th rowSpan={2} className="border border-black p-1">ارز موجود<br/>نزد هر بانک</th>
                                <th colSpan={2} className="border border-black p-1 bg-green-50">وضعیت تحویل</th>
                                <th colSpan={2} className="border border-black p-1 bg-red-50">عودت</th>
                            </tr>
                            <tr className="bg-gray-100">
                                <th className="border border-black p-1 text-[9px]">(دلار آمریکا)</th>
                                <th className="border border-black p-1 text-[9px]">مقدار</th>
                                <th className="border border-black p-1 text-[9px]">نوع</th>
                                <th className="border border-black p-1 text-[9px]">مقدار تحویل شده</th>
                                <th className="border border-black p-1 text-[9px]">وضعیت</th>
                                <th className="border border-black p-1 text-[9px]">مبلغ</th>
                                <th className="border border-black p-1 text-[9px]">تاریخ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {processedRows.map((row, index) => (
                                <tr key={`${row.recordId}_${index}`} className="hover:bg-gray-50 leading-tight">
                                    <td className="border border-black p-1">{index + 1}</td>
                                    <td className="border border-black p-1 text-right truncate max-w-[100px]" title={row.goodsName}>{row.goodsName}</td>
                                    <td className="border border-black p-1 font-mono">{row.fileNumber}</td>
                                    <td className="border border-black p-1 font-mono">{row.registrationNumber || '-'}</td>
                                    <td className="border border-black p-1">{row.company}</td>
                                    <td className="border border-black p-1 font-mono font-bold bg-blue-50/30">{formatUSD(row.usdAmount)}</td>
                                    <td className="border border-black p-1 font-mono">{formatNumberString(row.originalAmount)}</td>
                                    <td className="border border-black p-1">{row.currencyType}</td>
                                    <td className="border border-black p-1 dir-ltr">{row.purchaseDate}</td>
                                    <td className="border border-black p-1 font-mono">{row.rialAmount > 0 ? formatNumberString(row.rialAmount) : '-'}</td>
                                    <td className="border border-black p-1 text-[9px] truncate max-w-[80px]" title={row.exchangeName}>{row.exchangeName}</td>
                                    <td className="border border-black p-1 font-mono text-[9px]">{row.trackingCode}</td>
                                    <td className="border border-black p-1">{row.bank}</td>
                                    <td className="border border-black p-1 font-mono bg-green-50/30">{formatNumberString(row.deliveredAmount)}</td>
                                    <td className="border border-black p-1">{row.isDelivered ? '✅' : '⏳'}</td>
                                    <td className="border border-black p-1 bg-red-50/30">{row.returnAmount > 0 ? formatNumberString(row.returnAmount) : '-'}</td>
                                    <td className="border border-black p-1 bg-red-50/30">{row.returnDate}</td>
                                </tr>
                            ))}
                            {processedRows.length === 0 && (
                                <tr><td colSpan={18} className="border border-black p-4 text-gray-400">اطلاعاتی یافت نشد</td></tr>
                            )}
                            <tr className="bg-gray-200 font-bold text-[9px]">
                                <td colSpan={5} className="border border-black p-1 text-center">جمع کل</td>
                                <td className="border border-black p-1 dir-ltr">{formatUSD(totalUSD)}</td>
                                <td className="border border-black p-1 dir-ltr">{formatNumberString(totalOriginal)}</td>
                                <td className="border border-black p-1">-</td>
                                <td className="border border-black p-1">-</td>
                                <td className="border border-black p-1 dir-ltr">{formatNumberString(totalRial)}</td>
                                <td colSpan={8} className="border border-black p-1"></td>
                            </tr>
                        </tbody>
                    </table>

                    {/* Summary Table */}
                    <div className="border border-black mt-4 page-break-inside-avoid">
                        <div className="bg-blue-100 font-bold py-1 border-b border-black text-center text-sm">
                            خلاصه عملکرد شرکت‌ها در سال {selectedYear}
                        </div>
                        <table className="w-full border-collapse text-center">
                            <thead>
                                <tr className="bg-blue-50 text-[10px]">
                                    <th className="border-b border-l border-black p-1">نام شرکت</th>
                                    <th className="border-b border-l border-black p-1">جمع کل خرید (دلار)</th>
                                    <th className="border-b border-black p-1">میانگین هفتگی (دلار)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {summaryByCompany.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-blue-50/50">
                                        <td className="border-b border-l border-black p-1 font-bold">{item.name}</td>
                                        <td className="border-b border-l border-black p-1 dir-ltr font-mono">{formatUSD(item.total)}</td>
                                        <td className="border-b border-black p-1 dir-ltr font-mono text-blue-700">{formatUSD(item.weeklyAvg)}</td>
                                    </tr>
                                ))}
                                <tr className="bg-gray-200 font-black">
                                    <td className="border-l border-black p-1">جمع کل</td>
                                    <td className="border-l border-black p-1 dir-ltr">{formatUSD(totalUSD)}</td>
                                    <td className="p-1 dir-ltr">{formatUSD(weeksPassed > 0 ? totalUSD / weeksPassed : 0)}</td>
                                </tr>
                            </tbody>
                        </table>
                        <div className="text-[9px] text-gray-500 p-1 text-center bg-gray-50 border-t border-black">
                            تعداد هفته‌های سپری شده از سال: {Math.round(weeksPassed)}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default CurrencyReport;
