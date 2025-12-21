
import React from 'react';
import { PersonnelDelay, DailySecurityMeta } from '../../types';
import { formatDate } from '../../constants';

interface Props {
    delays: PersonnelDelay[];
    date: string;
    meta?: DailySecurityMeta;
}

const PrintPersonnelDelayForm: React.FC<Props> = ({ delays, date, meta }) => {
    const displayDelays = [...delays];
    while(displayDelays.length < 12) displayDelays.push({} as any);

    const repeatDelays = delays.filter(d => d.repeatCount && d.repeatCount !== '0');
    const displayRepeat = [...repeatDelays];
    while(displayRepeat.length < 3) displayRepeat.push({} as any);

    const supervisorName = delays.find(d => d.approverSupervisor)?.approverSupervisor;
    const factoryName = delays.find(d => d.approverFactory)?.approverFactory;
    const ceoName = delays.find(d => d.approverCeo)?.approverCeo;

    const Stamp = ({ title, name, color = 'blue' }: { title: string, name: string, color?: string }) => (
        <div style={{ 
            border: `2px solid ${color === 'green' ? '#166534' : color === 'purple' ? '#581c87' : '#1e40af'}`, 
            color: color === 'green' ? '#166534' : color === 'purple' ? '#581c87' : '#1e40af',
            padding: '2px 8px',
            borderRadius: '6px',
            transform: 'rotate(-5deg)',
            display: 'inline-block',
            opacity: 0.9,
            backgroundColor: 'rgba(255,255,255,0.8)'
        }}>
            <div style={{ fontSize: '9px', fontWeight: 'bold', borderBottom: '1px solid currentColor', paddingBottom: '1px', marginBottom: '1px', textAlign: 'center' }}>{title}</div>
            <div style={{ fontSize: '10px', fontWeight: '900', textAlign: 'center' }}>{name}</div>
        </div>
    );

    return (
        <div 
            id="print-delay-form"
            className="printable-content bg-white text-black font-sans relative" 
            style={{ 
                width: '100%', 
                height: '100%',
                direction: 'rtl',
                margin: '0 auto', 
                boxSizing: 'border-box',
                padding: '0',
                textAlign: 'center'
            }}
        >
            <div style={{ border: '3px solid black', display: 'flex', flexDirection: 'column', height: '100%' }}>
                
                {/* 1. HEADER SECTION (Simplified Structure for PDF stability) */}
                <div style={{ display: 'flex', height: '110px', borderBottom: '3px solid black' }}>
                    {/* Right: Meta */}
                    <div style={{ width: '160px', borderLeft: '2px solid black', padding: '10px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '6px', fontSize: '12px', fontWeight: 'bold', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>شماره:</span><span style={{ fontFamily: 'monospace', color: '#9ca3af' }}>........</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>تاریخ:</span><span style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '14px' }}>{formatDate(date)}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>پیوست:</span><span style={{ fontFamily: 'monospace', color: '#9ca3af' }}>........</span></div>
                    </div>
                    
                    {/* Center: Title */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' }}>
                        <h1 style={{ fontSize: '26px', fontWeight: '900', marginBottom: '10px', letterSpacing: '0px', textAlign: 'center' }}>گروه تولیدی</h1>
                        <div style={{ border: '2px solid black', backgroundColor: 'white', padding: '6px 25px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                            <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>فرم گزارش تاخیر ورود پرسنل</h2>
                        </div>
                    </div>

                    {/* Left: Logo */}
                    <div style={{ width: '160px', borderRight: '2px solid black', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px' }}>
                        <div style={{ border: '2px dashed #d1d5db', width: '100%', height: '100%', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d1d5db', fontWeight: 'bold', fontSize: '14px' }}>
                            محل درج لوگو
                        </div>
                    </div>
                </div>

                {/* 2. MAIN CONTENT (Delays) */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '13px', tableLayout: 'fixed' }}>
                        <colgroup>
                            <col style={{ width: '50px' }} />
                            <col />
                            <col style={{ width: '140px' }} />
                            <col style={{ width: '100px' }} />
                            <col style={{ width: '100px' }} />
                        </colgroup>
                        <thead>
                            <tr style={{ backgroundColor: '#e5e7eb', height: '45px' }}>
                                <th style={{ border: '1px solid black', padding: '4px' }}>ردیف</th>
                                <th style={{ border: '1px solid black', padding: '4px' }}>نام و نام خانوادگی</th>
                                <th style={{ border: '1px solid black', padding: '4px' }}>واحد / بخش</th>
                                <th style={{ border: '1px solid black', padding: '4px' }}>ساعت ورود</th>
                                <th style={{ border: '1px solid black', padding: '4px' }}>مدت تاخیر</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayDelays.map((d, i) => (
                                <tr key={i} style={{ height: '38px', backgroundColor: i % 2 === 0 ? 'white' : '#f9fafb' }}>
                                    <td style={{ border: '1px solid black', fontWeight: 'bold' }}>{d.id ? i + 1 : ''}</td>
                                    <td style={{ border: '1px solid black', fontWeight: 'bold', textAlign: 'right', paddingRight: '15px' }}>{d.personnelName}</td>
                                    <td style={{ border: '1px solid black' }}>{d.unit}</td>
                                    <td style={{ border: '1px solid black', direction: 'ltr', fontFamily: 'monospace', fontWeight: 'bold', fontSize: '14px' }}>{d.arrivalTime}</td>
                                    <td style={{ border: '1px solid black', fontWeight: 'bold', color: d.delayAmount ? 'red' : 'black' }}>{d.delayAmount}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* 3. REPEAT DELAYS SECTION */}
                    <div style={{ marginTop: 'auto' }}>
                        <div style={{ textAlign: 'center', fontWeight: '900', backgroundColor: '#e5e7eb', borderTop: '2px solid black', borderBottom: '1px solid black', padding: '8px', fontSize: '13px' }}>
                            تکرار تاخیر (سابقه پرسنل در ماه جاری)
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '13px', tableLayout: 'fixed' }}>
                            <colgroup>
                                <col style={{ width: '50px' }} />
                                <col />
                                <col style={{ width: '140px' }} />
                                <col style={{ width: '100px' }} />
                                <col />
                            </colgroup>
                            <thead>
                                <tr style={{ backgroundColor: '#f3f4f6', height: '35px' }}>
                                    <th style={{ border: '1px solid black', padding: '2px' }}>ردیف</th>
                                    <th style={{ border: '1px solid black', padding: '2px' }}>نام و نام خانوادگی</th>
                                    <th style={{ border: '1px solid black', padding: '2px' }}>واحد</th>
                                    <th style={{ border: '1px solid black', padding: '2px' }}>تعداد تکرار</th>
                                    <th style={{ border: '1px solid black', padding: '2px' }}>دستور مدیریت / اقدام انجام شده</th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayRepeat.map((d, i) => (
                                    <tr key={i} style={{ height: '40px' }}>
                                        <td style={{ border: '1px solid black' }}>{d.id ? i + 1 : ''}</td>
                                        <td style={{ border: '1px solid black', fontWeight: 'bold', textAlign: 'right', paddingRight: '10px' }}>{d.personnelName}</td>
                                        <td style={{ border: '1px solid black' }}>{d.unit}</td>
                                        <td style={{ border: '1px solid black', fontWeight: 'bold' }}>{d.repeatCount}</td>
                                        <td style={{ border: '1px solid black', textAlign: 'right', paddingRight: '5px', fontSize: '12px', fontWeight: '500' }}>{d.instruction}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 4. FOOTER SIGNATURES */}
                <div style={{ height: '120px', borderTop: '3px solid black', display: 'flex', fontSize: '12px' }}>
                    <div style={{ width: '25%', borderLeft: '2px solid black', padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ fontWeight: 'bold', borderBottom: '1px solid #9ca3af', width: '100%', textAlign: 'center', paddingBottom: '4px' }}>امضا نگهبان شیفت</div>
                        <div style={{ fontWeight: 'bold', color: '#374151', textAlign: 'center', fontSize: '13px', height: '30px', display: 'flex', alignItems: 'center' }}>
                            {delays.length > 0 ? delays[0].registrant : ''}
                        </div>
                        <div style={{ fontSize: '10px', color: '#9ca3af' }}>محل امضا</div>
                    </div>

                    <div style={{ width: '25%', borderLeft: '2px solid black', padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(254, 252, 232, 0.3)' }}>
                        <div style={{ fontWeight: 'bold', borderBottom: '1px solid #9ca3af', width: '100%', textAlign: 'center', paddingBottom: '4px' }}>سرپرست انتظامات</div>
                        {supervisorName ? <Stamp title="تایید شد" name={supervisorName} color="blue" /> : <div style={{ color: '#d1d5db', fontSize: '10px', marginTop: '10px' }}>(امضاء)</div>}
                    </div>

                    <div style={{ width: '25%', borderLeft: '2px solid black', padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(239, 246, 255, 0.3)' }}>
                        <div style={{ fontWeight: 'bold', borderBottom: '1px solid #9ca3af', width: '100%', textAlign: 'center', paddingBottom: '4px' }}>مدیر کارخانه</div>
                        {factoryName ? <Stamp title="تایید نهایی" name={factoryName} color="green" /> : <div style={{ color: '#d1d5db', fontSize: '10px', marginTop: '10px' }}>(امضاء)</div>}
                    </div>

                    <div style={{ width: '25%', padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(250, 245, 255, 0.3)' }}>
                        <div style={{ fontWeight: 'bold', borderBottom: '1px solid #9ca3af', width: '100%', textAlign: 'center', paddingBottom: '4px' }}>مدیریت عامل</div>
                        {ceoName ? <Stamp title="ملاحظه شد" name={ceoName} color="purple" /> : <div style={{ color: '#d1d5db', fontSize: '10px', marginTop: '10px' }}>(امضاء)</div>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PrintPersonnelDelayForm;
