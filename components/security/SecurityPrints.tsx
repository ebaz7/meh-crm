
import React from 'react';
import { SecurityLog, PersonnelDelay, SecurityIncident, DailySecurityMeta } from '../../types';
import { formatDate } from '../../constants';
import PrintPersonnelDelayForm from './PrintPersonnelDelayForm';

interface DailyLogProps {
    date: string;
    logs: SecurityLog[];
    meta?: DailySecurityMeta; // New prop for shift info/notes
}

export const PrintSecurityDailyLog: React.FC<DailyLogProps> = ({ date, logs, meta }) => {
    // Fill empty rows if less than 15 for full page feel
    const displayLogs = [...logs];
    while (displayLogs.length < 15) {
        displayLogs.push({} as any);
    }

    // Factory Manager Stamp logic
    const factoryApproved = meta?.isFactoryDailyApproved === true;
    const factoryApproverName = logs.find(l => l.approverFactory)?.approverFactory?.split(' ')[0] || 'مدیریت';

    // CEO Stamp logic
    const ceoApproved = meta?.isCeoDailyApproved === true;

    return (
        <div className="w-[297mm] h-[210mm] bg-white p-5 mx-auto text-black font-sans relative box-border" style={{ direction: 'rtl' }}>
            {/* Main Border */}
            <div className="border-2 border-black h-full flex flex-col">
                
                {/* 1. Header */}
                <div className="flex h-24 border-b-2 border-black">
                    {/* Right: Date/Number */}
                    <div className="w-[15%] border-l-2 border-black p-2 flex flex-col justify-center text-sm font-bold gap-2">
                        <div className="flex justify-between"><span>شماره:</span><span>........</span></div>
                        <div className="flex justify-between"><span>تاریخ:</span><span className="font-mono text-base">{formatDate(date)}</span></div>
                        <div className="flex justify-between"><span>پیوست:</span><span>........</span></div>
                    </div>
                    
                    {/* Center: Title */}
                    <div className="w-[70%] flex flex-col items-center justify-center border-l-2 border-black bg-gray-50">
                        <h1 className="text-2xl font-black mb-2">گروه تولیدی</h1>
                        <h2 className="text-xl font-bold bg-white px-6 py-1.5 rounded border-2 border-black shadow-sm">فرم گزارش روزانه نگهبانی</h2>
                    </div>

                    {/* Left: Logo Area */}
                    <div className="w-[15%] flex items-center justify-center p-2">
                        <div className="border-2 border-dashed border-gray-300 w-full h-full flex items-center justify-center text-gray-300 text-xs font-bold rounded">
                            محل لوگو
                        </div>
                    </div>
                </div>

                {/* 2. Main Table */}
                <div className="flex-1 overflow-hidden">
                    <table className="w-full h-full border-collapse text-[10px] text-center table-fixed">
                        <thead>
                            <tr className="bg-gray-200 h-10">
                                <th rowSpan={2} className="border border-black w-8">ردیف</th>
                                <th rowSpan={2} className="border border-black w-24">مبدا</th>
                                <th colSpan={2} className="border border-black w-24">ساعت</th>
                                <th colSpan={2} className="border border-black">نام و شماره خودرو</th>
                                <th rowSpan={2} className="border border-black w-24">مجوز دهنده</th>
                                <th colSpan={2} className="border border-black">مشخصات کالا</th>
                                <th rowSpan={2} className="border border-black w-24">مقصد</th>
                                <th rowSpan={2} className="border border-black w-24">گیرنده کالا</th>
                                <th rowSpan={2} className="border border-black w-40">موارد انجام کار</th>
                            </tr>
                            <tr className="bg-gray-200 h-8">
                                <th className="border border-black">ورود</th>
                                <th className="border border-black">خروج</th>
                                <th className="border border-black">نام راننده</th>
                                <th className="border border-black">پلاک</th>
                                <th className="border border-black">نام کالا</th>
                                <th className="border border-black w-12">تعداد</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayLogs.map((log, index) => (
                                <tr key={index} className="h-8">
                                    <td className="border border-black font-bold">{log.id ? index + 1 : ''}</td>
                                    <td className="border border-black truncate px-1 font-bold">{log.origin}</td>
                                    <td className="border border-black font-mono font-bold text-[11px]">{log.entryTime}</td>
                                    <td className="border border-black font-mono font-bold text-[11px]">{log.exitTime}</td>
                                    <td className="border border-black truncate px-1">{log.driverName}</td>
                                    <td className="border border-black font-mono dir-ltr px-1">{log.plateNumber}</td>
                                    <td className="border border-black truncate px-1">{log.permitProvider}</td>
                                    <td className="border border-black text-right pr-1 truncate">{log.goodsName}</td>
                                    <td className="border border-black font-mono font-bold">{log.quantity}</td>
                                    <td className="border border-black truncate px-1">{log.destination}</td>
                                    <td className="border border-black truncate px-1">{log.receiver}</td>
                                    <td className="border border-black text-right pr-1 truncate">{log.workDescription}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* 3. Footer / Notes / Signatures */}
                <div className="h-32 border-t-2 border-black flex flex-col">
                    {/* Notes */}
                    <div className="h-12 border-b border-black p-1 flex relative">
                        <span className="text-[10px] font-bold underline shrink-0 ml-2">توضیحات و وقایع شیفت:</span>
                        <div className="text-[10px] flex-1 leading-tight overflow-hidden text-right pr-1 font-medium">
                            {meta?.dailyDescription}
                        </div>
                    </div>

                    {/* Signatures */}
                    <div className="flex-1 flex text-[10px]">
                        <div className="w-1/4 border-l border-black p-1 text-center flex flex-col justify-between">
                            <span className="font-bold block border-b border-gray-400 pb-1 mb-1">نگهبان شیفت</span>
                            <div className="grid grid-cols-3 gap-1 h-full text-[8px]">
                                <div className="flex flex-col justify-end items-center"><span>صبح</span><div className="font-bold h-4 whitespace-nowrap">{meta?.morningGuard?.name}</div></div>
                                <div className="flex flex-col justify-end items-center border-r border-gray-300"><span>عصر</span><div className="font-bold h-4 whitespace-nowrap">{meta?.eveningGuard?.name}</div></div>
                                <div className="flex flex-col justify-end items-center border-r border-gray-300"><span>شب</span><div className="font-bold h-4 whitespace-nowrap">{meta?.nightGuard?.name}</div></div>
                            </div>
                        </div>
                        <div className="w-1/4 border-l border-black p-1 text-center flex flex-col justify-between bg-yellow-50/30">
                            <span className="font-bold block border-b border-gray-400 pb-1">سرپرست انتظامات</span>
                            {logs.some(l => l.approverSupervisor) && <div className="font-bold text-blue-800 rotate-[-5deg] text-xs opacity-70 mt-2 border-2 border-blue-800 inline-block px-2 rounded">تایید شد</div>}
                            <span className="text-[9px] text-gray-400 mt-auto">محل امضاء</span>
                        </div>
                        <div className="w-1/4 border-l border-black p-1 text-center flex flex-col justify-between bg-blue-50/30">
                            <span className="font-bold block border-b border-gray-400 pb-1">مدیر کارخانه</span>
                            {factoryApproved && <div className="font-bold text-green-800 rotate-[-5deg] text-xs opacity-70 mt-2 border-2 border-green-800 inline-block px-2 rounded">تایید شد</div>}
                            <span className="text-[9px] text-gray-400 mt-auto">محل امضاء</span>
                        </div>
                        <div className="w-1/4 p-1 text-center flex flex-col justify-between bg-purple-50/30">
                            <span className="font-bold block border-b border-gray-400 pb-1">مدیر عامل</span>
                            {ceoApproved && <div className="font-bold text-purple-800 rotate-[-5deg] text-xs opacity-70 mt-2 border-2 border-purple-800 inline-block px-2 rounded">تایید نهایی</div>}
                            <span className="text-[9px] text-gray-400 mt-auto">محل امضاء</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const PrintPersonnelDelay: React.FC<{ delays: PersonnelDelay[], meta?: DailySecurityMeta }> = ({ delays, meta }) => {
    // If no delays, create a placeholder
    const safeDelays = delays.length > 0 ? delays : [{ date: new Date().toISOString() } as PersonnelDelay];
    return <PrintPersonnelDelayForm delays={delays} date={safeDelays[0].date} meta={meta} />;
};

export const PrintIncidentReport: React.FC<{ incident: SecurityIncident }> = ({ incident }) => {
    return (
        <div className="w-[210mm] h-[297mm] bg-white p-8 mx-auto text-black font-sans relative" style={{ direction: 'rtl' }}>
            <div className="border-2 border-black h-full flex flex-col p-1">
                <div className="flex border-b-2 border-black pb-2 mb-2">
                    <div className="w-1/3 text-right">
                        <div className="font-bold text-lg">شماره: {incident.reportNumber}</div>
                        <div className="font-bold">تاریخ: {formatDate(incident.date)}</div>
                    </div>
                    <div className="w-1/3 text-center">
                        <h1 className="text-2xl font-black bg-gray-200 p-2 rounded border border-black">فرم گزارش واحد انتظامات</h1>
                    </div>
                    <div className="w-1/3 text-left pl-2">
                        <div className="font-bold">گروه تولیدی</div>
                    </div>
                </div>

                <div className="flex justify-between mb-4 border-b border-black pb-2">
                    <div><span className="font-bold">گزارش کننده:</span> {incident.registrant}</div>
                    <div><span className="font-bold">موضوع گزارش:</span> {incident.subject}</div>
                    <div><span className="font-bold">شماره گزارش:</span> {incident.reportNumber}</div>
                    <div><span className="font-bold">شیفت / ساعت:</span> {incident.shift}</div>
                </div>

                <div className="flex-1 border border-black p-4 relative">
                    <h3 className="font-bold border-b border-black inline-block mb-2">شرح دقیق موضوع:</h3>
                    <p className="leading-loose text-justify whitespace-pre-wrap">{incident.description}</p>
                </div>

                <div className="h-20 border-b border-black flex items-center p-2">
                    <span className="font-bold ml-2">شهود:</span> {incident.witnesses || '...................................................'}
                    <span className="font-bold mr-auto ml-2">نام و نام خانوادگی و امضاء گزارش کننده:</span>
                </div>

                <div className="h-16 border-b border-black flex items-center p-2">
                    <span className="font-bold ml-2">نظر سر شیفت:</span> {incident.shiftManagerOpinion || '................................'}
                </div>

                {/* Approvals */}
                <div className="grid grid-cols-1 border-b border-black">
                    <div className="h-24 border-b border-black p-2 relative grid grid-cols-2">
                        <div className="border-l border-black pr-2">
                            <span className="font-bold">سرپرست انتظامات:</span>
                            {incident.approverSupervisor && <div className="mt-4 border-2 border-blue-600 text-blue-600 p-1 rotate-[-5deg] font-bold rounded w-fit">تایید شد: {incident.approverSupervisor}</div>}
                        </div>
                        <div className="pr-2">
                            <span className="font-bold">دستور مدیریت:</span>
                            {incident.approverFactory && <div className="mt-4 border-2 border-green-600 text-green-600 p-1 rotate-[-5deg] font-bold rounded w-fit">دستور اقدام: {incident.approverFactory}</div>}
                        </div>
                    </div>
                    <div className="h-16 border-b border-black p-2">
                        <span className="font-bold">دستور مدیرعامل:</span>
                        {incident.approverCeo && <span className="mr-2 font-bold text-purple-700">{incident.approverCeo} (تایید نهایی)</span>}
                        <div className="float-left font-bold mt-4">امضاء:</div>
                    </div>
                    <div className="h-16 border-b border-black p-2">
                        <span className="font-bold">اقدام کارگزینی:</span> {incident.hrAction}
                        <div className="float-left font-bold mt-4">امضاء:</div>
                    </div>
                    <div className="h-16 p-2">
                        <span className="font-bold">اقدام ایمنی و بهداشت:</span> {incident.safetyAction}
                        <div className="float-left font-bold mt-4">امضاء:</div>
                    </div>
                </div>
            </div>
        </div>
    );
};
