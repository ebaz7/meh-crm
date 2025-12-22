
import React, { useState, useEffect } from 'react';
import { TradeRecord } from '../../types';
import { formatNumberString, deformatNumberString, getCurrentShamsiDate } from '../../constants';
import { FileSpreadsheet, Printer, FileDown, RefreshCw, Loader2, Settings } from 'lucide-react';
import { generatePdf } from '../../utils/pdfGenerator'; 

interface Props {
    records: TradeRecord[];
}

interface ExchangeRates {
    eurToUsd: number;
    aedToUsd: number;
    cnyToUsd: number;
    tryToUsd: number;
}

const STORAGE_KEY_RATES = 'currency_report_rates_v1';

const CompanyPerformanceReport: React.FC<Props> = ({ records }) => {
    // -- State --
    const [rates, setRates] = useState<ExchangeRates>({
        eurToUsd: 1.08,
        aedToUsd: 0.272,
        cnyToUsd: 0.14,
        tryToUsd: 0.03
    });
    
    const [selectedYear, setSelectedYear] = useState<number>(getCurrentShamsiDate().year);
    const [showRates, setShowRates] = useState(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

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
        
        let totalDays = 0;
        for (let m = 1; m < currentShamsi.month; m++) {
            totalDays += (m <= 6 ? 31 : 30);
        }
        totalDays += currentShamsi.day;
        
        const weeks = totalDays / 7;
        return weeks > 0 ? weeks : 1; 
    };

    const weeksPassed = getWeeksPassed(selectedYear);

    const summaryByCompany = React.useMemo(() => {
        const summary: Record<string, number> = {};
        let totalAll = 0;

        records.forEach(r => {
            const tranches = r.currencyPurchaseData?.tranches || [];
            
            if (tranches.length === 0 && (r.currencyPurchaseData?.purchasedAmount || 0) > 0) {
                const pDate = r.currencyPurchaseData?.purchaseDate;
                if (!pDate) return;
                const pYear = parseInt(pDate.split('/')[0]);
                if (pYear !== selectedYear) return;

                const amount = r.currencyPurchaseData?.purchasedAmount || 0;
                const type = r.currencyPurchaseData?.purchasedCurrencyType || r.mainCurrency || 'EUR';
                
                let usdRate = 1;
                if (type === 'EUR') usdRate = rates.eurToUsd;
                else if (type === 'AED') usdRate = rates.aedToUsd;
                else if (type === 'CNY') usdRate = rates.cnyToUsd;
                else if (type === 'TRY') usdRate = rates.tryToUsd;

                const usdAmount = amount * usdRate;
                const comp = r.company || 'نامشخص';
                summary[comp] = (summary[comp] || 0) + usdAmount;
                totalAll += usdAmount;
            } else {
                tranches.forEach(t => {
                    const pDate = t.date;
                    if (!pDate) return;
                    const pYear = parseInt(pDate.split('/')[0]);
                    if (pYear !== selectedYear) return;

                    let usdRate = 1;
                    if (t.currencyType === 'EUR') usdRate = rates.eurToUsd;
                    else if (t.currencyType === 'AED') usdRate = rates.aedToUsd;
                    else if (t.currencyType === 'CNY') usdRate = rates.cnyToUsd;
                    else if (t.currencyType === 'TRY') usdRate = rates.tryToUsd;

                    const usdAmount = t.amount * usdRate;
                    const comp = r.company || 'نامشخص';
                    summary[comp] = (summary[comp] || 0) + usdAmount;
                    totalAll += usdAmount;
                });
            }
        });

        return {
            details: Object.entries(summary).map(([name, total]) => ({
                name,
                total,
                weeklyAvg: weeksPassed > 0 ? total / weeksPassed : 0
            })).sort((a,b) => b.total - a.total),
            totalAll
        };
    }, [records, rates, selectedYear, weeksPassed]);

    const formatUSD = (val: number) => val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

    const handlePrint = () => {
        const style = document.getElementById('page-size-style');
        if (style) style.innerHTML = '@page { size: A4 portrait; margin: 10mm; }';
        setTimeout(() => window.print(), 800);
    };

    const handleDownloadPDF = async () => {
        setIsGeneratingPdf(true);
        await generatePdf({
            elementId: 'performance-report-print-area',
            filename: `Company_Performance_${selectedYear}.pdf`,
            format: 'a4',
            orientation: 'portrait',
            onComplete: () => setIsGeneratingPdf(false),
            onError: () => { alert('خطا در ایجاد PDF'); setIsGeneratingPdf(false); }
        });
    };

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
                        <button onClick={() => setShowRates(!showRates)} className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm ${showRates ? 'bg-indigo-200 text-indigo-800' : 'bg-white border text-gray-700'}`}>
                            <RefreshCw size={16}/> نرخ تبدیل
                        </button>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleDownloadPDF} disabled={isGeneratingPdf} className="bg-red-600 text-white px-3 py-1.5 rounded hover:bg-red-700 flex items-center gap-1 text-xs">{isGeneratingPdf ? <Loader2 size={14} className="animate-spin"/> : <FileDown size={14}/>} PDF</button>
                        <button onClick={handlePrint} className="bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 flex items-center gap-1 text-xs"><Printer size={14}/> چاپ</button>
                    </div>
                </div>

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

            {/* Printable Report Area */}
            <div className="flex-1 overflow-auto flex justify-center bg-gray-50 p-4">
                <div id="performance-report-print-area" className="printable-content bg-white p-8 shadow-2xl relative text-black" 
                    style={{ 
                        // A4 Portrait
                        width: '210mm', 
                        minHeight: '297mm', 
                        direction: 'rtl',
                        padding: '10mm', 
                        boxSizing: 'border-box'
                    }}>
                    
                    <div className="border border-black mb-4">
                        <div className="bg-blue-100 font-black py-3 border-b border-black text-center text-lg">
                            خلاصه عملکرد شرکت‌ها در سال {selectedYear}
                        </div>
                        <div className="flex justify-between px-4 py-2 bg-gray-50 text-xs font-bold border-b border-black">
                            <span>تاریخ گزارش: {new Date().toLocaleDateString('fa-IR')}</span>
                            <span>تعداد هفته‌های سپری شده: {Math.round(weeksPassed)}</span>
                        </div>
                        <div className="bg-yellow-50 text-center py-1 text-[10px] text-gray-600">
                            * این گزارش شامل تمامی خریدها (جاری و بایگانی شده) در سال {selectedYear} می‌باشد.
                        </div>
                    </div>

                    <table className="w-full border-collapse text-center border border-black">
                        <thead>
                            <tr className="bg-blue-50 text-xs">
                                <th className="border-b border-l border-black p-3 font-black">نام شرکت</th>
                                <th className="border-b border-l border-black p-3 font-black">جمع کل خرید (دلار)</th>
                                <th className="border-b border-black p-3 font-black">میانگین هفتگی (دلار)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {summaryByCompany.details.map((item, idx) => (
                                <tr key={idx} className="hover:bg-blue-50/50">
                                    <td className="border-b border-l border-black p-3 font-bold text-sm">{item.name}</td>
                                    <td className="border-b border-l border-black p-3 dir-ltr font-black font-mono text-sm bg-gray-50">{formatUSD(item.total)}</td>
                                    <td className="border-b border-black p-3 dir-ltr font-black font-mono text-sm text-blue-800">{formatUSD(item.weeklyAvg)}</td>
                                </tr>
                            ))}
                            <tr className="bg-gray-800 text-white font-black text-base">
                                <td className="border-l border-white p-3">جمع کل</td>
                                <td className="border-l border-white p-3 dir-ltr">{formatUSD(summaryByCompany.totalAll)}</td>
                                <td className="p-3 dir-ltr">{formatUSD(weeksPassed > 0 ? summaryByCompany.totalAll / weeksPassed : 0)}</td>
                            </tr>
                        </tbody>
                    </table>

                    <div className="mt-8 text-center text-xs text-gray-400">
                        سیستم مدیریت مالی و بازرگانی - گزارش سیستمی
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CompanyPerformanceReport;
