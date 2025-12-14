
import React, { useEffect, useState } from 'react';
import { X, Printer, Loader2 } from 'lucide-react';
import { TradeRecord } from '../../types';
import { formatCurrency, formatNumberString } from '../../constants';

interface Props {
  record: TradeRecord;
  totalRial: number;
  totalCurrency: number;
  exchangeRate: number;
  grandTotalRial: number;
  onClose: () => void;
}

const PrintFinalCostReport: React.FC<Props> = ({ record, totalRial, totalCurrency, exchangeRate, grandTotalRial, onClose }) => {
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    // Force A4 Portrait for this specific report
    const style = document.getElementById('page-size-style');
    if (style) {
      style.innerHTML = '@page { size: A4 portrait; margin: 0; }';
    }
    
    // Auto print trigger
    setTimeout(() => window.print(), 800);
  }, []);

  const totalWeight = record.items.reduce((sum, item) => sum + item.weight, 0);
  
  // Calculate Costs
  // 1. Total Base Cost (Foreign Price * Rate)
  const totalBaseCostRial = record.items.reduce((acc, i) => acc + i.totalPrice, 0) * exchangeRate;
  
  // 2. Total Expenses (Everything else: Licenses, Insurance, Freight, Customs, etc.)
  // Formula: Grand Total - (Item Foreign Price * Rate)
  const totalExpensesRial = grandTotalRial - totalBaseCostRial;

  const handleDownloadPDF = async () => {
      setProcessing(true);
      const element = document.getElementById('final-cost-print-area');
      if (!element) { setProcessing(false); return; }
      
      try {
          // @ts-ignore
          const canvas = await window.html2canvas(element, { scale: 2, backgroundColor: '#ffffff' });
          const imgData = canvas.toDataURL('image/png');
          // @ts-ignore
          const { jsPDF } = window.jspdf;
          const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
          const pdfWidth = 210;
          const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
          
          pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
          pdf.save(`Cost_Report_${record.fileNumber}.pdf`);
      } catch (e) {
          alert('خطا در ایجاد PDF');
      } finally {
          setProcessing(false);
      }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[120] flex flex-col items-center justify-start md:justify-center p-4 overflow-y-auto animate-fade-in safe-pb">
        {/* Controls */}
        <div className="relative md:absolute md:top-4 md:left-4 z-50 flex flex-col gap-2 no-print w-full md:w-auto mb-4 md:mb-0 order-1">
            <div className="bg-white p-3 rounded-xl shadow-lg flex justify-between items-center gap-4">
                <span className="font-bold text-sm">پیش‌نمایش چاپ</span>
                <div className="flex gap-2">
                    <button onClick={handleDownloadPDF} disabled={processing} className="bg-red-600 text-white p-2 rounded text-xs flex items-center gap-1">{processing ? <Loader2 size={16} className="animate-spin"/> : 'PDF'}</button>
                    <button onClick={() => window.print()} className="bg-blue-600 text-white p-2 rounded text-xs flex items-center gap-1"><Printer size={16}/></button>
                    <button onClick={onClose} className="bg-gray-100 text-gray-700 p-2 rounded hover:bg-gray-200"><X size={18}/></button>
                </div>
            </div>
        </div>

        {/* Report Content */}
        <div className="order-2 w-full overflow-auto flex justify-center">
            <div id="final-cost-print-area" className="printable-content bg-white p-8 shadow-2xl relative text-black" 
                style={{ width: '210mm', minHeight: '297mm', direction: 'rtl', boxSizing: 'border-box' }}>
                
                {/* Header */}
                <div className="border-b-2 border-black pb-4 mb-6 flex justify-between items-start">
                    <div>
                        <h1 className="text-xl font-black mb-1">صورتحساب هزینه‌های واردات</h1>
                        <h2 className="text-sm font-bold text-gray-600">{record.company}</h2>
                    </div>
                    <div className="text-left text-sm space-y-1">
                        <div><span className="font-bold">شماره پرونده:</span> {record.fileNumber}</div>
                        <div><span className="font-bold">تاریخ گزارش:</span> {new Date().toLocaleDateString('fa-IR')}</div>
                    </div>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-3 gap-4 mb-6 bg-gray-50 p-4 rounded border border-gray-200 text-xs">
                    <div><span className="font-bold text-gray-500 block">شرح کلی کالا:</span> {record.goodsName}</div>
                    <div><span className="font-bold text-gray-500 block">فروشنده:</span> {record.sellerName}</div>
                    <div><span className="font-bold text-gray-500 block">ارز پایه:</span> {record.mainCurrency}</div>
                    <div><span className="font-bold text-gray-500 block">نرخ ارز محاسباتی:</span> {formatNumberString(exchangeRate)} ریال</div>
                    <div><span className="font-bold text-gray-500 block">کل وزن:</span> {formatNumberString(totalWeight)} KG</div>
                    <div><span className="font-bold text-gray-500 block">تعداد اقلام:</span> {record.items.length} ردیف</div>
                </div>

                {/* Section 1: Item Breakdown */}
                <h3 className="font-black text-sm mb-2 border-b border-black pb-1">جدول اقلام و محاسبه قیمت تمام شده</h3>
                <table className="w-full text-xs border-collapse border border-black mb-6 text-center">
                    <thead>
                        <tr className="bg-gray-200">
                            <th className="border border-black p-2 w-8">#</th>
                            <th className="border border-black p-2">شرح کالا</th>
                            <th className="border border-black p-2 w-20">HS Code</th>
                            <th className="border border-black p-2 w-20">وزن (KG)</th>
                            <th className="border border-black p-2 w-24">قیمت خرید ({record.mainCurrency})</th>
                            <th className="border border-black p-2 w-24">سهم هزینه (ریال)</th>
                            <th className="border border-black p-2 w-28 bg-gray-300">قیمت تمام شده (ریال)</th>
                            <th className="border border-black p-2 w-24 bg-gray-800 text-white">فی هر کیلو (ریال)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {record.items.map((item, idx) => {
                             // Calculation Logic per Row
                             // 1. Calculate allocated overhead based on weight ratio
                             const weightShare = totalWeight > 0 ? item.weight / totalWeight : 0;
                             const allocatedOverhead = totalExpensesRial * weightShare;
                             
                             // 2. Base cost of item in Rial
                             const itemBaseCostRial = item.totalPrice * exchangeRate;
                             
                             // 3. Final Cost
                             const finalItemCost = itemBaseCostRial + allocatedOverhead;
                             
                             // 4. Cost Per Kg
                             const costPerKg = item.weight > 0 ? finalItemCost / item.weight : 0;

                             return (
                                <tr key={item.id}>
                                    <td className="border border-black p-2">{idx + 1}</td>
                                    <td className="border border-black p-2 font-bold text-right">{item.name}</td>
                                    <td className="border border-black p-2 font-mono">{item.hsCode || '-'}</td>
                                    <td className="border border-black p-2 font-mono">{formatNumberString(item.weight)}</td>
                                    <td className="border border-black p-2 font-mono">{formatNumberString(item.totalPrice)}</td>
                                    <td className="border border-black p-2 font-mono text-gray-600">{formatNumberString(Math.round(allocatedOverhead))}</td>
                                    <td className="border border-black p-2 font-mono font-bold bg-gray-50">{formatNumberString(Math.round(finalItemCost))}</td>
                                    <td className="border border-black p-2 font-mono font-black">{formatNumberString(Math.round(costPerKg))}</td>
                                </tr>
                             );
                        })}
                    </tbody>
                    <tfoot>
                        <tr className="bg-gray-200 font-bold">
                            <td colSpan={3} className="border border-black p-2 text-left pl-4">جمع کل</td>
                            <td className="border border-black p-2 font-mono">{formatNumberString(totalWeight)}</td>
                            <td className="border border-black p-2 font-mono">{formatNumberString(record.items.reduce((a,b)=>a+b.totalPrice,0))}</td>
                            <td className="border border-black p-2 font-mono">{formatNumberString(Math.round(totalExpensesRial))}</td>
                            <td className="border border-black p-2 font-mono">{formatNumberString(Math.round(grandTotalRial))}</td>
                            <td className="border border-black p-2 bg-gray-800"></td>
                        </tr>
                    </tfoot>
                </table>

                {/* Section 2: Expense Summary */}
                <h3 className="font-black text-sm mb-2 border-b border-black pb-1">خلاصه هزینه‌های انجام شده</h3>
                <div className="border border-black rounded p-2 text-xs flex flex-wrap gap-x-8 gap-y-2 mb-6">
                    <div className="flex gap-2"><span>هزینه ریالی مراحل:</span> <span className="font-mono font-bold">{formatCurrency(totalRial)}</span></div>
                    <div className="flex gap-2"><span>هزینه ارزی مراحل:</span> <span className="font-mono font-bold">{formatNumberString(totalCurrency)} {record.mainCurrency}</span></div>
                    <div className="flex gap-2"><span>نرخ تسعیر:</span> <span className="font-mono font-bold">{formatNumberString(exchangeRate)} ریال</span></div>
                </div>

                {/* Final Total Box */}
                <div className="bg-gray-100 border-2 border-black p-4 text-center rounded-lg">
                    <span className="block text-sm font-bold mb-2">قیمت تمام شده نهایی کل سفارش</span>
                    <span className="block text-2xl font-black font-mono">{formatCurrency(grandTotalRial)}</span>
                </div>

                <div className="mt-12 flex justify-between text-xs font-bold px-12">
                    <div>امضاء کارشناس بازرگانی</div>
                    <div>امضاء مدیر مالی</div>
                    <div>امضاء مدیریت عامل</div>
                </div>

            </div>
        </div>
    </div>
  );
};

export default PrintFinalCostReport;
