
import React, { useState, useRef, useEffect } from 'react';
import { PrintTemplate, PrintField } from '../types';
import { uploadFile } from '../services/storageService';
import { Save, Upload, Plus, Move, X, Type, AlignLeft, AlignCenter, AlignRight, Bold, Trash2, Printer, LayoutTemplate } from 'lucide-react';
import { generateUUID } from '../constants';

interface Props {
    onSave: (template: PrintTemplate) => void;
    onCancel: () => void;
    initialTemplate?: PrintTemplate | null;
}

const AVAILABLE_FIELDS = [
    { key: 'date_year', label: 'سال' },
    { key: 'date_month', label: 'ماه' },
    { key: 'date_day', label: 'روز' },
    { key: 'date_full', label: 'تاریخ کامل' },
    { key: 'amount_num', label: 'مبلغ (عدد)' },
    { key: 'amount_word', label: 'مبلغ (حروف)' },
    { key: 'payee', label: 'در وجه (ذینفع)' },
    { key: 'description', label: 'بابت' },
    { key: 'place', label: 'محل صدور (شهر)' },
    { key: 'source_account', label: 'شماره حساب مبدا' },
    { key: 'source_sheba', label: 'شبا مبدا' },
    { key: 'dest_account', label: 'شماره حساب مقصد' },
    { key: 'dest_sheba', label: 'شبا مقصد' },
    { key: 'dest_bank', label: 'نام بانک مقصد' },
    { key: 'payment_id', label: 'شناسه پرداخت' },
    { key: 'cheque_no', label: 'شماره چک' },
    // Company Info
    { key: 'company_name', label: 'نام شرکت' },
    { key: 'company_id', label: 'شناسه ملی شرکت' },
    { key: 'company_reg', label: 'شماره ثبت شرکت' },
    { key: 'company_address', label: 'آدرس شرکت' }, // New
    { key: 'company_postal', label: 'کد پستی شرکت' }, // New
    { key: 'company_tel', label: 'تلفن شرکت' }, // New
    { key: 'company_fax', label: 'فکس شرکت' }, // New
    { key: 'company_eco_code', label: 'کد اقتصادی شرکت' }, // New
];

const PrintTemplateDesigner: React.FC<Props> = ({ onSave, onCancel, initialTemplate }) => {
    const [templateName, setTemplateName] = useState(initialTemplate?.name || '');
    const [pageSize, setPageSize] = useState<'A4' | 'A5'>(initialTemplate?.pageSize || 'A4');
    const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(initialTemplate?.orientation || 'portrait');
    const [bgImage, setBgImage] = useState(initialTemplate?.backgroundImage || '');
    const [fields, setFields] = useState<PrintField[]>(initialTemplate?.fields || []);
    const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    
    // Dynamic Size Calculation
    const getPaperDimensions = () => {
        // Dimensions in mm
        if (pageSize === 'A4') {
            return orientation === 'portrait' ? { w: 210, h: 297 } : { w: 297, h: 210 };
        } else {
            // A5
            return orientation === 'portrait' ? { w: 148, h: 210 } : { w: 210, h: 148 };
        }
    };

    const paperDims = getPaperDimensions();
    
    // Zoom/Scale for editing
    const [scale, setScale] = useState(1);
    const containerRef = useRef<HTMLDivElement>(null);

    // Dragging Logic
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [initialFieldPos, setInitialFieldPos] = useState({ x: 0, y: 0 });

    useEffect(() => {
        // Fit to screen width on load
        if (containerRef.current) {
            const screenWidth = containerRef.current.clientWidth;
            const mmToPx = 3.78;
            const paperPixelWidth = paperDims.w * mmToPx;
            const newScale = Math.min(1, (screenWidth - 40) / paperPixelWidth); 
            setScale(newScale);
        }
    }, [paperDims.w]);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploading(true);
        const reader = new FileReader();
        reader.onload = async (ev) => {
            const base64 = ev.target?.result as string;
            setBgImage(base64);
            setIsUploading(false);
        };
        reader.readAsDataURL(file);
    };

    const addField = (key: string, label: string) => {
        const newField: PrintField = {
            id: generateUUID(),
            key,
            label,
            x: 20, 
            y: 20 + (fields.length * 10),
            width: 50,
            fontSize: 12,
            align: 'right',
            isBold: true
        };
        setFields([...fields, newField]);
        setSelectedFieldId(newField.id);
    };

    const updateField = (id: string, updates: Partial<PrintField>) => {
        setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f));
    };

    const removeField = (id: string) => {
        setFields(fields.filter(f => f.id !== id));
        if (selectedFieldId === id) setSelectedFieldId(null);
    };

    // --- Drag Handlers ---
    const handleDragStart = (e: React.MouseEvent, field: PrintField) => {
        e.stopPropagation();
        setSelectedFieldId(field.id);
        setIsDragging(true);
        setDragStart({ x: e.clientX, y: e.clientY });
        setInitialFieldPos({ x: field.x, y: field.y });
    };

    const handleDragMove = (e: React.MouseEvent) => {
        if (!isDragging || !selectedFieldId) return;
        const dx = (e.clientX - dragStart.x) / (3.78 * scale);
        const dy = (e.clientY - dragStart.y) / (3.78 * scale);
        
        updateField(selectedFieldId, {
            x: Math.round((initialFieldPos.x + dx) * 10) / 10,
            y: Math.round((initialFieldPos.y + dy) * 10) / 10
        });
    };

    const handleDragEnd = () => {
        setIsDragging(false);
    };

    const handleSave = () => {
        if (!templateName) return alert("نام قالب الزامی است");
        const template: PrintTemplate = {
            id: initialTemplate?.id || generateUUID(),
            name: templateName,
            width: paperDims.w,
            height: paperDims.h,
            pageSize: pageSize,
            orientation: orientation,
            backgroundImage: bgImage,
            fields
        };
        onSave(template);
    };

    const selectedField = fields.find(f => f.id === selectedFieldId);

    return (
        <div className="fixed inset-0 bg-gray-100 z-[200] flex flex-col animate-fade-in" onMouseMove={handleDragMove} onMouseUp={handleDragEnd}>
            {/* Header */}
            <div className="bg-white border-b px-6 py-3 flex justify-between items-center shadow-sm z-10">
                <div className="flex items-center gap-4">
                    <h2 className="font-bold text-lg text-gray-800">طراحی قالب چاپ</h2>
                    <input 
                        className="border rounded px-3 py-1 text-sm w-64" 
                        placeholder="نام قالب (مثال: چک بانک ملی)" 
                        value={templateName} 
                        onChange={e => setTemplateName(e.target.value)} 
                    />
                </div>
                <div className="flex gap-2">
                    <button onClick={onCancel} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded text-sm font-bold">انصراف</button>
                    <button onClick={handleSave} className="px-6 py-2 bg-blue-600 text-white rounded text-sm font-bold hover:bg-blue-700 flex items-center gap-2"><Save size={16}/> ذخیره قالب</button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar Controls */}
                <div className="w-72 bg-white border-l flex flex-col shadow-lg z-10">
                    
                    {/* Paper Settings */}
                    <div className="p-4 border-b bg-gray-50">
                        <h3 className="font-bold text-xs text-gray-500 mb-3 uppercase flex items-center gap-2"><LayoutTemplate size={14}/> تنظیمات کاغذ</h3>
                        <div className="grid grid-cols-2 gap-2 mb-2">
                            <button onClick={() => setPageSize('A4')} className={`text-xs p-1.5 rounded border ${pageSize === 'A4' ? 'bg-blue-100 border-blue-300 text-blue-800' : 'bg-white'}`}>A4</button>
                            <button onClick={() => setPageSize('A5')} className={`text-xs p-1.5 rounded border ${pageSize === 'A5' ? 'bg-blue-100 border-blue-300 text-blue-800' : 'bg-white'}`}>A5</button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => setOrientation('portrait')} className={`text-xs p-1.5 rounded border ${orientation === 'portrait' ? 'bg-blue-100 border-blue-300 text-blue-800' : 'bg-white'}`}>عمودی</button>
                            <button onClick={() => setOrientation('landscape')} className={`text-xs p-1.5 rounded border ${orientation === 'landscape' ? 'bg-blue-100 border-blue-300 text-blue-800' : 'bg-white'}`}>افقی</button>
                        </div>
                    </div>

                    {/* Add Fields Section */}
                    <div className="p-4 border-b overflow-y-auto flex-1 max-h-[40%]">
                        <h3 className="font-bold text-xs text-gray-500 mb-3 uppercase">افزودن فیلد داده</h3>
                        <div className="grid grid-cols-2 gap-2">
                            {AVAILABLE_FIELDS.map(f => (
                                <button 
                                    key={f.key} 
                                    onClick={() => addField(f.key, f.label)}
                                    className="text-xs bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-200 text-gray-700 rounded p-2 text-right transition-colors"
                                >
                                    + {f.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Properties Section */}
                    <div className="p-4 bg-gray-50 flex-1 border-t overflow-y-auto">
                        <h3 className="font-bold text-xs text-gray-500 mb-3 uppercase">تنظیمات فیلد انتخاب شده</h3>
                        {selectedField ? (
                            <div className="space-y-4">
                                <div className="text-sm font-bold text-blue-800 border-b pb-2 mb-2">{selectedField.label}</div>
                                
                                <div className="grid grid-cols-2 gap-3">
                                    <div><label className="text-[10px] block text-gray-500">موقعیت X (mm)</label><input type="number" className="w-full border rounded p-1 text-center dir-ltr" value={selectedField.x} onChange={e => updateField(selectedField.id, { x: Number(e.target.value) })} /></div>
                                    <div><label className="text-[10px] block text-gray-500">موقعیت Y (mm)</label><input type="number" className="w-full border rounded p-1 text-center dir-ltr" value={selectedField.y} onChange={e => updateField(selectedField.id, { y: Number(e.target.value) })} /></div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-3">
                                    <div><label className="text-[10px] block text-gray-500">عرض (mm)</label><input type="number" className="w-full border rounded p-1 text-center dir-ltr" value={selectedField.width || 0} onChange={e => updateField(selectedField.id, { width: Number(e.target.value) })} /></div>
                                    <div><label className="text-[10px] block text-gray-500">سایز فونت (px)</label><input type="number" className="w-full border rounded p-1 text-center dir-ltr" value={selectedField.fontSize} onChange={e => updateField(selectedField.id, { fontSize: Number(e.target.value) })} /></div>
                                </div>

                                <div><label className="text-[10px] block text-gray-500">فاصله حروف (Letter Spacing)</label><input type="number" className="w-full border rounded p-1 text-center dir-ltr" value={selectedField.letterSpacing || 0} onChange={e => updateField(selectedField.id, { letterSpacing: Number(e.target.value) })} /> <span className="text-[9px] text-gray-400">برای حروف چینی شبا استفاده کنید</span></div>

                                <div className="flex gap-2 justify-center bg-white p-2 rounded border">
                                    <button onClick={() => updateField(selectedField.id, { align: 'right' })} className={`p-1 rounded ${selectedField.align === 'right' ? 'bg-blue-100 text-blue-600' : 'text-gray-400'}`}><AlignRight size={16}/></button>
                                    <button onClick={() => updateField(selectedField.id, { align: 'center' })} className={`p-1 rounded ${selectedField.align === 'center' ? 'bg-blue-100 text-blue-600' : 'text-gray-400'}`}><AlignCenter size={16}/></button>
                                    <button onClick={() => updateField(selectedField.id, { align: 'left' })} className={`p-1 rounded ${selectedField.align === 'left' ? 'bg-blue-100 text-blue-600' : 'text-gray-400'}`}><AlignLeft size={16}/></button>
                                    <div className="w-px bg-gray-300 mx-1"></div>
                                    <button onClick={() => updateField(selectedField.id, { isBold: !selectedField.isBold })} className={`p-1 rounded ${selectedField.isBold ? 'bg-blue-100 text-blue-600' : 'text-gray-400'}`}><Bold size={16}/></button>
                                </div>

                                <button onClick={() => removeField(selectedField.id)} className="w-full bg-red-50 text-red-600 border border-red-200 py-2 rounded text-xs font-bold hover:bg-red-100 flex items-center justify-center gap-2"><Trash2 size={14}/> حذف فیلد</button>
                            </div>
                        ) : (
                            <div className="text-center text-gray-400 text-xs py-10">یک فیلد را از روی فرم انتخاب کنید یا فیلد جدیدی بیفزایید.</div>
                        )}
                    </div>
                </div>

                {/* Canvas Area */}
                <div className="flex-1 bg-gray-200 overflow-auto p-8 relative flex justify-center" ref={containerRef}>
                    <div 
                        className="bg-white shadow-2xl relative transition-transform origin-top"
                        style={{
                            width: `${paperDims.w}mm`,
                            height: `${paperDims.h}mm`,
                            transform: `scale(${scale})`
                        }}
                    >
                        {/* Background Image Layer */}
                        {bgImage ? (
                            <img src={bgImage} className="absolute inset-0 w-full h-full object-contain opacity-50 pointer-events-none" />
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 pointer-events-none border-2 border-dashed border-gray-300 m-4 rounded-xl">
                                <Upload size={48} className="mb-2"/>
                                <span>تصویر فرم خام را آپلود کنید</span>
                            </div>
                        )}

                        {/* Fields Layer */}
                        {fields.map(field => (
                            <div
                                key={field.id}
                                onMouseDown={(e) => handleDragStart(e, field)}
                                className={`absolute cursor-move flex items-center px-1 border ${selectedFieldId === field.id ? 'border-blue-600 bg-blue-50/50 z-20 shadow-lg' : 'border-dashed border-gray-400 hover:border-blue-400 bg-white/30 z-10'}`}
                                style={{
                                    left: `${field.x}mm`,
                                    top: `${field.y}mm`,
                                    width: field.width ? `${field.width}mm` : 'auto',
                                    fontSize: `${field.fontSize}px`,
                                    fontWeight: field.isBold ? 'bold' : 'normal',
                                    textAlign: field.align || 'right',
                                    letterSpacing: field.letterSpacing ? `${field.letterSpacing}px` : 'normal',
                                    whiteSpace: 'nowrap',
                                    minWidth: '20px',
                                    height: 'auto',
                                    direction: 'rtl'
                                }}
                            >
                                {field.key === 'amount_num' ? '123,456,789' : 
                                 field.key === 'date_full' ? '1403/01/01' : 
                                 field.key.includes('sheba') ? 'IR123456789012345678901234' :
                                 field.label}
                                 
                                {selectedFieldId === field.id && (
                                    <>
                                        <div className="absolute -top-1 -left-1 w-2 h-2 bg-blue-600 rounded-full"></div>
                                        <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-600 rounded-full"></div>
                                        <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-blue-600 rounded-full"></div>
                                        <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-blue-600 rounded-full"></div>
                                    </>
                                )}
                            </div>
                        ))}

                    </div>

                    {/* Floating Controls */}
                    <div className="absolute bottom-6 right-6 flex flex-col gap-2">
                         <div className="bg-white p-2 rounded shadow flex flex-col gap-2">
                             <label className="text-xs font-bold text-gray-600 text-center">زوم</label>
                             <input type="range" min="0.3" max="2" step="0.1" value={scale} onChange={e => setScale(Number(e.target.value))} className="w-24" />
                         </div>
                         <label className="bg-white p-3 rounded shadow cursor-pointer hover:bg-gray-50 flex items-center justify-center" title="آپلود تصویر زمینه">
                             <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                             <Upload size={20} className="text-blue-600"/>
                         </label>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PrintTemplateDesigner;
