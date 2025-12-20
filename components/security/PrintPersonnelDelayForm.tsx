
import React from 'react';
import { PersonnelDelay, DailySecurityMeta } from '../../types';
import { formatDate } from '../../constants';

interface Props {
    delays: PersonnelDelay[];
    date: string;
    meta?: DailySecurityMeta;
}

const PrintPersonnelDelayForm: React.FC<Props> = ({ delays, date, meta }) => {
    // Determine strict approval state for stamps
    const isSupervisorApproved = meta?.isDelaySupervisorApproved === true;
    const isFactoryApproved = meta?.isDelayFactoryApproved === true;
    const isCeoApproved = meta?.isDelayCeoApproved === true;

    // Fill empty rows for main table to ensure the page looks full (Target 15 rows)
    const displayDelays = [...delays];
    while(displayDelays.length < 15) displayDelays.push({} as any);

    // Repeat Delay Table (Target 5 rows)
    const repeatDelays = delays.filter(d => d.repeatCount && d.repeatCount !== '0');
    const displayRepeat = [...repeatDelays];
    while(displayRepeat.length < 5) displayRepeat.push({} as any);

    return (
        // Main Container - Exact A4 Dimensions
        <div 
            id="print-delay-form"
            className="printable-content bg-white text-black font-sans relative flex flex-col box-border mx-auto" 
            style={{ 
                width: '210mm', 
                height: '297mm', 
                padding: '10mm',
                direction: 'rtl',
                backgroundColor: 'white'
            }}
        >
            <div className="border-2 border-black flex flex-col h-full">
                
                {/* 1. HEADER SECTION (Table Based for Perfect Alignment) */}
                <table className="w-full border-collapse border-b-2 border-black">
                    <tbody>
                        <tr>
                            {/* Right: Date & Number */}
                            <td className="border-l-2 border-black w-[25%] p-2 align-middle">
                                <div className="flex flex-col gap-2 text-sm font-bold pr-2">
                                    <div className="flex justify-between"><span>شماره:</span> <span>..................</span></div>
                                    <div className="flex justify-between"><span>تاریخ:</span> <span className="font-mono text-base">{formatDate(date)}</span></div>
                                    <div className="flex justify-between"><span>پیوست:</span> <span>..................</span></div>
                                </div>
                            </td>
                            
                            {/* Center: Title */}
                            <td className="border-l-2 border-black w-[50%] p-2 text-center align-middle">
                                <h1 className="text-2xl font-black mb-2">گروه تولیدی</h1>
                                <div className="inline-block border-t-2 border-black pt-1 px-4">
                                    <h2 className="text-xl font-bold">فرم گزارش تاخیر ورود پرسنل</h2>
                                </div>
                            </td>

                            {/* Left: Logo Placeholder */}
                            <td className="w-[25%] p-2 text-center align-middle">
                                <div className="font-bold text-gray-300 text-sm border-2 border-dashed border-gray-300 rounded-lg p-4 inline-block">
                                    محل درج لوگو
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>

                {/* 2. MAIN CONTENT (Delays) */}
                <div className="flex-1 flex flex-col">
                    <table className="w-full border-collapse text-center text-sm">
                        <thead className="bg-gray-200 print:bg-gray-300 text-black">
                            <tr>
                                <th className="border-b border-l border-black p-1 w-10 h-10">ردیف</th>
                                <th className="border-b border-l border-black p-1">نام و نام خانوادگی</th>
                                <th className="border-b border-l border-black p-1 w-32">واحد / بخش</th>
                                <th className="border-b border-l border-black p-1 w-24">ساعت ورود</th>
                                <th className="border-b border-black p-1 w-24">مدت تاخیر</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayDelays.map((d, i) => (
                                <tr key={i} className="h-9">
                                    <td className="border-b border-l border-black font-bold">{d.id ? i + 1 : ''}</td>
                                    <td className="border-b border-l border-black font-bold text-right pr-2">{d.personnelName}</td>
                                    <td className="border-b border-l border-black">{d.unit}</td>
                                    <td className="border-b border-l border-black dir-ltr font-mono font-bold text-base">{d.arrivalTime}</td>
                                    <td className="border-b border-black font-bold text-base">{d.delayAmount}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* 3. REPEAT DELAYS SECTION */}
                    <div className="mt-auto">
                        <div className="text-center font-black bg-gray-200 print:bg-gray-300 border-t-2 border-b border-black p-1 text-sm">
                            تکرار تاخیر (سابقه پرسنل در ماه جاری)
                        </div>
                        <table className="w-full border-collapse text-center text-sm">
                            <thead className="bg-gray-100 print:bg-gray-200">
                                <tr>
                                    <th className="border-b border-l border-black p-1 w-10">ردیف</th>
                                    <th className="border-b border-l border-black p-1">نام و نام خانوادگی</th>
                                    <th className="border-b border-l border-black p-1 w-32">واحد</th>
                                    <th className="border-b border-l border-black p-1 w-24">تعداد تکرار</th>
                                    <th className="border-b border-black p-1">دستور مدیریت / اقدام انجام شده</th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayRepeat.map((d, i) => (
                                    <tr key={i} className="h-10">
                                        <td className="border-b border-l border-black">{d.id ? i + 1 : ''}</td>
                                        <td className="border-b border-l border-black font-bold text-right pr-2">{d.personnelName}</td>
                                        <td className="border-b border-l border-black">{d.unit}</td>
                                        <td className="border-b border-l border-black font-bold text-base">{d.repeatCount}</td>
                                        <td className="border-b border-black text-right pr-2 text-xs font-medium">{d.instruction}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 4. FOOTER SIGNATURES */}
                <div className="h-32 border-t-2 border-black flex text-sm">
                    {/* Guard Signature */}
                    <div className="w-1/4 border-l-2 border-black p-2 flex flex-col items-center justify-between">
                        <div className="font-bold border-b border-gray-400 w-full text-center pb-1">امضا نگهبان شیفت</div>
                        <div className="font-bold text-gray-700 text-center text-xs">
                            {delays.length > 0 ? delays[0].registrant : ''}
                        </div>
                        <div className="text-[10px] text-gray-400">محل امضا</div>
                    </div>

                    {/* Supervisor Signature */}
                    <div className="w-1/4 border-l-2 border-black p-2 flex flex-col items-center justify-between bg-yellow-50/20 print:bg-transparent">
                        <div className="font-bold border-b border-gray-400 w-full text-center pb-1">سرپرست انتظامات</div>
                        {isSupervisorApproved && (
                            <div className="border-2 border-blue-800 text-blue-800 p-1 px-3 rounded-lg -rotate-6 font-black text-xs opacity-80">
                                تایید شد
                            </div>
                        )}
                        <div className="text-[10px] text-gray-400">محل امضا</div>
                    </div>

                    {/* Factory Manager Signature */}
                    <div className="w-1/4 border-l-2 border-black p-2 flex flex-col items-center justify-between bg-green-50/20 print:bg-transparent">
                        <div className="font-bold border-b border-gray-400 w-full text-center pb-1">مدیر کارخانه</div>
                        {isFactoryApproved && (
                            <div className="border-2 border-green-800 text-green-800 p-1 px-3 rounded-lg -rotate-3 font-black text-xs opacity-80">
                                تایید نهایی
                            </div>
                        )}
                        <div className="text-[10px] text-gray-400">محل امضا</div>
                    </div>

                    {/* CEO Signature */}
                    <div className="w-1/4 p-2 flex flex-col items-center justify-between bg-purple-50/20 print:bg-transparent">
                        <div className="font-bold border-b border-gray-400 w-full text-center pb-1">مدیریت عامل</div>
                        {isCeoApproved && (
                            <div className="border-2 border-purple-800 text-purple-800 p-1 px-3 rounded-lg rotate-3 font-black text-xs opacity-80">
                                اقدام شود
                            </div>
                        )}
                        <div className="text-[10px] text-gray-400">محل امضا</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PrintPersonnelDelayForm;
