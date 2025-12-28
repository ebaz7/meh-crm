
import React from 'react';
import { ShieldCheck, Save, CheckCircle2, XCircle } from 'lucide-react';
import { formatNumberString, deformatNumberString, formatCurrency } from '../../constants';

interface Props {
    currencyGuarantee: {
        amount: string;
        bank: string;
        number: string;
        date: string;
        isDelivered: boolean;
    };
    setCurrencyGuarantee: React.Dispatch<React.SetStateAction<{
        amount: string;
        bank: string;
        number: string;
        date: string;
        isDelivered: boolean;
    }>>;
    companyBanks: string[]; // List of banks specific to the company
    onSave: () => void;
    onToggleDelivery: () => void;
}

const CurrencyGuaranteeSection: React.FC<Props> = ({ 
    currencyGuarantee, 
    setCurrencyGuarantee, 
    companyBanks, 
    onSave, 
    onToggleDelivery 
}) => {
    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border space-y-4">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <ShieldCheck size={20} className="text-purple-600"/> 
                چک ضمانت ارزی (رفع تعهد)
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 items-end bg-purple-50 p-4 rounded-lg">
                <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700">شماره چک</label>
                    <input 
                        className="w-full border rounded p-2 text-sm dir-ltr" 
                        value={currencyGuarantee.number} 
                        onChange={e => setCurrencyGuarantee({...currencyGuarantee, number: e.target.value})} 
                    />
                </div>
                
                <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700">نام بانک (شرکت)</label>
                    <select 
                        className="w-full border rounded p-2 text-sm bg-white" 
                        value={currencyGuarantee.bank} 
                        onChange={e => setCurrencyGuarantee({...currencyGuarantee, bank: e.target.value})}
                    >
                        <option value="">انتخاب کنید...</option>
                        {companyBanks.length > 0 ? (
                            companyBanks.map((b, idx) => (
                                <option key={`${b}-${idx}`} value={b}>{b}</option>
                            ))
                        ) : (
                            <option disabled>بانکی برای این شرکت تعریف نشده است</option>
                        )}
                    </select>
                </div>

                <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700">مبلغ (ریال)</label>
                    <input 
                        className="w-full border rounded p-2 text-sm dir-ltr" 
                        value={currencyGuarantee.amount} 
                        onChange={e => setCurrencyGuarantee({...currencyGuarantee, amount: formatNumberString(deformatNumberString(e.target.value).toString())})} 
                    />
                </div>
                
                <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700">تاریخ سررسید</label>
                    <input 
                        className="w-full border rounded p-2 text-sm dir-ltr" 
                        placeholder="1403/xx/xx" 
                        value={currencyGuarantee.date} 
                        onChange={e => setCurrencyGuarantee({...currencyGuarantee, date: e.target.value})} 
                    />
                </div>
                
                <button 
                    onClick={onSave} 
                    className="bg-purple-600 text-white p-2 rounded-lg text-sm font-bold hover:bg-purple-700 h-[38px] flex items-center justify-center gap-1"
                >
                    <Save size={16} /> ذخیره
                </button>
            </div>

            <div className="flex items-center gap-2">
                <label className="text-sm font-bold text-gray-700">وضعیت چک:</label>
                <button 
                    onClick={onToggleDelivery} 
                    className={`px-3 py-1 rounded text-xs font-bold transition-colors flex items-center gap-1 ${currencyGuarantee.isDelivered ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-red-100 text-red-700 border border-red-300'}`}
                >
                    {currencyGuarantee.isDelivered ? <CheckCircle2 size={14}/> : <XCircle size={14}/>}
                    {currencyGuarantee.isDelivered ? 'عودت داده شد (رفع تعهد)' : 'نزد سازمان (در جریان)'}
                </button>
            </div>
        </div>
    );
};

export default CurrencyGuaranteeSection;
