
import React from 'react';
import { SecurityLog, PersonnelDelay, SecurityIncident, DailySecurityMeta } from '../../types';
import { formatDate } from '../../constants';
import PrintPersonnelDelayForm from './PrintPersonnelDelayForm';

interface DailyLogProps {
    date: string;
    logs: SecurityLog[];
    meta?: DailySecurityMeta; 
}

export const PrintSecurityDailyLog: React.FC<DailyLogProps> = ({ date, logs, meta }) => {
    // Fill empty rows to maintain A4 structure
    const displayLogs = [...logs];
    while (displayLogs.length < 18) {
        displayLogs.push({} as any);
    }

    // Extract Approver Names
    const supervisorName = logs.find(l => l.approverSupervisor)?.approverSupervisor;
    const factoryName = logs.find(l => l.approverFactory)?.approverFactory;
    const ceoName = logs.find(l => l.approverCeo)?.approverCeo;

    const Stamp = ({ title, name, color = 'blue' }: { title: string, name: string, color?: string }) => (
        <div className={`border-2 border-${color}-800 text-${color}-800 p-1 px-3 rounded-lg -rotate-6 inline-block opacity-90`} style={{ borderColor: color === 'green' ? '#166534' : color === 'purple' ? '#581c87' : '#1e40af', color: color === 'green' ? '#166534' : color === 'purple' ? '#581c87' : '#1e40af' }}>
            <div className="text-[9px] font-bold border-b border-current pb-0.5 mb-0.5">{title}</div>
            <div className="text-[11px] font-black">{name}</div>
        </div>
    );

    return (
        <div className="mx-auto bg-white p-0 text-black font-sans relative box-border" style={{ width: '297mm', height: '210mm', direction: 'rtl' }}>
            {/* Main Container with heavy border */}
            <div className="border-2 border-black h-full flex flex-col m-2">
                
                {/* 1. Header (Centered Layout) */}
                <div className="flex h-24 border-b-2 border-black">
                    {/* Right Box: Date/Number */}
                    <div className="w-48 border-l-2 border-black p-2 flex flex-col justify-center gap-1 text-xs font-bold bg-white">
                        <div className="flex justify-between items-center"><span>شماره:</span><span className="font-mono text-gray-400">........</span></div>
                        <div className="flex justify-between items-center"><span>تاریخ:</span><span className="font-mono font-bold text-sm">{formatDate(date)}</span></div>
                        <div className="flex justify-between items-center"><span>پیوست:</span><span className="font-mono text-gray-400">........</span></div>
                    </div>
                    
                    {/* Center Box: Title */}
                    <div className="flex-1 flex flex-col items-center justify-center bg-gray-50">
                        <h1 className="text-2xl font-black mb-2 tracking-wide">گروه تولیدی</h1>
                        <div className="border-2 border-black bg-white px-8 py-1.5 rounded-lg shadow-sm">
                            <h2 className="text-xl font-bold">فرم گزارش روزانه نگهبانی</h2>
                        </div>
                    </div>

                    {/* Left Box: Logo Area */}
                    <div className="w-48 border-r-2 border-black flex items-center justify-center p-2 bg-white">
                        <div className="border border-dashed border-gray-400 w-full h-full rounded flex items-center justify-center text-gray-300 font-bold text-sm">
                            محل درج لوگو
                        </div>
                    </div>
                </div>

                {/* 2. Main Table */}
                <div className="flex-1 overflow-hidden">
                    <table className="w-full h-full border-collapse text-[10px] text-center" style={{ tableLayout: 'fixed' }}>
                        <colgroup>
                            <col style={{ width: '30px' }} /> {/* Row */}
                            <col style={{ width: '80px' }} /> {/* Origin */}
                            <col style={{ width: '45px' }} /> {/* Entry */}
                            <col style={{ width: '45px' }} /> {/* Exit */}
                            <col style={{ width: '80px' }} /> {/* Driver */}
                            <col style={{ width: '70px' }} /> {/* Plate */}
                            <col style={{ width: '80px' }} /> {/* Permit */}
                            <col />                           {/* Goods */}
                            <col style={{ width: '40px' }} /> {/* Qty */}
                            <col style={{ width: '80px' }} /> {/* Dest */}
                            <col style={{ width: '80px' }} /> {/* Receiver */}
                            <col style={{ width: '120px' }} /> {/* Desc */}
                        </colgroup>
                        <thead>
                            <tr className="bg-gray-200 h-10">
                                <th rowSpan={2} className="border border-black">ردیف</th>
                                <th rowSpan={2} className="border border-black">مبدا</th>
                                <th colSpan={2} className="border border-black">ساعت</th>
                                <th colSpan={2} className="border border-black">مشخصات خودرو / راننده</th>
                                <th rowSpan={2} className="border border-black">مجوز دهنده</th>
                                <th colSpan={2} className="border border-black">مشخصات کالا</th>
                                <th rowSpan={2} className="border border-black">مقصد</th>
                                <th rowSpan={2} className="border border-black">تحویل گیرنده</th>
                                <th rowSpan={2} className="border border-black">توضیحات</th>
                            </tr>
                            <tr className="bg-gray-200 h-8">
                                <th className="border border-black">ورود</th>
                                <th className="border border-black">خروج</th>
                                <th className="border border-black">نام راننده</th>
                                <th className="border border-black">پلاک</th>
                                <th className="border border-black">نام کالا</th>
                                <th className="border border-black">تعداد</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayLogs.map((log, index) => (
                                <tr key={index} className="h-7 hover:bg-gray-50">
                                    <td className="border border-black font-bold">{log.id ? index + 1 : ''}</td>
                                    <td className="border border-black truncate px-1 font-bold">{log.origin}</td>
                                    <td className="border border-black font-mono font-bold text-[11px]">{log.entryTime}</td>
                                    <td className="border border-black font-mono font-bold text-[11px]">{log.exitTime}</td>
                                    <td className="border border-black truncate px-1">{log.driverName}</td>
                                    <td className="border border-black font-mono dir-ltr px-1">{log.plateNumber}</td>
                                    <td className="border border-black truncate px-1">{log.permitProvider}</td>
                                    <td className="border border-black text-right px-1 truncate font-medium">{log.goodsName}</td>
                                    <td className="border border-black font-mono font-bold">{log.quantity}</td>
                                    <td className="border border-black truncate px-1">{log.destination}</td>
                                    <td className="border border-black truncate px-1">{log.receiver}</td>
                                    <td className="border border-black text-right px-1 truncate">{log.workDescription}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* 3. Footer */}
                <div className="h-32 border-t-2 border-black flex flex-col">
                    <div className="h-10 border-b border-black p-1 flex items-start bg-gray-50">
                        <span className="text-[10px] font-bold underline shrink-0 ml-2 mt-0.5">توضیحات شیفت:</span>
                        <div className="text-[10px] flex-1 leading-tight text-right pr-1 font-medium line-clamp-2">
                            {meta?.dailyDescription}
                        </div>
                    </div>

                    <div className="flex-1 flex text-[10px]">
                        <div className="w-1/4 border-l border-black p-1 flex flex-col justify-between items-center text-center">
                            <span className="font-bold border-b border-gray-400 w-full pb-1 mb-1">نگهبانان شیفت</span>
                            <div className="grid grid-cols-3 w-full gap-1 text-[9px] h-full">
                                <div className="flex flex-col justify-end"><div className="text-gray-500 mb-auto">صبح</div><div className="font-bold h-4 whitespace-nowrap">{meta?.morningGuard?.name}</div></div>
                                <div className="border-r border-gray-300 flex flex-col justify-end"><div className="text-gray-500 mb-auto">عصر</div><div className="font-bold h-4 whitespace-nowrap">{meta?.eveningGuard?.name}</div></div>
                                <div className="border-r border-gray-300 flex flex-col justify-end"><div className="text-gray-500 mb-auto">شب</div><div className="font-bold h-4 whitespace-nowrap">{meta?.nightGuard?.name}</div></div>
                            </div>
                        </div>
                        <div className="w-1/4 border-l border-black p-1 flex flex-col justify-between items-center text-center bg-yellow-50/20">
                            <span className="font-bold border-b border-gray-400 w-full pb-1">سرپرست انتظامات</span>
                            {supervisorName ? <Stamp title="تایید شد" name={supervisorName} color="blue" /> : <div className="text-gray-300 mt-4 text-[9px]">(امضاء)</div>}
                        </div>
                        <div className="w-1/4 border-l border-black p-1 flex flex-col justify-between items-center text-center bg-blue-50/20">
                            <span className="font-bold border-b border-gray-400 w-full pb-1">مدیر کارخانه</span>
                            {factoryName ? <Stamp title="تایید نهایی" name={factoryName} color="green" /> : <div className="text-gray-300 mt-4 text-[9px]">(امضاء)</div>}
                        </div>
                        <div className="w-1/4 p-1 flex flex-col justify-between items-center text-center bg-purple-50/20">
                            <span className="font-bold border-b border-gray-400 w-full pb-1">مدیر عامل</span>
                            {ceoName ? <Stamp title="ملاحظه شد" name={ceoName} color="purple" /> : <div className="text-gray-300 mt-4 text-[9px]">(امضاء)</div>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const PrintPersonnelDelay: React.FC<{ delays: PersonnelDelay[], meta?: DailySecurityMeta }> = ({ delays, meta }) => {
    const safeDelays = delays.length > 0 ? delays : [{ date: new Date().toISOString() } as PersonnelDelay];
    return <PrintPersonnelDelayForm delays={delays} date={safeDelays[0].date} meta={meta} />;
};

export const PrintIncidentReport: React.FC<{ incident: SecurityIncident }> = ({ incident }) => {
    return (
        <div className="w-[210mm] h-[297mm] bg-white p-0 mx-auto text-black font-sans relative flex justify-center py-4 box-border" style={{ direction: 'rtl' }}>
            <div className="border-2 border-black w-[95%] h-[98%] flex flex-col p-1">
                <div className="flex border-b-2 border-black pb-2 mb-2 pt-2">
                    <div className="w-1/3 text-right pr-2">
                        <div className="font-bold text-lg">شماره: {incident.reportNumber}</div>
                        <div className="font-bold">تاریخ: {formatDate(incident.date)}</div>
                    </div>
                    <div className="w-1/3 text-center flex flex-col items-center justify-center">
                        <h1 className="text-2xl font-black bg-gray-200 px-4 py-1 rounded border border-black mb-1">فرم گزارش واحد انتظامات</h1>
                        <span className="text-xs font-bold text-gray-500">گروه تولیدی</span>
                    </div>
                    <div className="w-1/3 text-left pl-2 flex items-center justify-end">
                       <div className="border border-dashed border-gray-400 w-24 h-16 flex items-center justify-center text-xs text-gray-300">لوگو</div>
                    </div>
                </div>

                <div className="flex justify-between mb-4 border-b border-black pb-2 px-2">
                    <div><span className="font-bold">گزارش کننده:</span> {incident.registrant}</div>
                    <div><span className="font-bold">موضوع:</span> {incident.subject}</div>
                    <div><span className="font-bold">شیفت:</span> {incident.shift}</div>
                </div>

                <div className="flex-1 border border-black p-4 relative m-2 rounded-sm">
                    <h3 className="font-bold border-b border-black inline-block mb-4 text-lg">شرح دقیق موضوع:</h3>
                    <p className="leading-loose text-justify whitespace-pre-wrap text-sm font-medium">{incident.description}</p>
                </div>

                <div className="h-16 border-b border-black flex items-center p-2 mx-2">
                    <span className="font-bold ml-2">شهود:</span> {incident.witnesses || '...................................................'}
                </div>

                <div className="grid grid-cols-1 border-t-2 border-black mt-auto">
                    <div className="h-24 border-b border-black p-2 relative grid grid-cols-2">
                        <div className="border-l border-black pr-2">
                            <span className="font-bold block mb-2">سرپرست انتظامات:</span>
                            {incident.approverSupervisor && <div className="border-2 border-blue-600 text-blue-600 p-1 rotate-[-5deg] font-bold rounded w-fit text-sm opacity-80 border-double">تایید شد: {incident.approverSupervisor}</div>}
                        </div>
                        <div className="pr-2">
                            <span className="font-bold block mb-2">دستور مدیریت:</span>
                            {incident.approverFactory && <div className="border-2 border-green-600 text-green-600 p-1 rotate-[-5deg] font-bold rounded w-fit text-sm opacity-80 border-double">دستور اقدام: {incident.approverFactory}</div>}
                        </div>
                    </div>
                    <div className="h-16 border-b border-black p-2 bg-purple-50/30 flex justify-between items-center">
                        <span className="font-bold">دستور مدیرعامل:</span>
                        {incident.approverCeo && <span className="mr-2 font-black text-purple-800 text-lg border-2 border-purple-800 px-2 rounded rotate-[-2deg] opacity-80">{incident.approverCeo} (تایید نهایی)</span>}
                        <div className="font-bold text-xs text-gray-400">محل امضاء</div>
                    </div>
                    <div className="flex h-16">
                        <div className="w-1/2 border-l border-black p-2">
                            <span className="font-bold text-xs">اقدام کارگزینی:</span> 
                            <div className="text-right text-xs mt-1">{incident.hrAction}</div>
                        </div>
                        <div className="w-1/2 p-2">
                            <span className="font-bold text-xs">اقدام ایمنی:</span> 
                            <div className="text-right text-xs mt-1">{incident.safetyAction}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
