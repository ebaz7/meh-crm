import React, { useState, useEffect, useRef } from 'react';
import { User, SecurityLog, PersonnelDelay, SecurityIncident, SecurityStatus, UserRole, DailySecurityMeta, SystemSettings } from '../types';
import { getSecurityLogs, saveSecurityLog, updateSecurityLog, getPersonnelDelays, savePersonnelDelay, updatePersonnelDelay, getSecurityIncidents, saveSecurityIncident, updateSecurityIncident, getSettings, saveSettings } from '../services/storageService';
import { generateUUID, getCurrentShamsiDate, jalaliToGregorian, formatDate, getShamsiDateFromIso } from '../constants';
import { Shield, Plus, CheckCircle, XCircle, Clock, Truck, AlertTriangle, UserCheck, Calendar, Printer, Archive, FileSymlink, Edit, Trash2, Eye, FileText, CheckSquare, User as UserIcon, ListChecks, Activity, FileDown, Loader2, Pencil } from 'lucide-react';
import { PrintSecurityDailyLog, PrintPersonnelDelay, PrintIncidentReport } from './security/SecurityPrints';
import { getRolePermissions } from '../services/authService';

interface Props {
    currentUser: User;
}

const SecurityModule: React.FC<Props> = ({ currentUser }) => {
    const [activeTab, setActiveTab] = useState<'logs' | 'delays' | 'incidents' | 'cartable' | 'archive' | 'in_progress'>('logs');
    
    const currentShamsi = getCurrentShamsiDate();
    const [selectedDate, setSelectedDate] = useState({ year: currentShamsi.year, month: currentShamsi.month, day: currentShamsi.day });

    const [logs, setLogs] = useState<SecurityLog[]>([]);
    const [delays, setDelays] = useState<PersonnelDelay[]>([]);
    const [incidents, setIncidents] = useState<SecurityIncident[]>([]);
    const [settings, setSettings] = useState<SystemSettings | null>(null);
    
    const [showModal, setShowModal] = useState(false);
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [showShiftModal, setShowShiftModal] = useState(false);
    const [printTarget, setPrintTarget] = useState<any>(null);
    
    const [viewCartableItem, setViewCartableItem] = useState<any>(null);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    // Edit/New State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [logForm, setLogForm] = useState<Partial<SecurityLog>>({});
    const [delayForm, setDelayForm] = useState<Partial<PersonnelDelay>>({});
    const [incidentForm, setIncidentForm] = useState<Partial<SecurityIncident>>({});

    // Shift Meta Form State
    const [metaForm, setMetaForm] = useState<DailySecurityMeta>({});

    // Permissions
    const permissions = settings ? getRolePermissions(currentUser.role, settings, currentUser) : null;

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const [l, d, i, s] = await Promise.all([getSecurityLogs(), getPersonnelDelays(), getSecurityIncidents(), getSettings()]);
            setLogs(l || []);
            setDelays(d || []);
            setIncidents(i || []);
            setSettings(s);
        } catch(e) { console.error(e); }
    };

    const getIsoSelectedDate = () => {
        try {
            const d = jalaliToGregorian(selectedDate.year, selectedDate.month, selectedDate.day);
            return d.toISOString().split('T')[0];
        } catch { return new Date().toISOString().split('T')[0]; }
    };

    // Load meta for selected date when date changes
    useEffect(() => {
        const isoDate = getIsoSelectedDate();
        if (settings?.dailySecurityMeta && settings.dailySecurityMeta[isoDate]) {
            setMetaForm(settings.dailySecurityMeta[isoDate]);
        } else {
            setMetaForm({ 
                dailyDescription: '',
                morningGuard: { name: '', entry: '', exit: '' },
                eveningGuard: { name: '', entry: '', exit: '' },
                nightGuard: { name: '', entry: '', exit: '' }
            });
        }
    }, [selectedDate, settings]);

    // --- UX HELPERS ---
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const form = e.currentTarget.closest('form');
            if (form) {
                const elements = Array.from(form.querySelectorAll('input, select, textarea')) as HTMLElement[];
                const index = elements.indexOf(e.currentTarget as HTMLElement);
                const nextElement = elements[index + 1];
                if (nextElement) nextElement.focus();
            }
        }
    };

    const formatTime = (val: string) => {
        const clean = val.replace(/\D/g, '');
        if (clean.length === 3) return `0${clean[0]}:${clean.slice(1)}`;
        if (clean.length >= 4) return `${clean.slice(0,2)}:${clean.slice(2,4)}`;
        return val; 
    };

    const handleTimeChange = (field: string, formSetter: any, currentForm: any) => (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value;
        if (val.length === 4 && !val.includes(':') && /^\d+$/.test(val)) {
             val = `${val.slice(0,2)}:${val.slice(2)}`;
        }
        formSetter({ ...currentForm, [field]: val });
    };

    const handleTimeBlur = (field: string, formSetter: any, currentForm: any) => (e: React.FocusEvent<HTMLInputElement>) => {
        const val = e.target.value;
        const formatted = formatTime(val);
        if (formatted !== val) {
            formSetter({ ...currentForm, [field]: formatted });
        }
    };

    const setMyName = (shift: 'morning' | 'evening' | 'night') => {
        const guardKey = shift === 'morning' ? 'morningGuard' : shift === 'evening' ? 'eveningGuard' : 'nightGuard';
        setMetaForm({
            ...metaForm,
            [guardKey]: { ...metaForm[guardKey]!, name: currentUser.fullName }
        });
    };

    // --- PERMISSION LOGIC ---
    const canEdit = (item: any) => {
        if (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.CEO) return true;
        if (item.status === SecurityStatus.ARCHIVED) return false;
        if (item.status === SecurityStatus.REJECTED) return item.registrant === currentUser.fullName;
        if (currentUser.role === UserRole.SECURITY_GUARD || currentUser.role === UserRole.SECURITY_HEAD) return item.status === SecurityStatus.PENDING_SUPERVISOR;
        if (currentUser.role === UserRole.FACTORY_MANAGER) return item.status === SecurityStatus.PENDING_FACTORY || item.status === SecurityStatus.APPROVED_FACTORY_CHECK || item.status === SecurityStatus.PENDING_CEO;
        return false;
    };

    const canDelete = (item: any) => {
        if (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.CEO) return true;
        if (item.status === SecurityStatus.ARCHIVED) return false;
        if (item.registrant === currentUser.fullName) {
            if (currentUser.role === UserRole.SECURITY_GUARD && item.status !== SecurityStatus.PENDING_SUPERVISOR && item.status !== SecurityStatus.REJECTED) return false;
            return true;
        }
        return false;
    };

    const resetDailyApprovalIfNeeded = async (date: string, type: 'log' | 'delay') => {
        if (currentUser.role === UserRole.CEO || currentUser.role === UserRole.ADMIN) return;
        if (!settings) return;
        const currentMeta = (settings.dailySecurityMeta || {})[date];
        if (!currentMeta) return;

        let needsUpdate = false;
        let updatedMeta = { ...currentMeta };

        if (type === 'log') {
            if (updatedMeta.isFactoryDailyApproved || updatedMeta.isCeoDailyApproved) {
                updatedMeta.isFactoryDailyApproved = false;
                updatedMeta.isCeoDailyApproved = false;
                needsUpdate = true;
            }
        } else if (type === 'delay') {
            if (updatedMeta.isDelaySupervisorApproved || updatedMeta.isDelayFactoryApproved || updatedMeta.isDelayCeoApproved) {
                updatedMeta.isDelaySupervisorApproved = false;
                updatedMeta.isDelayFactoryApproved = false;
                updatedMeta.isDelayCeoApproved = false;
                needsUpdate = true;
            }
        }

        if (needsUpdate) {
            const newDailyMeta = { ...settings.dailySecurityMeta, [date]: updatedMeta };
            await saveSettings({ ...settings, dailySecurityMeta: newDailyMeta });
            setSettings(prev => prev ? ({...prev, dailySecurityMeta: newDailyMeta}) : null);
            setMetaForm(updatedMeta);
        }
    };

    // --- DATA FILTERING ---
    const dailyLogs = logs.filter(l => l.date.startsWith(getIsoSelectedDate()) && l.status !== SecurityStatus.ARCHIVED);
    const dailyDelays = delays.filter(d => d.date.startsWith(getIsoSelectedDate()) && d.status !== SecurityStatus.ARCHIVED);
    
    const getCartableItems = () => {
        const role = currentUser.role;
        const allPending: any[] = [];
        
        if (role === UserRole.CEO || role === UserRole.ADMIN) {
            const ceoLogs = logs.filter(l => l.status === SecurityStatus.PENDING_CEO);
            const ceoDelays = delays.filter(d => d.status === SecurityStatus.PENDING_CEO);
            const groupedByDate: Record<string, {count: number, type: 'daily_approval', date: string, category: 'log' | 'delay'}> = {};
            
            ceoLogs.forEach(l => {
                if (!groupedByDate[`log_${l.date}`]) groupedByDate[`log_${l.date}`] = { count: 0, type: 'daily_approval', date: l.date, category: 'log' };
                groupedByDate[`log_${l.date}`].count++;
            });
            ceoDelays.forEach(d => {
                if (!groupedByDate[`delay_${d.date}`]) groupedByDate[`delay_${d.date}`] = { count: 0, type: 'daily_approval', date: d.date, category: 'delay' };
                groupedByDate[`delay_${d.date}`].count++;
            });

            Object.values(groupedByDate).forEach(group => allPending.push(group));
            incidents.filter(i => i.status === SecurityStatus.PENDING_CEO).forEach(i => allPending.push({...i, type: 'incident'}));
            
            if (role === UserRole.ADMIN) {
                 logs.filter(l => (l.status === SecurityStatus.PENDING_SUPERVISOR || l.status === SecurityStatus.PENDING_FACTORY || l.status === SecurityStatus.APPROVED_FACTORY_CHECK)).forEach(l => allPending.push({...l, type: 'log'}));
                 delays.filter(d => (d.status === SecurityStatus.PENDING_SUPERVISOR || d.status === SecurityStatus.APPROVED_SUPERVISOR_CHECK || d.status === SecurityStatus.PENDING_FACTORY)).forEach(d => allPending.push({...d, type: 'delay'}));
            }
        } else {
            const check = (item: any, type: string) => {
                const isSupervisor = role === UserRole.SECURITY_HEAD || (permissions && permissions.canApproveSecuritySupervisor);
                if (isSupervisor) {
                    if (item.status === SecurityStatus.PENDING_SUPERVISOR) allPending.push({ ...item, type });
                    if (type === 'delay' && item.status === SecurityStatus.APPROVED_SUPERVISOR_CHECK) allPending.push({ ...item, type });
                } 
                else if (role === UserRole.FACTORY_MANAGER && (item.status === SecurityStatus.PENDING_FACTORY || item.status === SecurityStatus.APPROVED_FACTORY_CHECK)) {
                    allPending.push({ ...item, type });
                }
            };
            logs.forEach(l => check(l, 'log'));
            delays.forEach(d => check(d, 'delay'));
            incidents.forEach(i => check(i, 'incident'));
        }
        return allPending;
    };

    const getInProgressItems = () => {
        const allActive: any[] = [];
        const checkActive = (item: any, type: string) => {
            if (item.status !== SecurityStatus.ARCHIVED && item.status !== SecurityStatus.REJECTED) allActive.push({ ...item, type });
        };
        logs.forEach(l => checkActive(l, 'log'));
        delays.forEach(d => checkActive(d, 'delay'));
        incidents.forEach(i => checkActive(i, 'incident'));
        return allActive.sort((a,b) => b.createdAt - a.createdAt);
    };

    const getArchivedItems = () => {
        const archivedLogs = logs.filter(l => l.status === SecurityStatus.ARCHIVED);
        const archivedDelays = delays.filter(d => d.status === SecurityStatus.ARCHIVED);
        const groupedDatesLogs = new Set<string>(archivedLogs.map(l => l.date));
        const groupedDatesDelays = new Set<string>(archivedDelays.map(d => d.date));
        const archiveGroups: any[] = [];
        
        groupedDatesLogs.forEach(date => {
            archiveGroups.push({ date, type: 'daily_archive', category: 'log', count: archivedLogs.filter(l => l.date === date).length });
        });
        groupedDatesDelays.forEach(date => {
            archiveGroups.push({ date, type: 'daily_archive', category: 'delay', count: archivedDelays.filter(d => d.date === date).length });
        });
        incidents.filter(i => i.status === SecurityStatus.ARCHIVED).forEach(i => archiveGroups.push({...i, type: 'incident'}));
        return archiveGroups.sort((a,b) => (b.date || '').localeCompare(a.date || ''));
    };

    // --- ACTIONS ---
    const handleSaveLog = async () => {
        let statusToSave = SecurityStatus.PENDING_SUPERVISOR;
        if (editingId) {
             const originalItem = logs.find(l => l.id === editingId);
             if (originalItem) statusToSave = originalItem.status;
        }
        const isoDate = getIsoSelectedDate();
        await resetDailyApprovalIfNeeded(isoDate, 'log');
        const newLog: SecurityLog = {
            id: editingId || generateUUID(),
            rowNumber: editingId ? logForm.rowNumber! : dailyLogs.length + 1,
            date: isoDate,
            shift: logForm.shift || 'صبح',
            origin: logForm.origin || '',
            entryTime: logForm.entryTime || '',
            exitTime: logForm.exitTime || '',
            driverName: logForm.driverName || '',
            plateNumber: logForm.plateNumber || '',
            goodsName: logForm.goodsName || '',
            quantity: logForm.quantity || '',
            destination: logForm.destination || '',
            receiver: logForm.receiver || '',
            workDescription: logForm.workDescription || '',
            permitProvider: logForm.permitProvider || '',
            registrant: editingId ? logForm.registrant! : currentUser.fullName, 
            status: statusToSave,
            createdAt: editingId ? logForm.createdAt! : Date.now()
        };
        if (editingId) await updateSecurityLog(newLog); else await saveSecurityLog(newLog);
        resetForms(); loadData();
    };

    const handleSaveDelay = async () => {
        let statusToSave = SecurityStatus.PENDING_SUPERVISOR;
        if (editingId) {
             const originalItem = delays.find(d => d.id === editingId);
             if (originalItem) statusToSave = originalItem.status;
        }
        const isoDate = getIsoSelectedDate();
        await resetDailyApprovalIfNeeded(isoDate, 'delay');
        const newDelay: PersonnelDelay = {
            id: editingId || generateUUID(),
            date: isoDate,
            personnelName: delayForm.personnelName || '',
            unit: delayForm.unit || '',
            arrivalTime: delayForm.arrivalTime || '',
            delayAmount: delayForm.delayAmount || '',
            repeatCount: delayForm.repeatCount || '', 
            instruction: delayForm.instruction || '', 
            registrant: editingId ? delayForm.registrant! : currentUser.fullName,
            status: statusToSave,
            createdAt: editingId ? delayForm.createdAt! : Date.now()
        };
        if (editingId) await updatePersonnelDelay(newDelay); else await savePersonnelDelay(newDelay);
        resetForms(); loadData();
    };

    const handleSaveIncident = async () => {
        let statusToSave = editingId ? incidentForm.status! : SecurityStatus.PENDING_SUPERVISOR;
        const newInc: SecurityIncident = {
            id: editingId || generateUUID(),
            reportNumber: editingId ? incidentForm.reportNumber! : (incidents.length + 100).toString(),
            date: getIsoSelectedDate(),
            subject: incidentForm.subject || '',
            description: incidentForm.description || '',
            shift: incidentForm.shift || 'صبح',
            registrant: editingId ? incidentForm.registrant! : currentUser.fullName,
            witnesses: incidentForm.witnesses,
            status: statusToSave,
            createdAt: editingId ? incidentForm.createdAt! : Date.now()
        };
        if (editingId) await updateSecurityIncident(newInc); else await saveSecurityIncident(newInc);
        resetForms(); loadData();
    };

    const handleSaveShiftMeta = async () => {
        if (!settings) return;
        const isoDate = getIsoSelectedDate();
        const updatedMeta = { ...(settings.dailySecurityMeta || {}), [isoDate]: metaForm };
        await saveSettings({ ...settings, dailySecurityMeta: updatedMeta });
        setSettings({ ...settings, dailySecurityMeta: updatedMeta });
        setShowShiftModal(false);
        alert('ذخیره شد.');
    };

    const resetForms = () => { setShowModal(false); setEditingId(null); setLogForm({}); setDelayForm({}); setIncidentForm({}); };
    const handleEditItem = (item: any, type: 'log' | 'delay' | 'incident') => { setEditingId(item.id); if (type === 'log') setLogForm(item); else if (type === 'delay') setDelayForm(item); else setIncidentForm(item); setActiveTab(type === 'log' ? 'logs' : type === 'delay' ? 'delays' : 'incidents'); setShowModal(true); };
    const handleDeleteItem = async (id: string, type: 'log' | 'delay' | 'incident') => { if (!confirm('حذف شود؟')) return; if (type === 'log') await updateSecurityLog({ ...logs.find(l=>l.id===id)!, status: SecurityStatus.REJECTED } as any); else if (type === 'delay') await updatePersonnelDelay({ ...delays.find(d=>d.id===id)!, status: SecurityStatus.REJECTED } as any); else if (type === 'incident') await updateSecurityIncident({ ...incidents.find(i=>i.id===id)!, status: SecurityStatus.REJECTED } as any); loadData(); };

    const handleApprove = async (item: any) => {
        if (item.type === 'daily_approval') {
            if (!confirm('آیا تایید نهایی و بایگانی می‌کنید؟')) return;
            const date = item.date;
            const category = item.category;
            if (settings) {
                const currentMeta = (settings.dailySecurityMeta || {})[date] || {};
                const updatedMeta = { ...currentMeta };
                if (category === 'log') updatedMeta.isCeoDailyApproved = true;
                else updatedMeta.isDelayCeoApproved = true;
                await saveSettings({ ...settings, dailySecurityMeta: { ...settings.dailySecurityMeta, [date]: updatedMeta } });
            }
            if (category === 'log') {
                const logsToApprove = logs.filter(l => l.date === date && l.status === SecurityStatus.PENDING_CEO);
                for (const log of logsToApprove) await updateSecurityLog({ ...log, status: SecurityStatus.ARCHIVED, approverCeo: currentUser.fullName });
            } else if (category === 'delay') {
                const delaysToApprove = delays.filter(d => d.date === date && d.status === SecurityStatus.PENDING_CEO);
                for (const delay of delaysToApprove) await updatePersonnelDelay({ ...delay, status: SecurityStatus.ARCHIVED, approverCeo: currentUser.fullName });
            }
            setViewCartableItem(null); loadData(); return;
        }

        const isSupervisor = currentUser.role === UserRole.SECURITY_HEAD || (permissions && permissions.canApproveSecuritySupervisor);
        if (item.type === 'delay' && isSupervisor && item.status === SecurityStatus.PENDING_SUPERVISOR) {
            await updatePersonnelDelay({ ...item, status: SecurityStatus.APPROVED_SUPERVISOR_CHECK, approverSupervisor: currentUser.fullName });
            loadData(); return;
        }
        if ((currentUser.role === UserRole.FACTORY_MANAGER || currentUser.role === UserRole.ADMIN) && item.status === SecurityStatus.PENDING_FACTORY) {
            const updates = { status: SecurityStatus.APPROVED_FACTORY_CHECK, approverFactory: currentUser.fullName };
            if (item.type === 'log') await updateSecurityLog({ ...item, ...updates }); else if (item.type === 'delay') await updatePersonnelDelay({ ...item, ...updates });
            loadData(); return;
        }
        if (item.type === 'log' && isSupervisor && item.status === SecurityStatus.PENDING_SUPERVISOR) {
            await updateSecurityLog({ ...item, status: SecurityStatus.PENDING_FACTORY, approverSupervisor: currentUser.fullName });
            setViewCartableItem(null); loadData();
        }
    };

    const handleSupervisorDelaySubmit = async () => {
        const readyDelays = delays.filter(d => d.status === SecurityStatus.APPROVED_SUPERVISOR_CHECK);
        if (readyDelays.length === 0) return;
        const datesToApprove = new Set<string>(readyDelays.map(d => d.date));
        if (settings) {
            const newMeta: Record<string, DailySecurityMeta> = { ...settings.dailySecurityMeta };
            datesToApprove.forEach(date => { newMeta[date] = { ...newMeta[date], isDelaySupervisorApproved: true }; });
            await saveSettings({ ...settings, dailySecurityMeta: newMeta });
        }
        for (const delay of readyDelays) await updatePersonnelDelay({ ...delay, status: SecurityStatus.PENDING_FACTORY });
        loadData();
    };

    const handleFactoryDailySubmit = async () => {
        const readyLogs = logs.filter(l => l.status === SecurityStatus.APPROVED_FACTORY_CHECK);
        const readyDelays = delays.filter(d => d.status === SecurityStatus.APPROVED_FACTORY_CHECK);
        if (readyLogs.length === 0 && readyDelays.length === 0) return;
        const logDates = new Set<string>(readyLogs.map(l => l.date));
        const delayDates = new Set<string>(readyDelays.map(d => d.date));
        if (settings) {
            const newMeta: Record<string, DailySecurityMeta> = { ...settings.dailySecurityMeta };
            logDates.forEach(date => { newMeta[date] = { ...newMeta[date], isFactoryDailyApproved: true }; });
            delayDates.forEach(date => { newMeta[date] = { ...newMeta[date], isDelayFactoryApproved: true }; });
            await saveSettings({ ...settings, dailySecurityMeta: newMeta });
        }
        for (const log of readyLogs) await updateSecurityLog({ ...log, status: SecurityStatus.PENDING_CEO });
        for (const delay of readyDelays) await updatePersonnelDelay({ ...delay, status: SecurityStatus.PENDING_CEO });
        loadData();
    };

    const handleReject = async (item: any) => {
        const reason = prompt("دلیل رد:");
        if (reason) {
            const updates = { status: SecurityStatus.REJECTED, rejectionReason: reason };
            if (item.type === 'log') await updateSecurityLog({ ...item, ...updates }); else if (item.type === 'delay') await updatePersonnelDelay({ ...item, ...updates }); else await updateSecurityIncident({ ...item, ...updates });
            setViewCartableItem(null); loadData();
        }
    };

    const handleDownloadPDF = async () => {
        setIsGeneratingPdf(true);
        const element = document.getElementById('printable-area-view'); 
        if (!element) { setIsGeneratingPdf(false); return; }
        try {
            // @ts-ignore
            const canvas = await window.html2canvas(element, { scale: 2, backgroundColor: '#ffffff', useCORS: true, windowWidth: 1200 });
            const imgData = canvas.toDataURL('image/png');
            // @ts-ignore
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('l', 'mm', 'a4');
            pdf.addImage(imgData, 'PNG', 0, 0, 297, (canvas.height * 297) / canvas.width);
            pdf.save(`Security_Report.pdf`);
        } catch (e) { console.error(e); } finally { setIsGeneratingPdf(false); }
    };

    const DateFilter = () => (
        <div className="flex gap-1 items-center bg-gray-100 p-1 rounded-lg border border-gray-200">
            <Calendar size={16} className="text-gray-500 ml-1"/>
            <select className="bg-transparent text-sm p-1 outline-none" value={selectedDate.day} onChange={e=>setSelectedDate({...selectedDate, day: +e.target.value})}>{Array.from({length:31},(_,i)=>i+1).map(d=><option key={d} value={d}>{d}</option>)}</select>
            <select className="bg-transparent text-sm p-1 outline-none" value={selectedDate.month} onChange={e=>setSelectedDate({...selectedDate, month: +e.target.value})}>{Array.from({length:12},(_,i)=>i+1).map(m=><option key={m} value={m}>{m}</option>)}</select>
            <select className="bg-transparent text-sm p-1 outline-none" value={selectedDate.year} onChange={e=>setSelectedDate({...selectedDate, year: +e.target.value})}>{Array.from({length:5},(_,i)=>1402+i).map(y=><option key={y} value={y}>{y}</option>)}</select>
        </div>
    );

    return (
        <div className="p-4 md:p-6 bg-gray-5 h-[calc(100vh-100px)] overflow-y-auto animate-fade-in relative">
            {showPrintModal && printTarget && (
                <div className="fixed inset-0 bg-black/80 z-[100] flex flex-col items-center justify-center p-4">
                    <div className="bg-white p-4 rounded-xl mb-4 flex gap-4 no-print"><button onClick={() => window.print()} className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2"><Printer size={16}/> چاپ</button><button onClick={() => setShowPrintModal(false)} className="bg-gray-200 px-4 py-2 rounded">بستن</button></div>
                    <div className="overflow-auto bg-gray-200 p-4 rounded max-h-[80vh]"><div className="scale-75 origin-top">{printTarget.type === 'daily_log' && <PrintSecurityDailyLog date={printTarget.date} logs={printTarget.logs} meta={printTarget.meta} />}{printTarget.type === 'daily_delay' && <PrintPersonnelDelay delays={printTarget.delays} meta={printTarget.meta} />}</div></div>
                </div>
            )}

            {showShiftModal && (
                <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4 border-b pb-2"><h3 className="font-bold text-lg">اطلاعات شیفت ({formatDate(getIsoSelectedDate())})</h3><button onClick={() => setShowShiftModal(false)} className="text-gray-400"><XCircle size={24}/></button></div>
                        <div className="space-y-4">
                            <div className="bg-blue-50 p-3 rounded border border-blue-100"><div className="flex justify-between items-center mb-2"><h4 className="font-bold text-sm">شیفت صبح</h4><button onClick={() => setMyName('morning')} className="text-[10px] bg-white border px-2 py-1 rounded hover:bg-blue-50">نام من</button></div><div className="flex gap-2"><input className="flex-1 border rounded p-2 text-sm" placeholder="نگهبان" value={metaForm.morningGuard?.name} onChange={e => setMetaForm({...metaForm, morningGuard: {...metaForm.morningGuard!, name: e.target.value}})}/><input className="w-20 border rounded p-2 text-sm text-center" value={metaForm.morningGuard?.entry} onChange={handleTimeChange('entry', (val: any) => setMetaForm({...metaForm, morningGuard: {...metaForm.morningGuard!, entry: val.entry}}), metaForm.morningGuard!)}/><input className="w-20 border rounded p-2 text-sm text-center" value={metaForm.morningGuard?.exit} onChange={handleTimeChange('exit', (val: any) => setMetaForm({...metaForm, morningGuard: {...metaForm.morningGuard!, exit: val.exit}}), metaForm.morningGuard!)}/></div></div>
                            <div className="bg-orange-50 p-3 rounded border border-orange-100"><div className="flex justify-between items-center mb-2"><h4 className="font-bold text-sm">شیفت عصر</h4><button onClick={() => setMyName('evening')} className="text-[10px] bg-white border px-2 py-1 rounded hover:bg-orange-50">نام من</button></div><div className="flex gap-2"><input className="flex-1 border rounded p-2 text-sm" placeholder="نگهبان" value={metaForm.eveningGuard?.name} onChange={e => setMetaForm({...metaForm, eveningGuard: {...metaForm.eveningGuard!, name: e.target.value}})}/><input className="w-20 border rounded p-2 text-sm text-center" value={metaForm.eveningGuard?.entry} onChange={handleTimeChange('entry', (val: any) => setMetaForm({...metaForm, eveningGuard: {...metaForm.eveningGuard!, entry: val.entry}}), metaForm.eveningGuard!)}/><input className="w-20 border rounded p-2 text-sm text-center" value={metaForm.eveningGuard?.exit} onChange={handleTimeChange('exit', (val: any) => setMetaForm({...metaForm, eveningGuard: {...metaForm.eveningGuard!, exit: val.exit}}), metaForm.eveningGuard!)}/></div></div>
                            <div className="bg-indigo-50 p-3 rounded border border-indigo-100"><div className="flex justify-between items-center mb-2"><h4 className="font-bold text-sm">شیفت شب</h4><button onClick={() => setMyName('night')} className="text-[10px] bg-white border px-2 py-1 rounded hover:bg-indigo-50">نام من</button></div><div className="flex gap-2"><input className="flex-1 border rounded p-2 text-sm" placeholder="نگهبان" value={metaForm.nightGuard?.name} onChange={e => setMetaForm({...metaForm, nightGuard: {...metaForm.nightGuard!, name: e.target.value}})}/><input className="w-20 border rounded p-2 text-sm text-center" value={metaForm.nightGuard?.entry} onChange={handleTimeChange('entry', (val: any) => setMetaForm({...metaForm, nightGuard: {...metaForm.nightGuard!, entry: val.entry}}), metaForm.nightGuard!)}/><input className="w-20 border rounded p-2 text-sm text-center" value={metaForm.nightGuard?.exit} onChange={handleTimeChange('exit', (val: any) => setMetaForm({...metaForm, nightGuard: {...metaForm.nightGuard!, exit: val.exit}}), metaForm.nightGuard!)}/></div></div>
                            <div className="bg-gray-50 p-3 rounded border"><label className="text-sm font-bold block mb-1">توضیحات تکمیلی روزانه</label><textarea className="w-full border rounded p-2 text-sm h-32 resize-none" value={metaForm.dailyDescription} onChange={e => setMetaForm({...metaForm, dailyDescription: e.target.value})} /></div>
                            <button onClick={handleSaveShiftMeta} className="w-full bg-green-600 text-white py-3 rounded-lg font-bold">ذخیره</button>
                        </div>
                    </div>
                </div>
            )}

            {viewCartableItem && (
                <div className="fixed inset-0 bg-black/80 z-[100] flex flex-col items-center justify-center p-4">
                    <div className="bg-white p-4 rounded-xl mb-4 flex gap-4 no-print w-full max-w-2xl justify-between items-center">
                        <div className="font-bold text-lg">بررسی گزارش</div>
                        <div className="flex gap-2">
                             <button onClick={() => window.print()} className="bg-blue-600 text-white px-4 py-2 rounded font-bold flex items-center gap-2 shadow"><Printer size={18}/> چاپ</button>
                             <button onClick={handleDownloadPDF} disabled={isGeneratingPdf} className="bg-red-600 text-white px-4 py-2 rounded font-bold flex items-center gap-2 shadow">{isGeneratingPdf ? <Loader2 size={18} className="animate-spin"/> : <FileDown size={18}/>} PDF</button>
                            {viewCartableItem.mode !== 'view_only' && (
                                <><button onClick={() => handleApprove(viewCartableItem)} className="bg-green-600 text-white px-6 py-2 rounded font-bold shadow">تایید</button><button onClick={() => handleReject(viewCartableItem)} className="bg-red-600 text-white px-6 py-2 rounded font-bold shadow">رد</button></>
                            )}
                            <button onClick={() => setViewCartableItem(null)} className="bg-gray-200 px-4 py-2 rounded">بستن</button>
                        </div>
                    </div>
                    <div className="overflow-auto bg-gray-200 p-4 rounded max-h-[80vh] w-full max-w-5xl flex justify-center"><div className="scale-75 origin-top"><div id="printable-area-view" className="bg-white shadow-lg">{(viewCartableItem.type === 'daily_approval' || viewCartableItem.type === 'daily_archive') && viewCartableItem.category === 'log' && <PrintSecurityDailyLog date={viewCartableItem.date} logs={logs.filter(l => l.date === viewCartableItem.date)} meta={(settings?.dailySecurityMeta || {})[String(viewCartableItem.date)]}/>}{(viewCartableItem.type === 'daily_approval' || viewCartableItem.type === 'daily_archive') && viewCartableItem.category === 'delay' && <PrintPersonnelDelay delays={delays.filter(d => d.date === viewCartableItem.date)} meta={(settings?.dailySecurityMeta || {})[String(viewCartableItem.date)]}/>}{viewCartableItem.type === 'log' && <PrintSecurityDailyLog date={viewCartableItem.date} logs={logs.filter(l => l.date === viewCartableItem.date)} meta={(settings?.dailySecurityMeta || {})[String(viewCartableItem.date)]}/>}{viewCartableItem.type === 'delay' && <PrintPersonnelDelay delays={delays.filter(d => d.date === viewCartableItem.date)} meta={(settings?.dailySecurityMeta || {})[String(viewCartableItem.date)]}/>}{viewCartableItem.type === 'incident' && <PrintIncidentReport incident={viewCartableItem}/>}</div></div></div>
                </div>
            )}

            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-4">
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Shield className="text-blue-600"/> واحد انتظامات</h1>
                <div className="flex flex-wrap gap-2 items-center w-full xl:w-auto">
                    {(activeTab === 'logs' || activeTab === 'delays') && (<div className="flex gap-2"><button onClick={() => setShowShiftModal(true)} className="bg-white border text-gray-700 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1"><FileText size={16}/> اطلاعات شیفت</button><DateFilter /></div>)}
                    <div className="flex bg-white p-1 rounded-xl shadow-sm border overflow-x-auto"><button onClick={() => setActiveTab('logs')} className={`px-3 py-2 rounded-lg text-xs font-bold ${activeTab === 'logs' ? 'bg-blue-600 text-white' : 'text-gray-600'}`}>گزارش نگهبانی</button><button onClick={() => setActiveTab('delays')} className={`px-3 py-2 rounded-lg text-xs font-bold ${activeTab === 'delays' ? 'bg-blue-600 text-white' : 'text-gray-600'}`}>تاخیر پرسنل</button><button onClick={() => setActiveTab('incidents')} className={`px-3 py-2 rounded-lg text-xs font-bold ${activeTab === 'incidents' ? 'bg-blue-600 text-white' : 'text-gray-600'}`}>گزارش وقایع</button><button onClick={() => setActiveTab('cartable')} className={`px-3 py-2 rounded-lg text-xs font-bold ${activeTab === 'cartable' ? 'bg-orange-600 text-white' : 'text-gray-600'}`}>کارتابل ({getCartableItems().length})</button><button onClick={() => setActiveTab('in_progress')} className={`px-3 py-2 rounded-lg text-xs font-bold ${activeTab === 'in_progress' ? 'bg-indigo-600 text-white' : 'text-gray-600'}`}>در جریان</button><button onClick={() => setActiveTab('archive')} className={`px-3 py-2 rounded-lg text-xs font-bold ${activeTab === 'archive' ? 'bg-green-600 text-white' : 'text-gray-600'}`}>بایگانی</button></div>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden min-h-[500px]">
                {activeTab === 'logs' && (
                    <><div className="p-4 border-b flex justify-between items-center bg-gray-50"><h3 className="font-bold text-gray-700 flex items-center gap-2"><Truck size={18}/> ترددها</h3><div className="flex gap-2"><button onClick={() => setShowModal(true)} className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm hover:bg-green-700"><Plus size={16}/> ثبت تردد</button></div></div>
                    <div className="overflow-x-auto"><table className="w-full text-xs text-center border-collapse"><thead className="bg-gray-100"><tr><th className="p-3 border-l">ردیف</th><th className="p-3 border-l">مبدا/مقصد</th><th className="p-3 border-l">ورود</th><th className="p-3 border-l">خروج</th><th className="p-3 border-l">راننده/پلاک</th><th className="p-3 border-l">کالا/مقدار</th><th className="p-3 border-l">مجوز دهنده</th><th className="p-3 border-l">وضعیت</th><th className="p-3">عملیات</th></tr></thead><tbody>{dailyLogs.map((log, idx) => (<tr key={log.id} className="hover:bg-blue-50"><td>{idx + 1}</td><td className="p-3 border-l font-bold">{log.origin} / {log.destination}</td><td className="p-3 border-l font-mono">{log.entryTime}</td><td className="p-3 border-l font-mono">{log.exitTime}</td><td className="p-3 border-l">{log.driverName}<br/>{log.plateNumber}</td><td className="p-3 border-l">{log.goodsName}<br/>{log.quantity}</td><td className="p-3 border-l">{log.permitProvider}</td><td className="p-3 border-l text-[10px]">{log.status}</td><td className="p-3 flex justify-center gap-2">{canEdit(log) && <button onClick={() => handleEditItem(log, 'log')} className="text-amber-500"><Edit size={16}/></button>}{canDelete(log) && <button onClick={() => handleDeleteItem(log.id, 'log')} className="text-red-500"><Trash2 size={16}/></button>}</td></tr>))}</tbody></table></div></>
                )}
                {activeTab === 'delays' && (
                    <><div className="p-4 border-b flex justify-between items-center bg-gray-50"><h3 className="font-bold text-gray-700 flex items-center gap-2"><Clock size={18}/> تاخیرات</h3><button onClick={() => setShowModal(true)} className="bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm hover:bg-orange-700"><Plus size={16}/> ثبت تاخیر</button></div>
                    <div className="overflow-x-auto"><table className="w-full text-sm text-right"><thead className="bg-gray-100"><tr><th className="p-4">نام پرسنل</th><th className="p-4">واحد</th><th className="p-4">ساعت ورود</th><th className="p-4">میزان تاخیر</th><th className="p-4 text-center">عملیات</th></tr></thead><tbody>{dailyDelays.map(d => (<tr key={d.id} className="hover:bg-gray-50"><td className="p-4 font-bold">{d.personnelName}</td><td className="p-4">{d.unit}</td><td className="p-4 font-mono">{d.arrivalTime}</td><td className="p-4 font-mono text-red-600">{d.delayAmount}</td><td className="p-4 flex gap-2 justify-center">{canEdit(d) && <button onClick={() => handleEditItem(d, 'delay')} className="text-amber-500"><Edit size={16}/></button>}{canDelete(d) && <button onClick={() => handleDeleteItem(d.id, 'delay')} className="text-red-500"><Trash2 size={16}/></button>}</td></tr>))}</tbody></table></div></>
                )}
                {activeTab === 'cartable' && (
                    <div className="p-4 space-y-4">
                        {getCartableItems().filter(i => i.type === 'delay' && i.status === SecurityStatus.APPROVED_SUPERVISOR_CHECK).length > 0 && (<button onClick={handleSupervisorDelaySubmit} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2">ارسال تاخیرات روزانه به مدیریت</button>)}
                        {getCartableItems().filter(i => i.status === SecurityStatus.APPROVED_FACTORY_CHECK).length > 0 && (<button onClick={handleFactoryDailySubmit} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2">ارسال نهایی گزارشات به مدیرعامل</button>)}
                        <div className="space-y-3">{getCartableItems().map((item, idx) => (<div key={idx} className="border p-4 rounded-xl flex justify-between items-center bg-white shadow-sm"><div><div className="font-bold text-sm mb-1">{item.type === 'daily_approval' ? `گزارش روزانه (${item.category})` : item.type === 'log' ? `تردد: ${item.driverName}` : `تاخیر: ${item.personnelName}`}</div><div className="text-xs text-gray-500">{formatDate(item.date)}</div></div><button onClick={() => setViewCartableItem(item)} className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-sm">بررسی</button></div>))}</div>
                    </div>
                )}
                {activeTab === 'in_progress' && (
                    <div className="p-4 space-y-3">{getInProgressItems().map((item, idx) => (<div key={idx} className="border p-4 rounded-xl flex justify-between items-center bg-white hover:bg-indigo-50"><div><div className="font-bold text-sm mb-1">{item.type === 'log' ? `تردد: ${item.driverName}` : item.type === 'delay' ? `تاخیر: ${item.personnelName}` : `واقعه: ${item.subject}`}</div><div className="text-xs text-gray-500">وضعیت: {item.status}</div></div><button onClick={() => setViewCartableItem({...item, mode: 'view_only'})} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm">مشاهده</button></div>))}</div>
                )}
                {activeTab === 'archive' && (
                    <div className="p-4 space-y-2">{getArchivedItems().map((item, idx) => (<div key={idx} className="border p-4 rounded-xl flex justify-between items-center bg-green-50 shadow-sm"><div><div className="font-bold text-green-900 mb-1">{item.type === 'daily_archive' ? `آرشیو (${item.category}): ${formatDate(item.date)}` : `واقعه: ${item.subject}`}</div><div className="text-xs text-green-700">شامل {item.count || 1} رکورد</div></div><button onClick={() => setViewCartableItem({...item, mode: 'view_only'})} className="bg-green-600 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-sm">مشاهده</button></div>))}</div>
                )}
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6 border-b pb-4"><h3 className="font-bold text-lg">{editingId ? 'ویرایش' : 'ثبت جدید'}</h3><button onClick={resetForms} className="text-gray-400"><XCircle size={24}/></button></div>
                        {activeTab === 'logs' && (<form className="space-y-4"><div className="grid grid-cols-2 gap-4"><div><label className="text-xs font-bold block mb-1">مبدا</label><input className="w-full border rounded p-2" value={logForm.origin || ''} onChange={e=>setLogForm({...logForm, origin: e.target.value})}/></div><div><label className="text-xs font-bold block mb-1">مقصد</label><input className="w-full border rounded p-2" value={logForm.destination || ''} onChange={e=>setLogForm({...logForm, destination: e.target.value})}/></div></div><div className="grid grid-cols-2 gap-4"><div><label className="text-xs font-bold block mb-1">ساعت ورود</label><input className="w-full border rounded p-2 text-center font-mono" placeholder="08:00" value={logForm.entryTime || ''} onChange={handleTimeChange('entryTime', setLogForm, logForm)}/></div><div><label className="text-xs font-bold block mb-1">ساعت خروج</label><input className="w-full border rounded p-2 text-center font-mono" placeholder="10:30" value={logForm.exitTime || ''} onChange={handleTimeChange('exitTime', setLogForm, logForm)}/></div></div><div className="grid grid-cols-2 gap-4"><div><label className="text-xs font-bold block mb-1">راننده</label><input className="w-full border rounded p-2" value={logForm.driverName || ''} onChange={e=>setLogForm({...logForm, driverName: e.target.value})}/></div><div><label className="text-xs font-bold block mb-1">پلاک</label><input className="w-full border rounded p-2 text-center font-mono" value={logForm.plateNumber || ''} onChange={e=>setLogForm({...logForm, plateNumber: e.target.value})}/></div></div><div className="grid grid-cols-2 gap-4"><div><label className="text-xs font-bold block mb-1">کالا</label><input className="w-full border rounded p-2" value={logForm.goodsName || ''} onChange={e=>setLogForm({...logForm, goodsName: e.target.value})}/></div><div><label className="text-xs font-bold block mb-1">مقدار</label><input className="w-full border rounded p-2" value={logForm.quantity || ''} onChange={e=>setLogForm({...logForm, quantity: e.target.value})}/></div></div><button type="button" onClick={handleSaveLog} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold">ثبت نهایی</button></form>)}
                        {activeTab === 'delays' && (<form className="space-y-4"><div className="grid grid-cols-2 gap-4"><div><label className="text-xs font-bold block mb-1">نام پرسنل</label><input className="w-full border rounded p-2" value={delayForm.personnelName || ''} onChange={e=>setDelayForm({...delayForm, personnelName: e.target.value})}/></div><div><label className="text-xs font-bold block mb-1">واحد</label><input className="w-full border rounded p-2" value={delayForm.unit || ''} onChange={e=>setDelayForm({...delayForm, unit: e.target.value})}/></div></div><div className="grid grid-cols-2 gap-4"><div><label className="text-xs font-bold block mb-1">ساعت ورود</label><input className="w-full border rounded p-2 text-center font-mono" value={delayForm.arrivalTime || ''} onChange={handleTimeChange('arrivalTime', setDelayForm, delayForm)}/></div><div><label className="text-xs font-bold block mb-1">مدت تاخیر</label><input className="w-full border rounded p-2 text-center font-mono" value={delayForm.delayAmount || ''} onChange={e=>setDelayForm({...delayForm, delayAmount: e.target.value})}/></div></div><button type="button" onClick={handleSaveDelay} className="w-full bg-orange-600 text-white py-3 rounded-lg font-bold">ثبت نهایی</button></form>)}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SecurityModule;
