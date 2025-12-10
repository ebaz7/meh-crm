
import React, { useEffect } from 'react';
import { X, Printer } from 'lucide-react';
import { formatCurrency } from '../../constants';

interface PrintAllocationReportProps {
  records: any[];
  companySummary: any;
  totalAllocated: number;
  totalQueue: number;
  onClose: () => void;
}

const PrintAllocationReport: React.FC<PrintAllocationReportProps> = ({ records, companySummary, totalAllocated, totalQueue, onClose }) => {
  useEffect(() => {
    // Set page size to A4 Landscape
    const style = document.getElementById('page-size-style');
    if (style) {
      style.innerHTML = '@page { size: A4 landscape; margin: 0; }';
    }
    
    // Trigger print
    setTimeout(() => {
        window.print();
    }, 800);
  }, []);

  const formatUSD = (val: number) => val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex flex-col items-center justify-start md:justify-center p-4 overflow-y-auto animate-fade-in safe-pb">
      <div className="relative md:absolute md:top-4 md:left-4 z-50 flex flex-col gap-2 no-print w-full md:w-auto mb-4 md:mb-0 order-1">
         <div className="bg-white p-3 rounded-xl shadow-lg flex justify-between items-center gap-4">
             <span className="font-bold text-sm">پیش‌نمایش چاپ</span>
             <div className="flex gap-2">
                <button onClick={() => window.print()} className="bg-blue-600 text-white p-2 rounded text-xs flex items-center gap-1"><Printer size={16}/> چاپ مجدد</button>
                <button onClick={onClose} className="bg-gray-100 text-gray-700 p-2 rounded hover:bg-gray-200"><X size={18}/></button>
             </div>
         </div>
      </div>
      
      {/* Printable Content - A4 Landscape */}
      <div className="order-2 w-full overflow-auto flex justify-center">
          <div className="printable-content bg-white p-8 shadow-2xl relative text-black" 
            style={{ 
                width: '100%', 
                maxWidth: '297mm',
                minHeight: '210mm', 
                direction: 'rtl',
                padding: '10mm', // Reduced Padding
                boxSizing: 'border-box'
            }}>
                <h2 className="text-center font-black text-xl mb-4 border-b-2 border-blue-900 pb-2">گزارش صف تخصیص ارز</h2>
                
                <table className="w-full text-[10px] text-center border-collapse border border-gray-400 mb-6">
                    <thead>
                        <tr className="bg-[#1e3a8a] text-white">
                            <th className="p-1 border border-gray-400">ردیف</th>
                            <th className="p-1 border border-gray-400">پرونده / کالا</th>
                            <th className="p-1 border border-gray-400">ثبت سفارش</th>
                            <th className="p-1 border border-gray-400">شرکت</th>
                            <th className="p-1 border border-gray-400">مبلغ ارزی</th>
                            <th className="p-1 border border-gray-400">معادل دلار ($)</th>
                            <th className="p-1 border border-gray-400">معادل ریالی</th>
                            <th className="p-1 border border-gray-400">زمان در صف</th>
                            <th className="p-1 border border-gray-400">زمان تخصیص</th>
                            <th className="p-1 border border-gray-400">مانده مهلت (روز)</th>
                            <th className="p-1 border border-gray-400">وضعیت</th>
                            <th className="p-1 border border-gray-400">بانک عامل</th>
                            <th className="p-1 border border-gray-400 w-16">اولویت</th>
                            <th className="p-1 border border-gray-400 w-20">نوع ارز</th>
                        </tr>
                    </thead>
                    <tbody>
                        {records.length === 0 ? (
                            <tr><td colSpan={14} className="p-4 text-gray-500">موردی یافت نشد.</td></tr>
                        ) : (
                            records.map((r: any, index: number) => (
                                <tr key={r.id} className="border-b border-gray-300">
                                    <td className="p-1 border-r border-gray-300">{index + 1}</td>
                                    <td className="p-1 border-r border-gray-300 text-right">
                                        <div className="font-bold">{r.fileNumber}</div>
                                        <div className="text-[8px] text-gray-500 truncate max-w-[100px]">{r.goodsName}</div>
                                    </td>
                                    <td className="p-1 border-r border-gray-300 font-mono">{r.registrationNumber || '-'}</td>
                                    <td className="p-1 border-r border-gray-300">{r.company}</td>
                                    <td className="p-1 border-r border-gray-300 dir-ltr font-mono">{formatCurrency(r.amount)} {r.mainCurrency}</td>
                                    <td className="p-1 border-r border-gray-300 dir-ltr font-mono font-bold">$ {formatUSD(r.amountInUSD)}</td>
                                    <td className="p-1 border-r border-gray-300 dir-ltr font-mono text-blue-600">{formatCurrency(r.rialEquiv)}</td>
                                    <td className="p-1 border-r border-gray-300 dir-ltr">{r.stageQ?.queueDate || '-'}</td>
                                    <td className="p-1 border-r border-gray-300 dir-ltr">{r.stageA?.allocationDate || '-'}</td>
                                    <td className={`p-1 border-r border-gray-300 font-bold ${r.remainingDays > 0 ? 'text-green-600' : r.remainingDays === '-' ? '' : 'text-red-600'}`}>{r.remainingDays}</td>
                                    <td className="p-1 border-r border-gray-300 font-bold">{r.isAllocated ? 'تخصیص یافته' : 'در صف'}</td>
                                    <td className="p-1 border-r border-gray-300 text-[9px]">{r.operatingBank || '-'}</td>
                                    <td className="p-1 border-r border-gray-300 text-[10px]">{r.isPriority ? '✅' : '-'}</td>
                                    <td className="p-1 border-r border-gray-300 text-[10px]">{r.allocationCurrencyRank === 'Type1' ? 'نوع 1' : r.allocationCurrencyRank === 'Type2' ? 'نوع 2' : '-'}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>

                <div className="border-t-2 border-black pt-2 break-inside-avoid">
                    <h3 className="text-right font-bold mb-2 text-sm">خلاصه وضعیت ارزی به تفکیک شرکت (دلار آمریکا)</h3>
                    <table className="w-full text-xs text-center border-collapse border border-gray-400">
                        <thead>
                            <tr className="bg-gray-200 text-gray-800">
                                <th className="p-2 border border-gray-400">نام شرکت</th>
                                <th className="p-2 border border-gray-400">جمع تخصیص یافته ($)</th>
                                <th className="p-2 border border-gray-400">جمع در صف ($)</th>
                                <th className="p-2 border border-gray-400 bg-gray-300">مجموع کل ($)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(companySummary).map(([comp, data]: any) => (
                                <tr key={comp} className="border-b border-gray-300">
                                    <td className="p-2 border-r border-gray-300 font-bold">{comp}</td>
                                    <td className="p-2 border-r border-gray-300 font-mono text-green-700 font-bold">{formatUSD(data.allocated)}</td>
                                    <td className="p-2 border-r border-gray-300 font-mono text-amber-700 font-bold">{formatUSD(data.queue)}</td>
                                    <td className="p-2 border-r border-gray-300 font-mono font-black bg-gray-100">{formatUSD(data.allocated + data.queue)}</td>
                                </tr>
                            ))}
                            <tr className="bg-gray-300 font-black border-t-2 border-black">
                                <td className="p-2 border-r border-gray-400">جمع نهایی</td>
                                <td className="p-2 border-r border-gray-400 font-mono">{formatUSD(totalAllocated)}</td>
                                <td className="p-2 border-r border-gray-400 font-mono">{formatUSD(totalQueue)}</td>
                                <td className="p-2 border-r border-gray-400 font-mono">{formatUSD(totalAllocated + totalQueue)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
          </div>
      </div>
    </div>
  );
};

export default PrintAllocationReport;
