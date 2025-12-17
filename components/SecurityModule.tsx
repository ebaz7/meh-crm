
import React, { useState, useEffect } from 'react';
import { User, SecurityLog, PersonnelDelay, SecurityIncident, SecurityStatus, UserRole } from '../types';
import { getSecurityLogs, saveSecurityLog, updateSecurityLog, getPersonnelDelays, savePersonnelDelay, updatePersonnelDelay, getSecurityIncidents, saveSecurityIncident, updateSecurityIncident } from '../services/storageService';
import { generateUUID, getCurrentShamsiDate, jalaliToGregorian, formatDate } from '../constants';
import { Shield, Plus, CheckCircle, XCircle, Clock, Truck, FileText, AlertTriangle, UserCheck, Eye } from 'lucide-react';

interface Props {
    currentUser: User;
}

const SecurityModule: React.FC<Props> = ({ currentUser }) => {
    const [activeTab, setActiveTab] = useState<'logs' | 'delays' | 'incidents'>('logs');
    
    // Data State
    const [logs, setLogs] = useState<SecurityLog[]>([]);
    const [delays, setDelays] = useState<PersonnelDelay[]>([]);
    const [incidents, setIncidents] = useState<SecurityIncident[]>([]);
    const [loading, setLoading] = useState(true);

    // Form States
    const [showModal, setShowModal] = useState(false);
    
    // 1. Log Form
    const [logForm, setLogForm] = useState<Partial<SecurityLog>>({});
    // 2. Delay Form
    const [delayForm, setDelayForm] = useState<Partial<PersonnelDelay>>({});
    // 3. Incident Form
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

    // --- PERMISSION HELPERS ---
    const canCreate = ['admin', 'security_guard', 'security_head'].includes(currentUser.role) || currentUser.role === UserRole.USER; // Allow basic users or specialized roles
    
    const canApprove = (currentStatus: SecurityStatus) => {
        const r = currentUser.role;
        if (r === UserRole.ADMIN) return true;
        if (currentStatus === SecurityStatus.PENDING_SUPERVISOR && r === UserRole.SECURITY_HEAD) return true;
        if (currentStatus === SecurityStatus.PENDING_FACTORY && r === UserRole.FACTORY_MANAGER) return true;
        if (currentStatus === SecurityStatus.PENDING_CEO && r === UserRole.CEO) return true;
        return false;
    };

    // --- ACTIONS ---
    const handleSaveLog = async () => {
        const date = new Date().toISOString();
        const newLog: SecurityLog = {
            id: generateUUID(),
            rowNumber: logs.length + 1,
            date: logForm.date || date,
            shift: logForm.shift || 'صبح',
            type: logForm.type || 'Entry',
            time: logForm.time || new Date().toLocaleTimeString('fa-IR'),
            originDestination: logForm.originDestination || '',
            driverName: logForm.driverName || '',
            plateNumber: logForm.plateNumber || '',
            goodsName: logForm.goodsName || '',
            quantity: logForm.quantity || '',
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
            date: delayForm.date || new Date().toISOString(),
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
            reportNumber: incidents.length + 1,
            date: incidentForm.date || new Date().toISOString(),
            subject: incidentForm.subject || '',
            description: incidentForm.description || '',
            shift: incidentForm.shift || 'صبح',
            registrant: currentUser.fullName,
            status: SecurityStatus.PENDING_SUPERVISOR,
            createdAt: Date.now()
        };
        await saveSecurityIncident(newInc);
        setShowModal(false); setIncidentForm({}); loadData();
    };

    const handleApproveItem = async (item: any, type: 'log'|'delay'|'incident') => {
        let nextStatus = item.status;
        let updates: any = {};

        // Determine Next Status & Signer
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

        if (type === 'log') await updateSecurityLog({ ...item, ...updates });
        else if (type === 'delay') await updatePersonnelDelay({ ...item, ...updates });
        else await updateSecurityIncident({ ...item, ...updates });
        
        loadData();
    };

    const handleRejectItem = async (item: any, type: 'log'|'delay'|'incident') => {
        const reason = prompt("دلیل رد:");
        if (reason) {
            const updates = { status: SecurityStatus.REJECTED, rejectionReason: reason };
            if (type === 'log') await updateSecurityLog({ ...item, ...updates });
            else if (type === 'delay') await updatePersonnelDelay({ ...item, ...updates });
            else await updateSecurityIncident({ ...item, ...updates });
            loadData();
        }
    };

    const getStatusBadge = (status: SecurityStatus) => {
        switch(status) {
            case SecurityStatus.PENDING_SUPERVISOR: return <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-[10px]">منتظر سرپرست</span>;
            case SecurityStatus.PENDING_FACTORY: return <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-[10px]">منتظر مدیر کارخانه</span>;
            case SecurityStatus.PENDING_CEO: return <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-[10px]">منتظر مدیرعامل</span>;
            case SecurityStatus.ARCHIVED: return <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-[10px]">نهایی شد</span>;
            case SecurityStatus.REJECTED: return <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-[10px]">رد شده</span>;
        }
    };

    return (
        <div className="p-4 md:p-6 bg-gray-50 h-[calc(100vh-100px)] overflow-y-auto animate-fade-in">
            
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <Shield className="text-blue-600"/> واحد انتظامات و حراست
                </h1>
                <div className="flex bg-white p-1 rounded-xl shadow-sm">
                    <button onClick={() => setActiveTab('logs')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'logs' ? 'bg-blue-600 text-white shadow' : 'text-gray-600 hover:bg-gray-50'}`}>گزارش تردد</button>
                    <button onClick={() => setActiveTab('delays')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'delays' ? 'bg-orange-600 text-white shadow' : 'text-gray-600 hover:bg-gray-50'}`}>تاخیر پرسنل</button>
                    <button onClick={() => setActiveTab('incidents')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'incidents' ? 'bg-red-600 text-white shadow' : 'text-gray-600 hover:bg-gray-50'}`}>گزارش وقایع</button>
                </div>
            </div>

            {/* Content Area */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50/50">
                    <h2 className="font-bold text-gray-700 flex items-center gap-2">
                        {activeTab === 'logs' && <><Truck size={20}/> دفتر گزارش نگهبانی (ورود و خروج کالا/خودرو)</>}
                        {activeTab === 'delays' && <><Clock size={20}/> دفتر ثبت تاخیرات پرسنل</>}
                        {activeTab === 'incidents' && <><AlertTriangle size={20}/> گزارش وقایع و حوادث</>}
                    </h2>
                    {canCreate && (
                        <button onClick={() => setShowModal(true)} className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm hover:bg-green-700 shadow-sm">
                            <Plus size={16}/> ثبت جدید
                        </button>
                    )}
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right">
                        <thead className="bg-gray-100 text-gray-600 font-bold">
                            {activeTab === 'logs' && (
                                <tr>
                                    <th className="p-4">ردیف</th>
                                    <th className="p-4">نوع</th>
                                    <th className="p-4">ساعت</th>
                                    <th className="p-4">مبدا / مقصد</th>
                                    <th className="p-4">مشخصات خودرو</th>
                                    <th className="p-4">کالا</th>
                                    <th className="p-4">وضعیت</th>
                                    <th className="p-4 text-center">عملیات</th>
                                </tr>
                            )}
                            {activeTab === 'delays' && (
                                <tr>
                                    <th className="p-4">تاریخ</th>
                                    <th className="p-4">نام پرسنل</th>
                                    <th className="p-4">واحد</th>
                                    <th className="p-4">ساعت ورود</th>
                                    <th className="p-4">میزان تاخیر</th>
                                    <th className="p-4">وضعیت</th>
                                    <th className="p-4 text-center">عملیات</th>
                                </tr>
                            )}
                            {activeTab === 'incidents' && (
                                <tr>
                                    <th className="p-4">شماره</th>
                                    <th className="p-4">تاریخ</th>
                                    <th className="p-4">موضوع</th>
                                    <th className="p-4">شیفت</th>
                                    <th className="p-4">ثبت کننده</th>
                                    <th className="p-4">وضعیت</th>
                                    <th className="p-4 text-center">عملیات</th>
                                </tr>
                            )}
                        </thead>
                        <tbody className="divide-y">
                            {activeTab === 'logs' && logs.map((log, idx) => (
                                <tr key={log.id} className="hover:bg-gray-50">
                                    <td className="p-4">{log.rowNumber || idx + 1}</td>
                                    <td className="p-4"><span className={`px-2 py-1 rounded text-xs font-bold ${log.type==='Entry'?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>{log.type === 'Entry' ? 'ورود' : 'خروج'}</span></td>
                                    <td className="p-4 font-mono">{log.time}</td>
                                    <td className="p-4">{log.originDestination}</td>
                                    <td className="p-4 text-xs"><div>{log.driverName}</div><div className="font-mono">{log.plateNumber}</div></td>
                                    <td className="p-4">{log.goodsName} ({log.quantity})</td>
                                    <td className="p-4">{getStatusBadge(log.status)}</td>
                                    <td className="p-4 text-center flex justify-center gap-2">
                                        {canApprove(log.status) && <button onClick={() => handleApproveItem(log, 'log')} className="text-green-600 hover:bg-green-50 p-1 rounded"><CheckCircle size={18}/></button>}
                                        {canApprove(log.status) && <button onClick={() => handleRejectItem(log, 'log')} className="text-red-600 hover:bg-red-50 p-1 rounded"><XCircle size={18}/></button>}
                                    </td>
                                </tr>
                            ))}
                            
                            {activeTab === 'delays' && delays.map((del) => (
                                <tr key={del.id} className="hover:bg-gray-50">
                                    <td className="p-4">{formatDate(del.date)}</td>
                                    <td className="p-4 font-bold">{del.personnelName}</td>
                                    <td className="p-4">{del.unit}</td>
                                    <td className="p-4 font-mono">{del.arrivalTime}</td>
                                    <td className="p-4 font-mono text-red-600 font-bold">{del.delayAmount}</td>
                                    <td className="p-4">{getStatusBadge(del.status)}</td>
                                    <td className="p-4 text-center flex justify-center gap-2">
                                        {canApprove(del.status) && <button onClick={() => handleApproveItem(del, 'delay')} className="text-green-600 hover:bg-green-50 p-1 rounded"><CheckCircle size={18}/></button>}
                                        {canApprove(del.status) && <button onClick={() => handleRejectItem(del, 'delay')} className="text-red-600 hover:bg-red-50 p-1 rounded"><XCircle size={18}/></button>}
                                    </td>
                                </tr>
                            ))}

                            {activeTab === 'incidents' && incidents.map((inc) => (
                                <tr key={inc.id} className="hover:bg-gray-50">
                                    <td className="p-4">{inc.reportNumber}</td>
                                    <td className="p-4">{formatDate(inc.date)}</td>
                                    <td className="p-4 font-bold">{inc.subject}</td>
                                    <td className="p-4">{inc.shift}</td>
                                    <td className="p-4">{inc.registrant}</td>
                                    <td className="p-4">{getStatusBadge(inc.status)}</td>
                                    <td className="p-4 text-center flex justify-center gap-2">
                                        {canApprove(inc.status) && <button onClick={() => handleApproveItem(inc, 'incident')} className="text-green-600 hover:bg-green-50 p-1 rounded"><CheckCircle size={18}/></button>}
                                        {canApprove(inc.status) && <button onClick={() => handleRejectItem(inc, 'incident')} className="text-red-600 hover:bg-red-50 p-1 rounded"><XCircle size={18}/></button>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 animate-scale-in max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-lg text-gray-800">
                                {activeTab === 'logs' ? 'ثبت تردد جدید' : activeTab === 'delays' ? 'ثبت تاخیر پرسنل' : 'ثبت گزارش واقعه'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-red-500"><XCircle size={24}/></button>
                        </div>

                        {/* LOG FORM */}
                        {activeTab === 'logs' && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="text-xs font-bold block mb-1">نوع تردد</label><select className="w-full border rounded p-2" value={logForm.type} onChange={e=>setLogForm({...logForm, type: e.target.value as any})}><option value="Entry">ورود</option><option value="Exit">خروج</option></select></div>
                                    <div><label className="text-xs font-bold block mb-1">شیفت</label><select className="w-full border rounded p-2" value={logForm.shift} onChange={e=>setLogForm({...logForm, shift: e.target.value})}><option>صبح</option><option>عصر</option><option>شب</option></select></div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="text-xs font-bold block mb-1">مبدا / مقصد</label><input className="w-full border rounded p-2" value={logForm.originDestination} onChange={e=>setLogForm({...logForm, originDestination: e.target.value})}/></div>
                                    <div><label className="text-xs font-bold block mb-1">ساعت</label><input className="w-full border rounded p-2" value={logForm.time} onChange={e=>setLogForm({...logForm, time: e.target.value})}/></div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="text-xs font-bold block mb-1">نام راننده</label><input className="w-full border rounded p-2" value={logForm.driverName} onChange={e=>setLogForm({...logForm, driverName: e.target.value})}/></div>
                                    <div><label className="text-xs font-bold block mb-1">شماره پلاک</label><input className="w-full border rounded p-2 dir-ltr" value={logForm.plateNumber} onChange={e=>setLogForm({...logForm, plateNumber: e.target.value})}/></div>
                                </div>
                                <div><label className="text-xs font-bold block mb-1">مشخصات کالا</label><input className="w-full border rounded p-2" placeholder="نام کالا" value={logForm.goodsName} onChange={e=>setLogForm({...logForm, goodsName: e.target.value})}/></div>
                                <div><label className="text-xs font-bold block mb-1">تعداد / مقدار</label><input className="w-full border rounded p-2" placeholder="5 عدد..." value={logForm.quantity} onChange={e=>setLogForm({...logForm, quantity: e.target.value})}/></div>
                                <button onClick={handleSaveLog} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold mt-4">ثبت گزارش</button>
                            </div>
                        )}

                        {/* DELAY FORM */}
                        {activeTab === 'delays' && (
                            <div className="space-y-4">
                                <div><label className="text-xs font-bold block mb-1">نام پرسنل</label><input className="w-full border rounded p-2" value={delayForm.personnelName} onChange={e=>setDelayForm({...delayForm, personnelName: e.target.value})}/></div>
                                <div><label className="text-xs font-bold block mb-1">واحد / بخش</label><input className="w-full border rounded p-2" value={delayForm.unit} onChange={e=>setDelayForm({...delayForm, unit: e.target.value})}/></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="text-xs font-bold block mb-1">ساعت ورود</label><input className="w-full border rounded p-2 dir-ltr" placeholder="08:15" value={delayForm.arrivalTime} onChange={e=>setDelayForm({...delayForm, arrivalTime: e.target.value})}/></div>
                                    <div><label className="text-xs font-bold block mb-1">میزان تاخیر</label><input className="w-full border rounded p-2" placeholder="15 دقیقه" value={delayForm.delayAmount} onChange={e=>setDelayForm({...delayForm, delayAmount: e.target.value})}/></div>
                                </div>
                                <button onClick={handleSaveDelay} className="w-full bg-orange-600 text-white py-3 rounded-lg font-bold mt-4">ثبت تاخیر</button>
                            </div>
                        )}

                        {/* INCIDENT FORM */}
                        {activeTab === 'incidents' && (
                            <div className="space-y-4">
                                <div><label className="text-xs font-bold block mb-1">موضوع گزارش</label><input className="w-full border rounded p-2" value={incidentForm.subject} onChange={e=>setIncidentForm({...incidentForm, subject: e.target.value})}/></div>
                                <div><label className="text-xs font-bold block mb-1">شیفت</label><select className="w-full border rounded p-2" value={incidentForm.shift} onChange={e=>setIncidentForm({...incidentForm, shift: e.target.value})}><option>صبح</option><option>عصر</option><option>شب</option></select></div>
                                <div><label className="text-xs font-bold block mb-1">شرح دقیق موضوع</label><textarea className="w-full border rounded p-2 h-32" value={incidentForm.description} onChange={e=>setIncidentForm({...incidentForm, description: e.target.value})}/></div>
                                <button onClick={handleSaveIncident} className="w-full bg-red-600 text-white py-3 rounded-lg font-bold mt-4">ثبت گزارش واقعه</button>
                            </div>
                        )}

                    </div>
                </div>
            )}
        </div>
    );
};

export default SecurityModule;
