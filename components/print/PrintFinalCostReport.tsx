
import React, { useEffect, useState } from 'react';
import { X, Printer, Loader2 } from 'lucide-react';
import { TradeRecord, TradeStage } from '../../types';
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
    const style = document.getElementById('page-size-style');
    if (style) {
      style.innerHTML = '@page { size: A4 portrait; margin: 0; }';
    }
    setTimeout(() => window.print(), 800);
  }, []);

  const totalWeight = record.items.reduce((sum, item) => sum + item.weight, 0);
  
  // Calculate Net Currency Cost for Display in Expenses
  const tranches = record.currencyPurchaseData?.tranches || [];
  const netCurrencyRialCost = tranches.reduce((acc, t) => {
      const cost = t.amount * (t.rate || 0);
      const ret = (t.returnAmount || 0) * (t.rate || 0);
      return acc + (cost - ret);
  }, 0);

  // Gather Expenses for Bill Table
  const expenses = [
      { name: 'هزینه خرید ارز (خالص ریالی)', amount: netCurrencyRialCost },
      { name: 'هزینه‌های ثبت سفارش و بانکی', amount: record.stages[TradeStage.LICENSES]?.costRial || 0 },
      { name: 'هزینه بیمه باربری', amount: record.stages[TradeStage.INSURANCE]?.costRial || 0 },
      { name: 'هزینه بازرسی (COI)', amount: record.stages[TradeStage.INSPECTION]?.costRial || 0 },
      { name: 'هزینه‌های ترخیصیه و انبارداری', amount: record.stages[TradeStage.CLEARANCE_DOCS]?.costRial || 0 },
      { name: 'حقوق و عوارض گمرکی', amount: record.stages[TradeStage.GREEN_LEAF]?.costRial || 0 },
      { name: 'هزینه حمل داخلی', amount: record.stages[TradeStage.INTERNAL_SHIPPING]?.costRial || 0 },
      { name: 'کارمزد و هزینه‌های ترخیص', amount: record.stages[TradeStage.AGENT_FEES]?.costRial || 0 },
  ].filter(e => e.amount > 0);

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
      } catch (e) { alert('خطا در ایجاد PDF'); } finally { setProcessing(false); }
  };

  const costPerKg = totalWeight > 0 ? grandTotalRial / totalWeight : 0;
  
  // Calculate Overhead Per KG for Distribution
  // Base Cost = Item Price * CalcRate
  // Overhead = GrandTotal - (TotalItemsPrice * CalcRate)
  const totalItemsCurrency = record.items.reduce((a, b) => a + b.totalPrice, 0);
  const totalBaseCostRial = totalItemsCurrency * exchangeRate;
  const totalOverheadRial = grandTotalRial - totalBaseCostRial;
  const overheadPerKg = totalWeight > 0 ? totalOverheadRial / totalWeight : 0;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[120] flex flex-col items-center justify-start md:justify-center p-4 overflow-y-auto animate-fade-in safe-pb">
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

        <div className="order-2 w-full overflow-auto flex justify-center">
            <div id="final-cost-print-area" className="printable-content bg-white p-8 shadow-2xl relative text-black" 
                style={{ width: '210mm', minHeight: '297mm', direction: 'rtl', boxSizing: 'border-box' }}>
                
                {/* Header */}
                <div className="border-b-4 border-double border-gray-800 pb-4 mb-6 flex justify-between items-end">
                    <div>
                        <h1 className="text-2xl font-black mb-1">صورتحساب نهایی هزینه‌ها</h1>
                        <h2 className="text-base font-bold text-gray-600">{record.company}</h2>
                    </div>
                    <div className="text-left text-sm space-y-1 font-mono">
                        <div><span className="font-bold font-sans">شماره پرونده:</span> {record.fileNumber}</div>
                        <div><span className="font-bold font-sans">تاریخ:</span> {new Date().toLocaleDateString('fa-IR')}</div>
                    </div>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-3 gap-y-2 gap-x-8 mb-6 bg-gray-50 p-4 rounded border border-gray-300 text-xs">
                    <div><span className="font-bold text-gray-600">شرح کالا:</span> {record.goodsName}</div>
                    <div><span className="font-bold text-gray-600">فروشنده:</span> {record.sellerName}</div>
                    <div><span className="font-bold text-gray-600">ارز پایه:</span> {record.mainCurrency}</div>
                    <div><span className="font-bold text-gray-600">نرخ ارز محاسباتی:</span> {formatCurrency(exchangeRate)}</div>
                    <div><span className="font-bold text-gray-600">کل وزن:</span> {formatNumberString(totalWeight)} KG</div>
                    <div><span className="font-bold text-gray-600">شماره سفارش:</span> {record.orderNumber || '-'}</div>
                </div>

                {/* 1. BILL OF EXPENSES */}
                <h3 className="font-black text-sm mb-2 border-b border-black pb-1 mt-4">الف) ریز هزینه‌های انجام شده</h3>
                <table className="w-full text-xs border-collapse border border-black mb-6 text-center">
                    <thead>
                        <tr className="bg-gray-200">
                            <th className="border border-black p-2 w-10">ردیف</th>
                            <th className="border border-black p-2">شرح هزینه</th>
                            <th className="border border-black p-2 w-40">مبلغ (ریال)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {expenses.map((exp, idx) => (
                            <tr key={idx}>
                                <td className="border border-black p-2">{idx + 1}</td>
                                <td className="border border-black p-2 text-right">{exp.name}</td>
                                <td className="border border-black p-2 font-mono dir-ltr">{formatCurrency(exp.amount)}</td>
                            </tr>
                        ))}
                        <tr className="bg-gray-100 font-bold">
                            <td colSpan={2} className="border border-black p-2 text-left pl-4">جمع کل هزینه‌های ریالی پروژه</td>
                            <td className="border border-black p-2 font-mono dir-ltr">{formatCurrency(grandTotalRial)}</td>
                        </tr>
                    </tbody>
                </table>

                {/* 2. COST CALCULATION */}
                <h3 className="font-black text-sm mb-2 border-b border-black pb-1 mt-4">ب) محاسبه قیمت تمام شده</h3>
                <div className="border border-black p-4 rounded mb-6 text-xs">
                    <div className="flex justify-between mb-2">
                        <span>مبلغ کل پروفرما (کالا + حمل) ارزی:</span>
                        <span className="font-mono dir-ltr font-bold">{formatNumberString(totalCurrency)} {record.mainCurrency}</span>
                    </div>
                    <div className="flex justify-between mb-2 border-b border-gray-300 pb-2">
                        <span>هزینه سربار هر کیلو (سرشکن شده):</span>
                        <span className="font-mono dir-ltr font-bold">{formatCurrency(overheadPerKg)}</span>
                    </div>
                    <div className="flex justify-between mt-2 text-sm bg-gray-100 p-2 rounded">
                        <span className="font-black">قیمت تمام شده نهایی (کل پروژه):</span>
                        <span className="font-mono dir-ltr font-black text-lg">{formatCurrency(grandTotalRial)}</span>
                    </div>
                </div>

                {/* 3. ITEM COST BREAKDOWN (Brief) */}
                <h3 className="font-black text-sm mb-2 border-b border-black pb-1 mt-4">ج) بهای تمام شده به تفکیک کالا</h3>
                <table className="w-full text-xs border-collapse border border-black mb-6 text-center">
                    <thead>
                        <tr className="bg-gray-200">
                            <th className="border border-black p-2 w-10">ردیف</th>
                            <th className="border border-black p-2">شرح کالا</th>
                            <th className="border border-black p-2">وزن (KG)</th>
                            <th className="border border-black p-2">قیمت خرید (ارز)</th>
                            <th className="border border-black p-2">قیمت تمام شده (ریال)</th>
                            <th className="border border-black p-2">فی تمام شده (هر کیلو)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {record.items.map((item, idx) => {
                            // Logic: Base Cost (Price*Rate) + Overhead (Weight * OverheadPerKg)
                            const itemBaseRial = item.totalPrice * exchangeRate;
                            const itemOverhead = item.weight * overheadPerKg;
                            const itemFinalCostRial = itemBaseRial + itemOverhead;
                            const itemFinalCostPerKg = item.weight > 0 ? itemFinalCostRial / item.weight : 0;
                            
                            return (
                                <tr key={item.id}>
                                    <td className="border border-black p-2">{idx + 1}</td>
                                    <td className="border border-black p-2 font-bold">{item.name}</td>
                                    <td className="border border-black p-2 font-mono">{formatNumberString(item.weight)}</td>
                                    <td className="border border-black p-2 font-mono">{formatNumberString(item.totalPrice)}</td>
                                    <td className="border border-black p-2 font-mono font-bold">{formatCurrency(itemFinalCostRial)}</td>
                                    <td className="border border-black p-2 font-mono font-bold bg-gray-100">{formatCurrency(itemFinalCostPerKg)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {/* Signatures */}
                <div className="grid grid-cols-3 gap-8 mt-12 text-center text-xs">
                    <div>
                        <div className="mb-8 font-bold">کارشناس بازرگانی</div>
                        <div className="border-b border-black w-2/3 mx-auto"></div>
                    </div>
                    <div>
                        <div className="mb-8 font-bold">مدیر مالی</div>
                        <div className="border-b border-black w-2/3 mx-auto"></div>
                    </div>
                    <div>
                        <div className="mb-8 font-bold">مدیر عامل</div>
                        <div className="border-b border-black w-2/3 mx-auto"></div>
                    </div>
                </div>

            </div>
        </div>
    </div>
  );
};

export default PrintFinalCostReport;
