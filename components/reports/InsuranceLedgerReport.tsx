
import React, { useState, useEffect } from 'react';
import { TradeRecord, SystemSettings } from '../../types';
import { formatCurrency, formatNumberString, parsePersianDate } from '../../constants';
import { Printer, FileDown, Search, Filter, X, Loader2 } from 'lucide-react';
import { generatePdf } from '../../utils/pdfGenerator'; 

interface Props {
    records: TradeRecord[];
    settings?: SystemSettings; // Added settings prop
}

const InsuranceLedgerReport: React.FC<Props> = ({ records, settings }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [selectedInsCompany, setSelectedInsCompany] = useState<string>('');

    // Extract unique insurance companies from records AND settings (Merged)
    const insuranceCompanies = React.useMemo(() => {
        const companies = new Set<string>();
        
        // 1. Add from settings
        if (settings?.insuranceCompanies) {
            settings.insuranceCompanies.forEach(c => companies.add(c));
        }

        // 2. Add from existing records (legacy support)
        records.forEach(r => {
            if (r.insuranceData?.company) companies.add(r.insuranceData.company);
        });
        
        return Array.from(companies).sort();
    }, [records, settings]);

    useEffect(() => {
        if (insuranceCompanies.length > 0 && !selectedInsCompany) {
            setSelectedInsCompany(insuranceCompanies[0]);
        }
    }, [insuranceCompanies]);

    // Calculate Ledger
    const ledgerData = React.useMemo(() => {
        if (!selectedInsCompany) return [];

        const rows: any[] = [];
        let runningBalance = 0; // Creditor (Hazine) - Debtor (Pardakht)

        // Filter records for this insurance company
        const filteredRecords = records.filter(r => 
            r.insuranceData?.company === selectedInsCompany &&
            (!searchTerm || r.fileNumber.includes(searchTerm) || r.goodsName.includes(searchTerm))
        );

        filteredRecords.forEach(r => {
            if (!r.insuranceData) return;

            // 1. Policy Cost (Creditor / Bestankar)
            if (r.insuranceData.cost > 0) {
                runningBalance += r.insuranceData.cost; // We owe them
                rows.push({
                    id: `cost_${r.id}`,
                    date: r.startDate ? new Date(r.startDate).toLocaleDateString('fa-IR') : '-',
                    desc: `هزینه بیمه - پرونده ${r.fileNumber} - کالا: ${r.goodsName} - بیمه نامه: ${r.insuranceData.policyNumber}`,
                    debtor: 0,
                    creditor: r.insuranceData.cost,
                    balance: runningBalance,
                    type: 'cost'
                });
            }

            // 2. Endorsements (Additions or Refunds)
            r.insuranceData.endorsements?.forEach(end => {
                if (end.amount !== 0) {
                    // Positive amount = Cost Increase = Creditor
                    // Negative amount = Refund = Debtor (reduces what we owe)
                    const isIncrease = end.amount > 0;
                    runningBalance += end.amount; // Adds if positive, subtracts if negative
                    
                    rows.push({
                        id: `end_${end.id}`,
                        date: end.date,
                        desc: `الحاقیه - پرونده ${r.fileNumber}: ${end.description}`,
                        debtor: !isIncrease ? Math.abs(end.amount) : 0,
                        creditor: isIncrease ? end.amount : 0,
                        balance: runningBalance,
                        type: 'endorsement'
                    });
                }
            });

            // 3. Payment (Debtor / Bedehkar) - Only if marked as Paid
            if (r.insuranceData.isPaid) {
                const totalPayable = r.insuranceData.cost + (r.insuranceData.endorsements?.reduce((acc, e) => acc + e.amount, 0) || 0);
                if (totalPayable > 0) {
                    runningBalance -= totalPayable; // We paid, balance reduces
                    rows.push({
                        id: `pay_${r.id}`,
                        date: r.insuranceData.paymentDate || '-',
                        desc: `پرداخت وجه (تسویه) - پرونده ${r.fileNumber} - بانک: ${r.insuranceData.bank || '-'}`,
                        debtor: totalPayable,
                        creditor: 0,
                        balance: runningBalance,
                        type: 'payment'
                    });
                }
            }
        });

        return rows;
    }, [records, selectedInsCompany, searchTerm]);

    const handlePrint = () => {
        const style = document.getElementById('page-size-style');
        if (style) style.innerHTML = '@page { size: A4 portrait; margin: 10mm; }';
        setTimeout(() => window.print(), 800);
    };

    const handleDownloadPDF = async () => {
        setIsGeneratingPdf(true);
        await generatePdf({
            elementId: 'insurance-ledger-print',
            filename: `Insurance_Ledger_${selectedInsCompany}.pdf`,
            format: 'a4',
            orientation: 'portrait',
            onComplete: () => setIsGeneratingPdf(false),
            onError: () => { alert('خطا در ایجاد PDF'); setIsGeneratingPdf(false); }
        });
    };

    return (
        <div className="bg-white p-4 rounded-lg shadow-sm border h-full flex flex-col">
            <div className="bg-gray-100 p-3 rounded mb-4 border border-gray-200 no-print flex flex-col md:flex-row gap-4 justify-between items-center">
                <div className="flex gap-2 items-center w-full md:w-auto">
                    <label className="text-sm font-bold text-gray-700">شرکت بیمه:</label>
                    <select className="border rounded p-2 text-sm flex-1 md:w-64" value={selectedInsCompany} onChange={e => setSelectedInsCompany(e.target.value)}>
                        {insuranceCompanies.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div className="relative w-full md:w-64">
                    <Search className="absolute right-3 top-2.5 text-gray-400" size={16}/>
                    <input className="w-full pl-4 pr-10 py-2 border rounded-lg text-sm" placeholder="جستجو (پرونده...)" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleDownloadPDF} disabled={isGeneratingPdf} className="bg-red-600 text-white px-3 py-2 rounded hover:bg-red-700 flex items-center gap-1 text-xs">{isGeneratingPdf ? <Loader2 size={14} className="animate-spin"/> : <FileDown size={14}/>} PDF</button>
                    <button onClick={handlePrint} className="bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 flex items-center gap-1 text-xs"><Printer size={14}/> چاپ</button>
                </div>
            </div>

            <div className="flex-1 overflow-auto flex justify-center bg-gray-50 p-4">
                <div id="insurance-ledger-print" className="printable-content bg-white p-8 shadow-2xl relative text-black" style={{ width: '210mm', minHeight: '297mm', direction: 'rtl', padding: '10mm', boxSizing: 'border-box' }}>
                    <div className="border border-black mb-4">
                        <div className="bg-gray-200 font-black py-3 border-b border-black text-center text-lg">صورتحساب شرکت بیمه: {selectedInsCompany}</div>
                        <div className="flex justify-between px-4 py-2 bg-gray-50 text-xs font-bold">
                            <span>تاریخ گزارش: {new Date().toLocaleDateString('fa-IR')}</span>
                        </div>
                    </div>

                    <table className="w-full border-collapse text-center border border-black text-xs">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="border border-black p-2 w-24">تاریخ</th>
                                <th className="border border-black p-2">شرح عملیات</th>
                                <th className="border border-black p-2 w-32">بدهکار (پرداختی ما)</th>
                                <th className="border border-black p-2 w-32">بستانکار (هزینه)</th>
                                <th className="border border-black p-2 w-32 bg-gray-200">مانده</th>
                            </tr>
                        </thead>
                        <tbody>
                            {ledgerData.length === 0 ? (
                                <tr><td colSpan={5} className="p-4 text-gray-400">تراکنشی یافت نشد</td></tr>
                            ) : (
                                ledgerData.map((row, idx) => (
                                    <tr key={row.id} className="hover:bg-gray-50">
                                        <td className="border border-black p-2">{row.date}</td>
                                        <td className="border border-black p-2 text-right">{row.desc}</td>
                                        <td className="border border-black p-2 font-mono dir-ltr text-green-700">{row.debtor > 0 ? formatCurrency(row.debtor) : '-'}</td>
                                        <td className="border border-black p-2 font-mono dir-ltr text-red-700">{row.creditor > 0 ? formatCurrency(row.creditor) : '-'}</td>
                                        <td className={`border border-black p-2 font-mono dir-ltr font-bold ${row.balance > 0 ? 'text-red-800' : 'text-green-800'}`}>{formatCurrency(Math.abs(row.balance))} {row.balance > 0 ? 'Best' : row.balance < 0 ? 'Bed' : ''}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        <tfoot>
                            <tr className="bg-gray-800 text-white font-bold">
                                <td colSpan={2} className="border border-black p-2 text-left pl-4">جمع کل</td>
                                <td className="border border-black p-2 dir-ltr font-mono">{formatCurrency(ledgerData.reduce((a,b)=>a+b.debtor,0))}</td>
                                <td className="border border-black p-2 dir-ltr font-mono">{formatCurrency(ledgerData.reduce((a,b)=>a+b.creditor,0))}</td>
                                <td className="border border-black p-2 dir-ltr font-mono bg-black">{formatCurrency(Math.abs(ledgerData[ledgerData.length-1]?.balance || 0))}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default InsuranceLedgerReport;
