
import React from 'react';
import { TradeRecord, InsuranceEndorsement } from '../types';
import { Save, Plus, Trash2 } from 'lucide-react';
import { formatNumberString, deformatNumberString, formatCurrency } from '../constants';

interface InsuranceTabProps {
    form: NonNullable<TradeRecord['insuranceData']>;
    setForm: (data: any) => void;
    companies: string[];
    banks: string[];
    onSave: () => void;
    // Endorsement Props
    newEndorsement: Partial<InsuranceEndorsement>;
    setNewEndorsement: (val: any) => void;
    endorsementType: 'increase' | 'refund';
    setEndorsementType: (val: any) => void;
    onAddEndorsement: () => void;
    onDeleteEndorsement: (id: string) => void;
}

const InsuranceTab: React.FC<InsuranceTabProps> = ({ 
    form, setForm, companies, banks, onSave,
    newEndorsement, setNewEndorsement, endorsementType, setEndorsementType, onAddEndorsement, onDeleteEndorsement
}) => {
    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border space-y-4">
                <h3 className="font-bold text-gray-800">بیمه باربری</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-700">شماره بیمه‌نامه</label>
                        <input className="w-full border rounded p-2 text-sm dir-ltr" value={form.policyNumber} onChange={e => setForm({...form, policyNumber: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-700">شرکت بیمه</label>
                        <input 
                            list="insurance-company-list"
                            className="w-full border rounded p-2 text-sm" 
                            value={form.company} 
                            onChange={e => setForm({...form, company: e.target.value})} 
                            placeholder="انتخاب یا تایپ کنید..."
                        />
                        <datalist id="insurance-company-list">
                            {companies.map((c, i) => <option key={i} value={c} />)}
                        </datalist>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-700">هزینه اولیه (ریال)</label>
                        <input className="w-full border rounded p-2 text-sm dir-ltr" value={formatNumberString(form.cost)} onChange={e => setForm({...form, cost: deformatNumberString(e.target.value)})} />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-700">بانک پرداخت کننده</label>
                        <select className="w-full border rounded p-2 text-sm" value={form.bank} onChange={e => setForm({...form, bank: e.target.value})}>
                            <option value="">انتخاب بانک</option>
                            {banks.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                    </div>
                    <div className="md:col-span-2 flex items-center gap-4 pt-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={form.isPaid} onChange={e => setForm({...form, isPaid: e.target.checked})} className="w-4 h-4 text-green-600 rounded" /> 
                            <span className="text-sm font-bold">پرداخت شده (تسویه)</span>
                        </label>
                        {form.isPaid && (
                            <input type="text" className="border rounded p-1 text-sm" placeholder="تاریخ پرداخت" value={form.paymentDate} onChange={e => setForm({...form, paymentDate: e.target.value})} />
                        )}
                    </div>
                </div>
                <div className="flex justify-end">
                    <button onClick={onSave} className="bg-green-600 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-green-700 flex items-center gap-2">
                        <Save size={16}/> ذخیره اطلاعات بیمه
                    </button>
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border space-y-4">
                <h3 className="font-bold text-gray-800">الحاقیه‌های بیمه</h3>
                <div className="bg-gray-50 p-4 rounded-lg flex flex-wrap gap-4 items-end">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-700">نوع الحاقیه</label>
                        <div className="flex bg-white rounded border overflow-hidden">
                            <button onClick={() => setEndorsementType('increase')} className={`px-3 py-1 text-xs font-bold ${endorsementType === 'increase' ? 'bg-blue-100 text-blue-700' : 'text-gray-600'}`}>افزایش حق بیمه</button>
                            <button onClick={() => setEndorsementType('refund')} className={`px-3 py-1 text-xs font-bold ${endorsementType === 'refund' ? 'bg-green-100 text-green-700' : 'text-gray-600'}`}>برگشت حق بیمه</button>
                        </div>
                    </div>
                    <div className="space-y-1 flex-1 min-w-[150px]">
                        <label className="text-xs font-bold text-gray-700">مبلغ (ریال)</label>
                        <input className="w-full border rounded p-2 text-sm dir-ltr" value={formatNumberString(newEndorsement.amount)} onChange={e => setNewEndorsement({...newEndorsement, amount: deformatNumberString(e.target.value)})} />
                    </div>
                    <div className="space-y-1 flex-1 min-w-[200px]">
                        <label className="text-xs font-bold text-gray-700">توضیحات</label>
                        <input className="w-full border rounded p-2 text-sm" value={newEndorsement.description} onChange={e => setNewEndorsement({...newEndorsement, description: e.target.value})} />
                    </div>
                    <button onClick={onAddEndorsement} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 h-[38px]">
                        <Plus size={16} />
                    </button>
                </div>
                <div className="space-y-2">
                    {form.endorsements?.map((end, idx) => (
                        <div key={end.id} className={`flex justify-between items-center border p-3 rounded-lg ${end.amount > 0 ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
                            <div className="flex gap-4 text-sm">
                                <span className="font-bold text-gray-800">{idx + 1}.</span>
                                <span>{end.date}</span>
                                <span className={`font-mono font-bold ${end.amount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                    {end.amount > 0 ? '+' : ''}{formatCurrency(end.amount)}
                                </span>
                                <span className="text-gray-600">{end.description}</span>
                            </div>
                            <button onClick={() => onDeleteEndorsement(end.id)} className="text-gray-400 hover:text-red-500">
                                <Trash2 size={16}/>
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default InsuranceTab;
