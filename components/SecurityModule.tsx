
import React, { useState, useEffect, useRef } from 'react';
import { User, SecurityLog, PersonnelDelay, SecurityIncident, SecurityStatus, UserRole, DailySecurityMeta, SystemSettings } from '../types';
import { getSecurityLogs, saveSecurityLog, updateSecurityLog, getPersonnelDelays, savePersonnelDelay, updatePersonnelDelay, getSecurityIncidents, saveSecurityIncident, updateSecurityIncident, getSettings, saveSettings } from '../services/storageService';
import { generateUUID, getCurrentShamsiDate, jalaliToGregorian, formatDate } from '../constants';
import { Shield, Plus, CheckCircle, XCircle, Clock, Truck, AlertTriangle, UserCheck, Calendar, Printer, Archive, FileSymlink, Edit, Trash2, Eye, FileText, CheckSquare, User as UserIcon, ListChecks, Activity } from 'lucide-react';
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

    // Edit/New State
    const [editingId, setEditingId] = useState<string | null>(null); // Track which item is being edited
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
            [guardKey]: { ...metaForm[guardKey], name: currentUser.fullName }
        });
    };

    // --- PERMISSION LOGIC (UPDATED) ---
    const canEdit = (item: any) => {
        // Admin & CEO can ALWAYS edit, even archived/final items
        if (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.CEO) return true;
        
        // Locked/Archived items can't be edited by others
        if (item.status === SecurityStatus.ARCHIVED) return false;
        
        // Creator can edit rejected items
        if (item.status === SecurityStatus.REJECTED) {
            return item.registrant === currentUser.fullName;
        }
        
        // Guard/Head can edit pending supervisor items
        if (currentUser.role === UserRole.SECURITY_GUARD || currentUser.role === UserRole.SECURITY_HEAD) {
            return item.status === SecurityStatus.PENDING_SUPERVISOR;
        }
        
        // Factory Manager can edit pending factory items
        if (currentUser.role === UserRole.FACTORY_MANAGER) {
            return item.status === SecurityStatus.PENDING_FACTORY || item.status === SecurityStatus.APPROVED_FACTORY_CHECK || item.status === SecurityStatus.PENDING_CEO;
        }
        return false;
    };

    const canDelete = (item: any) => {
        // Admin & CEO can ALWAYS delete
        if (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.CEO) return true;
        
        if (item.status === SecurityStatus.ARCHIVED) return false;
        if (item.registrant === currentUser.fullName) {
            if (currentUser.role === UserRole.SECURITY_GUARD && item.status !== SecurityStatus.PENDING_SUPERVISOR && item.status !== SecurityStatus.REJECTED) return false;
            return true;
        }
        return false;
    };

    // --- RESET DAILY STAMPS LOGIC ---
    // Use this when a new item is added or edited on an already approved day
    const resetDailyApprovalIfNeeded = async (date: string, type: 'log' | 'delay') => {
        // If CEO is editing, DO NOT reset approvals.
        if (currentUser.role === UserRole.CEO || currentUser.role === UserRole.ADMIN) return;

        if (!settings) return;
        const currentMeta = settings.dailySecurityMeta?.[date];
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

    // --- DATA FILTERING ---
    const dailyLogs = logs.filter(l => l.date.startsWith(getIsoSelectedDate()) && l.status !== SecurityStatus.ARCHIVED);
    const dailyDelays = delays.filter(d => d.date.startsWith(getIsoSelectedDate()) && d.status !== SecurityStatus.ARCHIVED);
    
    // Cartable Logic (UPDATED FOR DELAYS)
    const getCartableItems = () => {
        const role = currentUser.role;
        const allPending: any[] = [];
        
        // Grouping logic for CEO: Group by Date
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
                 // For Admin, show all pending items
                 logs.filter(l => (l.status === SecurityStatus.PENDING_SUPERVISOR || l.status === SecurityStatus.PENDING_FACTORY || l.status === SecurityStatus.APPROVED_FACTORY_CHECK)).forEach(l => allPending.push({...l, type: 'log'}));
                 delays.filter(d => (d.status === SecurityStatus.PENDING_SUPERVISOR || d.status === SecurityStatus.APPROVED_SUPERVISOR_CHECK || d.status === SecurityStatus.PENDING_FACTORY)).forEach(d => allPending.push({...d, type: 'delay'}));
            }

        } else {
            // Standard individual items for other roles
            const check = (item: any, type: string) => {
                // Check for Supervisor (Head of Security) Permission OR Role
                const isSupervisor = role === UserRole.SECURITY_HEAD || (permissions && permissions.canApproveSecuritySupervisor);
                
                if (isSupervisor) {
                    if (item.status === SecurityStatus.PENDING_SUPERVISOR) {
                        allPending.push({ ...item, type });
                    }
                    // For Delays, Supervisor has a 2nd step (Daily Submit)
                    if (type === 'delay' && item.status === SecurityStatus.APPROVED_SUPERVISOR_CHECK) {
                        allPending.push({ ...item, type });
                    }
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

    // Get Active / In-Progress Items (Not Archived, Not Rejected)
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
        
        // Group by Date
        const groupedDatesLogs = new Set(archivedLogs.map(l => l.date));
        const groupedDatesDelays = new Set(archivedDelays.map(d => d.date));
        const archiveGroups: any[] = [];
        
        groupedDatesLogs.forEach(date => {
            archiveGroups.push({ date, type: 'daily_archive', category: 'log', count: archivedLogs.filter(l => l.date === date).length });
        });
        groupedDatesDelays.forEach(date => {
            archiveGroups.push({ date, type: 'daily_archive', category: 'delay', count: archivedDelays.filter(d => d.date === date).length });
        });
        
        // Add individual incidents
        incidents.filter(i => i.status === SecurityStatus.ARCHIVED).forEach(i => archiveGroups.push({...i, type: 'incident'}));
        
        return archiveGroups.sort((a,b) => (b.date || '').localeCompare(a.date || ''));
    };

    // --- ACTIONS ---
    const handleSaveLog = async () => {
        // If editing, keep original status if CEO/Admin, else reset to start
        let statusToSave = SecurityStatus.PENDING_SUPERVISOR;
        
        if (editingId) {
             const originalItem = logs.find(l => l.id === editingId);
             if (originalItem) {
                 if (currentUser.role === UserRole.CEO || currentUser.role === UserRole.ADMIN) {
                     statusToSave = originalItem.status; // Keep existing status for CEO edits
                 } else if (originalItem.status === SecurityStatus.REJECTED) {
                     statusToSave = SecurityStatus.PENDING_SUPERVISOR;
                 } else {
                     statusToSave = originalItem.status; // Default behavior: keep status unless rejected
                 }
             }
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
             if (originalItem) {
                 if (currentUser.role === UserRole.CEO || currentUser.role === UserRole.ADMIN) {
                     statusToSave = originalItem.status; // Keep status
                 } else if (originalItem.status === SecurityStatus.REJECTED) {
                     statusToSave = SecurityStatus.PENDING_SUPERVISOR;
                 } else {
                     statusToSave = originalItem.status;
                 }
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
        if (editingId && incidentForm.status === SecurityStatus.REJECTED) {
            statusToSave = SecurityStatus.PENDING_SUPERVISOR;
        }

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
        const updatedMeta = {
            ...(settings.dailySecurityMeta || {}),
            [isoDate]: metaForm
        };
        const newSettings = { ...settings, dailySecurityMeta: updatedMeta };
        await saveSettings(newSettings);
        setSettings(newSettings);
        setShowShiftModal(false);
        alert('اطلاعات شیفت و توضیحات روزانه ذخیره شد.');
    };

    const resetForms = () => {
        setShowModal(false); setEditingId(null);
        setLogForm({}); setDelayForm({}); setIncidentForm({});
    };

    const handleEditItem = (item: any, type: 'log' | 'delay' | 'incident') => {
        setEditingId(item.id);
        if (type === 'log') setLogForm(item);
        else if (type === 'delay') setDelayForm(item);
        else setIncidentForm(item);
        setActiveTab(type === 'log' ? 'logs' : type === 'delay' ? 'delays' : 'incidents'); 
        setShowModal(true);
    };

    const handleDeleteItem = async (id: string, type: 'log' | 'delay' | 'incident') => {
        if (!confirm('حذف شود؟')) return;
        if (type === 'log') await updateSecurityLog({ ...logs.find(l=>l.id===id)!, status: SecurityStatus.REJECTED } as any); 
        else if (type === 'delay') await updatePersonnelDelay({ ...delays.find(d=>d.id===id)!, status: SecurityStatus.REJECTED } as any);
        else if (type === 'incident') await updateSecurityIncident({ ...incidents.find(i=>i.id===id)!, status: SecurityStatus.REJECTED } as any);
        loadData();
    };

    const handleApprove = async (item: any) => {
        // CEO Batch Approval Logic
        if (item.type === 'daily_approval') {
            if (!confirm('آیا تایید نهایی و بایگانی می‌کنید؟ این عملیات مهر امضای نهایی را اعمال می‌کند.')) return;
            const date = item.date;
            const category = item.category;
            
            // 1. Mark Meta as CEO Approved
            if (settings) {
                const currentMeta = settings.dailySecurityMeta?.[date] || {};
                const updatedMeta = { ...currentMeta };
                if (category === 'log') updatedMeta.isCeoDailyApproved = true;
                else updatedMeta.isDelayCeoApproved = true; // Set CEO delay stamp

                await saveSettings({
                    ...settings,
                    dailySecurityMeta: { ...settings.dailySecurityMeta, [date]: updatedMeta }
                });
            }

            // 2. Archive Items
            if (category === 'log') {
                const logsToApprove = logs.filter(l => l.date === date && l.status === SecurityStatus.PENDING_CEO);
                for (const log of logsToApprove) {
                    await updateSecurityLog({ ...log, status: SecurityStatus.ARCHIVED, approverCeo: currentUser.fullName });
                }
            } else if (category === 'delay') {
                const delaysToApprove = delays.filter(d => d.date === date && d.status === SecurityStatus.PENDING_CEO);
                for (const delay of delaysToApprove) {
                    await updatePersonnelDelay({ ...delay, status: SecurityStatus.ARCHIVED, approverCeo: currentUser.fullName });
                }
            }
            alert(`گزارش روزانه ${category === 'log' ? 'تردد' : 'تاخیر'} برای تاریخ ${formatDate(date)} تایید نهایی و بایگانی شد.`);
            setViewCartableItem(null);
            loadData();
            return;
        }

        const isSupervisor = currentUser.role === UserRole.SECURITY_HEAD || (permissions && permissions.canApproveSecuritySupervisor);

        // DELAY WORKFLOW: Supervisor 2 Stages (Check -> Daily Submit)
        if (item.type === 'delay') {
            // Supervisor Stage 1: Check Line Item
            if (isSupervisor && item.status === SecurityStatus.PENDING_SUPERVISOR) {
                if (confirm('آیا این آیتم مورد تایید است؟')) {
                    await updatePersonnelDelay({ ...item, status: SecurityStatus.APPROVED_SUPERVISOR_CHECK, approverSupervisor: currentUser.fullName });
                    loadData();
                }
                return;
            }
        }

        // Factory Manager Approval Logic (Check Line Item)
        if (currentUser.role === UserRole.FACTORY_MANAGER || currentUser.role === UserRole.ADMIN) {
            if (item.status === SecurityStatus.PENDING_FACTORY) {
                const updates = { 
                    status: SecurityStatus.APPROVED_FACTORY_CHECK,
                    approverFactory: currentUser.fullName 
                };
                if (item.type === 'log') await updateSecurityLog({ ...item, ...updates });
                else if (item.type === 'delay') await updatePersonnelDelay({ ...item, ...updates });
                
                loadData();
                return;
            }
        }

        // Standard Log Approval (Supervisor to Factory)
        if (item.type === 'log' && isSupervisor && item.status === SecurityStatus.PENDING_SUPERVISOR) {
            if (confirm('آیا تایید می‌کنید؟')) {
                await updateSecurityLog({ ...item, status: SecurityStatus.PENDING_FACTORY, approverSupervisor: currentUser.fullName });
                setViewCartableItem(null); 
                loadData();
            }
        }
        
        // Incident Approval
        if (item.type === 'incident') {
             let nextStatus = item.status;
             if (item.status === SecurityStatus.PENDING_SUPERVISOR) nextStatus = SecurityStatus.PENDING_FACTORY;
             
             await updateSecurityIncident({ ...item, status: nextStatus, approverSupervisor: currentUser.fullName });
             setViewCartableItem(null); 
             loadData();
        }
    };

    // Handle Supervisor Daily Submit (For Delays)
    const handleSupervisorDelaySubmit = async () => {
        if (!confirm("آیا تایید نهایی روزانه تاخیرات را انجام می‌دهید؟ گزارش برای مدیر کارخانه ارسال می‌شود.")) return;
        
        const readyDelays = delays.filter(d => d.status === SecurityStatus.APPROVED_SUPERVISOR_CHECK);
        if (readyDelays.length === 0) { alert("هیچ آیتم تایید شده‌ای برای ارسال وجود ندارد."); return; }

        const datesToApprove = new Set(readyDelays.map(d => d.date));
        if (settings) {
            let newMeta = { ...settings.dailySecurityMeta };
            datesToApprove.forEach(date => {
                newMeta[date] = { ...newMeta[date], isDelaySupervisorApproved: true };
            });
            await saveSettings({ ...settings, dailySecurityMeta: newMeta });
        }

        for (const delay of readyDelays) {
            await updatePersonnelDelay({ ...delay, status: SecurityStatus.PENDING_FACTORY });
        }
        alert("تاخیرات تایید نهایی شد و برای مدیر کارخانه ارسال گردید.");
        loadData();
    };

    // Factory Manager Final Daily Submit (General)
    const handleFactoryDailySubmit = async () => {
        if (!confirm("آیا تایید نهایی روزانه را انجام می‌دهید؟ با این کار مهر شما اعمال شده و گزارش برای مدیرعامل ارسال می‌شود.")) return;
        
        // 1. Get items
        const readyLogs = logs.filter(l => l.status === SecurityStatus.APPROVED_FACTORY_CHECK);
        const readyDelays = delays.filter(d => d.status === SecurityStatus.APPROVED_FACTORY_CHECK);
        
        if (readyLogs.length === 0 && readyDelays.length === 0) {
            alert("هیچ آیتمی برای ارسال نهایی وجود ندارد.");
            return;
        }

        // 2. Update Meta
        const logDates = new Set(readyLogs.map(l => l.date));
        const delayDates = new Set(readyDelays.map(d => d.date));
        
        if (settings) {
            let newMeta = { ...settings.dailySecurityMeta };
            logDates.forEach(date => { newMeta[date] = { ...newMeta[date], isFactoryDailyApproved: true }; });
            delayDates.forEach(date => { newMeta[date] = { ...newMeta[date], isDelayFactoryApproved: true }; });
            await saveSettings({ ...settings, dailySecurityMeta: newMeta });
        }

        // 3. Move items
        for (const log of readyLogs) await updateSecurityLog({ ...log, status: SecurityStatus.PENDING_CEO });
        for (const delay of readyDelays) await updatePersonnelDelay({ ...delay, status: SecurityStatus.PENDING_CEO });

        alert("گزارشات روزانه تایید نهایی و برای مدیرعامل ارسال گردید.");
        loadData();
    };

    const handleReject = async (item: any) => {
        const reason = prompt("دلیل رد:");
        if (reason) {
            const updates = { status: SecurityStatus.REJECTED, rejectionReason: reason };
            
            if (item.type === 'daily_approval') {
                 alert("امکان رد کلی وجود ندارد. لطفا وارد جزئیات شده و موارد خاص را رد کنید.");
                 return;
            }

            if (item.type === 'log') await updateSecurityLog({ ...item, ...updates });
            else if (item.type === 'delay') await updatePersonnelDelay({ ...item, ...updates });
            else await updateSecurityIncident({ ...item, ...updates });
            setViewCartableItem(null);
            loadData();
        }
    };

    const handlePrintDaily = () => {
        const isoDate = getIsoSelectedDate();
        const meta = settings?.dailySecurityMeta?.[isoDate];
        setPrintTarget({ type: 'daily_log', date: isoDate, logs: dailyLogs, meta });
        setShowPrintModal(true);
    };

    const handlePrintDelays = () => {
        const isoDate = getIsoSelectedDate();
        const meta = settings?.dailySecurityMeta?.[isoDate];
        setPrintTarget({ type: 'daily_delay', date: isoDate, delays: dailyDelays, meta });
        setShowPrintModal(true);
    };

    const handlePrintIncident = (inc: SecurityIncident) => {
        setPrintTarget({ type: 'incident', incident: inc });
        setShowPrintModal(true);
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
            
            {/* PRINT MODAL */}
            {showPrintModal && printTarget && (
                <div className="fixed inset-0 bg-black/80 z-[100] flex flex-col items-center justify-center p-4">
                    <div className="bg-white p-4 rounded-xl shadow-lg mb-4 flex gap-4 no-print">
                        <button onClick={() => window.print()} className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2"><Printer size={16}/> چاپ</button>
                        <button onClick={() => setShowPrintModal(false)} className="bg-gray-200 text-gray-800 px-4 py-2 rounded">بستن</button>
                    </div>
                    <div className="overflow-auto bg-gray-200 p-4 rounded shadow-inner max-h-[80vh]">
                        <div className="printable-content scale-75 origin-top">
                            {printTarget.type === 'daily_log' && <PrintSecurityDailyLog date={printTarget.date} logs={printTarget.logs} meta={printTarget.meta} />}
                            {printTarget.type === 'daily_delay' && <PrintPersonnelDelay delays={printTarget.delays} meta={printTarget.meta} />}
                            {printTarget.type === 'incident' && <PrintIncidentReport incident={printTarget.incident} />}
                        </div>
                    </div>
                </div>
            )}

            {/* SHIFT & META MODAL (NEW) */}
            {showShiftModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 animate-scale-in max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4 border-b pb-2">
                            <h3 className="font-bold text-lg text-gray-800">اطلاعات شیفت و توضیحات روزانه ({formatDate(getIsoSelectedDate())})</h3>
                            <button onClick={() => setShowShiftModal(false)} className="text-gray-400 hover:text-red-500"><XCircle size={24}/></button>
                        </div>
                        
                        <div className="space-y-4">
                            <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                                <div className="flex justify-between items-center mb-2">
                                    <h4 className="font-bold text-sm text-blue-800">شیفت صبح (۰۶:۰۰ الی ۱۴:۰۰)</h4>
                                    <button onClick={() => setMyName('morning')} className="text-[10px] bg-white border border-blue-200 text-blue-600 px-2 py-1 rounded flex items-center gap-1 hover:bg-blue-50"><UserIcon size={10}/> نام من</button>
                                </div>
                                <div className="flex gap-2">
                                    <input className="flex-1 border rounded p-2 text-sm" placeholder="نام نگهبان" value={metaForm.morningGuard?.name} onChange={e => setMetaForm({...metaForm, morningGuard: {...metaForm.morningGuard!, name: e.target.value}})} onKeyDown={handleKeyDown}/>
                                    <input className="w-20 border rounded p-2 text-sm text-center" placeholder="ورود" value={metaForm.morningGuard?.entry} onChange={handleTimeChange('entry', (val: any) => setMetaForm({...metaForm, morningGuard: {...metaForm.morningGuard!, entry: val.entry}}), metaForm.morningGuard!)} onBlur={handleTimeBlur('entry', (val: any) => setMetaForm({...metaForm, morningGuard: {...metaForm.morningGuard!, entry: val.entry}}), metaForm.morningGuard!)} onKeyDown={handleKeyDown}/>
                                    <input className="w-20 border rounded p-2 text-sm text-center" placeholder="خروج" value={metaForm.morningGuard?.exit} onChange={handleTimeChange('exit', (val: any) => setMetaForm({...metaForm, morningGuard: {...metaForm.morningGuard!, exit: val.exit}}), metaForm.morningGuard!)} onBlur={handleTimeBlur('exit', (val: any) => setMetaForm({...metaForm, morningGuard: {...metaForm.morningGuard!, exit: val.exit}}), metaForm.morningGuard!)} onKeyDown={handleKeyDown}/>
                                </div>
                            </div>
                            <div className="bg-orange-50 p-3 rounded-lg border border-orange-100">
                                <div className="flex justify-between items-center mb-2">
                                    <h4 className="font-bold text-sm text-orange-800">شیفت عصر (۱۴:۰۰ الی ۲۲:۰۰)</h4>
                                    <button onClick={() => setMyName('evening')} className="text-[10px] bg-white border border-orange-200 text-orange-600 px-2 py-1 rounded flex items-center gap-1 hover:bg-orange-50"><UserIcon size={10}/> نام من</button>
                                </div>
                                <div className="flex gap-2">
                                    <input className="flex-1 border rounded p-2 text-sm" placeholder="نام نگهبان" value={metaForm.eveningGuard?.name} onChange={e => setMetaForm({...metaForm, eveningGuard: {...metaForm.eveningGuard!, name: e.target.value}})} onKeyDown={handleKeyDown}/>
                                    <input className="w-20 border rounded p-2 text-sm text-center" placeholder="ورود" value={metaForm.eveningGuard?.entry} onChange={handleTimeChange('entry', (val: any) => setMetaForm({...metaForm, eveningGuard: {...metaForm.eveningGuard!, entry: val.entry}}), metaForm.eveningGuard!)} onBlur={handleTimeBlur('entry', (val: any) => setMetaForm({...metaForm, eveningGuard: {...metaForm.eveningGuard!, entry: val.entry}}), metaForm.eveningGuard!)} onKeyDown={handleKeyDown}/>
                                    <input className="w-20 border rounded p-2 text-sm text-center" placeholder="خروج" value={metaForm.eveningGuard?.exit} onChange={handleTimeChange('exit', (val: any) => setMetaForm({...metaForm, eveningGuard: {...metaForm.eveningGuard!, exit: val.exit}}), metaForm.eveningGuard!)} onBlur={handleTimeBlur('exit', (val: any) => setMetaForm({...metaForm, eveningGuard: {...metaForm.eveningGuard!, exit: val.exit}}), metaForm.eveningGuard!)} onKeyDown={handleKeyDown}/>
                                </div>
                            </div>
                            <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                                <div className="flex justify-between items-center mb-2">
                                    <h4 className="font-bold text-sm text-indigo-800">شیفت شب (۲۲:۰۰ الی ۰۶:۰۰)</h4>
                                    <button onClick={() => setMyName('night')} className="text-[10px] bg-white border border-indigo-200 text-indigo-600 px-2 py-1 rounded flex items-center gap-1 hover:bg-indigo-50"><UserIcon size={10}/> نام من</button>
                                </div>
                                <div className="flex gap-2">
                                    <input className="flex-1 border rounded p-2 text-sm" placeholder="نام نگهبان" value={metaForm.nightGuard?.name} onChange={e => setMetaForm({...metaForm, nightGuard: {...metaForm.nightGuard!, name: e.target.value}})} onKeyDown={handleKeyDown}/>
                                    <input className="w-20 border rounded p-2 text-sm text-center" placeholder="ورود" value={metaForm.nightGuard?.entry} onChange={handleTimeChange('entry', (val: any) => setMetaForm({...metaForm, nightGuard: {...metaForm.nightGuard!, entry: val.entry}}), metaForm.nightGuard!)} onBlur={handleTimeBlur('entry', (val: any) => setMetaForm({...metaForm, nightGuard: {...metaForm.nightGuard!, entry: val.entry}}), metaForm.nightGuard!)} onKeyDown={handleKeyDown}/>
                                    <input className="w-20 border rounded p-2 text-sm text-center" placeholder="خروج" value={metaForm.nightGuard?.exit} onChange={handleTimeChange('exit', (val: any) => setMetaForm({...metaForm, nightGuard: {...metaForm.nightGuard!, exit: val.exit}}), metaForm.nightGuard!)} onBlur={handleTimeBlur('exit', (val: any) => setMetaForm({...metaForm, nightGuard: {...metaForm.nightGuard!, exit: val.exit}}), metaForm.nightGuard!)} onKeyDown={handleKeyDown}/>
                                </div>
                            </div>
                            
                            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                <label className="text-sm font-bold block mb-1 text-gray-700 flex items-center gap-2"><FileText size={16}/> توضیحات تکمیلی / گزارش وقایع (پایین برگ)</label>
                                <textarea className="w-full border rounded-lg p-2 text-sm h-32 resize-none focus:bg-white transition-colors" placeholder="گزارش وقایع مهم شیفت، موارد مشکوک، دستورات ویژه و..." value={metaForm.dailyDescription} onChange={e => setMetaForm({...metaForm, dailyDescription: e.target.value})} />
                            </div>

                            <button onClick={handleSaveShiftMeta} className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700">ذخیره اطلاعات شیفت و توضیحات</button>
                        </div>
                    </div>
                </div>
            )}

            {/* CARTABLE VIEW MODAL */}
            {viewCartableItem && (
                <div className="fixed inset-0 bg-black/80 z-[100] flex flex-col items-center justify-center p-4">
                    <div className="bg-white p-4 rounded-xl shadow-lg mb-4 flex gap-4 no-print w-full max-w-2xl justify-between items-center">
                        <div className="font-bold text-lg text-gray-800">
                            {viewCartableItem.type === 'daily_approval' || viewCartableItem.type === 'daily_archive'
                                ? `گزارش روزانه (${viewCartableItem.category === 'log' ? 'تردد' : 'تاخیر'}) - ${formatDate(viewCartableItem.date)}` 
                                : 'بررسی جهت تایید / رد'}
                        </div>
                        <div className="flex gap-2">
                            {/* PRINT BUTTON */}
                             <button onClick={() => window.print()} className="bg-blue-600 text-white px-4 py-2 rounded font-bold flex items-center gap-2 hover:bg-blue-700 shadow"><Printer size={18}/> چاپ</button>

                            {viewCartableItem.mode !== 'view_only' && (
                                <>
                                    {/* Factory Manager View: Check items individually */}
                                    {(currentUser.role === UserRole.FACTORY_MANAGER || currentUser.role === UserRole.ADMIN) && (viewCartableItem.status === SecurityStatus.PENDING_FACTORY) ? (
                                        <button onClick={() => handleApprove(viewCartableItem)} className="bg-blue-600 text-white px-6 py-2 rounded font-bold flex items-center gap-2 hover:bg-blue-700 shadow"><CheckSquare size={18}/> تایید اولیه (چک شد)</button>
                                    ) : (
                                        <button onClick={() => handleApprove(viewCartableItem)} className="bg-green-600 text-white px-6 py-2 rounded font-bold flex items-center gap-2 hover:bg-green-700 shadow"><CheckCircle size={18}/> تایید</button>
                                    )}
                                    
                                    <button onClick={() => handleReject(viewCartableItem)} className="bg-red-600 text-white px-6 py-2 rounded font-bold flex items-center gap-2 hover:bg-red-700 shadow"><XCircle size={18}/> رد</button>
                                </>
                            )}
                            <button onClick={() => setViewCartableItem(null)} className="bg-gray-200 text-gray-800 px-4 py-2 rounded font-bold hover:bg-gray-300">بستن</button>
                        </div>
                    </div>
                    <div className="overflow-auto bg-gray-200 p-4 rounded shadow-inner max-h-[80vh] w-full max-w-5xl flex justify-center">
                        <div className="scale-75 origin-top bg-white shadow-lg">
                            {(viewCartableItem.type === 'daily_approval' || viewCartableItem.type === 'daily_archive') && viewCartableItem.category === 'log' && (
                                <PrintSecurityDailyLog 
                                    date={viewCartableItem.date} 
                                    logs={logs.filter(l => l.date === viewCartableItem.date)} 
                                    meta={settings?.dailySecurityMeta?.[String(viewCartableItem.date)]}
                                />
                            )}
                            {(viewCartableItem.type === 'daily_approval' || viewCartableItem.type === 'daily_archive') && viewCartableItem.category === 'delay' && (
                                <PrintPersonnelDelay 
                                    delays={delays.filter(d => d.date === viewCartableItem.date)} 
                                    meta={settings?.dailySecurityMeta?.[String(viewCartableItem.date)]}
                                />
                            )}
                            {viewCartableItem.type === 'log' && (
                                <PrintSecurityDailyLog 
                                    date={viewCartableItem.date} 
                                    logs={logs.filter(l => l.date === viewCartableItem.date)} 
                                    meta={settings?.dailySecurityMeta?.[String(viewCartableItem.date)]}
                                />
                            )}
                            {viewCartableItem.type === 'delay' && (
                                <PrintPersonnelDelay 
                                    delays={delays.filter(d => d.date === viewCartableItem.date)} 
                                    meta={settings?.dailySecurityMeta?.[String(viewCartableItem.date)]}
                                />
                            )}
                            {viewCartableItem.type === 'incident' && (
                                <PrintIncidentReport incident={viewCartableItem} />
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* HEADER */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-4">
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <Shield className="text-blue-600"/> واحد انتظامات و حراست
                </h1>
                
                <div className="flex flex-wrap gap-2 items-center w-full xl:w-auto">
                    {(activeTab === 'logs' || activeTab === 'delays') && (
                        <div className="flex gap-2">
                            <button onClick={() => setShowShiftModal(true)} className="bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1 hover:bg-gray-50">
                                <FileText size={16}/> اطلاعات شیفت و توضیحات
                            </button>
                            <DateFilter />
                        </div>
                    )}
                    
                    <div className="flex bg-white p-1 rounded-xl shadow-sm border overflow-x-auto">
                        <button onClick={() => setActiveTab('logs')} className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${activeTab === 'logs' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>گزارش نگهبانی</button>
                        <button onClick={() => setActiveTab('delays')} className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${activeTab === 'delays' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>تاخیر پرسنل</button>
                        <button onClick={() => setActiveTab('incidents')} className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${activeTab === 'incidents' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>گزارش وقایع</button>
                        <div className="w-px bg-gray-300 mx-1"></div>
                        <button onClick={() => setActiveTab('cartable')} className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1 ${activeTab === 'cartable' ? 'bg-orange-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}><UserCheck size={14}/> کارتابل ({getCartableItems().length})</button>
                         <button onClick={() => setActiveTab('in_progress')} className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1 ${activeTab === 'in_progress' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}><Activity size={14}/> در جریان</button>
                        <button onClick={() => setActiveTab('archive')} className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1 ${activeTab === 'archive' ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}><Archive size={14}/> بایگانی</button>
                    </div>
                </div>
            </div>

            {/* CONTENT */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden min-h-[500px]">
                
                {/* LOGS TAB */}
                {activeTab === 'logs' && (
                    <>
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-700 flex items-center gap-2"><Truck size={18}/> دفتر گزارش نگهبانی (روزانه)</h3>
                            <div className="flex gap-2">
                                <button onClick={handlePrintDaily} className="text-gray-600 hover:text-blue-600 p-2 border rounded bg-white" title="چاپ فرم روزانه"><Printer size={18}/></button>
                                <button onClick={() => setShowModal(true)} className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm hover:bg-green-700"><Plus size={16}/> ثبت تردد</button>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-center border-collapse">
                                <thead className="bg-gray-100 text-gray-700 border-b-2 border-gray-300">
                                    <tr>
                                        <th className="p-3 border-l">ردیف</th>
                                        <th className="p-3 border-l">مبدا / مقصد</th>
                                        <th className="p-3 border-l">ورود</th>
                                        <th className="p-3 border-l">خروج</th>
                                        <th className="p-3 border-l">راننده / پلاک</th>
                                        <th className="p-3 border-l">کالا / مقدار</th>
                                        <th className="p-3 border-l">مجوز دهنده</th>
                                        <th className="p-3 border-l">وضعیت</th>
                                        <th className="p-3">عملیات</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {dailyLogs.length === 0 ? <tr><td colSpan={9} className="p-8 text-gray-400">هیچ ترددی برای این تاریخ ثبت نشده است.</td></tr> : 
                                    dailyLogs.map((log, idx) => (
                                        <tr key={log.id} className="hover:bg-blue-50 transition-colors">
                                            <td className="p-3 border-l">{idx + 1}</td>
                                            <td className="p-3 border-l font-bold">{log.origin} / {log.destination}</td>
                                            <td className="p-3 border-l dir-ltr font-mono">{log.entryTime}</td>
                                            <td className="p-3 border-l dir-ltr font-mono">{log.exitTime}</td>
                                            <td className="p-3 border-l"><div>{log.driverName}</div><div className="font-mono text-gray-500">{log.plateNumber}</div></td>
                                            <td className="p-3 border-l"><div>{log.goodsName}</div><div className="text-gray-500">{log.quantity}</div></td>
                                            <td className="p-3 border-l">{log.permitProvider}</td>
                                            <td className="p-3 border-l">
                                                <span className={`px-2 py-1 rounded text-[10px] ${log.status === SecurityStatus.ARCHIVED ? 'bg-green-100 text-green-700' : log.status === SecurityStatus.REJECTED ? 'bg-red-100 text-red-700' : log.status === SecurityStatus.APPROVED_FACTORY_CHECK ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-800'}`}>
                                                    {log.status === SecurityStatus.APPROVED_FACTORY_CHECK ? 'تایید اولیه (چک شد)' : log.status}
                                                </span>
                                                {log.status === SecurityStatus.REJECTED && log.rejectionReason && (
                                                    <div className="text-[9px] text-red-500 max-w-[100px] truncate" title={log.rejectionReason}>دلیل: {log.rejectionReason}</div>
                                                )}
                                            </td>
                                            <td className="p-3 flex justify-center gap-2">
                                                {canEdit(log) && <button onClick={() => handleEditItem(log, 'log')} className="text-amber-500 hover:text-amber-700"><Edit size={16}/></button>}
                                                {canDelete(log) && <button onClick={() => handleDeleteItem(log.id, 'log')} className="text-red-500 hover:text-red-700"><Trash2 size={16}/></button>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                {/* DELAYS TAB */}
                {activeTab === 'delays' && (
                    <>
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-700 flex items-center gap-2"><Clock size={18}/> دفتر ثبت تاخیرات</h3>
                            <div className="flex gap-2">
                                <button onClick={handlePrintDelays} className="text-gray-600 hover:text-blue-600 p-2 border rounded bg-white"><Printer size={18}/></button>
                                <button onClick={() => setShowModal(true)} className="bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm hover:bg-orange-700"><Plus size={16}/> ثبت تاخیر</button>
                            </div>
                        </div>
                        <div className="overflow-x-auto"><table className="w-full text-sm text-right"><thead className="bg-gray-100 text-gray-700 border-b"><tr><th className="p-4">نام پرسنل</th><th className="p-4">واحد</th><th className="p-4">ساعت ورود</th><th className="p-4">میزان تاخیر</th><th className="p-4">تعداد تکرار</th><th className="p-4">وضعیت</th><th className="p-4">عملیات</th></tr></thead><tbody className="divide-y">{dailyDelays.map(d => (<tr key={d.id} className="hover:bg-gray-50"><td className="p-4 font-bold">{d.personnelName}</td><td className="p-4">{d.unit}</td><td className="p-4 font-mono">{d.arrivalTime}</td><td className="p-4 font-mono text-red-600 font-bold">{d.delayAmount}</td><td className="p-4">{d.repeatCount || '-'}</td><td className="p-4 text-xs text-gray-500">{d.status}</td><td className="p-4 flex gap-2 justify-center">{canEdit(d) && <button onClick={() => handleEditItem(d, 'delay')} className="text-amber-500"><Edit size={16}/></button>}{canDelete(d) && <button onClick={() => handleDeleteItem(d.id, 'delay')} className="text-red-500"><Trash2 size={16}/></button>}</td></tr>))}</tbody></table></div>
                    </>
                )}

                {/* INCIDENTS TAB */}
                {activeTab === 'incidents' && (
                    <>
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-700 flex items-center gap-2"><AlertTriangle size={18}/> گزارش وقایع</h3>
                            <button onClick={() => setShowModal(true)} className="bg-red-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm hover:bg-red-700"><Plus size={16}/> ثبت واقعه</button>
                        </div>
                        <div className="p-4 grid grid-cols-1 gap-4">{incidents.filter(i => i.status !== SecurityStatus.ARCHIVED).map(inc => (<div key={inc.id} className="border rounded-xl p-4 hover:shadow-md transition-shadow relative"><div className="flex justify-between mb-2"><span className="font-bold text-lg">{inc.subject}</span><span className="text-xs bg-gray-100 px-2 py-1 rounded">{formatDate(inc.date)}</span></div><p className="text-sm text-gray-600 mb-4">{inc.description}</p><div className="flex justify-between items-center"><span className="text-xs text-gray-400">{inc.registrant}</span><div className="flex gap-2"><button onClick={() => handlePrintIncident(inc)} className="p-2 text-blue-600 bg-blue-50 rounded"><Printer size={16}/></button>{canEdit(inc) && <button onClick={() => handleEditItem(inc, 'incident')} className="p-2 text-amber-600 bg-amber-50 rounded"><Edit size={16}/></button>}</div></div></div>))}</div>
                    </>
                )}

                {/* CARTABLE */}
                {activeTab === 'cartable' && (
                    <div className="p-4">
                        {/* Supervisor Delay Daily Submit */}
                        {(currentUser.role === UserRole.SECURITY_HEAD || (permissions && permissions.canApproveSecuritySupervisor)) && getCartableItems().filter(i => i.type === 'delay' && i.status === SecurityStatus.APPROVED_SUPERVISOR_CHECK).length > 0 && (
                            <button onClick={handleSupervisorDelaySubmit} className="w-full bg-blue-600 text-white px-6 py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 shadow-md mb-6 transition-transform hover:scale-[1.01]">
                                <FileSymlink size={24}/> تایید نهایی روزانه تاخیرات و ارسال به مدیر کارخانه
                            </button>
                        )}

                        {/* Factory Manager Daily Submit Button (Both Log and Delay) */}
                        {(currentUser.role === UserRole.FACTORY_MANAGER || currentUser.role === UserRole.ADMIN) && getCartableItems().filter(i => i.status === SecurityStatus.APPROVED_FACTORY_CHECK).length > 0 && (
                            <button onClick={handleFactoryDailySubmit} className="w-full bg-indigo-600 text-white px-6 py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 shadow-md mb-6 transition-transform hover:scale-[1.01]">
                                <FileSymlink size={24}/> ارسال نهایی و امضای گزارشات امروز برای مدیرعامل
                            </button>
                        )}

                        <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><UserCheck size={20}/> کارتابل تایید ({getCartableItems().length})</h3>
                        <div className="space-y-3">
                            {getCartableItems().map((item, idx) => {
                                // Special Card for Daily Approval (CEO)
                                if (item.type === 'daily_approval') {
                                    return (
                                        <div key={idx} className="border-2 border-purple-200 bg-purple-50 p-4 rounded-xl flex justify-between items-center hover:shadow-md transition-all">
                                            <div>
                                                <div className="font-bold text-purple-900 mb-1 flex items-center gap-2"><CheckSquare size={18}/> گزارش روزانه ({item.category === 'log' ? 'تردد' : 'تاخیر'}) - {formatDate(item.date)}</div>
                                                <div className="text-xs text-purple-700">تعداد آیتم: {item.count} مورد منتظر تایید نهایی</div>
                                            </div>
                                            <button onClick={() => setViewCartableItem(item)} className="bg-purple-600 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-purple-700 flex items-center gap-2 shadow-sm"><FileSymlink size={16}/> بررسی و تایید نهایی</button>
                                        </div>
                                    );
                                }
                                
                                return (
                                <div key={idx} className={`border p-4 rounded-xl flex justify-between items-center transition-colors bg-white ${item.status === SecurityStatus.APPROVED_FACTORY_CHECK ? 'border-green-300 bg-green-50' : 'hover:bg-orange-50'}`}>
                                    <div>
                                        <div className="font-bold text-sm mb-1">{item.type === 'log' ? `تردد: ${item.driverName}` : item.type === 'delay' ? `تاخیر: ${item.personnelName}` : `واقعه: ${item.subject}`}</div>
                                        <div className="text-xs text-gray-500">تاریخ: {formatDate(item.date)} | وضعیت: {item.status === SecurityStatus.APPROVED_FACTORY_CHECK ? 'تایید اولیه مدیر (چک شد)' : item.status === SecurityStatus.APPROVED_SUPERVISOR_CHECK ? 'تایید اولیه سرپرست (چک شد)' : item.status}</div>
                                    </div>
                                    <button onClick={() => setViewCartableItem(item)} className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 flex items-center gap-2 shadow-sm"><FileSymlink size={16}/> بررسی</button>
                                </div>
                            )})}
                            {getCartableItems().length === 0 && <div className="text-center text-gray-400 py-10">کارتابل شما خالی است.</div>}
                        </div>
                    </div>
                )}

                {/* IN PROGRESS TAB (NEW) */}
                {activeTab === 'in_progress' && (
                    <div className="p-4 space-y-3">
                        <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><Activity size={20}/> موارد در جریان (فعال)</h3>
                        {getInProgressItems().length === 0 ? (
                             <div className="text-center text-gray-400 py-10">هیچ مورد فعالی یافت نشد.</div>
                        ) : (
                            getInProgressItems().map((item, idx) => (
                                <div key={idx} className="border p-4 rounded-xl flex justify-between items-center transition-colors bg-white hover:bg-indigo-50">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${item.type==='log'?'bg-blue-100 text-blue-600':item.type==='delay'?'bg-orange-100 text-orange-600':'bg-red-100 text-red-600'}`}>{item.type==='log'?<Truck size={16}/>:item.type==='delay'?<Clock size={16}/>:<AlertTriangle size={16}/>}</div>
                                        <div>
                                            <div className="font-bold text-sm mb-1">{item.type === 'log' ? `تردد: ${item.driverName}` : item.type === 'delay' ? `تاخیر: ${item.personnelName}` : `واقعه: ${item.subject}`}</div>
                                            <div className="text-xs text-gray-500">تاریخ: {formatDate(item.date)} | وضعیت: <span className="bg-gray-100 px-1 rounded">{item.status}</span></div>
                                        </div>
                                    </div>
                                    <button onClick={() => setViewCartableItem({...item, mode: 'view_only'})} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-indigo-700 flex items-center gap-2 shadow-sm"><Eye size={14}/> مشاهده / چاپ</button>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* ARCHIVE */}
                {activeTab === 'archive' && (
                    <div className="p-4 space-y-2">
                        {getArchivedItems().map((item, idx) => {
                            if (item.type === 'daily_archive') {
                                return (
                                    <div key={idx} className="border-2 border-green-100 bg-green-50 p-4 rounded-xl flex justify-between items-center hover:shadow-md transition-all">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-green-200 text-green-700 rounded-lg"><Archive size={20}/></div>
                                            <div>
                                                <div className="font-bold text-green-900 mb-1">آرشیو روزانه ({item.category === 'log' ? 'تردد' : 'تاخیر'}): {formatDate(item.date)}</div>
                                                <div className="text-xs text-green-700">شامل {item.count} رکورد</div>
                                            </div>
                                        </div>
                                        <button onClick={() => setViewCartableItem({...item, mode: 'view_only'})} className="bg-green-600 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-green-700 flex items-center gap-2 shadow-sm"><Eye size={16}/> مشاهده و چاپ</button>
                                    </div>
                                )
                            }
                            
                            // Incidents or fallback
                            return (
                            <div key={idx} className="border p-3 rounded-lg flex justify-between items-center bg-gray-50">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${item.type==='log'?'bg-blue-100 text-blue-600':item.type==='delay'?'bg-orange-100 text-orange-600':'bg-red-100 text-red-600'}`}>{item.type==='log'?<Truck size={16}/>:item.type==='delay'?<Clock size={16}/>:<AlertTriangle size={16}/>}</div>
                                    <div className="text-sm">
                                        <span className="font-bold">{item.type === 'log' ? item.driverName : item.type === 'delay' ? item.personnelName : item.subject}</span>
                                        <span className="text-xs text-gray-500 mx-2">{formatDate(item.date)}</span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    {canEdit(item) && <button onClick={() => handleEditItem(item, item.type)} className="text-amber-500 hover:text-amber-700 p-1"><Edit size={16}/></button>}
                                    {canDelete(item) && <button onClick={() => handleDeleteItem(item.id, item.type)} className="text-red-500 hover:text-red-700 p-1"><Trash2 size={16}/></button>}
                                    <button onClick={() => { if(item.type==='incident') handlePrintIncident(item); else alert('برای مشاهده جزئیات روزانه به تب گزارش نگهبانی بروید.'); }} className="text-gray-400 hover:text-blue-600"><Eye size={18}/></button>
                                </div>
                            </div>
                        )})}
                    </div>
                )}
            </div>

            {/* CREATE/EDIT MODAL */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 animate-scale-in max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6 border-b pb-4">
                            <h3 className="font-bold text-lg text-gray-800">{editingId ? 'ویرایش آیتم' : 'ثبت جدید'}</h3>
                            <button onClick={resetForms} className="text-gray-400 hover:text-red-500"><XCircle size={24}/></button>
                        </div>

                        {activeTab === 'logs' && (
                            <form className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="text-xs font-bold block mb-1">مبدا</label><input className="w-full border rounded p-2" value={logForm.origin || ''} onChange={e=>setLogForm({...logForm, origin: e.target.value})} onKeyDown={handleKeyDown}/></div>
                                    <div><label className="text-xs font-bold block mb-1">مقصد</label><input className="w-full border rounded p-2" value={logForm.destination || ''} onChange={e=>setLogForm({...logForm, destination: e.target.value})} onKeyDown={handleKeyDown}/></div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="text-xs font-bold block mb-1">ساعت ورود</label><input className="w-full border rounded p-2 text-center dir-ltr" placeholder="08:00" value={logForm.entryTime || ''} onChange={handleTimeChange('entryTime', setLogForm, logForm)} onBlur={handleTimeBlur('entryTime', setLogForm, logForm)} onKeyDown={handleKeyDown}/></div>
                                    <div><label className="text-xs font-bold block mb-1">ساعت خروج</label><input className="w-full border rounded p-2 text-center dir-ltr" placeholder="10:30" value={logForm.exitTime || ''} onChange={handleTimeChange('exitTime', setLogForm, logForm)} onBlur={handleTimeBlur('exitTime', setLogForm, logForm)} onKeyDown={handleKeyDown}/></div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="text-xs font-bold block mb-1">نام راننده</label><input className="w-full border rounded p-2" value={logForm.driverName || ''} onChange={e=>setLogForm({...logForm, driverName: e.target.value})} onKeyDown={handleKeyDown}/></div>
                                    <div><label className="text-xs font-bold block mb-1">شماره خودرو</label><input className="w-full border rounded p-2 dir-ltr text-center" value={logForm.plateNumber || ''} onChange={e=>setLogForm({...logForm, plateNumber: e.target.value})} onKeyDown={handleKeyDown}/></div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="text-xs font-bold block mb-1">کالا</label><input className="w-full border rounded p-2" value={logForm.goodsName || ''} onChange={e=>setLogForm({...logForm, goodsName: e.target.value})} onKeyDown={handleKeyDown}/></div>
                                    <div><label className="text-xs font-bold block mb-1">مقدار</label><input className="w-full border rounded p-2" value={logForm.quantity || ''} onChange={e=>setLogForm({...logForm, quantity: e.target.value})} onKeyDown={handleKeyDown}/></div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="text-xs font-bold block mb-1">گیرنده</label><input className="w-full border rounded p-2" value={logForm.receiver || ''} onChange={e=>setLogForm({...logForm, receiver: e.target.value})} onKeyDown={handleKeyDown}/></div>
                                    <div><label className="text-xs font-bold block mb-1">مجوز دهنده</label><input className="w-full border rounded p-2" value={logForm.permitProvider || ''} onChange={e=>setLogForm({...logForm, permitProvider: e.target.value})} onKeyDown={handleKeyDown}/></div>
                                </div>
                                <div><label className="text-xs font-bold block mb-1">موارد انجام کار</label><input className="w-full border rounded p-2" value={logForm.workDescription || ''} onChange={e=>setLogForm({...logForm, workDescription: e.target.value})} onKeyDown={handleKeyDown}/></div>
                                <button type="button" onClick={handleSaveLog} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold mt-4 hover:bg-blue-700">{editingId ? 'ذخیره تغییرات' : 'ثبت'}</button>
                            </form>
                        )}

                        {activeTab === 'delays' && (
                            <form className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="text-xs font-bold block mb-1">نام پرسنل</label><input className="w-full border rounded p-2" value={delayForm.personnelName || ''} onChange={e=>setDelayForm({...delayForm, personnelName: e.target.value})} onKeyDown={handleKeyDown}/></div>
                                    <div><label className="text-xs font-bold block mb-1">واحد</label><input className="w-full border rounded p-2" value={delayForm.unit || ''} onChange={e=>setDelayForm({...delayForm, unit: e.target.value})} onKeyDown={handleKeyDown}/></div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="text-xs font-bold block mb-1">ساعت ورود</label><input className="w-full border rounded p-2 text-center dir-ltr" value={delayForm.arrivalTime || ''} onChange={handleTimeChange('arrivalTime', setDelayForm, delayForm)} onBlur={handleTimeBlur('arrivalTime', setDelayForm, delayForm)} onKeyDown={handleKeyDown}/></div>
                                    <div><label className="text-xs font-bold block mb-1">مدت تاخیر</label><input className="w-full border rounded p-2 text-center" value={delayForm.delayAmount || ''} onChange={e=>setDelayForm({...delayForm, delayAmount: e.target.value})} onKeyDown={handleKeyDown}/></div>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                    <div className="font-bold text-xs mb-2">تکرار تاخیر:</div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="text-xs block mb-1 text-gray-500">تعداد تکرار</label><input className="w-full border rounded p-2 text-center" type="number" value={delayForm.repeatCount || ''} onChange={e=>setDelayForm({...delayForm, repeatCount: e.target.value})} onKeyDown={handleKeyDown}/></div>
                                        <div><label className="text-xs block mb-1 text-gray-500">دستور</label><input className="w-full border rounded p-2" value={delayForm.instruction || ''} onChange={e=>setDelayForm({...delayForm, instruction: e.target.value})} onKeyDown={handleKeyDown}/></div>
                                    </div>
                                </div>
                                <button type="button" onClick={handleSaveDelay} className="w-full bg-orange-600 text-white py-3 rounded-lg font-bold mt-4 hover:bg-orange-700">{editingId ? 'ذخیره تغییرات' : 'ثبت'}</button>
                            </form>
                        )}

                        {activeTab === 'incidents' && (
                            <form className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="text-xs font-bold block mb-1">موضوع</label><input className="w-full border rounded p-2" value={incidentForm.subject || ''} onChange={e=>setIncidentForm({...incidentForm, subject: e.target.value})} onKeyDown={handleKeyDown}/></div>
                                    <div><label className="text-xs font-bold block mb-1">شیفت</label><select className="w-full border rounded p-2" value={incidentForm.shift || 'صبح'} onChange={e=>setIncidentForm({...incidentForm, shift: e.target.value})} onKeyDown={handleKeyDown}><option>صبح</option><option>عصر</option><option>شب</option></select></div>
                                </div>
                                <div><label className="text-xs font-bold block mb-1">شرح</label><textarea className="w-full border rounded p-2 h-40 resize-none" value={incidentForm.description || ''} onChange={e=>setIncidentForm({...incidentForm, description: e.target.value})} /></div>
                                <div><label className="text-xs font-bold block mb-1">شهود</label><input className="w-full border rounded p-2" value={incidentForm.witnesses || ''} onChange={e=>setIncidentForm({...incidentForm, witnesses: e.target.value})} onKeyDown={handleKeyDown}/></div>
                                <button type="button" onClick={handleSaveIncident} className="w-full bg-red-600 text-white py-3 rounded-lg font-bold mt-4 hover:bg-red-700">{editingId ? 'ذخیره تغییرات' : 'ثبت'}</button>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SecurityModule;
