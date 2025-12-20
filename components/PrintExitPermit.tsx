
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

  const Stamp = ({ title, name, date }: { title: string, name: string, date?: string }) => (
      <div className="border-2 border-blue-800 text-blue-800 rounded-lg p-1.5 rotate-[-5deg] opacity-90 inline-block bg-white/80 print:bg-transparent">
          <div className="text-[9px] font-bold border-b border-blue-800 mb-1 pb-1 text-center">{title}</div>
          <div className="text-[11px] font-bold text-center">{name}</div>
          {date && <div className="text-[8px] text-center mt-1">{date}</div>}
      </div>
  );

  const displayItems = permit.items && permit.items.length > 0 ? permit.items : [{ id: 'legacy', goodsName: permit.goodsName || '', cartonCount: permit.cartonCount || 0, weight: permit.weight || 0 }];
  const displayDestinations = permit.destinations && permit.destinations.length > 0 ? permit.destinations : [{ id: 'legacy', recipientName: permit.recipientName || '', address: permit.destinationAddress || '', phone: '' }];
  const totalCartons = displayItems.reduce((acc, i) => acc + (Number(i.cartonCount) || 0), 0);
  const totalWeight = displayItems.reduce((acc, i) => acc + (Number(i.weight) || 0), 0);

  const content = (
      <div id={embed ? `print-permit-${permit.id}` : "print-area-exit"} 
        className="printable-content bg-white w-full mx-auto p-8 shadow-2xl rounded-sm relative text-gray-900 flex flex-col" 
        style={{ 
            direction: 'rtl',
            width: '209mm',
            height: '147mm',
            margin: '0 auto',
            padding: '8mm', 
            boxSizing: 'border-box'
        }}>
            {((permit.status as any) === 'DELETED') && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-8 border-red-600/30 text-red-600/30 font-black text-8xl rotate-[-25deg] p-4 rounded-3xl select-none z-0 pointer-events-none whitespace-nowrap opacity-50">ابطال شد</div>
            )}

            <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-4 relative z-10">
                <div className="flex items-center gap-4">{settings?.pwaIcon && <img src={settings.pwaIcon} className="w-14 h-14 object-contain"/>}<div><h1 className="text-xl font-black mb-1">مجوز خروج کالا (۴ مرحله‌ای)</h1><p className="text-xs font-bold text-gray-600">فرآیند خروج و تاییدات سیستمی</p></div></div>
                <div className="text-left space-y-1"><div className="text-base font-black">شماره: {permit.permitNumber}</div><div className="text-xs">تاریخ: {formatDate(permit.date)}</div>{permit.exitTime && <div className="text-xs font-bold text-blue-700 flex items-center gap-1"><Clock size={12}/> ساعت خروج: {permit.exitTime}</div>}</div>
            </div>
            <div className="flex-1 space-y-4 relative z-10">
                <table className="w-full text-xs border-collapse border border-gray-400"><thead className="bg-gray-100"><tr><th className="border border-gray-400 p-1 w-8 text-center">#</th><th className="border border-gray-400 p-1">شرح کالا</th><th className="border border-gray-400 p-1 w-20 text-center">کارتن</th><th className="border border-gray-400 p-1 w-20 text-center">وزن (KG)</th></tr></thead><tbody>{displayItems.map((item, idx) => (<tr key={idx}><td className="border border-gray-400 p-1 text-center">{idx + 1}</td><td className="border border-gray-400 p-1 font-bold">{item.goodsName}</td><td className="border border-gray-400 p-1 text-center">{item.cartonCount}</td><td className="border border-gray-400 p-1 text-center">{item.weight}</td></tr>))}<tr className="bg-gray-50 font-bold"><td colSpan={2} className="border border-gray-400 p-1 text-left pl-4">جمع کل:</td><td className="border border-gray-400 p-1 text-center">{totalCartons}</td><td className="border border-gray-400 p-1 text-center">{totalWeight}</td></tr></tbody></table>
                <div><h3 className="font-bold text-[10px] mb-1 flex items-center gap-1"><MapPin size={12}/> مقاصد:</h3><div className="space-y-1">{displayDestinations.map((dest, idx) => (<div key={idx} className="border border-gray-300 rounded p-1.5 flex gap-4 text-[10px] bg-gray-50"><b>{dest.recipientName}</b> {dest.phone && <span>| {dest.phone}</span>} <span>| {dest.address}</span></div>))}</div></div>
                <div className="grid grid-cols-2 gap-4 border rounded p-2 bg-gray-50 text-[10px]"><div><span className="text-gray-500 ml-2">راننده:</span> <b>{permit.driverName || '-'}</b></div><div><span className="text-gray-500 ml-2">پلاک:</span> <b className="font-mono dir-ltr">{permit.plateNumber || '-'}</b></div></div>
            </div>
            <div className="mt-4 pt-2 border-t-2 border-black grid grid-cols-4 gap-2 text-center relative z-10">
                <div className="flex flex-col items-center justify-end h-20"><div className="mb-1 font-bold text-[10px]">{permit.requester}</div><div className="text-[8px] text-gray-500 border-t w-full pt-1">مدیر فروش</div></div>
                <div className="flex flex-col items-center justify-end h-20"><div className="mb-1">{permit.approverSecurity ? <Stamp title="تایید انتظامات (ساعت)" name={`${permit.approverSecurity} (${permit.exitTime})`} /> : <span className="text-gray-200 text-[8px]">انتظامات</span>}</div><div className="text-[8px] text-gray-500 border-t w-full pt-1">انتظامات</div></div>
                <div className="flex flex-col items-center justify-end h-20"><div className="mb-1">{permit.approverFactory ? <Stamp title="تایید مدیر کارخانه" name={permit.approverFactory} /> : <span className="text-gray-200 text-[8px]">مدیر کارخانه</span>}</div><div className="text-[8px] text-gray-500 border-t w-full pt-1">مدیر کارخانه</div></div>
                <div className="flex flex-col items-center justify-end h-20"><div className="mb-1">{permit.approverCeo ? <Stamp title="تایید نهایی مدیرعامل" name={permit.approverCeo} /> : <span className="text-gray-200 text-[8px]">مدیرعامل</span>}</div><div className="text-[8px] text-gray-500 border-t w-full pt-1">مدیرعامل</div></div>
            </div>
        </div>
  );

  if (embed) return content;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex flex-col items-center justify-start md:justify-center p-4 overflow-y-auto animate-fade-in safe-pb">
        <div className="bg-white p-3 rounded-xl shadow-lg relative md:absolute md:top-4 md:left-4 z-50 flex flex-col gap-2 no-print w-full md:w-48 mb-4 md:mb-0 order-1">
            <div className="flex justify-between items-center"><span className="text-sm font-bold md:hidden">عملیات</span><button onClick={onClose} className="self-end text-gray-400 hover:text-red-500"><X size={20}/></button></div>
            {onApprove && <button onClick={onApprove} className="bg-green-600 text-white p-2 rounded flex items-center gap-2 justify-center"><CheckCircle size={16}/> تایید</button>}
            {onReject && <button onClick={onReject} className="bg-red-600 text-white p-2 rounded flex items-center gap-2 justify-center"><XCircle size={16}/> رد</button>}
            <hr className="my-1"/>
            <button onClick={() => window.print()} className="bg-blue-600 text-white p-2 rounded text-sm hover:bg-blue-700 flex items-center justify-center gap-2"><Printer size={16}/> چاپ</button>
        </div>
        <div className="order-2 w-full">{content}</div>
    </div>
  );
};
export default PrintExitPermit;
