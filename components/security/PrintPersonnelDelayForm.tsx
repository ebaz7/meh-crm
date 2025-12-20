
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

    // Fill empty rows for main table (Target ~15 rows for A4)
    const displayDelays = [...delays];
    while(displayDelays.length < 15) displayDelays.push({} as any);

    // Repeat Delay Table (Target ~5 rows)
    const repeatDelays = delays.filter(d => d.repeatCount && d.repeatCount !== '0');
    const displayRepeat = [...repeatDelays];
    while(displayRepeat.length < 5) displayRepeat.push({} as any);

    return (
        // Main Container - A4 Portrait Dimensions with printable-content class
        <div 
            id="print-delay-form"
            className="printable-content bg-white text-black font-sans relative flex flex-col box-border mx-auto shadow-2xl print:shadow-none" 
            style={{ 
                width: '210mm', 
                minHeight: '297mm', 
                padding: '10mm',
                direction: 'rtl',
                backgroundColor: 'white'
            }}
        >
            <div className="border-2 border-black flex flex-col flex-1 h-full">
                
                {/* Header */}
                <div className="flex border-b-2 border-black h-28 shrink-0">
                    <div className="w-1/4 border-l-2 border-black p-2 flex flex-col justify-center gap-3 text-right pr-4">
                        <div className="font-bold text-sm">شماره: .......................</div>
                        <div className="font-bold text-sm">تاریخ: <span className="font-mono font-black text-base">{formatDate(date)}</span></div>
                        <div className="font-bold text-sm">پیوسـت: .......................</div>
                    </div>
                    <div className="w-2/4 border-l-2 border-black flex flex-col items-center justify-center bg-gray-50">
                        <h1 className="text-xl font-black text-center mb-2">گروه تولیدی</h1>
                        <h2 className="text-lg font-bold text-center border-t border-black pt-2 w-3/4">فرم گزارش تاخیر ورود پرسنل</h2>
                    </div>
                    <div className="w-1/4 flex flex-col items-center justify-center p-2">
                        <div className="text-center font-bold text-sm border-2 border-black rounded-lg p-2 w-24 h-24 flex items-center justify-center bg-gray-50 text-gray-400">
                            محل درج<br/>لوگو
                        </div>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col">
                    
                    {/* Delays Table */}
                    <div className="flex-1">
                        <table className="w-full border-collapse text-center text-sm">
                            <thead>
                                <tr className="bg-gray-200 print:bg-gray-300">
                                    <th className="border border-black p-2 w-12">ردیف</th>
                                    <th className="border border-black p-2">نام و نام خانوادگی</th>
                                    <th className="border border-black p-2 w-40">واحد / بخش</th>
                                    <th className="border border-black p-2 w-32">ساعت ورود</th>
                                    <th className="border border-black p-2 w-32">مدت تاخیر</th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayDelays.map((d, i) => (
                                    <tr key={i} className="h-10">
                                        <td className="border border-black font-bold">{d.id ? i + 1 : ''}</td>
                                        <td className="border border-black font-bold text-right pr-3">{d.personnelName}</td>
                                        <td className="border border-black">{d.unit}</td>
                                        <td className="border border-black dir-ltr font-mono font-bold">{d.arrivalTime}</td>
                                        <td className="border border-black font-bold text-red-800">{d.delayAmount}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Repeat Delay Section */}
                    <div className="mt-4 shrink-0 mb-4">
                        <div className="text-center font-black bg-gray-200 print:bg-gray-300 border border-black border-b-0 p-2 text-sm">تکرار تاخیر (سابقه پرسنل در ماه جاری)</div>
                        <table className="w-full border-collapse text-center text-sm">
                            <thead>
                                <tr className="bg-gray-100 print:bg-gray-200">
                                    <th className="border border-black p-2 w-12">ردیف</th>
                                    <th className="border border-black p-2">نام و نام خانوادگی</th>
                                    <th className="border border-black p-2 w-40">واحد</th>
                                    <th className="border border-black p-2 w-32">تعداد تکرار</th>
                                    <th className="border border-black p-2">دستور مدیریت / اقدام انجام شده</th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayRepeat.map((d, i) => (
                                    <tr key={i} className="h-10">
                                        <td className="border border-black">{d.id ? i + 1 : ''}</td>
                                        <td className="border border-black font-bold text-right pr-3">{d.personnelName}</td>
                                        <td className="border border-black">{d.unit}</td>
                                        <td className="border border-black font-bold">{d.repeatCount}</td>
                                        <td className="border border-black text-right pr-2 text-xs">{d.instruction}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Footer Signatures - Fixed Height at Bottom */}
                <div className="h-36 border-t-2 border-black flex mt-auto shrink-0 text-sm">
                    {/* Guard Signature */}
                    <div className="w-1/4 border-l-2 border-black relative p-2 flex flex-col justify-between">
                        <div className="font-bold text-right border-b border-gray-400 pb-1 mb-2">امضا نگهبان شیفت:</div>
                        <div className="text-center font-bold mb-4 text-gray-700">
                            {delays.length > 0 ? delays[0].registrant : ''}
                        </div>
                    </div>

                    {/* Supervisor Signature */}
                    <div className="w-1/4 border-l-2 border-black relative p-2 flex flex-col items-center justify-start bg-yellow-50/30 print:bg-transparent">
                        <div className="font-bold w-full text-right border-b border-gray-400 pb-1 mb-2">امضا سرپرست انتظامات:</div>
                        {isSupervisorApproved && (
                            <div className="mt-4 border-4 border-blue-800 text-blue-800 p-2 rounded-xl rotate-[-10deg] font-black text-sm opacity-80">
                                تایید شد
                            </div>
                        )}
                    </div>

                    {/* Factory Manager Signature */}
                    <div className="w-1/4 border-l-2 border-black relative p-2 flex flex-col items-center justify-start bg-green-50/30 print:bg-transparent">
                        <div className="font-bold w-full text-right border-b border-gray-400 pb-1 mb-2">امضا مدیر کارخانه:</div>
                        {isFactoryApproved && (
                            <div className="mt-4 border-4 border-green-800 text-green-800 p-2 rounded-xl rotate-[-5deg] font-black text-sm opacity-80">
                                تایید نهایی
                            </div>
                        )}
                    </div>

                    {/* CEO Signature */}
                    <div className="w-1/4 relative p-2 flex flex-col items-center justify-start bg-purple-50/30 print:bg-transparent">
                        <div className="font-bold w-full text-right border-b border-gray-400 pb-1 mb-2">دستور مدیریت عامل:</div>
                        {isCeoApproved && (
                            <div className="mt-4 border-4 border-purple-800 text-purple-800 p-2 rounded-xl rotate-[-5deg] font-black text-sm opacity-80">
                                اقدام شود
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PrintPersonnelDelayForm;
