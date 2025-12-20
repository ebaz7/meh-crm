
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
        // Main Container - A4 Portrait Dimensions (210mm x 297mm) fixed
        <div 
            className="bg-white text-black font-sans relative flex flex-col box-border" 
            style={{ 
                width: '210mm', 
                height: '297mm', // Fixed height for page breaks
                padding: '10mm',
                margin: '0 auto',
                direction: 'rtl',
                overflow: 'hidden' // Prevent overflow
            }}
        >
            <div className="border-2 border-black flex flex-col flex-1 h-full">
                
                {/* Header */}
                <div className="flex border-b-2 border-black h-24 shrink-0">
                    <div className="w-1/3 border-l-2 border-black p-2 flex flex-col justify-center gap-2">
                        <div className="font-bold text-sm">شماره:</div>
                        <div className="font-bold text-sm">تاریخ: {formatDate(date)}</div>
                    </div>
                    <div className="w-1/3 border-l-2 border-black flex items-center justify-center bg-gray-100">
                        <h1 className="text-xl font-black text-center">فرم گزارش تاخیر ورود پرسنل</h1>
                    </div>
                    <div className="w-1/3 flex items-center justify-center p-2">
                        <div className="text-center font-bold text-lg">گروه تولیدی</div>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col">
                    
                    {/* Delays Table */}
                    <div className="flex-1">
                        <table className="w-full border-collapse text-center text-xs">
                            <thead>
                                <tr className="bg-gray-200">
                                    <th className="border border-black p-2 w-10">ردیف</th>
                                    <th className="border border-black p-2">نام و نام خانوادگی</th>
                                    <th className="border border-black p-2 w-32">واحد</th>
                                    <th className="border border-black p-2 w-24">ساعت ورود</th>
                                    <th className="border border-black p-2 w-24">مدت تاخیر</th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayDelays.map((d, i) => (
                                    <tr key={i} className="h-8">
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

                    {/* Repeat Delay Section */}
                    <div className="mt-4 shrink-0">
                        <div className="text-center font-bold bg-gray-200 border border-black border-b-0 p-1 text-sm">تکرار تاخیر (سابقه)</div>
                        <table className="w-full border-collapse text-center text-xs">
                            <thead>
                                <tr className="bg-gray-100">
                                    <th className="border border-black p-2 w-10">ردیف</th>
                                    <th className="border border-black p-2">نام و نام خانوادگی</th>
                                    <th className="border border-black p-2 w-32">واحد</th>
                                    <th className="border border-black p-2 w-24">تعداد تکرار</th>
                                    <th className="border border-black p-2">دستور / اقدام</th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayRepeat.map((d, i) => (
                                    <tr key={i} className="h-8">
                                        <td className="border border-black">{d.id ? i + 1 : ''}</td>
                                        <td className="border border-black font-bold">{d.personnelName}</td>
                                        <td className="border border-black">{d.unit}</td>
                                        <td className="border border-black">{d.repeatCount}</td>
                                        <td className="border border-black">{d.instruction}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Footer Signatures - Fixed Height at Bottom */}
                <div className="h-32 border-t-2 border-black flex mt-auto shrink-0 text-xs">
                    {/* Guard Signature */}
                    <div className="w-1/4 border-l-2 border-black relative p-2 flex flex-col justify-between">
                        <div className="font-bold text-right">امضا نگهبان:</div>
                        <div className="text-center font-bold mb-2">
                            {delays.length > 0 ? delays[0].registrant : ''}
                        </div>
                    </div>

                    {/* Supervisor Signature */}
                    <div className="w-1/4 border-l-2 border-black relative p-2 flex flex-col items-center justify-center bg-yellow-50/30">
                        <div className="font-bold absolute top-2 right-2">امضا سرپرست:</div>
                        {isSupervisorApproved && (
                            <div className="border-2 border-blue-800 text-blue-800 p-1 rounded rotate-[-10deg] font-bold text-xs mt-4 opacity-80">
                                تایید شد
                            </div>
                        )}
                    </div>

                    {/* Factory Manager Signature */}
                    <div className="w-1/4 border-l-2 border-black relative p-2 flex flex-col items-center justify-center bg-green-50/30">
                        <div className="font-bold absolute top-2 right-2">امضا مدیر کارخانه:</div>
                        {isFactoryApproved && (
                            <div className="border-2 border-green-800 text-green-800 p-1 rounded rotate-[-5deg] font-bold text-xs mt-4 opacity-80">
                                تایید نهایی
                            </div>
                        )}
                    </div>

                    {/* CEO Signature */}
                    <div className="w-1/4 relative p-2 flex flex-col items-center justify-center bg-purple-50/30">
                        <div className="font-bold absolute top-2 right-2">امضا مدیرعامل:</div>
                        {isCeoApproved && (
                            <div className="border-2 border-purple-800 text-purple-800 p-1 rounded rotate-[-5deg] font-bold text-xs mt-4 opacity-80">
                                دستور اقدام / تایید
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PrintPersonnelDelayForm;
