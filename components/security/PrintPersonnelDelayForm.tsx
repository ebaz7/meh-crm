
import React from 'react';
import { PersonnelDelay, DailySecurityMeta } from '../../types';
import { formatDate } from '../../constants';

interface Props {
    delays: PersonnelDelay[];
    date: string;
    meta?: DailySecurityMeta;
}

const PrintPersonnelDelayForm: React.FC<Props> = ({ delays, date, meta }) => {
    // Fill empty rows for main table
    const displayDelays = [...delays];
    while(displayDelays.length < 12) displayDelays.push({} as any);

    // Repeat Delay Table
    const repeatDelays = delays.filter(d => d.repeatCount && d.repeatCount !== '0');
    const displayRepeat = [...repeatDelays];
    while(displayRepeat.length < 3) displayRepeat.push({} as any);

    // Extract Names if approved
    // Note: We take the approver name from the first approved record as a representative for the daily sheet
    const supervisorName = delays.find(d => d.approverSupervisor)?.approverSupervisor;
    const factoryName = delays.find(d => d.approverFactory)?.approverFactory;
    const ceoName = delays.find(d => d.approverCeo)?.approverCeo;

    const Stamp = ({ title, name, color = 'blue' }: { title: string, name: string, color?: string }) => (
        <div className={`border-2 border-${color}-800 text-${color}-800 p-1 px-3 rounded-lg -rotate-6 inline-block opacity-90`} style={{ borderColor: color === 'green' ? '#166534' : color === 'purple' ? '#581c87' : '#1e40af', color: color === 'green' ? '#166534' : color === 'purple' ? '#581c87' : '#1e40af' }}>
            <div className="text-[9px] font-bold border-b border-current pb-0.5 mb-0.5">{title}</div>
            <div className="text-[11px] font-black">{name}</div>
        </div>
    );

    return (
        <div 
            id="print-delay-form"
            className="printable-content bg-white text-black font-sans relative flex flex-col box-border mx-auto" 
            style={{ 
                width: '297mm', 
                height: '210mm', 
                padding: '10mm',
                direction: 'rtl',
                backgroundColor: 'white'
            }}
        >
            <div className="border-2 border-black flex flex-col h-full">
                
                {/* 1. HEADER SECTION */}
                <div className="flex h-20 border-b-2 border-black">
                    <div className="w-[20%] border-l-2 border-black p-2 flex flex-col justify-center text-sm font-bold gap-1">
                        <div className="flex justify-between"><span>شماره:</span><span>........</span></div>
                        <div className="flex justify-between"><span>تاریخ:</span><span className="font-mono font-bold text-base">{formatDate(date)}</span></div>
                        <div className="flex justify-between"><span>پیوست:</span><span>........</span></div>
                    </div>
                    <div className="w-[60%] flex flex-col items-center justify-center border-l-2 border-black">
                        <h1 className="text-2xl font-black mb-2">گروه تولیدی</h1>
                        <div className="inline-block border-t-2 border-black pt-1 px-4">
                            <h2 className="text-xl font-bold">فرم گزارش تاخیر ورود پرسنل</h2>
                        </div>
                    </div>
                    <div className="w-[20%] p-2 flex items-center justify-center">
                        <div className="font-bold text-gray-300 text-sm border border-dashed border-gray-400 rounded-lg p-2">
                            محل درج لوگو
                        </div>
                    </div>
                </div>

                {/* 2. MAIN CONTENT (Delays) */}
                <div className="flex-1 flex flex-col">
                    <table className="w-full border-collapse text-center text-sm" style={{ tableLayout: 'fixed' }}>
                        <thead>
                            <tr className="bg-gray-200">
                                <th className="border border-black p-1 w-10">ردیف</th>
                                <th className="border border-black p-1">نام و نام خانوادگی</th>
                                <th className="border border-black p-1 w-48">واحد / بخش</th>
                                <th className="border border-black p-1 w-32">ساعت ورود</th>
                                <th className="border border-black p-1 w-32">مدت تاخیر</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayDelays.map((d, i) => (
                                <tr key={i} style={{ height: '28px' }}>
                                    <td className="border border-black font-bold">{d.id ? i + 1 : ''}</td>
                                    <td className="border border-black font-bold text-right pr-2">{d.personnelName}</td>
                                    <td className="border border-black">{d.unit}</td>
                                    <td className="border border-black dir-ltr font-mono font-bold">{d.arrivalTime}</td>
                                    <td className="border border-black font-bold">{d.delayAmount}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* 3. REPEAT DELAYS SECTION */}
                    <div className="mt-auto">
                        <div className="text-center font-black bg-gray-200 border-t-2 border-b border-black p-1 text-sm">
                            تکرار تاخیر (سابقه پرسنل در ماه جاری)
                        </div>
                        <table className="w-full border-collapse text-center text-sm" style={{ tableLayout: 'fixed' }}>
                            <thead>
                                <tr className="bg-gray-100">
                                    <th className="border border-black p-1 w-10">ردیف</th>
                                    <th className="border border-black p-1">نام و نام خانوادگی</th>
                                    <th className="border border-black p-1 w-48">واحد</th>
                                    <th className="border border-black p-1 w-32">تعداد تکرار</th>
                                    <th className="border border-black p-1">دستور مدیریت / اقدام انجام شده</th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayRepeat.map((d, i) => (
                                    <tr key={i} style={{ height: '28px' }}>
                                        <td className="border border-black">{d.id ? i + 1 : ''}</td>
                                        <td className="border border-black font-bold text-right pr-2">{d.personnelName}</td>
                                        <td className="border border-black">{d.unit}</td>
                                        <td className="border border-black font-bold">{d.repeatCount}</td>
                                        <td className="border border-black text-right pr-2 text-xs font-medium">{d.instruction}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 4. FOOTER SIGNATURES */}
                <div className="h-28 border-t-2 border-black flex text-sm">
                    {/* Guard Signature */}
                    <div className="w-1/4 border-l-2 border-black p-2 flex flex-col items-center justify-between">
                        <div className="font-bold border-b border-gray-400 w-full text-center pb-1">امضا نگهبان شیفت</div>
                        <div className="font-bold text-gray-700 text-center text-xs h-8 flex items-center">
                            {delays.length > 0 ? delays[0].registrant : ''}
                        </div>
                        <div className="text-[10px] text-gray-400">محل امضا</div>
                    </div>

                    {/* Supervisor Signature */}
                    <div className="w-1/4 border-l-2 border-black p-2 flex flex-col items-center justify-between bg-yellow-50/20">
                        <div className="font-bold border-b border-gray-400 w-full text-center pb-1">سرپرست انتظامات</div>
                        {supervisorName ? <Stamp title="تایید شد" name={supervisorName} color="blue" /> : <div className="text-gray-300 mt-4">محل امضاء</div>}
                    </div>

                    {/* Factory Manager Signature */}
                    <div className="w-1/4 border-l-2 border-black p-2 flex flex-col items-center justify-between bg-green-50/20">
                        <div className="font-bold border-b border-gray-400 w-full text-center pb-1">مدیر کارخانه</div>
                        {factoryName ? <Stamp title="تایید نهایی" name={factoryName} color="green" /> : <div className="text-gray-300 mt-4">محل امضاء</div>}
                    </div>

                    {/* CEO Signature */}
                    <div className="w-1/4 p-2 flex flex-col items-center justify-between bg-purple-50/20">
                        <div className="font-bold border-b border-gray-400 w-full text-center pb-1">مدیریت عامل</div>
                        {ceoName ? <Stamp title="ملاحظه شد" name={ceoName} color="purple" /> : <div className="text-gray-300 mt-4">محل امضاء</div>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PrintPersonnelDelayForm;
