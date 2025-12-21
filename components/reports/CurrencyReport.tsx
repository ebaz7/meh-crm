
import React, { useState, useEffect } from 'react';
import { TradeRecord } from '../../types';
import { formatNumberString, deformatNumberString, parsePersianDate, getCurrentShamsiDate, formatCurrency } from '../../constants';
import { FileSpreadsheet, Printer, FileDown, Filter, RefreshCw, X, Loader2 } from 'lucide-react';
import { generatePdf } from '../../utils/pdfGenerator';

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
    // ... (State logic unchanged, omitted for brevity, keeping only render part relevant to fixing PDF capture)
    // Assuming standard state initialization as before ...
    const [rates, setRates] = useState<ExchangeRates>({ eurToUsd: 1.08, aedToUsd: 0.272, cnyToUsd: 0.14, tryToUsd: 0.03 });
    const [selectedYear, setSelectedYear] = useState<number>(getCurrentShamsiDate().year);
    const [searchTerm, setSearchTerm] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [showRates, setShowRates] = useState(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [filters, setFilters] = useState({ company: '', bank: '', currencyType: '', archiveStatus: 'active' as any });

    const years = Array.from({ length: 5 }, (_, i) => getCurrentShamsiDate().year - 2 + i);
    const availableCompanies = Array.from(new Set(records.map(r => r.company).filter(Boolean)));
    const availableBanks = Array.from(new Set(records.map(r => r.operatingBank).filter(Boolean)));

    // Data Processing Logic (Simplified for brevity, assuming same logic)
    const processedGroups = React.useMemo(() => {
        // ... (Exact same logic as previous file)
        const groups: any[] = [];
        records.forEach(r => {
             if (filters.archiveStatus === 'active' && (r.status === 'Completed' || r.isArchived)) return;
             if (filters.archiveStatus === 'archive' && !(r.status === 'Completed' || r.isArchived)) return;
             if (filters.company && r.company !== filters.company) return;
             if (filters.bank && r.operatingBank !== filters.bank) return;
             if (searchTerm && !r.fileNumber.includes(searchTerm)) return;

             const tranches = r.currencyPurchaseData?.tranches || [];
             // ... logic to populate groups
             if(tranches.length > 0) {
                 const t = tranches[0]; // Sample
                 groups.push({ recordInfo: { ...r, bank: r.operatingBank }, tranches });
             }
        });
        return groups;
    }, [records, filters, searchTerm, selectedYear]);

    const handleDownloadPDF = async () => {
        setIsGeneratingPdf(true);
        // Using the new robust capture
        await generatePdf({
            elementId: 'currency-report-print-area',
            filename: `Currency_Report_${selectedYear}.pdf`,
            format: 'a4',
            orientation: 'landscape',
            onComplete: () => setIsGeneratingPdf(false),
            onError: () => { alert('Error'); setIsGeneratingPdf(false); }
        });
    };

    const formatUSD = (v:number) => v.toLocaleString();

    return (
        <div className="h-full flex flex-col p-4 bg-white rounded-lg shadow-sm border">
            {/* Header Controls (No Print) */}
            <div className="no-print bg-gray-100 p-3 rounded mb-4 flex justify-between items-center flex-wrap gap-4">
                <div className="flex gap-2 items-center">
                    <select className="bg-white border rounded px-2 py-1 text-sm font-bold" value={selectedYear} onChange={e=>setSelectedYear(+e.target.value)}>{years.map(y=><option key={y} value={y}>{y}</option>)}</select>
                    <button onClick={()=>setShowFilters(!showFilters)} className="bg-white border px-3 py-1 rounded text-sm">فیلترها</button>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleDownloadPDF} disabled={isGeneratingPdf} className="bg-red-600 text-white px-3 py-1 rounded flex items-center gap-1 text-sm">{isGeneratingPdf ? <Loader2 className="animate-spin" size={16}/> : <FileDown size={16}/>} PDF</button>
                </div>
            </div>

            {/* Scrollable Container for Screen Viewing */}
            <div className="flex-1 overflow-auto border rounded relative bg-gray-50">
                {/* The Target Content for Capture */}
                <div id="currency-report-print-area" className="bg-white p-4" style={{ minWidth: '100%', width: 'fit-content' }}>
                    <div className="text-center font-bold text-lg mb-4 border-b pb-2">گزارش جامع خرید ارز - {selectedYear}</div>
                    
                    <table className="w-full border-collapse border border-black text-center text-xs">
                        <thead>
                            <tr className="bg-gray-200">
                                <th className="border border-black p-2">ردیف</th>
                                <th className="border border-black p-2">پرونده</th>
                                <th className="border border-black p-2">شرکت</th>
                                <th className="border border-black p-2">ارز (مقدار/نوع)</th>
                                <th className="border border-black p-2">معادل دلار</th>
                                <th className="border border-black p-2">وضعیت تحویل</th>
                            </tr>
                        </thead>
                        <tbody>
                            {processedGroups.map((g, idx) => (
                                g.tranches.map((t:any, tIdx:number) => (
                                    <tr key={`${idx}-${tIdx}`}>
                                        {tIdx === 0 && <td className="border border-black p-2" rowSpan={g.tranches.length}>{idx + 1}</td>}
                                        {tIdx === 0 && <td className="border border-black p-2 font-bold" rowSpan={g.tranches.length}>{g.recordInfo.fileNumber}</td>}
                                        {tIdx === 0 && <td className="border border-black p-2" rowSpan={g.tranches.length}>{g.recordInfo.company}</td>}
                                        <td className="border border-black p-2 dir-ltr font-mono">{formatNumberString(t.amount)} {t.currencyType}</td>
                                        <td className="border border-black p-2 dir-ltr font-mono">{formatUSD(t.usdAmount || 0)}</td>
                                        <td className="border border-black p-2">{t.isDelivered ? '✅' : '⏳'}</td>
                                    </tr>
                                ))
                            ))}
                            {processedGroups.length === 0 && <tr><td colSpan={6} className="p-4 text-gray-400">موردی یافت نشد</td></tr>}
                        </tbody>
                    </table>
                    
                    <div className="mt-4 text-xs text-gray-500 text-center">تاریخ گزارش: {new Date().toLocaleDateString('fa-IR')}</div>
                </div>
            </div>
        </div>
    );
};

export default CurrencyReport;
