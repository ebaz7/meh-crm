
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
    // Fill empty rows to maintain A4 structure (approx 20 rows fits well)
    const displayLogs = [...logs];
    while (displayLogs.length < 18) {
        displayLogs.push({} as any);
    }

    // Extract Approver Names
    const supervisorName = logs.find(l => l.approverSupervisor)?.approverSupervisor;
    const factoryName = logs.find(l => l.approverFactory)?.approverFactory;
    const ceoName = logs.find(l => l.approverCeo)?.approverCeo;

    const Stamp = ({ title, name, color = 'blue' }: { title: string, name: string, color?: string }) => (
        <div style={{ 
            border: `2px solid ${color === 'green' ? '#166534' : color === 'purple' ? '#581c87' : '#1e40af'}`, 
            color: color === 'green' ? '#166534' : color === 'purple' ? '#581c87' : '#1e40af',
            padding: '4px 12px',
            borderRadius: '8px',
            transform: 'rotate(-5deg)',
            display: 'inline-block',
            opacity: 0.9,
            backgroundColor: 'rgba(255,255,255,0.8)'
        }}>
            <div style={{ fontSize: '9px', fontWeight: 'bold', borderBottom: '1px solid currentColor', paddingBottom: '2px', marginBottom: '2px', textAlign: 'center' }}>{title}</div>
            <div style={{ fontSize: '11px', fontWeight: '900', textAlign: 'center' }}>{name}</div>
        </div>
    );

    return (
        <div className="printable-content bg-white text-black font-sans relative" 
            style={{ 
                width: '297mm', // A4 Landscape Fixed Width
                height: '210mm', 
                direction: 'rtl',
                margin: '0 auto',
                boxSizing: 'border-box',
                padding: '0' 
            }}
        >
            <div style={{ border: '2px solid black', height: '100%', display: 'flex', flexDirection: 'column', margin: '5px' }}>
                
                {/* 1. Header Table */}
                <div style={{ borderBottom: '2px solid black', height: '100px', display: 'flex' }}>
                    
                    {/* Right: Meta */}
                    <div style={{ width: '200px', borderLeft: '2px solid black', padding: '10px', fontSize: '12px', fontWeight: 'bold' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}><span>شماره:</span><span style={{ fontFamily: 'monospace', color: '#9ca3af' }}>........</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}><span>تاریخ:</span><span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{formatDate(date)}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>پیوست:</span><span style={{ fontFamily: 'monospace', color: '#9ca3af' }}>........</span></div>
                    </div>

                    {/* Center: Title */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' }}>
                        <h1 style={{ fontSize: '24px', fontWeight: '900', marginBottom: '8px' }}>گروه تولیدی</h1>
                        <div style={{ border: '2px solid black', backgroundColor: 'white', padding: '5px 30px', borderRadius: '8px' }}>
                            <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>فرم گزارش روزانه نگهبانی</h2>
                        </div>
                    </div>

                    {/* Left: Logo Placeholder */}
                    <div style={{ width: '200px', borderRight: '2px solid black', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px' }}>
                        <div style={{ border: '1px dashed #9ca3af', width: '100%', height: '100%', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d1d5db', fontSize: '14px', fontWeight: 'bold' }}>
                            محل درج لوگو
                        </div>
                    </div>
                </div>

                {/* 2. Main Data Table */}
                <div style={{ flex: 1, overflow: 'hidden' }}>
                    <table style={{ width: '100%', height: '100%', borderCollapse: 'collapse', fontSize: '10px', textAlign: 'center', tableLayout: 'fixed' }}>
                        <colgroup>
                            <col style={{ width: '35px' }} /> {/* Row */}
                            <col style={{ width: '90px' }} /> {/* Origin */}
                            <col style={{ width: '50px' }} /> {/* Entry */}
                            <col style={{ width: '50px' }} /> {/* Exit */}
                            <col style={{ width: '90px' }} /> {/* Driver */}
                            <col style={{ width: '80px' }} /> {/* Plate */}
                            <col style={{ width: '90px' }} /> {/* Permit */}
                            <col />                           {/* Goods */}
                            <col style={{ width: '50px' }} /> {/* Qty */}
                            <col style={{ width: '90px' }} /> {/* Dest */}
                            <col style={{ width: '90px' }} /> {/* Receiver */}
                            <col style={{ width: '130px' }} /> {/* Desc */}
                        </colgroup>
                        <thead>
                            <tr style={{ backgroundColor: '#e5e7eb', height: '35px' }}>
                                <th rowSpan={2} style={{ border: '1px solid black', verticalAlign: 'middle' }}>ردیف</th>
                                <th rowSpan={2} style={{ border: '1px solid black', verticalAlign: 'middle' }}>مبدا</th>
                                <th colSpan={2} style={{ border: '1px solid black', verticalAlign: 'middle' }}>ساعت</th>
                                <th colSpan={2} style={{ border: '1px solid black', verticalAlign: 'middle' }}>مشخصات خودرو / راننده</th>
                                <th rowSpan={2} style={{ border: '1px solid black', verticalAlign: 'middle' }}>مجوز دهنده</th>
                                <th colSpan={2} style={{ border: '1px solid black', verticalAlign: 'middle' }}>مشخصات کالا</th>
                                <th rowSpan={2} style={{ border: '1px solid black', verticalAlign: 'middle' }}>مقصد</th>
                                <th rowSpan={2} style={{ border: '1px solid black', verticalAlign: 'middle' }}>تحویل گیرنده</th>
                                <th rowSpan={2} style={{ border: '1px solid black', verticalAlign: 'middle' }}>توضیحات</th>
                            </tr>
                            <tr style={{ backgroundColor: '#e5e7eb', height: '30px' }}>
                                <th style={{ border: '1px solid black', verticalAlign: 'middle' }}>ورود</th>
                                <th style={{ border: '1px solid black', verticalAlign: 'middle' }}>خروج</th>
                                <th style={{ border: '1px solid black', verticalAlign: 'middle' }}>نام راننده</th>
                                <th style={{ border: '1px solid black', verticalAlign: 'middle' }}>پلاک</th>
                                <th style={{ border: '1px solid black', verticalAlign: 'middle' }}>نام کالا</th>
                                <th style={{ border: '1px solid black', verticalAlign: 'middle' }}>تعداد</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayLogs.map((log, index) => (
                                <tr key={index} style={{ height: '28px' }}>
                                    <td style={{ border: '1px solid black', fontWeight: 'bold' }}>{log.id ? index + 1 : ''}</td>
                                    <td style={{ border: '1px solid black', fontWeight: 'bold', overflow: 'hidden', whiteSpace: 'nowrap' }}>{log.origin}</td>
                                    <td style={{ border: '1px solid black', fontFamily: 'monospace', fontWeight: 'bold', fontSize: '11px' }}>{log.entryTime}</td>
                                    <td style={{ border: '1px solid black', fontFamily: 'monospace', fontWeight: 'bold', fontSize: '11px' }}>{log.exitTime}</td>
                                    <td style={{ border: '1px solid black', overflow: 'hidden', whiteSpace: 'nowrap' }}>{log.driverName}</td>
                                    <td style={{ border: '1px solid black', fontFamily: 'monospace', direction: 'ltr' }}>{log.plateNumber}</td>
                                    <td style={{ border: '1px solid black', overflow: 'hidden', whiteSpace: 'nowrap' }}>{log.permitProvider}</td>
                                    <td style={{ border: '1px solid black', textAlign: 'right', paddingRight: '4px', fontWeight: '500', overflow: 'hidden', whiteSpace: 'nowrap' }}>{log.goodsName}</td>
                                    <td style={{ border: '1px solid black', fontFamily: 'monospace', fontWeight: 'bold' }}>{log.quantity}</td>
                                    <td style={{ border: '1px solid black', overflow: 'hidden', whiteSpace: 'nowrap' }}>{log.destination}</td>
                                    <td style={{ border: '1px solid black', overflow: 'hidden', whiteSpace: 'nowrap' }}>{log.receiver}</td>
                                    <td style={{ border: '1px solid black', textAlign: 'right', paddingRight: '4px', overflow: 'hidden', whiteSpace: 'nowrap' }}>{log.workDescription}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* 3. Footer Section */}
                <div style={{ height: '130px', borderTop: '2px solid black', display: 'flex', flexDirection: 'column' }}>
                    
                    {/* Shift Description */}
                    <div style={{ height: '40px', borderBottom: '1px solid black', display: 'flex', alignItems: 'center', backgroundColor: '#f9fafb', padding: '0 5px' }}>
                        <span style={{ fontSize: '10px', fontWeight: 'bold', textDecoration: 'underline', flexShrink: 0, marginLeft: '5px' }}>توضیحات شیفت:</span>
                        <div style={{ fontSize: '10px', flex: 1, textAlign: 'right', fontWeight: '500' }}>
                            {meta?.dailyDescription}
                        </div>
                    </div>

                    {/* Signatures */}
                    <div style={{ flex: 1, display: 'flex', fontSize: '10px' }}>
                        
                        {/* Guards */}
                        <div style={{ width: '25%', borderLeft: '1px solid black', padding: '5px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                            <span style={{ fontWeight: 'bold', borderBottom: '1px solid #9ca3af', width: '100%', paddingBottom: '2px', marginBottom: '5px' }}>نگهبانان شیفت</span>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', width: '100%', height: '100%', gap: '5px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', borderLeft: '1px solid #e5e7eb' }}>
                                    <div style={{ color: '#6b7280', marginBottom: 'auto' }}>صبح</div>
                                    <div style={{ fontWeight: 'bold' }}>{meta?.morningGuard?.name}</div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', borderLeft: '1px solid #e5e7eb' }}>
                                    <div style={{ color: '#6b7280', marginBottom: 'auto' }}>عصر</div>
                                    <div style={{ fontWeight: 'bold' }}>{meta?.eveningGuard?.name}</div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                                    <div style={{ color: '#6b7280', marginBottom: 'auto' }}>شب</div>
                                    <div style={{ fontWeight: 'bold' }}>{meta?.nightGuard?.name}</div>
                                </div>
                            </div>
                        </div>

                        {/* Supervisor */}
                        <div style={{ width: '25%', borderLeft: '1px solid black', padding: '5px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(254, 252, 232, 0.3)' }}>
                            <span style={{ fontWeight: 'bold', borderBottom: '1px solid #9ca3af', width: '100%', paddingBottom: '2px', textAlign: 'center' }}>سرپرست انتظامات</span>
                            {supervisorName ? <Stamp title="تایید شد" name={supervisorName} color="blue" /> : <div style={{ color: '#d1d5db', fontSize: '9px' }}>(امضاء)</div>}
                        </div>

                        {/* Factory Manager */}
                        <div style={{ width: '25%', borderLeft: '1px solid black', padding: '5px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(239, 246, 255, 0.3)' }}>
                            <span style={{ fontWeight: 'bold', borderBottom: '1px solid #9ca3af', width: '100%', paddingBottom: '2px', textAlign: 'center' }}>مدیر کارخانه</span>
                            {factoryName ? <Stamp title="تایید نهایی" name={factoryName} color="green" /> : <div style={{ color: '#d1d5db', fontSize: '9px' }}>(امضاء)</div>}
                        </div>

                        {/* CEO */}
                        <div style={{ width: '25%', padding: '5px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(250, 245, 255, 0.3)' }}>
                            <span style={{ fontWeight: 'bold', borderBottom: '1px solid #9ca3af', width: '100%', paddingBottom: '2px', textAlign: 'center' }}>مدیر عامل</span>
                            {ceoName ? <Stamp title="ملاحظه شد" name={ceoName} color="purple" /> : <div style={{ color: '#d1d5db', fontSize: '9px' }}>(امضاء)</div>}
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
    return (
        <div style={{ 
            width: '210mm', 
            height: '297mm', 
            backgroundColor: 'white', 
            color: 'black', 
            fontFamily: 'sans-serif', 
            position: 'relative', 
            display: 'flex', 
            justifyContent: 'center', 
            padding: '20px', 
            boxSizing: 'border-box',
            direction: 'rtl' 
        }}>
            <div style={{ border: '2px solid black', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: '5px' }}>
                <div style={{ display: 'flex', borderBottom: '2px solid black', paddingBottom: '10px', marginBottom: '10px', paddingTop: '10px' }}>
                    <div style={{ width: '33%', textAlign: 'right', paddingRight: '10px' }}>
                        <div style={{ fontWeight: 'bold', fontSize: '18px' }}>شماره: {incident.reportNumber}</div>
                        <div style={{ fontWeight: 'bold' }}>تاریخ: {formatDate(incident.date)}</div>
                    </div>
                    <div style={{ width: '33%', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <h1 style={{ fontSize: '24px', fontWeight: '900', backgroundColor: '#e5e7eb', padding: '5px 20px', borderRadius: '5px', border: '1px solid black', marginBottom: '5px' }}>فرم گزارش واحد انتظامات</h1>
                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#6b7280' }}>گروه تولیدی</span>
                    </div>
                    <div style={{ width: '33%', textAlign: 'left', paddingLeft: '10px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                       <div style={{ border: '1px dashed #9ca3af', width: '100px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: '#d1d5db' }}>لوگو</div>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '1px solid black', paddingBottom: '10px', paddingLeft: '10px', paddingRight: '10px' }}>
                    <div><span style={{ fontWeight: 'bold' }}>گزارش کننده:</span> {incident.registrant}</div>
                    <div><span style={{ fontWeight: 'bold' }}>موضوع:</span> {incident.subject}</div>
                    <div><span style={{ fontWeight: 'bold' }}>شیفت:</span> {incident.shift}</div>
                </div>

                <div style={{ flex: 1, border: '1px solid black', padding: '20px', position: 'relative', margin: '10px', borderRadius: '4px' }}>
                    <h3 style={{ fontWeight: 'bold', borderBottom: '1px solid black', display: 'inline-block', marginBottom: '20px', fontSize: '18px' }}>شرح دقیق موضوع:</h3>
                    <p style={{ lineHeight: '2', textAlign: 'justify', whiteSpace: 'pre-wrap', fontSize: '14px', fontWeight: '500' }}>{incident.description}</p>
                </div>

                <div style={{ height: '60px', borderBottom: '1px solid black', display: 'flex', alignItems: 'center', padding: '10px', margin: '0 10px' }}>
                    <span style={{ fontWeight: 'bold', marginLeft: '10px' }}>شهود:</span> {incident.witnesses || '...................................................'}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr', borderTop: '2px solid black', marginTop: 'auto' }}>
                    <div style={{ height: '100px', borderBottom: '1px solid black', padding: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                        <div style={{ borderLeft: '1px solid black', paddingRight: '10px' }}>
                            <span style={{ fontWeight: 'bold', display: 'block', marginBottom: '10px' }}>سرپرست انتظامات:</span>
                            {incident.approverSupervisor && <div style={{ border: '2px solid blue', color: 'blue', padding: '5px', transform: 'rotate(-5deg)', fontWeight: 'bold', borderRadius: '5px', width: 'fit-content', fontSize: '14px', opacity: 0.8 }}>تایید شد: {incident.approverSupervisor}</div>}
                        </div>
                        <div style={{ paddingRight: '10px' }}>
                            <span style={{ fontWeight: 'bold', display: 'block', marginBottom: '10px' }}>دستور مدیریت:</span>
                            {incident.approverFactory && <div style={{ border: '2px solid green', color: 'green', padding: '5px', transform: 'rotate(-5deg)', fontWeight: 'bold', borderRadius: '5px', width: 'fit-content', fontSize: '14px', opacity: 0.8 }}>دستور اقدام: {incident.approverFactory}</div>}
                        </div>
                    </div>
                    <div style={{ height: '70px', borderBottom: '1px solid black', padding: '10px', backgroundColor: 'rgba(250, 245, 255, 0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 'bold' }}>دستور مدیرعامل:</span>
                        {incident.approverCeo && <span style={{ marginRight: '10px', fontWeight: '900', color: 'purple', fontSize: '18px', border: '2px solid purple', padding: '5px 10px', borderRadius: '5px', transform: 'rotate(-2deg)', opacity: 0.8 }}>{incident.approverCeo} (تایید نهایی)</span>}
                        <div style={{ fontWeight: 'bold', fontSize: '12px', color: '#9ca3af' }}>محل امضاء</div>
                    </div>
                    <div style={{ display: 'flex', height: '70px' }}>
                        <div style={{ width: '50%', borderLeft: '1px solid black', padding: '10px' }}>
                            <span style={{ fontWeight: 'bold', fontSize: '12px' }}>اقدام کارگزینی:</span> 
                            <div style={{ textAlign: 'right', fontSize: '12px', marginTop: '5px' }}>{incident.hrAction}</div>
                        </div>
                        <div style={{ width: '50%', padding: '10px' }}>
                            <span style={{ fontWeight: 'bold', fontSize: '12px' }}>اقدام ایمنی:</span> 
                            <div style={{ textAlign: 'right', fontSize: '12px', marginTop: '5px' }}>{incident.safetyAction}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
