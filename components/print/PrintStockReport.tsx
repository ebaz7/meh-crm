
import React, { useEffect, useState } from 'react';
import { X, Printer, FileDown, Loader2 } from 'lucide-react';
import { generatePdf } from '../../utils/pdfGenerator'; // Import Utility

interface PrintStockReportProps {
  data: any[];
  onClose: () => void;
}

const PrintStockReport: React.FC<PrintStockReportProps> = ({ data, onClose }) => {
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    // Set page size to A4 Landscape
    const style = document.getElementById('page-size-style');
    if (style) {
      style.innerHTML = '@page { size: A4 landscape; margin: 0; }';
    }
    
    // Trigger print
    // setTimeout(() => {
    //     window.print();
    // }, 800);
  }, []);

  const handleDownloadPDF = async () => {
      setProcessing(true);
      await generatePdf({
          elementId: 'stock-report-content',
          filename: `Stock_Report_${new Date().toISOString().slice(0,10)}.pdf`,
          format: 'a4',
          orientation: 'landscape',
          onComplete: () => setProcessing(false),
          onError: () => { alert('خطا در ایجاد PDF'); setProcessing(false); }
      });
  };

  const handlePrint = () => {
      setProcessing(true);
      setTimeout(() => {
          window.print();
          setProcessing(false);
      }, 500);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex flex-col items-center justify-start md:justify-center p-4 overflow-y-auto animate-fade-in safe-pb">
      <div className="relative md:absolute md:top-4 md:left-4 z-50 flex flex-col gap-2 no-print w-full md:w-auto mb-4 md:mb-0 order-1">
         <div className="bg-white p-3 rounded-xl shadow-lg flex justify-between items-center gap-4">
             <span className="font-bold text-sm">پیش‌نمایش چاپ / PDF</span>
             <div className="flex gap-2">
                <button onClick={handleDownloadPDF} disabled={processing} className="bg-red-600 text-white p-2 rounded text-xs flex items-center gap-1">{processing ? <Loader2 size={16} className="animate-spin"/> : <FileDown size={16}/>} دانلود PDF</button>
                <button onClick={handlePrint} className="bg-blue-600 text-white p-2 rounded text-xs flex items-center gap-1"><Printer size={16}/> چاپ</button>
                <button onClick={onClose} className="bg-gray-100 text-gray-700 p-2 rounded hover:bg-gray-200"><X size={18}/></button>
             </div>
         </div>
      </div>
      
      {/* Printable Content - A4 Landscape Fixed Width */}
      <div className="order-2 w-full overflow-auto flex justify-center">
          <div id="stock-report-content" className="printable-content bg-white shadow-2xl relative text-black" 
            style={{ 
                // A4 Landscape: 297mm x 210mm
                width: '297mm', 
                minHeight: '210mm', 
                direction: 'rtl',
                padding: '5mm', 
                boxSizing: 'border-box',
                margin: '0 auto'
            }}>
                {/* Header */}
                <div style={{ textAlign: 'center', backgroundColor: '#fde047', border: '1px solid black', padding: '4px', marginBottom: '8px', fontWeight: '900', fontSize: '18px' }}>موجودی کلی انبارها</div>
                
                {/* Grid Layout using Flexbox for precise column control in print */}
                <div style={{ display: 'flex', border: '1px solid black', borderLeft: 'none' }}>
                    {data.map((group, index) => {
                        const headerColor = index === 0 ? '#d8b4fe' : index === 1 ? '#fdba74' : '#93c5fd';
                        return (
                            <div key={group.company} style={{ flex: 1, borderLeft: '1px solid black', fontSize: '10px' }}>
                                <div style={{ backgroundColor: headerColor, color: 'black', fontWeight: 'bold', padding: '4px', textAlign: 'center', borderBottom: '1px solid black', fontSize: '12px' }}>{group.company}</div>
                                <div style={{ display: 'flex', backgroundColor: '#f3f4f6', fontWeight: 'bold', borderBottom: '1px solid black', textAlign: 'center' }}>
                                    <div style={{ flex: 1.5, padding: '2px', borderLeft: '1px solid black' }}>نخ</div>
                                    <div style={{ flex: 1, padding: '2px', borderLeft: '1px solid black' }}>کارتن</div>
                                    <div style={{ flex: 1, padding: '2px', borderLeft: '1px solid black' }}>وزن</div>
                                    <div style={{ flex: 1, padding: '2px' }}>کانتینر</div>
                                </div>
                                <div>
                                    {group.items.map((item: any, i: number) => (
                                        <div key={i} style={{ display: 'flex', borderBottom: '1px solid #9ca3af', textAlign: 'center', lineHeight: '1.2' }}>
                                            <div style={{ flex: 1.5, padding: '2px', borderLeft: '1px solid black', fontWeight: 'bold', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden' }}>{item.name}</div>
                                            <div style={{ flex: 1, padding: '2px', borderLeft: '1px solid black', fontFamily: 'monospace' }}>{item.quantity}</div>
                                            <div style={{ flex: 1, padding: '2px', borderLeft: '1px solid black', fontFamily: 'monospace' }}>{item.weight > 0 ? item.weight : 0}</div>
                                            <div style={{ flex: 1, padding: '2px', fontFamily: 'monospace', color: '#6b7280' }}>
                                                {item.containerCount > 0 ? item.containerCount.toFixed(2) : '-'}
                                            </div>
                                        </div>
                                    ))}
                                    {group.items.length === 0 && <div style={{ padding: '8px', textAlign: 'center', color: '#9ca3af' }}>-</div>}
                                </div>
                            </div>
                        );
                    })}
                </div>
                
                <div style={{ textAlign: 'center', backgroundColor: '#fde047', border: '1px solid black', padding: '2px', marginTop: '4px', fontWeight: 'bold', fontSize: '10px' }}>گزارش سیستم مدیریت انبار - تاریخ چاپ: {new Date().toLocaleDateString('fa-IR')}</div>
          </div>
      </div>
    </div>
  );
};

export default PrintStockReport;
