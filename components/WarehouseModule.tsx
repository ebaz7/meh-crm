
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, SystemSettings, WarehouseItem, WarehouseTransaction, WarehouseTransactionItem, UserRole } from '../types';
import { getWarehouseItems, saveWarehouseItem, deleteWarehouseItem, getWarehouseTransactions, saveWarehouseTransaction, deleteWarehouseTransaction, updateWarehouseTransaction, getNextBijakNumber, updateWarehouseItem } from '../services/storageService';
import { generateUUID, getCurrentShamsiDate, jalaliToGregorian, formatNumberString, deformatNumberString, formatDate, parsePersianDate, getShamsiDateFromIso } from '../constants';
import { Package, Plus, Trash2, ArrowDownCircle, ArrowUpCircle, FileText, BarChart3, Eye, Loader2, AlertTriangle, Settings, ArrowLeftRight, Search, FileClock, Printer, FileDown, Share2, LayoutGrid, Archive, Edit, Save, X, Container, CheckCircle } from 'lucide-react';
import PrintBijak from './PrintBijak';
import PrintStockReport from './print/PrintStockReport'; 
import WarehouseKardexReport from './reports/WarehouseKardexReport'; // NEW IMPORT
import { apiCall } from '../services/apiService';
import { getUsers } from '../services/authService';

interface Props { 
    currentUser: User; 
    settings?: SystemSettings; 
    initialTab?: 'dashboard' | 'items' | 'entry' | 'exit' | 'reports' | 'stock_report' | 'archive' | 'entry_archive' | 'approvals';
}

const WarehouseModule: React.FC<Props> = ({ currentUser, settings, initialTab = 'dashboard' }) => {
    const [loadingData, setLoadingData] = useState(true);
    const [activeTab, setActiveTab] = useState(initialTab);
    const [items, setItems] = useState<WarehouseItem[]>([]);
    const [transactions, setTransactions] = useState<WarehouseTransaction[]>([]);
    
    // New Item State
    const [newItemName, setNewItemName] = useState('');
    const [newItemCode, setNewItemCode] = useState('');
    const [newItemUnit, setNewItemUnit] = useState('عدد');
    const [newItemContainerCapacity, setNewItemContainerCapacity] = useState('');

    // Editing Item State
    const [editingItem, setEditingItem] = useState<WarehouseItem | null>(null);

    // Transaction State
    const currentShamsi = getCurrentShamsiDate();
    const [txDate, setTxDate] = useState({ year: currentShamsi.year, month: currentShamsi.month, day: currentShamsi.day });
    const [selectedCompany, setSelectedCompany] = useState('');
    const [txItems, setTxItems] = useState<Partial<WarehouseTransactionItem>[]>([{ itemId: '', quantity: 0, weight: 0, unitPrice: 0 }]);
    const [proformaNumber, setProformaNumber] = useState('');
    const [recipientName, setRecipientName] = useState('');
    const [driverName, setDriverName] = useState('');
    const [plateNumber, setPlateNumber] = useState('');
    const [destination, setDestination] = useState('');
    const [nextBijakNum, setNextBijakNum] = useState<number>(0);
    
    // View/Edit State
    const [viewBijak, setViewBijak] = useState<WarehouseTransaction | null>(null);
    const [editingBijak, setEditingBijak] = useState<WarehouseTransaction | null>(null); 
    const [editingReceipt, setEditingReceipt] = useState<WarehouseTransaction | null>(null); 
    
    // Reports State
    const [archiveFilterCompany, setArchiveFilterCompany] = useState('');
    const [reportSearch, setReportSearch] = useState('');
    const [processingExport, setProcessingExport] = useState(false);
    
    // Print Report State
    const [showPrintStockReport, setShowPrintStockReport] = useState(false); 

    // Auto Send on Approval/Edit
    const [approvedTxForAutoSend, setApprovedTxForAutoSend] = useState<WarehouseTransaction | null>(null);
    const [editedBijakForAutoSend, setEditedBijakForAutoSend] = useState<WarehouseTransaction | null>(null);

    useEffect(() => { loadData(); }, []);
    useEffect(() => { setActiveTab(initialTab); }, [initialTab]);
    useEffect(() => { if(selectedCompany && activeTab === 'exit' && settings) { updateNextBijak(); } }, [selectedCompany, activeTab, settings]);

    const loadData = async () => { setLoadingData(true); try { const [i, t] = await Promise.all([getWarehouseItems(), getWarehouseTransactions()]); setItems(i || []); setTransactions(t || []); } catch (e) { console.error(e); } finally { setLoadingData(false); } };
    const updateNextBijak = async () => { if(selectedCompany) { const num = await getNextBijakNumber(selectedCompany); setNextBijakNum(num); } };
    const getIsoDate = () => { try { const date = jalaliToGregorian(txDate.year, txDate.month, txDate.day); return date.toISOString(); } catch { return new Date().toISOString(); } };
    
    // --- ITEM MANAGEMENT ---
    const handleAddItem = async () => { 
        if(!newItemName) return; 
        await saveWarehouseItem({ 
            id: generateUUID(), 
            name: newItemName, 
            code: newItemCode, 
            unit: newItemUnit, 
            containerCapacity: Number(newItemContainerCapacity) || 0 
        }); 
        setNewItemName(''); 
        setNewItemCode(''); 
        setNewItemContainerCapacity('');
        loadData(); 
    };
    
    const handleEditItem = async () => {
        if (!editingItem) return;
        await updateWarehouseItem(editingItem);
        setEditingItem(null);
        loadData();
    };

    const handleDeleteItem = async (id: string) => { if(confirm('حذف شود؟')) { await deleteWarehouseItem(id); loadData(); } };
    
    const handleAddTxItemRow = () => setTxItems([...txItems, { itemId: '', quantity: 0, weight: 0, unitPrice: 0 }]);
    const handleRemoveTxItemRow = (idx: number) => setTxItems(txItems.filter((_, i) => i !== idx));
    const updateTxItem = (idx: number, field: keyof WarehouseTransactionItem, val: any) => { const newItems = [...txItems]; newItems[idx] = { ...newItems[idx], [field]: val }; if(field === 'itemId') { const item = items.find(i => i.id === val); if(item) newItems[idx].itemName = item.name; } setTxItems(newItems); };

    const handleSubmitTx = async (type: 'IN' | 'OUT') => {
        if(!selectedCompany) { alert('شرکت را انتخاب کنید'); return; }
        if(txItems.some(i => !i.itemId || !i.quantity)) { alert('اقلام را کامل کنید'); return; }

        const validItems = txItems.map(i => ({ itemId: i.itemId!, itemName: i.itemName!, quantity: Number(i.quantity), weight: Number(i.weight), unitPrice: Number(i.unitPrice)||0 }));
        const tx: WarehouseTransaction = { 
            id: generateUUID(), 
            type, 
            date: getIsoDate(), 
            company: selectedCompany, 
            number: type === 'IN' ? 0 : nextBijakNum, 
            items: validItems, 
            createdAt: Date.now(), 
            createdBy: currentUser.fullName, 
            proformaNumber: type === 'IN' ? proformaNumber : undefined, 
            recipientName: type === 'OUT' ? recipientName : undefined, 
            driverName: type === 'OUT' ? driverName : undefined, 
            plateNumber: type === 'OUT' ? plateNumber : undefined, 
            destination: type === 'OUT' ? destination : undefined,
            status: type === 'OUT' ? 'PENDING' : undefined // Default status for OUT is PENDING
        };

        await saveWarehouseTransaction(tx);
        await loadData();
        
        if(type === 'OUT') {
            alert('بیجک ثبت شد و جهت تایید به مدیریت ارسال گردید.');
            setRecipientName(''); setDriverName(''); setPlateNumber(''); setDestination('');
        } else {
            setProformaNumber(''); alert('ورود کالا ثبت شد.');
        }
        setTxItems([{ itemId: '', quantity: 0, weight: 0, unitPrice: 0 }]);
    };

    const handleApproveBijak = async (tx: WarehouseTransaction) => {
        if (!confirm('آیا تایید می‌کنید؟ پس از تایید، بیجک به صورت خودکار برای انبار و مدیریت ارسال می‌شود.')) return;
        
        try {
            // Check if this is a Correction (Edited) by comparing updatedAt and createdAt
            const isCorrection = tx.updatedAt && tx.updatedAt > (tx.createdAt + 60000); // 1 minute buffer
            const titleSuffix = isCorrection ? ' (اصلاحیه)' : '';

            // 1. Update Status
            const updatedTx = { ...tx, status: 'APPROVED' as const, approvedBy: currentUser.fullName };
            await updateWarehouseTransaction(updatedTx);
            
            // 2. Trigger Auto-Send
            setApprovedTxForAutoSend(updatedTx);
            
            setTimeout(async () => {
                const managerElement = document.getElementById(`print-bijak-${updatedTx.id}-price`);
                const warehouseElement = document.getElementById(`print-bijak-${updatedTx.id}-noprice`);
                
                // Construct Common Details
                let commonDetails = `🔢 شماره: ${updatedTx.number}\n`;
                commonDetails += `📅 تاریخ: ${formatDate(updatedTx.date)}\n`;
                commonDetails += `👤 گیرنده: ${updatedTx.recipientName}\n`;
                commonDetails += `✅ تایید شده توسط: ${currentUser.fullName}\n`;
                commonDetails += `------------------\n`;
                commonDetails += `📋 *لیست اقلام:* \n`;
                updatedTx.items.forEach((item, idx) => { commonDetails += `${idx + 1}️⃣ ${item.itemName} | تعداد: ${item.quantity}\n`; });
                
                if (settings && settings.companyNotifications) {
                    const companyConfig = settings.companyNotifications[updatedTx.company];
                    const managerNumber = companyConfig?.salesManager;
                    const groupNumber = companyConfig?.warehouseGroup;

                    try {
                        // 1. Send to SALES MANAGER (With Price)
                        if (managerNumber && managerElement) {
                            // @ts-ignore
                            const canvas = await window.html2canvas(managerElement, { scale: 2, backgroundColor: '#ffffff' });
                            const base64 = canvas.toDataURL('image/png').split(',')[1];
                            const managerCaption = `🏭 *شرکت: ${updatedTx.company}*\n📑 *حواله خروج - تایید شده${titleSuffix}*\n${commonDetails}`;
                            
                            await apiCall('/send-whatsapp', 'POST', { 
                                number: managerNumber, 
                                message: managerCaption, 
                                mediaData: { data: base64, mimeType: 'image/png', filename: `Bijak_${updatedTx.number}_Price.png` } 
                            });
                        }

                        // 2. Send to WAREHOUSE GROUP (No Price)
                        if (groupNumber && warehouseElement) {
                            // @ts-ignore
                            const canvas = await window.html2canvas(warehouseElement, { scale: 2, backgroundColor: '#ffffff' });
                            const base64 = canvas.toDataURL('image/png').split(',')[1];
                            const warehouseCaption = `🏭 *شرکت: ${updatedTx.company}*\n📦 *حواله خروج - نسخه انبار${titleSuffix}*\n${commonDetails}`;

                            await apiCall('/send-whatsapp', 'POST', { 
                                number: groupNumber, 
                                message: warehouseCaption, 
                                mediaData: { data: base64, mimeType: 'image/png', filename: `Bijak_${updatedTx.number}.png` } 
                            });
                        }
                    } catch(e) { console.error("Auto send error", e); }
                }
                
                setApprovedTxForAutoSend(null);
                loadData();
                alert("تایید و ارسال شد.");
            }, 1500);

        } catch (e) { alert("خطا در عملیات تایید"); }
    };

    const handleDeleteTx = async (id: string) => { if(confirm('حذف تراکنش؟')) { await deleteWarehouseTransaction(id); loadData(); } };
    
    // ... (Edit handlers same) ...
    const handleEditBijakSave = async (updatedTx: WarehouseTransaction) => {
        try { 
            // Reset status to PENDING on edit to re-trigger approval workflow
            updatedTx.status = 'PENDING';
            updatedTx.updatedAt = Date.now();
            
            await updateWarehouseTransaction(updatedTx); 
            setEditingBijak(null); 
            
            // Auto Send Notification to CEO for re-approval
            setEditedBijakForAutoSend(updatedTx);

            setTimeout(async () => {
                 const element = document.getElementById(`print-bijak-edit-${updatedTx.id}`);
                 if (element) {
                     try {
                         const users = await getUsers();
                         const ceo = users.find(u => u.role === UserRole.CEO && u.phoneNumber);
                         if (ceo) {
                             // @ts-ignore
                            const canvas = await window.html2canvas(element, { scale: 2, backgroundColor: '#ffffff' });
                            const base64 = canvas.toDataURL('image/png').split(',')[1];
                            
                            let caption = `📝 *اصلاحیه بیجک (جهت تایید مجدد)*\n`;
                            caption += `شماره: ${updatedTx.number}\n`;
                            caption += `گیرنده: ${updatedTx.recipientName}\n`;
                            caption += `ویرایش توسط: ${currentUser.fullName}\n\n`;
                            caption += `لطفا بررسی نمایید.`;

                            await apiCall('/send-whatsapp', 'POST', { 
                                number: ceo.phoneNumber, 
                                message: caption, 
                                mediaData: { data: base64, mimeType: 'image/png', filename: `Bijak_Edit_${updatedTx.number}.png` } 
                            });
                         }
                     } catch(e) { console.error(e); }
                 }
                 setEditedBijakForAutoSend(null);
                 loadData(); 
                 alert('بیجک ویرایش و جهت تایید مجدد به مدیریت ارسال شد.'); 
            }, 1500);

        } catch (e) { console.error(e); alert('خطا در ویرایش بیجک.'); }
    };

    const handleEditReceiptSave = async (updatedTx: WarehouseTransaction) => {
        try { await updateWarehouseTransaction(updatedTx); setEditingReceipt(null); loadData(); alert('رسید با موفقیت ویرایش شد.'); } catch (e) { console.error(e); alert('خطا در ویرایش رسید.'); }
    };

    // ... (Stock Report Logic same) ...
    const allWarehousesStock = useMemo(() => {
        const companies = settings?.companies?.filter(c => c.showInWarehouse !== false).map(c => c.name) || [];
        const result = companies.map(company => {
            const companyItems = items.map(catalogItem => {
                let quantity = 0; let weight = 0;
                transactions.filter(tx => tx.company === company && tx.status !== 'REJECTED').forEach(tx => {
                    tx.items.forEach(txItem => {
                        if (txItem.itemId === catalogItem.id) {
                            if (tx.type === 'IN') { quantity += txItem.quantity; weight += txItem.weight; } 
                            else { quantity -= txItem.quantity; weight -= txItem.weight; }
                        }
                    });
                });
                const containerCapacity = catalogItem.containerCapacity || 0;
                const containerCount = (containerCapacity > 0 && quantity > 0) ? (quantity / containerCapacity) : 0;
                return { id: catalogItem.id, name: catalogItem.name, quantity, weight, containerCount };
            });
            return { company, items: companyItems };
        });
        return result;
    }, [transactions, items, settings]);

    const recentBijaks = useMemo(() => transactions.filter(t => t.type === 'OUT').slice(0, 5), [transactions]);
    const filteredArchiveBijaks = useMemo(() => transactions.filter(t => t.type === 'OUT' && (!archiveFilterCompany || t.company === archiveFilterCompany) && (String(t.number).includes(reportSearch) || t.recipientName?.includes(reportSearch))), [transactions, archiveFilterCompany, reportSearch]);
    const filteredArchiveReceipts = useMemo(() => transactions.filter(t => t.type === 'IN' && (!archiveFilterCompany || t.company === archiveFilterCompany) && (String(t.proformaNumber).includes(reportSearch))), [transactions, archiveFilterCompany, reportSearch]);
    
    // Approval Filter
    const pendingBijaks = useMemo(() => transactions.filter(t => t.type === 'OUT' && t.status === 'PENDING'), [transactions]);

    // ... (Export handlers same) ...
    const handlePrintStock = () => { setShowPrintStockReport(true); };
    const handleDownloadStockPDF = async () => { /* ... */ };

    if (!settings || loadingData) return <div className="flex flex-col items-center justify-center h-[50vh] text-gray-500 gap-2"><Loader2 className="animate-spin text-blue-600" size={32}/><span className="text-sm font-bold">در حال بارگذاری اطلاعات انبار...</span></div>;
    const companyList = settings.companies?.filter(c => c.showInWarehouse !== false).map(c => c.name) || [];
    if (companyList.length === 0) return (<div className="flex flex-col items-center justify-center h-[60vh] text-center p-6 animate-fade-in"><div className="bg-amber-100 p-4 rounded-full text-amber-600 mb-4 shadow-sm"><AlertTriangle size={48}/></div><h2 className="text-xl font-bold text-gray-800 mb-2">هیچ شرکتی برای انبار فعال نشده است</h2><p className="text-gray-600 max-w-md mb-6 leading-relaxed">برای استفاده از سیستم انبار، لطفاً در تنظیمات سیستم به بخش "مدیریت شرکت‌ها" بروید و تیک "نمایش در انبار" را برای شرکت‌های مورد نظر فعال کنید.</p><div className="flex gap-2"><button onClick={() => window.location.hash = '#settings'} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-lg"><Settings size={20}/><span>رفتن به تنظیمات</span></button></div></div>);

    const years = Array.from({length:10},(_,i)=>1400+i); const months = Array.from({length:12},(_,i)=>i+1); const days = Array.from({length:31},(_,i)=>i+1);

    const canApprove = currentUser.role === UserRole.CEO || currentUser.role === UserRole.ADMIN;

    return (
        <div className="bg-white rounded-2xl shadow-sm border h-[calc(100vh-100px)] flex flex-col overflow-hidden animate-fade-in relative">
            {/* Show Print Overlay */}
            {showPrintStockReport && (<PrintStockReport data={allWarehousesStock} onClose={() => setShowPrintStockReport(false)} />)}

            {/* Hidden Rendering Area for Auto-Send Approval */}
            <div className="hidden-print-export" style={{position:'absolute', top:'-9999px', left:'-9999px'}}>
                {approvedTxForAutoSend && (
                    <>
                        <div id={`print-bijak-${approvedTxForAutoSend.id}-price`}><PrintBijak tx={approvedTxForAutoSend} onClose={()=>{}} settings={settings} forceHidePrices={false} embed /></div>
                        <div id={`print-bijak-${approvedTxForAutoSend.id}-noprice`}><PrintBijak tx={approvedTxForAutoSend} onClose={()=>{}} settings={settings} forceHidePrices={true} embed /></div>
                    </>
                )}
                {editedBijakForAutoSend && (
                     <div id={`print-bijak-edit-${editedBijakForAutoSend.id}`}><PrintBijak tx={editedBijakForAutoSend} onClose={()=>{}} settings={settings} forceHidePrices={false} embed /></div>
                )}
            </div>

            <div className="bg-gray-100 p-2 flex gap-2 border-b overflow-x-auto no-print">
                {activeTab === 'approvals' ? (
                    // Only show approvals tab button if active (simple view for approvers)
                    <button onClick={() => setActiveTab('approvals')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap bg-white text-orange-600 shadow`}>کارتابل تایید بیجک</button>
                ) : (
                    <>
                    <button onClick={() => setActiveTab('dashboard')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap ${activeTab === 'dashboard' ? 'bg-white text-blue-600 shadow' : 'text-gray-600 hover:bg-gray-200'}`}>داشبورد</button>
                    <button onClick={() => setActiveTab('items')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap ${activeTab === 'items' ? 'bg-white text-blue-600 shadow' : 'text-gray-600 hover:bg-gray-200'}`}>تعریف کالا</button>
                    <button onClick={() => setActiveTab('entry')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap ${activeTab === 'entry' ? 'bg-white text-green-600 shadow' : 'text-gray-600 hover:bg-gray-200'}`}>ورود کالا (رسید)</button>
                    <button onClick={() => setActiveTab('entry_archive')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap ${activeTab === 'entry_archive' ? 'bg-white text-emerald-600 shadow' : 'text-gray-600 hover:bg-gray-200'}`}>مدیریت رسیدها</button>
                    <button onClick={() => setActiveTab('exit')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap ${activeTab === 'exit' ? 'bg-white text-red-600 shadow' : 'text-gray-600 hover:bg-gray-200'}`}>خروج کالا (بیجک)</button>
                    <button onClick={() => setActiveTab('archive')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap ${activeTab === 'archive' ? 'bg-white text-gray-800 shadow' : 'text-gray-600 hover:bg-gray-200'}`}>مدیریت بیجک‌ها</button>
                    <button onClick={() => setActiveTab('reports')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap ${activeTab === 'reports' ? 'bg-white text-purple-600 shadow' : 'text-gray-600 hover:bg-gray-200'}`}>گزارش کاردکس</button>
                    <button onClick={() => setActiveTab('stock_report')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap ${activeTab === 'stock_report' ? 'bg-white text-orange-600 shadow' : 'text-gray-600 hover:bg-gray-200'}`}>موجودی کل</button>
                    </>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                
                {/* --- REPORTS TAB (REPLACED WITH NEW COMPONENT) --- */}
                {activeTab === 'reports' && (
                    <WarehouseKardexReport 
                        items={items}
                        transactions={transactions}
                        companies={companyList}
                    />
                )}

                {/* APPROVALS TAB */}
                {activeTab === 'approvals' && (
                    <div className="space-y-4">
                        <div className="bg-orange-50 p-4 rounded-xl border border-orange-200 flex justify-between items-center">
                            <h3 className="font-bold text-orange-800 flex items-center gap-2"><CheckCircle size={24}/> کارتابل تایید بیجک</h3>
                            <div className="text-sm font-bold text-orange-700 bg-white px-3 py-1 rounded-lg border border-orange-200">
                                تعداد در انتظار: {pendingBijaks.length}
                            </div>
                        </div>
                        
                        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                            <table className="w-full text-sm text-right">
                                <thead className="bg-gray-100 text-gray-600"><tr><th className="p-4">شماره</th><th className="p-4">تاریخ</th><th className="p-4">شرکت</th><th className="p-4">گیرنده</th><th className="p-4 text-center">عملیات</th></tr></thead>
                                <tbody className="divide-y">
                                    {pendingBijaks.map(tx => (
                                        <tr key={tx.id} className="hover:bg-gray-50">
                                            <td className="p-4 font-mono font-bold text-red-600">#{tx.number}</td>
                                            <td className="p-4 text-xs">{formatDate(tx.date)}</td>
                                            <td className="p-4 text-xs font-bold">{tx.company}</td>
                                            <td className="p-4 text-xs">{tx.recipientName}</td>
                                            <td className="p-4 text-center flex justify-center gap-2">
                                                <button onClick={() => setViewBijak(tx)} className="bg-blue-100 text-blue-600 p-2 rounded hover:bg-blue-200" title="مشاهده"><Eye size={16}/></button>
                                                {canApprove && <button onClick={() => handleApproveBijak(tx)} className="bg-green-100 text-green-600 p-2 rounded hover:bg-green-200" title="تایید و ارسال"><CheckCircle size={16}/></button>}
                                            </td>
                                        </tr>
                                    ))}
                                    {pendingBijaks.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-gray-400">هیچ بیجکی در انتظار تایید نیست.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'dashboard' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div onClick={() => setActiveTab('items')} className="bg-blue-50 p-6 rounded-2xl border border-blue-100 flex items-center justify-between cursor-pointer hover:shadow-md transition-all"><div><div className="text-3xl font-black text-blue-700">{items.length}</div><div className="text-sm text-blue-600 font-bold">تعداد کالاها</div></div><Package size={40} className="text-blue-300"/></div>
                            <div onClick={() => setActiveTab('entry')} className="bg-green-50 p-6 rounded-2xl border border-green-100 flex items-center justify-between cursor-pointer hover:shadow-md transition-all"><div><div className="text-3xl font-black text-green-700">{transactions.filter(t=>t.type==='IN').length}</div><div className="text-sm text-green-600 font-bold">تعداد رسیدها</div></div><ArrowDownCircle size={40} className="text-green-300"/></div>
                            <div onClick={() => setActiveTab('exit')} className="bg-red-50 p-6 rounded-2xl border border-red-100 flex items-center justify-between cursor-pointer hover:shadow-md transition-all"><div><div className="text-3xl font-black text-red-700">{transactions.filter(t=>t.type==='OUT').length}</div><div className="text-sm text-red-600 font-bold">تعداد حواله‌ها (بیجک)</div></div><ArrowUpCircle size={40} className="text-red-300"/></div>
                        </div>
                        <div className="bg-white border rounded-2xl overflow-hidden shadow-sm">
                            <div className="bg-gray-50 p-4 border-b flex justify-between items-center"><h3 className="font-bold text-gray-800 flex items-center gap-2"><FileClock size={20}/> آخرین بیجک‌های صادر شده</h3><button onClick={() => setActiveTab('archive')} className="text-xs text-blue-600 hover:underline font-bold border border-blue-200 px-3 py-1 rounded bg-white">مشاهده بایگانی</button></div>
                            <table className="w-full text-sm text-right"><thead className="bg-gray-100 text-gray-600"><tr><th className="p-3">شماره</th><th className="p-3">تاریخ</th><th className="p-3">شرکت</th><th className="p-3">گیرنده</th><th className="p-3">وضعیت</th><th className="p-3">عملیات</th></tr></thead><tbody className="divide-y">{recentBijaks.length === 0 ? (<tr><td colSpan={6} className="p-6 text-center text-gray-400">هیچ بیجکی صادر نشده است.</td></tr>) : (recentBijaks.map(tx => (
                                <tr key={tx.id} className="hover:bg-gray-50">
                                    <td className="p-3 font-mono font-bold text-red-600">#{tx.number}</td>
                                    <td className="p-3 text-xs">{formatDate(tx.date)}</td>
                                    <td className="p-3 text-xs font-bold">{tx.company}</td>
                                    <td className="p-3 text-xs">{tx.recipientName}</td>
                                    <td className="p-3"><span className={`text-[10px] px-2 py-1 rounded font-bold ${tx.status === 'APPROVED' ? 'bg-green-100 text-green-700' : tx.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-800'}`}>{tx.status === 'APPROVED' ? 'تایید شده' : tx.status === 'REJECTED' ? 'رد شده' : 'در انتظار تایید'}</span></td>
                                    <td className="p-3 flex gap-2">
                                        <button onClick={() => setViewBijak(tx)} className="text-blue-600 hover:text-blue-800 p-1 flex items-center gap-1"><Eye size={14}/> مشاهده</button>
                                        {(tx.status === 'PENDING' || !tx.status) && canApprove && <button onClick={() => handleApproveBijak(tx)} className="text-green-600 hover:text-green-800 p-1 flex items-center gap-1 bg-green-50 rounded"><CheckCircle size={14}/> تایید</button>}
                                    </td>
                                </tr>
                            )))}</tbody></table>
                        </div>
                    </div>
                )}
                
                {/* ... (Items, Entry kept hidden) ... */}
                {activeTab === 'items' && (<div className="max-w-4xl mx-auto"><div className="bg-gray-50 p-4 rounded-xl border mb-6 flex items-end gap-3 flex-wrap"><div className="flex-1 min-w-[200px] space-y-1"><label className="text-xs font-bold text-gray-500">نام کالا</label><input className="w-full border rounded p-2" value={newItemName} onChange={e=>setNewItemName(e.target.value)}/></div><div className="w-32 space-y-1"><label className="text-xs font-bold text-gray-500">کد کالا</label><input className="w-full border rounded p-2" value={newItemCode} onChange={e=>setNewItemCode(e.target.value)}/></div><div className="w-32 space-y-1"><label className="text-xs font-bold text-gray-500">واحد</label><select className="w-full border rounded p-2 bg-white" value={newItemUnit} onChange={e=>setNewItemUnit(e.target.value)}><option>عدد</option><option>کارتن</option><option>کیلوگرم</option><option>دستگاه</option></select></div><div className="w-32 space-y-1"><label className="text-xs font-bold text-gray-500">گنجایش کانتینر</label><input type="number" className="w-full border rounded p-2 dir-ltr" placeholder="تعداد" value={newItemContainerCapacity} onChange={e=>setNewItemContainerCapacity(e.target.value)}/></div><button onClick={handleAddItem} className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700 h-[42px] w-12 flex items-center justify-center"><Plus/></button></div><div className="bg-white border rounded-xl overflow-hidden"><table className="w-full text-sm text-right"><thead className="bg-gray-100"><tr><th className="p-3">کد</th><th className="p-3">نام کالا</th><th className="p-3">واحد</th><th className="p-3">ظرفیت کانتینر</th><th className="p-3 text-center">عملیات</th></tr></thead><tbody>{items.map(i => (<tr key={i.id} className="border-t hover:bg-gray-50"><td className="p-3 font-mono">{i.code}</td><td className="p-3 font-bold">{i.name}</td><td className="p-3">{i.unit}</td><td className="p-3 font-mono">{i.containerCapacity ? i.containerCapacity : '-'}</td><td className="p-3 text-center"><div className="flex justify-center gap-2"><button onClick={() => setEditingItem(i)} className="text-amber-500 hover:text-amber-700" title="ویرایش"><Edit size={16}/></button><button onClick={()=>handleDeleteItem(i.id)} className="text-red-500 hover:text-red-700" title="حذف"><Trash2 size={16}/></button></div></td></tr>))}</tbody></table></div></div>)}
                {activeTab === 'entry' && (<div className="max-w-4xl mx-auto bg-green-50 p-6 rounded-2xl border border-green-200"><h3 className="font-bold text-green-800 mb-4 flex items-center gap-2"><ArrowDownCircle/> ثبت ورود کالا (رسید انبار)</h3><div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4"><div><label className="block text-xs font-bold mb-1">شرکت مالک</label><select className="w-full border rounded p-2 bg-white" value={selectedCompany} onChange={e=>setSelectedCompany(e.target.value)}><option value="">انتخاب...</option>{companyList.map(c=><option key={c} value={c}>{c}</option>)}</select></div><div><label className="block text-xs font-bold mb-1">شماره پروفرما / سند</label><input className="w-full border rounded p-2 bg-white" value={proformaNumber} onChange={e=>setProformaNumber(e.target.value)}/></div><div><label className="block text-xs font-bold mb-1">تاریخ ورود</label><div className="flex gap-1 dir-ltr"><select className="border rounded p-1 text-sm flex-1" value={txDate.year} onChange={e=>setTxDate({...txDate, year:Number(e.target.value)})}>{years.map(y=><option key={y} value={y}>{y}</option>)}</select><select className="border rounded p-1 text-sm flex-1" value={txDate.month} onChange={e=>setTxDate({...txDate, month:Number(e.target.value)})}>{months.map(m=><option key={m} value={m}>{m}</option>)}</select><select className="border rounded p-1 text-sm flex-1" value={txDate.day} onChange={e=>setTxDate({...txDate, day:Number(e.target.value)})}>{days.map(d=><option key={d} value={d}>{d}</option>)}</select></div></div></div><div className="space-y-2 bg-white p-4 rounded-xl border">{txItems.map((row, idx) => (<div key={idx} className="flex gap-2 items-end"><div className="flex-1"><label className="text-[10px] text-gray-500">کالا</label><select className="w-full border rounded p-2 text-sm" value={row.itemId} onChange={e=>updateTxItem(idx, 'itemId', e.target.value)}><option value="">انتخاب کالا...</option>{items.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select></div><div className="w-24"><label className="text-[10px] text-gray-500">تعداد</label><input type="number" className="w-full border rounded p-2 text-sm dir-ltr" value={row.quantity} onChange={e=>updateTxItem(idx, 'quantity', e.target.value)}/></div><div className="w-24"><label className="text-[10px] text-gray-500">وزن (KG)</label><input type="number" className="w-full border rounded p-2 text-sm dir-ltr" value={row.weight} onChange={e=>updateTxItem(idx, 'weight', e.target.value)}/></div>{idx > 0 && <button onClick={()=>handleRemoveTxItemRow(idx)} className="text-red-500 p-2"><Trash2 size={16}/></button>}</div>))}<button onClick={handleAddTxItemRow} className="text-xs text-blue-600 font-bold flex items-center gap-1 mt-2"><Plus size={14}/> افزودن ردیف کالا</button></div><button onClick={()=>handleSubmitTx('IN')} className="w-full bg-green-600 text-white font-bold py-3 rounded-xl mt-4 hover:bg-green-700 shadow-lg">ثبت رسید انبار</button></div>)}
                
                {activeTab === 'exit' && (
                    <div className="max-w-4xl mx-auto bg-red-50 p-6 rounded-2xl border border-red-200">
                        <h3 className="font-bold text-red-800 mb-4 flex items-center gap-2"><ArrowUpCircle/> ثبت خروج کالا (صدور بیجک)</h3>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4"><div><label className="block text-xs font-bold mb-1">شرکت فرستنده</label><select className="w-full border rounded p-2 bg-white" value={selectedCompany} onChange={e=>setSelectedCompany(e.target.value)}><option value="">انتخاب...</option>{companyList.map(c=><option key={c} value={c}>{c}</option>)}</select></div><div><label className="block text-xs font-bold mb-1">شماره بیجک (سیستمی)</label><div className="bg-white p-2 rounded border font-mono text-center text-red-600 font-bold">{nextBijakNum > 0 ? nextBijakNum : '---'}</div></div><div><label className="block text-xs font-bold mb-1">تاریخ خروج</label><div className="flex gap-1 dir-ltr"><select className="border rounded p-1 text-sm flex-1" value={txDate.year} onChange={e=>setTxDate({...txDate, year:Number(e.target.value)})}>{years.map(y=><option key={y} value={y}>{y}</option>)}</select><select className="border rounded p-1 text-sm flex-1" value={txDate.month} onChange={e=>setTxDate({...txDate, month:Number(e.target.value)})}>{months.map(m=><option key={m} value={m}>{m}</option>)}</select><select className="border rounded p-1 text-sm flex-1" value={txDate.day} onChange={e=>setTxDate({...txDate, day:Number(e.target.value)})}>{days.map(d=><option key={d} value={d}>{d}</option>)}</select></div></div><div><label className="block text-xs font-bold mb-1">تحویل گیرنده</label><input className="w-full border rounded p-2 bg-white" value={recipientName} onChange={e=>setRecipientName(e.target.value)}/></div></div><div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4"><div><label className="block text-xs font-bold mb-1">راننده</label><input className="w-full border rounded p-2 bg-white" value={driverName} onChange={e=>setDriverName(e.target.value)}/></div><div><label className="block text-xs font-bold mb-1">پلاک</label><input className="w-full border rounded p-2 bg-white dir-ltr" value={plateNumber} onChange={e=>setPlateNumber(e.target.value)}/></div><div><label className="block text-xs font-bold mb-1">مقصد</label><input className="w-full border rounded p-2 bg-white" value={destination} onChange={e=>setDestination(e.target.value)}/></div></div><div className="space-y-2 bg-white p-4 rounded-xl border">{txItems.map((row, idx) => (<div key={idx} className="flex gap-2 items-end"><div className="flex-1"><label className="text-[10px] text-gray-500">کالا</label><select className="w-full border rounded p-2 text-sm" value={row.itemId} onChange={e=>updateTxItem(idx, 'itemId', e.target.value)}><option value="">انتخاب...</option>{items.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select></div><div className="w-20"><label className="text-[10px] text-gray-500">تعداد</label><input type="number" className="w-full border rounded p-2 text-sm dir-ltr" value={row.quantity} onChange={e=>updateTxItem(idx, 'quantity', e.target.value)}/></div><div className="w-20"><label className="text-[10px] text-gray-500">وزن</label><input type="number" className="w-full border rounded p-2 text-sm dir-ltr" value={row.weight} onChange={e=>updateTxItem(idx, 'weight', e.target.value)}/></div><div className="w-32"><label className="text-[10px] text-gray-500">فی (ریال)</label><input type="text" className="w-full border rounded p-2 text-sm dir-ltr font-bold text-blue-600" value={formatNumberString(row.unitPrice)} onChange={e=>updateTxItem(idx, 'unitPrice', deformatNumberString(e.target.value))}/></div>{idx > 0 && <button onClick={()=>handleRemoveTxItemRow(idx)} className="text-red-500 p-2"><Trash2 size={16}/></button>}</div>))}<button onClick={handleAddTxItemRow} className="text-xs text-blue-600 font-bold flex items-center gap-1 mt-2"><Plus size={14}/> افزودن ردیف کالا</button></div>
                        <button onClick={()=>handleSubmitTx('OUT')} className="w-full bg-red-600 text-white font-bold py-3 rounded-xl mt-4 hover:bg-red-700 shadow-lg">ثبت و ارسال جهت تایید</button>
                    </div>
                )}

                {/* ... (Stock report and Archive) ... */}
                {activeTab === 'stock_report' && (
                    <div className="flex flex-col h-full">
                        <div className="flex justify-between items-center mb-4 no-print">
                            <h2 className="text-xl font-bold">گزارش موجودی کلی انبارها (تفکیکی)</h2>
                            <div className="flex gap-2">
                                <button onClick={handleDownloadStockPDF} disabled={processingExport} className="bg-red-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-red-700">{processingExport ? <Loader2 size={18} className="animate-spin"/> : <FileDown size={18}/>} دانلود PDF</button>
                                <button onClick={handlePrintStock} className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-blue-700"><Printer size={18}/> چاپ (افقی)</button>
                            </div>
                        </div>
                        <div id="stock-report-container" className="bg-white p-2 shadow-lg mx-auto w-full md:w-[297mm] min-h-[210mm] text-[10px]">
                            <div className="text-center bg-yellow-300 border border-black py-1 mb-1 font-black text-lg">موجودی بنگاه ها</div>
                            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${allWarehousesStock.length}, 1fr)`, border: '1px solid black' }}>
                                {allWarehousesStock.map((group, index) => {
                                    const headerColor = index === 0 ? 'bg-purple-300' : index === 1 ? 'bg-orange-300' : 'bg-blue-300';
                                    return (
                                        <div key={group.company} className="border-l border-black last:border-l-0">
                                            <div className={`${headerColor} text-black font-bold p-1 text-center border-b border-black text-sm`}>{group.company}</div>
                                            <div className="grid grid-cols-4 bg-gray-100 font-bold border-b border-black text-center"><div className="p-1 border-l border-black">نخ</div><div className="p-1 border-l border-black">کارتن</div><div className="p-1 border-l border-black">وزن</div><div className="p-1">کانتینر</div></div>
                                            <div>{group.items.map((item, i) => (<div key={i} className="grid grid-cols-4 border-b border-gray-400 last:border-b-0 text-center hover:bg-gray-50 leading-tight"><div className="p-1 border-l border-black font-bold truncate text-right pr-2">{item.name}</div><div className="p-1 border-l border-black font-mono">{item.quantity}</div><div className="p-1 border-l border-black font-mono">{item.weight > 0 ? item.weight : 0}</div><div className="p-1 font-mono text-gray-500">{item.containerCount > 0 ? item.containerCount.toFixed(2) : '-'}</div></div>))}{group.items.length === 0 && <div className="p-2 text-center text-gray-400">-</div>}</div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="text-center bg-yellow-300 border border-black py-1 mt-1 font-bold text-xs">موجودی کل</div>
                        </div>
                    </div>
                )}

                {activeTab === 'archive' && (
                    <div className="space-y-4">
                        <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col md:flex-row gap-4 items-center no-print">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2"><Archive size={20}/> بایگانی بیجک‌ها</h3>
                            <div className="flex-1 w-full relative">
                                <Search size={16} className="absolute left-3 top-3 text-gray-400"/>
                                <input className="w-full border rounded-lg p-2 pl-9" placeholder="جستجو (شماره، گیرنده...)" value={reportSearch} onChange={e=>setReportSearch(e.target.value)}/>
                            </div>
                            <div className="w-full md:w-64">
                                <select className="w-full border rounded-lg p-2" value={archiveFilterCompany} onChange={e=>setArchiveFilterCompany(e.target.value)}>
                                    <option value="">همه شرکت‌ها</option>
                                    {companyList.map(c=><option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                            <table className="w-full text-sm text-right">
                                <thead className="bg-gray-100 text-gray-600"><tr><th className="p-4">شماره</th><th className="p-4">تاریخ</th><th className="p-4">شرکت</th><th className="p-4">گیرنده / راننده</th><th className="p-4">وضعیت</th><th className="p-4 text-center">عملیات</th></tr></thead>
                                <tbody className="divide-y">
                                    {filteredArchiveBijaks.map(tx => (
                                        <tr key={tx.id} className="hover:bg-gray-50">
                                            <td className="p-4 font-mono font-bold text-red-600">#{tx.number}</td>
                                            <td className="p-4 text-xs">{formatDate(tx.date)}</td>
                                            <td className="p-4 text-xs font-bold">{tx.company}</td>
                                            <td className="p-4 text-xs"><div className="font-bold">{tx.recipientName}</div><div className="text-gray-500">{tx.driverName}</div></td>
                                            <td className="p-4"><span className={`text-[10px] px-2 py-1 rounded font-bold ${tx.status === 'APPROVED' ? 'bg-green-100 text-green-700' : tx.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-800'}`}>{tx.status === 'APPROVED' ? 'تایید شده' : tx.status === 'REJECTED' ? 'رد شده' : 'در انتظار تایید'}</span></td>
                                            <td className="p-4 text-center flex justify-center gap-2">
                                                <button onClick={() => setViewBijak(tx)} className="bg-blue-100 text-blue-600 p-2 rounded hover:bg-blue-200" title="مشاهده/چاپ"><Eye size={16}/></button>
                                                {(tx.status === 'PENDING' || !tx.status) && canApprove && <button onClick={() => handleApproveBijak(tx)} className="bg-green-100 text-green-600 p-2 rounded hover:bg-green-200" title="تایید و ارسال"><CheckCircle size={16}/></button>}
                                                <button onClick={() => setEditingBijak(tx)} className="bg-amber-100 text-amber-600 p-2 rounded hover:bg-amber-200" title="ویرایش"><Edit size={16}/></button>
                                                <button onClick={() => handleDeleteTx(tx.id)} className="bg-red-100 text-red-600 p-2 rounded hover:bg-red-200" title="حذف"><Trash2 size={16}/></button>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredArchiveBijaks.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-gray-400">موردی یافت نشد.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
                {/* ... (Other tabs kept as is) ... */}
                {activeTab === 'entry_archive' && (<div className="bg-white rounded-xl border shadow-sm overflow-hidden"><table className="w-full text-sm text-right"><thead className="bg-gray-100 text-gray-600"><tr><th className="p-4">تاریخ ورود</th><th className="p-4">شرکت مالک</th><th className="p-4">شماره پروفرما</th><th className="p-4">خلاصه کالا</th><th className="p-4 text-center">عملیات</th></tr></thead><tbody className="divide-y">{filteredArchiveReceipts.map(tx => (<tr key={tx.id} className="hover:bg-gray-50"><td className="p-4 text-xs font-mono">{formatDate(tx.date)}</td><td className="p-4 text-xs font-bold">{tx.company}</td><td className="p-4 text-xs font-mono">{tx.proformaNumber}</td><td className="p-4 text-xs text-gray-600">{tx.items.length} قلم ({tx.items[0]?.itemName}...)</td><td className="p-4 text-center flex justify-center gap-2"><button onClick={() => setEditingReceipt(tx)} className="bg-amber-100 text-amber-600 p-2 rounded hover:bg-amber-200" title="ویرایش"><Edit size={16}/></button><button onClick={() => handleDeleteTx(tx.id)} className="bg-red-100 text-red-600 p-2 rounded hover:bg-red-200" title="حذف"><Trash2 size={16}/></button></td></tr>))}</tbody></table></div>)}
            </div>
            
            {/* View Bijak Modal */}
            {viewBijak && (<PrintBijak tx={viewBijak} onClose={() => setViewBijak(null)} settings={settings} />)}

            {/* Edit Bijak Modal */}
            {editingBijak && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-lg">ویرایش بیجک #{editingBijak.number}</h3>
                            <button onClick={() => setEditingBijak(null)}><X size={20}/></button>
                        </div>
                        <EditBijakForm bijak={editingBijak} items={items} companyList={companyList} onSave={handleEditBijakSave} onCancel={() => setEditingBijak(null)} />
                    </div>
                </div>
            )}

            {/* Edit Receipt Modal */}
            {editingReceipt && (<div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4"><div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"><div className="p-4 border-b flex justify-between items-center bg-green-50"><h3 className="font-bold text-lg text-green-800">ویرایش رسید ورودی</h3><button onClick={() => setEditingReceipt(null)}><X size={20}/></button></div><EditReceiptForm receipt={editingReceipt} items={items} companyList={companyList} onSave={handleEditReceiptSave} onCancel={() => setEditingReceipt(null)} /></div></div>)}

            {/* Edit Item Modal */}
            {editingItem && (<div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4"><div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6"><div className="flex justify-between items-center mb-4"><h3 className="font-bold text-lg">ویرایش کالا</h3><button onClick={() => setEditingItem(null)}><X size={20}/></button></div><div className="space-y-3"><div><label className="text-xs font-bold block mb-1">نام کالا</label><input className="w-full border rounded p-2 text-sm" value={editingItem.name} onChange={e => setEditingItem({...editingItem, name: e.target.value})} /></div><div><label className="text-xs font-bold block mb-1">کد کالا</label><input className="w-full border rounded p-2 text-sm" value={editingItem.code} onChange={e => setEditingItem({...editingItem, code: e.target.value})} /></div><div><label className="text-xs font-bold block mb-1">ظرفیت کانتینر</label><input type="number" className="w-full border rounded p-2 text-sm dir-ltr" value={editingItem.containerCapacity} onChange={e => setEditingItem({...editingItem, containerCapacity: Number(e.target.value)})} /></div><button onClick={handleEditItem} className="w-full bg-blue-600 text-white py-2 rounded font-bold mt-2">ذخیره تغییرات</button></div></div></div>)}
        </div>
    );
};

// ... (EditBijakForm and EditReceiptForm remain same) ...
const EditBijakForm: React.FC<{ bijak: WarehouseTransaction, items: WarehouseItem[], companyList: string[], onSave: (tx: WarehouseTransaction) => void, onCancel: () => void }> = ({ bijak, items, companyList, onSave, onCancel }) => {
    const safeDate = bijak.date || new Date().toISOString();
    const [dateParts, setDateParts] = useState(() => { try { return getShamsiDateFromIso(safeDate); } catch { const d = getCurrentShamsiDate(); return { year: d.year, month: d.month, day: d.day }; } });
    const [formData, setFormData] = useState({ ...bijak, items: bijak.items || [] });
    const handleSave = () => { try { const isoDate = jalaliToGregorian(dateParts.year, dateParts.month, dateParts.day).toISOString(); const validatedItems = formData.items.map(item => ({ ...item, quantity: Number(item.quantity) || 0, weight: Number(item.weight) || 0, unitPrice: Number(item.unitPrice) || 0 })); if (!formData.company) { alert("لطفا شرکت را انتخاب کنید"); return; } onSave({ ...formData, items: validatedItems, date: isoDate }); } catch(e) { alert("خطا در ذخیره سازی: تاریخ نامعتبر است."); } };
    const updateItem = (idx: number, field: string, val: any) => { const newItems = [...formData.items]; if (!newItems[idx]) return; /* @ts-ignore */ newItems[idx][field] = val; if(field === 'itemId') { const found = items.find(i => i.id === val); if(found) newItems[idx].itemName = found.name; } setFormData({ ...formData, items: newItems }); };
    const addItem = () => setFormData({ ...formData, items: [...formData.items, { itemId: '', itemName: '', quantity: 0, weight: 0, unitPrice: 0 }] });
    const removeItem = (idx: number) => setFormData({ ...formData, items: formData.items.filter((_, i) => i !== idx) });
    const years = Array.from({length:10},(_,i)=>1400+i); const months = Array.from({length:12},(_,i)=>i+1); const days = Array.from({length:31},(_,i)=>i+1);
    return (<div className="p-6 space-y-4"><div className="grid grid-cols-2 gap-4"><div><label className="text-xs font-bold block mb-1">تاریخ</label><div className="flex gap-1"><select className="border rounded p-1 w-full" value={dateParts.day} onChange={e=>setDateParts({...dateParts, day: +e.target.value})}>{days.map(d=><option key={d} value={d}>{d}</option>)}</select><select className="border rounded p-1 w-full" value={dateParts.month} onChange={e=>setDateParts({...dateParts, month: +e.target.value})}>{months.map(m=><option key={m} value={m}>{m}</option>)}</select><select className="border rounded p-1 w-full" value={dateParts.year} onChange={e=>setDateParts({...dateParts, year: +e.target.value})}>{years.map(y=><option key={y} value={y}>{y}</option>)}</select></div></div><div><label className="text-xs font-bold block mb-1">شرکت فرستنده</label><select className="w-full border rounded p-2 bg-white" value={formData.company} onChange={e=>setFormData({...formData, company: e.target.value})}>{companyList.map(c=><option key={c} value={c}>{c}</option>)}</select></div><div><label className="text-xs font-bold block mb-1">گیرنده</label><input className="w-full border rounded p-2" value={formData.recipientName || ''} onChange={e=>setFormData({...formData, recipientName: e.target.value})}/></div><div><label className="text-xs font-bold block mb-1">راننده</label><input className="w-full border rounded p-2" value={formData.driverName || ''} onChange={e=>setFormData({...formData, driverName: e.target.value})}/></div><div><label className="text-xs font-bold block mb-1">پلاک</label><input className="w-full border rounded p-2 dir-ltr" value={formData.plateNumber || ''} onChange={e=>setFormData({...formData, plateNumber: e.target.value})}/></div><div className="col-span-2"><label className="text-xs font-bold block mb-1">مقصد</label><input className="w-full border rounded p-2" value={formData.destination || ''} onChange={e=>setFormData({...formData, destination: e.target.value})}/></div></div><div className="bg-gray-50 p-4 rounded border"><h4 className="font-bold text-sm mb-2">اقلام</h4>{formData.items.map((item, idx) => (<div key={idx} className="flex gap-2 mb-2 items-end"><div className="flex-1"><select className="w-full border rounded p-1 text-sm" value={item.itemId} onChange={e=>updateItem(idx, 'itemId', e.target.value)}><option value="">انتخاب...</option>{items.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select></div><div className="w-20"><input type="number" className="w-full border rounded p-1 text-sm text-center" value={item.quantity} onChange={e=>updateItem(idx, 'quantity', e.target.value)} placeholder="تعداد"/></div><div className="w-24"><input type="number" className="w-full border rounded p-1 text-sm text-center" value={item.weight} onChange={e=>updateItem(idx, 'weight', e.target.value)} placeholder="وزن"/></div><div className="w-28"><input type="number" className="w-full border rounded p-1 text-sm text-center" value={item.unitPrice} onChange={e=>updateItem(idx, 'unitPrice', e.target.value)} placeholder="قیمت"/></div><button onClick={()=>removeItem(idx)} className="text-red-500"><Trash2 size={16}/></button></div>))}<button onClick={addItem} className="text-blue-600 text-xs font-bold flex items-center gap-1 mt-2"><Plus size={14}/> افزودن سطر</button></div><div className="flex justify-end gap-2 pt-4 border-t"><button onClick={onCancel} className="px-4 py-2 border rounded text-gray-600">انصراف</button><button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded font-bold">ذخیره و ارسال جهت تایید</button></div></div>);
}

const EditReceiptForm: React.FC<{ receipt: WarehouseTransaction, items: WarehouseItem[], companyList: string[], onSave: (tx: WarehouseTransaction) => void, onCancel: () => void }> = ({ receipt, items, companyList, onSave, onCancel }) => {
    const safeDate = receipt.date || new Date().toISOString();
    const [dateParts, setDateParts] = useState(() => { try { return getShamsiDateFromIso(safeDate); } catch { const d = getCurrentShamsiDate(); return { year: d.year, month: d.month, day: d.day }; } });
    const [formData, setFormData] = useState({ ...receipt, items: receipt.items || [] });
    const handleSave = () => { try { const isoDate = jalaliToGregorian(dateParts.year, dateParts.month, dateParts.day).toISOString(); const validatedItems = formData.items.map(item => ({ ...item, quantity: Number(item.quantity) || 0, weight: Number(item.weight) || 0 })); if (!formData.company) { alert("لطفا شرکت را انتخاب کنید"); return; } onSave({ ...formData, items: validatedItems, date: isoDate }); } catch(e) { alert("خطا در ذخیره سازی: تاریخ نامعتبر است."); } };
    const updateItem = (idx: number, field: string, val: any) => { const newItems = [...formData.items]; if (!newItems[idx]) return; /* @ts-ignore */ newItems[idx][field] = val; if(field === 'itemId') { const found = items.find(i => i.id === val); if(found) newItems[idx].itemName = found.name; } setFormData({ ...formData, items: newItems }); };
    const addItem = () => setFormData({ ...formData, items: [...formData.items, { itemId: '', itemName: '', quantity: 0, weight: 0, unitPrice: 0 }] });
    const removeItem = (idx: number) => setFormData({ ...formData, items: formData.items.filter((_, i) => i !== idx) });
    const years = Array.from({length:10},(_,i)=>1400+i); const months = Array.from({length:12},(_,i)=>i+1); const days = Array.from({length:31},(_,i)=>i+1);
    return (<div className="p-6 space-y-4"><div className="grid grid-cols-2 gap-4"><div><label className="text-xs font-bold block mb-1">تاریخ ورود</label><div className="flex gap-1"><select className="border rounded p-1 w-full" value={dateParts.day} onChange={e=>setDateParts({...dateParts, day: +e.target.value})}>{days.map(d=><option key={d} value={d}>{d}</option>)}</select><select className="border rounded p-1 w-full" value={dateParts.month} onChange={e=>setDateParts({...dateParts, month: +e.target.value})}>{months.map(m=><option key={m} value={m}>{m}</option>)}</select><select className="border rounded p-1 w-full" value={dateParts.year} onChange={e=>setDateParts({...dateParts, year: +e.target.value})}>{years.map(y=><option key={y} value={y}>{y}</option>)}</select></div></div><div><label className="text-xs font-bold block mb-1">شرکت مالک</label><select className="w-full border rounded p-2 bg-white" value={formData.company} onChange={e=>setFormData({...formData, company: e.target.value})}>{companyList.map(c=><option key={c} value={c}>{c}</option>)}</select></div><div className="col-span-2"><label className="text-xs font-bold block mb-1">شماره پروفرما / سند</label><input className="w-full border rounded p-2" value={formData.proformaNumber || ''} onChange={e=>setFormData({...formData, proformaNumber: e.target.value})}/></div></div><div className="bg-gray-50 p-4 rounded border"><h4 className="font-bold text-sm mb-2">اقلام ورودی</h4>{formData.items.map((item, idx) => (<div key={idx} className="flex gap-2 mb-2 items-end"><div className="flex-1"><select className="w-full border rounded p-1 text-sm" value={item.itemId} onChange={e=>updateItem(idx, 'itemId', e.target.value)}><option value="">انتخاب...</option>{items.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select></div><div className="w-24"><input type="number" className="w-full border rounded p-1 text-sm text-center" value={item.quantity} onChange={e=>updateItem(idx, 'quantity', e.target.value)} placeholder="تعداد"/></div><div className="w-24"><input type="number" className="w-full border rounded p-1 text-sm text-center" value={item.weight} onChange={e=>updateItem(idx, 'weight', e.target.value)} placeholder="وزن"/></div><button onClick={()=>removeItem(idx)} className="text-red-500"><Trash2 size={16}/></button></div>))}<button onClick={addItem} className="text-blue-600 text-xs font-bold flex items-center gap-1 mt-2"><Plus size={14}/> افزودن سطر</button></div><div className="flex justify-end gap-2 pt-4 border-t"><button onClick={onCancel} className="px-4 py-2 border rounded text-gray-600">انصراف</button><button onClick={handleSave} className="px-4 py-2 bg-green-600 text-white rounded font-bold">ذخیره تغییرات</button></div></div>);
}

export default WarehouseModule;
