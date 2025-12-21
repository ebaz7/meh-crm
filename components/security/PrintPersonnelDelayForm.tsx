
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

    const displayRepeat = [...delays.filter(d => d.repeatCount && d.repeatCount !== '0')];
    while(displayRepeat.length < 3) displayRepeat.push({} as any);

    const supervisorName = delays.find(d => d.approverSupervisor)?.approverSupervisor;
    const factoryName = delays.find(d => d.approverFactory)?.approverFactory;
    const ceoName = delays.find(d => d.approverCeo)?.approverCeo;

    return (
        <div 
            id="print-delay-form"
            className="printable-content bg-white text-black font-sans relative" 
            style={{ 
                // Locked dimensions for A4 Portrait (approx pixels at scale or mm)
                // Use mm to align with PDF generator settings
                width: '210mm', 
                minHeight: '297mm',
                direction: 'rtl',
                margin: '0 auto',
                padding: '10mm',
                boxSizing: 'border-box',
                fontFamily: 'Vazirmatn, Tahoma, sans-serif',
                fontVariant: 'normal',
                letterSpacing: 'normal'
            }}
        >
            <div style={{ border: '2px solid black', height: '100%', display: 'flex', flexDirection: 'column' }}>
                
                {/* HEADER */}
                <div style={{ display: 'flex', height: '100px', borderBottom: '2px solid black' }}>
                    <div style={{ width: '150px', borderLeft: '2px solid black', padding: '8px', fontSize: '12px', fontWeight: 'bold' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>شماره:</span><span>........</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>تاریخ:</span><span>{formatDate(date)}</span></div>
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' }}>
                        <h1 style={{ fontSize: '22px', fontWeight: '900', marginBottom: '5px' }}>گروه تولیدی</h1>
                        <div style={{ border: '2px solid black', padding: '5px 20px', borderRadius: '8px' }}>
                            <h2 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>فرم گزارش تاخیر ورود پرسنل</h2>
                        </div>
                    </div>
                    <div style={{ width: '150px', borderRight: '2px solid black', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ border: '1px dashed #ccc', width: '80%', height: '80%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc' }}>لوگو</div>
                    </div>
                </div>

                {/* MAIN TABLE */}
                <div style={{ flex: 1 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '12px', tableLayout: 'fixed' }}>
                        <colgroup>
                            <col style={{ width: '40px' }} />
                            <col />
                            <col style={{ width: '100px' }} />
                            <col style={{ width: '80px' }} />
                            <col style={{ width: '80px' }} />
                        </colgroup>
                        <thead>
                            <tr style={{ backgroundColor: '#e5e7eb', height: '35px' }}>
                                <th style={{ border: '1px solid black' }}>ردیف</th>
                                <th style={{ border: '1px solid black' }}>نام و نام خانوادگی</th>
                                <th style={{ border: '1px solid black' }}>واحد</th>
                                <th style={{ border: '1px solid black' }}>ساعت ورود</th>
                                <th style={{ border: '1px solid black' }}>مدت تاخیر</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayDelays.map((d, i) => (
                                <tr key={i} style={{ height: '30px' }}>
                                    <td style={{ border: '1px solid black' }}>{d.id ? i + 1 : ''}</td>
                                    <td style={{ border: '1px solid black', textAlign: 'right', paddingRight: '5px' }}>{d.personnelName}</td>
                                    <td style={{ border: '1px solid black' }}>{d.unit}</td>
                                    <td style={{ border: '1px solid black', direction: 'ltr' }}>{d.arrivalTime}</td>
                                    <td style={{ border: '1px solid black' }}>{d.delayAmount}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* REPEAT TABLE */}
                    <div style={{ marginTop: '20px' }}>
                        <div style={{ textAlign: 'center', fontWeight: 'bold', border: '1px solid black', borderBottom: 'none', backgroundColor: '#f3f4f6', padding: '5px' }}>تکرار تاخیر</div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '12px', tableLayout: 'fixed' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#e5e7eb' }}>
                                    <th style={{ border: '1px solid black' }}>نام</th>
                                    <th style={{ border: '1px solid black' }}>تعداد تکرار</th>
                                    <th style={{ border: '1px solid black' }}>دستور مدیریت</th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayRepeat.map((d, i) => (
                                    <tr key={i} style={{ height: '30px' }}>
                                        <td style={{ border: '1px solid black' }}>{d.personnelName}</td>
                                        <td style={{ border: '1px solid black' }}>{d.repeatCount}</td>
                                        <td style={{ border: '1px solid black' }}>{d.instruction}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* FOOTER */}
                <div style={{ height: '100px', borderTop: '2px solid black', display: 'flex', fontSize: '11px', textAlign: 'center' }}>
                    <div style={{ flex: 1, borderLeft: '1px solid black', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '5px' }}>
                        <div style={{ fontWeight: 'bold' }}>نگهبان شیفت</div>
                        <div>{delays[0]?.registrant}</div>
                    </div>
                    <div style={{ flex: 1, borderLeft: '1px solid black', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '5px' }}>
                        <div style={{ fontWeight: 'bold' }}>سرپرست انتظامات</div>
                        <div>{supervisorName && <span style={{color: 'blue', fontWeight: 'bold'}}>تایید: {supervisorName}</span>}</div>
                    </div>
                    <div style={{ flex: 1, borderLeft: '1px solid black', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '5px' }}>
                        <div style={{ fontWeight: 'bold' }}>مدیر کارخانه</div>
                        <div>{factoryName && <span style={{color: 'green', fontWeight: 'bold'}}>تایید: {factoryName}</span>}</div>
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '5px' }}>
                        <div style={{ fontWeight: 'bold' }}>مدیر عامل</div>
                        <div>{ceoName && <span style={{color: 'purple', fontWeight: 'bold'}}>تایید: {ceoName}</span>}</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PrintPersonnelDelayForm;
