import React, { useState, useEffect } from 'react';
import { ExitPermit, ExitPermitStatus, SystemSettings } from '../types';
import { formatDate } from '../constants';
import { X, Printer, Image as ImageIcon, FileDown, Loader2, CheckCircle, XCircle, Share2, Truck, Package, MapPin, User, Users, Phone, Clock } from 'lucide-react';
import { apiCall } from '../services/apiService';

interface Props {
  permit: ExitPermit;
  onClose: () => void;
  onApprove?: () => void;
  onReject?: () => void;
  settings?: SystemSettings;
  embed?: boolean; 
}

const PrintExitPermit: React.FC<Props> = ({ permit, onClose, onApprove, onReject, settings, embed }) => {
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
      const style = document.getElementById('page-size-style');
      if (style && !embed) { 
          style.innerHTML = '@page { size: A5 landscape; margin: 0; }';
      }
  }, [embed]);

  const Stamp = ({ title, name, date, time }: { title: string, name: string, date?: string, time?: string }) => (
      <div className="border-2 border-blue-800 text-blue-800 rounded-lg p-2 rotate-[-5deg] opacity-90 inline-block bg-white/80 print:bg-transparent">
          <div className="text-[10px] font-bold border-b border-blue-800 mb-1 pb-1 text-center">{title}</div>
          <div className="text-sm font-bold text-center">{name}</div>
          {(date || time) && <div className="text-[9px] text-center mt-1">{date} {time ? `- ساعت ${time}` : ''}</div>}
      </div>
  );

  const displayItems = permit.items && permit.items.length > 0 ? permit.items : [{ id: 'legacy', goodsName: permit.goodsName || '', cartonCount: permit.cartonCount || 0, weight: permit.weight || 0 }];
  const displayDestinations = permit.destinations && permit.destinations.length > 0 ? permit.destinations : [{ id: 'legacy', recipientName: permit.recipientName || '', address: permit.destinationAddress || '', phone: '' }];
  const totalCartons = displayItems.reduce((acc, i) => acc + (Number(i.cartonCount) || 0), 0);
  const totalWeight = displayItems.reduce((acc, i) => acc + (Number(i.weight) || 0), 0);

  const content = (
      <div id={embed ? `print-permit-${permit.id}` : "print-area-exit"} 
        className="printable-content bg-white w-full mx-auto p-8 shadow-2xl rounded-sm relative text-gray-900 flex flex-col" 
        style={{ direction: 'rtl', width: '209mm', height: '147mm', margin: '0 auto', padding: '8mm', boxSizing: 'border-box' }}>
            
            <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-4 relative z-10">
                <div className="flex items-center gap-4">{settings?.pwaIcon && <img src={settings.pwaIcon} className="w-16 h-16 object-contain"/>}<div><h1 className="text-2xl font-black mb-1">مجوز خروج کالا</h1><p className="text-sm font-bold text-gray-600">گروه تولیدی صنعتی</p></div></div>
                <div className="text-left space-y-1"><div className="text-lg font-black">شماره: {permit.permitNumber}</div><div className="text-sm">تاریخ: {formatDate(permit.date)}</div>{permit.exitTime && <div className="text-xs bg-gray-100 px-2 py-1 rounded flex items-center gap-1 mt-1 font-bold"><Clock size={12}/> خروج: {permit.exitTime}</div>}</div>
            </div>
            <div className="flex-1 space-y-4 relative z-10">
                <table className="w-full text-xs border-collapse border border-black"><thead className="bg-gray-100"><tr><th className="border border-black p-1 w-8 text-center">ردیف</th><th className="border border-black p-1">شرح کالا</th><th className="border border-black p-1 w-20 text-center">تعداد کارتن</th><th className="border border-black p-1 w-20 text-center">وزن (KG)</th></tr></thead><tbody>{displayItems.map((item, idx) => (<tr key={idx}><td className="border border-black p-1 text-center">{idx + 1}</td><td className="border border-black p-1 font-bold">{item.goodsName}</td><td className="border border-black p-1 text-center">{item.cartonCount}</td><td className="border border-black p-1 text-center">{item.weight}</td></tr>))}<tr className="bg-gray-50 font-bold"><td colSpan={2} className="border border-black p-1 text-left pl-4">جمع کل:</td><td className="border border-black p-1 text-center">{totalCartons}</td><td className="border border-black p-1 text-center">{totalWeight}</td></tr></tbody></table>
                <div className="space-y-1">{displayDestinations.map((dest, idx) => (<div key={idx} className="border border-gray-300 rounded p-1.5 flex gap-2 text-[11px] bg-gray-50"><div className="font-bold min-w-[120px]">{dest.recipientName}</div><div className="flex-1 truncate">{dest.address}</div></div>))}</div>
                <div className="grid grid-cols-2 gap-4 border rounded p-2 bg-gray-50 text-[11px]"><div>راننده: <span className="font-bold">{permit.driverName || '-'}</span></div><div>پلاک: <span className="font-bold font-mono">{permit.plateNumber || '-'}</span></div></div>
            </div>
            <div className="mt-4 pt-2 border-t-2 border-black grid grid-cols-4 gap-2 text-center relative z-10">
                <div className="flex flex-col items-center justify-end h-20"><div className="mb-1 font-bold text-[10px]">{permit.requester}</div><div className="text-[8px] text-gray-500 border-t w-full pt-1">درخواست کننده</div></div>
                <div className="flex flex-col items-center justify-end h-20"><div className="mb-1">{permit.approverCeo ? <Stamp title="مدیر عامل" name={permit.approverCeo} /> : <span className="text-gray-300 text-[8px]">امضا نشده</span>}</div><div className="text-[8px] text-gray-500 border-t w-full pt-1">مدیر عامل</div></div>
                <div className="flex flex-col items-center justify-end h-20"><div className="mb-1">{permit.approverFactory ? <Stamp title="مدیر کارخانه" name={permit.approverFactory} /> : <span className="text-gray-300 text-[8px]">امضا نشده</span>}</div><div className="text-[8px] text-gray-500 border-t w-full pt-1">مدیر کارخانه</div></div>
                <div className="flex flex-col items-center justify-end h-20"><div className="mb-1">{permit.approverSecurity ? <Stamp title="انتظامات" name={permit.approverSecurity} time={permit.exitTime} /> : <span className="text-gray-300 text-[8px]">امضا نشده</span>}</div><div className="text-[8px] text-gray-500 border-t w-full pt-1">انتظامات</div></div>
            </div>
        </div>
  );

  if (embed) return content;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex flex-col items-center justify-start md:justify-center p-4 overflow-y-auto animate-fade-in safe-pb">
        <div className="bg-white p-3 rounded-xl shadow-lg relative md:absolute md:top-4 md:left-4 z-50 flex flex-col gap-2 no-print w-full md:w-48 mb-4 md:mb-0 order-1">
            <div className="flex justify-between items-center border-b pb-2"><span className="text-sm font-bold">پنل عملیات</span><button onClick={onClose}><X size={20}/></button></div>
            {onApprove && <button onClick={onApprove} className="bg-green-600 text-white p-2 rounded flex items-center gap-2 justify-center font-bold shadow-sm transition-transform active:scale-95"><CheckCircle size={16}/> تایید مرحله بعدی</button>}
            {onReject && <button onClick={onReject} className="bg-red-600 text-white p-2 rounded flex items-center gap-2 justify-center font-bold shadow-sm transition-transform active:scale-95"><XCircle size={16}/> رد درخواست</button>}
            <hr className="my-1"/>
            <button onClick={() => window.print()} className="bg-blue-600 text-white p-2 rounded text-sm hover:bg-blue-700 flex items-center justify-center gap-2"><Printer size={16}/> چاپ نهایی</button>
        </div>
        <div className="order-2 w-full">{content}</div>
    </div>
  );
};
export default PrintExitPermit;
