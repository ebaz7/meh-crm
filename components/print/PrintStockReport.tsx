
import React, { useEffect } from 'react';
import { X, Printer } from 'lucide-react';

interface PrintStockReportProps {
  data: any[];
  onClose: () => void;
}

const PrintStockReport: React.FC<PrintStockReportProps> = ({ data, onClose }) => {
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
          <div className="printable-content bg-white p-4 shadow-2xl relative text-black" 
            style={{ 
                width: '100%', 
                maxWidth: '297mm',
                minHeight: '210mm', 
                direction: 'rtl',
                padding: '10mm', // Reduced Padding
                boxSizing: 'border-box'
            }}>
                {/* Header */}
                <div className="text-center bg-yellow-300 border border-black py-1 mb-2 font-black text-xl">موجودی کلی انبارها</div>
                
                {/* Grid Layout */}
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${data.length}, 1fr)`, border: '1px solid black' }}>
                    {data.map((group, index) => {
                        const headerColor = index === 0 ? 'bg-purple-300' : index === 1 ? 'bg-orange-300' : 'bg-blue-300';
                        return (
                            <div key={group.company} className="border-l border-black last:border-l-0 text-[10px]">
                                <div className={`${headerColor} text-black font-bold p-1 text-center border-b border-black text-sm`}>{group.company}</div>
                                <div className="grid grid-cols-4 bg-gray-100 font-bold border-b border-black text-center">
                                    <div className="p-1 border-l border-black">نخ</div>
                                    <div className="p-1 border-l border-black">کارتن</div>
                                    <div className="p-1 border-l border-black">وزن</div>
                                    <div className="p-1">کانتینر</div>
                                </div>
                                <div>
                                    {group.items.map((item: any, i: number) => (
                                        <div key={i} className="grid grid-cols-4 border-b border-gray-400 last:border-b-0 text-center leading-tight">
                                            <div className="p-1 border-l border-black font-bold truncate text-right pr-2">{item.name}</div>
                                            <div className="p-1 border-l border-black font-mono">{item.quantity}</div>
                                            <div className="p-1 border-l border-black font-mono">{item.weight > 0 ? item.weight : 0}</div>
                                            <div className="p-1 font-mono text-gray-500">
                                                {item.containerCount > 0 ? item.containerCount.toFixed(2) : '-'}
                                            </div>
                                        </div>
                                    ))}
                                    {group.items.length === 0 && <div className="p-2 text-center text-gray-400">-</div>}
                                </div>
                            </div>
                        );
                    })}
                </div>
                
                <div className="text-center bg-yellow-300 border border-black py-1 mt-1 font-bold text-xs">گزارش سیستم مدیریت انبار</div>
          </div>
      </div>
    </div>
  );
};

export default PrintStockReport;
