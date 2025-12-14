
import React, { useState, useEffect } from 'react';
import { TradeRecord } from '../../types';
import { formatNumberString, deformatNumberString, parsePersianDate, getCurrentShamsiDate, formatCurrency } from '../../constants';
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
        currencyType: '',
        archiveStatus: 'active' as 'active' | 'archive' | 'all' // New Filter
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
        let totalDays = 0;
        for (let m = 1; m < currentShamsi.month; m++) {
            totalDays += (m <= 6 ? 31 : 30);
        }
        totalDays += currentShamsi.day;
        
        const weeks = totalDays / 7;
        return weeks > 0 ? weeks : 1; 
    };

    const weeksPassed = getWeeksPassed(selectedYear);

    // -- Data Processing for Main Table (With Grouping/RowSpan) --
    const processedGroups = React.useMemo(() => {
        const groups: any[] = [];

        records.forEach(r => {
            // 1. Filter by Archive Status
            if (filters.archiveStatus === 'active' && (r.status === 'Completed' || r.isArchived)) return;
            if (filters.archiveStatus === 'archive' && !(r.status === 'Completed' || r.isArchived)) return;

            // 2. Standard Filters
            if (filters.company && r.company !== filters.company) return;
            if (filters.bank && r.operatingBank !== filters.bank) return;
            
            // Search Filter
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                const matches = 
                    r.fileNumber.toLowerCase().includes(term) ||
                    r.goodsName.toLowerCase().includes(term) ||
                    r.company.toLowerCase().includes(term) ||
                    r.currencyPurchaseData?.exchangeName?.includes(term);
                if (!matches) return;
            }

            const tranches = r.currencyPurchaseData?.tranches || [];
            const recordTranches: any[] = [];

            // Legacy Handling
            if (tranches.length === 0 && (r.currencyPurchaseData?.purchasedAmount || 0) > 0) {
                const pDate = r.currencyPurchaseData?.purchaseDate;
                if (pDate && parseInt(pDate.split('/')[0]) === selectedYear) {
                    // Currency Filter
                    const cType = r.currencyPurchaseData?.purchasedCurrencyType || r.mainCurrency || 'EUR';
                    if (filters.currencyType && cType !== filters.currencyType) return;

                    let usdRate = 1;
                    if (cType === 'EUR') usdRate = rates.eurToUsd;
                    else if (cType === 'AED') usdRate = rates.aedToUsd;
                    else if (cType === 'CNY') usdRate = rates.cnyToUsd;
                    else if (cType === 'TRY') usdRate = rates.tryToUsd;

                    recordTranches.push({
                        currencyType: cType,
                        originalAmount: r.currencyPurchaseData?.purchasedAmount || 0,
                        usdAmount: (r.currencyPurchaseData?.purchasedAmount || 0) * usdRate,
                        purchaseDate: pDate,
                        rialAmount: 0,
                        exchangeName: r.currencyPurchaseData?.exchangeName || '-',
                        brokerName: r.currencyPurchaseData?.brokerName || '-',
                        isDelivered: r.currencyPurchaseData?.isDelivered,
                        deliveredAmount: r.currencyPurchaseData?.deliveredAmount || 0,
                        returnAmount: 0,
                        returnDate: '-'
                    });
                }
            } else {
                tranches.forEach(t => {
                    const pDate = t.date;
                    if (pDate && parseInt(pDate.split('/')[0]) === selectedYear) {
                        if (filters.currencyType && t.currencyType !== filters.currencyType) return;

                        let usdRate = 1;
                        if (t.currencyType === 'EUR') usdRate = rates.eurToUsd;
                        else if (t.currencyType === 'AED') usdRate = rates.aedToUsd;
                        else if (t.currencyType === 'CNY') usdRate = rates.cnyToUsd;
                        else if (t.currencyType === 'TRY') usdRate = rates.tryToUsd;

                        recordTranches.push({
                            currencyType: t.currencyType,
                            originalAmount: t.amount,
                            usdAmount: t.amount * usdRate,
                            purchaseDate: t.date,
                            rialAmount: t.amount * (t.rate || 0),
                            exchangeName: t.exchangeName || '-',
                            brokerName: t.brokerName || '-', // Replaces Tracking Code
                            isDelivered: t.isDelivered,
                            deliveredAmount: t.isDelivered ? t.amount : 0,
                            // @ts-ignore
                            returnAmount: t.returnAmount || 0, // New Field
                            // @ts-ignore
                            returnDate: t.returnDate || '-'    // New Field
                        });
                    }
                });
            }

            if (recordTranches.length > 0) {
                groups.push({
                    recordInfo: {
                        goodsName: r.goodsName,
                        fileNumber: r.fileNumber,
                        orderNumber: r.orderNumber || r.fileNumber,
                        registrationNumber: r.registrationNumber,
                        company: r.company,
                        bank: r.operatingBank
                    },
                    tranches: recordTranches
                });
            }
        });

        return groups;
    }, [records, filters, searchTerm, rates, selectedYear]);

    // -- Totals for Main Table --
    const tableTotals = processedGroups.reduce((acc, group) => {
        group.tranches.forEach((t: any) => {
            acc.usd += t.usdAmount;
            acc.original += t.originalAmount;
            acc.rial += t.rialAmount;
        });
        return acc;
    }, { usd: 0, original: 0, rial: 0 });

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
        const headers = ["ردیف", "شرح کالا", "شماره پرونده", "شرکت", "دلار معادل", "تاریخ", "کارگزار", "مبلغ عودت"];
        const rows = [headers.join(",")];
        let idx = 1;
        processedGroups.forEach(g => {
            g.tranches.forEach((t: any) => {
                rows.push(`${idx},"${g.recordInfo.goodsName}","${g.recordInfo.fileNumber}","${g.recordInfo.company}",${t.usdAmount},${t.purchaseDate},"${t.brokerName}",${t.returnAmount}`);
                idx++;
            });
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
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 bg-white p-3 rounded border animate-fade-in">
                        <div><label className="text-[10px] font-bold block mb-1">جستجو</label><input className="w-full border rounded p-1 text-sm" placeholder="..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
                        <div><label className="text-[10px] font-bold block mb-1">شرکت</label><select className="w-full border rounded p-1 text-sm" value={filters.company} onChange={e => setFilters({...filters, company: e.target.value})}><option value="">همه</option>{availableCompanies.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                        <div><label className="text-[10px] font-bold block mb-1">بانک</label><select className="w-full border rounded p-1 text-sm" value={filters.bank} onChange={e => setFilters({...filters, bank: e.target.value})}><option value="">همه</option>{availableBanks.map(b => <option key={b} value={b}>{b}</option>)}</select></div>
                        <div><label className="text-[10px] font-bold block mb-1">وضعیت بایگانی</label><select className="w-full border rounded p-1 text-sm" value={filters.archiveStatus} onChange={e => setFilters({...filters, archiveStatus: e.target.value as any})}><option value="active">پرونده‌های جاری</option><option value="archive">بایگانی شده</option><option value="all">همه موارد</option></select></div>
                        <div className="md:col-span-5 flex justify-end"><button onClick={() => { setFilters({company:'', bank:'', currencyType:'', archiveStatus:'active'}); setSearchTerm(''); }} className="text-xs text-red-500 flex items-center gap-1"><X size={12}/> پاک کردن فیلترها</button></div>
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
                                <th rowSpan={2} className="border border-black p-1">کارگزار</th> {/* CHANGED FROM Tracking Code */}
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
                            {processedGroups.map((group, gIndex) => (
                                <React.Fragment key={gIndex}>
                                    {group.tranches.map((t: any, tIndex: number) => (
                                        <tr key={`${gIndex}_${tIndex}`} className="hover:bg-gray-50 leading-tight">
                                            {/* Row Span Logic: Only render details on first tranche */}
                                            {tIndex === 0 && (
                                                <>
                                                    <td className="border border-black p-1" rowSpan={group.tranches.length}>{gIndex + 1}</td>
                                                    <td className="border border-black p-1 text-right truncate max-w-[100px]" rowSpan={group.tranches.length} title={group.recordInfo.goodsName}>{group.recordInfo.goodsName}</td>
                                                    <td className="border border-black p-1 font-mono" rowSpan={group.tranches.length}>{group.recordInfo.fileNumber}</td>
                                                    <td className="border border-black p-1 font-mono" rowSpan={group.tranches.length}>{group.recordInfo.registrationNumber || '-'}</td>
                                                    <td className="border border-black p-1" rowSpan={group.tranches.length}>{group.recordInfo.company}</td>
                                                </>
                                            )}
                                            
                                            {/* Tranche Specific Data */}
                                            <td className="border border-black p-1 font-mono font-bold bg-blue-50/30">{formatUSD(t.usdAmount)}</td>
                                            <td className="border border-black p-1 font-mono">{formatNumberString(t.originalAmount)}</td>
                                            <td className="border border-black p-1">{t.currencyType}</td>
                                            <td className="border border-black p-1 dir-ltr">{t.purchaseDate}</td>
                                            <td className="border border-black p-1 font-mono">{t.rialAmount > 0 ? formatNumberString(t.rialAmount) : '-'}</td>
                                            <td className="border border-black p-1 text-[9px] truncate max-w-[80px]" title={t.exchangeName}>{t.exchangeName}</td>
                                            <td className="border border-black p-1 font-mono text-[9px]">{t.brokerName}</td> {/* Replaced Tracking Code */}
                                            
                                            {tIndex === 0 && <td className="border border-black p-1" rowSpan={group.tranches.length}>{group.recordInfo.bank}</td>}
                                            
                                            <td className="border border-black p-1 font-mono bg-green-50/30">{formatNumberString(t.deliveredAmount)}</td>
                                            <td className="border border-black p-1">{t.isDelivered ? '✅' : '⏳'}</td>
                                            <td className="border border-black p-1 bg-red-50/30">{t.returnAmount > 0 ? formatNumberString(t.returnAmount) : '-'}</td>
                                            <td className="border border-black p-1 bg-red-50/30">{t.returnDate}</td>
                                        </tr>
                                    ))}
                                </React.Fragment>
                            ))}
                            {processedGroups.length === 0 && (
                                <tr><td colSpan={18} className="border border-black p-4 text-gray-400">اطلاعاتی یافت نشد</td></tr>
                            )}
                            <tr className="bg-gray-200 font-bold text-[9px]">
                                <td colSpan={5} className="border border-black p-1 text-center">جمع کل</td>
                                <td className="border border-black p-1 dir-ltr">{formatUSD(tableTotals.usd)}</td>
                                <td className="border border-black p-1 dir-ltr">{formatNumberString(tableTotals.original)}</td>
                                <td className="border border-black p-1">-</td>
                                <td className="border border-black p-1">-</td>
                                <td className="border border-black p-1 dir-ltr">{formatNumberString(tableTotals.rial)}</td>
                                <td colSpan={8} className="border border-black p-1"></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default CurrencyReport;
