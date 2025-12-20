
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
        <div className="w-[297mm] h-[210mm] bg-white p-4 mx-auto text-black font-sans relative box-border" style={{ direction: 'rtl' }}>
            <div className="border-2 border-black h-full flex flex-col">
                
                {/* 1. Header */}
                <div className="flex h-20 border-b-2 border-black">
                    <div className="w-[15%] border-l-2 border-black p-2 flex flex-col justify-center text-[10px] font-bold gap-1">
                        <div className="flex justify-between"><span>شماره:</span><span>........</span></div>
                        <div className="flex justify-between"><span>تاریخ:</span><span className="font-mono font-bold text-xs">{formatDate(date)}</span></div>
                        <div className="flex justify-between"><span>پیوست:</span><span>........</span></div>
                    </div>
                    <div className="w-[70%] flex flex-col items-center justify-center border-l-2 border-black bg-gray-50">
                        <h1 className="text-xl font-black mb-1">گروه تولیدی</h1>
                        <h2 className="text-lg font-bold bg-white px-4 py-1 rounded border border-black shadow-sm">گزارش روزانه نگهبانی</h2>
                    </div>
                    <div className="w-[15%] flex items-center justify-center p-2">
                        <div className="border border-dashed border-gray-400 w-full h-full flex items-center justify-center text-gray-300 text-[10px] font-bold rounded">
                            محل لوگو
                        </div>
                    </div>
                </div>

                {/* 2. Main Table */}
                <div className="flex-1">
                    <table className="w-full border-collapse text-[10px] text-center" style={{ tableLayout: 'fixed' }}>
                        <thead>
                            <tr className="bg-gray-200">
                                <th rowSpan={2} className="border border-black w-8 py-1">ردیف</th>
                                <th rowSpan={2} className="border border-black w-24">مبدا</th>
                                <th colSpan={2} className="border border-black w-20">ساعت</th>
                                <th colSpan={2} className="border border-black">مشخصات خودرو / راننده</th>
                                <th rowSpan={2} className="border border-black w-24">مجوز دهنده</th>
                                <th colSpan={2} className="border border-black">مشخصات کالا</th>
                                <th rowSpan={2} className="border border-black w-24">مقصد</th>
                                <th rowSpan={2} className="border border-black w-24">تحویل گیرنده</th>
                                <th rowSpan={2} className="border border-black w-40">توضیحات</th>
                            </tr>
                            <tr className="bg-gray-200">
                                <th className="border border-black w-10">ورود</th>
                                <th className="border border-black w-10">خروج</th>
                                <th className="border border-black">نام راننده</th>
                                <th className="border border-black w-20">پلاک</th>
                                <th className="border border-black">نام کالا</th>
                                <th className="border border-black w-12">تعداد</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayLogs.map((log, index) => (
                                <tr key={index} style={{ height: '24px' }}>
                                    <td className="border border-black font-bold">{log.id ? index + 1 : ''}</td>
                                    <td className="border border-black truncate px-1 font-bold">{log.origin}</td>
                                    <td className="border border-black font-mono font-bold">{log.entryTime}</td>
                                    <td className="border border-black font-mono font-bold">{log.exitTime}</td>
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

                {/* 3. Footer */}
                <div className="h-32 border-t-2 border-black flex flex-col">
                    <div className="h-10 border-b border-black p-1 flex items-start">
                        <span className="text-[10px] font-bold underline shrink-0 ml-2">توضیحات شیفت:</span>
                        <div className="text-[10px] flex-1 leading-tight text-right pr-1 font-medium line-clamp-2">
                            {meta?.dailyDescription}
                        </div>
                    </div>

                    <div className="flex-1 flex text-[10px]">
                        <div className="w-1/4 border-l border-black p-1 flex flex-col justify-between items-center text-center">
                            <span className="font-bold border-b border-gray-400 w-full pb-1 mb-1">نگهبانان شیفت</span>
                            <div className="grid grid-cols-3 w-full gap-1 text-[9px]">
                                <div><div className="text-gray-500">صبح</div><div className="font-bold h-4">{meta?.morningGuard?.name}</div></div>
                                <div className="border-r border-gray-300"><div className="text-gray-500">عصر</div><div className="font-bold h-4">{meta?.eveningGuard?.name}</div></div>
                                <div className="border-r border-gray-300"><div className="text-gray-500">شب</div><div className="font-bold h-4">{meta?.nightGuard?.name}</div></div>
                            </div>
                        </div>
                        <div className="w-1/4 border-l border-black p-1 flex flex-col justify-between items-center text-center bg-yellow-50/20">
                            <span className="font-bold border-b border-gray-400 w-full pb-1">سرپرست انتظامات</span>
                            {supervisorName ? <Stamp title="تایید شد" name={supervisorName} color="blue" /> : <div className="text-gray-300 mt-4">محل امضاء</div>}
                        </div>
                        <div className="w-1/4 border-l border-black p-1 flex flex-col justify-between items-center text-center bg-blue-50/20">
                            <span className="font-bold border-b border-gray-400 w-full pb-1">مدیر کارخانه</span>
                            {factoryName ? <Stamp title="تایید نهایی" name={factoryName} color="green" /> : <div className="text-gray-300 mt-4">محل امضاء</div>}
                        </div>
                        <div className="w-1/4 p-1 flex flex-col justify-between items-center text-center bg-purple-50/20">
                            <span className="font-bold border-b border-gray-400 w-full pb-1">مدیر عامل</span>
                            {ceoName ? <Stamp title="ملاحظه شد" name={ceoName} color="purple" /> : <div className="text-gray-300 mt-4">محل امضاء</div>}
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
    // Existing Incident Report code remains... (it's mostly layout independent but can be tweaked if needed)
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

                <div className="grid grid-cols-1 border-b border-black">
                    <div className="h-24 border-b border-black p-2 relative grid grid-cols-2">
                        <div className="border-l border-black pr-2">
                            <span className="font-bold">سرپرست انتظامات:</span>
                            {incident.approverSupervisor && <div className="mt-4 border-2 border-blue-600 text-blue-600 p-1 rotate-[-5deg] font-bold rounded w-fit text-sm">تایید شد: {incident.approverSupervisor}</div>}
                        </div>
                        <div className="pr-2">
                            <span className="font-bold">دستور مدیریت:</span>
                            {incident.approverFactory && <div className="mt-4 border-2 border-green-600 text-green-600 p-1 rotate-[-5deg] font-bold rounded w-fit text-sm">دستور اقدام: {incident.approverFactory}</div>}
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
