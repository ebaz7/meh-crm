
import React, { useState, useEffect } from 'react';
import { PaymentOrder, OrderStatus, PaymentMethod, SystemSettings } from '../types';
import { formatCurrency, formatDate, getStatusLabel, numberToPersianWords, formatNumberString } from '../constants';
import { X, Printer, FileDown, Loader2, CheckCircle, XCircle, Pencil, Share2, Users, Search, RotateCcw, AlertTriangle, FileText, LayoutTemplate, EyeOff, Eye } from 'lucide-react';
import { apiCall } from '../services/apiService';
import { generatePdf } from '../utils/pdfGenerator'; 

interface PrintVoucherProps {
  order: PaymentOrder;
  onClose?: () => void;
  settings?: SystemSettings;
  onApprove?: () => void;
  onReject?: () => void;
  onEdit?: () => void;
  onRevoke?: () => void; 
  embed?: boolean; 
}

const PrintVoucher: React.FC<PrintVoucherProps> = ({ order, onClose, settings, onApprove, onReject, onEdit, onRevoke, embed }) => {
  const [processing, setProcessing] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [showContactSelect, setShowContactSelect] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  
  // Toggle between Internal Receipt and Bank Form Fill
  const [printMode, setPrintMode] = useState<'receipt' | 'bank_form'>('receipt');
  
  // Default: Background OFF (User wants to print on pre-printed paper)
  const [showFormBackground, setShowFormBackground] = useState(false);

  // Find SATNA/CHEQUE line
  const satnaLine = order.paymentDetails.find(d => d.method === PaymentMethod.SATNA);
  const mainLine = satnaLine || order.paymentDetails[0];

  // Determine Form Type based on Bank Settings
  const company = settings?.companies?.find(c => c.name === order.payingCompany);
  const sourceBankConfig = company?.banks?.find(b => mainLine.bankName?.includes(b.bankName));
  const bankFormType = sourceBankConfig?.formLayout || 'DEFAULT';

  const canPrintBankForm = !!mainLine;

  useEffect(() => {
      const style = document.getElementById('page-size-style');
      if (style && !embed) { 
          // Refah form is A4 Portrait (Usually scanned forms are full A4)
          style.innerHTML = '@page { size: A4 portrait; margin: 0; }';
      }
  }, [embed, printMode]);

  const isCompact = order.paymentDetails.length > 2;
  const printAreaId = `print-voucher-${order.id}`;

  const isRevocationProcess = [
      OrderStatus.REVOCATION_PENDING_FINANCE,
      OrderStatus.REVOCATION_PENDING_MANAGER,
      OrderStatus.REVOCATION_PENDING_CEO
  ].includes(order.status);
  
  const isRevoked = order.status === OrderStatus.REVOKED;

  const Stamp = ({ name, title }: { name: string; title: string }) => (
    <div className={`border-[2px] border-blue-800 text-blue-800 rounded-lg ${isCompact ? 'py-0.5 px-2' : 'py-1 px-3'} rotate-[-5deg] opacity-90 mix-blend-multiply bg-white/80 print:bg-transparent shadow-sm inline-block`}>
      <div className={`${isCompact ? 'text-[8px]' : 'text-[9px]'} font-bold border-b border-blue-800 mb-0.5 text-center pb-0.5`}>{title}</div>
      <div className={`${isCompact ? 'text-[9px]' : 'text-[10px]'} text-center font-bold whitespace-nowrap`}>{name}</div>
    </div>
  );

  const handlePrint = () => { 
      setProcessing(true);
      setTimeout(() => {
          window.print(); 
          setProcessing(false);
      }, 500);
  };

  const handleDownloadPDF = async () => {
      setProcessing(true);
      await generatePdf({
          elementId: printAreaId,
          filename: `Voucher_${order.trackingNumber}.pdf`,
          format: 'A4',
          orientation: printMode === 'bank_form' ? 'portrait' : 'landscape',
          onComplete: () => setProcessing(false),
          onError: () => { alert('خطا در ایجاد PDF'); setProcessing(false); }
      });
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
              message: `🧾 *رسید پرداخت وجه*\n🏢 شرکت: ${order.payingCompany}\n👤 ذینفع: ${order.payee}\n💰 مبلغ: ${formatCurrency(order.totalAmount)}`,
              mediaData: { data: base64, mimeType: 'image/png', filename: `Order_${order.trackingNumber}.png` }
          });
          alert('ارسال شد.');
          setShowContactSelect(false);
      } catch(e) { alert('خطا در ارسال'); } finally { setSharing(false); }
  };

  const filteredContacts = settings?.savedContacts?.filter(c => 
    c.name.toLowerCase().includes(contactSearch.toLowerCase()) || 
    c.number.includes(contactSearch)
  ) || [];

  // --- REFAH BANK FORM COMPONENT (EXACT OVERLAY) ---
  const RefahBankFormOverlay = () => {
      if (!mainLine) return null;
      
      const pDate = new Date(order.date).toLocaleDateString('fa-IR');
      const dateParts = pDate.split('/'); // [yyyy, mm, dd]
      const amountStr = formatNumberString(mainLine.amount);
      const amountWords = numberToPersianWords(mainLine.amount);

      // Helper for positioning
      // Note: Values in 'mm' are approximate based on standard A4 Refah form.
      // Adjust top/left/width to fine-tune alignment with the physical paper.
      const Field = ({ top, left, width, text, size = "12px", align = "right", bold = true, letterSpacing = "normal" }: any) => (
          <div style={{
              position: 'absolute',
              top: top,
              left: left, // Left distance from left edge (rtl context depends on parent)
              width: width,
              fontSize: size,
              textAlign: align,
              fontWeight: bold ? '900' : 'normal',
              letterSpacing: letterSpacing,
              whiteSpace: 'nowrap',
              direction: 'rtl',
              // Show border only on screen if background is hidden to guide user
              border: (!showFormBackground) ? '1px dashed rgba(0,0,0,0.1)' : 'none',
              lineHeight: '1.2'
          }} className="print:border-none">
              {text}
          </div>
      );
      
      // Sheba Splitter
      const ShebaGrid = ({ top, left, sheba }: { top: string, left: string, sheba?: string }) => {
          if(!sheba) return null;
          // Split IBAN (assume 24 digits max + IR)
          // Refah Form typically has groupings or individual boxes.
          // Based on image: Looks like individual boxes or small groups. 
          // We will use a flex container with fixed width children.
          const cleanSheba = sheba.replace(/[^0-9]/g, '');
          const digits = cleanSheba.split('').slice(0, 24); // Limit to 24
          
          return (
              <div style={{ position: 'absolute', top, left, display: 'flex', gap: '3.6mm', direction: 'ltr' }}>
                  {digits.map((d, i) => (
                      <div key={i} style={{ 
                          width: '4mm', 
                          textAlign: 'center', 
                          fontWeight: 'bold', 
                          fontSize: '14px',
                          fontFamily: 'monospace'
                      }}>
                          {d}
                      </div>
                  ))}
              </div>
          );
      };

      return (
          <div className="printable-content relative w-full h-full text-black font-sans" 
               style={{ 
                   width: '210mm', 
                   height: '297mm', 
                   margin: '0 auto', 
                   overflow: 'hidden', 
                   padding: 0,
                   position: 'relative'
               }}>
              
              {/* --- BACKGROUND SIMULATION (Only visible if showFormBackground is true) --- */}
              {showFormBackground && (
                  <div className="absolute inset-0 pointer-events-none opacity-20 z-0">
                      {/* Using CSS grid to simulate the form lines since we don't have the image */}
                      <div className="w-full h-[15%] border-b-2 border-black flex items-center justify-center"><h1 className="text-4xl font-bold text-gray-400">محل هدر بانک رفاه</h1></div>
                      <div className="w-full h-[15%] border-b-2 border-black flex">
                          <div className="w-[10%] border-l-2 border-black bg-gray-100 flex items-center justify-center rotate-90">مشخصات</div>
                          <div className="flex-1 p-2">محل اطلاعات شرکت (نام، شناسه، ثبت...)</div>
                      </div>
                      <div className="w-full h-[10%] border-b-2 border-black p-2">محل درخواست و مبلغ</div>
                      <div className="w-full h-[20%] border-b-2 border-black flex">
                           <div className="w-[10%] border-l-2 border-black bg-gray-100 flex items-center justify-center rotate-90">حساب مبدا</div>
                           <div className="flex-1 p-2">اطلاعات حساب مبدا (شماره، شبا)</div>
                      </div>
                      <div className="w-full h-[25%] border-b-2 border-black flex">
                           <div className="w-[10%] border-l-2 border-black bg-gray-100 flex items-center justify-center rotate-90">حساب مقصد</div>
                           <div className="flex-1 p-2">اطلاعات حساب مقصد (گیرنده، شبا، شناسه)</div>
                      </div>
                      <div className="w-full h-[15%] p-2">امضاها</div>
                  </div>
              )}

              {/* --- DATA LAYER (Exact Positioning) --- */}
              {/* Coordinates are approximated for A4 Portrait based on the provided image structure */}
              
              {/* 1. Header Date/No */}
              <Field top="38mm" left="25mm" width="30mm" text={dateParts[0]} align="center" /> {/* Year */}
              <Field top="38mm" left="58mm" width="10mm" text={dateParts[1]} align="center" /> {/* Month */}
              <Field top="38mm" left="72mm" width="10mm" text={dateParts[2]} align="center" /> {/* Day */}
              {/* Number is usually handled by bank, but we can put tracking num if needed */}
              {/* <Field top="45mm" left="35mm" width="40mm" text={order.trackingNumber} align="center" /> */}

              {/* Checkboxes (Paya/Satna/Pol) - Usually top right ~20-30mm down */}
              {/* Assuming Satna is middle checkbox */}
              {mainLine.method === PaymentMethod.SATNA && <div style={{ position: 'absolute', top: '44mm', right: '18mm', fontSize: '20px' }}>✖</div>}
              {mainLine.method === PaymentMethod.TRANSFER && <div style={{ position: 'absolute', top: '35mm', right: '18mm', fontSize: '20px' }}>✖</div>} 

              {/* 2. Corporate Info (Right Side usually) */}
              <Field top="75mm" left="50mm" width="90mm" text={order.payingCompany} size="13px" /> {/* Company Name */}
              <Field top="75mm" left="10mm" width="40mm" text={company?.registrationNumber || ''} align="center" /> {/* Reg No */}
              <Field top="85mm" left="80mm" width="60mm" text={company?.nationalId || ''} align="center" /> {/* National ID */}
              <Field top="85mm" left="10mm" width="40mm" text={company?.phone || ''} align="center" /> {/* Phone */}
              <Field top="94mm" left="10mm" width="160mm" text={company?.address || ''} size="11px" /> {/* Address */}

              {/* 3. Request Body */}
              <Field top="112mm" left="85mm" width="50mm" text={amountStr} align="center" size="14px" letterSpacing="1px" /> {/* Amount Numeric */}
              <Field top="112mm" left="40mm" width="25mm" text={pDate} align="center" /> {/* Date again in body */}
              <Field top="122mm" left="50mm" width="120mm" text={amountWords} align="right" size="11px" /> {/* Amount Words */}

              {/* 4. Source Account */}
              <Field top="138mm" left="120mm" width="40mm" text="مرکزی / --" align="center" /> {/* Branch Name/Code */}
              <Field top="138mm" left="40mm" width="60mm" text={sourceBankConfig?.accountNumber || ''} align="center" size="14px" /> {/* Source Account Num */}
              {/* Source Check Serial if Check */}
              {/* Source Sheba */}
              <ShebaGrid top="152mm" left="28mm" sheba={sourceBankConfig?.sheba} />

              {/* 5. Destination Account */}
              <Field top="168mm" left="50mm" width="100mm" text={order.payee} size="13px" /> {/* Payee Name */}
              <Field top="168mm" left="10mm" width="35mm" text={mainLine.recipientBank} align="center" /> {/* Dest Bank */}
              
              {/* Account Num Dest (Sometimes distinct field, sometimes implied by Sheba. Form image shows separate field) */}
              <Field top="168mm" left="10mm" width="50mm" text="" align="center" /> {/* Account Num if available */}

              <Field top="178mm" left="10mm" width="160mm" text={mainLine.description} size="11px" /> {/* Reason/Babat */}
              
              {/* Destination Sheba */}
              <ShebaGrid top="192mm" left="28mm" sheba={mainLine.sheba} />

              {/* Payment ID (Shenase) */}
              {mainLine.paymentId && (
                  <div style={{ position: 'absolute', top: '205mm', left: '28mm', display: 'flex', gap: '3.6mm', direction: 'ltr' }}>
                      {mainLine.paymentId.split('').map((d, i) => (
                          <div key={i} style={{ width: '4mm', textAlign: 'center', fontWeight: 'bold', fontSize: '14px' }}>{d}</div>
                      ))}
                  </div>
              )}

              {/* 6. Signatures (Bottom) - Optional: Add placeholders if needed */}
              <Field top="230mm" left="140mm" width="40mm" text="امضا صاحب حساب" align="center" size="10px" />
          </div>
      );
  };

  const receiptContent = (
      <div 
        id={printAreaId} 
        className="printable-content bg-white relative text-gray-900 flex flex-col justify-between overflow-hidden" 
        style={{ 
            direction: 'rtl',
            width: '210mm', 
            height: '148mm',
            padding: '10mm', 
            boxSizing: 'border-box',
            margin: '0 auto',
            maxHeight: '148mm',
            overflow: 'hidden'
        }}
      >
        {/* ... (Existing Receipt Content - Kept unchanged) ... */}
        {order.status === OrderStatus.REJECTED && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-8 border-red-600/30 text-red-600/30 font-black text-9xl rotate-[-25deg] p-4 rounded-3xl select-none z-0 pointer-events-none">REJECTED</div>
        )}
        
        {isRevoked && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-8 border-gray-400/40 text-gray-400/40 font-black text-8xl rotate-[-25deg] p-6 rounded-3xl select-none z-0 pointer-events-none whitespace-nowrap">
                باطل شد
            </div>
        )}
        {isRevocationProcess && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-8 border-red-200/50 text-red-200/50 font-black text-6xl rotate-[-25deg] p-6 rounded-3xl select-none z-0 pointer-events-none whitespace-nowrap">
                در حال ابطال
            </div>
        )}

        <div className="relative z-10">
            <div className={`border-b-2 border-gray-800 ${isCompact ? 'pb-1 mb-2' : 'pb-2 mb-3'} flex justify-between items-center`}>
                <div className="flex flex-col w-2/3">
                    <h1 className={`${isCompact ? 'text-lg' : 'text-xl'} font-bold text-gray-900`}>{order.payingCompany || 'شرکت بازرگانی'}</h1>
                    <p className="text-[9px] text-gray-500 font-bold mt-0.5">سیستم مدیریت مالی و پرداخت</p>
                </div>
                <div className="text-left flex flex-col items-end gap-1 w-1/3">
                    <h2 className={`${isCompact ? 'text-sm px-2 py-0.5' : 'text-base px-3 py-1'} font-black bg-gray-100 border border-gray-200 text-gray-800 rounded-lg mb-1 whitespace-nowrap`}>رسید پرداخت وجه</h2>
                    <div className="flex items-center gap-2 text-[10px]"><span className="font-bold text-gray-500">شماره:</span><span className="font-mono font-bold text-base">{order.trackingNumber}</span></div>
                    <div className="flex items-center gap-2 text-[10px]"><span className="font-bold text-gray-500">تاریخ:</span><span className="font-bold text-gray-800">{formatDate(order.date)}</span></div>
                </div>
            </div>
            <div className={`${isCompact ? 'space-y-1.5' : 'space-y-3'}`}>
                <div className="grid grid-cols-2 gap-3">
                    <div className={`bg-gray-50/50 border border-gray-300 ${isCompact ? 'p-1.5' : 'p-2'} rounded`}><span className="block text-gray-500 text-[9px] mb-0.5">در وجه (ذینفع):</span><span className={`font-bold text-gray-900 ${isCompact ? 'text-sm' : 'text-base'}`}>{order.payee}</span></div>
                    <div className={`bg-gray-50/50 border border-gray-300 ${isCompact ? 'p-1.5' : 'p-2'} rounded`}><span className="block text-gray-500 text-[9px] mb-0.5">مبلغ کل پرداختی:</span><span className={`font-bold text-gray-900 ${isCompact ? 'text-sm' : 'text-base'}`}>{formatCurrency(order.totalAmount)}</span></div>
                </div>
                <div className={`bg-gray-50/50 border border-gray-300 ${isCompact ? 'p-1.5 min-h-[30px]' : 'p-2 min-h-[45px]'} rounded`}><span className="block text-gray-500 text-[9px] mb-0.5">بابت (شرح پرداخت):</span><p className={`text-gray-800 text-justify font-medium leading-tight ${isCompact ? 'text-[10px]' : 'text-xs'}`}>{order.description}</p></div>
                <div className="border border-gray-300 rounded overflow-hidden">
                    <table className={`w-full text-right ${isCompact ? 'text-[9px]' : 'text-[10px]'}`}>
                        <thead className="bg-gray-100 border-b border-gray-300"><tr><th className={`${isCompact ? 'p-1' : 'p-1.5'} font-bold text-gray-600 w-6 text-center`}>#</th><th className={`${isCompact ? 'p-1' : 'p-1.5'} font-bold text-gray-600`}>نوع پرداخت</th><th className={`${isCompact ? 'p-1' : 'p-1.5'} font-bold text-gray-600`}>مبلغ</th><th className={`${isCompact ? 'p-1' : 'p-1.5'} font-bold text-gray-600`}>بانک / چک / شبا</th><th className={`${isCompact ? 'p-1' : 'p-1.5'} font-bold text-gray-600`}>توضیحات</th></tr></thead>
                        <tbody className="divide-y divide-gray-200">{order.paymentDetails.map((detail, idx) => (<tr key={detail.id}><td className={`${isCompact ? 'p-1' : 'p-1.5'} text-center`}>{idx + 1}</td><td className={`${isCompact ? 'p-1' : 'p-1.5'} font-bold`}>{detail.method}</td><td className={`${isCompact ? 'p-1' : 'p-1.5'} font-mono`}>{formatCurrency(detail.amount)}</td><td className={`${isCompact ? 'p-1' : 'p-1.5'} truncate`}>{detail.method === PaymentMethod.CHEQUE ? `چک: ${detail.chequeNumber}` : detail.method === PaymentMethod.SATNA ? `شبا: IR-${detail.sheba}` : detail.method === PaymentMethod.TRANSFER ? `بانک: ${detail.bankName}` : '-'}</td><td className={`${isCompact ? 'p-1' : 'p-1.5'} text-gray-600`}>{detail.description || '-'}</td></tr>))}</tbody>
                    </table>
                </div>
            </div>
        </div>
        <div className={`mt-auto ${isCompact ? 'pt-1' : 'pt-2'} border-t-2 border-gray-800 relative z-10`}>
            <div className="grid grid-cols-4 gap-2 text-center">
                <div className={`flex flex-col items-center justify-end ${isCompact ? 'min-h-[45px]' : 'min-h-[60px]'}`}><div className="mb-1 flex items-center justify-center h-full"><Stamp name={order.requester} title="درخواست کننده" /></div><div className="w-full border-t border-gray-400 pt-0.5"><span className="text-[8px] font-bold text-gray-600">درخواست کننده</span></div></div>
                <div className={`flex flex-col items-center justify-end ${isCompact ? 'min-h-[45px]' : 'min-h-[60px]'}`}><div className="mb-1 flex items-center justify-center h-full">{order.approverFinancial ? <Stamp name={order.approverFinancial} title="تایید مالی" /> : <span className="text-gray-300 text-[8px]">امضا نشده</span>}</div><div className="w-full border-t border-gray-400 pt-0.5"><span className="text-[8px] font-bold text-gray-600">مدیر مالی</span></div></div>
                <div className={`flex flex-col items-center justify-end ${isCompact ? 'min-h-[45px]' : 'min-h-[60px]'}`}><div className="mb-1 flex items-center justify-center h-full">{order.approverManager ? <Stamp name={order.approverManager} title="تایید مدیریت" /> : <span className="text-gray-300 text-[8px]">امضا نشده</span>}</div><div className="w-full border-t border-gray-400 pt-0.5"><span className="text-[8px] font-bold text-gray-600">مدیریت</span></div></div>
                <div className={`flex flex-col items-center justify-end ${isCompact ? 'min-h-[45px]' : 'min-h-[60px]'}`}><div className="mb-1 flex items-center justify-center h-full">{order.approverCeo ? <Stamp name={order.approverCeo} title="مدیر عامل" /> : <span className="text-gray-300 text-[8px]">امضا نشده</span>}</div><div className="w-full border-t border-gray-400 pt-0.5"><span className="text-[8px] font-bold text-gray-600">مدیر عامل</span></div></div>
            </div>
        </div>
      </div>
  );

  const contentToRender = (printMode === 'bank_form' && bankFormType === 'REFAH') ? <RefahBankFormOverlay /> : receiptContent;

  if (embed) return contentToRender;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex flex-col items-center justify-start md:justify-center p-4 overflow-y-auto animate-fade-in safe-pb">
      <div className="relative md:absolute md:top-0 md:left-0 md:right-0 p-4 flex justify-between items-start z-[210] no-print w-full md:w-auto mb-4 md:mb-0 order-1">
         <div className="bg-white p-3 rounded-xl shadow-lg flex flex-col gap-3 w-full md:max-w-lg mx-auto relative border border-gray-200">
             <div className="flex items-center justify-between border-b pb-2 mb-1">
                 <h3 className="font-bold text-gray-800 text-base flex items-center gap-2">
                     {isRevocationProcess ? <span className="text-red-600 flex items-center gap-1 animate-pulse"><AlertTriangle size={16}/> چرخه ابطال</span> : 'جزئیات و عملیات'}
                 </h3>
                 <button onClick={onClose} className="text-gray-400 hover:text-red-500"><X size={20}/></button>
             </div>
             
             {/* Approval Actions */}
             {(onApprove || onReject || onEdit || onRevoke) && (<div className="flex flex-wrap gap-2 pb-3 border-b border-gray-100">
                {onApprove && <button onClick={onApprove} className={`flex-1 ${isRevocationProcess ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} text-white py-2 rounded-lg flex items-center justify-center gap-1.5 font-bold shadow-sm transition-transform active:scale-95`}>{isRevocationProcess ? <XCircle size={18}/> : <CheckCircle size={18} />} {isRevocationProcess ? 'تایید ابطال' : 'تایید'}</button>}
                {onRevoke && !isRevocationProcess && !isRevoked && <button onClick={onRevoke} className="flex-1 bg-red-100 hover:bg-red-200 text-red-700 py-2 rounded-lg flex items-center justify-center gap-1.5 font-bold shadow-sm transition-transform active:scale-95 border border-red-200"><RotateCcw size={18} /> درخواست ابطال</button>}
                {onReject && <button onClick={onReject} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg flex items-center justify-center gap-1.5 font-bold shadow-sm transition-transform active:scale-95"><XCircle size={18} /> رد</button>}
                {onEdit && !isRevocationProcess && <button onClick={onEdit} className="bg-amber-100 text-amber-700 hover:bg-amber-200 px-3 py-2 rounded-lg flex items-center justify-center"><Pencil size={18} /></button>}
             </div>)}
             
             {/* Print Actions */}
             <div className="grid grid-cols-2 md:grid-cols-4 gap-2 relative">
                 <button onClick={handleDownloadPDF} disabled={processing} className="bg-gray-100 text-gray-700 hover:bg-gray-200 py-2 rounded-lg flex items-center justify-center gap-1 text-xs font-bold transition-colors">{processing ? <Loader2 size={14} className="animate-spin"/> : <FileDown size={14} />} PDF</button>
                 <button onClick={handlePrint} disabled={processing} className="bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg flex items-center justify-center gap-1 text-xs font-bold transition-colors shadow-sm">{processing ? <Loader2 size={14} className="animate-spin"/> : <Printer size={14} />} چاپ</button>
                 <button onClick={() => setShowContactSelect(!showContactSelect)} disabled={sharing} className={`bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg flex items-center justify-center gap-1 text-xs font-bold transition-colors shadow-sm ${showContactSelect ? 'ring-2 ring-green-300' : ''}`}>{sharing ? <Loader2 size={14} className="animate-spin"/> : <Share2 size={14} />} واتساپ</button>
                 
                 {/* Bank Form Toggle */}
                 {canPrintBankForm && bankFormType !== 'DEFAULT' && (
                     <button 
                        onClick={() => setPrintMode(printMode === 'receipt' ? 'bank_form' : 'receipt')} 
                        className={`py-2 rounded-lg flex items-center justify-center gap-1 text-xs font-bold transition-colors border ${printMode === 'bank_form' ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-white text-gray-600 hover:bg-gray-50 border-gray-300'}`}
                     >
                        <LayoutTemplate size={14}/> {printMode === 'receipt' ? 'فرم بانک' : 'رسید داخلی'}
                     </button>
                 )}

                 {/* Extra option for Bank Form */}
                 {printMode === 'bank_form' && (
                     <div className="col-span-2 md:col-span-4 flex justify-center mt-2">
                         <label className="flex items-center gap-2 text-xs cursor-pointer select-none bg-yellow-50 p-2 rounded border border-yellow-200">
                             <input type="checkbox" checked={showFormBackground} onChange={e => setShowFormBackground(e.target.checked)} className="w-4 h-4 text-blue-600 rounded"/>
                             {showFormBackground ? <Eye size={14}/> : <EyeOff size={14}/>} 
                             <span>چاپ راهنما (برای تست)</span>
                         </label>
                     </div>
                 )}

                 {showContactSelect && (
                     <div className="absolute top-full right-0 md:-right-64 mt-2 w-full min-w-[280px] md:w-80 bg-white rounded-xl shadow-2xl border border-gray-200 z-[300] animate-scale-in flex flex-col overflow-hidden">
                         <div className="p-3 bg-gray-50 border-b flex flex-col gap-2">
                             <div className="flex justify-between items-center"><span className="text-xs font-black text-gray-700">انتخاب مخاطب</span><button onClick={()=>setShowContactSelect(false)}><X size={14}/></button></div>
                             <div className="relative"><Search size={14} className="absolute right-2 top-2 text-gray-400"/><input className="w-full bg-white border border-gray-300 rounded-lg pr-8 pl-2 py-1.5 text-xs outline-none focus:border-blue-500" placeholder="جستجوی نام یا شماره..." value={contactSearch} onChange={e=>setContactSearch(e.target.value)} autoFocus/></div>
                         </div>
                         <div className="max-h-60 overflow-y-auto bg-white custom-scrollbar">
                             {filteredContacts.length > 0 ? filteredContacts.map(c => (
                                 <div key={c.id} className="p-2 border-b border-gray-50 hover:bg-blue-50/50 flex items-center justify-between group">
                                     <div className="flex items-center gap-2 overflow-hidden">
                                         <div className={`p-1.5 rounded-full shrink-0 ${c.isGroup ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}><Users size={12}/></div>
                                         <div className="truncate"><div className="font-bold text-[11px] text-gray-800 truncate">{c.name}</div><div className="text-[9px] text-gray-500 font-mono">{c.number}</div></div>
                                     </div>
                                     <button onClick={()=>handleSendToWhatsApp(c.number)} className="bg-green-600 text-white px-3 py-1 rounded-md text-[10px] font-bold hover:bg-green-700 shadow-sm whitespace-nowrap">ارسال</button>
                                 </div>
                             )) : <div className="p-4 text-center text-[10px] text-gray-400">مخاطبی یافت نشد.</div>}
                         </div>
                         <div className="p-2 bg-gray-50 border-t"><button onClick={()=>{const n=prompt("شماره همراه (مثال: 98912...):"); if(n) handleSendToWhatsApp(n);}} className="w-full text-center py-2 text-[10px] text-blue-600 font-black hover:bg-white rounded border border-blue-100 transition-colors">ارسال به شماره دستی...</button></div>
                     </div>
                 )}
             </div>
         </div>
      </div>
      
      {/* Container specifically for on-screen viewing */}
      <div className="order-2 w-full flex justify-center pb-10 overflow-auto">
          <div style={{ width: printMode === 'bank_form' ? '210mm' : '210mm', height: printMode === 'bank_form' ? '297mm' : '148mm', backgroundColor: 'white', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
            {contentToRender}
          </div>
      </div>
    </div>
  );
};

export default PrintVoucher;
