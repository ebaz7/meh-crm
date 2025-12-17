
import React, { useState, useEffect } from 'react';
import { User, SecurityLog, PersonnelDelay, SecurityIncident, SecurityStatus, UserRole } from '../types';
import { getSecurityLogs, saveSecurityLog, updateSecurityLog, getPersonnelDelays, savePersonnelDelay, updatePersonnelDelay, getSecurityIncidents, saveSecurityIncident, updateSecurityIncident } from '../services/storageService';
import { generateUUID, getCurrentShamsiDate, jalaliToGregorian, formatDate, parsePersianDate } from '../constants';
import { Shield, Plus, CheckCircle, XCircle, Clock, Truck, FileText, AlertTriangle, UserCheck, Eye, Calendar, Printer, Archive, Filter, X, Search } from 'lucide-react';
import { PrintSecurityDailyLog, PrintPersonnelDelay, PrintIncidentReport } from './security/SecurityPrints';

interface Props {
    currentUser: User;
}

const SecurityModule: React.FC<Props> = ({ currentUser }) => {
    const [activeTab, setActiveTab] = useState<'logs' | 'delays' | 'incidents' | 'cartable' | 'archive'>('logs');
    
    // Date Filter for Daily Views
    const currentShamsi = getCurrentShamsiDate();
    const [selectedDate, setSelectedDate] = useState({ year: currentShamsi.year, month: currentShamsi.month, day: currentShamsi.day });

    // Data State
    const [logs, setLogs] = useState<SecurityLog[]>([]);
    const [delays, setDelays] = useState<PersonnelDelay[]>([]);
    const [incidents, setIncidents] = useState<SecurityIncident[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [printTarget, setPrintTarget] = useState<any>(null); // For incidents mostly

    // Forms
    const [logForm, setLogForm] = useState<Partial<SecurityLog>>({});
    const [delayForm, setDelayForm] = useState<Partial<PersonnelDelay>>({});
    const [incidentForm, setIncidentForm] = useState<Partial<SecurityIncident>>({});

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [l, d, i] = await Promise.all([getSecurityLogs(), getPersonnelDelays(), getSecurityIncidents()]);
            setLogs(l || []);
            setDelays(d || []);
            setIncidents(i || []);
        } catch(e) { console.error(e); }
        finally { setLoading(false); }
    };

    const getIsoSelectedDate = () => {
        try {
            const d = jalaliToGregorian(selectedDate.year, selectedDate.month, selectedDate.day);
            return d.toISOString().split('T')[0];
        } catch { return new Date().toISOString().split('T')[0]; }
    };

    // --- FILTERED DATA FOR DAILY VIEW ---
    const dailyLogs = logs.filter(l => l.date.startsWith(getIsoSelectedDate()) && l.status !== SecurityStatus.ARCHIVED);
    const dailyDelays = delays.filter(d => d.date.startsWith(getIsoSelectedDate()) && d.status !== SecurityStatus.ARCHIVED);
    
    // --- CARTABLE DATA ---
    const getCartableItems = () => {
        const role = currentUser.role;
        const allPending: any[] = [];
        
        const check = (item: any, type: string) => {
            if (role === UserRole.ADMIN) {
                if (item.status !== SecurityStatus.ARCHIVED && item.status !== SecurityStatus.REJECTED) allPending.push({ ...item, type });
            } else if (role === UserRole.SECURITY_HEAD && item.status === SecurityStatus.PENDING_SUPERVISOR) {
                allPending.push({ ...item, type });
            } else if (role === UserRole.FACTORY_MANAGER && item.status === SecurityStatus.PENDING_FACTORY) {
                allPending.push({ ...item, type });
            } else if (role === UserRole.CEO && item.status === SecurityStatus.PENDING_CEO) {
                allPending.push({ ...item, type });
            }
        };

        logs.forEach(l => check(l, 'log'));
        delays.forEach(d => check(d, 'delay'));
        incidents.forEach(i => check(i, 'incident'));
        
        return allPending;
    };

    const getArchivedItems = () => {
        const allArchived: any[] = [];
        logs.filter(l => l.status === SecurityStatus.ARCHIVED).forEach(l => allArchived.push({...l, type: 'log'}));
        delays.filter(d => d.status === SecurityStatus.ARCHIVED).forEach(d => allArchived.push({...d, type: 'delay'}));
        incidents.filter(i => i.status === SecurityStatus.ARCHIVED).forEach(i => allArchived.push({...i, type: 'incident'}));
        return allArchived;
    };

    // --- ACTIONS ---
    const handleSaveLog = async () => {
        const newLog: SecurityLog = {
            id: generateUUID(),
            rowNumber: dailyLogs.length + 1,
            date: getIsoSelectedDate(),
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
            registrant: currentUser.fullName,
            status: SecurityStatus.PENDING_SUPERVISOR,
            createdAt: Date.now()
        };
        await saveSecurityLog(newLog);
        setShowModal(false); setLogForm({}); loadData();
    };

    const handleSaveDelay = async () => {
        const newDelay: PersonnelDelay = {
            id: generateUUID(),
            date: getIsoSelectedDate(),
            personnelName: delayForm.personnelName || '',
            unit: delayForm.unit || '',
            arrivalTime: delayForm.arrivalTime || '',
            delayAmount: delayForm.delayAmount || '',
            registrant: currentUser.fullName,
            status: SecurityStatus.PENDING_SUPERVISOR,
            createdAt: Date.now()
        };
        await savePersonnelDelay(newDelay);
        setShowModal(false); setDelayForm({}); loadData();
    };

    const handleSaveIncident = async () => {
        const newInc: SecurityIncident = {
            id: generateUUID(),
            reportNumber: (incidents.length + 100).toString(),
            date: getIsoSelectedDate(),
            subject: incidentForm.subject || '',
            description: incidentForm.description || '',
            shift: incidentForm.shift || 'صبح',
            registrant: currentUser.fullName,
            witnesses: incidentForm.witnesses,
            status: SecurityStatus.PENDING_SUPERVISOR,
            createdAt: Date.now()
        };
        await saveSecurityIncident(newInc);
        setShowModal(false); setIncidentForm({}); loadData();
    };

    const handleApprove = async (item: any) => {
        if (!confirm('آیا تایید می‌کنید؟')) return;
        
        let nextStatus = item.status;
        let updates: any = {};

        if (item.status === SecurityStatus.PENDING_SUPERVISOR) {
            nextStatus = SecurityStatus.PENDING_FACTORY;
            updates.approverSupervisor = currentUser.fullName;
        } else if (item.status === SecurityStatus.PENDING_FACTORY) {
            nextStatus = SecurityStatus.PENDING_CEO;
            updates.approverFactory = currentUser.fullName;
        } else if (item.status === SecurityStatus.PENDING_CEO) {
            nextStatus = SecurityStatus.ARCHIVED;
            updates.approverCeo = currentUser.fullName;
        }

        updates.status = nextStatus;

        if (item.type === 'log') await updateSecurityLog({ ...item, ...updates });
        else if (item.type === 'delay') await updatePersonnelDelay({ ...item, ...updates });
        else await updateSecurityIncident({ ...item, ...updates });
        
        loadData();
    };

    const handleReject = async (item: any) => {
        const reason = prompt("دلیل رد:");
        if (reason) {
            const updates = { status: SecurityStatus.REJECTED, rejectionReason: reason };
            if (item.type === 'log') await updateSecurityLog({ ...item, ...updates });
            else if (item.type === 'delay') await updatePersonnelDelay({ ...item, ...updates });
            else await updateSecurityIncident({ ...item, ...updates });
            loadData();
        }
    };

    const handlePrintDaily = () => {
        setPrintTarget({ type: 'daily_log', date: getIsoSelectedDate(), logs: dailyLogs });
        setShowPrintModal(true);
    };

    const handlePrintDelays = () => {
        setPrintTarget({ type: 'daily_delay', date: getIsoSelectedDate(), delays: dailyDelays });
        setShowPrintModal(true);
    };

    const handlePrintIncident = (inc: SecurityIncident) => {
        setPrintTarget({ type: 'incident', incident: inc });
        setShowPrintModal(true);
    };

    // --- RENDERERS ---
    const years = Array.from({length: 5}, (_, i) => 1402 + i);
    const months = Array.from({length: 12}, (_, i) => i + 1);
    const days = Array.from({length: 31}, (_, i) => i + 1);

    const DateFilter = () => (
        <div className="flex gap-1 items-center bg-gray-100 p-1 rounded-lg border border-gray-200">
            <Calendar size={16} className="text-gray-500 ml-1"/>
            <select className="bg-transparent text-sm p-1 outline-none" value={selectedDate.day} onChange={e=>setSelectedDate({...selectedDate, day: +e.target.value})}>{days.map(d=><option key={d} value={d}>{d}</option>)}</select>
            <span className="text-gray-400">/</span>
            <select className="bg-transparent text-sm p-1 outline-none" value={selectedDate.month} onChange={e=>setSelectedDate({...selectedDate, month: +e.target.value})}>{months.map(m=><option key={m} value={m}>{m}</option>)}</select>
            <span className="text-gray-400">/</span>
            <select className="bg-transparent text-sm p-1 outline-none" value={selectedDate.year} onChange={e=>setSelectedDate({...selectedDate, year: +e.target.value})}>{years.map(y=><option key={y} value={y}>{y}</option>)}</select>
        </div>
    );

    return (
        <div className="p-4 md:p-6 bg-gray-50 h-[calc(100vh-100px)] overflow-y-auto animate-fade-in relative">
            
            {/* PRINT MODAL OVERLAY */}
            {showPrintModal && printTarget && (
                <div className="fixed inset-0 bg-black/80 z-[100] flex flex-col items-center justify-center p-4">
                    <div className="bg-white p-4 rounded-xl shadow-lg mb-4 flex gap-4 no-print">
                        <button onClick={() => window.print()} className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2"><Printer size={16}/> چاپ</button>
                        <button onClick={() => setShowPrintModal(false)} className="bg-gray-200 text-gray-800 px-4 py-2 rounded">بستن</button>
                    </div>
                    <div className="overflow-auto bg-gray-200 p-4 rounded shadow-inner max-h-[80vh]">
                        <div className="printable-content scale-75 origin-top">
                            {printTarget.type === 'daily_log' && <PrintSecurityDailyLog date={printTarget.date} logs={printTarget.logs} />}
                            {printTarget.type === 'daily_delay' && <PrintPersonnelDelay delays={printTarget.delays} />}
                            {printTarget.type === 'incident' && <PrintIncidentReport incident={printTarget.incident} />}
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-4">
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <Shield className="text-blue-600"/> واحد انتظامات و حراست
                </h1>
                
                <div className="flex flex-wrap gap-2 items-center w-full xl:w-auto">
                    {(activeTab === 'logs' || activeTab === 'delays') && <DateFilter />}
                    
                    <div className="flex bg-white p-1 rounded-xl shadow-sm border overflow-x-auto">
                        <button onClick={() => setActiveTab('logs')} className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${activeTab === 'logs' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>گزارش نگهبانی</button>
                        <button onClick={() => setActiveTab('delays')} className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${activeTab === 'delays' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>تاخیر پرسنل</button>
                        <button onClick={() => setActiveTab('incidents')} className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${activeTab === 'incidents' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>گزارش وقایع</button>
                        <div className="w-px bg-gray-300 mx-1"></div>
                        <button onClick={() => setActiveTab('cartable')} className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1 ${activeTab === 'cartable' ? 'bg-orange-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}><UserCheck size={14}/> کارتابل تایید ({getCartableItems().length})</button>
                        <button onClick={() => setActiveTab('archive')} className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1 ${activeTab === 'archive' ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}><Archive size={14}/> بایگانی</button>
                    </div>
                </div>
            </div>

            {/* TAB CONTENT */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden min-h-[500px]">
                
                {/* 1. DAILY TRAFFIC LOGS */}
                {activeTab === 'logs' && (
                    <>
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-700 flex items-center gap-2"><Truck size={18}/> دفتر گزارش نگهبانی (۲۴ ساعته)</h3>
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
                                        <th className="p-3 border-l">مبدا</th>
                                        <th className="p-3 border-l">ورود</th>
                                        <th className="p-3 border-l">خروج</th>
                                        <th className="p-3 border-l">راننده / پلاک</th>
                                        <th className="p-3 border-l">کالا / مقدار</th>
                                        <th className="p-3 border-l">مقصد / گیرنده</th>
                                        <th className="p-3 border-l">مجوز دهنده</th>
                                        <th className="p-3">وضعیت</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {dailyLogs.length === 0 ? <tr><td colSpan={9} className="p-8 text-gray-400">هیچ ترددی برای این تاریخ ثبت نشده است.</td></tr> : 
                                    dailyLogs.map((log, idx) => (
                                        <tr key={log.id} className="hover:bg-blue-50 transition-colors">
                                            <td className="p-3 border-l">{idx + 1}</td>
                                            <td className="p-3 border-l font-bold">{log.origin}</td>
                                            <td className="p-3 border-l dir-ltr font-mono">{log.entryTime}</td>
                                            <td className="p-3 border-l dir-ltr font-mono">{log.exitTime}</td>
                                            <td className="p-3 border-l">
                                                <div className="font-bold">{log.driverName}</div>
                                                <div className="font-mono text-gray-500">{log.plateNumber}</div>
                                            </td>
                                            <td className="p-3 border-l">
                                                <div className="font-bold text-blue-700">{log.goodsName}</div>
                                                <div className="text-gray-500">{log.quantity}</div>
                                            </td>
                                            <td className="p-3 border-l text-xs text-gray-600">
                                                {log.destination} / {log.receiver}
                                            </td>
                                            <td className="p-3 border-l">{log.permitProvider}</td>
                                            <td className="p-3">
                                                <span className={`px-2 py-1 rounded text-[10px] ${log.status === SecurityStatus.ARCHIVED ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-800'}`}>
                                                    {log.status === SecurityStatus.PENDING_SUPERVISOR ? 'منتظر سرپرست' : log.status === SecurityStatus.PENDING_FACTORY ? 'منتظر مدیر' : 'در جریان'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                {/* 2. PERSONNEL DELAYS */}
                {activeTab === 'delays' && (
                    <>
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-700 flex items-center gap-2"><Clock size={18}/> دفتر ثبت تاخیرات</h3>
                            <div className="flex gap-2">
                                <button onClick={handlePrintDelays} className="text-gray-600 hover:text-blue-600 p-2 border rounded bg-white" title="چاپ فرم"><Printer size={18}/></button>
                                <button onClick={() => setShowModal(true)} className="bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm hover:bg-orange-700"><Plus size={16}/> ثبت تاخیر</button>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-right">
                                <thead className="bg-gray-100 text-gray-700 border-b">
                                    <tr>
                                        <th className="p-4">نام پرسنل</th>
                                        <th className="p-4">واحد</th>
                                        <th className="p-4">ساعت ورود</th>
                                        <th className="p-4">میزان تاخیر</th>
                                        <th className="p-4">وضعیت</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {dailyDelays.map(d => (
                                        <tr key={d.id} className="hover:bg-gray-50">
                                            <td className="p-4 font-bold">{d.personnelName}</td>
                                            <td className="p-4">{d.unit}</td>
                                            <td className="p-4 font-mono">{d.arrivalTime}</td>
                                            <td className="p-4 font-mono text-red-600 font-bold">{d.delayAmount}</td>
                                            <td className="p-4 text-xs text-gray-500">{d.status}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                {/* 3. INCIDENTS */}
                {activeTab === 'incidents' && (
                    <>
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-700 flex items-center gap-2"><AlertTriangle size={18}/> گزارش وقایع و حوادث</h3>
                            <button onClick={() => setShowModal(true)} className="bg-red-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm hover:bg-red-700"><Plus size={16}/> ثبت واقعه</button>
                        </div>
                        <div className="p-4 grid grid-cols-1 gap-4">
                            {incidents.filter(i => i.status !== SecurityStatus.ARCHIVED).map(inc => (
                                <div key={inc.id} className="border rounded-xl p-4 hover:shadow-md transition-shadow relative">
                                    <div className="flex justify-between mb-2">
                                        <span className="font-bold text-lg">موضوع: {inc.subject}</span>
                                        <span className="text-xs bg-gray-100 px-2 py-1 rounded">{formatDate(inc.date)} - {inc.shift}</span>
                                    </div>
                                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">{inc.description}</p>
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs text-gray-400">گزارش‌دهنده: {inc.registrant}</span>
                                        <div className="flex gap-2">
                                            <button onClick={() => handlePrintIncident(inc)} className="p-2 text-blue-600 bg-blue-50 rounded hover:bg-blue-100"><Printer size={16}/></button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {/* 4. CARTABLE (APPROVALS) */}
                {activeTab === 'cartable' && (
                    <div className="p-4">
                        <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><UserCheck size={20}/> کارتابل تایید ({getCartableItems().length})</h3>
                        <div className="space-y-3">
                            {getCartableItems().map((item, idx) => (
                                <div key={idx} className="border p-4 rounded-xl flex justify-between items-center hover:bg-orange-50 transition-colors bg-white">
                                    <div>
                                        <div className="font-bold text-sm mb-1">
                                            {item.type === 'log' ? `تردد: ${item.driverName} (${item.plateNumber})` : item.type === 'delay' ? `تاخیر: ${item.personnelName}` : `واقعه: ${item.subject}`}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            تاریخ: {formatDate(item.date)} | وضعیت فعلی: {item.status}
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleApprove(item)} className="bg-green-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-green-700">تایید</button>
                                        <button onClick={() => handleReject(item)} className="bg-red-100 text-red-600 px-4 py-2 rounded-lg text-xs font-bold hover:bg-red-200">رد</button>
                                    </div>
                                </div>
                            ))}
                            {getCartableItems().length === 0 && <div className="text-center text-gray-400 py-10">کارتابل شما خالی است.</div>}
                        </div>
                    </div>
                )}

                {/* 5. ARCHIVE */}
                {activeTab === 'archive' && (
                    <div className="p-4">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-gray-700 flex items-center gap-2"><Archive size={20}/> بایگانی اسناد نهایی شده</h3>
                            <div className="relative w-64">
                                <Search className="absolute right-3 top-2.5 text-gray-400" size={16}/>
                                <input className="w-full border rounded-lg pl-4 pr-10 py-2 text-sm" placeholder="جستجو..."/>
                            </div>
                        </div>
                        <div className="space-y-2">
                            {getArchivedItems().map((item, idx) => (
                                <div key={idx} className="border p-3 rounded-lg flex justify-between items-center bg-gray-50">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${item.type==='log'?'bg-blue-100 text-blue-600':item.type==='delay'?'bg-orange-100 text-orange-600':'bg-red-100 text-red-600'}`}>
                                            {item.type==='log'?<Truck size={16}/>:item.type==='delay'?<Clock size={16}/>:<AlertTriangle size={16}/>}
                                        </div>
                                        <div className="text-sm">
                                            <span className="font-bold">{item.type === 'log' ? item.driverName : item.type === 'delay' ? item.personnelName : item.subject}</span>
                                            <span className="text-xs text-gray-500 mx-2">{formatDate(item.date)}</span>
                                        </div>
                                    </div>
                                    <button onClick={() => { if(item.type==='incident') handlePrintIncident(item); else alert('فقط وقایع تکی چاپ می‌شوند. برای گزارش روزانه به تب مربوطه بروید.'); }} className="text-gray-400 hover:text-blue-600"><Eye size={18}/></button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* CREATE MODAL */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 animate-scale-in max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6 border-b pb-4">
                            <h3 className="font-bold text-lg text-gray-800">
                                {activeTab === 'logs' ? 'ثبت تردد در فرم گزارش نگهبانی' : activeTab === 'delays' ? 'ثبت در فرم تاخیر پرسنل' : 'ثبت گزارش واقعه جدید'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-red-500"><XCircle size={24}/></button>
                        </div>

                        {activeTab === 'logs' && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="text-xs font-bold block mb-1">مبدا</label><input className="w-full border rounded p-2" value={logForm.origin} onChange={e=>setLogForm({...logForm, origin: e.target.value})}/></div>
                                    <div><label className="text-xs font-bold block mb-1">مقصد</label><input className="w-full border rounded p-2" value={logForm.destination} onChange={e=>setLogForm({...logForm, destination: e.target.value})}/></div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="text-xs font-bold block mb-1">ساعت ورود</label><input className="w-full border rounded p-2 text-center dir-ltr" placeholder="08:00" value={logForm.entryTime} onChange={e=>setLogForm({...logForm, entryTime: e.target.value})}/></div>
                                    <div><label className="text-xs font-bold block mb-1">ساعت خروج</label><input className="w-full border rounded p-2 text-center dir-ltr" placeholder="10:30" value={logForm.exitTime} onChange={e=>setLogForm({...logForm, exitTime: e.target.value})}/></div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="text-xs font-bold block mb-1">نام و نام خانوادگی راننده</label><input className="w-full border rounded p-2" value={logForm.driverName} onChange={e=>setLogForm({...logForm, driverName: e.target.value})}/></div>
                                    <div><label className="text-xs font-bold block mb-1">شماره خودرو</label><input className="w-full border rounded p-2 dir-ltr text-center" value={logForm.plateNumber} onChange={e=>setLogForm({...logForm, plateNumber: e.target.value})}/></div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="text-xs font-bold block mb-1">مشخصات کالا</label><input className="w-full border rounded p-2" value={logForm.goodsName} onChange={e=>setLogForm({...logForm, goodsName: e.target.value})}/></div>
                                    <div><label className="text-xs font-bold block mb-1">مقدار</label><input className="w-full border rounded p-2" value={logForm.quantity} onChange={e=>setLogForm({...logForm, quantity: e.target.value})}/></div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="text-xs font-bold block mb-1">گیرنده کالا</label><input className="w-full border rounded p-2" value={logForm.receiver} onChange={e=>setLogForm({...logForm, receiver: e.target.value})}/></div>
                                    <div><label className="text-xs font-bold block mb-1">مجوز دهنده</label><input className="w-full border rounded p-2" placeholder="مدیریت..." value={logForm.permitProvider} onChange={e=>setLogForm({...logForm, permitProvider: e.target.value})}/></div>
                                </div>
                                <div><label className="text-xs font-bold block mb-1">موارد انجام کار</label><input className="w-full border rounded p-2" value={logForm.workDescription} onChange={e=>setLogForm({...logForm, workDescription: e.target.value})}/></div>
                                <button onClick={handleSaveLog} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold mt-4 hover:bg-blue-700">ثبت در دفتر نگهبانی</button>
                            </div>
                        )}

                        {activeTab === 'delays' && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="text-xs font-bold block mb-1">نام و نام خانوادگی</label><input className="w-full border rounded p-2" value={delayForm.personnelName} onChange={e=>setDelayForm({...delayForm, personnelName: e.target.value})}/></div>
                                    <div><label className="text-xs font-bold block mb-1">واحد</label><input className="w-full border rounded p-2" value={delayForm.unit} onChange={e=>setDelayForm({...delayForm, unit: e.target.value})}/></div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="text-xs font-bold block mb-1">ساعت ورود</label><input className="w-full border rounded p-2 text-center dir-ltr" value={delayForm.arrivalTime} onChange={e=>setDelayForm({...delayForm, arrivalTime: e.target.value})}/></div>
                                    <div><label className="text-xs font-bold block mb-1">مدت تاخیر</label><input className="w-full border rounded p-2 text-center" placeholder="15 دقیقه" value={delayForm.delayAmount} onChange={e=>setDelayForm({...delayForm, delayAmount: e.target.value})}/></div>
                                </div>
                                <button onClick={handleSaveDelay} className="w-full bg-orange-600 text-white py-3 rounded-lg font-bold mt-4 hover:bg-orange-700">ثبت در دفتر تاخیرات</button>
                            </div>
                        )}

                        {activeTab === 'incidents' && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="text-xs font-bold block mb-1">موضوع گزارش</label><input className="w-full border rounded p-2" value={incidentForm.subject} onChange={e=>setIncidentForm({...incidentForm, subject: e.target.value})}/></div>
                                    <div><label className="text-xs font-bold block mb-1">شیفت</label><select className="w-full border rounded p-2" value={incidentForm.shift} onChange={e=>setIncidentForm({...incidentForm, shift: e.target.value})}><option>صبح</option><option>عصر</option><option>شب</option></select></div>
                                </div>
                                <div><label className="text-xs font-bold block mb-1">شرح دقیق موضوع</label><textarea className="w-full border rounded p-2 h-40 resize-none" value={incidentForm.description} onChange={e=>setIncidentForm({...incidentForm, description: e.target.value})}/></div>
                                <div><label className="text-xs font-bold block mb-1">شهود</label><input className="w-full border rounded p-2" placeholder="نام شهود..." value={incidentForm.witnesses} onChange={e=>setIncidentForm({...incidentForm, witnesses: e.target.value})}/></div>
                                <button onClick={handleSaveIncident} className="w-full bg-red-600 text-white py-3 rounded-lg font-bold mt-4 hover:bg-red-700">ثبت و ارسال گزارش</button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SecurityModule;
