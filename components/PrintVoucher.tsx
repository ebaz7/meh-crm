
import React, { useState, useEffect } from 'react';
import { PaymentOrder, OrderStatus, PaymentMethod, SystemSettings } from '../types';
import { formatCurrency, formatDate } from '../constants';
import { X, Printer, Image as ImageIcon, FileDown, Loader2, CheckCircle, XCircle, Pencil, Share2, Users } from 'lucide-react';
import { apiCall } from '../services/apiService';

interface PrintVoucherProps {
  order: PaymentOrder;
  onClose?: () => void;
  settings?: SystemSettings;
  onApprove?: () => void;
  onReject?: () => void;
  onEdit?: () => void;
  embed?: boolean; 
}

const PrintVoucher: React.FC<PrintVoucherProps> = ({ order, onClose, settings, onApprove, onReject, onEdit, embed }) => {
  const [processing, setProcessing] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [showContactSelect, setShowContactSelect] = useState(false);

  // Set A5 Landscape for this specific component
  useEffect(() => {
      const style = document.getElementById('page-size-style');
      if (style && !embed) { // Only change page size if not embedded/hidden
          style.innerHTML = '@page { size: A5 landscape; margin: 0; }';
      }
  }, [embed]);

  // Smart Compact Mode logic
  const isCompact = order.paymentDetails.length > 2;
  const companyInfo = settings?.companies?.find(c => c.name === order.payingCompany);
  const companyLogo = companyInfo?.logo || settings?.pwaIcon;

  // Use a specific ID for the printable area
  const printAreaId = `print-voucher-content-${order.id}`;

  const Stamp = ({ name, title }: { name: string; title: string }) => (
    <div className={`border-[2px] border-blue-800 text-blue-800 rounded-lg ${isCompact ? 'py-0.5 px-2' : 'py-1 px-3'} rotate-[-5deg] opacity-90 mix-blend-multiply bg-white/80 print:bg-transparent shadow-sm inline-block`}>
      <div className={`${isCompact ? 'text-[8px]' : 'text-[9px]'} font-bold border-b border-blue-800 mb-0.5 text-center pb-0.5`}>{title}</div>
      <div className={`${isCompact ? 'text-[9px]' : 'text-[10px]'} text-center font-bold whitespace-nowrap`}>{name}</div>
    </div>
  );

  const handlePrint = () => { 
      setProcessing(true);
      const style = document.getElementById('page-size-style');
      if (style) style.innerHTML = '@page { size: A5 landscape; margin: 0; }';

      setTimeout(() => {
          window.print(); 
          setProcessing(false);
      }, 500);
  };

  const handleDownloadImage = async () => {
      setProcessing(true);
      const element = document.getElementById(printAreaId);
      if (!element) { setProcessing(false); return; }
      try {
          // @ts-ignore
          const canvas = await window.html2canvas(element, { scale: 3, backgroundColor: '#ffffff', useCORS: true });
          const link = document.createElement('a');
          link.download = `Voucher_${order.trackingNumber}.png`;
          link.href = canvas.toDataURL('image/png');
          link.click();
      } catch (e) { console.error(e); alert('خطا در ذخیره تصویر'); } finally { setProcessing(false); }
  };

  const handleDownloadPDF = async () => {
      setProcessing(true);
      const element = document.getElementById(printAreaId);
      if (!element) { setProcessing(false); return; }
      try {
          // @ts-ignore
          const canvas = await window.html2canvas(element, { scale: 4, backgroundColor: '#ffffff', useCORS: true });
          const imgData = canvas.toDataURL('image/png');
          // @ts-ignore
          const { jsPDF } = window.jspdf;
          
          const pdf = new jsPDF('l', 'mm', 'a5');
          const pdfWidth = 210;
          const pdfHeight = 148;
          
          pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
          pdf.save(`Voucher_${order.trackingNumber}.pdf`);
      } catch (e) { console.error(e); alert('خطا در ایجاد PDF'); } finally { setProcessing(false); }
  };

  const handleSendToWhatsApp = async (targetNumber: string) => {
      if (!targetNumber) return;
      setSharing(true);
      const element = document.getElementById(printAreaId);
      if (!element) { setSharing(false); return; }
      
      try {
          // @ts-ignore
          const canvas = await window.html2canvas(element, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
          const base64 = canvas.toDataURL('image/png').split(',')[1];
          
          await apiCall('/send-whatsapp', 'POST', {
              number: targetNumber,
              message: `🧾 *دستور پرداخت*\nشماره: ${order.trackingNumber}\nمبلغ: ${formatCurrency(order.totalAmount)}`,
              mediaData: { data: base64, mimeType: 'image/png', filename: `Order_${order.trackingNumber}.png` }
          });
          alert('ارسال شد.');
          setShowContactSelect(false);
      } catch(e) { alert('خطا در ارسال'); } finally { setSharing(false); }
  };

  // --- RENDER CONTENT (Flexible width to avoid duplicates) ---
  const content = (
      <div 
        id={printAreaId} 
        className="printable-content bg-white mx-auto shadow-2xl rounded-sm relative text-gray-900 flex flex-col justify-between overflow-hidden" 
        style={{ 
            direction: 'rtl',
            width: '100%', 
            maxWidth: '210mm',
            minHeight: '148mm',
            // Reduced padding to prevent overflow in print
            padding: '8mm', 
            boxSizing: 'border-box'
        }}
      >
        {/* Rejected Watermark */}
        {order.status === OrderStatus.REJECTED && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-8 border-red-600/30 text-red-600/30 font-black text-9xl rotate-[-25deg] p-4 rounded-3xl select-none z-0 pointer-events-none">REJECTED</div>
        )}

        {/* Header */}
        <div className="relative z-10">
            <div className={`border-b-2 border-gray-800 ${isCompact ? 'pb-1 mb-2' : 'pb-2 mb-3'} flex justify-between items-center`}>
                <div className="flex items-center gap-3 w-2/3">
                    {companyLogo && <div className={`${isCompact ? 'w-10 h-10' : 'w-14 h-14'} shrink-0 flex items-center justify-center`}><img src={companyLogo} alt="Logo" className="w-full h-full object-contain" crossOrigin="anonymous" /></div>}
                    <div><h1 className={`${isCompact ? 'text-lg' : 'text-xl'} font-bold text-gray-900`} style={{ letterSpacing: '0px' }}>{order.payingCompany || 'شرکت بازرگانی'}</h1><p className="text-[9px] text-gray-500 font-bold mt-0.5">سیستم مدیریت مالی و پرداخت</p></div>
                </div>
                <div className="text-left flex flex-col items-end gap-1 w-1/3">
                    <h2 className={`${isCompact ? 'text-sm px-2 py-0.5' : 'text-base px-3 py-1'} font-black bg-gray-100 border border-gray-200 text-gray-800 rounded-lg mb-1 whitespace-nowrap`}>رسید پرداخت وجه</h2>
                    <div className="flex items-center gap-2 text-[10px]"><span className="font-bold text-gray-500">شماره:</span><span className="font-mono font-bold text-base">{order.trackingNumber}</span></div>
                    <div className="flex items-center gap-2 text-[10px]"><span className="font-bold text-gray-500">تاریخ:</span><span className="font-bold text-gray-800">{formatDate(order.date)}</span></div>
                </div>
            </div>

            {/* Body */}
            <div className={`${isCompact ? 'space-y-1.5' : 'space-y-3'}`}>
                <div className="grid grid-cols-2 gap-3">
                    <div className={`bg-gray-50/50 border border-gray-300 ${isCompact ? 'p-1.5' : 'p-2'} rounded`}><span className="block text-gray-500 text-[9px] mb-0.5">در وجه (ذینفع):</span><span className={`font-bold text-gray-900 ${isCompact ? 'text-sm' : 'text-base'}`}>{order.payee}</span></div>
                    <div className={`bg-gray-50/50 border border-gray-300 ${isCompact ? 'p-1.5' : 'p-2'} rounded`}><span className="block text-gray-500 text-[9px] mb-0.5">مبلغ کل پرداختی:</span><span className={`font-bold text-gray-900 ${isCompact ? 'text-sm' : 'text-base'}`}>{formatCurrency(order.totalAmount)}</span></div>
                </div>
                <div className={`bg-gray-50/50 border border-gray-300 ${isCompact ? 'p-1.5 min-h-[30px]' : 'p-2 min-h-[45px]'} rounded`}><span className="block text-gray-500 text-[9px] mb-0.5">بابت (شرح پرداخت):</span><p className={`text-gray-800 text-justify font-medium leading-tight ${isCompact ? 'text-[10px]' : 'text-xs'}`}>{order.description}</p></div>
                <div className="border border-gray-300 rounded overflow-hidden">
                    <table className={`w-full text-right ${isCompact ? 'text-[9px]' : 'text-[10px]'}`}>
                        <thead className="bg-gray-100 border-b border-gray-300"><tr><th className={`${isCompact ? 'p-1' : 'p-1.5'} font-bold text-gray-600 w-6`}>#</th><th className={`${isCompact ? 'p-1' : 'p-1.5'} font-bold text-gray-600`}>نوع پرداخت</th><th className={`${isCompact ? 'p-1' : 'p-1.5'} font-bold text-gray-600`}>مبلغ</th><th className={`${isCompact ? 'p-1' : 'p-1.5'} font-bold text-gray-600`}>بانک / چک</th><th className={`${isCompact ? 'p-1' : 'p-1.5'} font-bold text-gray-600`}>توضیحات</th></tr></thead>
                        <tbody className="divide-y divide-gray-200">{order.paymentDetails.slice(0, 4).map((detail, idx) => (<tr key={detail.id}><td className={`${isCompact ? 'p-1' : 'p-1.5'} text-center`}>{idx + 1}</td><td className={`${isCompact ? 'p-1' : 'p-1.5'} font-bold`}>{detail.method}</td><td className={`${isCompact ? 'p-1' : 'p-1.5'} font-mono`}>{formatCurrency(detail.amount)}</td><td className={`${isCompact ? 'p-1' : 'p-1.5'} truncate max-w-[100px]`}>{detail.method === PaymentMethod.CHEQUE ? `چک: ${detail.chequeNumber}${detail.chequeDate ? ` (${detail.chequeDate})` : ''}` : detail.method === PaymentMethod.TRANSFER ? `بانک: ${detail.bankName}` : '-'}</td><td className={`${isCompact ? 'p-1' : 'p-1.5'} text-gray-600 truncate max-w-[120px]`}>{detail.description || '-'}</td></tr>))}</tbody>
                    </table>
                </div>
            </div>
        </div>

        {/* Footer */}
        <div className={`mt-auto ${isCompact ? 'pt-1' : 'pt-2'} border-t-2 border-gray-800 relative z-10`}>
            <div className="grid grid-cols-4 gap-2 text-center">
                <div className={`flex flex-col items-center justify-end ${isCompact ? 'min-h-[45px]' : 'min-h-[60px]'}`}><div className="mb-1 flex items-center justify-center h-full"><span className="font-bold text-gray-900 text-[10px]">{order.requester}</span></div><div className="w-full border-t border-gray-400 pt-0.5"><span className="text-[8px] font-bold text-gray-600">درخواست کننده</span></div></div>
                <div className={`flex flex-col items-center justify-end ${isCompact ? 'min-h-[45px]' : 'min-h-[60px]'}`}><div className="mb-1 flex items-center justify-center h-full">{order.approverFinancial ? <Stamp name={order.approverFinancial} title="تایید مالی" /> : <span className="text-gray-300 text-[8px]">امضا نشده</span>}</div><div className="w-full border-t border-gray-400 pt-0.5"><span className="text-[8px] font-bold text-gray-600">مدیر مالی</span></div></div>
                <div className={`flex flex-col items-center justify-end ${isCompact ? 'min-h-[45px]' : 'min-h-[60px]'}`}><div className="mb-1 flex items-center justify-center h-full">{order.approverManager ? <Stamp name={order.approverManager} title="تایید مدیریت" /> : <span className="text-gray-300 text-[8px]">امضا نشده</span>}</div><div className="w-full border-t border-gray-400 pt-0.5"><span className="text-[8px] font-bold text-gray-600">مدیریت</span></div></div>
                <div className={`flex flex-col items-center justify-end ${isCompact ? 'min-h-[45px]' : 'min-h-[60px]'}`}><div className="mb-1 flex items-center justify-center h-full">{order.approverCeo ? <Stamp name={order.approverCeo} title="مدیر عامل" /> : <span className="text-gray-300 text-[8px]">امضا نشده</span>}</div><div className="w-full border-t border-gray-400 pt-0.5"><span className="text-[8px] font-bold text-gray-600">مدیر عامل</span></div></div>
            </div>
        </div>
      </div>
  );

  if (embed) return <div id={embed ? `print-voucher-${order.id}` : undefined}>{content}</div>;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex flex-col items-center justify-start md:justify-center p-4 overflow-y-auto animate-fade-in safe-pb">
      <div className="relative md:absolute md:top-0 md:left-0 md:right-0 p-4 flex justify-between items-start z-50 no-print w-full md:w-auto mb-4 md:mb-0 order-1">
         <div className="bg-white p-3 rounded-xl shadow-lg flex flex-col gap-3 w-full md:max-w-lg mx-auto relative border border-gray-200">
             <div className="flex items-center justify-between border-b pb-2 mb-1"><h3 className="font-bold text-gray-800 text-base">جزئیات و عملیات</h3><button onClick={onClose} className="text-gray-400 hover:text-red-500"><X size={20}/></button></div>
             {(onApprove || onReject || onEdit) && (<div className="flex gap-2 pb-3 border-b border-gray-100">{onApprove && <button onClick={onApprove} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg flex items-center justify-center gap-1.5 font-bold shadow-sm transition-transform active:scale-95"><CheckCircle size={18} /> تایید</button>}{onReject && <button onClick={onReject} className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg flex items-center justify-center gap-1.5 font-bold shadow-sm transition-transform active:scale-95"><XCircle size={18} /> رد</button>}{onEdit && <button onClick={onEdit} className="bg-amber-100 text-amber-700 hover:bg-amber-200 px-3 py-2 rounded-lg flex items-center justify-center"><Pencil size={18} /></button>}</div>)}
             <div className="grid grid-cols-4 gap-2 relative">
                 <button onClick={handleDownloadImage} disabled={processing} className="bg-gray-100 text-gray-700 hover:bg-gray-200 py-2 rounded-lg flex items-center justify-center gap-1 text-xs font-bold transition-colors">{processing ? <Loader2 size={14} className="animate-spin"/> : <ImageIcon size={14} />} عکس</button>
                 <button onClick={handleDownloadPDF} disabled={processing} className="bg-gray-100 text-gray-700 hover:bg-gray-200 py-2 rounded-lg flex items-center justify-center gap-1 text-xs font-bold transition-colors">{processing ? <Loader2 size={14} className="animate-spin"/> : <FileDown size={14} />} PDF</button>
                 <button onClick={handlePrint} disabled={processing} className="bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg flex items-center justify-center gap-1 text-xs font-bold transition-colors shadow-sm">{processing ? <Loader2 size={14} className="animate-spin"/> : <Printer size={14} />} چاپ</button>
                 <button onClick={() => setShowContactSelect(!showContactSelect)} disabled={sharing} className="bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg flex items-center justify-center gap-1 text-xs font-bold transition-colors shadow-sm">{sharing ? <Loader2 size={14} className="animate-spin"/> : <Share2 size={14} />} واتساپ</button>
                 {showContactSelect && (<div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-xl shadow-2xl border z-[100] animate-fade-in overflow-hidden"><div className="p-3 bg-gray-50 border-b font-bold text-xs flex justify-between"><span>انتخاب مخاطب</span><button onClick={()=>setShowContactSelect(false)}><X size={14}/></button></div><div className="max-h-48 overflow-y-auto">{settings?.savedContacts?.map(c => (<button key={c.id} onClick={()=>handleSendToWhatsApp(c.number)} className="w-full text-right p-3 hover:bg-blue-50 text-sm border-b flex items-center gap-2"><div className="p-1.5 rounded-full bg-gray-100 text-gray-600"><Users size={12}/></div><div className="truncate"><div className="font-bold">{c.name}</div><div className="text-[10px] text-gray-500">{c.number}</div></div></button>))}</div><div className="p-2 border-t bg-gray-50"><button onClick={()=>{const n=prompt("شماره:");if(n)handleSendToWhatsApp(n);}} className="w-full text-center text-xs text-blue-600 font-bold">شماره دستی</button></div></div>)}
             </div>
         </div>
      </div>
      
      {/* Container to center and show the receipt */}
      <div className="order-2 w-full flex justify-center pb-10 overflow-auto">
          {content}
      </div>
    </div>
  );
};

export default PrintVoucher;
