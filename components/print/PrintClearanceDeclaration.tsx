
import React, { useState, useEffect } from 'react';
import { TradeRecord, SystemSettings } from '../../types';
import { X, Printer, Loader2 } from 'lucide-react';
import { formatNumberString } from '../../constants';

interface Props {
  record: TradeRecord;
  settings: SystemSettings;
  onClose: () => void;
}

const PrintClearanceDeclaration: React.FC<Props> = ({ record, settings, onClose }) => {
  const [processing, setProcessing] = useState(false);
  
  // Local state for editable fields
  const [formData, setFormData] = useState({
      brokerName: 'جناب آقای محمد محمودیان',
      transportMode: 'Land' as 'Rail' | 'Land' | 'Sea',
      truckCount: '',
      wagonCount: '',
      containerCount: '',
      transportCompany: '',
      part: 'اول (نهایی)',
      sataCode: '',
      bankBranch: '',
      bankCode: '',
      packageType: 'کارتن',
      letterNumber: '',
      letterDate: new Date().toLocaleDateString('fa-IR'),
      attachment: 'دارد'
  });

  const company = settings.companies?.find(c => c.name === record.company);
  const letterhead = company?.letterhead;

  const blDoc = record.shippingDocuments?.find(d => d.type === 'Bill of Lading');
  const packingList = record.shippingDocuments?.find(d => d.type === 'Packing List');
  const invoice = record.shippingDocuments?.find(d => d.type === 'Commercial Invoice');
  const warehouseReceipt = record.clearanceData?.receipts?.[0];

  const totalWeight = record.items.reduce((sum, i) => sum + i.weight, 0);
  const totalPackages = packingList?.packagesCount || 0;

  useEffect(() => {
    const style = document.getElementById('page-size-style');
    if (style) {
      style.innerHTML = '@page { size: A4 portrait; margin: 0; }';
    }
  }, []);

  const handlePrint = () => {
      setProcessing(true);
      setTimeout(() => {
          window.print();
          setProcessing(false);
      }, 500);
  };

  const Input = ({ value, onChange, className = "", placeholder = "................" }: any) => (
      <input 
        value={value} 
        onChange={e => onChange(e.target.value)} 
        className={`bg-transparent border-b border-gray-300 focus:border-blue-500 outline-none text-center font-bold text-gray-800 px-1 print:border-none print:placeholder-transparent ${className}`}
        placeholder={placeholder}
      />
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[130] flex flex-col items-center justify-start md:justify-center p-4 overflow-y-auto animate-fade-in safe-pb">
        <div className="relative md:absolute md:top-4 md:left-4 z-50 flex flex-col gap-2 no-print w-full md:w-auto mb-4 md:mb-0 order-1">
            <div className="bg-white p-3 rounded-xl shadow-lg flex justify-between items-center gap-4">
                <span className="font-bold text-sm">اعلام ورود کالا (ترخیصیه)</span>
                <div className="flex gap-2">
                    <button onClick={handlePrint} disabled={processing} className="bg-blue-600 text-white p-2 rounded text-xs flex items-center gap-1"><Printer size={16}/> چاپ</button>
                    <button onClick={onClose} className="bg-gray-100 text-gray-700 p-2 rounded hover:bg-gray-200"><X size={18}/></button>
                </div>
            </div>
        </div>

        <div className="order-2 w-full overflow-auto flex justify-center">
            <div className="printable-content bg-white shadow-2xl relative text-black" 
                style={{ 
                    width: '210mm', 
                    minHeight: '297mm', 
                    direction: 'rtl',
                    boxSizing: 'border-box',
                    backgroundImage: letterhead ? `url(${letterhead})` : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                    padding: '40mm 20mm 20mm 20mm'
                }}>
                
                {/* Header Info Overlay */}
                <div className="absolute top-[40mm] left-[20mm] text-left text-sm font-bold space-y-1 w-48">
                    <div className="flex justify-between items-center">
                        <span>تاریخ:</span>
                        <Input value={formData.letterDate} onChange={(v: string) => setFormData({...formData, letterDate: v})} className="w-24 text-left" />
                    </div>
                    <div className="flex justify-between items-center">
                        <span>شماره:</span>
                        <Input value={formData.letterNumber} onChange={(v: string) => setFormData({...formData, letterNumber: v})} className="w-24 text-left" />
                    </div>
                    <div className="flex justify-between items-center">
                        <span>پیوست:</span>
                        <Input value={formData.attachment} onChange={(v: string) => setFormData({...formData, attachment: v})} className="w-24 text-left" />
                    </div>
                </div>

                {/* Title */}
                <div className="text-center mb-8 mt-4">
                    <h2 className="font-bold text-lg">بسمه تعالی</h2>
                    <h1 className="font-black text-xl mt-2 border-b-2 border-black inline-block pb-1">
                        کارگزار رسمی گمرک ایران - <Input value={formData.brokerName} onChange={(v: string) => setFormData({...formData, brokerName: v})} className="w-64 text-center text-lg" />
                    </h1>
                </div>

                {/* Body */}
                <div className="text-justify leading-loose mb-6 font-medium">
                    با سلام<br/>
                    احتراماً، ورود یک محموله کالا از طریق 
                    <label className="inline-flex items-center mx-2 cursor-pointer print:mx-1">
                        <input type="checkbox" checked={formData.transportMode === 'Rail'} onChange={() => setFormData({...formData, transportMode: 'Rail'})} className="mx-1"/> ریلی
                    </label>
                    <label className="inline-flex items-center mx-2 cursor-pointer print:mx-1">
                        <input type="checkbox" checked={formData.transportMode === 'Land'} onChange={() => setFormData({...formData, transportMode: 'Land'})} className="mx-1"/> زمینی
                    </label>
                    <label className="inline-flex items-center mx-2 cursor-pointer print:mx-1">
                        <input type="checkbox" checked={formData.transportMode === 'Sea'} onChange={() => setFormData({...formData, transportMode: 'Sea'})} className="mx-1"/> دریایی
                    </label>
                    بنام این شرکت با مشخصات ذیل اعلام میگردد. خواهشمند است دستور فرمائید نسبت به ترخیص آن اقدامات لازم معمول گردد. بدیهی است محل ارسال محموله مورد بحث متعاقباً اعلام خواهد شد.
                </div>

                {/* Details Grid */}
                <div className="space-y-3 text-sm">
                    <div className="flex gap-4">
                        <span>• تعداد کامیون:</span> <Input value={formData.truckCount} onChange={(v: string) => setFormData({...formData, truckCount: v})} className="w-16" />
                        <span>تعداد واگن:</span> <Input value={formData.wagonCount} onChange={(v: string) => setFormData({...formData, wagonCount: v})} className="w-16" />
                        <span>تعداد کانتینر:</span> <Input value={formData.containerCount} onChange={(v: string) => setFormData({...formData, containerCount: v})} className="w-16" />
                    </div>

                    <div className="flex gap-2">
                        <span>• شرکت حمل و نقل:</span> <Input value={formData.transportCompany} onChange={(v: string) => setFormData({...formData, transportCompany: v})} className="flex-1" />
                    </div>

                    <div className="flex gap-4">
                        <span>• شماره سفارش کالا (Order):</span> <span className="font-mono font-bold border-b border-gray-300 px-2 min-w-[100px] text-center inline-block">{record.orderNumber || record.fileNumber}</span>
                        <span>پارت:</span> <Input value={formData.part} onChange={(v: string) => setFormData({...formData, part: v})} className="w-32" />
                    </div>

                    <div className="flex gap-2">
                        <span>• شماره قبض انبار:</span> <span className="font-mono font-bold border-b border-gray-300 px-2 flex-1 text-center inline-block">{warehouseReceipt?.number || '........................'}</span>
                    </div>

                    <div className="flex gap-2">
                        <span>• شماره بارنامه:</span> <span className="font-mono font-bold border-b border-gray-300 px-2 flex-1 text-center inline-block">{blDoc?.documentNumber || '........................'}</span>
                    </div>

                    <div className="flex gap-4">
                        <span>• شماره ثبت سفارش:</span> <span className="font-mono font-bold border-b border-gray-300 px-2 min-w-[150px] text-center inline-block">{record.registrationNumber || '................'}</span>
                        <span>تاریخ ثبت سفارش:</span> <span className="font-mono font-bold border-b border-gray-300 px-2 min-w-[100px] text-center inline-block">{record.registrationDate || '................'}</span>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                        <span>• نوع خرید:</span> <span className="font-bold border-b border-gray-300 px-2">{record.currencyAllocationType === 'Bank' ? 'بانکی' : 'غیربانکی'}</span>
                        <span>شماره حواله/برات:</span> <Input className="w-32" />
                        <span>کدرهگیری بانک:</span> <Input className="w-32" />
                    </div>

                    <div className="flex gap-2">
                        <span>• کد ساتا:</span> <Input value={formData.sataCode} onChange={(v: string) => setFormData({...formData, sataCode: v})} className="flex-1" placeholder="متعاقباً اعلام خواهد شد" />
                    </div>

                    <div className="flex gap-2 flex-wrap">
                        <span>• نام بانک عامل:</span> <span className="font-bold border-b border-gray-300 px-2 min-w-[150px] text-center">{record.operatingBank || '................'}</span>
                        <span>نام شعبه:</span> <Input value={formData.bankBranch} onChange={(v: string) => setFormData({...formData, bankBranch: v})} className="w-32" />
                        <span>کد بانک:</span> <Input value={formData.bankCode} onChange={(v: string) => setFormData({...formData, bankCode: v})} className="w-20" />
                    </div>

                    <div className="flex gap-2 flex-wrap items-center">
                        <span>• وزن:</span> <span className="font-bold font-mono border-b border-gray-300 px-2 min-w-[80px] text-center">{formatNumberString(totalWeight)}</span> <span className="text-xs">کیلوگرم خالص</span>
                        <span>تعداد نگله - بسته - عدل - کارتن:</span> <span className="font-bold font-mono border-b border-gray-300 px-2 min-w-[60px] text-center">{formatNumberString(totalPackages)}</span> 
                        <Input value={formData.packageType} onChange={(v: string) => setFormData({...formData, packageType: v})} className="w-20" />
                    </div>
                </div>

                {/* Attachments Checkboxes */}
                <div className="mt-6">
                    <span className="font-bold block mb-2">• مدارک ضمیمه:</span>
                    <div className="grid grid-cols-4 gap-y-2 gap-x-4 text-xs">
                        <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" className="w-4 h-4" defaultChecked={!!blDoc} /> ۱- بارنامه (بارنامه دستی)</label>
                        <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" className="w-4 h-4" defaultChecked={!!invoice} /> ۲- اینویس</label>
                        <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" className="w-4 h-4" defaultChecked={!!packingList} /> ۳- پکینگ لیست</label>
                        <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" className="w-4 h-4" /> ۴- پروفرما</label>
                        
                        <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" className="w-4 h-4" defaultChecked={!!record.registrationNumber} /> ۵- کپی ثبت سفارش</label>
                        <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" className="w-4 h-4" defaultChecked={!!record.shippingDocuments?.find(d=>d.type==='Certificate of Origin')} /> ۶- گواهی مبدا</label>
                        <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" className="w-4 h-4" defaultChecked={!!record.insuranceData?.policyNumber} /> ۷- بیمه نامه</label>
                        <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" className="w-4 h-4" defaultChecked={!!record.inspectionData?.certificates.length} /> ۸- گواهی بازرسی</label>
                        
                        <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" className="w-4 h-4" defaultChecked={!!warehouseReceipt} /> ۹- قبض انبار</label>
                        <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" className="w-4 h-4" /> ۱۰- تصویر ترخیصیه الکترونیک</label>
                        <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" className="w-4 h-4" defaultChecked={!!record.insuranceData?.endorsements?.length} /> ۱۱- الحاقیه بیمه نامه</label>
                        <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" className="w-4 h-4" /> ۱۲- اظهارنامه های صادراتی</label>
                        
                        <label className="flex items-center gap-1 cursor-pointer col-span-2"><input type="checkbox" className="w-4 h-4" /> ۱۳- تصویر سی ام آر کامیون و یا بارنامه واگن</label>
                    </div>
                </div>

                {/* Footer Signature */}
                <div className="mt-16 text-center text-sm font-bold">
                    <div>با احترام</div>
                    <div className="mt-2">{record.company}</div>
                </div>

            </div>
        </div>
    </div>
  );
};

export default PrintClearanceDeclaration;
