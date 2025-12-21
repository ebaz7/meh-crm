
import React, { useState } from 'react';
import { User, SystemSettings } from '../types';
import { Printer, Send, FileText, Loader2, Phone, User as UserIcon, Paperclip, CheckCircle } from 'lucide-react';
import { apiCall } from '../services/apiService';
import { formatDate } from '../constants';
import { generatePdf } from '../utils/pdfGenerator'; // Import Utility

interface Props {
    currentUser: User;
    settings?: SystemSettings;
}

const FaxModule: React.FC<Props> = ({ currentUser, settings }) => {
    const [recipientName, setRecipientName] = useState('');
    const [faxNumber, setFaxNumber] = useState('');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [sending, setSending] = useState(false);
    const [success, setSuccess] = useState(false);

    // Simulate the company letterhead
    const companyName = settings?.defaultCompany || 'نام شرکت شما';
    const logo = settings?.pwaIcon;

    const handleSend = async () => {
        if (!recipientName || !faxNumber || !body) {
            alert('لطفا نام گیرنده، شماره فکس و متن نامه را وارد کنید.');
            return;
        }

        if (!settings?.telegramAdminId) {
            alert('خطا: شناسه تلگرام مدیر در تنظیمات وارد نشده است. امکان ارسال وجود ندارد.');
            return;
        }

        setSending(true);

        try {
            // Generate the Fax PDF using hidden HTML element with the NEW Generator logic
            // Since the old logic relied on returning base64 directly from frontend, 
            // and our new generator saves file, we might need a slight adjustment or stick to direct logic for Fax if backend expects Base64.
            // HOWEVER, the user asked to unify.
            // BUT: The apiCall below expects `pdfBase64`. The `generatePdf` function downloads the file.
            // To support both, we'll manually use html2canvas here to get base64 string, as this is a specific data-transmission case, not a download case.
            // OR we adapt the new utility to support returning dataURL? No, keep it simple for now.
            // Let's stick to the manual generation JUST for this specific backend transmission case, but ensure the styling matches the unified approach.
            
            const element = document.getElementById('fax-template');
            if (!element) throw new Error("Template not found");

            // Use same settings as our utility for consistency
            // @ts-ignore
            const canvas = await window.html2canvas(element, { 
                scale: 2, 
                backgroundColor: '#ffffff',
                useCORS: true,
                windowWidth: 1200 // Consistent with our utility
            });
            
            // @ts-ignore
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
            const imgData = canvas.toDataURL('image/png');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            
            // Get PDF as base64 string
            const pdfBase64 = pdf.output('datauristring').split(',')[1];

            // Send to backend
            await apiCall('/send-fax-request', 'POST', {
                recipientName,
                faxNumber,
                subject,
                body,
                sender: currentUser.fullName,
                pdfBase64
            });

            setSuccess(true);
            setRecipientName('');
            setFaxNumber('');
            setSubject('');
            setBody('');
            setTimeout(() => setSuccess(false), 5000);

        } catch (error: any) {
            console.error(error);
            alert('خطا در ارسال فکس: ' + error.message);
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-100px)] gap-6 p-6 animate-fade-in relative">
            
            {/* Input Form */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 max-w-4xl mx-auto w-full z-10">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b">
                    <div className="bg-indigo-50 p-2 rounded-lg text-indigo-600"><Printer size={24}/></div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">ارسال فکس آنلاین (بدون هزینه)</h2>
                        <p className="text-xs text-gray-500">تولید خودکار نامه و ارسال به کارتابل تلگرام مدیریت جهت فکس فیزیکی/دیجیتال</p>
                    </div>
                </div>

                {success && (
                    <div className="mb-6 bg-green-50 border border-green-200 text-green-700 p-4 rounded-xl flex items-center gap-3">
                        <CheckCircle size={24}/>
                        <div>
                            <span className="font-bold block">درخواست فکس با موفقیت ارسال شد!</span>
                            <span className="text-xs">سند PDF تولید شده به تلگرام مدیریت ارسال گردید.</span>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700 flex items-center gap-2"><UserIcon size={16}/> نام گیرنده</label>
                        <input className="w-full border rounded-xl p-3 bg-gray-50 focus:bg-white transition-colors" placeholder="مثال: جناب آقای..." value={recipientName} onChange={e => setRecipientName(e.target.value)}/>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700 flex items-center gap-2"><Phone size={16}/> شماره فکس</label>
                        <input className="w-full border rounded-xl p-3 bg-gray-50 focus:bg-white transition-colors dir-ltr text-left" placeholder="021-..." value={faxNumber} onChange={e => setFaxNumber(e.target.value)}/>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                        <label className="text-sm font-bold text-gray-700 flex items-center gap-2"><FileText size={16}/> موضوع نامه</label>
                        <input className="w-full border rounded-xl p-3 bg-gray-50 focus:bg-white transition-colors" placeholder="موضوع..." value={subject} onChange={e => setSubject(e.target.value)}/>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                        <label className="text-sm font-bold text-gray-700">متن نامه</label>
                        <textarea className="w-full border rounded-xl p-3 bg-gray-50 focus:bg-white transition-colors h-48 resize-none" placeholder="متن درخواست خود را اینجا بنویسید..." value={body} onChange={e => setBody(e.target.value)}/>
                    </div>
                </div>

                <div className="mt-6 flex justify-end">
                    <button onClick={handleSend} disabled={sending} className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all flex items-center gap-2 disabled:opacity-70">
                        {sending ? <Loader2 size={20} className="animate-spin"/> : <Send size={20}/>}
                        {sending ? 'در حال پردازش...' : 'تولید و ارسال به تلگرام'}
                    </button>
                </div>
            </div>

            {/* Hidden Fax Template for PDF Generation */}
            <div className="absolute top-0 left-0 -z-50 opacity-0 pointer-events-none">
                <div id="fax-template" className="bg-white w-[210mm] min-h-[297mm] p-[20mm] text-black font-serif flex flex-col relative">
                    {/* Header */}
                    <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-8">
                        <div className="flex items-center gap-4">
                            {logo && <img src={logo} className="w-20 h-20 object-contain grayscale" alt="Logo"/>}
                            <div>
                                <h1 className="text-3xl font-black mb-1">{companyName}</h1>
                                <p className="text-sm text-gray-600">سیستم مکاتبات اداری</p>
                            </div>
                        </div>
                        <div className="text-left text-sm space-y-1">
                            <div><span className="font-bold">تاریخ:</span> {formatDate(new Date().toISOString())}</div>
                            <div><span className="font-bold">پیوست:</span> ندارد</div>
                            <div className="mt-2 border-2 border-black px-2 py-1 font-bold rounded">ارسال از طریق فکس</div>
                        </div>
                    </div>

                    {/* Meta Data Box */}
                    <div className="border border-black p-4 mb-8 grid grid-cols-2 gap-4 text-sm bg-gray-100">
                        <div><span className="font-bold">گیرنده:</span> {recipientName}</div>
                        <div><span className="font-bold">شماره فکس:</span> {faxNumber}</div>
                        <div className="col-span-2"><span className="font-bold">موضوع:</span> {subject}</div>
                        <div className="col-span-2"><span className="font-bold">فرستنده:</span> {currentUser.fullName} ({currentUser.role})</div>
                    </div>

                    {/* Body */}
                    <div className="flex-1 text-justify leading-loose text-base whitespace-pre-wrap font-medium">
                        {body}
                    </div>

                    {/* Footer */}
                    <div className="mt-auto pt-8 border-t-2 border-black flex justify-between items-end">
                        <div className="text-center">
                            <div className="mb-4 font-bold">امضاء فرستنده</div>
                            <div className="h-16 w-32 border-b border-dotted border-black"></div>
                        </div>
                        <div className="text-xs text-gray-500 text-left">
                            این سند به صورت سیستمی تولید شده است.<br/>
                            زمان تولید: {new Date().toLocaleString('fa-IR')}
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
};

export default FaxModule;
