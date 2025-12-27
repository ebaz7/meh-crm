
import React, { useEffect, useState } from 'react';
import { X, Printer, Loader2, FileDown, CheckCircle2, XCircle } from 'lucide-react';
import { formatCurrency } from '../../constants';
import { generatePdf } from '../../utils/pdfGenerator';

interface Props {
  data: any[];
  totalAmount: number;
  onClose: () => void;
}

const PrintGuaranteeReport: React.FC<Props> = ({ data, totalAmount, onClose }) => {
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    // Set page size to A4 Landscape
    const style = document.getElementById('page-size-style');
    if (style) {
      style.innerHTML = '@page { size: A4 landscape; margin: 0; }';
    }
  }, []);

  const handleDownloadPDF = async () => {
      setProcessing(true);
      await generatePdf({
          elementId: 'guarantee-report-print-content',
          filename: `Guarantee_Report_${new Date().toISOString().slice(0,10)}.pdf`,
          format: 'A4',
          orientation: 'landscape',
          onComplete: () => setProcessing(false),
          onError: () => { alert('خطا در ایجاد PDF'); setProcessing(false); }
      });
  };

  const handlePrint = () => {
      window.print();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex flex-col items-center justify-start md:justify-center p-4 overflow-y-auto animate-fade-in safe-pb">
      <div className="relative md:absolute md:top-4 md:left-4 z-50 flex flex-col gap-2 no-print w-full md:w-auto mb-4 md:mb-0 order-1">
         <div className="bg-white p-3 rounded-xl shadow-lg flex justify-between items-center gap-4">
             <span className="font-bold text-sm">پیش‌نمایش چاپ / PDF</span>
             <div className="flex gap-2">
                <button onClick={handleDownloadPDF} disabled={processing} className="bg-red-600 text-white p-2 rounded text-xs flex items-center gap-1 hover:bg-red-700 transition-colors shadow-sm">{processing ? <Loader2 size={16} className="animate-spin"/> : <FileDown size={16}/>} دانلود PDF</button>
                <button onClick={handlePrint} className="bg-blue-600 text-white p-2 rounded text-xs flex items-center gap-1 hover:bg-blue-700 transition-colors shadow-sm"><Printer size={16}/> چاپ</button>
                <button onClick={onClose} className="bg-gray-100 text-gray-700 p-2 rounded hover:bg-gray-200 transition-colors"><X size={18}/></button>
             </div>
         </div>
      </div>
      
      {/* Printable Content - A4 Landscape */}
      <div className="order-2 w-full overflow-auto flex justify-center">
          <div id="guarantee-report-print-content" className="printable-content bg-white p-8 shadow-2xl relative text-black" 
            style={{ 
                width: '290mm', // A4 Landscape width approx
                minHeight: '200mm', 
                direction: 'rtl',
                padding: '5mm', 
                boxSizing: 'border-box',
                margin: '0 auto'
            }}>
                
                {/* Header */}
                <div className="border border-black mb-4">
                    <div className="bg-gray-200 font-black py-3 border-b border-black text-center text-lg">گزارش جامع چک‌های تضمین و ضمانت‌نامه‌ها</div>
                    <div className="flex justify-between px-4 py-2 bg-white text-xs font-bold border-b border-black">
                        <span>تاریخ گزارش: {new Date().toLocaleDateString('fa-IR')}</span>
                        <span>تعداد کل: {data.length} فقره</span>
                    </div>
                     <div className="bg-yellow-50 text-center py-1 text-[10px] text-gray-600 font-bold">
                        * این گزارش شامل تمامی چک‌های تضمین (ارزی و گمرکی) ثبت شده در سیستم می‌باشد.
                    </div>
                </div>

                <table className="w-full border-collapse text-center border border-black text-[10px]">
                    <thead>
                        <tr className="bg-gray-800 text-white">
                            <th className="border border-black p-2 w-8">ردیف</th>
                            <th className="border border-black p-2">شماره پرونده</th>
                            <th className="border border-black p-2">شرکت</th>
                            <th className="border border-black p-2">بخش (نوع)</th>
                            <th className="border border-black p-2">بانک</th>
                            <th className="border border-black p-2">شماره چک/ضمانت</th>
                            <th className="border border-black p-2">تاریخ سررسید</th>
                            <th className="border border-black p-2">مبلغ (ریال)</th>
                            <th className="border border-black p-2 w-20">وضعیت</th>
                            <th className="border border-black p-2 w-1/5">توضیحات</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.length === 0 ? (
                            <tr><td colSpan={10} className="p-4 text-gray-400 border border-black">موردی یافت نشد</td></tr>
                        ) : (
                            data.map((item, idx) => (
                                <tr key={item.id} className="border-b border-black">
                                    <td className="border border-black p-1.5">{idx + 1}</td>
                                    <td className="border border-black p-1.5 font-bold">{item.fileNumber}</td>
                                    <td className="border border-black p-1.5">{item.company}</td>
                                    <td className="border border-black p-1.5">{item.section}</td>
                                    <td className="border border-black p-1.5">{item.bank}</td>
                                    <td className="border border-black p-1.5 font-mono font-bold dir-ltr">{item.chequeNumber}</td>
                                    <td className="border border-black p-1.5 dir-ltr font-mono">{item.dueDate}</td>
                                    <td className="border border-black p-1.5 font-mono dir-ltr font-bold">{formatCurrency(item.amount)}</td>
                                    <td className={`border border-black p-1.5 font-bold ${item.isDelivered ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'}`}>
                                        <div className="flex items-center justify-center gap-1">
                                            {item.isDelivered ? 'عودت شده' : 'نزد سازمان'}
                                        </div>
                                    </td>
                                    <td className="border border-black p-1.5 text-right">{item.description}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                    <tfoot>
                        <tr className="bg-gray-200 text-black font-black text-sm">
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

export default PrintGuaranteeReport;
