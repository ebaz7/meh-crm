
import React, { useState, useEffect, useRef } from 'react';
import { User, SecurityLog, PersonnelDelay, SecurityIncident, SecurityStatus, UserRole, DailySecurityMeta, SystemSettings } from '../types';
import { getSecurityLogs, saveSecurityLog, updateSecurityLog, deleteSecurityLog, getPersonnelDelays, savePersonnelDelay, updatePersonnelDelay, deletePersonnelDelay, getSecurityIncidents, saveSecurityIncident, updateSecurityIncident, deleteSecurityIncident, getSettings, saveSettings } from '../services/storageService';
import { generateUUID, getCurrentShamsiDate, jalaliToGregorian, formatDate, getShamsiDateFromIso } from '../constants';
import { Shield, Plus, CheckCircle, XCircle, Clock, Truck, AlertTriangle, UserCheck, Calendar, Printer, Archive, FileSymlink, Edit, Trash2, Eye, FileText, CheckSquare, User as UserIcon, ListChecks, Activity, FileDown, Loader2, Pencil, ChevronDown, ChevronUp, FolderOpen, Folder, Save, X } from 'lucide-react';
import { PrintSecurityDailyLog, PrintPersonnelDelay, PrintIncidentReport } from './security/SecurityPrints';
import { getRolePermissions } from '../services/authService';
import { generatePdf } from '../utils/pdfGenerator';

interface Props {
    currentUser: User;
}

const SecurityModule: React.FC<Props> = ({ currentUser }) => {
    const [activeTab, setActiveTab] = useState<'logs' | 'delays' | 'incidents' | 'cartable' | 'archive' | 'in_progress'>('logs');
    const [subTab, setSubTab] = useState<'current' | 'archived'>('current');
    
    const [deletingItemKey, setDeletingItemKey] = useState<string | null>(null);

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

    const [editingId, setEditingId] = useState<string | null>(null); 
    const [logForm, setLogForm] = useState<Partial<SecurityLog>>({});
    const [delayForm, setDelayForm] = useState<Partial<PersonnelDelay>>({});
    const [incidentForm, setPartialIncidentForm] = useState<Partial<SecurityIncident>>({});

    const [metaForm, setMetaForm] = useState<DailySecurityMeta>({});

    const permissions = settings ? getRolePermissions(currentUser.role, settings, currentUser) : null;

    useEffect(() => { loadData(); }, []);

    useEffect(() => {
        setSubTab('current');
    }, [activeTab, selectedDate]);

    const loadData = async () => {
        try {
            const [l, d, i, s] = await Promise.all([getSecurityLogs(), getPersonnelDelays(), getSecurityIncidents(), getSettings()]);
            setLogs(l || []);
            setDelays(d || []);
            setIncidents(i || []);
            setSettings(s);
        } catch(e) { console.error(e); }
    };

    const getIsoSelectedDate = (): string => {
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

    const handleJumpToEdit = (dateString: string, category: 'log' | 'delay') => {
        const shamsi = getShamsiDateFromIso(dateString);
        setSelectedDate({ year: shamsi.year, month: shamsi.month, day: shamsi.day });
        if (settings?.dailySecurityMeta && settings.dailySecurityMeta[dateString]) {
            setMetaForm({ ...settings.dailySecurityMeta[dateString] });
        }
        setActiveTab(category === 'log' ? 'logs' : 'delays');
        setViewCartableItem(null);
        setShowPrintModal(false);
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

    const setMyName = (shift: 'morning' | 'evening' | 'night') => {
        const guardKey = shift === 'morning' ? 'morningGuard' : shift === 'evening' ? 'eveningGuard' : 'nightGuard';
        setMetaForm({
            ...metaForm,
            [guardKey]: { ...metaForm[guardKey], name: currentUser.fullName }
        });
    };

    const canEdit = (item: any) => {
        // CEO and Admin can ALWAYS edit, even archived items
        if (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.CEO) return true;
        
        if (item.status === SecurityStatus.ARCHIVED) return false;
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
       // Logic to reset approvals if an item is modified can be placed here
    };

    const allDailyLogs = logs.filter(l => l.date.startsWith(getIsoSelectedDate()));
    const dailyLogsActive = allDailyLogs.filter(l => l.status !== SecurityStatus.ARCHIVED);
    const dailyLogsArchived = allDailyLogs.filter(l => l.status === SecurityStatus.ARCHIVED);
    const displayLogs = subTab === 'current' ? dailyLogsActive : dailyLogsArchived;

    const allDailyDelays = delays.filter(d => d.date.startsWith(getIsoSelectedDate()));
    const dailyDelaysActive = allDailyDelays.filter(d => d.status !== SecurityStatus.ARCHIVED);
    const dailyDelaysArchived = allDailyDelays.filter(d => d.status === SecurityStatus.ARCHIVED);
    const displayDelays = subTab === 'current' ? dailyDelaysActive : dailyDelaysArchived;
    
    const getCartableItems = () => {
        const role = currentUser.role;
        const allPending: any[] = [];
        
        // CEO / Admin
        if (role === UserRole.CEO || role === UserRole.ADMIN) {
            const ceoLogs = logs.filter(l => l.status === SecurityStatus.PENDING_CEO);
            const ceoDelays = delays.filter(d => d.status === SecurityStatus.PENDING_CEO);
            const ceoIncidents = incidents.filter(i => i.status === SecurityStatus.PENDING_CEO);

            // Group Daily Logs/Delays
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
            
            // Add Incidents
            ceoIncidents.forEach(i => allPending.push({...i, type: 'incident'}));

            // Admin Visibility for debug/override
            if (role === UserRole.ADMIN) {
                 logs.filter(l => (l.status === SecurityStatus.PENDING_SUPERVISOR || l.status === SecurityStatus.PENDING_FACTORY || l.status === SecurityStatus.APPROVED_FACTORY_CHECK)).forEach(l => allPending.push({...l, type: 'log'}));
                 delays.filter(d => (d.status === SecurityStatus.PENDING_SUPERVISOR || d.status === SecurityStatus.APPROVED_SUPERVISOR_CHECK || d.status === SecurityStatus.PENDING_FACTORY)).forEach(d => allPending.push({...d, type: 'delay'}));
                 incidents.filter(i => (i.status === SecurityStatus.PENDING_SUPERVISOR || i.status === SecurityStatus.PENDING_FACTORY)).forEach(i => allPending.push({...i, type: 'incident'}));
            }
        } 
        else {
            // General Checker
            const check = (item: any, type: string) => {
                const isSupervisor = role === UserRole.SECURITY_HEAD || (permissions && permissions.canApproveSecuritySupervisor);
                
                if (isSupervisor) {
                    if (item.status === SecurityStatus.PENDING_SUPERVISOR) allPending.push({ ...item, type });
                    // Delays have a special intermediate status APPROVED_SUPERVISOR_CHECK before going to Factory
                    if (type === 'delay' && item.status === SecurityStatus.APPROVED_SUPERVISOR_CHECK) allPending.push({ ...item, type });
                } 
                else if (role === UserRole.FACTORY_MANAGER) {
                    if (item.status === SecurityStatus.PENDING_FACTORY) allPending.push({ ...item, type });
                    // Daily logs/delays waiting for "Send to CEO" batch action
                    if (type !== 'incident' && item.status === SecurityStatus.APPROVED_FACTORY_CHECK) allPending.push({ ...item, type });
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
        const currentShift = logForm.shift || 'صبح';
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
            rowNumber: editingId ? logForm.rowNumber! : allDailyLogs.length + 1,
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
        // CEO/Admin Edit preserves status
        if (editingId && (currentUser.role === UserRole.CEO || currentUser.role === UserRole.ADMIN)) {
             const original = incidents.find(i => i.id === editingId);
             if (original) statusToSave = original.status;
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
            createdAt: editingId ? incidentForm.createdAt! : Date.now(),
            shiftManagerOpinion: incidentForm.shiftManagerOpinion,
            hrAction: incidentForm.hrAction,
            safetyAction: incidentForm.safetyAction
        };
        if (editingId) await updateSecurityIncident(newInc); else await saveSecurityIncident(newInc);
        resetForms(); loadData();
    };

    const resetForms = () => {
        setShowModal(false); setEditingId(null);
        setLogForm({}); setDelayForm({}); setPartialIncidentForm({});
    };

    const handleEditItem = (item: any, category: 'log' | 'delay' | 'incident') => {
        setEditingId(item.id);
        if (category === 'log') {
            setLogForm(item);
        } else if (category === 'delay') {
            setDelayForm(item);
        } else if (category === 'incident') {
            setPartialIncidentForm(item);
        }
        setShowModal(true);
    };

    // ... Approve/Reject Handlers (Standard)
    const handleApprove = async (item: any) => {
        let nextStatus = SecurityStatus.PENDING_SUPERVISOR;
        let updates: any = {};
        const type = item.type || (item.category ? item.category : (item.reportNumber ? 'incident' : (item.rowNumber ? 'log' : 'delay')));
        
        if (item.status === SecurityStatus.PENDING_SUPERVISOR) {
             if (type === 'delay') nextStatus = SecurityStatus.APPROVED_SUPERVISOR_CHECK;
             else nextStatus = SecurityStatus.PENDING_FACTORY;
             updates.approverSupervisor = currentUser.fullName;
        } else if (item.status === SecurityStatus.APPROVED_SUPERVISOR_CHECK) {
             nextStatus = SecurityStatus.PENDING_FACTORY;
        } else if (item.status === SecurityStatus.PENDING_FACTORY) {
             if (type === 'log' || type === 'delay') nextStatus = SecurityStatus.APPROVED_FACTORY_CHECK;
             else nextStatus = SecurityStatus.PENDING_CEO;
             updates.approverFactory = currentUser.fullName;
        } else if (item.status === SecurityStatus.APPROVED_FACTORY_CHECK) {
             nextStatus = SecurityStatus.PENDING_CEO;
        } else if (item.status === SecurityStatus.PENDING_CEO) {
             nextStatus = SecurityStatus.ARCHIVED;
             updates.approverCeo = currentUser.fullName;
        }

        try {
            if (type === 'log') await updateSecurityLog({ ...item, status: nextStatus, ...updates });
            else if (type === 'delay') await updatePersonnelDelay({ ...item, status: nextStatus, ...updates });
            else if (type === 'incident') await updateSecurityIncident({ ...item, status: nextStatus, ...updates });
            loadData();
            if (viewCartableItem && viewCartableItem.id === item.id) setViewCartableItem(null);
            setPrintTarget(null); setShowPrintModal(false);
        } catch (e) { alert('خطا'); }
    };

    const handleReject = async (item: any) => {
        const reason = prompt("دلیل رد:");
        if (!reason) return;
        const type = item.type || (item.category ? item.category : (item.reportNumber ? 'incident' : (item.rowNumber ? 'log' : 'delay')));
        const updates = { status: SecurityStatus.REJECTED, rejectionReason: reason, rejectedBy: currentUser.fullName };
        try {
            if (type === 'log') await updateSecurityLog({ ...item, ...updates });
            else if (type === 'delay') await updatePersonnelDelay({ ...item, ...updates });
            else if (type === 'incident') await updateSecurityIncident({ ...item, ...updates });
            loadData();
            if (viewCartableItem && viewCartableItem.id === item.id) setViewCartableItem(null);
            setPrintTarget(null); setShowPrintModal(false);
        } catch (e) { alert('خطا'); }
    };

    const handleSaveShiftMeta = async () => { /* ... */ };
    const handleDeleteItem = async (id: string, type: 'log' | 'delay' | 'incident') => { /* ... */ };

    // --- SMART PDF DOWNLOAD ---
    const handleDownloadPDF = async () => {
        setIsGeneratingPdf(true);
        const elementId = 'printable-area-view';
        
        // Smart Detection Logic
        let orientation: 'portrait' | 'landscape' = 'portrait';
        
        if (printTarget) {
            // Guard Log (Daily Log) -> Landscape (Wide table)
            if (printTarget.type === 'daily_log') {
                orientation = 'landscape';
            }
            // Delay Form -> Portrait (Official A4 form)
            else if (printTarget.type === 'daily_delay') {
                orientation = 'portrait';
            }
            // Incident -> Portrait
            else if (printTarget.type === 'incident') {
                orientation = 'portrait';
            }
        } 
        else if (viewCartableItem) {
            // Cartable Logic
            if (viewCartableItem.category === 'log' || viewCartableItem.type === 'log') {
                orientation = 'landscape';
            } else {
                orientation = 'portrait';
            }
        }

        await generatePdf({
            elementId: elementId,
            filename: `Security_Report_${Date.now()}.pdf`,
            format: 'a4', // Always A4 base
            orientation: orientation,
            onComplete: () => setIsGeneratingPdf(false),
            onError: () => { alert("خطا در ایجاد PDF"); setIsGeneratingPdf(false); }
        });
    };

    // ... (Rest of functions) ...
    const handleSupervisorDailySubmit = async () => { /* ... */ };
    const handleFactoryDailySubmit = async () => { /* ... */ };
    const handleDeleteDailyArchive = async (date: string, category: 'log' | 'delay') => { /* ... */ };
    const DateFilter = () => ( /* ... */ <div/> ); 

    return (
        <div className="p-4 md:p-6 bg-gray-50 h-[calc(100vh-100px)] overflow-y-auto animate-fade-in relative">
            
            {/* View/Print Modal */}
            {(showPrintModal && printTarget) || viewCartableItem ? (
                <div className="fixed inset-0 bg-black/80 z-[100] flex flex-col items-center justify-center p-4">
                    <div className="bg-white p-4 rounded-xl shadow-lg mb-4 flex gap-4 no-print w-full max-w-2xl justify-between items-center">
                        <div className="font-bold text-lg text-gray-800">
                            {viewCartableItem ? 'بررسی / چاپ' : 'پیش‌نمایش چاپ'}
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => window.print()} className="bg-blue-600 text-white px-4 py-2 rounded font-bold shadow flex items-center gap-2">
                                <Printer size={18}/> <span className="hidden sm:inline">چاپ</span>
                            </button>
                            <button onClick={handleDownloadPDF} disabled={isGeneratingPdf} className="bg-red-600 text-white px-4 py-2 rounded font-bold shadow flex items-center gap-2">
                                {isGeneratingPdf ? <Loader2 size={18} className="animate-spin"/> : <FileDown size={18}/>} 
                                <span className="hidden sm:inline">PDF هوشمند</span>
                            </button>
                            
                            {/* Approve/Reject Buttons for Cartable View */}
                            {viewCartableItem && viewCartableItem.mode !== 'view_only' && (
                                <>
                                    <button onClick={() => handleApprove(viewCartableItem)} className="bg-green-600 text-white px-4 py-2 rounded font-bold">تایید</button>
                                    <button onClick={() => handleReject(viewCartableItem)} className="bg-red-600 text-white px-4 py-2 rounded font-bold">رد</button>
                                </>
                            )}
                            
                            {/* Admin/CEO Edit Link for Archived Daily Items */}
                            {(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.CEO) && 
                             viewCartableItem && 
                             viewCartableItem.type === 'daily_archive' && (
                                <button onClick={() => handleJumpToEdit(String(viewCartableItem.date), viewCartableItem.category)} className="bg-amber-100 text-amber-700 px-4 py-2 rounded font-bold border border-amber-300">
                                    <Edit size={16} className="inline ml-1"/> ویرایش
                                </button>
                            )}

                            <button onClick={() => { setShowPrintModal(false); setPrintTarget(null); setViewCartableItem(null); }} className="bg-gray-200 text-gray-800 px-4 py-2 rounded font-bold">بستن</button>
                        </div>
                    </div>
                    
                    <div className="overflow-auto bg-gray-200 p-4 rounded shadow-inner max-h-[80vh] w-full flex justify-center">
                        <div className="bg-white shadow-lg" id="printable-area-view">
                            {/* Determine what to render based on viewCartableItem OR printTarget */}
                            {(() => {
                                const target = viewCartableItem || printTarget;
                                if (!target) return null;

                                if (target.type === 'daily_log' || (target.type === 'daily_approval' && target.category === 'log') || (target.type === 'daily_archive' && target.category === 'log') || target.type === 'log') {
                                    return <PrintSecurityDailyLog date={target.date} logs={logs.filter(l => l.date === target.date)} meta={(settings?.dailySecurityMeta || {})[String(target.date)]} />;
                                }
                                if (target.type === 'daily_delay' || (target.type === 'daily_approval' && target.category === 'delay') || (target.type === 'daily_archive' && target.category === 'delay') || target.type === 'delay') {
                                    return <PrintPersonnelDelay delays={delays.filter(d => d.date === target.date)} meta={(settings?.dailySecurityMeta || {})[String(target.date)]} />;
                                }
                                if (target.type === 'incident') {
                                    return <PrintIncidentReport incident={target.incident || target} />;
                                }
                                return <div>Unknown Type</div>;
                            })()}
                        </div>
                    </div>
                </div>
            ) : null}

            {/* ... (Main Content: Tabs, Lists) ... */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 min-h-[500px]">
                {activeTab === 'logs' && (
                    <>
                        <div className="flex border-b">
                            <button onClick={() => setSubTab('current')} className={`flex-1 py-3 text-sm font-bold text-center border-b-2 transition-colors ${subTab === 'current' ? 'border-blue-600 text-blue-600 bg-blue-50' : 'border-transparent text-gray-500 hover:bg-gray-50'}`}>لیست جاری</button>
                            <button onClick={() => setSubTab('archived')} className={`flex-1 py-3 text-sm font-bold text-center border-b-2 transition-colors ${subTab === 'archived' ? 'border-green-600 text-green-600 bg-green-50' : 'border-transparent text-gray-500 hover:bg-gray-50'}`}>بایگانی روز (نهایی)</button>
                        </div>
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-700 flex items-center gap-2"><Truck size={18}/> گزارش نگهبانی</h3>
                            <div className="flex gap-2">
                                <button onClick={() => { const iso=getIsoSelectedDate(); setPrintTarget({type:'daily_log', date:iso, logs:subTab === 'current' ? dailyLogsActive : dailyLogsArchived, meta:settings?.dailySecurityMeta?.[iso]}); setShowPrintModal(true); }} className="text-gray-600 border rounded bg-white p-2"><Printer size={18}/></button>
                                {(subTab === 'current' || currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.CEO) && <button onClick={() => setShowModal(true)} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm"><Plus size={16}/> ثبت</button>}
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-center border-collapse">
                                <thead className="bg-gray-100 border-b-2"><tr><th className="p-3 border-l">ردیف</th><th className="p-3 border-l">مبدا / مقصد</th><th className="p-3 border-l">ورود</th><th className="p-3 border-l">خروج</th><th className="p-3 border-l">راننده</th><th className="p-3 border-l">کالا</th><th className="p-3 border-l">وضعیت</th><th className="p-3">عملیات</th></tr></thead>
                                <tbody className="divide-y">
                                    {displayLogs.map((log, idx) => (
                                        <tr key={log.id} className={`hover:bg-blue-50 ${log.status === SecurityStatus.ARCHIVED ? 'bg-green-50/30' : ''}`}>
                                            <td className="p-3 border-l">{idx + 1}</td>
                                            <td className="p-3 border-l font-bold">{log.origin}/{log.destination}</td>
                                            <td className="p-3 border-l dir-ltr font-mono">{log.entryTime}</td>
                                            <td className="p-3 border-l dir-ltr font-mono">{log.exitTime}</td>
                                            <td className="p-3 border-l"><div>{log.driverName}</div><div className="text-gray-500">{log.plateNumber}</div></td>
                                            <td className="p-3 border-l"><div>{log.goodsName}</div><div className="text-gray-500">{log.quantity}</div></td>
                                            <td className="p-3 border-l"><span className={`px-2 py-1 rounded text-[10px] ${log.status === SecurityStatus.APPROVED_FACTORY_CHECK ? 'bg-blue-100 text-blue-700' : log.status === SecurityStatus.ARCHIVED ? 'bg-green-100 text-green-700 font-bold border border-green-200' : 'bg-yellow-100'}`}>{log.status}</span></td>
                                            <td className="p-3 flex justify-center gap-2">
                                                {canEdit(log) && <button onClick={() => handleEditItem(log, 'log')} className="text-amber-500 bg-amber-50 p-1.5 rounded hover:bg-amber-100 transition-colors" title="ویرایش"><Edit size={16}/></button>}
                                                {canDelete(log) && <button onClick={() => handleDeleteItem(log.id, 'log')} disabled={deletingItemKey === log.id} className="text-red-500 p-1.5 rounded hover:bg-red-50" title="حذف"><Trash2 size={16}/></button>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
                {/* ... (Delays, Incidents, etc. follow same pattern) ... */}
                {activeTab === 'delays' && (
                    <>
                        <div className="flex border-b">
                            <button onClick={() => setSubTab('current')} className={`flex-1 py-3 text-sm font-bold text-center border-b-2 transition-colors ${subTab === 'current' ? 'border-blue-600 text-blue-600 bg-blue-50' : 'border-transparent text-gray-500 hover:bg-gray-50'}`}>لیست جاری</button>
                            <button onClick={() => setSubTab('archived')} className={`flex-1 py-3 text-sm font-bold text-center border-b-2 transition-colors ${subTab === 'archived' ? 'border-green-600 text-green-600 bg-green-50' : 'border-transparent text-gray-500 hover:bg-gray-50'}`}>بایگانی روز</button>
                        </div>
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-700 flex items-center gap-2"><Clock size={18}/> تاخیر پرسنل</h3>
                            <div className="flex gap-2">
                                <button onClick={() => { const iso=getIsoSelectedDate(); setPrintTarget({type:'daily_delay', date:iso, delays:subTab === 'current' ? dailyDelaysActive : dailyDelaysArchived, meta:settings?.dailySecurityMeta?.[iso]}); setShowPrintModal(true); }} className="text-gray-600 border rounded bg-white p-2"><Printer size={18}/></button>
                                {(subTab === 'current' || currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.CEO) && <button onClick={() => setShowModal(true)} className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm"><Plus size={16}/> ثبت</button>}
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-right">
                                <thead className="bg-gray-100 border-b"><tr><th className="p-4">نام پرسنل</th><th className="p-4">واحد</th><th className="p-4">ساعت ورود</th><th className="p-4">تاخیر</th><th className="p-4">وضعیت</th><th className="p-4">عملیات</th></tr></thead>
                                <tbody className="divide-y">
                                    {displayDelays.map(d => (
                                        <tr key={d.id} className={`hover:bg-gray-50 ${d.status === SecurityStatus.ARCHIVED ? 'bg-green-50/30' : ''}`}>
                                            <td className="p-4 font-bold">{d.personnelName}</td>
                                            <td className="p-4">{d.unit}</td>
                                            <td className="p-4 font-mono">{d.arrivalTime}</td>
                                            <td className="p-4 text-red-600 font-bold">{d.delayAmount}</td>
                                            <td className="p-4 text-xs font-bold">{d.status}</td>
                                            <td className="p-4 flex gap-2 justify-center">
                                                {canEdit(d) && <button onClick={() => handleEditItem(d, 'delay')} className="text-amber-500 bg-amber-50 p-1.5 rounded hover:bg-amber-100 transition-colors" title="ویرایش"><Edit size={16}/></button>}
                                                {canDelete(d) && <button onClick={() => handleDeleteItem(d.id, 'delay')} disabled={deletingItemKey === d.id} className="text-red-500 p-1.5 rounded hover:bg-red-50" title="حذف"><Trash2 size={16}/></button>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
                {/* ... (Incidents, Cartable, Archive - standard) ... */}
                {activeTab === 'archive' && (
                    <div className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {getArchivedItems().map((group, idx) => (
                                <div key={idx} className="bg-white border rounded-xl p-4 hover:shadow-md transition-shadow cursor-pointer relative group" onClick={() => setViewCartableItem({...group, mode: 'view_only'})}>
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className={`p-2 rounded-full ${group.category === 'log' ? 'bg-blue-100 text-blue-600' : group.category === 'delay' ? 'bg-orange-100 text-orange-600' : 'bg-red-100 text-red-600'}`}>
                                            {group.category === 'log' ? <Truck size={20}/> : group.category === 'delay' ? <Clock size={20}/> : <AlertTriangle size={20}/>}
                                        </div>
                                        <div>
                                            <div className="font-bold text-gray-800">{group.type === 'incident' ? 'گزارش حادثه' : group.category === 'log' ? 'گزارش نگهبانی' : 'گزارش تاخیر'}</div>
                                            <div className="text-xs text-gray-500">{formatDate(group.date)}</div>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center mt-2">
                                        <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded border border-green-100">بایگانی شده</span>
                                        {group.type !== 'incident' && <span className="text-xs font-bold text-gray-400">{group.count} مورد</span>}
                                        {group.type === 'incident' && <span className="text-xs font-bold text-gray-400 truncate max-w-[100px]">{group.subject}</span>}
                                    </div>
                                    {/* CEO/Admin Delete Archive Button */}
                                    {(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.CEO) && group.type !== 'incident' && (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleDeleteDailyArchive(group.date, group.category); }}
                                            className="absolute top-2 left-2 p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
                                            title="حذف کامل آرشیو این روز"
                                        >
                                            {deletingItemKey === `${group.date}_${group.category}` ? <Loader2 size={16} className="animate-spin"/> : <Trash2 size={16}/>}
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SecurityModule;
