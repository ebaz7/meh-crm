
import React from 'react';
import { SecurityLog, PersonnelDelay, SecurityIncident } from '../../types';
import { formatDate } from '../../constants';

interface DailyLogProps {
    date: string;
    logs: SecurityLog[];
}

export const PrintSecurityDailyLog: React.FC<DailyLogProps> = ({ date, logs }) => {
    // Fill empty rows if less than 15 for full page feel
    const displayLogs = [...logs];
    while (displayLogs.length < 13) {
        displayLogs.push({} as any);
    }

    return (
        <div className="w-[297mm] h-[210mm] bg-white p-4 mx-auto text-black font-sans relative" style={{ direction: 'rtl' }}>
            {/* Header */}
            <div className="border-2 border-black h-full flex flex-col">
                <div className="flex border-b-2 border-black h-24">
                    <div className="w-1/4 border-l-2 border-black p-2 text-center flex flex-col justify-center gap-2">
                        <div className="font-bold">شماره:</div>
                        <div className="font-bold">تاریخ: {formatDate(date)}</div>
                    </div>
                    <div className="w-2/4 border-l-2 border-black flex items-center justify-center">
                        <h1 className="text-3xl font-black">فرم گزارش نگهبانی</h1>
                    </div>
                    <div className="w-1/4 flex items-center justify-center p-2">
                        <div className="text-center font-bold text-lg">گروه تولیدی</div>
                    </div>
                </div>

                {/* Sub Header */}
                <div className="flex border-b-2 border-black p-1 text-sm font-bold bg-gray-100">
                    <div className="flex-1 text-center">از ساعت: ۰۶:۰۰</div>
                    <div className="flex-1 text-center">روز: {new Date(date).toLocaleDateString('fa-IR', {weekday:'long'})}</div>
                    <div className="flex-1 text-center">مورخ: {formatDate(date)}</div>
                    <div className="flex-1 text-center">تا ساعت: ۰۶:۰۰</div>
                    <div className="flex-1 text-center">روز: فردا</div>
                    <div className="flex-1 text-center">صفحه: ۱ از ۱</div>
                </div>

                {/* Table */}
                <div className="flex-1">
                    <table className="w-full border-collapse text-center text-[10px]">
                        <thead>
                            <tr className="bg-gray-200">
                                <th rowSpan={2} className="border border-black w-8">ردیف</th>
                                <th rowSpan={2} className="border border-black w-16">مبدا</th>
                                <th colSpan={2} className="border border-black">ساعت</th>
                                <th colSpan={2} className="border border-black">نام و شماره خودرو</th>
                                <th rowSpan={2} className="border border-black">مجوز دهنده</th>
                                <th colSpan={2} className="border border-black">مشخصات کالا</th>
                                <th rowSpan={2} className="border border-black">مقصد</th>
                                <th rowSpan={2} className="border border-black">گیرنده کالا</th>
                                <th rowSpan={2} className="border border-black">موارد انجام کار</th>
                            </tr>
                            <tr className="bg-gray-200">
                                <th className="border border-black w-12">ورود</th>
                                <th className="border border-black w-12">خروج</th>
                                <th className="border border-black">نام و نام خانوادگی</th>
                                <th className="border border-black">خودرو/شخصی</th>
                                <th className="border border-black">نام کالا</th>
                                <th className="border border-black w-12">مقدار</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayLogs.map((log, index) => (
                                <tr key={index} className="h-8">
                                    <td className="border border-black">{log.id ? index + 1 : ''}</td>
                                    <td className="border border-black">{log.origin}</td>
                                    <td className="border border-black font-mono">{log.entryTime}</td>
                                    <td className="border border-black font-mono">{log.exitTime}</td>
                                    <td className="border border-black">{log.driverName}</td>
                                    <td className="border border-black font-mono">{log.plateNumber}</td>
                                    <td className="border border-black">{log.permitProvider}</td>
                                    <td className="border border-black text-right pr-1">{log.goodsName}</td>
                                    <td className="border border-black">{log.quantity}</td>
                                    <td className="border border-black">{log.destination}</td>
                                    <td className="border border-black">{log.receiver}</td>
                                    <td className="border border-black text-right pr-1">{log.workDescription}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Footer Section - Updated to match image with empty space */}
                <div className="h-48 flex flex-col border-t-2 border-black">
                    {/* Notes Section */}
                    <div className="h-24 border-b border-black p-2 flex flex-col">
                        <span className="font-bold text-xs underline mb-1">گزارش مختصر از وقایع نگهبانی:</span>
                        <div className="flex-1">
                            {/* Empty space for handwriting */}
                        </div>
                    </div>
                    
                    {/* Signatures */}
                    <div className="flex-1 flex text-[10px]">
                        <div className="w-1/6 border-l border-black p-1 text-center flex flex-col justify-between">
                            <span className="font-bold">نگهبان صبح</span>
                            <div>{/* Sign */}</div>
                            <div className="border-t border-black flex justify-between px-1"><span>ورود</span><span>خروج</span></div>
                        </div>
                        <div className="w-1/6 border-l border-black p-1 text-center flex flex-col justify-between">
                            <span className="font-bold">نگهبان عصر</span>
                            <div>{/* Sign */}</div>
                            <div className="border-t border-black flex justify-between px-1"><span>ورود</span><span>خروج</span></div>
                        </div>
                        <div className="w-1/6 border-l border-black p-1 text-center flex flex-col justify-between">
                            <span className="font-bold">نگهبان شب</span>
                            <div>{/* Sign */}</div>
                            <div className="border-t border-black flex justify-between px-1"><span>ورود</span><span>خروج</span></div>
                        </div>
                        <div className="w-1/6 border-l border-black p-1 text-center flex flex-col justify-between items-center pt-2">
                            <span className="font-bold">سرپرست انتظامات</span>
                            {logs.some(l => l.approverSupervisor) && <div className="border-2 border-blue-700 text-blue-700 text-[9px] p-1 rotate-[-10deg] font-bold rounded">تایید شد</div>}
                        </div>
                        <div className="w-2/6 p-1 text-center flex flex-col justify-between items-center pt-2">
                            <span className="font-bold">مدیر کارخانه</span>
                            {logs.some(l => l.approverFactory) && <div className="border-2 border-green-700 text-green-700 text-[9px] p-1 rotate-[-10deg] font-bold rounded">تایید نهایی</div>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const PrintPersonnelDelay: React.FC<{ delays: PersonnelDelay[] }> = ({ delays }) => {
    const displayDelays = [...delays];
    while(displayDelays.length < 15) displayDelays.push({} as any);

    return (
        <div className="w-[210mm] h-[297mm] bg-white p-4 mx-auto text-black font-sans relative" style={{ direction: 'rtl' }}>
            <div className="border-2 border-black h-full flex flex-col">
                <div className="flex border-b-2 border-black h-20">
                    <div className="w-1/3 border-l-2 border-black p-2 flex flex-col justify-center">
                        <div className="font-bold text-sm">شماره:</div>
                        <div className="font-bold text-sm">تاریخ: {delays[0]?.date ? formatDate(delays[0].date) : ''}</div>
                    </div>
                    <div className="w-1/3 border-l-2 border-black flex items-center justify-center bg-gray-50">
                        <h1 className="text-xl font-black">فرم گزارش تاخیر ورود پرسنل</h1>
                    </div>
                    <div className="w-1/3 flex items-center justify-center">
                        <div className="font-bold">گروه تولیدی</div>
                    </div>
                </div>

                <div className="flex-1">
                    <table className="w-full border-collapse text-center">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="border border-black p-1 w-10">ردیف</th>
                                <th className="border border-black p-1">نام و نام خانوادگی</th>
                                <th className="border border-black p-1 w-24">واحد</th>
                                <th className="border border-black p-1 w-24">ساعت ورود</th>
                                <th className="border border-black p-1 w-32">مدت تاخیر</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayDelays.map((d, i) => (
                                <tr key={i} className="h-10">
                                    <td className="border border-black">{d.id ? i + 1 : ''}</td>
                                    <td className="border border-black font-bold">{d.personnelName}</td>
                                    <td className="border border-black">{d.unit}</td>
                                    <td className="border border-black dir-ltr font-mono">{d.arrivalTime}</td>
                                    <td className="border border-black">{d.delayAmount}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Footer */}
                <div className="h-32 border-t-2 border-black flex">
                    <div className="w-1/3 border-l border-black flex flex-col items-center justify-end pb-4">
                        <div className="font-bold mb-8">امضا نگهبان:</div>
                        {delays.length > 0 && <span className="text-xs">{delays[0].registrant}</span>}
                    </div>
                    <div className="w-1/3 border-l border-black flex flex-col items-center justify-end pb-4">
                        <div className="font-bold mb-8">امضا سرپرست انتظامات:</div>
                        {delays.some(d => d.approverSupervisor) && <div className="border-2 border-blue-600 text-blue-600 p-1 rotate-[-5deg] font-bold rounded">تایید شد</div>}
                    </div>
                    <div className="w-1/3 flex flex-col items-center justify-end pb-4">
                        <div className="font-bold mb-8">امضا مدیر کارخانه:</div>
                        {delays.some(d => d.approverFactory) && <div className="border-2 border-green-600 text-green-600 p-1 rotate-[-5deg] font-bold rounded">تایید نهایی</div>}
                    </div>
                </div>
            </div>
        </div>
    );
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
                    <div className="h-24 border-b border-black p-2 relative">
                        <span className="font-bold">سرپرست انتظامات:</span>
                        {incident.approverSupervisor && <div className="absolute top-8 left-1/2 border-2 border-blue-600 text-blue-600 p-1 rotate-[-5deg] font-bold rounded">تایید شد: {incident.approverSupervisor}</div>}
                        <div className="absolute bottom-2 left-10 font-bold">امضاء:</div>
                    </div>
                    <div className="h-24 border-b border-black p-2 relative">
                        <span className="font-bold">دستور مدیریت:</span>
                        {incident.approverFactory && <div className="absolute top-8 left-1/2 border-2 border-green-600 text-green-600 p-1 rotate-[-5deg] font-bold rounded">دستور اقدام: {incident.approverFactory}</div>}
                        <div className="absolute bottom-2 left-10 font-bold">امضاء:</div>
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
