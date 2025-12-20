import React, { useState, useEffect } from 'react';
import { ExitPermit, ExitPermitStatus, SystemSettings } from '../types';
import { formatDate } from '../constants';
// Added CheckCircle to imports
import { X, Printer, Clock, MapPin, Package, Truck, CheckCircle } from 'lucide-react';

interface Props {
  permit: ExitPermit;
  onClose: () => void;
  onApprove?: () => void;
  onReject?: () => void;
  settings?: SystemSettings;
  embed?: boolean; 
}

const PrintExitPermit: React.FC<Props> = ({ permit, onClose, onApprove, onReject, settings, embed }) => {
  useEffect(() => {
      const style = document.getElementById('page-size-style');
      if (style && !embed) { 
          style.innerHTML = '@page { size: A4 portrait; margin: 10mm; }';
      }
  }, [embed]);

  const Stamp = ({ title, name, date }: { title: string, name: string, date?: string }) => (
      <div className="border-2 border-blue-800 text-blue-800 rounded-xl p-2 rotate-[-5deg] opacity-90 inline-block bg-white/80 print:bg-transparent shadow-sm">
          <div className="text-[10px] font-bold border-b border-blue-800 mb-1 pb-1 text-center">{title}</div>
          <div className="text-sm font-black text-center px-2">{name}</div>
          {date && <div className="text-[10px] text-center mt-1">{date}</div>}
      </div>
  );

  const displayItems = permit.items && permit.items.length > 0 ? permit.items : [{ id: 'legacy', goodsName: permit.goodsName || '', cartonCount: permit.cartonCount || 0, weight: permit.weight || 0 }];
  const displayDestinations = permit.destinations && permit.destinations.length > 0 ? permit.destinations : [{ id: 'legacy', recipientName: permit.recipientName || '', address: permit.destinationAddress || '', phone: '' }];
  const totalCartons = displayItems.reduce((acc, i) => acc + (Number(i.cartonCount) || 0), 0);
  const totalWeight = displayItems.reduce((acc, i) => acc + (Number(i.weight) || 0), 0);

  const content = (
      <div id={embed ? `print-permit-${permit.id}` : "print-area-exit"} 
        className="printable-content bg-white mx-auto shadow-2xl relative text-gray-900 flex flex-col" 
        style={{ 
            direction: 'rtl',
            width: '210mm',
            minHeight: '297mm',
            padding: '15mm', 
            boxSizing: 'border-box'
        }}>
            {/* Header */}
            <div className="flex justify-between items-center border-b-4 border-black pb-4 mb-8">
                <div className="flex items-center gap-4">
                    {settings?.pwaIcon && <img src={settings.pwaIcon} className="w-20 h-20 object-contain"/>}
                    <div>
                        <h1 className="text-3xl font-black mb-1">مجوز خروج کالا از کارخانه</h1>
                        <p className="text-sm font-bold text-gray-600">سیستم مکانیزه مدیریت بار و خروج</p>
                    </div>
                </div>
                <div className="text-left space-y-2">
                    <div className="text-xl font-black bg-gray-100 px-4 py-2 border-2 border-black rounded-lg">شماره: {permit.permitNumber}</div>
                    <div className="text-sm font-bold">تاریخ: {formatDate(permit.date)}</div>
                    {permit.exitTime && <div className="text-sm font-black text-blue-700 flex items-center gap-1 justify-end"><Clock size={16}/> خروج: {permit.exitTime}</div>}
                </div>
            </div>

            {/* Main Info */}
            <div className="flex-1 space-y-8">
                {/* Items Table */}
                <div className="space-y-2">
                    <h3 className="font-black text-lg flex items-center gap-2"><Package size={20}/> لیست اقلام و کالاها</h3>
                    <table className="w-full text-sm border-collapse border-2 border-black">
                        <thead>
                            <tr className="bg-gray-100 text-base">
                                <th className="border-2 border-black p-3 w-12 text-center">#</th>
                                <th className="border-2 border-black p-3 text-right">شرح کالا / محصول</th>
                                <th className="border-2 border-black p-3 w-32 text-center">تعداد (کارتن)</th>
                                <th className="border-2 border-black p-3 w-32 text-center">وزن (KG)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayItems.map((item, idx) => (
                                <tr key={idx} className="text-lg">
                                    <td className="border-2 border-black p-3 text-center">{idx + 1}</td>
                                    <td className="border-2 border-black p-3 font-bold">{item.goodsName}</td>
                                    <td className="border-2 border-black p-3 text-center font-mono">{item.cartonCount}</td>
                                    <td className="border-2 border-black p-3 text-center font-mono">{item.weight}</td>
                                </tr>
                            ))}
                            <tr className="bg-gray-50 font-black text-xl">
                                <td colSpan={2} className="border-2 border-black p-4 text-left pl-8 text-lg">جمع کل مقادیر:</td>
                                <td className="border-2 border-black p-4 text-center font-mono">{totalCartons}</td>
                                <td className="border-2 border-black p-4 text-center font-mono">{totalWeight}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Destinations */}
                <div className="space-y-2">
                    <h3 className="font-black text-lg flex items-center gap-2"><MapPin size={20}/> مقاصد و گیرندگان</h3>
                    <div className="space-y-2">
                        {displayDestinations.map((dest, idx) => (
                            <div key={idx} className="border-2 border-gray-300 rounded-xl p-4 flex flex-col gap-1 bg-gray-50/50">
                                <div className="flex justify-between font-black text-base border-b border-gray-300 pb-1 mb-1">
                                    <span>گیرنده: {dest.recipientName}</span>
                                    {dest.phone && <span className="font-mono">تلفن: {dest.phone}</span>}
                                </div>
                                <div className="text-sm">آدرس: {dest.address}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Driver Info */}
                <div className="grid grid-cols-2 gap-6 bg-gray-100 border-2 border-black p-6 rounded-2xl">
                    <div className="flex items-center gap-3 text-lg"><Truck size={24} className="text-gray-600"/> <span className="font-bold">نام راننده:</span> <span className="font-black">{permit.driverName || '---'}</span></div>
                    <div className="flex items-center gap-3 text-lg"><div className="font-bold">شماره پلاک:</div> <div className="font-black font-mono tracking-widest dir-ltr border-2 border-gray-400 bg-white px-4 py-1 rounded-lg">{permit.plateNumber || '---'}</div></div>
                    {permit.description && <div className="col-span-2 mt-2 pt-2 border-t border-gray-300 text-sm italic"><span className="font-bold not-italic">توضیحات:</span> {permit.description}</div>}
                </div>
            </div>

            {/* Footer - Order: Sales Mgr -> CEO -> Factory -> Security */}
            <div className="mt-12 pt-8 border-t-4 border-black grid grid-cols-4 gap-4 text-center">
                <div className="flex flex-col items-center justify-end min-h-[140px]">
                    <div className="mb-2 font-black text-sm">{permit.requester}</div>
                    <div className="w-full border-t-2 border-gray-300 pt-2"><span className="text-xs font-black text-gray-700">مدیر فروش (درخواست)</span></div>
                </div>
                <div className="flex flex-col items-center justify-end min-h-[140px]">
                    <div className="mb-2">{permit.approverCeo ? <Stamp title="تایید مدیریت عامل" name={permit.approverCeo} /> : <span className="text-gray-300 text-xs italic">امضا مدیرعامل</span>}</div>
                    <div className="w-full border-t-2 border-gray-300 pt-2"><span className="text-xs font-black text-gray-700">مدیر عامل</span></div>
                </div>
                <div className="flex flex-col items-center justify-end min-h-[140px]">
                    <div className="mb-2">{permit.approverFactory ? <Stamp title="تایید مدیر کارخانه" name={permit.approverFactory} /> : <span className="text-gray-300 text-xs italic">امضا مدیر کارخانه</span>}</div>
                    <div className="w-full border-t-2 border-gray-300 pt-2"><span className="text-xs font-black text-gray-700">مدیر کارخانه</span></div>
                </div>
                <div className="flex flex-col items-center justify-end min-h-[140px]">
                    <div className="mb-2">{permit.approverSecurity ? <Stamp title="خروج نهایی (ساعت)" name={`${permit.approverSecurity} (${permit.exitTime})`} /> : <span className="text-gray-300 text-xs italic">تایید انتظامات</span>}</div>
                    <div className="w-full border-t-2 border-gray-300 pt-2"><span className="text-xs font-black text-gray-700">انتظامات / حراست</span></div>
                </div>
            </div>
            
            <div className="mt-8 text-center text-[10px] text-gray-400">این سند به صورت سیستمی تولید شده و فاقد خدشه معتبر می‌باشد. | تاریخ چاپ: {new Date().toLocaleString('fa-IR')}</div>
        </div>
  );

  if (embed) return content;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex flex-col items-center justify-start md:justify-center p-4 overflow-y-auto animate-fade-in safe-pb">
        <div className="bg-white p-3 rounded-xl shadow-lg relative md:absolute md:top-4 md:left-4 z-50 flex flex-col gap-2 no-print w-full md:w-48 mb-4 md:mb-0 order-1">
            <div className="flex justify-between items-center"><span className="text-sm font-bold md:hidden">پنل عملیات</span><button onClick={onClose} className="self-end text-gray-400 hover:text-red-500"><X size={20}/></button></div>
            {/* Added CheckCircle for Approve button */}
            {onApprove && <button onClick={onApprove} className="bg-green-600 text-white p-2 rounded flex items-center gap-2 justify-center font-bold"><CheckCircle size={18}/> تایید مرحله بعدی</button>}
            {onReject && <button onClick={onReject} className="bg-red-600 text-white p-2 rounded flex items-center gap-2 justify-center font-bold"><X size={18}/> رد درخواست</button>}
            <hr className="my-1"/>
            <button onClick={() => window.print()} className="bg-blue-600 text-white p-3 rounded-xl text-sm font-bold hover:bg-blue-700 flex items-center justify-center gap-2 shadow-lg"><Printer size={20}/> چاپ (A4)</button>
        </div>
        <div className="order-2 w-full flex justify-center pb-10">{content}</div>
    </div>
  );
};
export default PrintExitPermit;