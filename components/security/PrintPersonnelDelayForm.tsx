
import React from 'react';
import { PersonnelDelay, DailySecurityMeta } from '../../types';
import { formatDate } from '../../constants';

interface Props {
    delays: PersonnelDelay[];
    date: string;
    meta?: DailySecurityMeta;
}

const PrintPersonnelDelayForm: React.FC<Props> = ({ delays, date, meta }) => {
    // Fill empty rows for main table (Approx 12 rows for A4 Portrait)
    const displayDelays = [...delays];
    while(displayDelays.length < 12) displayDelays.push({} as any);

    // Repeat Delay Table (Approx 3 rows)
    const repeatDelays = delays.filter(d => d.repeatCount && d.repeatCount !== '0');
    const displayRepeat = [...repeatDelays];
    while(displayRepeat.length < 3) displayRepeat.push({} as any);

    // Extract Names if approved
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
                width: '210mm', // A4 Portrait Fixed Width
                height: '297mm', 
                direction: 'rtl',
                margin: '0 auto', // Center explicitly
                boxSizing: 'border-box',
                padding: '0',
                textAlign: 'center' // Ensure content centers
            }}
        >
            <div style={{ border: '2px solid black', height: '100%', display: 'flex', flexDirection: 'column', margin: '5px' }}>
                
                {/* 1. HEADER SECTION */}
                <div style={{ display: 'flex', height: '100px', borderBottom: '2px solid black' }}>
                    {/* Right: Meta */}
                    <div style={{ width: '150px', borderLeft: '2px solid black', padding: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px', fontSize: '12px', fontWeight: 'bold', backgroundColor: 'white', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>شماره:</span><span style={{ fontFamily: 'monospace', color: '#9ca3af' }}>........</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>تاریخ:</span><span style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '14px' }}>{formatDate(date)}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>پیوست:</span><span style={{ fontFamily: 'monospace', color: '#9ca3af' }}>........</span></div>
                    </div>
                    
                    {/* Center: Title */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' }}>
                        <h1 style={{ fontSize: '22px', fontWeight: '900', marginBottom: '8px', letterSpacing: '1px' }}>گروه تولیدی</h1>
                        <div style={{ border: '2px solid black', backgroundColor: 'white', padding: '5px 20px', borderRadius: '8px', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                            <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>فرم گزارش تاخیر ورود پرسنل</h2>
                        </div>
                    </div>

                    {/* Left: Logo */}
                    <div style={{ width: '150px', borderRight: '2px solid black', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', backgroundColor: 'white' }}>
                        <div style={{ border: '1px dashed #9ca3af', width: '100%', height: '100%', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d1d5db', fontWeight: 'bold', fontSize: '14px' }}>
                            محل درج لوگو
                        </div>
                    </div>
                </div>

                {/* 2. MAIN CONTENT (Delays) */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '12px', tableLayout: 'fixed' }}>
                        <colgroup>
                            <col style={{ width: '40px' }} /> {/* Row */}
                            <col /> {/* Name */}
                            <col style={{ width: '120px' }} /> {/* Unit */}
                            <col style={{ width: '80px' }} /> {/* Arrival */}
                            <col style={{ width: '80px' }} /> {/* Delay */}
                        </colgroup>
                        <thead>
                            <tr style={{ backgroundColor: '#e5e7eb', height: '40px' }}>
                                <th style={{ border: '1px solid black', padding: '4px' }}>ردیف</th>
                                <th style={{ border: '1px solid black', padding: '4px' }}>نام و نام خانوادگی</th>
                                <th style={{ border: '1px solid black', padding: '4px' }}>واحد / بخش</th>
                                <th style={{ border: '1px solid black', padding: '4px' }}>ساعت ورود</th>
                                <th style={{ border: '1px solid black', padding: '4px' }}>مدت تاخیر</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayDelays.map((d, i) => (
                                <tr key={i} style={{ height: '35px', backgroundColor: i % 2 === 0 ? 'white' : '#f9fafb' }}>
                                    <td style={{ border: '1px solid black', fontWeight: 'bold' }}>{d.id ? i + 1 : ''}</td>
                                    <td style={{ border: '1px solid black', fontWeight: 'bold', textAlign: 'right', paddingRight: '10px' }}>{d.personnelName}</td>
                                    <td style={{ border: '1px solid black' }}>{d.unit}</td>
                                    <td style={{ border: '1px solid black', direction: 'ltr', fontFamily: 'monospace', fontWeight: 'bold' }}>{d.arrivalTime}</td>
                                    <td style={{ border: '1px solid black', fontWeight: 'bold' }}>{d.delayAmount}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* 3. REPEAT DELAYS SECTION */}
                    <div style={{ marginTop: 'auto' }}>
                        <div style={{ textAlign: 'center', fontWeight: '900', backgroundColor: '#e5e7eb', borderTop: '2px solid black', borderBottom: '1px solid black', padding: '5px', fontSize: '12px' }}>
                            تکرار تاخیر (سابقه پرسنل در ماه جاری)
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '12px', tableLayout: 'fixed' }}>
                            <colgroup>
                                <col style={{ width: '40px' }} />
                                <col />
                                <col style={{ width: '120px' }} />
                                <col style={{ width: '80px' }} />
                                <col />
                            </colgroup>
                            <thead>
                                <tr style={{ backgroundColor: '#f3f4f6', height: '30px' }}>
                                    <th style={{ border: '1px solid black', padding: '2px' }}>ردیف</th>
                                    <th style={{ border: '1px solid black', padding: '2px' }}>نام و نام خانوادگی</th>
                                    <th style={{ border: '1px solid black', padding: '2px' }}>واحد</th>
                                    <th style={{ border: '1px solid black', padding: '2px' }}>تعداد تکرار</th>
                                    <th style={{ border: '1px solid black', padding: '2px' }}>دستور مدیریت / اقدام انجام شده</th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayRepeat.map((d, i) => (
                                    <tr key={i} style={{ height: '35px' }}>
                                        <td style={{ border: '1px solid black' }}>{d.id ? i + 1 : ''}</td>
                                        <td style={{ border: '1px solid black', fontWeight: 'bold', textAlign: 'right', paddingRight: '10px' }}>{d.personnelName}</td>
                                        <td style={{ border: '1px solid black' }}>{d.unit}</td>
                                        <td style={{ border: '1px solid black', fontWeight: 'bold' }}>{d.repeatCount}</td>
                                        <td style={{ border: '1px solid black', textAlign: 'right', paddingRight: '5px', fontSize: '11px', fontWeight: '500' }}>{d.instruction}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 4. FOOTER SIGNATURES */}
                <div style={{ height: '110px', borderTop: '2px solid black', display: 'flex', fontSize: '11px' }}>
                    {/* Guard Signature */}
                    <div style={{ width: '25%', borderLeft: '2px solid black', padding: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ fontWeight: 'bold', borderBottom: '1px solid #9ca3af', width: '100%', textAlign: 'center', paddingBottom: '2px' }}>امضا نگهبان شیفت</div>
                        <div style={{ fontWeight: 'bold', color: '#374151', textAlign: 'center', fontSize: '12px', height: '30px', display: 'flex', alignItems: 'center' }}>
                            {delays.length > 0 ? delays[0].registrant : ''}
                        </div>
                        <div style={{ fontSize: '10px', color: '#9ca3af' }}>محل امضا</div>
                    </div>

                    {/* Supervisor Signature */}
                    <div style={{ width: '25%', borderLeft: '2px solid black', padding: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(254, 252, 232, 0.3)' }}>
                        <div style={{ fontWeight: 'bold', borderBottom: '1px solid #9ca3af', width: '100%', textAlign: 'center', paddingBottom: '2px' }}>سرپرست انتظامات</div>
                        {supervisorName ? <Stamp title="تایید شد" name={supervisorName} color="blue" /> : <div style={{ color: '#d1d5db', fontSize: '10px', marginTop: '10px' }}>(امضاء)</div>}
                    </div>

                    {/* Factory Manager Signature */}
                    <div style={{ width: '25%', borderLeft: '2px solid black', padding: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(239, 246, 255, 0.3)' }}>
                        <div style={{ fontWeight: 'bold', borderBottom: '1px solid #9ca3af', width: '100%', textAlign: 'center', paddingBottom: '2px' }}>مدیر کارخانه</div>
                        {factoryName ? <Stamp title="تایید نهایی" name={factoryName} color="green" /> : <div style={{ color: '#d1d5db', fontSize: '10px', marginTop: '10px' }}>(امضاء)</div>}
                    </div>

                    {/* CEO Signature */}
                    <div style={{ width: '25%', padding: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(250, 245, 255, 0.3)' }}>
                        <div style={{ fontWeight: 'bold', borderBottom: '1px solid #9ca3af', width: '100%', textAlign: 'center', paddingBottom: '2px' }}>مدیریت عامل</div>
                        {ceoName ? <Stamp title="ملاحظه شد" name={ceoName} color="purple" /> : <div style={{ color: '#d1d5db', fontSize: '10px', marginTop: '10px' }}>(امضاء)</div>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PrintPersonnelDelayForm;
