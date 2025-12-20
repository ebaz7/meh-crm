
import React, { useState, useEffect, useRef } from 'react';
import { User, SecurityLog, PersonnelDelay, SecurityIncident, SecurityStatus, UserRole, DailySecurityMeta, SystemSettings } from '../types';
import { getSecurityLogs, saveSecurityLog, updateSecurityLog, deleteSecurityLog, getPersonnelDelays, savePersonnelDelay, updatePersonnelDelay, deletePersonnelDelay, getSecurityIncidents, saveSecurityIncident, updateSecurityIncident, deleteSecurityIncident, getSettings, saveSettings } from '../services/storageService';
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
    const [incidentForm, setPartialIncidentForm] = useState<Partial<SecurityIncident>>({});

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

    // FIX: Updated Jump to Edit logic - Explicitly loads data into form BEFORE opening modal
    const handleJumpToEdit = (dateString: string, category: 'log' | 'delay') => {
        const shamsi = getShamsiDateFromIso(dateString);
        
        // 1. Set the date picker to the target date
        setSelectedDate({ year: shamsi.year, month: shamsi.month, day: shamsi.day });
        
        // 2. Explicitly load the metadata for this specific date into the form state
        if (settings?.dailySecurityMeta && settings.dailySecurityMeta[dateString]) {
            setMetaForm({ ...settings.dailySecurityMeta[dateString] });
        } else {
            setMetaForm({ 
                dailyDescription: '',
                morningGuard: { name: '', entry: '', exit: '' },
                eveningGuard: { name: '', entry: '', exit: '' },
                nightGuard: { name: '', entry: '', exit: '' }
            });
        }

        // 3. Handle UI transitions
        setActiveTab(category === 'log' ? 'logs' : 'delays');
        setViewCartableItem(null);
        setShowPrintModal(false);
        
        // 4. Open the modal immediately with the data loaded
        setShowShiftModal(true);
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

    // Navigation with Enter Key
    const handleEnterKey = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const form = (e.target as HTMLElement).closest('form');
            if (form) {
                const index = Array.prototype.indexOf.call(form, e.target);
                const nextElement = form.elements[index + 1] as HTMLElement;
                if (nextElement) nextElement.focus();
            }
        }
    };

    const setMyName = (shift: 'morning' | 'evening' | 'night') => {
        const guardKey = shift === 'morning' ? 'morningGuard' : shift === 'evening' ? 'eveningGuard' : 'nightGuard';
        setMetaForm({
            ...metaForm,
            [guardKey]: { ...metaForm[guardKey], name: currentUser.fullName }
        });
    };

    const canEdit = (item: any) => {
        if (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.CEO) return true;
        if (item.status === SecurityStatus.ARCHIVED) return currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.CEO;
        if (item.status === SecurityStatus.REJECTED) return item.registrant === currentUser.fullName;
        if (currentUser.role === UserRole.SECURITY_GUARD || currentUser.role === UserRole.SECURITY_HEAD) {
            return item.status === SecurityStatus.PENDING_SUPERVISOR;
        }
        if (currentUser.role === UserRole.FACTORY_MANAGER) {
            return item.status === SecurityStatus.PENDING_FACTORY || item.status === SecurityStatus.APPROVED_FACTORY_CHECK || item.status === SecurityStatus.PENDING_CEO;
        }
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
            await saveSettings({
                ...settings,
                dailySecurityMeta: { ...settings.dailySecurityMeta, [date]: updatedMeta }
            });
            setSettings(prev => prev ? ({...prev, dailySecurityMeta: {...prev.dailySecurityMeta, [date]: updatedMeta}}) : null);
            setMetaForm(updatedMeta);
        }
    };

    const dailyLogs = logs.filter(l => l.date.startsWith(getIsoSelectedDate()));
    const dailyDelays = delays.filter(d => d.date.startsWith(getIsoSelectedDate()));
    
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
            if (item.status !== SecurityStatus.ARCHIVED && item.status !== SecurityStatus.REJECTED) {
                allActive.push({ ...item, type });
            }
        };
        logs.forEach(l => checkActive(l, 'log'));
        delays.forEach(d => checkActive(d, 'delay'));
        incidents.forEach(i => checkActive(i, 'incident'));
        return allActive.sort((a,b) => b.createdAt - a.createdAt);
    };

    const getArchivedItems = () => {
        const archivedLogs = logs.filter(l => l.status === SecurityStatus.ARCHIVED);
        const archivedDelays = delays.filter(d => d.status === SecurityStatus.ARCHIVED);
        const groupedDatesLogs = new Set(archivedLogs.map(l => l.date));
        const groupedDatesDelays = new Set(archivedDelays.map(d => d.date));
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

    const handleSaveLog = async () => {
        // VALIDATION: Check if shift is registered
        const currentShift = logForm.shift || 'صبح';
        let guardName = '';
        if (currentShift === 'صبح') guardName = metaForm.morningGuard?.name || '';
        else if (currentShift === 'عصر') guardName = metaForm.eveningGuard?.name || '';
        else if (currentShift === 'شب') guardName = metaForm.nightGuard?.name || '';

        if (!guardName.trim()) {
            alert(`خطا: شیفت "${currentShift}" هنوز ثبت نشده است. لطفاً ابتدا دکمه "شیفت" را زده و نام نگهبان را وارد کنید.`);
            return;
        }

        let statusToSave = SecurityStatus.PENDING_SUPERVISOR;
        if (editingId) {
             const originalItem = logs.find(l => l.id === editingId);
             if (originalItem) {
                 if (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.CEO) statusToSave = originalItem.status;
                 else if (originalItem.status === SecurityStatus.REJECTED) statusToSave = SecurityStatus.PENDING_SUPERVISOR;
                 else statusToSave = originalItem.status;
             }
        }
        const isoDate = getIsoSelectedDate();
        await resetDailyApprovalIfNeeded(isoDate, 'log');
        const newLog: SecurityLog = {
            id: editingId || generateUUID(),
            rowNumber: editingId ? logForm.rowNumber! : dailyLogs.length + 1,
            date: isoDate,
            shift: currentShift,
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
             if (originalItem) {
                 if (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.CEO) statusToSave = originalItem.status;
                 else if (originalItem.status === SecurityStatus.REJECTED) statusToSave = SecurityStatus.PENDING_SUPERVISOR;
                 else statusToSave = originalItem.status;
             }
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
        if (editingId && incidentForm.status === SecurityStatus.REJECTED) statusToSave = SecurityStatus.PENDING_SUPERVISOR;
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

    const resetForms = () => {
        setShowModal(false); setEditingId(null);
        setLogForm({}); setDelayForm({}); setPartialIncidentForm({});
    };

    const handleEditItem = (item: any, type: 'log' | 'delay' | 'incident') => {
        setEditingId(item.id);
        if (type === 'log') setLogForm(item);
        else if (type === 'delay') setDelayForm(item);
        else setPartialIncidentForm(item);
        setActiveTab(type === 'log' ? 'logs' : type === 'delay' ? 'delays' : 'incidents'); 
        setShowModal(true);
    };

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
            alert(`گزارش روزانه تایید نهایی شد.`);
            setViewCartableItem(null); loadData(); return;
        }
        const isSupervisor = currentUser.role === UserRole.SECURITY_HEAD || (permissions && permissions.canApproveSecuritySupervisor);
        if (item.type === 'delay') {
            if (isSupervisor && item.status === SecurityStatus.PENDING_SUPERVISOR) {
                if (confirm('آیا تایید می‌کنید؟')) { await updatePersonnelDelay({ ...item, status: SecurityStatus.APPROVED_SUPERVISOR_CHECK, approverSupervisor: currentUser.fullName }); loadData(); }
                return;
            }
        }
        if ((currentUser.role === UserRole.FACTORY_MANAGER || currentUser.role === UserRole.ADMIN) && item.status === SecurityStatus.PENDING_FACTORY) {
            const updates: any = { status: SecurityStatus.APPROVED_FACTORY_CHECK, approverFactory: currentUser.fullName };
            
            if (item.type === 'log') {
                await updateSecurityLog({ ...item, ...updates });
            } 
            else if (item.type === 'delay') {
                // ADDED: Prompt for instruction when Factory Manager approves delay
                const instruction = prompt("لطفا دستور / اقدام لازم را وارد کنید:", item.instruction || "");
                if (instruction === null) return; // Cancelled by user
                
                updates.instruction = instruction;
                await updatePersonnelDelay({ ...item, ...updates });
            }
            loadData(); return;
        }
        if (item.type === 'log' && isSupervisor && item.status === SecurityStatus.PENDING_SUPERVISOR) {
            if (confirm('آیا تایید می‌کنید؟')) { await updateSecurityLog({ ...item, status: SecurityStatus.PENDING_FACTORY, approverSupervisor: currentUser.fullName }); setViewCartableItem(null); loadData(); }
        }
        if (item.type === 'incident') {
             let nextStatus = item.status === SecurityStatus.PENDING_SUPERVISOR ? SecurityStatus.PENDING_FACTORY : item.status;
             await updateSecurityIncident({ ...item, status: nextStatus, approverSupervisor: currentUser.fullName });
             setViewCartableItem(null); loadData();
        }
    };

    const handleSupervisorDailySubmit = async () => {
        if (!confirm("آیا تایید نهایی روزانه تاخیرات را انجام می‌دهید؟")) return;
        const readyDelays = delays.filter(d => d.status === SecurityStatus.APPROVED_SUPERVISOR_CHECK);
        if (readyDelays.length === 0) return;
        const datesToApprove = new Set<string>(readyDelays.map(d => d.date));
        if (settings) {
            let newMeta: Record<string, DailySecurityMeta> = { ...(settings.dailySecurityMeta || {}) };
            datesToApprove.forEach((date: string) => { newMeta[date] = { ...newMeta[date], isDelaySupervisorApproved: true }; });
            await saveSettings({ ...settings, dailySecurityMeta: newMeta });
        }
        for (const delay of readyDelays) await updatePersonnelDelay({ ...delay, status: SecurityStatus.PENDING_FACTORY });
        alert("تاخیرات ارسال شد."); loadData();
    };

    const handleFactoryDailySubmit = async () => {
        if (!confirm("آیا تایید نهایی روزانه را انجام می‌دهید؟")) return;
        const readyLogs = logs.filter(l => l.status === SecurityStatus.APPROVED_FACTORY_CHECK);
        const readyDelays = delays.filter(d => d.status === SecurityStatus.APPROVED_FACTORY_CHECK);
        if (readyLogs.length === 0 && readyDelays.length === 0) return;
        const logDates = new Set<string>(readyLogs.map(l => l.date));
        const delayDates = new Set<string>(readyDelays.map(d => d.date));
        if (settings) {
            let newMeta: Record<string, DailySecurityMeta> = { ...(settings.dailySecurityMeta || {}) };
            logDates.forEach((date: string) => { newMeta[date] = { ...newMeta[date], isFactoryDailyApproved: true }; });
            delayDates.forEach((date: string) => { newMeta[date] = { ...newMeta[date], isDelayFactoryApproved: true }; });
            await saveSettings({ ...settings, dailySecurityMeta: newMeta });
        }
        for (const log of readyLogs) await updateSecurityLog({ ...log, status: SecurityStatus.PENDING_CEO });
        for (const delay of readyDelays) await updatePersonnelDelay({ ...delay, status: SecurityStatus.PENDING_CEO });
        alert("گزارشات ارسال شد."); loadData();
    };

    const handleReject = async (item: any) => {
        const reason = prompt("دلیل رد:");
        if (reason) {
            const updates = { status: SecurityStatus.REJECTED, rejectionReason: reason };
            if (item.type === 'log') await updateSecurityLog({ ...item, ...updates });
            else if (item.type === 'delay') await updatePersonnelDelay({ ...item, ...updates });
            else await updateSecurityIncident({ ...item, ...updates });
            setViewCartableItem(null); loadData();
        }
    };

    const handleSaveShiftMeta = async () => {
        if (!settings) return;
        const isoDate = getIsoSelectedDate();
        const updatedSettings = {
            ...settings,
            dailySecurityMeta: {
                ...(settings.dailySecurityMeta || {}),
                [isoDate]: metaForm
            }
        };
        await saveSettings(updatedSettings);
        setSettings(updatedSettings);
        setShowShiftModal(false);
        alert("اطلاعات شیفت ذخیره شد.");
    };

    const handleDeleteItem = async (id: string, type: 'log' | 'delay' | 'incident') => {
        if (!confirm('آیا از حذف این مورد اطمینان دارید؟')) return;
        try {
            if (type === 'log') await deleteSecurityLog(id);
            else if (type === 'delay') await deletePersonnelDelay(id);
            else await deleteSecurityIncident(id);
            loadData();
        } catch (e) {
            alert("خطا در حذف مورد");
        }
    };

    const handleDownloadPDF = async () => {
        setIsGeneratingPdf(true);
        // Corrected ID to match the new component ID
        const element = document.getElementById('print-delay-form') || document.getElementById('printable-area-view');
        
        if (!element) { 
            setIsGeneratingPdf(false); 
            return; 
        }
        try {
            // @ts-ignore
            const canvas = await window.html2canvas(element, { 
                scale: 2, 
                backgroundColor: '#ffffff', 
                useCORS: true, 
                windowWidth: 1200 
            });
            const imgData = canvas.toDataURL('image/png');
            // @ts-ignore
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4'); // Portrait
            pdf.addImage(imgData, 'PNG', 0, 0, 210, 297);
            pdf.save(`Security_Report.pdf`);
        } catch (e) { console.error(e); alert("خطا در ایجاد PDF"); } finally { setIsGeneratingPdf(false); }
    };

    const DateFilter = () => (
        <div className="flex gap-1 items-center bg-gray-100 p-1 rounded-lg border border-gray-200">
            <Calendar size={16} className="text-gray-500 ml-1"/>
            <select className="bg-transparent text-sm p-1 outline-none" value={selectedDate.day} onChange={e=>setSelectedDate({...selectedDate, day: +e.target.value})}>{Array.from({length:31},(_,i)=>i+1).map(d=><option key={d} value={d}>{d}</option>)}</select>
            <span className="text-gray-400">/</span>
            <select className="bg-transparent text-sm p-1 outline-none" value={selectedDate.month} onChange={e=>setSelectedDate({...selectedDate, month: +e.target.value})}>{Array.from({length:12},(_,i)=>i+1).map(m=><option key={m} value={m}>{m}</option>)}</select>
            <span className="text-gray-400">/</span>
            <select className="bg-transparent text-sm p-1 outline-none" value={selectedDate.year} onChange={e=>setSelectedDate({...selectedDate, year: +e.target.value})}>{Array.from({length:5},(_,i)=>1402+i).map(y=><option key={y} value={y}>{y}</option>)}</select>
        </div>
    );

    return (
        <div className="p-4 md:p-6 bg-gray-50 h-[calc(100vh-100px)] overflow-y-auto animate-fade-in relative">
            {showPrintModal && printTarget && (
                <div className="fixed inset-0 bg-black/80 z-[100] flex flex-col items-center justify-center p-4">
                    <div className="bg-white p-4 rounded-xl shadow-lg mb-4 flex gap-4 no-print"><button onClick={() => window.print()} className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2"><Printer size={16}/> چاپ</button><button onClick={() => setShowPrintModal(false)} className="bg-gray-200 text-gray-800 px-4 py-2 rounded">بستن</button></div>
                    <div className="overflow-auto bg-gray-200 p-4 rounded shadow-inner max-h-[80vh]"><div className="printable-content scale-75 origin-top">{printTarget.type === 'daily_log' && <PrintSecurityDailyLog date={printTarget.date} logs={printTarget.logs} meta={printTarget.meta} />}{printTarget.type === 'daily_delay' && <PrintPersonnelDelay delays={printTarget.delays} meta={printTarget.meta} />}{printTarget.type === 'incident' && <PrintIncidentReport incident={printTarget.incident} />}</div></div>
                </div>
            )}

            {showShiftModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 animate-scale-in max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4 border-b pb-2"><h3 className="font-bold text-lg text-gray-800">اطلاعات شیفت و توضیحات روزانه ({formatDate(getIsoSelectedDate())})</h3><button onClick={() => setShowShiftModal(false)} className="text-gray-400 hover:text-red-500"><XCircle size={24}/></button></div>
                        <div className="space-y-4">
                            <div className="bg-blue-50 p-3 rounded-lg border border-blue-100"><div className="flex justify-between items-center mb-2"><h4 className="font-bold text-sm text-blue-800">شیفت صبح</h4><button onClick={() => setMyName('morning')} className="text-[10px] bg-white border border-blue-200 text-blue-600 px-2 py-1 rounded flex items-center gap-1 hover:bg-blue-50">نام من</button></div><div className="flex gap-2"><input className="flex-1 border rounded p-2 text-sm" placeholder="نام نگهبان" value={metaForm.morningGuard?.name} onChange={e => setMetaForm({...metaForm, morningGuard: {...metaForm.morningGuard!, name: e.target.value}})}/><input className="w-20 border rounded p-2 text-sm text-center" placeholder="ورود" value={metaForm.morningGuard?.entry} onChange={handleTimeChange('entry', (val: any) => setMetaForm({...metaForm, morningGuard: {...metaForm.morningGuard!, entry: val.entry}}), metaForm.morningGuard!)} onBlur={handleTimeBlur('entry', (val: any) => setMetaForm({...metaForm, morningGuard: {...metaForm.morningGuard!, entry: val.entry}}), metaForm.morningGuard!)}/><input className="w-20 border rounded p-2 text-sm text-center" placeholder="خروج" value={metaForm.morningGuard?.exit} onChange={handleTimeChange('exit', (val: any) => setMetaForm({...metaForm, morningGuard: {...metaForm.morningGuard!, exit: val.exit}}), metaForm.morningGuard!)} onBlur={handleTimeBlur('exit', (val: any) => setMetaForm({...metaForm, morningGuard: {...metaForm.morningGuard!, exit: val.exit}}), metaForm.morningGuard!)}/></div></div>
                            <div className="bg-orange-50 p-3 rounded-lg border border-orange-100"><div className="flex justify-between items-center mb-2"><h4 className="font-bold text-sm text-orange-800">شیفت عصر</h4><button onClick={() => setMyName('evening')} className="text-[10px] bg-white border border-blue-200 text-blue-600 px-2 py-1 rounded flex items-center gap-1 hover:bg-blue-50">نام من</button></div><div className="flex gap-2"><input className="flex-1 border rounded p-2 text-sm" placeholder="نام نگهبان" value={metaForm.eveningGuard?.name} onChange={e => setMetaForm({...metaForm, eveningGuard: {...metaForm.eveningGuard!, name: e.target.value}})}/><input className="w-20 border rounded p-2 text-sm text-center" placeholder="ورود" value={metaForm.eveningGuard?.entry} onChange={handleTimeChange('entry', (val: any) => setMetaForm({...metaForm, eveningGuard: {...metaForm.eveningGuard!, entry: val.entry}}), metaForm.eveningGuard!)} onBlur={handleTimeBlur('entry', (val: any) => setMetaForm({...metaForm, eveningGuard: {...metaForm.eveningGuard!, entry: val.entry}}), metaForm.eveningGuard!)}/><input className="w-20 border rounded p-2 text-sm text-center" placeholder="خروج" value={metaForm.eveningGuard?.exit} onChange={handleTimeChange('exit', (val: any) => setMetaForm({...metaForm, eveningGuard: {...metaForm.eveningGuard!, exit: val.exit}}), metaForm.eveningGuard!)} onBlur={handleTimeBlur('exit', (val: any) => setMetaForm({...metaForm, eveningGuard: {...metaForm.eveningGuard!, exit: val.exit}}), metaForm.eveningGuard!)}/></div></div>
                            <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100"><div className="flex justify-between items-center mb-2"><h4 className="font-bold text-sm text-indigo-800">شیفت شب</h4><button onClick={() => setMyName('night')} className="text-[10px] bg-white border border-indigo-200 text-blue-600 px-2 py-1 rounded flex items-center gap-1 hover:bg-blue-50">نام من</button></div><div className="flex gap-2"><input className="flex-1 border rounded p-2 text-sm" placeholder="نام نگهبان" value={metaForm.nightGuard?.name} onChange={e => setMetaForm({...metaForm, nightGuard: {...metaForm.nightGuard!, name: e.target.value}})}/><input className="w-20 border rounded p-2 text-sm text-center" placeholder="ورود" value={metaForm.nightGuard?.entry} onChange={handleTimeChange('entry', (val: any) => setMetaForm({...metaForm, nightGuard: {...metaForm.nightGuard!, entry: val.entry}}), metaForm.nightGuard!)} onBlur={handleTimeBlur('entry', (val: any) => setMetaForm({...metaForm, nightGuard: {...metaForm.nightGuard!, entry: val.entry}}), metaForm.nightGuard!)}/><input className="w-20 border rounded p-2 text-sm text-center" placeholder="خروج" value={metaForm.nightGuard?.exit} onChange={handleTimeChange('exit', (val: any) => setMetaForm({...metaForm, nightGuard: {...metaForm.nightGuard!, exit: val.exit}}), metaForm.nightGuard!)} onBlur={handleTimeBlur('exit', (val: any) => setMetaForm({...metaForm, nightGuard: {...metaForm.nightGuard!, exit: val.exit}}), metaForm.nightGuard!)}/></div></div>
                            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200"><label className="text-sm font-bold block mb-1">گزارش وقایع / توضیحات</label><textarea className="w-full border rounded-lg p-2 text-sm h-32 resize-none" value={metaForm.dailyDescription} onChange={e => setMetaForm({...metaForm, dailyDescription: e.target.value})} /></div>
                            <button onClick={handleSaveShiftMeta} className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700">ذخیره</button>
                        </div>
                    </div>
                </div>
            )}

            {viewCartableItem && (
                <div className="fixed inset-0 bg-black/80 z-[100] flex flex-col items-center justify-center p-4">
                    <div className="bg-white p-4 rounded-xl shadow-lg mb-4 flex gap-4 no-print w-full max-w-2xl justify-between items-center"><div className="font-bold text-lg text-gray-800">{viewCartableItem.type === 'daily_approval' || viewCartableItem.type === 'daily_archive' ? `گزارش روزانه - ${formatDate(viewCartableItem.date)}` : 'بررسی'}</div><div className="flex gap-2"><button onClick={() => window.print()} className="bg-blue-600 text-white px-4 py-2 rounded font-bold shadow"><Printer size={18}/></button><button onClick={handleDownloadPDF} disabled={isGeneratingPdf} className="bg-red-600 text-white px-4 py-2 rounded font-bold shadow">{isGeneratingPdf ? <Loader2 size={18} className="animate-spin"/> : <FileDown size={18}/>}</button>{(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.CEO) && viewCartableItem.type === 'daily_archive' && (<button onClick={() => handleJumpToEdit(String(viewCartableItem.date), viewCartableItem.category)} className="bg-amber-100 text-amber-700 px-4 py-2 rounded font-bold border border-amber-300">ویرایش روز</button>)}{viewCartableItem.mode !== 'view_only' && (<>{(currentUser.role === UserRole.FACTORY_MANAGER || currentUser.role === UserRole.ADMIN) && (viewCartableItem.status === SecurityStatus.PENDING_FACTORY) ? (<button onClick={() => handleApprove(viewCartableItem)} className="bg-blue-600 text-white px-6 py-2 rounded font-bold">تایید اولیه</button>) : (<button onClick={() => handleApprove(viewCartableItem)} className="bg-green-600 text-white px-6 py-2 rounded font-bold">تایید</button>)}<button onClick={() => handleReject(viewCartableItem)} className="bg-red-600 text-white px-6 py-2 rounded font-bold">رد</button></>)}<button onClick={() => setViewCartableItem(null)} className="bg-gray-200 text-gray-800 px-4 py-2 rounded font-bold">بستن</button></div></div>
                    <div className="overflow-auto bg-gray-200 p-4 rounded shadow-inner max-h-[80vh] w-full max-w-5xl flex justify-center"><div className="scale-75 origin-top"><div id="printable-area-view" className="bg-white shadow-lg flex justify-center">{(viewCartableItem.type === 'daily_approval' || viewCartableItem.type === 'daily_archive') && viewCartableItem.category === 'log' && (<PrintSecurityDailyLog date={viewCartableItem.date} logs={logs.filter(l => l.date === viewCartableItem.date)} meta={(settings?.dailySecurityMeta || {})[String(viewCartableItem.date)]}/>)}{(viewCartableItem.type === 'daily_approval' || viewCartableItem.type === 'daily_archive') && viewCartableItem.category === 'delay' && (<PrintPersonnelDelay delays={delays.filter(d => d.date === viewCartableItem.date)} meta={(settings?.dailySecurityMeta || {})[String(viewCartableItem.date)]}/>)}{viewCartableItem.type === 'log' && (<PrintSecurityDailyLog date={viewCartableItem.date} logs={logs.filter(l => l.date === viewCartableItem.date)} meta={(settings?.dailySecurityMeta || {})[String(viewCartableItem.date)]}/>)}{viewCartableItem.type === 'delay' && (<PrintPersonnelDelay delays={delays.filter(d => d.date === viewCartableItem.date)} meta={(settings?.dailySecurityMeta || {})[String(viewCartableItem.date)]}/>)}{viewCartableItem.type === 'incident' && (<PrintIncidentReport incident={viewCartableItem} />)}</div></div></div>
                </div>
            )}

            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-4">
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Shield className="text-blue-600"/> واحد انتظامات</h1>
                <div className="flex flex-wrap gap-2 items-center w-full xl:w-auto">
                    {(activeTab === 'logs' || activeTab === 'delays') && (<div className="flex gap-2"><button onClick={() => setShowShiftModal(true)} className="bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1"><FileText size={16}/> شیفت</button><DateFilter /></div>)}
                    <div className="flex bg-white p-1 rounded-xl shadow-sm border overflow-x-auto"><button onClick={() => setActiveTab('logs')} className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'logs' ? 'bg-blue-600 text-white' : 'text-gray-600'}`}>نگهبانی</button><button onClick={() => setActiveTab('delays')} className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'delays' ? 'bg-blue-600 text-white' : 'text-gray-600'}`}>تاخیر</button><button onClick={() => setActiveTab('incidents')} className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'incidents' ? 'bg-blue-600 text-white' : 'text-gray-600'}`}>وقایع</button><div className="w-px bg-gray-300 mx-1"></div><button onClick={() => setActiveTab('cartable')} className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'cartable' ? 'bg-orange-600 text-white' : 'text-gray-600'}`}>کارتابل ({getCartableItems().length})</button><button onClick={() => setActiveTab('in_progress')} className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'in_progress' ? 'bg-indigo-600 text-white' : 'text-gray-600'}`}>در جریان</button><button onClick={() => setActiveTab('archive')} className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'archive' ? 'bg-green-600 text-white' : 'text-gray-600'}`}>بایگانی</button></div>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 min-h-[500px]">
                {activeTab === 'logs' && (
                    <>
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50"><h3 className="font-bold text-gray-700 flex items-center gap-2"><Truck size={18}/> گزارش نگهبانی</h3><div className="flex gap-2"><button onClick={() => { const iso=getIsoSelectedDate(); setPrintTarget({type:'daily_log', date:iso, logs:dailyLogs, meta:settings?.dailySecurityMeta?.[iso]}); setShowPrintModal(true); }} className="text-gray-600 border rounded bg-white p-2"><Printer size={18}/></button><button onClick={() => setShowModal(true)} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm"><Plus size={16}/> ثبت</button></div></div>
                        <div className="overflow-x-auto"><table className="w-full text-xs text-center border-collapse"><thead className="bg-gray-100 border-b-2"><tr><th className="p-3 border-l">ردیف</th><th className="p-3 border-l">مبدا / مقصد</th><th className="p-3 border-l">ورود</th><th className="p-3 border-l">خروج</th><th className="p-3 border-l">راننده</th><th className="p-3 border-l">کالا</th><th className="p-3 border-l">وضعیت</th><th className="p-3">عملیات</th></tr></thead><tbody className="divide-y">{dailyLogs.length === 0 ? <tr><td colSpan={8} className="p-8 text-gray-400">موردی نیست</td></tr> : dailyLogs.map((log, idx) => (<tr key={log.id} className={`hover:bg-blue-50 ${log.status === SecurityStatus.ARCHIVED ? 'opacity-80' : ''}`}><td className="p-3 border-l">{idx + 1}</td><td className="p-3 border-l font-bold">{log.origin}/{log.destination}</td><td className="p-3 border-l dir-ltr font-mono">{log.entryTime}</td><td className="p-3 border-l dir-ltr font-mono">{log.exitTime}</td><td className="p-3 border-l"><div>{log.driverName}</div><div className="text-gray-500">{log.plateNumber}</div></td><td className="p-3 border-l"><div>{log.goodsName}</div><div className="text-gray-500">{log.quantity}</div></td><td className="p-3 border-l"><span className={`px-2 py-1 rounded text-[10px] ${log.status === SecurityStatus.APPROVED_FACTORY_CHECK ? 'bg-blue-100 text-blue-700' : log.status === SecurityStatus.ARCHIVED ? 'bg-green-50 text-green-700 font-bold border border-green-200' : 'bg-yellow-100'}`}>{log.status}</span></td><td className="p-3 flex justify-center gap-2">{canEdit(log) && <button onClick={() => handleEditItem(log, 'log')} className="text-amber-500 bg-amber-50 p-1.5 rounded hover:bg-amber-100 transition-colors" title="ویرایش ردیف"><Edit size={16}/></button>}{canDelete(log) && <button onClick={() => handleDeleteItem(log.id, 'log')} className="text-red-500 p-1.5 rounded hover:bg-red-50 transition-colors" title="حذف"><Trash2 size={16}/></button>}</td></tr>))}</tbody></table></div>
                    </>
                )}
                {activeTab === 'delays' && (
                    <>
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50"><h3 className="font-bold text-gray-700 flex items-center gap-2"><Clock size={18}/> تاخیر پرسنل</h3><div className="flex gap-2"><button onClick={() => { const iso=getIsoSelectedDate(); setPrintTarget({type:'daily_delay', date:iso, delays:dailyDelays, meta:settings?.dailySecurityMeta?.[iso]}); setShowPrintModal(true); }} className="text-gray-600 border rounded bg-white p-2"><Printer size={18}/></button><button onClick={() => setShowModal(true)} className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm"><Plus size={16}/> ثبت</button></div></div>
                        <div className="overflow-x-auto"><table className="w-full text-sm text-right"><thead className="bg-gray-100 border-b"><tr><th className="p-4">نام پرسنل</th><th className="p-4">واحد</th><th className="p-4">ساعت ورود</th><th className="p-4">تاخیر</th><th className="p-4">وضعیت</th><th className="p-4">عملیات</th></tr></thead><tbody className="divide-y">{dailyDelays.map(d => (<tr key={d.id} className={`hover:bg-gray-50 ${d.status === SecurityStatus.ARCHIVED ? 'opacity-80' : ''}`}><td className="p-4 font-bold">{d.personnelName}</td><td className="p-4">{d.unit}</td><td className="p-4 font-mono">{d.arrivalTime}</td><td className="p-4 text-red-600 font-bold">{d.delayAmount}</td><td className="p-4 text-xs font-bold">{d.status}</td><td className="p-4 flex gap-2 justify-center">{canEdit(d) && <button onClick={() => handleEditItem(d, 'delay')} className="text-amber-500 bg-amber-50 p-1.5 rounded hover:bg-amber-100 transition-colors" title="ویرایش ردیف"><Edit size={16}/></button>}{canDelete(d) && <button onClick={() => handleDeleteItem(d.id, 'delay')} className="text-red-500 p-1.5 rounded hover:bg-red-50 transition-colors" title="حذف"><Trash2 size={16}/></button>}</td></tr>))}</tbody></table></div>
                    </>
                )}
                {activeTab === 'incidents' && (
                    <>
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50"><h3 className="font-bold text-gray-700 flex items-center gap-2"><AlertTriangle size={18}/> گزارش وقایع</h3><button onClick={() => setShowModal(true)} className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm"><Plus size={16}/> ثبت</button></div>
                        <div className="p-4 grid grid-cols-1 gap-4">{incidents.filter(i => i.status !== SecurityStatus.ARCHIVED).map(inc => (<div key={inc.id} className="border rounded-xl p-4 hover:shadow-md transition-shadow relative"><div className="flex justify-between mb-2"><span className="font-bold text-lg">{inc.subject}</span><span className="text-xs bg-gray-100 px-2 py-1 rounded">{formatDate(inc.date)}</span></div><p className="text-sm text-gray-600 mb-4">{inc.description}</p><div className="flex justify-between items-center"><span className="text-xs text-gray-400">{inc.registrant}</span><div className="flex gap-2"><button onClick={() => { setPrintTarget({type:'incident', incident:inc}); setShowPrintModal(true); }} className="p-2 text-blue-600 bg-blue-50 rounded"><Printer size={16}/></button>{canEdit(inc) && <button onClick={() => handleEditItem(inc, 'incident')} className="p-2 text-amber-600 bg-amber-50 rounded"><Edit size={16}/></button>}</div></div></div>))}</div>
                    </>
                )}
                {activeTab === 'cartable' && (
                    <div className="p-4 space-y-3">
                        {(currentUser.role === UserRole.SECURITY_HEAD || (permissions && permissions.canApproveSecuritySupervisor)) && getCartableItems().filter(i => i.type === 'delay' && i.status === SecurityStatus.APPROVED_SUPERVISOR_CHECK).length > 0 && (
                            <button onClick={handleSupervisorDailySubmit} className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold mb-4">تایید نهایی روزانه تاخیرات</button>
                        )}
                        {(currentUser.role === UserRole.FACTORY_MANAGER || currentUser.role === UserRole.ADMIN) && getCartableItems().filter(i => i.status === SecurityStatus.APPROVED_FACTORY_CHECK).length > 0 && (
                            <button onClick={handleFactoryDailySubmit} className="w-full bg-indigo-600 text-white p-4 rounded-xl font-bold mb-4">ارسال نهایی گزارشات امروز برای مدیرعامل</button>
                        )}
                        {getCartableItems().map((item, idx) => (
                            <div key={idx} className="border p-4 rounded-xl flex justify-between items-center bg-white hover:bg-orange-50">
                                <div><div className="font-bold text-sm mb-1">{item.type === 'daily_approval' ? `گزارش روزانه ${item.category==='log'?'تردد':'تاخیر'} - ${formatDate(item.date)}` : item.type === 'log' ? `تردد: ${item.driverName}` : item.subject}</div><div className="text-xs text-gray-500">{item.status || `${item.count} مورد`}</div></div>
                                <button onClick={() => setViewCartableItem(item)} className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-bold shadow">بررسی</button>
                            </div>
                        ))}
                    </div>
                )}
                {activeTab === 'in_progress' && (
                    <div className="p-4 space-y-3">
                        {getInProgressItems().map((item, idx) => (
                            <div key={idx} className="border p-4 rounded-xl flex justify-between items-center bg-white hover:bg-indigo-50">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${item.type==='log'?'bg-blue-100':'bg-orange-100'}`}>{item.type==='log'?<Truck size={16}/>:<Clock size={16}/>}</div>
                                    <div><div className="font-bold text-sm">{item.type==='log'?item.driverName:item.personnelName}</div><div className="text-xs text-gray-500">{formatDate(item.date)} | {item.status}</div></div>
                                </div>
                                <div className="flex gap-2">
                                    {canEdit(item) && <button onClick={() => handleEditItem(item, item.type as any)} className="bg-amber-100 text-amber-700 p-2 rounded-lg"><Edit size={16}/></button>}
                                    <button onClick={() => setViewCartableItem({...item, mode: 'view_only'})} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold">مشاهده</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                {activeTab === 'archive' && (
                    <div className="p-4 space-y-2">
                        {getArchivedItems().map((item, idx) => (
                            <div key={idx} className="border p-3 rounded-lg flex justify-between items-center bg-gray-50">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-green-100 rounded-lg"><Archive size={20}/></div>
                                    <div className="text-sm">
                                        <span className="font-bold">{item.type === 'daily_archive' ? `گزارش ${item.category==='log'?'تردد':'تاخیر'}` : item.subject}</span>
                                        <span className="text-xs text-gray-500 mx-2">{formatDate(item.date)}</span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    {(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.CEO) && item.type === 'daily_archive' && (
                                        <button onClick={() => handleJumpToEdit(String(item.date), item.category)} className="text-amber-600 p-2 bg-amber-50 rounded hover:bg-amber-100 transition-all font-bold text-xs flex items-center gap-1" title="اصلاح و ویرایش روز"><Edit size={16}/> ویرایش روز</button>
                                    )}
                                    <button onClick={() => setViewCartableItem({...item, mode: 'view_only'})} className="text-blue-600 p-2 bg-blue-50 rounded hover:bg-blue-100" title="مشاهده"><Eye size={18}/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 animate-scale-in max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6 border-b pb-4"><h3 className="font-bold text-lg">{editingId ? 'ویرایش' : 'ثبت جدید'}</h3><button onClick={resetForms}><XCircle size={24}/></button></div>
                        {activeTab === 'logs' && (
                            <form className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="text-sm font-bold block mb-1">شیفت کاری</label>
                                    <select 
                                        className="w-full border rounded p-2 text-sm bg-white" 
                                        value={logForm.shift || 'صبح'} 
                                        onChange={e => setLogForm({...logForm, shift: e.target.value})}
                                        onKeyDown={handleEnterKey}
                                    >
                                        <option value="صبح">صبح</option>
                                        <option value="عصر">عصر</option>
                                        <option value="شب">شب</option>
                                    </select>
                                </div>
                                <input className="border rounded p-2 text-sm" placeholder="مبدا" value={logForm.origin || ''} onChange={e=>setLogForm({...logForm, origin: e.target.value})} onKeyDown={handleEnterKey}/>
                                <input className="border rounded p-2 text-sm" placeholder="مقصد" value={logForm.destination || ''} onChange={e=>setLogForm({...logForm, destination: e.target.value})} onKeyDown={handleEnterKey}/>
                                <input className="border rounded p-2 text-sm text-center dir-ltr" placeholder="ورود (08:00)" value={logForm.entryTime || ''} onChange={handleTimeChange('entryTime', setLogForm, logForm)} onBlur={handleTimeBlur('entryTime', setLogForm, logForm)} onKeyDown={handleEnterKey}/>
                                <input className="border rounded p-2 text-sm text-center dir-ltr" placeholder="خروج (10:30)" value={logForm.exitTime || ''} onChange={handleTimeChange('exitTime', setLogForm, logForm)} onBlur={handleTimeBlur('exitTime', setLogForm, logForm)} onKeyDown={handleEnterKey}/>
                                <input className="border rounded p-2 text-sm" placeholder="راننده" value={logForm.driverName || ''} onChange={e=>setLogForm({...logForm, driverName: e.target.value})} onKeyDown={handleEnterKey}/>
                                <input className="border rounded p-2 text-sm" placeholder="شماره خودرو" value={logForm.plateNumber || ''} onChange={e=>setLogForm({...logForm, plateNumber: e.target.value})} onKeyDown={handleEnterKey}/>
                                <input className="border rounded p-2 text-sm" placeholder="کالا" value={logForm.goodsName || ''} onChange={e=>setLogForm({...logForm, goodsName: e.target.value})} onKeyDown={handleEnterKey}/>
                                <input className="border rounded p-2 text-sm" placeholder="مقدار" value={logForm.quantity || ''} onChange={e=>setLogForm({...logForm, quantity: e.target.value})} onKeyDown={handleEnterKey}/>
                                <input className="col-span-2 w-full border rounded p-2 text-sm" placeholder="مجوز دهنده" value={logForm.permitProvider || ''} onChange={e=>setLogForm({...logForm, permitProvider: e.target.value})} onKeyDown={handleEnterKey}/>
                                <div className="col-span-2"><input className="w-full border rounded p-2 text-sm" placeholder="موارد انجام کار" value={logForm.workDescription || ''} onChange={e=>setLogForm({...logForm, workDescription: e.target.value})} onKeyDown={handleEnterKey}/></div>
                                <button type="button" onClick={handleSaveLog} className="col-span-2 bg-blue-600 text-white py-3 rounded-lg font-bold">ذخیره</button>
                            </form>
                        )}
                        {activeTab === 'delays' && (
                            <form className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <input className="border rounded p-2" placeholder="نام پرسنل" value={delayForm.personnelName || ''} onChange={e=>setDelayForm({...delayForm, personnelName: e.target.value})} onKeyDown={handleEnterKey}/>
                                    <input className="border rounded p-2" placeholder="واحد" value={delayForm.unit || ''} onChange={e=>setDelayForm({...delayForm, unit: e.target.value})} onKeyDown={handleEnterKey}/>
                                    <input className="border rounded p-2 text-center dir-ltr" placeholder="ورود (08:00)" value={delayForm.arrivalTime || ''} onChange={handleTimeChange('arrivalTime', setDelayForm, delayForm)} onBlur={handleTimeBlur('arrivalTime', setDelayForm, delayForm)} onKeyDown={handleEnterKey}/>
                                    <input className="border rounded p-2" placeholder="میزان تاخیر" value={delayForm.delayAmount || ''} onChange={e=>setDelayForm({...delayForm, delayAmount: e.target.value})} onKeyDown={handleEnterKey}/>
                                    
                                    {/* Added Missing Fields for Delay Form */}
                                    <input className="border rounded p-2" placeholder="تعداد تکرار" value={delayForm.repeatCount || ''} onChange={e=>setDelayForm({...delayForm, repeatCount: e.target.value})} onKeyDown={handleEnterKey}/>
                                    <input className="border rounded p-2" placeholder="دستور / اقدام" value={delayForm.instruction || ''} onChange={e=>setDelayForm({...delayForm, instruction: e.target.value})} onKeyDown={handleEnterKey}/>
                                </div>
                                <button type="button" onClick={handleSaveDelay} className="w-full bg-orange-600 text-white py-3 rounded-lg font-bold">ذخیره</button>
                            </form>
                        )}
                        {activeTab === 'incidents' && (
                            <form className="space-y-4">
                                <input className="w-full border rounded p-2" placeholder="موضوع" value={incidentForm.subject || ''} onChange={e=>setPartialIncidentForm({...incidentForm, subject: e.target.value})} onKeyDown={handleEnterKey}/>
                                <textarea className="w-full border rounded p-2 h-32" placeholder="شرح" value={incidentForm.description || ''} onChange={e=>setPartialIncidentForm({...incidentForm, description: e.target.value})} onKeyDown={handleEnterKey}/>
                                <button type="button" onClick={handleSaveIncident} className="w-full bg-red-600 text-white py-3 rounded-lg font-bold">ذخیره</button>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SecurityModule;
