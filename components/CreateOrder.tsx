
import React, { useState, useEffect } from 'react';
import { PaymentMethod, OrderStatus, PaymentOrder, PaymentDetail, SystemSettings, UserRole, CompanyBank } from '../types';
import { saveOrder, getNextTrackingNumber, uploadFile, getSettings, saveSettings } from '../services/storageService';
import { enhanceDescription } from '../services/geminiService';
import { apiCall } from '../services/apiService';
import { jalaliToGregorian, getCurrentShamsiDate, formatCurrency, generateUUID, normalizeInputNumber, formatNumberString, deformatNumberString, formatDate } from '../constants';
import { Wand2, Save, Loader2, Plus, Trash2, Paperclip, X, Hash, UploadCloud, Building2, BrainCircuit, AlertTriangle, Calendar, Landmark, CreditCard, Edit, ArrowRightLeft, MapPin } from 'lucide-react';
import { getUsers } from '../services/authService';

interface CreateOrderProps {
  onSuccess: () => void;
  currentUser: any;
}

const MONTHS = [ 'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند' ];

const CreateOrder: React.FC<CreateOrderProps> = ({ onSuccess, currentUser }) => {
  const currentShamsi = getCurrentShamsiDate();
  const [shamsiDate, setShamsiDate] = useState({ year: currentShamsi.year, month: currentShamsi.month, day: currentShamsi.day });
  const [formData, setFormData] = useState({ payee: '', description: '', });
  const [trackingNumber, setTrackingNumber] = useState<string>('');
  const [payingCompany, setPayingCompany] = useState('');
  const [paymentLocation, setPaymentLocation] = useState(''); // NEW: Payment Location
  
  const [availableCompanies, setAvailableCompanies] = useState<string[]>([]);
  const [availableBanks, setAvailableBanks] = useState<string[]>([]); // Strings for dropdown options
  const [paymentLines, setPaymentLines] = useState<PaymentDetail[]>([]);
  
  // NEW: Editing state for lines
  const [editingLineId, setEditingLineId] = useState<string | null>(null);

  // Updated NewLine State including SATNA fields and Internal Transfer
  const [newLine, setNewLine] = useState<{ 
      method: PaymentMethod; 
      amount: string; 
      chequeNumber: string; 
      bankName: string; 
      description: string; 
      chequeDate: {y:number, m:number, d:number};
      sheba: string;
      recipientBank: string;
      paymentId: string;
      destinationAccount: string;
      destinationOwner: string;
      destinationBranch: string; // New field
  }>({ 
      method: PaymentMethod.TRANSFER, 
      amount: '', 
      chequeNumber: '', 
      bankName: '', 
      description: '',
      chequeDate: { year: currentShamsi.year, month: currentShamsi.month, day: currentShamsi.day } as any,
      sheba: '',
      recipientBank: '',
      paymentId: '',
      destinationAccount: '',
      destinationOwner: '',
      destinationBranch: ''
  });
  const [attachments, setAttachments] = useState<{ fileName: string, data: string }[]>([]);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{score: number, recommendation: string, reasons: string[]} | null>(null);
  const [uploading, setUploading] = useState(false);
  
  // Auto Send Logic
  const [settings, setSettings] = useState<SystemSettings | null>(null);

  // Add Bank Modal State
  const [showAddBankModal, setShowAddBankModal] = useState(false);
  const [newBankName, setNewBankName] = useState('');
  const [newBankAccount, setNewBankAccount] = useState('');

  useEffect(() => {
      getSettings().then((s) => {
          setSettings(s);
          // Prefer 'companies' array if available for names
          const names = s.companies?.map(c => c.name) || s.companyNames || [];
          setAvailableCompanies(names);
          
          const defCompany = s.defaultCompany || '';
          setPayingCompany(defCompany);
          
          updateBanksForCompany(defCompany, s);
      });
      getNextTrackingNumber().then(num => setTrackingNumber(num.toString()));
  }, []);

  const updateBanksForCompany = (companyName: string, currentSettings: SystemSettings) => {
      const company = currentSettings.companies?.find(c => c.name === companyName);
      if (company && company.banks && company.banks.length > 0) {
          // Format: "BankName - AccountNum"
          setAvailableBanks(company.banks.map(b => `${b.bankName}${b.accountNumber ? ` - ${b.accountNumber}` : ''}`));
      } else {
          setAvailableBanks([]); // Reset if no banks found for this company
      }
  };

  const handleCompanyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newVal = e.target.value;
      setPayingCompany(newVal);
      if (settings) updateBanksForCompany(newVal, settings);
      setNewLine(prev => ({ ...prev, bankName: '' })); // Reset selected bank on company change
  };

  const openAddBankModal = () => {
      if (!payingCompany) return alert('لطفا ابتدا شرکت پرداخت کننده را انتخاب کنید.');
      setNewBankName('');
      setNewBankAccount('');
      setShowAddBankModal(true);
  };

  const handleSaveNewBank = async () => {
      if (!newBankName.trim()) return alert('نام بانک الزامی است.');
      if (!settings) return;

      const newBankObj: CompanyBank = { 
          id: generateUUID(), 
          bankName: newBankName.trim(), 
          accountNumber: newBankAccount.trim() 
      };
      const comboName = `${newBankObj.bankName}${newBankObj.accountNumber ? ` - ${newBankObj.accountNumber}` : ''}`;

      // Update Settings structure
      const updatedCompanies = (settings.companies || []).map(c => {
          if (c.name === payingCompany) {
              return { ...c, banks: [...(c.banks || []), newBankObj] };
          }
          return c;
      });

      const newSettings = { ...settings, companies: updatedCompanies };
      
      try {
          await saveSettings(newSettings);
          setSettings(newSettings);
          setAvailableBanks(prev => [...prev, comboName]);
          setNewLine(prev => ({ ...prev, bankName: comboName }));
          setShowAddBankModal(false);
      } catch (e) {
          alert('خطا در ذخیره بانک جدید');
      }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => { 
      if (e.key === 'Enter' && !e.shiftKey) { 
          e.preventDefault(); 
          const form = e.currentTarget.form; 
          if (!form) return; 
          const index = Array.prototype.indexOf.call(form, e.currentTarget); 
          const nextElement = form.elements[index + 1] as HTMLElement; 
          if (nextElement) nextElement.focus(); 
      } 
  };
  
  const getIsoDate = () => { try { const date = jalaliToGregorian(shamsiDate.year, shamsiDate.month, shamsiDate.day); const y = date.getFullYear(); const m = String(date.getMonth() + 1).padStart(2, '0'); const d = String(date.getDate()).padStart(2, '0'); return `${y}-${m}-${d}`; } catch (e) { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`; } };
  
  const handleEnhance = async () => { if (!formData.description) return; setIsEnhancing(true); const improved = await enhanceDescription(formData.description); setFormData(p => ({ ...p, description: improved })); setIsEnhancing(false); };
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; setUploading(true); const reader = new FileReader(); reader.onload = async (ev) => { try { const result = await uploadFile(file.name, ev.target?.result as string); setAttachments([...attachments, { fileName: result.fileName, data: result.url }]); } catch (e) { alert('خطا در آپلود'); } finally { setUploading(false); } }; reader.readAsDataURL(file); e.target.value = ''; };
  const removeAttachment = (index: number) => { setAttachments(attachments.filter((_, i) => i !== index)); };
  
  const addPaymentLine = () => { 
      const amt = deformatNumberString(newLine.amount); 
      if (!amt) return; 

      // SATNA / PAYA Validation
      if (newLine.method === PaymentMethod.SHEBA || newLine.method === PaymentMethod.SATNA || newLine.method === PaymentMethod.PAYA) {
          const sheba = normalizeInputNumber(newLine.sheba).replace(/[^0-9]/g, '');
          if (sheba.length !== 24) {
              alert('شماره شبا باید دقیقاً ۲۴ رقم باشد.');
              return;
          }
      }
      
      const detail: PaymentDetail = { 
          id: editingLineId || generateUUID(), 
          method: newLine.method, 
          amount: amt, 
          chequeNumber: newLine.method === PaymentMethod.CHEQUE ? normalizeInputNumber(newLine.chequeNumber) : undefined, 
          bankName: (newLine.method === PaymentMethod.TRANSFER || newLine.method === PaymentMethod.CHEQUE || newLine.method === PaymentMethod.SHEBA || newLine.method === PaymentMethod.SATNA || newLine.method === PaymentMethod.INTERNAL_TRANSFER) ? newLine.bankName : undefined, 
          description: newLine.description, 
          chequeDate: newLine.method === PaymentMethod.CHEQUE ? `${newLine.chequeDate.y}/${newLine.chequeDate.m}/${newLine.chequeDate.d}` : undefined,
          
          // SATNA Fields
          sheba: (newLine.method === PaymentMethod.SHEBA || newLine.method === PaymentMethod.SATNA || newLine.method === PaymentMethod.PAYA) ? normalizeInputNumber(newLine.sheba).replace(/[^0-9]/g, '') : undefined,
          recipientBank: (newLine.method === PaymentMethod.SHEBA || newLine.method === PaymentMethod.SATNA || newLine.method === PaymentMethod.PAYA) ? newLine.recipientBank : undefined,
          paymentId: (newLine.method === PaymentMethod.SHEBA || newLine.method === PaymentMethod.SATNA || newLine.method === PaymentMethod.PAYA) ? newLine.paymentId : undefined,
          
          // Internal Transfer Fields
          destinationAccount: newLine.method === PaymentMethod.INTERNAL_TRANSFER ? normalizeInputNumber(newLine.destinationAccount) : undefined,
          destinationOwner: newLine.method === PaymentMethod.INTERNAL_TRANSFER ? newLine.destinationOwner : undefined,
          destinationBranch: newLine.method === PaymentMethod.INTERNAL_TRANSFER ? newLine.destinationBranch : undefined,
      }; 
      
      if (editingLineId) {
          // Replace existing
          setPaymentLines(paymentLines.map(p => p.id === editingLineId ? detail : p));
          setEditingLineId(null);
      } else {
          setPaymentLines([...paymentLines, detail]); 
          // Auto Append description logic (For ALL methods)
          if(newLine.description) {
              setFormData(p => ({
                  ...p, 
                  description: p.description ? `${p.description} - ${newLine.description}` : newLine.description
              }));
          }
      }
      
      setNewLine({ 
          method: PaymentMethod.TRANSFER, 
          amount: '', 
          chequeNumber: '', 
          bankName: '', 
          description: '', 
          chequeDate: { year: currentShamsi.year, month: currentShamsi.month, day: currentShamsi.day } as any,
          sheba: '',
          recipientBank: '',
          paymentId: '',
          destinationAccount: '',
          destinationOwner: '',
          destinationBranch: ''
      }); 
  };

  const handleEditLine = (line: PaymentDetail) => {
      // Parse cheque date if exists
      let cDate = { year: currentShamsi.year, month: currentShamsi.month, day: currentShamsi.day };
      if (line.chequeDate) {
          const parts = line.chequeDate.split('/');
          if (parts.length === 3) {
              cDate = { year: parseInt(parts[0]), month: parseInt(parts[1]), day: parseInt(parts[2]) };
          }
      }

      setNewLine({
          method: line.method,
          amount: formatNumberString(line.amount),
          chequeNumber: line.chequeNumber || '',
          bankName: line.bankName || '',
          description: line.description || '',
          chequeDate: cDate as any,
          sheba: line.sheba || '',
          recipientBank: line.recipientBank || '',
          paymentId: line.paymentId || '',
          destinationAccount: line.destinationAccount || '',
          destinationOwner: line.destinationOwner || '',
          destinationBranch: line.destinationBranch || ''
      });
      setEditingLineId(line.id);
  };

  const removePaymentLine = (id: string) => { setPaymentLines(paymentLines.filter(p => p.id !== id)); if(editingLineId === id) setEditingLineId(null); };
  const sumPaymentLines = paymentLines.reduce((acc, curr) => acc + curr.amount, 0);
  const handleAnalyzePayment = async () => { setAnalyzing(true); try { const result = await apiCall<any>('/analyze-payment', 'POST', { amount: sumPaymentLines, date: getIsoDate(), company: payingCompany, description: formData.description || 'توضیحات وارد نشده' }); setAnalysisResult(result); } catch (e) { alert("خطا"); } finally { setAnalyzing(false); } };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (paymentLines.length === 0) { alert("لطفا حداقل یک روش پرداخت اضافه کنید."); return; }
    if (!trackingNumber) { alert("شماره دستور پرداخت الزامی است."); return; }
    
    setIsSubmitting(true);
    try { 
        const newOrder: PaymentOrder = { 
            id: generateUUID(), 
            trackingNumber: Number(trackingNumber), 
            date: getIsoDate(), 
            payee: formData.payee, 
            totalAmount: sumPaymentLines, 
            description: formData.description, 
            status: OrderStatus.PENDING, 
            requester: currentUser.fullName, 
            createdAt: Date.now(), 
            paymentDetails: paymentLines, 
            attachments: attachments, 
            payingCompany: payingCompany,
            paymentLocation: paymentLocation // Save Location
        };
        await saveOrder(newOrder); 
        
        // --- BACKGROUND PROCESSING (INSTANT UI RESPONSE) ---
        const event = new CustomEvent('QUEUE_WHATSAPP_JOB', { 
            detail: { order: newOrder, type: 'create' } 
        });
        window.dispatchEvent(event);

        onSuccess(); // Close form immediately

    } catch (error) { 
        alert("خطا در ثبت دستور پرداخت"); 
        setIsSubmitting(false);
    }
  };

  const years = Array.from({ length: 11 }, (_, i) => 1400 + i);
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in relative">
        {/* ADD BANK MODAL */}
        {showAddBankModal && (
            <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5 animate-scale-in">
                    <div className="flex justify-between items-center mb-4 border-b pb-2">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2"><Landmark size={18} className="text-blue-600"/> افزودن بانک جدید</h3>
                        <button onClick={() => setShowAddBankModal(false)} className="text-gray-400 hover:text-red-500"><X size={20}/></button>
                    </div>
                    <div className="space-y-3">
                        <div className="text-xs text-gray-500 mb-2">برای شرکت: <span className="font-bold text-gray-800">{payingCompany}</span></div>
                        <div>
                            <label className="text-sm font-bold block mb-1">نام بانک</label>
                            <input className="w-full border rounded-lg p-2 text-sm" placeholder="مثال: بانک ملت" value={newBankName} onChange={e => setNewBankName(e.target.value)} autoFocus />
                        </div>
                        <div>
                            <label className="text-sm font-bold block mb-1">شماره حساب / کارت</label>
                            <input className="w-full border rounded-lg p-2 text-sm dir-ltr text-left" placeholder="xxxx-xxxx-xxxx-xxxx" value={newBankAccount} onChange={e => setNewBankAccount(e.target.value)} />
                        </div>
                        <div className="flex gap-2 mt-4 pt-2 border-t">
                            <button onClick={() => setShowAddBankModal(false)} className="flex-1 py-2 rounded-lg border text-gray-600 hover:bg-gray-50 text-sm">انصراف</button>
                            <button onClick={handleSaveNewBank} className="flex-1 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm font-bold">ذخیره بانک</button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        <div className="p-6 border-b border-gray-100 flex items-center gap-3"><div className="bg-green-50 p-2 rounded-lg text-green-600"><Plus size={24} /></div><h2 className="text-xl font-bold text-gray-800">ثبت دستور پرداخت جدید</h2></div>
        <form onSubmit={handleSubmit} className="p-6 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2"><label className="text-sm font-medium text-gray-700 flex items-center gap-2"><Hash size={16}/> شماره دستور پرداخت</label><input required type="number" className="w-full border border-gray-300 rounded-xl px-4 py-3 bg-gray-50 font-mono font-bold text-blue-600 dir-ltr text-left" value={trackingNumber} onChange={e => setTrackingNumber(e.target.value)} onKeyDown={handleKeyDown} /></div>
                <div className="space-y-2"><label className="text-sm font-medium text-gray-700">گیرنده وجه (ذینفع)</label><input required type="text" className="w-full border border-gray-300 rounded-xl px-4 py-3" placeholder="نام شخص یا شرکت..." value={formData.payee} onChange={e => setFormData({ ...formData, payee: e.target.value })} onKeyDown={handleKeyDown} /></div>
                <div className="space-y-2"><label className="text-sm font-medium text-gray-700 flex items-center gap-2"><Building2 size={16}/> شرکت پرداخت کننده</label><select className="w-full border border-gray-300 rounded-xl px-4 py-3 bg-white" value={payingCompany} onChange={handleCompanyChange} onKeyDown={handleKeyDown}><option value="">-- انتخاب کنید --</option>{availableCompanies.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                <div className="space-y-2"><label className="text-sm font-medium text-gray-700 flex items-center gap-2"><Calendar size={16} />تاریخ پرداخت (شمسی)</label><div className="grid grid-cols-3 gap-2"><select className="border border-gray-300 rounded-xl px-2 py-3 bg-white" value={shamsiDate.day} onChange={e => setShamsiDate({...shamsiDate, day: Number(e.target.value)})}>{days.map(d => <option key={d} value={d}>{d}</option>)}</select><select className="border border-gray-300 rounded-xl px-2 py-3 bg-white" value={shamsiDate.month} onChange={e => setShamsiDate({...shamsiDate, month: Number(e.target.value)})}>{MONTHS.map((m, idx) => <option key={idx} value={idx + 1}>{m}</option>)}</select><select className="border border-gray-300 rounded-xl px-2 py-3 bg-white" value={shamsiDate.year} onChange={e => setShamsiDate({...shamsiDate, year: Number(e.target.value)})}>{years.map(y => <option key={y} value={y}>{y}</option>)}</select></div></div>
                {/* NEW: Payment Location Input */}
                <div className="space-y-2 md:col-span-2"><label className="text-sm font-medium text-gray-700 flex items-center gap-2"><MapPin size={16}/> محل صدور / پرداخت</label><input type="text" className="w-full border border-gray-300 rounded-xl px-4 py-3" placeholder="مثال: تهران" value={paymentLocation} onChange={e => setPaymentLocation(e.target.value)} onKeyDown={handleKeyDown} /></div>
            </div>
            
            <div className="space-y-2"><div className="flex justify-between items-center"><label className="text-sm font-bold text-gray-700">شرح پرداخت</label><button type="button" onClick={handleEnhance} disabled={isEnhancing || !formData.description} className="text-xs flex items-center gap-1.5 text-purple-600 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">{isEnhancing ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}بهبود متن با هوش مصنوعی</button></div><textarea required rows={4} className="w-full border border-gray-300 rounded-xl px-4 py-3 resize-none" placeholder="توضیحات کامل دستور پرداخت..." value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} onKeyDown={handleKeyDown} /></div>

            <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 relative overflow-hidden">
                <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                    <h3 className="font-bold text-gray-700">روش‌های پرداخت</h3>
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={handleAnalyzePayment} disabled={analyzing || sumPaymentLines === 0} className="flex items-center gap-1.5 text-xs bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-200 transition-colors disabled:opacity-50">
                            {analyzing ? <Loader2 size={14} className="animate-spin"/> : <BrainCircuit size={14}/>} تحلیل هوشمند
                        </button>
                        <div className="text-sm text-gray-500 bg-white px-3 py-1 rounded-lg border">جمع کل: <span className="font-bold text-blue-600 font-mono">{formatCurrency(sumPaymentLines)}</span></div>
                    </div>
                </div>

                {/* Analysis Result Display */}
                {analysisResult && (
                    <div className={`mb-4 p-3 rounded-xl border flex items-start gap-3 animate-fade-in ${analysisResult.score >= 80 ? 'bg-green-50 border-green-200 text-green-800' : analysisResult.score >= 50 ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                        {analysisResult.score >= 50 ? <BrainCircuit className="shrink-0 mt-0.5" size={20}/> : <AlertTriangle className="shrink-0 mt-0.5" size={20}/>}
                        <div className="flex-1">
                            <div className="font-bold text-sm flex items-center gap-2 flex-wrap">پیشنهاد هوشمند: {analysisResult.recommendation} <span className="text-[10px] px-2 py-0.5 bg-white/50 rounded-full border border-black/5">امتیاز: {analysisResult.score}/100</span></div>
                            <ul className="list-disc list-inside mt-1 text-xs opacity-90 space-y-0.5">{analysisResult.reasons.map((r: string, i: number) => <li key={i}>{r}</li>)}</ul>
                        </div>
                        <button type="button" onClick={() => setAnalysisResult(null)} className="mr-auto opacity-50 hover:opacity-100 p-1"><X size={16}/></button>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end mb-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                    <div className="md:col-span-2 space-y-1">
                        <label className="text-xs text-gray-500">نوع</label>
                        <select className="w-full border rounded-lg p-2 text-sm bg-white" value={newLine.method} onChange={e => setNewLine({ ...newLine, method: e.target.value as PaymentMethod })}>
                            <option value={PaymentMethod.TRANSFER}>{PaymentMethod.TRANSFER}</option>
                            <option value={PaymentMethod.CHEQUE}>{PaymentMethod.CHEQUE}</option>
                            <option value={PaymentMethod.SHEBA}>{PaymentMethod.SHEBA}</option> {/* MERGED */}
                            <option value={PaymentMethod.INTERNAL_TRANSFER}>{PaymentMethod.INTERNAL_TRANSFER}</option>
                            <option value={PaymentMethod.CASH}>{PaymentMethod.CASH}</option>
                            <option value={PaymentMethod.POS}>{PaymentMethod.POS}</option>
                        </select>
                    </div>
                    <div className="md:col-span-3 space-y-1"><label className="text-xs text-gray-500">مبلغ (ریال)</label><input type="text" inputMode="numeric" className="w-full border rounded-lg p-2 text-sm dir-ltr text-left font-mono font-bold" placeholder="0" value={formatNumberString(newLine.amount)} onChange={e => setNewLine({ ...newLine, amount: normalizeInputNumber(e.target.value).replace(/[^0-9]/g, '') })} onKeyDown={handleKeyDown}/></div>
                    
                    {/* Dynamic Fields based on Type */}
                    {(newLine.method === PaymentMethod.CHEQUE || newLine.method === PaymentMethod.TRANSFER || newLine.method === PaymentMethod.SHEBA || newLine.method === PaymentMethod.SATNA || newLine.method === PaymentMethod.INTERNAL_TRANSFER) ? (
                        <>
                            {newLine.method === PaymentMethod.CHEQUE && <div className="md:col-span-2 space-y-1"><label className="text-xs text-gray-500">شماره چک</label><input type="text" inputMode="numeric" className="w-full border rounded-lg p-2 text-sm font-mono" value={newLine.chequeNumber} onChange={e => setNewLine({ ...newLine, chequeNumber: normalizeInputNumber(e.target.value).replace(/[^0-9]/g, '') })} onKeyDown={handleKeyDown}/></div>}
                            
                            <div className="md:col-span-2 space-y-1">
                                <label className="text-xs text-gray-500">نام بانک مبدا</label>
                                <div className="flex gap-1"><select className="w-full border rounded-lg p-2 text-sm bg-white" value={newLine.bankName} onChange={e => setNewLine({ ...newLine, bankName: e.target.value })}><option value="">-- انتخاب --</option>{availableBanks.map(b => <option key={b} value={b}>{b}</option>)}</select><button type="button" onClick={openAddBankModal} className="bg-blue-100 text-blue-600 rounded-lg px-2 hover:bg-blue-200 border border-blue-200" title="افزودن بانک جدید"><Plus size={16}/></button></div>
                            </div>
                        </>
                    ) : <div className="md:col-span-4 hidden md:block"></div>}

                    {/* SHEBA Specific Fields (Satna/Paya) */}
                    {(newLine.method === PaymentMethod.SHEBA || newLine.method === PaymentMethod.SATNA || newLine.method === PaymentMethod.PAYA) && (
                        <div className="md:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-3 bg-purple-50 p-2 rounded-lg border border-purple-200 mt-1">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-purple-800">شماره شبا (۲۴ رقم)</label>
                                <div className="flex items-center gap-1 dir-ltr">
                                    <span className="font-bold text-gray-500 text-xs">IR -</span>
                                    <input className="w-full border rounded-lg p-2 text-sm font-mono tracking-widest text-center" maxLength={24} value={newLine.sheba} onChange={e => setNewLine({...newLine, sheba: normalizeInputNumber(e.target.value).replace(/[^0-9]/g, '')})} placeholder="........................" />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-purple-800">نام بانک گیرنده</label>
                                <input className="w-full border rounded-lg p-2 text-sm" value={newLine.recipientBank} onChange={e => setNewLine({...newLine, recipientBank: e.target.value})} placeholder="مثال: بانک ملی" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-purple-800">شناسه پرداخت (اختیاری)</label>
                                <input className="w-full border rounded-lg p-2 text-sm font-mono text-center" value={newLine.paymentId} onChange={e => setNewLine({...newLine, paymentId: normalizeInputNumber(e.target.value)})} />
                            </div>
                        </div>
                    )}

                    {/* INTERNAL TRANSFER Fields - UPDATED */}
                    {newLine.method === PaymentMethod.INTERNAL_TRANSFER && (
                        <div className="md:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-3 bg-indigo-50 p-2 rounded-lg border border-indigo-200 mt-1">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-indigo-800 flex items-center gap-1"><ArrowRightLeft size={14}/> شماره حساب مقصد</label>
                                <input className="w-full border rounded-lg p-2 text-sm font-mono text-center dir-ltr" value={newLine.destinationAccount} onChange={e => setNewLine({...newLine, destinationAccount: normalizeInputNumber(e.target.value)})} placeholder="شماره کارت یا حساب مقصد" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-indigo-800">نام صاحب حساب مقصد</label>
                                <input className="w-full border rounded-lg p-2 text-sm" value={newLine.destinationOwner} onChange={e => setNewLine({...newLine, destinationOwner: e.target.value})} placeholder="نام صاحب حساب..." />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-indigo-800">شعبه مقصد (اختیاری)</label>
                                <input className="w-full border rounded-lg p-2 text-sm" value={newLine.destinationBranch} onChange={e => setNewLine({...newLine, destinationBranch: e.target.value})} placeholder="نام یا کد شعبه..." />
                            </div>
                        </div>
                    )}

                    <div className="md:col-span-2 space-y-1"><label className="text-xs text-gray-500">{newLine.method === PaymentMethod.SATNA ? 'بابت (شرح)' : 'شرح (اختیاری)'}</label><input type="text" className="w-full border rounded-lg p-2 text-sm" placeholder="..." value={newLine.description} onChange={e => setNewLine({ ...newLine, description: e.target.value })} onKeyDown={handleKeyDown}/></div>
                    
                    {newLine.method === PaymentMethod.CHEQUE && (<div className="md:col-span-12 bg-yellow-50 p-2 rounded-lg border border-yellow-200 mt-1 flex items-center gap-4"><label className="text-xs font-bold text-gray-700 flex items-center gap-1 min-w-fit"><Calendar size={14}/> تاریخ سررسید چک:</label><div className="flex gap-2 flex-1"><select className="border rounded px-2 py-1 text-sm bg-white flex-1" value={newLine.chequeDate.d} onChange={e => setNewLine({...newLine, chequeDate: {...newLine.chequeDate, d: Number(e.target.value)}})}>{days.map(d => <option key={d} value={d}>{d}</option>)}</select><select className="border rounded px-2 py-1 text-sm bg-white flex-1" value={newLine.chequeDate.m} onChange={e => setNewLine({...newLine, chequeDate: {...newLine.chequeDate, m: Number(e.target.value)}})}>{MONTHS.map((m, idx) => <option key={idx} value={idx + 1}>{m}</option>)}</select><select className="border rounded px-2 py-1 text-sm bg-white flex-1" value={newLine.chequeDate.y} onChange={e => setNewLine({...newLine, chequeDate: {...newLine.chequeDate, y: Number(e.target.value)}})}>{years.map(y => <option key={y} value={y}>{y}</option>)}</select></div></div>)}
                    <div className="md:col-span-1">
                        <button type="button" onClick={addPaymentLine} disabled={!newLine.amount} className={`w-full text-white p-2 rounded-lg transition-colors shadow-lg disabled:opacity-50 flex items-center justify-center ${editingLineId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'}`}>
                            {editingLineId ? <Save size={20} /> : <Plus size={20} />}
                        </button>
                    </div>
                </div>
                
                <div className="space-y-2">
                    {paymentLines.map((line) => (
                        <div key={line.id} className="flex items-center justify-between bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:border-blue-200 transition-colors">
                            <div className="flex gap-4 text-sm items-center flex-wrap">
                                <span className="font-bold text-gray-800 bg-gray-100 px-2 py-1 rounded">{line.method}</span>
                                <span className="text-blue-600 font-bold font-mono text-lg">{formatCurrency(line.amount)}</span>
                                {line.chequeNumber && <span className="text-gray-600 text-xs bg-yellow-50 px-2 py-1 rounded border border-yellow-100">شماره چک: {line.chequeNumber} {line.chequeDate && `(${line.chequeDate})`}</span>}
                                {line.bankName && <span className="text-gray-600 text-xs bg-blue-50 px-2 py-1 rounded border border-blue-100">{line.bankName}</span>}
                                {(line.method === PaymentMethod.SHEBA || line.method === PaymentMethod.SATNA || line.method === PaymentMethod.PAYA) && <span className="text-purple-700 text-xs bg-purple-50 px-2 py-1 rounded border border-purple-100 font-mono">شبا: IR-{line.sheba}</span>}
                                {line.method === PaymentMethod.INTERNAL_TRANSFER && (
                                    <span className="text-indigo-700 text-xs bg-indigo-50 px-2 py-1 rounded border border-indigo-100 font-mono">
                                        به: {line.destinationOwner} ({line.destinationAccount}) {line.destinationBranch ? `- ${line.destinationBranch}` : ''}
                                    </span>
                                )}
                                {line.description && <span className="text-gray-500 text-xs italic">{line.description}</span>}
                            </div>
                            <div className="flex gap-1">
                                <button type="button" onClick={() => handleEditLine(line)} className="text-amber-500 hover:text-amber-700 hover:bg-amber-50 p-2 rounded-lg transition-colors"><Edit size={18} /></button>
                                <button type="button" onClick={() => removePaymentLine(line.id)} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors"><Trash2 size={18} /></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200">
                <label className="text-sm font-bold text-gray-700 mb-3 block flex items-center gap-2"><Paperclip size={18} />ضمیمه‌ها</label>
                <div className="flex items-center gap-4">
                    <input type="file" id="attachment" className="hidden" accept="image/*,application/pdf" onChange={handleFileChange} disabled={uploading}/>
                    <label htmlFor="attachment" className={`bg-white border-2 border-dashed border-gray-300 text-gray-600 px-6 py-3 rounded-xl cursor-pointer hover:border-blue-500 hover:text-blue-500 hover:bg-blue-50 transition-all flex items-center gap-2 text-sm font-medium ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        {uploading ? <Loader2 size={18} className="animate-spin"/> : <UploadCloud size={18}/>} {uploading ? 'در حال آپلود...' : 'انتخاب فایل'}
                    </label>
                </div>
                {attachments.length > 0 && <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">{attachments.map((file, idx) => (<div key={idx} className="flex items-center justify-between bg-white p-3 rounded-xl border border-gray-200 text-sm shadow-sm group"><a href={file.data} target="_blank" className="text-blue-600 truncate hover:underline flex items-center gap-2"><Paperclip size={14}/> {file.fileName}</a><button type="button" onClick={() => removeAttachment(idx)} className="text-gray-400 hover:text-red-500 p-1"><X size={16} /></button></div>))}</div>}
            </div>
            
            <div className="pt-4"><button type="submit" disabled={isSubmitting || uploading} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 transition-all transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-70 disabled:hover:scale-100">{isSubmitting ? <Loader2 size={24} className="animate-spin" /> : <Save size={24} />}ثبت نهایی دستور پرداخت</button></div>
        </form>
    </div>
  );
};
export default CreateOrder;
