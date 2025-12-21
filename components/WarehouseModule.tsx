
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, SystemSettings, WarehouseItem, WarehouseTransaction, WarehouseTransactionItem, UserRole } from '../types';
import { getWarehouseItems, saveWarehouseItem, deleteWarehouseItem, getWarehouseTransactions, saveWarehouseTransaction, deleteWarehouseTransaction, updateWarehouseTransaction, getNextBijakNumber, updateWarehouseItem } from '../services/storageService';
import { generateUUID, getCurrentShamsiDate, jalaliToGregorian, formatNumberString, deformatNumberString, formatDate, parsePersianDate, getShamsiDateFromIso } from '../constants';
import { Package, Plus, Trash2, ArrowDownCircle, ArrowUpCircle, FileText, BarChart3, Eye, Loader2, AlertTriangle, Settings, ArrowLeftRight, Search, FileClock, Printer, FileDown, Share2, LayoutGrid, Archive, Edit, Save, X, Container, CheckCircle, XCircle } from 'lucide-react';
import PrintBijak from './PrintBijak';
import PrintStockReport from './print/PrintStockReport'; 
import WarehouseKardexReport from './reports/WarehouseKardexReport';
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

    // Auto Send on Approval/Edit/Delete
    const [approvedTxForAutoSend, setApprovedTxForAutoSend] = useState<WarehouseTransaction | null>(null);
    const [editedBijakForAutoSend, setEditedBijakForAutoSend] = useState<WarehouseTransaction | null>(null);
    const [deletedTxForAutoSend, setDeletedTxForAutoSend] = useState<WarehouseTransaction | null>(null);
    const [newBijakForAutoSend, setNewBijakForAutoSend] = useState<WarehouseTransaction | null>(null);

    useEffect(() => { loadData(); }, []);
    useEffect(() => { setActiveTab(initialTab); }, [initialTab]);
    useEffect(() => { if(selectedCompany && activeTab === 'exit' && settings) { updateNextBijak(); } }, [selectedCompany, activeTab, settings]);

    const loadData = async () => { setLoadingData(true); try { const [i, t] = await Promise.all([getWarehouseItems(), getWarehouseTransactions()]); setItems(i || []); setTransactions(t || []); } catch (e) { console.error(e); } finally { setLoadingData(false); } };
    const updateNextBijak = async () => { if(selectedCompany) { const num = await getNextBijakNumber(selectedCompany); setNextBijakNum(num); } };
    
    // FIX: Set hours to noon (12:00) to avoid timezone shifts making the date jump back one day
    const getIsoDate = () => { 
        try { 
            const date = jalaliToGregorian(txDate.year, txDate.month, txDate.day); 
            date.setHours(12, 0, 0, 0); 
            return date.toISOString(); 
        } catch { 
            const d = new Date();
            d.setHours(12, 0, 0, 0);
            return d.toISOString(); 
        } 
    };
    
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

        try {
            await saveWarehouseTransaction(tx);
            await loadData();
            
            if(type === 'OUT') {
                // Trigger Auto-Send to CEO
                setNewBijakForAutoSend(tx);
                
                setTimeout(async () => {
                    const element = document.getElementById(`print-bijak-new-${tx.id}`);
                    if (element) {
                        try {
                            const users = await getUsers();
                            const ceo = users.find(u => u.role === UserRole.CEO && u.phoneNumber);
                            if (ceo) {
                                // @ts-ignore
                                const canvas = await window.html2canvas(element, { scale: 2, backgroundColor: '#ffffff', windowWidth: 1200 });
                                const base64 = canvas.toDataURL('image/png').split(',')[1];
                                
                                let caption = `📢 *بیجک جدید ثبت شد*\n`;
                                caption += `شماره: ${tx.number}\n`;
                                caption += `شرکت: ${tx.company}\n`;
                                caption += `گیرنده: ${tx.recipientName}\n`;
                                caption += `ثبت کننده: ${tx.createdBy}\n\n`;
                                caption += `جهت بررسی و تایید.`;

                                await apiCall('/send-whatsapp', 'POST', { number: ceo.phoneNumber, message: caption, mediaData: { data: base64, mimeType: 'image/png', filename: `Bijak_${tx.number}.png` } });
                            }
                        } catch (e) { console.error("Auto send error", e); }
                    }
                    setNewBijakForAutoSend(null);
                    alert('بیجک ثبت شد و جهت تایید به مدیریت ارسال گردید.');
                    setRecipientName(''); setDriverName(''); setPlateNumber(''); setDestination('');
                }, 2000);
            } else {
                setProformaNumber(''); alert('ورود کالا ثبت شد.');
            }
            setTxItems([{ itemId: '', quantity: 0, weight: 0, unitPrice: 0 }]);
        } catch (e: any) {
            if (e.message && e.message.includes('409')) {
                alert('خطا: شماره بیجک تکراری است. لطفاً صفحه را رفرش کنید تا شماره جدید دریافت شود.');
            } else {
                alert('خطا در ثبت اطلاعات.');
            }
        }
    };

    const handleApproveBijak = async (tx: WarehouseTransaction) => {
        if (!confirm('آیا تایید می‌کنید؟ پس از تایید، بیجک به صورت خودکار برای انبار و مدیریت ارسال می‌شود.')) return;
        
        try {
            const isCorrection = tx.updatedAt && tx.updatedAt > (tx.createdAt + 60000); 
            const titleSuffix = isCorrection ? ' (اصلاحیه)' : '';

            const updatedTx = { ...tx, status: 'APPROVED' as const, approvedBy: currentUser.fullName };
            await updateWarehouseTransaction(updatedTx);
            
            setApprovedTxForAutoSend(updatedTx);
            
            // Wait slightly longer for React to render the hidden component
            setTimeout(async () => {
                const managerElement = document.getElementById(`print-bijak-${updatedTx.id}-price`);
                const warehouseElement = document.getElementById(`print-bijak-${updatedTx.id}-noprice`);
                
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
                        if (managerNumber && managerElement) {
                            // @ts-ignore
                            const canvas = await window.html2canvas(managerElement, { scale: 2, backgroundColor: '#ffffff', windowWidth: 1200 });
                            const base64 = canvas.toDataURL('image/png').split(',')[1];
                            const managerCaption = `🏭 *شرکت: ${updatedTx.company}*\n📑 *حواله خروج - تایید شده${titleSuffix}*\n${commonDetails}`;
                            
                            await apiCall('/send-whatsapp', 'POST', { number: managerNumber, message: managerCaption, mediaData: { data: base64, mimeType: 'image/png', filename: `Bijak_${updatedTx.number}_Price.png` } });
                        }

                        if (groupNumber && warehouseElement) {
                            // @ts-ignore
                            const canvas = await window.html2canvas(warehouseElement, { scale: 2, backgroundColor: '#ffffff', windowWidth: 1200 });
                            const base64 = canvas.toDataURL('image/png').split(',')[1];
                            const warehouseCaption = `🏭 *شرکت: ${updatedTx.company}*\n📦 *حواله خروج (انبار)*\n${commonDetails}`;

                            await apiCall('/send-whatsapp', 'POST', { number: groupNumber, message: warehouseCaption, mediaData: { data: base64, mimeType: 'image/png', filename: `Bijak_${updatedTx.number}.png` } });
                        }
                    } catch(e) { console.error("Auto send error", e); }
                }
                
                setApprovedTxForAutoSend(null);
                loadData();
                setViewBijak(null);
                alert("تایید و ارسال شد.");
            }, 2500); 

        } catch (e) { alert("خطا در عملیات تایید"); }
    };

    const handleRejectBijak = async (tx: WarehouseTransaction) => {
        const reason = prompt("لطفا دلیل رد بیجک را وارد کنید:");
        if (reason) {
            const updatedTx = { ...tx, status: 'REJECTED' as const, rejectionReason: reason, rejectedBy: currentUser.fullName };
            await updateWarehouseTransaction(updatedTx);
            loadData();
            setViewBijak(null); 
        }
    };

    const handleDeleteTx = async (id: string) => { 
        if(!confirm('آیا از حذف این تراکنش اطمینان دارید؟ عملیات غیرقابل بازگشت است.')) return;

        const txToDelete = transactions.find(t => t.id === id);
        
        if (txToDelete && txToDelete.type === 'OUT' && settings && settings.companyNotifications) {
            const deletedMock = { ...txToDelete, status: 'DELETED' as any };
            setDeletedTxForAutoSend(deletedMock);

            setTimeout(async () => {
                const managerElement = document.getElementById(`print-bijak-del-${id}-price`);
                const warehouseElement = document.getElementById(`print-bijak-del-${id}-noprice`);
                
                const companyConfig = settings.companyNotifications?.[txToDelete.company];
                const managerNumber = companyConfig?.salesManager;
                const groupNumber = companyConfig?.warehouseGroup;

                let warningCaption = `❌❌ *هشدار: بیجک حذف شد* ❌❌\n`;
                warningCaption += `⛔ *ارسال بار ممنوع*\n`;
                warningCaption += `🔢 شماره: ${txToDelete.number}\n`;
                warningCaption += `👤 گیرنده: ${txToDelete.recipientName}\n`;
                warningCaption += `🗑️ حذف توسط: ${currentUser.fullName}\n`;
                warningCaption += `⚠️ *این بیجک از سیستم حذف شده و فاقد اعتبار است.*`;

                try {
                    if (managerNumber && managerElement) {
                        // @ts-ignore
                        const canvas = await window.html2canvas(managerElement, { scale: 2, backgroundColor: '#ffffff', windowWidth: 1200 });
                        const base64 = canvas.toDataURL('image/png').split(',')[1];
                        await apiCall('/send-whatsapp', 'POST', { number: managerNumber, message: warningCaption, mediaData: { data: base64, mimeType: 'image/png', filename: `Bijak_DELETED_${txToDelete.number}.png` } });
                    }
                    if (groupNumber && warehouseElement) {
                        // @ts-ignore
                        const canvas = await window.html2canvas(warehouseElement, { scale: 2, backgroundColor: '#ffffff', windowWidth: 1200 });
                        const base64 = canvas.toDataURL('image/png').split(',')[1];
                        await apiCall('/send-whatsapp', 'POST', { number: groupNumber, message: warningCaption, mediaData: { data: base64, mimeType: 'image/png', filename: `Bijak_DELETED_${txToDelete.number}.png` } });
                    }
                } catch(e) { console.error("Error sending delete notification", e); }
                
                await deleteWarehouseTransaction(id);
                setDeletedTxForAutoSend(null);
                loadData();
                setViewBijak(null); 
                alert("تراکنش حذف و اطلاع‌رسانی شد.");

            }, 2500);
        } else {
            await deleteWarehouseTransaction(id);
            loadData();
        }
    };
    
    const handleEditBijakSave = async (updatedTx: WarehouseTransaction) => {
        try { 
            updatedTx.status = 'PENDING';
            updatedTx.updatedAt = Date.now();
            
            await updateWarehouseTransaction(updatedTx); 
            setEditingBijak(null); 
            
            setEditedBijakForAutoSend(updatedTx);

            setTimeout(async () => {
                 const element = document.getElementById(`print-bijak-edit-${updatedTx.id}`);
                 if (element) {
                     try {
                         const users = await getUsers();
                         const ceo = users.find(u => u.role === UserRole.CEO && u.phoneNumber);
                         if (ceo) {
                             // @ts-ignore
                            const canvas = await window.html2canvas(element, { scale: 2, backgroundColor: '#ffffff', windowWidth: 1200 });
                            const base64 = canvas.toDataURL('image/png').split(',')[1];
                            
                            let caption = `📝 *اصلاحیه بیجک (جهت تایید مجدد)*\n`;
                            caption += `شماره: ${updatedTx.number}\n`;
                            caption += `گیرنده: ${updatedTx.recipientName}\n`;
                            caption += `ویرایش توسط: ${currentUser.fullName}\n\n`;
                            caption += `لطفا بررسی نمایید.`;

                            await apiCall('/send-whatsapp', 'POST', { number: ceo.phoneNumber, message: caption, mediaData: { data: base64, mimeType: 'image/png', filename: `Bijak_Edit_${updatedTx.number}.png` } });
                         }
                     } catch(e) { console.error(e); }
                 }
                 setEditedBijakForAutoSend(null);
                 loadData(); 
                 alert('بیجک ویرایش و جهت تایید مجدد به مدیریت ارسال شد.'); 
            }, 2500);

        } catch (e: any) { 
            console.error(e); 
            if (e.message && e.message.includes('409')) {
                alert('خطا: شماره بیجک وارد شده برای این شرکت تکراری است. لطفاً شماره دیگری انتخاب کنید.');
            } else {
                alert('خطا در ویرایش بیجک.');
            }
        }
    };

    const handleEditReceiptSave = async (updatedTx: WarehouseTransaction) => {
        try { await updateWarehouseTransaction(updatedTx); setEditingReceipt(null); loadData(); alert('رسید با موفقیت ویرایش شد.'); } catch (e) { console.error(e); alert('خطا در ویرایش رسید.'); }
    };

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
    
    const pendingBijaks = useMemo(() => transactions.filter(t => t.type === 'OUT' && t.status === 'PENDING'), [transactions]);

    const handlePrintStock = () => { setShowPrintStockReport(true); };
    const handleDownloadStockPDF = async () => { /* ... */ };

    if (!settings || loadingData) return <div className="flex flex-col items-center justify-center h-[50vh] text-gray-500 gap-2"><Loader2 className="animate-spin text-blue-600" size={32}/><span className="text-sm font-bold">در حال بارگذاری اطلاعات انبار...</span></div>;
    const companyList = settings.companies?.filter(c => c.showInWarehouse !== false).map(c => c.name) || [];
    if (companyList.length === 0) return (<div className="flex flex-col items-center justify-center h-[60vh] text-center p-6 animate-fade-in"><div className="bg-amber-100 p-4 rounded-full text-amber-600 mb-4 shadow-sm"><AlertTriangle size={48}/></div><h2 className="text-xl font-bold text-gray-800 mb-2">هیچ شرکتی برای انبار فعال نشده است</h2><p className="text-gray-600 max-w-md mb-6 leading-relaxed">برای استفاده از سیستم انبار، لطفاً در تنظیمات سیستم به بخش "مدیریت شرکت‌ها" بروید و تیک "نمایش در انبار" را برای شرکت‌های مورد نظر فعال کنید.</p><div className="flex gap-2"><button onClick={() => window.location.hash = '#settings'} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-lg"><Settings size={20}/><span>رفتن به تنظیمات</span></button></div></div>);

    const years = Array.from({length:10},(_,i)=>1400+i); const months = Array.from({length:12},(_,i)=>i+1); const days = Array.from({length:31},(_,i)=>i+1);

    const canApprove = currentUser.role === UserRole.CEO || currentUser.role === UserRole.ADMIN;

    return (
        <div className="bg-white rounded-2xl shadow-sm border h-[calc(100vh-100px)] flex flex-col overflow-hidden animate-fade-in relative">
            {showPrintStockReport && (<PrintStockReport data={allWarehousesStock} onClose={() => setShowPrintStockReport(false)} />)}

            <div className="hidden-print-export" style={{position:'absolute', top:'-9999px', left:'-9999px'}}>
                {approvedTxForAutoSend && (
                    <>
                        <div id={`print-bijak-${approvedTxForAutoSend.id}-price`} style={{ width: '210mm' }}><PrintBijak tx={approvedTxForAutoSend} onClose={()=>{}} settings={settings} forceHidePrices={false} embed /></div>
                        <div id={`print-bijak-${approvedTxForAutoSend.id}-noprice`} style={{ width: '210mm' }}><PrintBijak tx={approvedTxForAutoSend} onClose={()=>{}} settings={settings} forceHidePrices={true} embed /></div>
                    </>
                )}
                {editedBijakForAutoSend && (
                     <div id={`print-bijak-edit-${editedBijakForAutoSend.id}`} style={{ width: '210mm' }}><PrintBijak tx={editedBijakForAutoSend} onClose={()=>{}} settings={settings} forceHidePrices={false} embed /></div>
                )}
                {deletedTxForAutoSend && (
                    <>
                        <div id={`print-bijak-del-${deletedTxForAutoSend.id}-price`} style={{ width: '210mm' }}><PrintBijak tx={deletedTxForAutoSend} onClose={()=>{}} settings={settings} forceHidePrices={false} embed /></div>
                        <div id={`print-bijak-del-${deletedTxForAutoSend.id}-noprice`} style={{ width: '210mm' }}><PrintBijak tx={deletedTxForAutoSend} onClose={()=>{}} settings={settings} forceHidePrices={true} embed /></div>
                    </>
                )}
                {/* NEW: Hidden element for sending to CEO upon creation */}
                {newBijakForAutoSend && (
                    <div id={`print-bijak-new-${newBijakForAutoSend.id}`} style={{ width: '210mm' }}><PrintBijak tx={newBijakForAutoSend} onClose={()=>{}} settings={settings} forceHidePrices={false} embed /></div>
                )}
            </div>

            <div className="bg-gray-100 p-2 flex gap-2 border-b overflow-x-auto no-print">
                {activeTab === 'approvals' ? (
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
                
                {activeTab === 'reports' && (
                    <WarehouseKardexReport items={items} transactions={transactions} companies={companyList} />
                )}

                {activeTab === 'approvals' && (
                    <div className="space-y-4">
                        <div className="bg-orange-50 p-4 rounded-xl border border-orange-200 flex justify-between items-center">
                            <h3 className="font-bold text-orange-800 flex items-center gap-2"><CheckCircle size={24}/> کارتابل تایید بیجک</h3>
                            <div className="text-sm font-bold text-orange-700 bg-white px-3 py-1 rounded-lg border border-orange-200">تعداد در انتظار: {pendingBijaks.length}</div>
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
                                                {canApprove && (
                                                    <>
                                                        <button onClick={() => handleApproveBijak(tx)} className="bg-green-100 text-green-600 p-2 rounded hover:bg-green-200" title="تایید و ارسال"><CheckCircle size={16}/></button>
                                                        <button onClick={() => handleRejectBijak(tx)} className="bg-red-100 text-red-600 p-2 rounded hover:bg-red-200" title="رد"><XCircle size={16}/></button>
                                                    </>
                                                )}
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
                                    <td className="p-3">
                                        <div className="flex flex-col gap-1">
                                            <span className={`text-[10px] px-2 py-1 rounded font-bold w-fit ${tx.status === 'APPROVED' ? 'bg-green-100 text-green-700' : tx.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-800'}`}>{tx.status === 'APPROVED' ? 'تایید شده' : tx.status === 'REJECTED' ? 'رد شده' : 'در انتظار تایید'}</span>
                                            {tx.status === 'REJECTED' && tx.rejectionReason && (
                                                <span className="text-[10px] text-red-600 truncate max-w-[150px]" title={tx.rejectionReason}>دلیل: {tx.rejectionReason}</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-3 flex gap-2">
                                        <button onClick={() => setViewBijak(tx)} className="text-blue-600 hover:text-blue-800 p-1 flex items-center gap-1"><Eye size={14}/> مشاهده</button>
                                        {(tx.status === 'PENDING' || !tx.status) && canApprove && <button onClick={() => handleApproveBijak(tx)} className="text-green-600 hover:text-green-800 p-1 flex items-center gap-1 bg-green-50 rounded"><CheckCircle size={14}/> تایید</button>}
                                    </td>
                                </tr>
                            )))}</tbody></table>
                        </div>
                    </div>
                )}
                
                {activeTab === 'items' && (<div className="max-w-4xl mx-auto"><div className="bg-gray-50 p-4 rounded-xl border mb-6 flex items-end gap-3 flex-wrap"><div className="flex-1 min-w-[200px] space-y-1"><label className="text-xs font-bold text-gray-500">نام کالا</label><input className="w-full border rounded p-2" value={newItemName} onChange={e=>setNewItemName(e.target.value)}/></div><div className="w-32 space-y-1"><label className="text-xs font-bold text-gray-500">کد کالا</label><input className="w-full border rounded p-2" value={newItemCode} onChange={e=>setNewItemCode(e.target.value)}/></div><div className="w-32 space-y-1"><label className="text-xs font-bold text-gray-500">واحد</label><select className="w-full border rounded p-2 bg-white" value={newItemUnit} onChange={e=>setNewItemUnit(e.target.value)}><option>عدد</option><option>کارتن</option><option>کیلوگرم</option><option>دستگاه</option></select></div><div className="w-32 space-y-1"><label className="text-xs font-bold text-gray-500">گنجایش کانتینر</label><input type="number" className="w-full border rounded p-2 dir-ltr" placeholder="تعداد" value={newItemContainerCapacity} onChange={e=>setNewItemContainerCapacity(e.target.value)}/></div><button onClick={handleAddItem} className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700 h-[42px] w-12 flex items-center justify-center"><Plus/></button></div><div className="bg-white border rounded-xl overflow-hidden"><table className="w-full text-sm text-right"><thead className="bg-gray-100"><tr><th className="p-3">کد</th><th className="p-3">نام کالا</th><th className="p-3">واحد</th><th className="p-3">ظرفیت کانتینر</th><th className="p-3 text-center">عملیات</th></tr></thead><tbody>{items.map(i => (<tr key={i.id} className="border-t hover:bg-gray-50"><td className="p-3 font-mono">{i.code}</td><td className="p-3 font-bold">{i.name}</td><td className="p-3">{i.unit}</td><td className="p-3 font-mono">{i.containerCapacity ? i.containerCapacity : '-'}</td><td className="p-3 text-center"><div className="flex justify-center gap-2"><button onClick={() => setEditingItem(i)} className="text-amber-500 hover:text-amber-700" title="ویرایش"><Edit size={16}/></button><button onClick={()=>handleDeleteItem(i.id)} className="text-red-500 hover:text-red-700" title="حذف"><Trash2 size={16}/></button></div></td></tr>))}</tbody></table></div></div>)}
                {activeTab === 'entry' && (<div className="max-w-4xl mx-auto bg-green-50 p-6 rounded-2xl border border-green-200"><h3 className="font-bold text-green-800 mb-4 flex items-center gap-2"><ArrowDownCircle/> ثبت ورود کالا (رسید انبار)</h3><div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4"><div><label className="block text-xs font-bold mb-1">شرکت مالک</label><select className="w-full border rounded p-2 bg-white" value={selectedCompany} onChange={e=>setSelectedCompany(e.target.value)}><option value="">انتخاب...</option>{companyList.map(c=><option key={c} value={c}>{c}</option>)}</select></div><div><label className="block text-xs font-bold mb-1">شماره پروفرما / سند</label><input className="w-full border rounded p-2 bg-white" value={proformaNumber} onChange={e=>setProformaNumber(e.target.value)}/></div><div><label className="block text-xs font-bold mb-1">تاریخ ورود</label><div className="flex gap-1 dir-ltr"><select className="border rounded p-1 text-sm flex-1" value={txDate.year} onChange={e=>setTxDate({...txDate, year:Number(e.target.value)})}>{years.map(y=><option key={y} value={y}>{y}</option>)}</select><select className="border rounded p-1 text-sm flex-1" value={txDate.month} onChange={e=>setTxDate({...txDate, month:Number(e.target.value)})}>{months.map(m=><option key={m} value={m}>{m}</option>)}</select><select className="border rounded p-1 text-sm flex-1" value={txDate.day} onChange={e=>setTxDate({...txDate, day:Number(e.target.value)})}>{days.map(d=><option key={d} value={d}>{d}</option>)}</select></div></div></div><div className="space-y-2 bg-white p-4 rounded-xl border">{txItems.map((row, idx) => (<div key={idx} className="flex gap-2 items-end"><div className="flex-1"><label className="text-[10px] text-gray-500">کالا</label><select className="w-full border rounded p-2 text-sm" value={row.itemId} onChange={e=>updateTxItem(idx, 'itemId', e.target.value)}><option value="">انتخاب کالا...</option>{items.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select></div><div className="w-20"><label className="text-[10px] text-gray-500">تعداد</label><input type="number" className="w-full border rounded p-2 text-sm dir-ltr" value={row.quantity} onChange={e=>updateTxItem(idx, 'quantity', e.target.value)}/></div><div className="w-20"><label className="text-[10px] text-gray-500">وزن</label><input type="number" className="w-full border rounded p-2 text-sm dir-ltr" value={row.weight} onChange={e=>updateTxItem(idx, 'weight', e.target.value)}/></div><div className="w-32"><label className="text-[10px] text-gray-500">فی (ریال)</label><input type="text" className="w-full border rounded p-2 text-sm dir-ltr font-bold text-blue-600" value={formatNumberString(row.unitPrice)} onChange={e=>updateTxItem(idx, 'unitPrice', deformatNumberString(e.target.value))}/></div>{idx > 0 && <button onClick={()=>handleRemoveTxItemRow(idx)} className="text-red-500 p-2"><Trash2 size={16}/></button>}</div>))}<button onClick={handleAddTxItemRow} className="text-xs text-blue-600 font-bold flex items-center gap-1 mt-2"><Plus size={14}/> افزودن ردیف کالا</button></div><button onClick={()=>handleSubmitTx('IN')} className="w-full bg-green-600 text-white font-bold py-3 rounded-xl mt-4 hover:bg-green-700 shadow-lg">ثبت رسید انبار</button></div>)}
                
                {activeTab === 'exit' && (
                    <div className="max-w-4xl mx-auto bg-red-50 p-6 rounded-2xl border border-red-200">
                        <h3 className="font-bold text-red-800 mb-4 flex items-center gap-2"><ArrowUpCircle/> ثبت خروج کالا (صدور بیجک)</h3>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4"><div><label className="block text-xs font-bold mb-1">شرکت فرستنده</label><select className="w-full border rounded p-2 bg-white" value={selectedCompany} onChange={e=>setSelectedCompany(e.target.value)}><option value="">انتخاب...</option>{companyList.map(c=><option key={c} value={c}>{c}</option>)}</select></div><div><label className="block text-xs font-bold mb-1">شماره بیجک (سیستمی)</label><div className="bg-white p-2 rounded border font-mono text-center text-red-600 font-bold">{nextBijakNum > 0 ? nextBijakNum : '---'}</div></div><div><label className="block text-xs font-bold mb-1">تاریخ خروج</label><div className="flex gap-1 dir-ltr"><select className="border rounded p-1 text-sm flex-1" value={txDate.year} onChange={e=>setTxDate({...txDate, year:Number(e.target.value)})}>{years.map(y=><option key={y} value={y}>{y}</option>)}</select><select className="border rounded p-1 text-sm flex-1" value={txDate.month} onChange={e=>setTxDate({...txDate, month:Number(e.target.value)})}>{months.map(m=><option key={m} value={m}>{m}</option>)}</select><select className="border rounded p-1 text-sm flex-1" value={txDate.day} onChange={e=>setTxDate({...txDate, day:Number(e.target.value)})}>{days.map(d=><option key={d} value={d}>{d}</option>)}</select></div></div><div><label className="block text-xs font-bold mb-1">تحویل گیرنده</label><input className="w-full border rounded p-2 bg-white" value={recipientName} onChange={e=>setRecipientName(e.target.value)}/></div></div><div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4"><div><label className="block text-xs font-bold mb-1">راننده</label><input className="w-full border rounded p-2 bg-white" value={driverName} onChange={e=>setDriverName(e.target.value)}/></div><div><label className="block text-xs font-bold mb-1">پلاک</label><input className="w-full border rounded p-2 bg-white dir-ltr" value={plateNumber} onChange={e=>setPlateNumber(e.target.value)}/></div><div><label className="block text-xs font-bold mb-1">مقصد</label><input className="w-full border rounded p-2 bg-white" value={destination} onChange={e=>setDestination(e.target.value)}/></div></div><div className="space-y-2 bg-white p-4 rounded-xl border">{txItems.map((row, idx) => (<div key={idx} className="flex gap-2 items-end"><div className="flex-1"><label className="text-[10px] text-gray-500">کالا</label><select className="w-full border rounded p-2 text-sm" value={row.itemId} onChange={e=>updateTxItem(idx, 'itemId', e.target.value)}><option value="">انتخاب...</option>{items.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select></div><div className="w-20"><label className="text-[10px] text-gray-500">تعداد</label><input type="number" className="w-full border rounded p-2 text-sm dir-ltr" value={row.quantity} onChange={e=>updateTxItem(idx, 'quantity', e.target.value)}/></div><div className="w-20"><label className="text-[10px] text-gray-500">وزن</label><input type="number" className="w-full border rounded p-2 text-sm dir-ltr" value={row.weight} onChange={e=>updateTxItem(idx, 'weight', e.target.value)}/></div><div className="w-32"><label className="text-[10px] text-gray-500">فی (ریال)</label><input type="text" className="w-full border rounded p-2 text-sm dir-ltr font-bold text-blue-600" value={formatNumberString(row.unitPrice)} onChange={e=>updateTxItem(idx, 'unitPrice', deformatNumberString(e.target.value))}/></div>{idx > 0 && <button onClick={()=>handleRemoveTxItemRow(idx)} className="text-red-500 p-2"><Trash2 size={16}/></button>}</div>))}<button onClick={handleAddTxItemRow} className="text-xs text-blue-600 font-bold flex items-center gap-1 mt-2"><Plus size={14}/> افزودن ردیف کالا</button></div>
                        <div className="pt-4 border-t">
                            <button onClick={() => handleSubmitTx('OUT')} className="w-full bg-red-600 text-white font-bold py-3 rounded-xl hover:bg-red-700 shadow-lg">ثبت و صدور بیجک</button>
                        </div>
                    </div>
                )}
                </div>
        </div>
    );
};

export default WarehouseModule;
