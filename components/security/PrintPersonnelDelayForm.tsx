
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

    // Fill empty rows for main table
    const displayDelays = [...delays];
    while(displayDelays.length < 10) displayDelays.push({} as any);

    // Filter delays that have repeat counts for the bottom table
    const repeatDelays = delays.filter(d => d.repeatCount && d.repeatCount !== '0');
    const displayRepeat = [...repeatDelays];
    while(displayRepeat.length < 3) displayRepeat.push({} as any);

    return (
        <div className="w-[210mm] h-[297mm] bg-white p-8 mx-auto text-black font-sans relative flex flex-col box-border" style={{ direction: 'rtl' }}>
            <div className="border-2 border-black flex-1 flex flex-col">
                
                {/* Header */}
                <div className="flex border-b-2 border-black h-24 shrink-0">
                    <div className="w-1/3 border-l-2 border-black p-2 flex flex-col justify-center gap-2">
                        <div className="font-bold text-sm">شماره:</div>
                        <div className="font-bold text-sm">تاریخ: {formatDate(date)}</div>
                    </div>
                    <div className="w-1/3 border-l-2 border-black flex items-center justify-center">
                        <h1 className="text-xl font-black text-center">فرم گزارش تاخیر ورود پرسنل</h1>
                    </div>
                    <div className="w-1/3 flex items-center justify-center p-2">
                        <div className="text-center font-bold text-lg">گروه تولیدی</div>
                        {/* You can add logo here if available */}
                    </div>
                </div>

                {/* Main Table */}
                <div className="flex-1">
                    <table className="w-full border-collapse text-center">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="border border-black p-2 w-10">ردیف</th>
                                <th className="border border-black p-2">نام و نام خانوادگی</th>
                                <th className="border border-black p-2 w-24">واحد</th>
                                <th className="border border-black p-2 w-24">ساعت ورود</th>
                                <th className="border border-black p-2 w-32">مدت تاخیر</th>
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

                {/* Repeat Delay Section */}
                <div className="mt-2 shrink-0">
                    <div className="text-center font-bold bg-gray-100 border border-black border-b-0 p-1">تکرار تاخیر</div>
                    <table className="w-full border-collapse text-center">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="border border-black p-2 w-10">ردیف</th>
                                <th className="border border-black p-2">نام و نام خانوادگی</th>
                                <th className="border border-black p-2 w-24">واحد</th>
                                <th className="border border-black p-2 w-32">تعداد تکرار</th>
                                <th className="border border-black p-2">دستور</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayRepeat.map((d, i) => (
                                <tr key={i} className="h-10">
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

                {/* Footer Signatures */}
                <div className="h-32 border-t-2 border-black flex mt-auto shrink-0 text-[10px]">
                    {/* Guard Signature */}
                    <div className="w-1/4 border-l-2 border-black relative p-2">
                        <div className="font-bold absolute top-2 right-2">امضا نگهبان:</div>
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 font-bold text-sm">
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
