
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, TradeRecord, TradeStage, TradeItem, SystemSettings, InsuranceEndorsement, CurrencyPurchaseData, TradeTransaction, CurrencyTranche, TradeStageData, ShippingDocument, ShippingDocType, DocStatus, InvoiceItem, InspectionData, InspectionPayment, InspectionCertificate, ClearanceData, WarehouseReceipt, ClearancePayment, GreenLeafData, GreenLeafCustomsDuty, GreenLeafGuarantee, GreenLeafTax, GreenLeafRoadToll, InternalShippingData, ShippingPayment, AgentData, AgentPayment, PackingItem, UserRole } from '../types';
import { getTradeRecords, saveTradeRecord, updateTradeRecord, deleteTradeRecord, getSettings, uploadFile } from '../services/storageService';
import { generateUUID, formatCurrency, formatNumberString, deformatNumberString, parsePersianDate, formatDate, calculateDaysDiff, getStatusLabel } from '../constants';
import { Container, Plus, Search, CheckCircle2, Save, Trash2, X, Package, ArrowRight, History, Banknote, Coins, Wallet, FileSpreadsheet, Shield, LayoutDashboard, Printer, FileDown, Paperclip, Building2, FolderOpen, Home, Calculator, FileText, Microscope, ListFilter, Warehouse, Calendar as CalendarIcon, PieChart, BarChart, Clock, Leaf, Scale, ShieldCheck, Percent, Truck, CheckSquare, Square, ToggleLeft, ToggleRight, DollarSign, UserCheck, Check, Archive, AlertCircle, RefreshCw, Box, Loader2, Share2, ChevronLeft, ChevronRight, ExternalLink, CalendarDays, Info, ArrowLeftRight, Edit2, Edit, Undo2 } from 'lucide-react';
import { apiCall } from '../services/apiService';
import AllocationReport from './AllocationReport';
import CurrencyReport from './reports/CurrencyReport';
import CompanyPerformanceReport from './reports/CompanyPerformanceReport';
import PrintFinalCostReport from './print/PrintFinalCostReport';
import PrintClearanceDeclaration from './print/PrintClearanceDeclaration';
import InsuranceLedgerReport from './reports/InsuranceLedgerReport';
import InsuranceTab from './InsuranceTab';

interface TradeModuleProps {
    currentUser: User;
}

const STAGES = Object.values(TradeStage);
const CURRENCIES = [
    { code: 'EUR', label: 'یورو (€)' },
    { code: 'USD', label: 'دلار ($)' },
    { code: 'AED', label: 'درهم (AED)' },
    { code: 'CNY', label: 'یوان (¥)' },
    { code: 'TRY', label: 'لیر (₺)' },
];

// Report Types
type ReportType = 'general' | 'allocation_queue' | 'allocated' | 'currency' | 'insurance' | 'shipping' | 'inspection' | 'clearance' | 'green_leaf' | 'company_performance' | 'insurance_ledger';

const TradeModule: React.FC<TradeModuleProps> = ({ currentUser }) => {
    const [records, setRecords] = useState<TradeRecord[]>([]);
    const [selectedRecord, setSelectedRecord] = useState<TradeRecord | null>(null);
    const [commodityGroups, setCommodityGroups] = useState<string[]>([]);
    const [availableBanks, setAvailableBanks] = useState<string[]>([]);
    const [operatingBanks, setOperatingBanks] = useState<string[]>([]);
    const [availableCompanies, setAvailableCompanies] = useState<string[]>([]);
    const [settings, setSettingsData] = useState<SystemSettings | null>(null);

    // Navigation State
    const [navLevel, setNavLevel] = useState<'ROOT' | 'COMPANY' | 'GROUP'>('ROOT');
    const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
    const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
    const [showArchived, setShowArchived] = useState(false);

    const [viewMode, setViewMode] = useState<'dashboard' | 'details' | 'reports'>('dashboard');
    const [activeReport, setActiveReport] = useState<ReportType>('general');
    const [reportFilterCompany, setReportFilterCompany] = useState<string>('');
    const [reportSearchTerm, setReportSearchTerm] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState('');
    
    // Modal & Form States
    const [showNewModal, setShowNewModal] = useState(false);
    const [newFileNumber, setNewFileNumber] = useState('');
    const [newGoodsName, setNewGoodsName] = useState('');
    const [newSellerName, setNewSellerName] = useState('');
    const [newCommodityGroup, setNewCommodityGroup] = useState('');
    const [newMainCurrency, setNewMainCurrency] = useState('EUR');
    const [newRecordCompany, setNewRecordCompany] = useState('');
    
    const [activeTab, setActiveTab] = useState<'timeline' | 'proforma' | 'insurance' | 'currency_purchase' | 'shipping_docs' | 'inspection' | 'clearance_docs' | 'green_leaf' | 'internal_shipping' | 'agent_fees' | 'final_calculation'>('timeline');
    
    // EDIT METADATA STATE (NEW)
    const [showEditMetadataModal, setShowEditMetadataModal] = useState(false);
    const [editMetadataForm, setEditMetadataForm] = useState<Partial<TradeRecord>>({});

    // Stage Detail Modal State
    const [editingStage, setEditingStage] = useState<TradeStage | null>(null);
    const [stageFormData, setStageFormData] = useState<Partial<TradeStageData>>({});
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadingStageFile, setUploadingStageFile] = useState(false);

    // Items State
    const [newItem, setNewItem] = useState<Partial<TradeItem> & { weightStr?: string, unitPriceStr?: string }>({ name: '', weight: 0, unitPrice: 0, totalPrice: 0, hsCode: '', weightStr: '', unitPriceStr: '' });
    const [editingItemId, setEditingItemId] = useState<string | null>(null);

    // Insurance State
    const [insuranceForm, setInsuranceForm] = useState<NonNullable<TradeRecord['insuranceData']>>({ policyNumber: '', company: '', cost: 0, bank: '', endorsements: [], isPaid: false, paymentDate: '' });
    const [newEndorsement, setNewEndorsement] = useState<Partial<InsuranceEndorsement>>({ amount: 0, description: '', date: '' });
    const [endorsementType, setEndorsementType] = useState<'increase' | 'refund'>('increase');
    
    // Inspection State
    const [inspectionForm, setInspectionForm] = useState<InspectionData>({ certificates: [], payments: [] });
    const [newInspectionCertificate, setNewInspectionCertificate] = useState<Partial<InspectionCertificate>>({ part: '', company: '', certificateNumber: '', amount: 0 });
    const [newInspectionPayment, setNewInspectionPayment] = useState<Partial<InspectionPayment>>({ part: '', amount: 0, date: '', bank: '' });

    // Clearance State
    const [clearanceForm, setClearanceForm] = useState<ClearanceData>({ receipts: [], payments: [] });
    const [newWarehouseReceipt, setNewWarehouseReceipt] = useState<Partial<WarehouseReceipt>>({ number: '', part: '', issueDate: '' });
    const [newClearancePayment, setNewClearancePayment] = useState<Partial<ClearancePayment>>({ amount: 0, part: '', bank: '', date: '', payingBank: '' });

    // Green Leaf State
    const [greenLeafForm, setGreenLeafForm] = useState<GreenLeafData>({ duties: [], guarantees: [], taxes: [], roadTolls: [] });
    const [newCustomsDuty, setNewCustomsDuty] = useState<Partial<GreenLeafCustomsDuty>>({ cottageNumber: '', part: '', amount: 0, paymentMethod: 'Bank', bank: '', date: '' });
    const [newGuaranteeDetails, setNewGuaranteeDetails] = useState<Partial<GreenLeafGuarantee>>({ guaranteeNumber: '', chequeNumber: '', chequeBank: '', chequeDate: '', cashAmount: 0, cashBank: '', cashDate: '', chequeAmount: 0 });
    const [selectedDutyForGuarantee, setSelectedDutyForGuarantee] = useState<string>('');
    const [newTax, setNewTax] = useState<Partial<GreenLeafTax>>({ part: '', amount: 0, bank: '', date: '' });
    const [newRoadToll, setNewRoadToll] = useState<Partial<GreenLeafRoadToll>>({ part: '', amount: 0, bank: '', date: '' });

    // Internal Shipping State
    const [internalShippingForm, setInternalShippingForm] = useState<InternalShippingData>({ payments: [] });
    const [newShippingPayment, setNewShippingPayment] = useState<Partial<ShippingPayment>>({ part: '', amount: 0, date: '', bank: '', description: '' });

    // Agent Fees State
    const [agentForm, setAgentForm] = useState<AgentData>({ payments: [] });
    const [newAgentPayment, setNewAgentPayment] = useState<Partial<AgentPayment>>({ agentName: '', amount: 0, bank: '', date: '', part: '', description: '' });

    // License Transactions State
    const [newLicenseTx, setNewLicenseTx] = useState<Partial<TradeTransaction>>({ amount: 0, bank: '', date: '', description: 'هزینه ثبت سفارش' });

    // Currency Purchase State
    const [currencyForm, setCurrencyForm] = useState<CurrencyPurchaseData>({
        payments: [], purchasedAmount: 0, purchasedCurrencyType: '', purchaseDate: '', brokerName: '', exchangeName: '', deliveredAmount: 0, deliveredCurrencyType: '', deliveryDate: '', recipientName: '', remittedAmount: 0, isDelivered: false, tranches: [], guaranteeCheque: undefined
    });
    
    // EXTENDED STATE FOR RETURN AMOUNT AND RECEIVED AMOUNT
    const [newCurrencyTranche, setNewCurrencyTranche] = useState<Partial<CurrencyTranche> & { returnAmount?: string, returnDate?: string, amountStr?: string, rialAmountStr?: string, receivedAmountStr?: string, currencyFeeStr?: string }>({ 
        amount: 0, 
        currencyType: 'EUR', 
        date: '', 
        exchangeName: '', 
        brokerName: '', 
        isDelivered: false, 
        deliveryDate: '',
        returnAmount: '',
        returnDate: '',
        receivedAmount: 0,
        amountStr: '',
        rialAmountStr: '',
        receivedAmountStr: '',
        currencyFeeStr: ''
    });
    const [editingTrancheId, setEditingTrancheId] = useState<string | null>(null);
    const [currencyGuarantee, setCurrencyGuarantee] = useState<{amount: string, bank: string, number: string, date: string, isDelivered: boolean}>({amount: '', bank: '', number: '', date: '', isDelivered: false});

    // Shipping Docs State
    const [activeShippingSubTab, setActiveShippingSubTab] = useState<ShippingDocType>('Commercial Invoice');
    const [shippingDocForm, setShippingDocForm] = useState<Partial<ShippingDocument>>({
        status: 'Draft',
        documentNumber: '',
        documentDate: '',
        attachments: [],
        invoiceItems: [],
        packingItems: [],
        freightCost: 0
    });
    const [newInvoiceItem, setNewInvoiceItem] = useState<Partial<InvoiceItem>>({ name: '', weight: 0, unitPrice: 0, totalPrice: 0, part: '' });
    const [newPackingItem, setNewPackingItem] = useState<Partial<PackingItem>>({ description: '', netWeight: 0, grossWeight: 0, packageCount: 0, part: '' });
    const [uploadingDocFile, setUploadingDocFile] = useState(false);
    const docFileInputRef = useRef<HTMLInputElement>(null);

    // Final Calculation State
    const [calcExchangeRate, setCalcExchangeRate] = useState<number>(0);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [showFinalReportPrint, setShowFinalReportPrint] = useState(false);
    
    // Clearance Print State
    const [showClearancePrint, setShowClearancePrint] = useState(false);

    useEffect(() => {
        loadRecords();
        getSettings().then(s => {
            setSettingsData(s);
            setCommodityGroups(s.commodityGroups || []);
            setAvailableBanks(s.bankNames || []);
            setOperatingBanks(s.operatingBankNames || []);
            setAvailableCompanies(s.companyNames || []);
            setNewRecordCompany(s.defaultCompany || '');
        });
    }, []);

    useEffect(() => {
        if (selectedRecord) {
            const insData = selectedRecord.insuranceData || {};
            setInsuranceForm({
                policyNumber: insData.policyNumber || '',
                company: insData.company || '',
                cost: insData.cost || 0,
                bank: insData.bank || '',
                endorsements: insData.endorsements || [],
                isPaid: !!insData.isPaid,
                paymentDate: insData.paymentDate || ''
            });

            const inspData = selectedRecord.inspectionData || {};
            const certificates = inspData.certificates || [];
            if (certificates.length === 0 && inspData.certificateNumber) {
                 certificates.push({ id: generateUUID(), part: 'Original', certificateNumber: inspData.certificateNumber, company: inspData.inspectionCompany || '', amount: inspData.totalInvoiceAmount || 0 });
            }
            setInspectionForm({
                certificates: certificates,
                payments: inspData.payments || []
            });

            const clrData = selectedRecord.clearanceData || {};
            setClearanceForm({
                receipts: clrData.receipts || [],
                payments: clrData.payments || []
            });

            const glData = selectedRecord.greenLeafData || {};
            setGreenLeafForm({
                duties: glData.duties || [],
                guarantees: glData.guarantees || [],
                taxes: glData.taxes || [],
                roadTolls: glData.roadTolls || []
            });

            const isData = selectedRecord.internalShippingData || {};
            setInternalShippingForm({
                payments: isData.payments || []
            });

            const agData = selectedRecord.agentData || {};
            setAgentForm({
                payments: agData.payments || []
            });

            const curData = (selectedRecord.currencyPurchaseData || {}) as CurrencyPurchaseData;
            setCurrencyForm({
                payments: curData.payments || [],
                purchasedAmount: curData.purchasedAmount || 0,
                purchasedCurrencyType: curData.purchasedCurrencyType || selectedRecord.mainCurrency || 'EUR',
                tranches: curData.tranches || [],
                isDelivered: !!curData.isDelivered,
                deliveredAmount: curData.deliveredAmount || 0,
                remittedAmount: curData.remittedAmount || 0,
                guaranteeCheque: curData.guaranteeCheque,
                purchaseDate: curData.purchaseDate || '',
                brokerName: curData.brokerName || '',
                exchangeName: curData.exchangeName || '',
                deliveryDate: curData.deliveryDate || '',
                recipientName: curData.recipientName || '',
                deliveredCurrencyType: curData.deliveredCurrencyType || ''
            });

            if (curData.guaranteeCheque) {
                setCurrencyGuarantee({
                    amount: formatNumberString(curData.guaranteeCheque.amount),
                    bank: curData.guaranteeCheque.bank,
                    number: curData.guaranteeCheque.chequeNumber,
                    date: curData.guaranteeCheque.dueDate,
                    isDelivered: curData.guaranteeCheque.isDelivered || false
                });
            } else {
                setCurrencyGuarantee({amount: '', bank: '', number: '', date: '', isDelivered: false});
            }
            
            setCalcExchangeRate(selectedRecord.exchangeRate || 0);
            
            // RESET LOCAL FORMS
            setNewLicenseTx({ amount: 0, bank: '', date: '', description: 'هزینه ثبت سفارش' });
            setNewCurrencyTranche({ amount: 0, currencyType: selectedRecord.mainCurrency || 'EUR', date: '', exchangeName: '', brokerName: '', isDelivered: false, returnAmount: '', returnDate: '', receivedAmount: 0, amountStr: '', rialAmountStr: '', receivedAmountStr: '', currencyFeeStr: '' });
            setEditingTrancheId(null);
            setNewItem({ name: '', weight: 0, unitPrice: 0, totalPrice: 0, hsCode: '', weightStr: '', unitPriceStr: '' });
            setEditingItemId(null);
            setNewInspectionPayment({ part: '', amount: 0, date: '', bank: '' });
            setNewInspectionCertificate({ part: '', company: '', certificateNumber: '', amount: 0 });
            setNewWarehouseReceipt({ number: '', part: '', issueDate: '' });
            setNewClearancePayment({ amount: 0, part: '', bank: '', date: '', payingBank: '' });
            setNewCustomsDuty({ cottageNumber: '', part: '', amount: 0, paymentMethod: 'Bank', bank: '', date: '' });
            setNewGuaranteeDetails({ guaranteeNumber: '', chequeNumber: '', chequeBank: '', chequeDate: '', cashAmount: 0, cashBank: '', cashDate: '', chequeAmount: 0 });
            setNewTax({ part: '', amount: 0, bank: '', date: '' });
            setNewRoadToll({ part: '', amount: 0, bank: '', date: '' });
            setNewShippingPayment({ part: '', amount: 0, date: '', bank: '', description: '' });
            setNewAgentPayment({ agentName: '', amount: 0, bank: '', date: '', part: '', description: '' });
            setShippingDocForm({ status: 'Draft', documentNumber: '', documentDate: '', attachments: [], currency: selectedRecord.mainCurrency || 'EUR', invoiceItems: [], packingItems: [], freightCost: 0 });
            setNewInvoiceItem({ name: '', weight: 0, unitPrice: 0, totalPrice: 0, part: '' });
            setNewPackingItem({ description: '', netWeight: 0, grossWeight: 0, packageCount: 0, part: '' });
        }
    }, [selectedRecord]);

    const loadRecords = async () => { setRecords(await getTradeRecords()); };

    const getStageData = (record: TradeRecord | null, stage: TradeStage): TradeStageData => {
        if (!record || !record.stages) return { stage, isCompleted: false, description: '', costRial: 0, costCurrency: 0, currencyType: 'EUR', attachments: [], updatedAt: 0, updatedBy: '' };
        return record.stages[stage] || { stage, isCompleted: false, description: '', costRial: 0, costCurrency: 0, currencyType: 'EUR', attachments: [], updatedAt: 0, updatedBy: '' };
    };

    const handleCreateRecord = async () => { if (!newFileNumber || !newGoodsName) return; const newRecord: TradeRecord = { id: generateUUID(), company: newRecordCompany, fileNumber: newFileNumber, orderNumber: newFileNumber, goodsName: newGoodsName, registrationNumber: '', sellerName: newSellerName, commodityGroup: newCommodityGroup, mainCurrency: newMainCurrency, items: [], freightCost: 0, startDate: new Date().toISOString(), status: 'Active', stages: {}, createdAt: Date.now(), createdBy: currentUser.fullName, licenseData: { transactions: [] }, shippingDocuments: [] }; STAGES.forEach(stage => { newRecord.stages[stage] = { stage, isCompleted: false, description: '', costRial: 0, costCurrency: 0, currencyType: newMainCurrency, attachments: [], updatedAt: Date.now(), updatedBy: '' }; }); await saveTradeRecord(newRecord); await loadRecords(); setShowNewModal(false); setNewFileNumber(''); setNewGoodsName(''); setSelectedRecord(newRecord); setActiveTab('proforma'); setViewMode('details'); };
    
    // ... Handlers ...
    const handleSaveInsurance = async () => { if (!selectedRecord) return; const updatedRecord = { ...selectedRecord, insuranceData: insuranceForm }; const totalCost = (Number(insuranceForm.cost) || 0) + (insuranceForm.endorsements || []).reduce((acc, e) => acc + e.amount, 0); if (!updatedRecord.stages[TradeStage.INSURANCE]) updatedRecord.stages[TradeStage.INSURANCE] = getStageData(updatedRecord, TradeStage.INSURANCE); updatedRecord.stages[TradeStage.INSURANCE].costRial = totalCost; updatedRecord.stages[TradeStage.INSURANCE].isCompleted = !!insuranceForm.policyNumber; await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); alert("اطلاعات بیمه ذخیره شد."); };
    const handleAddEndorsement = () => { if (!newEndorsement.amount) return; const amount = endorsementType === 'increase' ? Number(newEndorsement.amount) : -Number(newEndorsement.amount); const endorsement: InsuranceEndorsement = { id: generateUUID(), date: newEndorsement.date || '', amount: amount, description: newEndorsement.description || '' }; const updatedEndorsements = [...(insuranceForm.endorsements || []), endorsement]; setInsuranceForm({ ...insuranceForm, endorsements: updatedEndorsements }); setNewEndorsement({ amount: 0, description: '', date: '' }); };
    const handleDeleteEndorsement = (id: string) => { setInsuranceForm({ ...insuranceForm, endorsements: insuranceForm.endorsements?.filter(e => e.id !== id) }); };

    const handleSaveStage = async () => { 
        if (!selectedRecord || !editingStage) return; 
        const updatedRecord = { ...selectedRecord }; 
        updatedRecord.stages[editingStage] = { 
            ...getStageData(selectedRecord, editingStage), 
            ...stageFormData, 
            updatedAt: Date.now(), 
            updatedBy: currentUser.fullName 
        }; 
        
        if (editingStage === TradeStage.ALLOCATION_QUEUE && stageFormData.queueDate) { 
            updatedRecord.stages[TradeStage.ALLOCATION_QUEUE].queueDate = stageFormData.queueDate; 
        } 
        if (editingStage === TradeStage.ALLOCATION_APPROVED) { 
            updatedRecord.stages[TradeStage.ALLOCATION_APPROVED].allocationDate = stageFormData.allocationDate; 
            updatedRecord.stages[TradeStage.ALLOCATION_APPROVED].allocationCode = stageFormData.allocationCode; 
            updatedRecord.stages[TradeStage.ALLOCATION_APPROVED].allocationExpiry = stageFormData.allocationExpiry; 
        } 
        
        await updateTradeRecord(updatedRecord);
        setSelectedRecord(updatedRecord);
        setEditingStage(null);
        setStageFormData({});
        setUploadingStageFile(false);
    };

    return (
        <div className="p-6 bg-gray-50 min-h-full">
            {/* Header / Nav */}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">مدیریت بازرگانی</h1>
                <div className="flex gap-2">
                    <button onClick={() => setViewMode('reports')} className="bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center gap-2">
                        <FileText size={20}/> گزارشات
                    </button>
                    <button onClick={() => setShowNewModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2">
                        <Plus size={20}/> پرونده جدید
                    </button>
                </div>
            </div>

            {/* Dashboard View */}
            {viewMode === 'dashboard' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {records.map(record => (
                        <div key={record.id} onClick={() => { setSelectedRecord(record); setViewMode('details'); }} className="bg-white p-4 rounded-xl shadow-sm border hover:border-blue-500 cursor-pointer transition-all">
                            <div className="flex justify-between items-start mb-2">
                                <span className="font-bold text-lg">{record.fileNumber}</span>
                                <span className={`text-xs px-2 py-1 rounded ${record.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{record.status === 'Active' ? 'فعال' : 'تکمیل شده'}</span>
                            </div>
                            <div className="text-sm text-gray-600 space-y-1">
                                <div>کالا: {record.goodsName}</div>
                                <div>شرکت: {record.company}</div>
                                <div>تاریخ: {new Date(record.startDate).toLocaleDateString('fa-IR')}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Details View */}
            {viewMode === 'details' && selectedRecord && (
                <div className="bg-white rounded-2xl shadow-lg border overflow-hidden">
                    <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                        <div className="flex items-center gap-4">
                            <button onClick={() => setViewMode('dashboard')} className="p-2 hover:bg-gray-200 rounded-full"><ArrowRight size={20}/></button>
                            <h2 className="text-xl font-bold">{selectedRecord.fileNumber} - {selectedRecord.goodsName}</h2>
                        </div>
                        <div className="flex gap-2 overflow-x-auto">
                            <button onClick={() => setActiveTab('timeline')} className={`px-4 py-2 rounded text-sm ${activeTab==='timeline'?'bg-blue-600 text-white':'bg-gray-100'}`}>مسیر پرونده</button>
                            <button onClick={() => setActiveTab('insurance')} className={`px-4 py-2 rounded text-sm ${activeTab==='insurance'?'bg-blue-600 text-white':'bg-gray-100'}`}>بیمه</button>
                            <button onClick={() => setActiveTab('currency_purchase')} className={`px-4 py-2 rounded text-sm ${activeTab==='currency_purchase'?'bg-blue-600 text-white':'bg-gray-100'}`}>خرید ارز</button>
                            {/* Add other tabs here */}
                        </div>
                    </div>
                    <div className="p-6">
                        {/* Tab Content */}
                        {activeTab === 'timeline' && (
                            <div className="space-y-4">
                                {STAGES.map(stage => {
                                    const data = getStageData(selectedRecord, stage);
                                    return (
                                        <div key={stage} className="border p-4 rounded flex justify-between items-center bg-gray-50">
                                            <div>
                                                <div className="font-bold">{stage}</div>
                                                <div className="text-xs text-gray-500">هزینه: {formatCurrency(data.costRial)}</div>
                                            </div>
                                            <button onClick={() => { setEditingStage(stage); setStageFormData(data); }} className="text-blue-600">ویرایش</button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        {activeTab === 'insurance' && (
                            <InsuranceTab 
                                form={insuranceForm} 
                                setForm={setInsuranceForm} 
                                companies={settings?.insuranceCompanies || []}
                                banks={availableBanks}
                                onSave={handleSaveInsurance}
                                newEndorsement={newEndorsement}
                                setNewEndorsement={setNewEndorsement}
                                endorsementType={endorsementType}
                                setEndorsementType={setEndorsementType}
                                onAddEndorsement={handleAddEndorsement}
                                onDeleteEndorsement={handleDeleteEndorsement}
                            />
                        )}
                        {/* Other tabs placeholders */}
                    </div>
                </div>
            )}

            {/* Reports View */}
            {viewMode === 'reports' && (
                <div className="space-y-6">
                    <div className="flex items-center gap-4 mb-4">
                        <button onClick={() => setViewMode('dashboard')} className="p-2 hover:bg-gray-200 rounded-full"><ArrowRight size={20}/></button>
                        <h2 className="text-xl font-bold">گزارشات بازرگانی</h2>
                    </div>
                    <div className="flex gap-2 border-b pb-2 mb-4 overflow-x-auto">
                        <button onClick={() => setActiveReport('allocation_queue')} className={`px-4 py-2 rounded ${activeReport==='allocation_queue'?'bg-blue-600 text-white':'bg-gray-100'}`}>صف تخصیص</button>
                        <button onClick={() => setActiveReport('currency')} className={`px-4 py-2 rounded ${activeReport==='currency'?'bg-blue-600 text-white':'bg-gray-100'}`}>خرید ارز</button>
                        <button onClick={() => setActiveReport('company_performance')} className={`px-4 py-2 rounded ${activeReport==='company_performance'?'bg-blue-600 text-white':'bg-gray-100'}`}>عملکرد شرکت‌ها</button>
                        <button onClick={() => setActiveReport('insurance_ledger')} className={`px-4 py-2 rounded ${activeReport==='insurance_ledger'?'bg-blue-600 text-white':'bg-gray-100'}`}>صورتحساب بیمه</button>
                    </div>
                    
                    {activeReport === 'allocation_queue' && <AllocationReport records={records} onUpdateRecord={updateTradeRecord} settings={settings} />}
                    {activeReport === 'currency' && <CurrencyReport records={records} />}
                    {activeReport === 'company_performance' && <CompanyPerformanceReport records={records} />}
                    {activeReport === 'insurance_ledger' && <InsuranceLedgerReport records={records} settings={settings || undefined} />}
                </div>
            )}

            {/* New Record Modal */}
            {showNewModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-xl w-96">
                        <h3 className="font-bold text-lg mb-4">ایجاد پرونده جدید</h3>
                        <input className="w-full border p-2 rounded mb-2" placeholder="شماره پرونده" value={newFileNumber} onChange={e => setNewFileNumber(e.target.value)} />
                        <input className="w-full border p-2 rounded mb-2" placeholder="نام کالا" value={newGoodsName} onChange={e => setNewGoodsName(e.target.value)} />
                        <select className="w-full border p-2 rounded mb-4" value={newRecordCompany} onChange={e => setNewRecordCompany(e.target.value)}>
                            <option value="">انتخاب شرکت</option>
                            {availableCompanies.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowNewModal(false)} className="px-4 py-2 border rounded">انصراف</button>
                            <button onClick={handleCreateRecord} className="px-4 py-2 bg-blue-600 text-white rounded">ایجاد</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Stage Modal */}
            {editingStage && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-xl w-96">
                        <h3 className="font-bold text-lg mb-4">ویرایش مرحله: {editingStage}</h3>
                        <div className="mb-4">
                            <label className="block text-sm mb-1">هزینه ریالی</label>
                            <input type="number" className="w-full border p-2 rounded" value={stageFormData.costRial || ''} onChange={e => setStageFormData({...stageFormData, costRial: Number(e.target.value)})} />
                        </div>
                        <div className="mb-4">
                            <label className="block text-sm mb-1">توضیحات</label>
                            <textarea className="w-full border p-2 rounded" value={stageFormData.description || ''} onChange={e => setStageFormData({...stageFormData, description: e.target.value})} />
                        </div>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setEditingStage(null)} className="px-4 py-2 border rounded">انصراف</button>
                            <button onClick={handleSaveStage} className="px-4 py-2 bg-green-600 text-white rounded">ذخیره</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TradeModule;
