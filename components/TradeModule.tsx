
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
            // CRITICAL FIX: Safe initialization to prevent crashes on empty legacy data
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

    const goRoot = () => { setNavLevel('ROOT'); setSelectedCompany(null); setSelectedGroup(null); setSearchTerm(''); };
    const goCompany = (company: string) => { setSelectedCompany(company); setNavLevel('COMPANY'); setSelectedGroup(null); setSearchTerm(''); };
    const goGroup = (group: string) => { setSelectedGroup(group); setNavLevel('GROUP'); setSearchTerm(''); };

    const groupedData = useMemo(() => {
        const currentRecords = records.filter(r => showArchived ? r.isArchived : !r.isArchived);
        if (navLevel === 'ROOT') {
            const companies: Record<string, number> = {};
            currentRecords.forEach(r => { const c = r.company || 'بدون شرکت'; companies[c] = (companies[c] || 0) + 1; });
            return Object.entries(companies).map(([name, count]) => ({ name, count, type: 'company' }));
        } else if (navLevel === 'COMPANY') {
            const groups: Record<string, number> = {};
            currentRecords.filter(r => (r.company || 'بدون شرکت') === selectedCompany).forEach(r => { const g = r.commodityGroup || 'سایر'; groups[g] = (groups[g] || 0) + 1; });
            return Object.entries(groups).map(([name, count]) => ({ name, count, type: 'group' }));
        }
        return [];
    }, [records, showArchived, navLevel, selectedCompany]);

    const getStageData = (record: TradeRecord | null, stage: TradeStage): TradeStageData => {
        if (!record || !record.stages) return { stage, isCompleted: false, description: '', costRial: 0, costCurrency: 0, currencyType: 'EUR', attachments: [], updatedAt: 0, updatedBy: '' };
        return record.stages[stage] || { stage, isCompleted: false, description: '', costRial: 0, costCurrency: 0, currencyType: 'EUR', attachments: [], updatedAt: 0, updatedBy: '' };
    };

    const handleCreateRecord = async () => { if (!newFileNumber || !newGoodsName) return; const newRecord: TradeRecord = { id: generateUUID(), company: newRecordCompany, fileNumber: newFileNumber, orderNumber: newFileNumber, goodsName: newGoodsName, registrationNumber: '', sellerName: newSellerName, commodityGroup: newCommodityGroup, mainCurrency: newMainCurrency, items: [], freightCost: 0, startDate: new Date().toISOString(), status: 'Active', stages: {}, createdAt: Date.now(), createdBy: currentUser.fullName, licenseData: { transactions: [] }, shippingDocuments: [] }; STAGES.forEach(stage => { newRecord.stages[stage] = { stage, isCompleted: false, description: '', costRial: 0, costCurrency: 0, currencyType: newMainCurrency, attachments: [], updatedAt: Date.now(), updatedBy: '' }; }); await saveTradeRecord(newRecord); await loadRecords(); setShowNewModal(false); setNewFileNumber(''); setNewGoodsName(''); setSelectedRecord(newRecord); setActiveTab('proforma'); setViewMode('details'); };
    const handleDeleteRecord = async (id: string, e: React.MouseEvent) => { 
        e.stopPropagation(); // Prevent card click
        if (confirm("آیا از حذف این پرونده بازرگانی اطمینان دارید؟")) { 
            await deleteTradeRecord(id); 
            if (selectedRecord?.id === id) setSelectedRecord(null); 
            loadRecords(); 
        } 
    };
    
    // UPDATED: Sync to state list to handle persistence on back
    const handleUpdateProforma = async (field: keyof TradeRecord, value: string | number) => { 
        if (!selectedRecord) return; 
        const updatedRecord = { ...selectedRecord, [field]: value }; 
        setSelectedRecord(updatedRecord);
        await updateTradeRecord(updatedRecord); 
        setRecords(prev => prev.map(r => r.id === updatedRecord.id ? updatedRecord : r));
    };
    
    // ITEM MANAGEMENT
    const handleAddItem = async () => { 
        if (!selectedRecord || !newItem.name) return; 
        
        const weightVal = newItem.weightStr ? deformatNumberString(newItem.weightStr) : 0;
        const unitPriceVal = newItem.unitPriceStr ? deformatNumberString(newItem.unitPriceStr) : 0;

        const item: TradeItem = { 
            id: editingItemId || generateUUID(), 
            name: newItem.name, 
            weight: weightVal, 
            unitPrice: unitPriceVal, 
            totalPrice: newItem.totalPrice || (weightVal * unitPriceVal), 
            hsCode: newItem.hsCode 
        }; 

        let updatedItems = [];
        if (editingItemId) {
            updatedItems = selectedRecord.items.map(i => i.id === editingItemId ? item : i);
        } else {
            updatedItems = [...selectedRecord.items, item];
        }

        const updatedRecord = { ...selectedRecord, items: updatedItems }; 
        await updateTradeRecord(updatedRecord); 
        setSelectedRecord(updatedRecord); 
        setRecords(prev => prev.map(r => r.id === updatedRecord.id ? updatedRecord : r));

        setNewItem({ name: '', weight: 0, unitPrice: 0, totalPrice: 0, hsCode: '', weightStr: '', unitPriceStr: '' }); 
        setEditingItemId(null);
    };

    const handleEditItem = (item: TradeItem) => {
        setNewItem({
            name: item.name,
            weight: item.weight,
            weightStr: formatNumberString(item.weight),
            unitPrice: item.unitPrice,
            unitPriceStr: formatNumberString(item.unitPrice),
            totalPrice: item.totalPrice,
            hsCode: item.hsCode || ''
        });
        setEditingItemId(item.id);
    };

    const handleRemoveItem = async (id: string) => { if (!selectedRecord) return; const updatedItems = selectedRecord.items.filter(i => i.id !== id); const updatedRecord = { ...selectedRecord, items: updatedItems }; await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); };
    
    const handleAddLicenseTx = async () => { if (!selectedRecord || !newLicenseTx.amount) return; const tx: TradeTransaction = { id: generateUUID(), date: newLicenseTx.date || '', amount: Number(newLicenseTx.amount), bank: newLicenseTx.bank || '', description: newLicenseTx.description || '' }; const currentLicenseData = selectedRecord.licenseData || { transactions: [] }; const updatedTransactions = [...(currentLicenseData.transactions || []), tx]; const updatedRecord = { ...selectedRecord, licenseData: { ...currentLicenseData, transactions: updatedTransactions } }; const totalCost = updatedTransactions.reduce((acc, t) => acc + t.amount, 0); if (!updatedRecord.stages[TradeStage.LICENSES]) updatedRecord.stages[TradeStage.LICENSES] = getStageData(updatedRecord, TradeStage.LICENSES); updatedRecord.stages[TradeStage.LICENSES].costRial = totalCost; updatedRecord.stages[TradeStage.LICENSES].isCompleted = totalCost > 0; await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); setNewLicenseTx({ amount: 0, bank: '', date: '', description: 'هزینه ثبت سفارش' }); };
    const handleRemoveLicenseTx = async (id: string) => { if (!selectedRecord) return; const currentLicenseData = selectedRecord.licenseData || { transactions: [] }; const updatedTransactions = (currentLicenseData.transactions || []).filter(t => t.id !== id); const updatedRecord = { ...selectedRecord, licenseData: { ...currentLicenseData, transactions: updatedTransactions } }; const totalCost = updatedTransactions.reduce((acc, t) => acc + t.amount, 0); if (!updatedRecord.stages[TradeStage.LICENSES]) updatedRecord.stages[TradeStage.LICENSES] = getStageData(updatedRecord, TradeStage.LICENSES); updatedRecord.stages[TradeStage.LICENSES].costRial = totalCost; await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); };
    
    // INSURANCE HANDLERS (Used by Child Component)
    const handleSaveInsurance = async () => { if (!selectedRecord) return; const updatedRecord = { ...selectedRecord, insuranceData: insuranceForm }; const totalCost = (Number(insuranceForm.cost) || 0) + (insuranceForm.endorsements || []).reduce((acc, e) => acc + e.amount, 0); if (!updatedRecord.stages[TradeStage.INSURANCE]) updatedRecord.stages[TradeStage.INSURANCE] = getStageData(updatedRecord, TradeStage.INSURANCE); updatedRecord.stages[TradeStage.INSURANCE].costRial = totalCost; updatedRecord.stages[TradeStage.INSURANCE].isCompleted = !!insuranceForm.policyNumber; await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); alert("اطلاعات بیمه ذخیره شد."); };
    const handleAddEndorsement = () => { if (!newEndorsement.amount) return; const amount = endorsementType === 'increase' ? Number(newEndorsement.amount) : -Number(newEndorsement.amount); const endorsement: InsuranceEndorsement = { id: generateUUID(), date: newEndorsement.date || '', amount: amount, description: newEndorsement.description || '' }; const updatedEndorsements = [...(insuranceForm.endorsements || []), endorsement]; setInsuranceForm({ ...insuranceForm, endorsements: updatedEndorsements }); setNewEndorsement({ amount: 0, description: '', date: '' }); };
    const handleDeleteEndorsement = (id: string) => { setInsuranceForm({ ...insuranceForm, endorsements: insuranceForm.endorsements?.filter(e => e.id !== id) }); };
    
    // ... (Handlers kept) ...
    const handleAddInspectionCertificate = async () => { if (!selectedRecord || !newInspectionCertificate.amount) return; const cert: InspectionCertificate = { id: generateUUID(), part: newInspectionCertificate.part || 'Part', company: newInspectionCertificate.company || '', certificateNumber: newInspectionCertificate.certificateNumber || '', amount: Number(newInspectionCertificate.amount), description: '' }; const updatedCertificates = [...(inspectionForm.certificates || []), cert]; const updatedData = { ...inspectionForm, certificates: updatedCertificates }; setInspectionForm(updatedData); setNewInspectionCertificate({ part: '', company: '', certificateNumber: '', amount: 0 }); const updatedRecord = { ...selectedRecord, inspectionData: updatedData }; if (!updatedRecord.stages[TradeStage.INSPECTION]) updatedRecord.stages[TradeStage.INSPECTION] = getStageData(updatedRecord, TradeStage.INSPECTION); updatedRecord.stages[TradeStage.INSPECTION].isCompleted = updatedCertificates.length > 0; await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); };
    const handleDeleteInspectionCertificate = async (id: string) => { if (!selectedRecord) return; const updatedCertificates = (inspectionForm.certificates || []).filter(c => c.id !== id); const updatedData = { ...inspectionForm, certificates: updatedCertificates }; setInspectionForm(updatedData); const updatedRecord = { ...selectedRecord, inspectionData: updatedData }; await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); };
    const handleAddInspectionPayment = async () => { if (!selectedRecord || !newInspectionPayment.amount) return; const payment: InspectionPayment = { id: generateUUID(), part: newInspectionPayment.part || 'Part', amount: Number(newInspectionPayment.amount), date: newInspectionPayment.date || '', bank: newInspectionPayment.bank || '', description: '' }; const updatedPayments = [...(inspectionForm.payments || []), payment]; const updatedData = { ...inspectionForm, payments: updatedPayments }; setInspectionForm(updatedData); setNewInspectionPayment({ part: '', amount: 0, date: '', bank: '' }); const updatedRecord = { ...selectedRecord, inspectionData: updatedData }; if (!updatedRecord.stages[TradeStage.INSPECTION]) updatedRecord.stages[TradeStage.INSPECTION] = getStageData(updatedRecord, TradeStage.INSPECTION); updatedRecord.stages[TradeStage.INSPECTION].costRial = updatedPayments.reduce((acc, p) => acc + p.amount, 0); await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); };
    const handleDeleteInspectionPayment = async (id: string) => { if (!selectedRecord) return; const updatedPayments = (inspectionForm.payments || []).filter(p => p.id !== id); const updatedData = { ...inspectionForm, payments: updatedPayments }; setInspectionForm(updatedData); const updatedRecord = { ...selectedRecord, inspectionData: updatedData }; if (!updatedRecord.stages[TradeStage.INSPECTION]) updatedRecord.stages[TradeStage.INSPECTION] = getStageData(updatedRecord, TradeStage.INSPECTION); updatedRecord.stages[TradeStage.INSPECTION].costRial = updatedPayments.reduce((acc, p) => acc + p.amount, 0); await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); };
    const handleAddWarehouseReceipt = async () => { if (!selectedRecord || !newWarehouseReceipt.number) return; const receipt: WarehouseReceipt = { id: generateUUID(), number: newWarehouseReceipt.number || '', part: newWarehouseReceipt.part || '', issueDate: newWarehouseReceipt.issueDate || '' }; const updatedReceipts = [...(clearanceForm.receipts || []), receipt]; const updatedData = { ...clearanceForm, receipts: updatedReceipts }; setClearanceForm(updatedData); setNewWarehouseReceipt({ number: '', part: '', issueDate: '' }); const updatedRecord = { ...selectedRecord, clearanceData: updatedData }; if (!updatedRecord.stages[TradeStage.CLEARANCE_DOCS]) updatedRecord.stages[TradeStage.CLEARANCE_DOCS] = getStageData(updatedRecord, TradeStage.CLEARANCE_DOCS); updatedRecord.stages[TradeStage.CLEARANCE_DOCS].isCompleted = updatedReceipts.length > 0; await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); };
    const handleDeleteWarehouseReceipt = async (id: string) => { if (!selectedRecord) return; const updatedReceipts = (clearanceForm.receipts || []).filter(r => r.id !== id); const updatedData = { ...clearanceForm, receipts: updatedReceipts }; setClearanceForm(updatedData); const updatedRecord = { ...selectedRecord, clearanceData: updatedData }; await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); };
    const handleAddClearancePayment = async () => { if (!selectedRecord || !newClearancePayment.amount) return; const payment: ClearancePayment = { id: generateUUID(), amount: Number(newClearancePayment.amount), part: newClearancePayment.part || '', bank: newClearancePayment.bank || '', date: newClearancePayment.date || '', payingBank: newClearancePayment.payingBank }; const updatedPayments = [...(clearanceForm.payments || []), payment]; const updatedData = { ...clearanceForm, payments: updatedPayments }; setClearanceForm(updatedData); setNewClearancePayment({ amount: 0, part: '', bank: '', date: '', payingBank: '' }); const totalCost = updatedPayments.reduce((acc, p) => acc + p.amount, 0); const updatedRecord = { ...selectedRecord, clearanceData: updatedData }; if (!updatedRecord.stages[TradeStage.CLEARANCE_DOCS]) updatedRecord.stages[TradeStage.CLEARANCE_DOCS] = getStageData(updatedRecord, TradeStage.CLEARANCE_DOCS); updatedRecord.stages[TradeStage.CLEARANCE_DOCS].costRial = totalCost; await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); };
    const handleDeleteClearancePayment = async (id: string) => { if (!selectedRecord) return; const updatedPayments = (clearanceForm.payments || []).filter(p => p.id !== id); const updatedData = { ...clearanceForm, payments: updatedPayments }; setClearanceForm(updatedData); const totalCost = updatedPayments.reduce((acc, p) => acc + p.amount, 0); const updatedRecord = { ...selectedRecord, clearanceData: updatedData }; if (!updatedRecord.stages[TradeStage.CLEARANCE_DOCS]) updatedRecord.stages[TradeStage.CLEARANCE_DOCS] = getStageData(updatedRecord, TradeStage.CLEARANCE_DOCS); updatedRecord.stages[TradeStage.CLEARANCE_DOCS].costRial = totalCost; await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); };
    const calculateGreenLeafTotal = (data: GreenLeafData) => { let total = 0; total += data.duties.filter(d => d.paymentMethod === 'Bank').reduce((acc, d) => acc + d.amount, 0); total += data.guarantees.reduce((acc, g) => acc + (g.cashAmount || 0) + (g.chequeAmount || 0), 0); total += data.taxes.reduce((acc, t) => acc + t.amount, 0); total += data.roadTolls.reduce((acc, r) => acc + r.amount, 0); return total; };
    const updateGreenLeafRecord = async (newData: GreenLeafData) => { if (!selectedRecord) return; setGreenLeafForm(newData); const totalCost = calculateGreenLeafTotal(newData); const updatedRecord = { ...selectedRecord, greenLeafData: newData }; if (!updatedRecord.stages[TradeStage.GREEN_LEAF]) updatedRecord.stages[TradeStage.GREEN_LEAF] = getStageData(updatedRecord, TradeStage.GREEN_LEAF); updatedRecord.stages[TradeStage.GREEN_LEAF].costRial = totalCost; updatedRecord.stages[TradeStage.GREEN_LEAF].isCompleted = (newData.duties.length > 0); await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); };
    const handleAddCustomsDuty = async () => { if (!newCustomsDuty.cottageNumber || !newCustomsDuty.amount) return; const duty: GreenLeafCustomsDuty = { id: generateUUID(), cottageNumber: newCustomsDuty.cottageNumber, part: newCustomsDuty.part || '', amount: Number(newCustomsDuty.amount), paymentMethod: (newCustomsDuty.paymentMethod as 'Bank' | 'Guarantee') || 'Bank', bank: newCustomsDuty.bank, date: newCustomsDuty.date }; const updatedDuties = [...greenLeafForm.duties, duty]; await updateGreenLeafRecord({ ...greenLeafForm, duties: updatedDuties }); setNewCustomsDuty({ cottageNumber: '', part: '', amount: 0, paymentMethod: 'Bank', bank: '', date: '' }); };
    const handleDeleteCustomsDuty = async (id: string) => { const updatedDuties = greenLeafForm.duties.filter(d => d.id !== id); const updatedGuarantees = greenLeafForm.guarantees.filter(g => g.relatedDutyId !== id); await updateGreenLeafRecord({ ...greenLeafForm, duties: updatedDuties, guarantees: updatedGuarantees }); };
    const handleAddGuarantee = async () => { if (!selectedDutyForGuarantee || !newGuaranteeDetails.guaranteeNumber) return; const duty = greenLeafForm.duties.find(d => d.id === selectedDutyForGuarantee); const guarantee: GreenLeafGuarantee = { id: generateUUID(), relatedDutyId: selectedDutyForGuarantee, guaranteeNumber: newGuaranteeDetails.guaranteeNumber, chequeNumber: newGuaranteeDetails.chequeNumber, chequeBank: newGuaranteeDetails.chequeBank, chequeDate: newGuaranteeDetails.chequeDate, chequeAmount: Number(newGuaranteeDetails.chequeAmount) || 0, isDelivered: false, cashAmount: Number(newGuaranteeDetails.cashAmount) || 0, cashBank: newGuaranteeDetails.cashBank, cashDate: newGuaranteeDetails.cashDate, part: duty?.part }; const updatedGuarantees = [...greenLeafForm.guarantees, guarantee]; await updateGreenLeafRecord({ ...greenLeafForm, guarantees: updatedGuarantees }); setNewGuaranteeDetails({ guaranteeNumber: '', chequeNumber: '', chequeBank: '', chequeDate: '', cashAmount: 0, cashBank: '', cashDate: '', chequeAmount: 0 }); setSelectedDutyForGuarantee(''); };
    const handleDeleteGuarantee = async (id: string) => { const updatedGuarantees = greenLeafForm.guarantees.filter(g => g.id !== id); await updateGreenLeafRecord({ ...greenLeafForm, guarantees: updatedGuarantees }); };
    const handleToggleGuaranteeDelivery = async (id: string) => { const updatedGuarantees = greenLeafForm.guarantees.map(g => g.id === id ? { ...g, isDelivered: !g.isDelivered } : g); await updateGreenLeafRecord({ ...greenLeafForm, guarantees: updatedGuarantees }); };
    const handleAddTax = async () => { if (!newTax.amount) return; const tax: GreenLeafTax = { id: generateUUID(), amount: Number(newTax.amount), part: newTax.part || '', bank: newTax.bank || '', date: newTax.date || '' }; const updatedTaxes = [...greenLeafForm.taxes, tax]; await updateGreenLeafRecord({ ...greenLeafForm, taxes: updatedTaxes }); setNewTax({ part: '', amount: 0, bank: '', date: '' }); };
    const handleDeleteTax = async (id: string) => { const updatedTaxes = greenLeafForm.taxes.filter(t => t.id !== id); await updateGreenLeafRecord({ ...greenLeafForm, taxes: updatedTaxes }); };
    const handleAddRoadToll = async () => { if (!newRoadToll.amount) return; const toll: GreenLeafRoadToll = { id: generateUUID(), amount: Number(newRoadToll.amount), part: newRoadToll.part || '', bank: newRoadToll.bank || '', date: newRoadToll.date || '' }; const updatedTolls = [...greenLeafForm.roadTolls, toll]; await updateGreenLeafRecord({ ...greenLeafForm, roadTolls: updatedTolls }); setNewRoadToll({ part: '', amount: 0, bank: '', date: '' }); };
    const handleDeleteRoadToll = async (id: string) => { const updatedTolls = greenLeafForm.roadTolls.filter(t => t.id !== id); await updateGreenLeafRecord({ ...greenLeafForm, roadTolls: updatedTolls }); };
    const handleAddShippingPayment = async () => { if (!selectedRecord || !newShippingPayment.amount) return; const payment: ShippingPayment = { id: generateUUID(), part: newShippingPayment.part || '', amount: Number(newShippingPayment.amount), date: newShippingPayment.date || '', bank: newShippingPayment.bank || '', description: newShippingPayment.description || '' }; const updatedPayments = [...(internalShippingForm.payments || []), payment]; const updatedData = { ...internalShippingForm, payments: updatedPayments }; setInternalShippingForm(updatedData); setNewShippingPayment({ part: '', amount: 0, date: '', bank: '', description: '' }); const updatedRecord = { ...selectedRecord, internalShippingData: updatedData }; if (!updatedRecord.stages[TradeStage.INTERNAL_SHIPPING]) updatedRecord.stages[TradeStage.INTERNAL_SHIPPING] = getStageData(updatedRecord, TradeStage.INTERNAL_SHIPPING); updatedRecord.stages[TradeStage.INTERNAL_SHIPPING].costRial = updatedPayments.reduce((acc, p) => acc + p.amount, 0); updatedRecord.stages[TradeStage.INTERNAL_SHIPPING].isCompleted = updatedPayments.length > 0; await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); };
    const handleDeleteShippingPayment = async (id: string) => { if (!selectedRecord) return; const updatedPayments = (internalShippingForm.payments || []).filter(p => p.id !== id); const updatedData = { ...internalShippingForm, payments: updatedPayments }; setInternalShippingForm(updatedData); const updatedRecord = { ...selectedRecord, internalShippingData: updatedData }; if (!updatedRecord.stages[TradeStage.INTERNAL_SHIPPING]) updatedRecord.stages[TradeStage.INTERNAL_SHIPPING] = getStageData(updatedRecord, TradeStage.INTERNAL_SHIPPING); updatedRecord.stages[TradeStage.INTERNAL_SHIPPING].costRial = updatedPayments.reduce((acc, p) => acc + p.amount, 0); await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); };
    const handleAddAgentPayment = async () => { if (!selectedRecord || !newAgentPayment.amount || !newAgentPayment.agentName) return; const payment: AgentPayment = { id: generateUUID(), agentName: newAgentPayment.agentName, amount: Number(newAgentPayment.amount), bank: newAgentPayment.bank || '', date: newAgentPayment.date || '', part: newAgentPayment.part || '', description: newAgentPayment.description || '' }; const updatedPayments = [...(agentForm.payments || []), payment]; const updatedData = { ...agentForm, payments: updatedPayments }; setAgentForm(updatedData); setNewAgentPayment({ agentName: newAgentPayment.agentName, amount: 0, bank: '', date: '', part: '', description: '' }); const updatedRecord = { ...selectedRecord, agentData: updatedData }; if (!updatedRecord.stages[TradeStage.AGENT_FEES]) updatedRecord.stages[TradeStage.AGENT_FEES] = getStageData(updatedRecord, TradeStage.AGENT_FEES); updatedRecord.stages[TradeStage.AGENT_FEES].costRial = updatedPayments.reduce((acc, p) => acc + p.amount, 0); updatedRecord.stages[TradeStage.AGENT_FEES].isCompleted = updatedPayments.length > 0; await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); };
    const handleDeleteAgentPayment = async (id: string) => { if (!selectedRecord) return; const updatedPayments = (agentForm.payments || []).filter(p => p.id !== id); const updatedData = { ...agentForm, payments: updatedPayments }; setAgentForm(updatedData); const updatedRecord = { ...selectedRecord, agentData: updatedData }; if (!updatedRecord.stages[TradeStage.AGENT_FEES]) updatedRecord.stages[TradeStage.AGENT_FEES] = getStageData(updatedRecord, TradeStage.AGENT_FEES); updatedRecord.stages[TradeStage.AGENT_FEES].costRial = updatedPayments.reduce((acc, p) => acc + p.amount, 0); await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); };
    
    // ... (Currency tranche logic remains same) ...
    const handleAddCurrencyTranche = async () => { 
        if (!selectedRecord || !newCurrencyTranche.amountStr || !newCurrencyTranche.rialAmountStr) return; // REQUIRE RIAL AMOUNT
        
        let updatedTranches = [...(currencyForm.tranches || [])];
        
        const rawAmount = parseFloat(newCurrencyTranche.amountStr);
        const rawRialAmount = deformatNumberString(newCurrencyTranche.rialAmountStr);
        const rawCurrencyFee = newCurrencyTranche.currencyFeeStr ? parseFloat(newCurrencyTranche.currencyFeeStr) : 0;
        const rawReceived = newCurrencyTranche.receivedAmountStr ? parseFloat(newCurrencyTranche.receivedAmountStr) : 0;

        const trancheData: any = { 
            date: newCurrencyTranche.date || '', 
            amount: rawAmount, 
            currencyType: newCurrencyTranche.currencyType || selectedRecord.mainCurrency || 'EUR', 
            brokerName: newCurrencyTranche.brokerName || '', 
            exchangeName: newCurrencyTranche.exchangeName || '', 
            rate: 0, 
            rialAmount: rawRialAmount, 
            currencyFee: rawCurrencyFee, 
            isDelivered: newCurrencyTranche.isDelivered, 
            deliveryDate: newCurrencyTranche.deliveryDate,
            returnAmount: newCurrencyTranche.returnAmount ? deformatNumberString(newCurrencyTranche.returnAmount.toString()) : undefined,
            returnDate: newCurrencyTranche.returnDate,
            receivedAmount: rawReceived
        }; 

        if (editingTrancheId) {
            updatedTranches = updatedTranches.map(t => t.id === editingTrancheId ? { ...t, ...trancheData } : t);
        } else {
            updatedTranches.push({ ...trancheData, id: generateUUID() });
        }
        
        const totalPurchased = updatedTranches.reduce((acc, t) => acc + t.amount, 0); 
        const totalDelivered = updatedTranches.reduce((acc, t) => acc + (t.receivedAmount || (t.isDelivered ? t.amount : 0)), 0);
        
        const totalRialCost = updatedTranches.reduce((acc, t) => {
            return acc + ((t.rialAmount || 0) - (t.returnAmount || 0));
        }, 0);

        const updatedForm = { ...currencyForm, tranches: updatedTranches, purchasedAmount: totalPurchased, deliveredAmount: totalDelivered }; 
        
        setCurrencyForm(updatedForm); 
        
        const updatedRecord = { ...selectedRecord, currencyPurchaseData: updatedForm }; 
        
        if (!updatedRecord.stages[TradeStage.CURRENCY_PURCHASE]) updatedRecord.stages[TradeStage.CURRENCY_PURCHASE] = getStageData(updatedRecord, TradeStage.CURRENCY_PURCHASE);
        updatedRecord.stages[TradeStage.CURRENCY_PURCHASE].costCurrency = totalPurchased;
        updatedRecord.stages[TradeStage.CURRENCY_PURCHASE].costRial = totalRialCost;

        await updateTradeRecord(updatedRecord); 
        setSelectedRecord(updatedRecord); 
        
        setNewCurrencyTranche({ amount: 0, currencyType: selectedRecord.mainCurrency || 'EUR', date: '', exchangeName: '', brokerName: '', isDelivered: false, returnAmount: '', returnDate: '', receivedAmount: 0, amountStr: '', rialAmountStr: '', receivedAmountStr: '', currencyFeeStr: '' }); 
        setEditingTrancheId(null);
    };

    const handleEditTranche = (tranche: any) => {
        setNewCurrencyTranche({
            amount: tranche.amount,
            amountStr: tranche.amount.toString(),
            currencyType: tranche.currencyType,
            date: tranche.date,
            exchangeName: tranche.exchangeName,
            brokerName: tranche.brokerName,
            isDelivered: tranche.isDelivered,
            deliveryDate: tranche.deliveryDate,
            rate: tranche.rate,
            rialAmountStr: formatNumberString(tranche.rialAmount || 0),
            currencyFeeStr: tranche.currencyFee ? tranche.currencyFee.toString() : '',
            returnAmount: tranche.returnAmount ? formatNumberString(tranche.returnAmount) : '',
            returnDate: tranche.returnDate,
            receivedAmount: tranche.receivedAmount,
            receivedAmountStr: tranche.receivedAmount ? tranche.receivedAmount.toString() : ''
        });
        setEditingTrancheId(tranche.id);
    };

    const handleCancelEditTranche = () => {
        setNewCurrencyTranche({ amount: 0, currencyType: selectedRecord?.mainCurrency || 'EUR', date: '', exchangeName: '', brokerName: '', isDelivered: false, returnAmount: '', returnDate: '', receivedAmount: 0, amountStr: '', rialAmountStr: '', receivedAmountStr: '', currencyFeeStr: '' });
        setEditingTrancheId(null);
    };

    const handleRemoveTranche = async (id: string) => { 
        if (!selectedRecord) return; 
        if (!confirm('آیا از حذف این پارت مطمئن هستید؟')) return; 
        
        const updatedTranches = (currencyForm.tranches || []).filter(t => t.id !== id); 
        const totalPurchased = updatedTranches.reduce((acc, t) => acc + t.amount, 0); 
        const totalDelivered = updatedTranches.reduce((acc, t) => acc + (t.receivedAmount || (t.isDelivered ? t.amount : 0)), 0); 
        
        const totalRialCost = updatedTranches.reduce((acc, t) => {
            return acc + ((t.rialAmount || 0) - (t.returnAmount || 0));
        }, 0);

        const updatedForm = { ...currencyForm, tranches: updatedTranches, purchasedAmount: totalPurchased, deliveredAmount: totalDelivered }; 
        setCurrencyForm(updatedForm); 
        
        const updatedRecord = { ...selectedRecord, currencyPurchaseData: updatedForm }; 
        
        if (!updatedRecord.stages[TradeStage.CURRENCY_PURCHASE]) updatedRecord.stages[TradeStage.CURRENCY_PURCHASE] = getStageData(updatedRecord, TradeStage.CURRENCY_PURCHASE);
        updatedRecord.stages[TradeStage.CURRENCY_PURCHASE].costCurrency = totalPurchased;
        updatedRecord.stages[TradeStage.CURRENCY_PURCHASE].costRial = totalRialCost;

        await updateTradeRecord(updatedRecord); 
        setSelectedRecord(updatedRecord); 
    };

    const handleToggleTrancheDelivery = async (id: string) => { if (!selectedRecord) return; const updatedTranches = (currencyForm.tranches || []).map(t => { if (t.id === id) return { ...t, isDelivered: !t.isDelivered }; return t; }); const totalPurchased = updatedTranches.reduce((acc, t) => acc + t.amount, 0); const totalDelivered = updatedTranches.reduce((acc, t) => acc + (t.receivedAmount || (t.isDelivered ? t.amount : 0)), 0); const updatedForm = { ...currencyForm, tranches: updatedTranches, purchasedAmount: totalPurchased, deliveredAmount: totalDelivered }; setCurrencyForm(updatedForm); const updatedRecord = { ...selectedRecord, currencyPurchaseData: updatedForm }; await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); };
    const handleSaveCurrencyGuarantee = async () => { if (!selectedRecord) return; const gCheck = { amount: deformatNumberString(currencyGuarantee.amount), bank: currencyGuarantee.bank, chequeNumber: currencyGuarantee.number, dueDate: currencyGuarantee.date, isDelivered: currencyGuarantee.isDelivered }; const updatedForm = { ...currencyForm, guaranteeCheque: gCheck }; setCurrencyForm(updatedForm); const updatedRecord = { ...selectedRecord, currencyPurchaseData: updatedForm }; await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); alert("اطلاعات چک ضمانت ارزی ذخیره شد."); };
    const handleToggleCurrencyGuaranteeDelivery = async () => { if (!selectedRecord || !selectedRecord.currencyPurchaseData?.guaranteeCheque) return; const currentStatus = selectedRecord.currencyPurchaseData.guaranteeCheque.isDelivered || false; setCurrencyGuarantee(prev => ({ ...prev, isDelivered: !currentStatus })); const updatedForm = { ...currencyForm, guaranteeCheque: { ...currencyForm.guaranteeCheque!, isDelivered: !currentStatus } }; setCurrencyForm(updatedForm); const updatedRecord = { ...selectedRecord, currencyPurchaseData: updatedForm }; await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); };
    const handleAddInvoiceItem = () => { if (!newInvoiceItem.name) return; const newItem: InvoiceItem = { id: generateUUID(), name: newInvoiceItem.name, weight: Number(newInvoiceItem.weight), unitPrice: Number(newInvoiceItem.unitPrice), totalPrice: Number(newInvoiceItem.totalPrice) || (Number(newInvoiceItem.weight) * Number(newInvoiceItem.unitPrice)), part: newInvoiceItem.part || '' }; setShippingDocForm(prev => ({ ...prev, invoiceItems: [...(prev.invoiceItems || []), newItem] })); setNewInvoiceItem({ name: '', weight: 0, unitPrice: 0, totalPrice: 0, part: '' }); };
    const handleRemoveInvoiceItem = (id: string) => { setShippingDocForm(prev => ({ ...prev, invoiceItems: (prev.invoiceItems || []).filter(i => i.id !== id) })); };
    const handleAddPackingItem = () => { if (!newPackingItem.description) return; const item: PackingItem = { id: generateUUID(), description: newPackingItem.description, netWeight: Number(newPackingItem.netWeight), grossWeight: Number(newPackingItem.grossWeight), packageCount: Number(newPackingItem.packageCount), part: newPackingItem.part || '' }; setShippingDocForm(prev => ({ ...prev, packingItems: [...(prev.packingItems || []), item] })); setNewPackingItem({ description: '', netWeight: 0, grossWeight: 0, packageCount: 0, part: '' }); };
    const handleRemovePackingItem = (id: string) => { setShippingDocForm(prev => ({ ...prev, packingItems: (prev.packingItems || []).filter(i => i.id !== id) })); };
    const handleDocFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; setUploadingDocFile(true); const reader = new FileReader(); reader.onload = async (ev) => { const base64 = ev.target?.result as string; try { const result = await uploadFile(file.name, base64); setShippingDocForm(prev => ({ ...prev, attachments: [...(prev.attachments || []), { fileName: result.fileName, url: result.url }] })); } catch (error) { alert('خطا در آپلود فایل'); } finally { setUploadingDocFile(false); } }; reader.readAsDataURL(file); e.target.value = ''; };
    const handleSaveShippingDoc = async () => { if (!selectedRecord || !shippingDocForm.documentNumber) return; let totalNet = shippingDocForm.netWeight; let totalGross = shippingDocForm.grossWeight; let totalPackages = shippingDocForm.packagesCount; if (activeShippingSubTab === 'Packing List' && shippingDocForm.packingItems && shippingDocForm.packingItems.length > 0) { totalNet = shippingDocForm.packingItems.reduce((acc, i) => acc + i.netWeight, 0); totalGross = shippingDocForm.packingItems.reduce((acc, i) => acc + i.grossWeight, 0); totalPackages = shippingDocForm.packingItems.reduce((acc, i) => acc + i.packageCount, 0); } const newDoc: ShippingDocument = { id: generateUUID(), type: activeShippingSubTab, status: shippingDocForm.status || 'Draft', documentNumber: shippingDocForm.documentNumber, documentDate: shippingDocForm.documentDate || '', createdAt: Date.now(), createdBy: currentUser.fullName, attachments: shippingDocForm.attachments || [], invoiceItems: activeShippingSubTab === 'Commercial Invoice' ? shippingDocForm.invoiceItems : undefined, packingItems: activeShippingSubTab === 'Packing List' ? shippingDocForm.packingItems : undefined, freightCost: activeShippingSubTab === 'Commercial Invoice' ? Number(shippingDocForm.freightCost) : undefined, currency: shippingDocForm.currency, netWeight: totalNet, grossWeight: totalGross, packagesCount: totalPackages, vesselName: shippingDocForm.vesselName, portOfLoading: shippingDocForm.portOfLoading, portOfDischarge: shippingDocForm.portOfDischarge, description: shippingDocForm.description }; const updatedDocs = [...(selectedRecord.shippingDocuments || []), newDoc]; const updatedRecord = { ...selectedRecord, shippingDocuments: updatedDocs }; if (!updatedRecord.stages[TradeStage.SHIPPING_DOCS]) updatedRecord.stages[TradeStage.SHIPPING_DOCS] = getStageData(updatedRecord, TradeStage.SHIPPING_DOCS); if (activeShippingSubTab === 'Commercial Invoice') { updatedRecord.stages[TradeStage.SHIPPING_DOCS].costCurrency = updatedDocs.filter(d => d.type === 'Commercial Invoice').reduce((acc, d) => acc + (d.invoiceItems?.reduce((sum, i) => sum + i.totalPrice, 0) || 0) + (d.freightCost || 0), 0); } await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); setShippingDocForm({ status: 'Draft', documentNumber: '', documentDate: '', attachments: [], invoiceItems: [], packingItems: [], freightCost: 0 }); };
    const handleDeleteShippingDoc = async (id: string) => { if (!selectedRecord) return; const updatedDocs = (selectedRecord.shippingDocuments || []).filter(d => d.id !== id); const updatedRecord = { ...selectedRecord, shippingDocuments: updatedDocs }; await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); };
    const handleSyncInvoiceToProforma = async () => { if (!selectedRecord) return; if (!confirm('آیا مطمئن هستید؟ این عملیات اقلام و هزینه حمل پروفرما را با مقادیر این اینویس جایگزین می‌کند. اقلام هم‌نام (از پارت‌های مختلف) تجمیع خواهند شد.')) return; const invoiceItems = shippingDocForm.invoiceItems || []; const aggregatedMap = new Map<string, { weight: number, totalPrice: number }>(); for (const item of invoiceItems) { const name = item.name.trim(); const current = aggregatedMap.get(name) || { weight: 0, totalPrice: 0 }; aggregatedMap.set(name, { weight: current.weight + item.weight, totalPrice: current.totalPrice + item.totalPrice }); } const newItems: TradeItem[] = []; aggregatedMap.forEach((val, name) => { newItems.push({ id: generateUUID(), name: name, weight: val.weight, unitPrice: val.weight > 0 ? val.totalPrice / val.weight : 0, totalPrice: val.totalPrice, hsCode: '' }); }); const updatedRecord = { ...selectedRecord, items: newItems, freightCost: Number(shippingDocForm.freightCost) || 0 }; await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); alert('پروفرما با موفقیت بروزرسانی شد (تجمیع بر اساس نام کالا).'); };
    const handleStageClick = (stage: TradeStage) => { const data = getStageData(selectedRecord, stage); setEditingStage(stage); setStageFormData(data); };
    const handleStageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; setUploadingStageFile(true); const reader = new FileReader(); reader.onload = async (ev) => { const base64 = ev.target?.result as string; try { const result = await uploadFile(file.name, base64); setStageFormData(prev => ({ ...prev, attachments: [...(prev.attachments || []), { fileName: result.fileName, url: result.url }] })); } catch (error) { alert('خطا در آپلود'); } finally { setUploadingStageFile(false); } }; reader.readAsDataURL(file); e.target.value = ''; };
    const handleSaveStage = async () => { if (!selectedRecord || !editingStage) return; const updatedRecord = { ...selectedRecord }; updatedRecord.stages[editingStage] = { ...getStageData(selectedRecord, editingStage), ...stageFormData, updatedAt: Date.now(), updatedBy: currentUser.fullName }; if (editingStage === TradeStage.ALLOCATION_QUEUE && stageFormData.queueDate) { updatedRecord.stages[TradeStage.ALLOCATION_QUEUE].queueDate = stageFormData.queueDate; } if (editingStage === TradeStage.ALLOCATION_APPROVED) { updatedRecord.stages[TradeStage.ALLOCATION_APPROVED].allocationDate = stageFormData.allocationDate; updatedRecord.stages[TradeStage.ALLOCATION_APPROVED].allocationCode = stageFormData.allocationCode; updatedRecord.stages[TradeStage.ALLOCATION_APPROVED].allocationExpiry = stageFormData.allocationExpiry; } await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); setEditingStage(null); };
    const toggleCommitment = async () => { if (!selectedRecord) return; const updatedRecord = { ...selectedRecord, isCommitmentFulfilled: !selectedRecord.isCommitmentFulfilled }; await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); setSelectedRecord(updatedRecord); };
    const handleArchiveRecord = async () => { if (!selectedRecord) return; if (!confirm('آیا از انتقال این پرونده به بایگانی (ترخیص شده) اطمینان دارید؟')) return; const updatedRecord = { ...selectedRecord, isArchived: true, status: 'Completed' as const }; await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); alert('پرونده با موفقیت بایگانی شد.'); setViewMode('dashboard'); loadRecords(); };
    const handleUnarchiveRecord = async () => { if (!selectedRecord) return; if (!confirm('آیا از بازگرداندن این پرونده به جریان کاری اطمینان دارید؟')) return; const updatedRecord = { ...selectedRecord, isArchived: false, status: 'Active' as const }; await updateTradeRecord(updatedRecord); setSelectedRecord(updatedRecord); alert('پرونده بازیابی شد.'); };
    const getAllGuarantees = () => { const list = []; if (selectedRecord && selectedRecord.currencyPurchaseData?.guaranteeCheque) { list.push({ id: 'currency_g', type: 'ارزی', number: selectedRecord.currencyPurchaseData.guaranteeCheque.chequeNumber, bank: selectedRecord.currencyPurchaseData.guaranteeCheque.bank, amount: selectedRecord.currencyPurchaseData.guaranteeCheque.amount, isDelivered: selectedRecord.currencyPurchaseData.guaranteeCheque.isDelivered, toggleFunc: handleToggleCurrencyGuaranteeDelivery }); } if (selectedRecord && selectedRecord.greenLeafData?.guarantees) { selectedRecord.greenLeafData.guarantees.forEach(g => { list.push({ id: g.id, type: 'گمرکی', number: g.guaranteeNumber + (g.chequeNumber ? ` / چک: ${g.chequeNumber}` : ''), bank: g.chequeBank, amount: g.chequeAmount, isDelivered: g.isDelivered, toggleFunc: () => handleToggleGuaranteeDelivery(g.id) }); }); } return list; };

    const openEditMetadata = () => {
        if (!selectedRecord) return;
        setEditMetadataForm({
            fileNumber: selectedRecord.fileNumber,
            goodsName: selectedRecord.goodsName,
            sellerName: selectedRecord.sellerName,
            mainCurrency: selectedRecord.mainCurrency,
            commodityGroup: selectedRecord.commodityGroup,
            company: selectedRecord.company,
            registrationNumber: selectedRecord.registrationNumber,
            operatingBank: selectedRecord.operatingBank
        });
        setShowEditMetadataModal(true);
    };

    const saveMetadata = async () => {
        if (!selectedRecord) return;
        const updatedRecord = { ...selectedRecord, ...editMetadataForm };
        await updateTradeRecord(updatedRecord);
        setSelectedRecord(updatedRecord);
        setRecords(prev => prev.map(r => r.id === updatedRecord.id ? updatedRecord : r));
        setShowEditMetadataModal(false);
        alert('مشخصات پرونده بروزرسانی شد.');
    };

    const handlePrintReport = () => {
        window.print();
    };

    const handlePrintTrade = () => {
        setShowFinalReportPrint(true);
    };

    const handleDownloadFinalReportPDF = () => {
        setShowFinalReportPrint(true);
    };

    const renderReportContent = useMemo(() => {
        const safeSettings = settings || { currentTrackingNumber: 1000, currentExitPermitNumber: 1000, companyNames: [], companies: [], defaultCompany: '', bankNames: [], operatingBankNames: [], commodityGroups: [], rolePermissions: {}, savedContacts: [], warehouseSequences: {}, companyNotifications: {}, insuranceCompanies: [] };

        switch (activeReport) {
            case 'general':
                return (
                    <div className="bg-white p-6 rounded-xl shadow-sm border overflow-x-auto">
                        <table className="w-full text-sm text-right">
                            <thead className="bg-gray-100 text-gray-700">
                                <tr>
                                    <th className="p-3">شماره پرونده</th>
                                    <th className="p-3">کالا</th>
                                    <th className="p-3">شرکت</th>
                                    <th className="p-3">فروشنده</th>
                                    <th className="p-3">ارز</th>
                                    <th className="p-3">وضعیت</th>
                                </tr>
                            </thead>
                            <tbody>
                                {records
                                    .filter(r => (!reportFilterCompany || r.company === reportFilterCompany) && (
                                        r.fileNumber.includes(reportSearchTerm) || 
                                        r.goodsName.includes(reportSearchTerm)
                                    ))
                                    .map(r => (
                                    <tr key={r.id} className="border-b hover:bg-gray-50">
                                        <td className="p-3 font-bold">{r.fileNumber}</td>
                                        <td className="p-3">{r.goodsName}</td>
                                        <td className="p-3">{r.company}</td>
                                        <td className="p-3">{r.sellerName}</td>
                                        <td className="p-3 font-mono">{r.mainCurrency}</td>
                                        <td className="p-3"><span className="bg-gray-100 px-2 py-1 rounded text-xs">{getStatusLabel(r.status as any) || r.status}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                );
            case 'allocation_queue':
                return <AllocationReport records={records.filter(r => !reportFilterCompany || r.company === reportFilterCompany)} onUpdateRecord={async (r, u) => { const updated = {...r, ...u}; await updateTradeRecord(updated); setRecords(prev => prev.map(rec => rec.id === updated.id ? updated : rec)); }} settings={safeSettings} />;
            case 'currency':
                return <CurrencyReport records={records.filter(r => !reportFilterCompany || r.company === reportFilterCompany)} />;
            case 'company_performance':
                return <CompanyPerformanceReport records={records} />;
            case 'insurance_ledger':
                return <InsuranceLedgerReport records={records.filter(r => !reportFilterCompany || r.company === reportFilterCompany)} settings={safeSettings} />; 
            default:
                return <div className="p-8 text-center text-gray-500">گزارش در حال تکمیل است...</div>;
        }
    }, [activeReport, records, reportFilterCompany, reportSearchTerm, settings]);

    if (viewMode === 'reports') {
        return (
            <div className="flex flex-col md:flex-row h-[calc(100vh-100px)] bg-gray-50 rounded-2xl overflow-hidden border">
                {/* Sidebar */}
                <div className="w-full md:w-64 bg-white border-l p-4 flex flex-col gap-2 flex-shrink-0 h-auto md:h-full overflow-y-auto border-b md:border-b-0 shadow-sm md:shadow-none z-10">
                    <h3 className="font-bold text-gray-800 mb-2 md:mb-4 flex items-center gap-2"><FileSpreadsheet size={20}/> گزارشات بازرگانی</h3>
                    
                    <div className="mb-2 relative">
                        <input 
                            className="w-full border rounded p-2 text-sm pl-8" 
                            placeholder="جستجو..." 
                            value={reportSearchTerm} 
                            onChange={e => setReportSearchTerm(e.target.value)}
                        />
                        <Search size={16} className="absolute left-2 top-2.5 text-gray-400"/>
                    </div>

                    <div className="mb-4"><label className="text-xs font-bold text-gray-500 mb-1 block">فیلتر شرکت</label><select className="w-full border rounded p-1 text-sm" value={reportFilterCompany} onChange={e => setReportFilterCompany(e.target.value)}><option value="">همه شرکت‌ها</option>{availableCompanies.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                    <div className="grid grid-cols-2 md:grid-cols-1 gap-2">
                        <button onClick={() => setActiveReport('general')} className={`p-2 rounded text-right text-sm ${activeReport === 'general' ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-gray-50'}`}>📄 لیست کلی پرونده‌ها</button>
                        <button onClick={() => setActiveReport('allocation_queue')} className={`p-2 rounded text-right text-sm ${activeReport === 'allocation_queue' ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-gray-50'}`}>⏳ در صف تخصیص</button>
                        <button onClick={() => setActiveReport('currency')} className={`p-2 rounded text-right text-sm ${activeReport === 'currency' ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-gray-50'}`}>💰 وضعیت خرید ارز</button>
                        <button onClick={() => setActiveReport('insurance_ledger')} className={`p-2 rounded text-right text-sm ${activeReport === 'insurance_ledger' ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-gray-50'}`}>🛡️ صورتحساب بیمه</button>
                        <button onClick={() => setActiveReport('company_performance')} className={`p-2 rounded text-right text-sm ${activeReport === 'company_performance' ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-gray-50'}`}>📊 عملکرد شرکت‌ها</button>
                    </div>
                    <div className="mt-auto pt-4 md:pt-0">
                        <button onClick={handlePrintReport} className="w-full flex items-center justify-center gap-2 border p-2 rounded hover:bg-gray-50 text-gray-600"><Printer size={16}/> چاپ گزارش</button>
                        <button onClick={() => setViewMode('dashboard')} className="w-full mt-2 flex items-center justify-center gap-2 bg-gray-800 text-white p-2 rounded hover:bg-gray-900">بازگشت به داشبورد</button>
                    </div>
                </div>
                
                {/* Content */}
                <div className="flex-1 p-4 md:p-6 overflow-hidden flex flex-col w-full min-h-0">
                    <h2 className="text-xl font-bold mb-4 hidden md:block">
                        {activeReport === 'general' ? 'لیست کلی پرونده‌ها' : 
                         activeReport === 'allocation_queue' ? 'گزارش صف تخصیص' : 
                         activeReport === 'currency' ? 'گزارش وضعیت خرید ارز' : 
                         activeReport === 'company_performance' ? 'خلاصه عملکرد شرکت‌ها' : 
                         activeReport === 'insurance_ledger' ? 'صورتحساب و مانده بیمه' :
                         'گزارش'}
                    </h2>
                    {renderReportContent}
                </div>
            </div>
        );
    }

    if (selectedRecord && viewMode === 'details') {
        
        // ... (calculation logic remains same)
        const totalItemsCurrency = selectedRecord.items.reduce((a, b) => a + b.totalPrice, 0);
        const totalFreightCurrency = selectedRecord.freightCost || 0;
        const totalProformaCurrency = totalItemsCurrency + totalFreightCurrency;

        const currencyTranches = selectedRecord.currencyPurchaseData?.tranches || [];
        const netCurrencyRialCost = currencyTranches.reduce((acc, t) => {
            const paid = t.rialAmount || 0;
            const ret = t.returnAmount || 0;
            return acc + (paid - ret);
        }, 0);

        const overheadStages = [
            TradeStage.LICENSES, TradeStage.INSURANCE, TradeStage.INSPECTION,
            TradeStage.CLEARANCE_DOCS, TradeStage.GREEN_LEAF,
            TradeStage.INTERNAL_SHIPPING, TradeStage.AGENT_FEES
        ];
        const totalOverheadsRial = overheadStages.reduce((sum, stage) => 
            sum + (selectedRecord.stages[stage]?.costRial || 0), 0);

        const grandTotalRialProject = netCurrencyRialCost + totalOverheadsRial;
        const totalWeight = selectedRecord.items.reduce((sum, item) => sum + item.weight, 0);
        const effectiveRate = totalProformaCurrency > 0 ? grandTotalRialProject / totalProformaCurrency : 0;
        const freightPerKgCurrency = totalWeight > 0 ? totalFreightCurrency / totalWeight : 0;
        const costPerKg = totalWeight > 0 ? grandTotalRialProject / totalWeight : 0;

        return (
            <div className="flex flex-col h-[calc(100vh-100px)] animate-fade-in relative">
                
                {/* Final Cost Report Print Overlay */}
                {showFinalReportPrint && (
                    <PrintFinalCostReport 
                        record={selectedRecord} 
                        totalRial={totalOverheadsRial} 
                        totalCurrency={totalProformaCurrency} 
                        exchangeRate={effectiveRate}
                        grandTotalRial={grandTotalRialProject}
                        onClose={() => setShowFinalReportPrint(false)} 
                    />
                )}

                {/* Clearance Declaration Print Overlay (NEW) */}
                {showClearancePrint && (
                    <PrintClearanceDeclaration 
                        record={selectedRecord}
                        settings={settings || { companies: [] } as any}
                        onClose={() => setShowClearancePrint(false)}
                    />
                )}

                {/* EDIT METADATA MODAL (unchanged) */}
                {showEditMetadataModal && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
                        {/* ... Edit Metadata Modal Content ... */}
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 animate-fade-in max-h-[90vh] overflow-y-auto">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="font-bold text-xl text-gray-800">ویرایش مشخصات پرونده</h3>
                                <button onClick={() => setShowEditMetadataModal(false)}><X size={24} className="text-gray-400 hover:text-red-500"/></button>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">شماره پرونده</label>
                                    <input className="w-full border rounded-xl p-3 bg-gray-50 font-mono text-left dir-ltr" value={editMetadataForm.fileNumber || ''} onChange={e => setEditMetadataForm({...editMetadataForm, fileNumber: e.target.value})} />
                                </div>
                                {/* ... rest of fields ... */}
                                <div><label className="block text-sm font-bold text-gray-700 mb-1">نام کالا (شرح کلی)</label><input className="w-full border rounded-xl p-3 bg-white" value={editMetadataForm.goodsName || ''} onChange={e => setEditMetadataForm({...editMetadataForm, goodsName: e.target.value})} /></div>
                                <div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-bold text-gray-700 mb-1">فروشنده</label><input className="w-full border rounded-xl p-3 bg-white" value={editMetadataForm.sellerName || ''} onChange={e => setEditMetadataForm({...editMetadataForm, sellerName: e.target.value})} /></div><div><label className="block text-sm font-bold text-gray-700 mb-1">ارز پایه</label><select className="w-full border rounded-xl p-3 bg-white" value={editMetadataForm.mainCurrency || ''} onChange={e => setEditMetadataForm({...editMetadataForm, mainCurrency: e.target.value})}>{CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}</select></div></div>
                                <div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-bold text-gray-700 mb-1">گروه کالایی</label><select className="w-full border rounded-xl p-3 bg-white" value={editMetadataForm.commodityGroup || ''} onChange={e => setEditMetadataForm({...editMetadataForm, commodityGroup: e.target.value})}><option value="">انتخاب...</option>{commodityGroups.map(g => <option key={g} value={g}>{g}</option>)}</select></div><div><label className="block text-sm font-bold text-gray-700 mb-1">شرکت</label><select className="w-full border rounded-xl p-3 bg-white" value={editMetadataForm.company || ''} onChange={e => setEditMetadataForm({...editMetadataForm, company: e.target.value})}><option value="">انتخاب...</option>{availableCompanies.map(c => <option key={c} value={c}>{c}</option>)}</select></div></div>
                                <div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-bold text-gray-700 mb-1">شماره ثبت سفارش</label><input className="w-full border rounded-xl p-3 bg-white" value={editMetadataForm.registrationNumber || ''} onChange={e => setEditMetadataForm({...editMetadataForm, registrationNumber: e.target.value})} /></div><div><label className="block text-sm font-bold text-gray-700 mb-1">بانک عامل</label><select className="w-full border rounded-xl p-3 bg-white" value={editMetadataForm.operatingBank || ''} onChange={e => setEditMetadataForm({...editMetadataForm, operatingBank: e.target.value})}><option value="">انتخاب...</option>{operatingBanks.map(b => <option key={b} value={b}>{b}</option>)}</select></div></div>
                                <button onClick={saveMetadata} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-600/20 mt-4">ذخیره تغییرات</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Stage Edit Modal (unchanged) */}
                {editingStage && (
                    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
                        {/* ... Stage Edit Modal Content ... */}
                        <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
                            <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-lg">ویرایش مرحله: {editingStage}</h3><button onClick={() => setEditingStage(null)}><X size={20}/></button></div>
                            <div className="space-y-4">
                                <label className="flex items-center gap-2"><input type="checkbox" checked={stageFormData.isCompleted} onChange={e => setStageFormData({...stageFormData, isCompleted: e.target.checked})} className="w-5 h-5"/> <span className="font-bold">مرحله تکمیل شده است</span></label>
                                {editingStage === TradeStage.ALLOCATION_QUEUE && (<div className="bg-amber-50 p-3 rounded border border-amber-200 space-y-2"><div><label className="text-xs font-bold block">تاریخ ورود به صف</label><input type="text" className="w-full border rounded p-2 text-sm" placeholder="1403/01/01" value={stageFormData.queueDate || ''} onChange={e => setStageFormData({...stageFormData, queueDate: e.target.value})} /></div>{stageFormData.queueDate && <div className="text-xs text-amber-700 font-bold">مدت انتظار: {calculateDaysDiff(stageFormData.queueDate)} روز</div>}</div>)}
                                {editingStage === TradeStage.ALLOCATION_APPROVED && (<div className="bg-green-50 p-3 rounded border border-green-200 space-y-2"><div><label className="text-xs font-bold block">شماره فیش/تخصیص</label><input type="text" className="w-full border rounded p-2 text-sm" value={stageFormData.allocationCode || ''} onChange={e => setStageFormData({...stageFormData, allocationCode: e.target.value})} /></div><div className="grid grid-cols-2 gap-2"><div><label className="text-xs font-bold block">تاریخ تخصیص</label><input type="text" className="w-full border rounded p-2 text-sm" placeholder="1403/01/01" value={stageFormData.allocationDate || ''} onChange={e => setStageFormData({...stageFormData, allocationDate: e.target.value})} /></div><div><label className="text-xs font-bold block">مهلت انقضا</label><input type="text" className="w-full border rounded p-2 text-sm" placeholder="1403/02/01" value={stageFormData.allocationExpiry || ''} onChange={e => setStageFormData({...stageFormData, allocationExpiry: e.target.value})} /></div></div></div>)}
                                <div className="grid grid-cols-2 gap-4"><div><label className="text-xs font-bold block">هزینه ریالی</label><input type="text" className="w-full border rounded p-2 text-sm" value={formatNumberString(stageFormData.costRial)} onChange={e => setStageFormData({...stageFormData, costRial: deformatNumberString(e.target.value)})} /></div><div><label className="text-xs font-bold block">هزینه ارزی</label><input type="text" className="w-full border rounded p-2 text-sm" value={formatNumberString(stageFormData.costCurrency)} onChange={e => setStageFormData({...stageFormData, costCurrency: deformatNumberString(e.target.value)})} /></div></div>
                                <div><label className="text-xs font-bold block">توضیحات</label><textarea className="w-full border rounded p-2 text-sm h-24" value={stageFormData.description || ''} onChange={e => setStageFormData({...stageFormData, description: e.target.value})} /></div>
                                <div><label className="text-xs font-bold block mb-1">فایل‌های ضمیمه</label><div className="flex items-center gap-2 mb-2"><input type="file" ref={fileInputRef} className="hidden" onChange={handleStageFileChange} /><button onClick={() => fileInputRef.current?.click()} disabled={uploadingStageFile} className="bg-gray-100 border px-3 py-1 rounded text-xs hover:bg-gray-200">{uploadingStageFile ? 'در حال آپلود...' : 'افزودن فایل'}</button></div><div className="space-y-1">{stageFormData.attachments?.map((att, i) => (<div key={i} className="flex justify-between items-center bg-gray-50 p-2 rounded text-xs"><a href={att.url} target="_blank" className="text-blue-600 truncate max-w-[200px]">{att.fileName}</a><button onClick={() => setStageFormData({...stageFormData, attachments: stageFormData.attachments?.filter((_, idx) => idx !== i)})} className="text-red-500"><X size={14}/></button></div>))}</div></div>
                                <button onClick={handleSaveStage} className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700">ذخیره تغییرات</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Header (unchanged) */}
                <div className="bg-white border-b p-4 flex justify-between items-center shadow-sm z-10">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setViewMode('dashboard')} className="p-2 hover:bg-gray-100 rounded-full"><ArrowRight /></button>
                        <div>
                            <h1 className="text-xl font-bold flex items-center gap-2">
                                {selectedRecord.goodsName}
                                <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{selectedRecord.fileNumber}</span>
                                <button onClick={openEditMetadata} className="text-gray-400 hover:text-blue-600 transition-colors p-1" title="ویرایش مشخصات پرونده"><Edit size={16}/></button>
                            </h1>
                            <p className="text-xs text-gray-500">{selectedRecord.company} | {selectedRecord.sellerName}</p>
                        </div>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                        {/* Tabs... (unchanged) */}
                        <button onClick={() => setActiveTab('timeline')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === 'timeline' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}>تایم‌لاین</button>
                        <button onClick={() => setActiveTab('proforma')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === 'proforma' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}>پروفرما</button>
                        <button onClick={() => setActiveTab('insurance')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === 'insurance' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}>بیمه</button>
                        <button onClick={() => setActiveTab('currency_purchase')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === 'currency_purchase' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}>خرید ارز</button>
                        <button onClick={() => setActiveTab('shipping_docs')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === 'shipping_docs' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}>اسناد حمل</button>
                        <button onClick={() => setActiveTab('inspection')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === 'inspection' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}>بازرسی</button>
                        <button onClick={() => setActiveTab('clearance_docs')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === 'clearance_docs' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}>ترخیصیه و انبار</button>
                        <button onClick={() => setActiveTab('green_leaf')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === 'green_leaf' ? 'bg-green-100 text-green-700' : 'hover:bg-gray-100'}`}>برگ سبز</button>
                        <button onClick={() => setActiveTab('internal_shipping')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === 'internal_shipping' ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-gray-100'}`}>حمل داخلی</button>
                        <button onClick={() => setActiveTab('agent_fees')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === 'agent_fees' ? 'bg-teal-100 text-teal-700' : 'hover:bg-gray-100'}`}>هزینه‌های ترخیص</button>
                        <button onClick={() => setActiveTab('final_calculation')} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === 'final_calculation' ? 'bg-rose-100 text-rose-700' : 'hover:bg-gray-100'}`}>محاسبه نهایی</button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto bg-gray-50">
                    
                    {/* ... (Timeline, Proforma same) ... */}
                    {activeTab === 'timeline' && (
                        <div className="p-6 max-w-4xl mx-auto">
                            <div className="relative border-r-2 border-gray-200 mr-4 space-y-8 pr-8">
                                {STAGES.map((stage, idx) => {
                                    const data = getStageData(selectedRecord, stage);
                                    return (
                                        <div key={stage} className="relative">
                                            <div className={`absolute -right-[41px] top-0 w-6 h-6 rounded-full border-4 ${data.isCompleted ? 'bg-green-500 border-green-100' : 'bg-gray-300 border-gray-100'}`}></div>
                                            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleStageClick(stage)}>
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h3 className="font-bold text-gray-800 text-sm">{stage}</h3>
                                                        <p className="text-xs text-gray-500 mt-1">{data.description || 'بدون توضیحات'}</p>
                                                    </div>
                                                    {data.isCompleted && <CheckCircle2 size={16} className="text-green-500"/>}
                                                </div>
                                                <div className="mt-3 flex gap-2 text-xs">
                                                    {data.costRial > 0 && <span className="bg-gray-100 px-2 py-1 rounded">هزینه ریالی: {formatCurrency(data.costRial)}</span>}
                                                    {data.costCurrency > 0 && <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded">هزینه ارزی: {formatNumberString(data.costCurrency)} {selectedRecord.mainCurrency}</span>}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {activeTab === 'proforma' && (
                        /* ... Proforma content ... */
                        <div className="p-6 max-w-5xl mx-auto space-y-6">
                            {/* ... Content of Proforma ... */}
                            <div className="bg-white p-6 rounded-xl shadow-sm border">
                                <h3 className="font-bold text-gray-800 mb-4 border-b pb-2">اطلاعات کلی پروفرما</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-1"><label className="text-xs font-bold text-gray-700">شماره پرونده</label><input className="w-full border rounded p-2 text-sm" value={selectedRecord.fileNumber} onChange={e => handleUpdateProforma('fileNumber', e.target.value)}/></div>
                                    <div className="space-y-1"><label className="text-xs font-bold text-gray-700">شماره ثبت سفارش</label><input className="w-full border rounded p-2 text-sm" value={selectedRecord.registrationNumber || ''} onChange={e => handleUpdateProforma('registrationNumber', e.target.value)}/></div>
                                    <div className="space-y-1"><label className="text-xs font-bold text-gray-700">فروشنده</label><input className="w-full border rounded p-2 text-sm" value={selectedRecord.sellerName} onChange={e => handleUpdateProforma('sellerName', e.target.value)}/></div>
                                    <div className="space-y-1"><label className="text-xs font-bold text-gray-700">ارز پایه</label><select className="w-full border rounded p-2 text-sm" value={selectedRecord.mainCurrency} onChange={e => handleUpdateProforma('mainCurrency', e.target.value)}>{CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}</select></div>
                                    <div className="space-y-1"><label className="text-xs font-bold text-gray-700">تاریخ ثبت سفارش</label><input className="w-full border rounded p-2 text-sm dir-ltr" placeholder="1403/01/01" value={selectedRecord.registrationDate || ''} onChange={e => handleUpdateProforma('registrationDate', e.target.value)}/></div>
                                    <div className="space-y-1"><label className="text-xs font-bold text-gray-700">تاریخ انقضا</label><input className="w-full border rounded p-2 text-sm dir-ltr" placeholder="1403/06/01" value={selectedRecord.registrationExpiry || ''} onChange={e => handleUpdateProforma('registrationExpiry', e.target.value)}/></div>
                                    
                                    {/* Currency Origin & Type */}
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-gray-700">منشا ارز</label>
                                        <select 
                                            className="w-full border rounded p-2 text-sm" 
                                            value={selectedRecord.currencyAllocationType || ''} 
                                            onChange={e => handleUpdateProforma('currencyAllocationType', e.target.value)}
                                        >
                                            <option value="">انتخاب کنید...</option>
                                            <option value="Bank">بانکی</option>
                                            <option value="Export">ارز حاصل از صادرات خود</option>
                                            <option value="ExportOther">ارز حاصل از صادرات دیگران</option>
                                            <option value="Free">متقاضی (آزاد)</option>
                                        </select>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-gray-700">نوع ارز (رتبه)</label>
                                        <select 
                                            className="w-full border rounded p-2 text-sm" 
                                            value={selectedRecord.allocationCurrencyRank || ''} 
                                            onChange={e => handleUpdateProforma('allocationCurrencyRank', e.target.value as any)}
                                        >
                                            <option value="">انتخاب کنید...</option>
                                            <option value="Type1">نوع اول</option>
                                            <option value="Type2">نوع دوم</option>
                                        </select>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-gray-700">بانک عامل</label>
                                        <select 
                                            className="w-full border rounded p-2 text-sm" 
                                            value={selectedRecord.operatingBank || ''} 
                                            onChange={e => handleUpdateProforma('operatingBank', e.target.value)}
                                        >
                                            <option value="">انتخاب کنید...</option>
                                            {operatingBanks.map(b => <option key={b} value={b}>{b}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-xl shadow-sm border">
                                <h3 className="font-bold text-gray-800 mb-4 border-b pb-2">اقلام پروفرما</h3>
                                <div className="flex gap-2 items-end mb-4 bg-gray-50 p-3 rounded-lg flex-wrap">
                                    <div className="flex-1 min-w-[150px] space-y-1"><label className="text-xs text-gray-500">شرح کالا</label><input className="w-full border rounded p-2 text-sm" placeholder="نام کالا" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})}/></div>
                                    <div className="w-32 space-y-1"><label className="text-xs text-gray-500">HS Code</label><input className="w-full border rounded p-2 text-sm dir-ltr" placeholder="کد تعرفه" value={newItem.hsCode || ''} onChange={e => setNewItem({...newItem, hsCode: e.target.value})}/></div>
                                    <div className="w-24 space-y-1"><label className="text-xs text-gray-500">وزن (KG)</label><input type="text" className="w-full border rounded p-2 text-sm dir-ltr" placeholder="0" value={newItem.weightStr} onChange={e => setNewItem({...newItem, weightStr: e.target.value, weight: parseFloat(e.target.value) || 0})}/></div>
                                    <div className="w-28 space-y-1"><label className="text-xs text-gray-500">فی (Unit)</label><input type="text" className="w-full border rounded p-2 text-sm dir-ltr" placeholder="0" value={newItem.unitPriceStr} onChange={e => setNewItem({...newItem, unitPriceStr: e.target.value, unitPrice: parseFloat(e.target.value) || 0})}/></div>
                                    <div className="w-32 space-y-1"><label className="text-xs text-gray-500">قیمت کل</label><input type="number" step="0.01" className="w-full border rounded p-2 text-sm dir-ltr bg-gray-100" placeholder="Auto" value={newItem.totalPrice || (Number(newItem.weight) * Number(newItem.unitPrice))} readOnly/></div>
                                    <button onClick={handleAddItem} className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 h-[38px] min-w-[40px] flex items-center justify-center">{editingItemId ? <Save size={18}/> : <Plus size={18}/>}</button>
                                    {editingItemId && <button onClick={() => { setEditingItemId(null); setNewItem({ name: '', weight: 0, unitPrice: 0, totalPrice: 0, hsCode: '', weightStr: '', unitPriceStr: '' }); }} className="bg-gray-200 text-gray-700 p-2 rounded-lg hover:bg-gray-300 h-[38px]"><X size={18}/></button>}
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-right">
                                        <thead className="bg-gray-100 text-gray-700"><tr><th className="p-3">شرح</th><th className="p-3">HS Code</th><th className="p-3">وزن</th><th className="p-3">فی</th><th className="p-3">قیمت کل</th><th className="p-3">عملیات</th></tr></thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {selectedRecord.items.map((item) => (
                                                <tr key={item.id} className={editingItemId === item.id ? 'bg-blue-50' : ''}>
                                                    <td className="p-3">{item.name}</td>
                                                    <td className="p-3 font-mono">{item.hsCode || '-'}</td>
                                                    <td className="p-3 font-mono">{formatNumberString(item.weight)}</td>
                                                    <td className="p-3 font-mono">{formatNumberString(item.unitPrice)}</td>
                                                    <td className="p-3 font-mono font-bold">{formatNumberString(item.totalPrice)}</td>
                                                    <td className="p-3 flex gap-2">
                                                        <button onClick={() => handleEditItem(item)} className="text-amber-500 hover:text-amber-700"><Edit size={16}/></button>
                                                        <button onClick={() => handleRemoveItem(item.id)} className="text-red-500 hover:text-red-700"><Trash2 size={16}/></button>
                                                    </td>
                                                </tr>
                                            ))}
                                            <tr className="bg-blue-50 font-bold">
                                                <td className="p-3">جمع کل</td>
                                                <td></td>
                                                <td className="p-3 font-mono">{formatNumberString(selectedRecord.items.reduce((a,b)=>a+b.weight,0))}</td>
                                                <td></td>
                                                <td className="p-3 font-mono text-blue-700">{formatNumberString(selectedRecord.items.reduce((a,b)=>a+b.totalPrice,0))} {selectedRecord.mainCurrency}</td>
                                                <td></td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                                <div className="mt-4 pt-4 border-t border-gray-200">
                                    <label className="text-xs font-bold text-gray-700 block mb-1">هزینه حمل کل (Freight)</label>
                                    <div className="flex gap-2 items-center">
                                        <input 
                                            type="number" 
                                            step="0.01"
                                            className="w-48 border rounded p-2 text-sm dir-ltr font-mono" 
                                            value={selectedRecord.freightCost || ''} 
                                            onChange={e => handleUpdateProforma('freightCost', parseFloat(e.target.value) || 0)} 
                                        />
                                        <span className="text-sm font-bold text-gray-500">{selectedRecord.mainCurrency}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="bg-white p-6 rounded-xl shadow-sm border">
                                 <h3 className="font-bold text-gray-800 mb-4 border-b pb-2 flex items-center gap-2"><Banknote size={20} className="text-purple-600"/> هزینه‌های ثبت سفارش (کارمزد بانکی و...)</h3>
                                 <div className="flex gap-2 items-end mb-4 bg-purple-50 p-3 rounded-lg">
                                     <div className="flex-1 space-y-1"><label className="text-xs text-gray-500">شرح هزینه</label><input className="w-full border rounded p-2 text-sm" value={newLicenseTx.description} onChange={e => setNewLicenseTx({...newLicenseTx, description: e.target.value})}/></div>
                                     <div className="w-32 space-y-1"><label className="text-xs text-gray-500">مبلغ (ریال)</label><input className="w-full border rounded p-2 text-sm dir-ltr" value={formatNumberString(newLicenseTx.amount)} onChange={e => setNewLicenseTx({...newLicenseTx, amount: deformatNumberString(e.target.value)})}/></div>
                                     <div className="w-32 space-y-1"><label className="text-xs text-gray-500">تاریخ</label><input className="w-full border rounded p-2 text-sm dir-ltr" placeholder="1403/xx/xx" value={newLicenseTx.date} onChange={e => setNewLicenseTx({...newLicenseTx, date: e.target.value})}/></div>
                                     <button onClick={handleAddLicenseTx} className="bg-purple-600 text-white p-2 rounded-lg hover:bg-purple-700 h-[38px]"><Plus size={18}/></button>
                                 </div>
                                 <div className="space-y-1">
                                     {selectedRecord.licenseData?.transactions.map(tx => (
                                         <div key={tx.id} className="flex justify-between items-center bg-gray-50 p-2 rounded text-sm border">
                                             <div className="flex gap-4"><span>{tx.description}</span><span className="text-gray-500">{tx.date}</span></div>
                                             <div className="flex gap-4 items-center"><span className="font-bold text-purple-700 font-mono">{formatCurrency(tx.amount)}</span><button onClick={() => handleRemoveLicenseTx(tx.id)} className="text-red-500"><X size={14}/></button></div>
                                         </div>
                                     ))}
                                 </div>
                            </div>
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

                    {activeTab === 'currency_purchase' && (
                        /* ... Currency Purchase Logic ... */
                        <div className="p-6 max-w-5xl mx-auto space-y-6">
                            {/* Tranches Section */}
                            <div className="bg-white p-6 rounded-xl shadow-sm border space-y-4">
                                <h3 className="font-bold text-gray-800 flex items-center gap-2"><Coins size={20} className="text-amber-600"/> پارت‌های خرید ارز</h3>
                                <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end bg-amber-50 p-4 rounded-lg">
                                    <div className="col-span-1 space-y-1">
                                        <label className="text-xs font-bold text-gray-700">نوع ارز</label>
                                        <select 
                                            className="w-full border rounded p-2 text-sm bg-white" 
                                            value={newCurrencyTranche.currencyType} 
                                            onChange={e => setNewCurrencyTranche({...newCurrencyTranche, currencyType: e.target.value})}
                                        >
                                            {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                                        </select>
                                    </div>
                                    <div className="col-span-1 space-y-1">
                                        <label className="text-xs font-bold text-gray-700">مقدار ارز</label>
                                        <input 
                                            className="w-full border rounded p-2 text-sm dir-ltr" 
                                            value={newCurrencyTranche.amountStr || ''} 
                                            onChange={e => setNewCurrencyTranche({...newCurrencyTranche, amountStr: e.target.value})}
                                            placeholder="مثال: 12500.5"
                                        />
                                    </div>
                                    <div className="col-span-1 space-y-1">
                                        <label className="text-xs font-bold text-gray-700">مبلغ کل پرداختی (ریال)</label>
                                        <input 
                                            className="w-full border rounded p-2 text-sm dir-ltr" 
                                            value={newCurrencyTranche.rialAmountStr || ''} 
                                            onChange={e => setNewCurrencyTranche({...newCurrencyTranche, rialAmountStr: formatNumberString(deformatNumberString(e.target.value))})} 
                                            placeholder="مبلغ پرداختی..."
                                        />
                                    </div>
                                    <div className="col-span-1 space-y-1">
                                        <label className="text-xs font-bold text-gray-700">کارمزد ارزی</label>
                                        <input 
                                            className="w-full border rounded p-2 text-sm dir-ltr" 
                                            value={newCurrencyTranche.currencyFeeStr || ''} 
                                            onChange={e => setNewCurrencyTranche({...newCurrencyTranche, currencyFeeStr: e.target.value})} 
                                            placeholder="اختیاری..."
                                        />
                                    </div>
                                    <div className="col-span-1 space-y-1"><label className="text-xs font-bold text-gray-700">صرافی</label><input className="w-full border rounded p-2 text-sm" value={newCurrencyTranche.exchangeName} onChange={e => setNewCurrencyTranche({...newCurrencyTranche, exchangeName: e.target.value})} /></div>
                                    <div className="col-span-1 space-y-1"><label className="text-xs font-bold text-gray-700">کارگزار</label><input className="w-full border rounded p-2 text-sm" value={newCurrencyTranche.brokerName} onChange={e => setNewCurrencyTranche({...newCurrencyTranche, brokerName: e.target.value})} /></div>
                                    <div className="col-span-1 space-y-1"><label className="text-xs font-bold text-gray-700">تاریخ خرید</label><input className="w-full border rounded p-2 text-sm dir-ltr" placeholder="1403/01/01" value={newCurrencyTranche.date} onChange={e => setNewCurrencyTranche({...newCurrencyTranche, date: e.target.value})} /></div>
                                    {/* Added Return Fields */}
                                    <div className="col-span-1 space-y-1"><label className="text-xs font-bold text-red-700">مبلغ عودت (ریال)</label><input className="w-full border rounded p-2 text-sm dir-ltr" value={formatNumberString(newCurrencyTranche.returnAmount)} onChange={e => setNewCurrencyTranche({...newCurrencyTranche, returnAmount: e.target.value})} placeholder="اختیاری" /></div>
                                    <div className="col-span-2 space-y-1"><label className="text-xs font-bold text-red-700">تاریخ عودت</label><input className="w-full border rounded p-2 text-sm dir-ltr" value={newCurrencyTranche.returnDate || ''} onChange={e => setNewCurrencyTranche({...newCurrencyTranche, returnDate: e.target.value})} placeholder="1403/..." /></div>
                                    
                                    <div className="col-span-1 space-y-1"><label className="text-xs font-bold text-green-700">مقدار تحویلی</label><input className="w-full border rounded p-2 text-sm dir-ltr font-bold text-green-700" value={newCurrencyTranche.receivedAmountStr || ''} onChange={e => setNewCurrencyTranche({...newCurrencyTranche, receivedAmountStr: e.target.value})} placeholder="اختیاری" /></div>

                                    <div className="col-span-2 flex justify-end mt-2 gap-2">
                                        {editingTrancheId && <button onClick={handleCancelEditTranche} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-300">انصراف</button>}
                                        <button onClick={handleAddCurrencyTranche} className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-amber-700 flex items-center gap-1"><Plus size={16} /> {editingTrancheId ? 'ویرایش و ذخیره' : 'افزودن پارت'}</button>
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-right">
                                        <thead className="bg-gray-100 text-gray-700"><tr><th className="p-3">تاریخ</th><th className="p-3">مقدار</th><th className="p-3">کل پرداختی (ریال)</th><th className="p-3">کارمزد ارزی</th><th className="p-3">صرافی / کارگزار</th><th className="p-3 text-green-700">تحویل شده</th><th className="p-3 text-red-700">عودت (ریال)</th><th className="p-3 text-center">وضعیت تحویل</th><th className="p-3 bg-indigo-50 text-indigo-800">نرخ تمام شده</th><th className="p-3">عملیات</th></tr></thead>
                                        <tbody>
                                            {currencyForm.tranches?.map((t) => {
                                                // Check for return amount field, handle if missing in type definition (runtime check)
                                                // @ts-ignore
                                                const retAmt = t.returnAmount;
                                                // @ts-ignore
                                                const retDate = t.returnDate;
                                                // @ts-ignore
                                                const recvAmt = t.receivedAmount;
                                                
                                                // Calculate Effective Rate for Display: (Paid - Return) / Delivered
                                                const netPaid = (t.rialAmount || 0) - (retAmt || 0);
                                                const actualDelivered = recvAmt || (t.isDelivered ? t.amount : 0);
                                                const effectiveRateDisplay = actualDelivered > 0 ? netPaid / actualDelivered : 0;
                                                
                                                return (
                                                <tr key={t.id} className="border-b hover:bg-gray-50">
                                                    <td className="p-3">{t.date}</td>
                                                    <td className="p-3 font-mono font-bold text-blue-600">{formatNumberString(t.amount)} {t.currencyType}</td>
                                                    <td className="p-3 font-mono">{formatNumberString(t.rialAmount || 0)}</td>
                                                    <td className="p-3 font-mono">{t.currencyFee ? t.currencyFee : '-'}</td>
                                                    <td className="p-3 text-xs">{t.exchangeName} {t.brokerName ? `(${t.brokerName})` : ''}</td>
                                                    <td className="p-3 text-xs font-bold text-green-600 font-mono">{recvAmt ? formatNumberString(recvAmt) : '-'}</td>
                                                    <td className="p-3 text-xs text-red-600 font-mono">{retAmt ? `${formatNumberString(retAmt)} (${retDate || '-'})` : '-'}</td>
                                                    <td className="p-3 text-center">
                                                        <button onClick={() => handleToggleTrancheDelivery(t.id)} className={`px-2 py-1 rounded text-xs font-bold ${t.isDelivered ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                                            {t.isDelivered ? 'تکمیل' : 'ناقص'}
                                                        </button>
                                                    </td>
                                                    <td className="p-3 font-mono font-bold text-indigo-700 bg-indigo-50">{effectiveRateDisplay > 0 ? formatCurrency(effectiveRateDisplay) : '-'}</td>
                                                    <td className="p-3 flex gap-1">
                                                        <button onClick={() => handleEditTranche(t)} className="text-amber-500 hover:text-amber-700 p-1"><Edit2 size={16}/></button>
                                                        <button onClick={() => handleRemoveTranche(t.id)} className="text-red-500 hover:text-red-700 p-1"><Trash2 size={16}/></button>
                                                    </td>
                                                </tr>
                                            )})}
                                            {(() => {
                                                const totalPaid = currencyForm.tranches?.reduce((acc, t) => acc + (t.rialAmount || 0), 0) || 0;
                                                const totalReturn = currencyForm.tranches?.reduce((acc, t:any) => acc + (t.returnAmount || 0), 0) || 0;
                                                const totalNet = totalPaid - totalReturn;
                                                const totalDelivered = currencyForm.deliveredAmount || 0;
                                                const avgRate = totalDelivered > 0 ? totalNet / totalDelivered : 0;

                                                return (
                                                    <tr className="bg-amber-50 font-bold border-t-2 border-amber-200">
                                                        <td className="p-3">جمع کل</td>
                                                        <td className="p-3 font-mono text-amber-800">{formatNumberString(currencyForm.purchasedAmount)}</td>
                                                        <td className="p-3 font-mono">{formatNumberString(totalPaid)}</td>
                                                        <td colSpan={2}></td>
                                                        <td className="p-3 font-mono text-green-800">{formatNumberString(currencyForm.deliveredAmount)}</td>
                                                        <td className="p-3 font-mono text-red-800">{formatNumberString(totalReturn)}</td>
                                                        <td></td>
                                                        <td className="p-3 font-mono text-indigo-800 text-sm bg-indigo-100">{formatCurrency(avgRate)}</td>
                                                        <td></td>
                                                    </tr>
                                                );
                                            })()}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Guarantee Cheque Section */}
                            <div className="bg-white p-6 rounded-xl shadow-sm border space-y-4">
                                <h3 className="font-bold text-gray-800 flex items-center gap-2"><ShieldCheck size={20} className="text-purple-600"/> چک ضمانت ارزی (رفع تعهد)</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 items-end bg-purple-50 p-4 rounded-lg">
                                     <div className="space-y-1"><label className="text-xs font-bold text-gray-700">شماره چک</label><input className="w-full border rounded p-2 text-sm dir-ltr" value={currencyGuarantee.number} onChange={e => setCurrencyGuarantee({...currencyGuarantee, number: e.target.value})} /></div>
                                     <div className="space-y-1"><label className="text-xs font-bold text-gray-700">نام بانک</label><select className="w-full border rounded p-2 text-sm" value={currencyGuarantee.bank} onChange={e => setCurrencyGuarantee({...currencyGuarantee, bank: e.target.value})}><option value="">انتخاب</option>{availableBanks.map(b => <option key={b} value={b}>{b}</option>)}</select></div>
                                     <div className="space-y-1"><label className="text-xs font-bold text-gray-700">مبلغ (ریال)</label><input className="w-full border rounded p-2 text-sm dir-ltr" value={currencyGuarantee.amount} onChange={e => setCurrencyGuarantee({...currencyGuarantee, amount: formatNumberString(deformatNumberString(e.target.value).toString())})} /></div>
                                     <div className="space-y-1"><label className="text-xs font-bold text-gray-700">تاریخ سررسید</label><input className="w-full border rounded p-2 text-sm dir-ltr" placeholder="1403/xx/xx" value={currencyGuarantee.date} onChange={e => setCurrencyGuarantee({...currencyGuarantee, date: e.target.value})} /></div>
                                     <button onClick={handleSaveCurrencyGuarantee} className="bg-purple-600 text-white p-2 rounded-lg text-sm font-bold hover:bg-purple-700 h-[38px]"><Save size={16} /></button>
                                </div>
                                <div className="flex items-center gap-2">
                                    <label className="text-sm font-bold text-gray-700">وضعیت چک:</label>
                                    <button onClick={handleToggleCurrencyGuaranteeDelivery} className={`px-3 py-1 rounded text-xs font-bold transition-colors ${currencyGuarantee.isDelivered ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-red-100 text-red-700 border border-red-300'}`}>
                                        {currencyGuarantee.isDelivered ? 'عودت داده شد (رفع تعهد)' : 'نزد بانک (در جریان)'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ... (Other tabs kept same - Shipping Docs, Inspection) ... */}
                    {activeTab === 'shipping_docs' && (
                        /* ... Shipping Docs Logic ... */
                        <div className="p-6 max-w-5xl mx-auto flex gap-6">
                            <div className="w-48 flex flex-col gap-2">
                                <button onClick={() => setActiveShippingSubTab('Commercial Invoice')} className={`p-3 rounded-lg text-sm text-right font-bold ${activeShippingSubTab === 'Commercial Invoice' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white hover:bg-gray-50'}`}>اینویس</button>
                                <button onClick={() => setActiveShippingSubTab('Packing List')} className={`p-3 rounded-lg text-sm text-right font-bold ${activeShippingSubTab === 'Packing List' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white hover:bg-gray-50'}`}>پکینگ لیست</button>
                                <button onClick={() => setActiveShippingSubTab('Bill of Lading')} className={`p-3 rounded-lg text-sm text-right font-bold ${activeShippingSubTab === 'Bill of Lading' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white hover:bg-gray-50'}`}>بارنامه</button>
                                <button onClick={() => setActiveShippingSubTab('Certificate of Origin')} className={`p-3 rounded-lg text-sm text-right font-bold ${activeShippingSubTab === 'Certificate of Origin' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white hover:bg-gray-50'}`}>گواهی مبدا</button>
                            </div>
                            <div className="flex-1 bg-white p-6 rounded-xl shadow-sm border space-y-6">
                                <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">{activeShippingSubTab === 'Commercial Invoice' ? 'سیاهه تجاری (Invoice)' : activeShippingSubTab === 'Packing List' ? 'لیست عدل‌بندی (Packing List)' : activeShippingSubTab}</h3>
                                {/* ... Document Form ... */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-1"><label className="text-xs font-bold text-gray-700">شماره سند</label><input className="w-full border rounded p-2 text-sm dir-ltr" value={shippingDocForm.documentNumber} onChange={e => setShippingDocForm({...shippingDocForm, documentNumber: e.target.value})} /></div>
                                    <div className="space-y-1"><label className="text-xs font-bold text-gray-700">تاریخ سند</label><input className="w-full border rounded p-2 text-sm dir-ltr" value={shippingDocForm.documentDate} onChange={e => setShippingDocForm({...shippingDocForm, documentDate: e.target.value})} /></div>
                                    <div className="space-y-1"><label className="text-xs font-bold text-gray-700">وضعیت</label><select className="w-full border rounded p-2 text-sm" value={shippingDocForm.status} onChange={e => setShippingDocForm({...shippingDocForm, status: e.target.value as DocStatus})}><option value="Draft">پیش‌نویس</option><option value="Final">نهایی</option></select></div>
                                </div>

                                {activeShippingSubTab === 'Commercial Invoice' && (
                                    <div className="bg-blue-50 p-4 rounded-lg space-y-4">
                                        <div className="flex justify-between items-center">
                                            <h4 className="font-bold text-sm text-blue-800">اقلام اینویس</h4>
                                            <div className="flex gap-2 items-center">
                                                <select className="border rounded p-1 text-xs" value={shippingDocForm.currency} onChange={e => setShippingDocForm({...shippingDocForm, currency: e.target.value})}>{CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}</select>
                                                <button onClick={handleSyncInvoiceToProforma} className="bg-orange-500 hover:bg-orange-600 text-white text-xs px-3 py-1.5 rounded flex items-center gap-1 transition-colors" title="جایگزینی اقلام اینویس در پروفرما"><RefreshCw size={14}/> جایگزینی در پروفرما</button>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 items-end">
                                            <input className="flex-1 border rounded p-2 text-sm" placeholder="نام کالا" value={newInvoiceItem.name} onChange={e => setNewInvoiceItem({...newInvoiceItem, name: e.target.value})} />
                                            <input className="w-20 border rounded p-2 text-sm dir-ltr" placeholder="وزن" value={newInvoiceItem.weight || ''} onChange={e => setNewInvoiceItem({...newInvoiceItem, weight: Number(e.target.value)})} type="number" />
                                            <input className="w-24 border rounded p-2 text-sm dir-ltr" placeholder="فی (Unit)" value={newInvoiceItem.unitPrice || ''} onChange={e => setNewInvoiceItem({...newInvoiceItem, unitPrice: Number(e.target.value)})} type="number" step="0.0001" />
                                            <input className="w-20 border rounded p-2 text-sm" placeholder="پارت" value={newInvoiceItem.part} onChange={e => setNewInvoiceItem({...newInvoiceItem, part: e.target.value})} />
                                            <input className="w-24 border rounded p-2 text-sm dir-ltr bg-gray-100" placeholder="قیمت کل" value={newInvoiceItem.totalPrice || ((newInvoiceItem.weight || 0) * (newInvoiceItem.unitPrice || 0))} readOnly />
                                            <button onClick={handleAddInvoiceItem} className="bg-blue-600 text-white p-2 rounded-lg"><Plus size={16}/></button>
                                        </div>
                                        <div className="space-y-1">{shippingDocForm.invoiceItems?.map(i => (<div key={i.id} className="flex justify-between bg-white p-2 rounded text-xs border"><span>{i.name}</span><div className="flex gap-2 items-center"><span className="bg-gray-100 px-1 rounded text-gray-500">Part: {i.part}</span><span className="font-mono">{i.weight} KG</span><span className="font-mono">@{i.unitPrice}</span><span className="font-mono font-bold">{formatNumberString(i.totalPrice)}</span><button onClick={()=>handleRemoveInvoiceItem(i.id)} className="text-red-500"><X size={14}/></button></div></div>))}</div>
                                        <div className="flex justify-between items-center pt-2 border-t border-blue-200"><span className="font-bold text-xs">هزینه حمل (Freight)</span><input className="w-32 border rounded p-1 text-sm dir-ltr" value={shippingDocForm.freightCost} onChange={e => setShippingDocForm({...shippingDocForm, freightCost: Number(e.target.value)})} type="number" /></div>
                                    </div>
                                )}

                                {activeShippingSubTab === 'Packing List' && (
                                    <div className="bg-orange-50 p-4 rounded-lg space-y-4">
                                        <h4 className="font-bold text-sm text-orange-800 flex items-center gap-2"><Box size={16}/> اقلام پکینگ لیست</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
                                            <div className="md:col-span-2 space-y-1"><label className="text-[10px] text-gray-500">شرح کالا</label><input className="w-full border rounded p-1.5 text-sm" placeholder="نام کالا" value={newPackingItem.description} onChange={e => setNewPackingItem({...newPackingItem, description: e.target.value})} /></div>
                                            <div className="space-y-1"><label className="text-[10px] text-gray-500">پارت</label><input className="w-full border rounded p-1.5 text-sm" placeholder="Part No" value={newPackingItem.part} onChange={e => setNewPackingItem({...newPackingItem, part: e.target.value})} /></div>
                                            <div className="space-y-1"><label className="text-[10px] text-gray-500">وزن خالص</label><input className="w-full border rounded p-1.5 text-sm dir-ltr" placeholder="NW" value={newPackingItem.netWeight || ''} onChange={e => setNewPackingItem({...newPackingItem, netWeight: Number(e.target.value)})} type="number" /></div>
                                            <div className="space-y-1"><label className="text-xs text-gray-500">وزن ناخالص</label><input className="w-full border rounded p-1.5 text-sm dir-ltr" placeholder="GW" value={newPackingItem.grossWeight || ''} onChange={e => setNewPackingItem({...newPackingItem, grossWeight: Number(e.target.value)})} type="number" /></div>
                                            <div className="flex gap-2">
                                                <div className="space-y-1 flex-1"><label className="text-[10px] text-gray-500">تعداد بسته</label><input className="w-full border rounded p-1.5 text-sm dir-ltr" placeholder="Count" value={newPackingItem.packageCount || ''} onChange={e => setNewPackingItem({...newPackingItem, packageCount: Number(e.target.value)})} type="number" /></div>
                                                <button onClick={handleAddPackingItem} className="bg-orange-600 text-white p-1.5 rounded-lg h-[34px] mt-auto w-10 flex items-center justify-center"><Plus size={16}/></button>
                                            </div>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs text-right bg-white rounded border border-orange-200">
                                                <thead className="bg-orange-100 text-orange-800"><tr><th className="p-2">شرح</th><th className="p-2">پارت</th><th className="p-2">وزن خالص</th><th className="p-2">وزن ناخالص</th><th className="p-2">تعداد</th><th className="p-2"></th></tr></thead>
                                                <tbody>
                                                    {shippingDocForm.packingItems?.map(item => (
                                                        <tr key={item.id} className="border-t hover:bg-orange-50">
                                                            <td className="p-2 font-bold">{item.description}</td>
                                                            <td className="p-2">{item.part}</td>
                                                            <td className="p-2 font-mono">{item.netWeight}</td>
                                                            <td className="p-2 font-mono">{item.grossWeight}</td>
                                                            <td className="p-2 font-mono">{item.packageCount}</td>
                                                            <td className="p-2 text-center"><button onClick={() => handleRemovePackingItem(item.id)} className="text-red-500 hover:text-red-700"><X size={14}/></button></td>
                                                        </tr>
                                                    ))}
                                                    <tr className="bg-orange-50 font-bold border-t-2 border-orange-200">
                                                        <td colSpan={2} className="p-2 text-center text-orange-800">جمع کل</td>
                                                        <td className="p-2 font-mono text-orange-700">{shippingDocForm.packingItems?.reduce((s,i)=>s+i.netWeight,0)}</td>
                                                        <td className="p-2 font-mono text-orange-700">{shippingDocForm.packingItems?.reduce((s,i)=>s+i.grossWeight,0)}</td>
                                                        <td className="p-2 font-mono text-orange-700">{shippingDocForm.packingItems?.reduce((s,i)=>s+i.packageCount,0)}</td>
                                                        <td></td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                                
                                <div><label className="text-xs font-bold block mb-1">فایل‌های ضمیمه</label><div className="flex items-center gap-2 mb-2"><input type="file" ref={docFileInputRef} className="hidden" onChange={handleDocFileChange} /><button onClick={() => docFileInputRef.current?.click()} disabled={uploadingDocFile} className="bg-gray-100 border px-3 py-1 rounded text-xs hover:bg-gray-200">{uploadingDocFile ? 'در حال آپلود...' : 'افزودن فایل'}</button></div><div className="space-y-1">{shippingDocForm.attachments?.map((att, i) => (<div key={i} className="flex justify-between items-center bg-gray-50 p-2 rounded text-xs"><span className="truncate max-w-[200px]">{att.fileName}</span><button onClick={() => setShippingDocForm({...shippingDocForm, attachments: shippingDocForm.attachments?.filter((_, idx) => idx !== i)})} className="text-red-500"><X size={14}/></button></div>))}</div></div>

                                <div className="flex justify-end pt-4 border-t"><button onClick={handleSaveShippingDoc} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700">ثبت سند</button></div>
                                
                                <div className="mt-6"><h4 className="font-bold text-sm text-gray-500 mb-2">اسناد ثبت شده</h4><div className="space-y-2">{selectedRecord.shippingDocuments?.filter(d => d.type === activeShippingSubTab).map(doc => (<div key={doc.id} className="border p-3 rounded-lg flex justify-between items-center bg-gray-50"><div className="text-sm"><span className="font-mono font-bold">{doc.documentNumber}</span> <span className="text-xs text-gray-500">({doc.documentDate})</span></div><button onClick={() => handleDeleteShippingDoc(doc.id)} className="text-red-500 hover:text-red-700"><Trash2 size={16}/></button></div>))}</div></div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'inspection' && (
                        <div className="p-6 max-w-5xl mx-auto space-y-6">
                            <div className="bg-white p-6 rounded-xl shadow-sm border space-y-4">
                                <h3 className="font-bold text-gray-800 flex items-center gap-2"><Microscope size={20} className="text-blue-600"/> گواهی‌های بازرسی (COI)</h3>
                                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end bg-blue-50 p-4 rounded-lg">
                                    <div className="space-y-1 md:col-span-2"><label className="text-xs font-bold text-gray-700">شرکت بازرسی</label><input className="w-full border rounded p-2 text-sm" value={newInspectionCertificate.company} onChange={e => setNewInspectionCertificate({...newInspectionCertificate, company: e.target.value})} /></div>
                                    <div className="space-y-1"><label className="text-xs font-bold text-gray-700">شماره گواهی</label><input className="w-full border rounded p-2 text-sm" value={newInspectionCertificate.certificateNumber} onChange={e => setNewInspectionCertificate({...newInspectionCertificate, certificateNumber: e.target.value})} /></div>
                                    <div className="space-y-1"><label className="text-xs font-bold text-gray-700">هزینه بازرسی (ریال)</label><input className="w-full border rounded p-2 text-sm dir-ltr" value={formatNumberString(newInspectionCertificate.amount)} onChange={e => setNewInspectionCertificate({...newInspectionCertificate, amount: deformatNumberString(e.target.value)})} /></div>
                                    <div className="space-y-1"><label className="text-xs font-bold text-gray-700">پارت / توضیحات</label><div className="flex gap-1"><input className="w-full border rounded p-2 text-sm" value={newInspectionCertificate.part} onChange={e => setNewInspectionCertificate({...newInspectionCertificate, part: e.target.value})} /><button onClick={handleAddInspectionCertificate} className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700"><Plus size={16}/></button></div></div>
                                </div>
                                <div className="overflow-x-auto"><table className="w-full text-sm text-right"><thead className="bg-gray-100 text-gray-700"><tr><th className="p-3">شرکت</th><th className="p-3">شماره گواهی</th><th className="p-3">هزینه</th><th className="p-3">پارت</th><th className="p-3">حذف</th></tr></thead><tbody>{inspectionForm.certificates?.map(c => (<tr key={c.id} className="border-b hover:bg-gray-50"><td className="p-3">{c.company}</td><td className="p-3 font-mono">{c.certificateNumber}</td><td className="p-3 font-mono">{formatCurrency(c.amount)}</td><td className="p-3">{c.part}</td><td className="p-3"><button onClick={()=>handleDeleteInspectionCertificate(c.id)} className="text-red-500"><Trash2 size={16}/></button></td></tr>))}</tbody></table></div>
                            </div>
                            <div className="bg-white p-6 rounded-xl shadow-sm border space-y-4">
                                <h3 className="font-bold text-gray-800">پرداخت‌های بازرسی</h3>
                                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end bg-gray-50 p-4 rounded-lg">
                                    <div className="space-y-1 md:col-span-2"><label className="text-xs font-bold text-gray-700">بانک پرداخت کننده</label><select className="w-full border rounded p-2 text-sm" value={newInspectionPayment.bank} onChange={e => setNewInspectionPayment({...newInspectionPayment, bank: e.target.value})}><option value="">انتخاب بانک</option>{availableBanks.map(b => <option key={b} value={b}>{b}</option>)}</select></div>
                                    <div className="space-y-1"><label className="text-xs font-bold text-gray-700">مبلغ (ریال)</label><input className="w-full border rounded p-2 text-sm dir-ltr" value={formatNumberString(newInspectionPayment.amount)} onChange={e => setNewInspectionPayment({...newInspectionPayment, amount: deformatNumberString(e.target.value)})} /></div>
                                    <div className="space-y-1"><label className="text-xs font-bold text-gray-700">تاریخ</label><input className="w-full border rounded p-2 text-sm dir-ltr" placeholder="1403/xx/xx" value={newInspectionPayment.date} onChange={e => setNewInspectionPayment({...newInspectionPayment, date: e.target.value})} /></div>
                                    <div className="space-y-1"><label className="text-xs font-bold text-gray-700">پارت</label><div className="flex gap-1"><input className="w-full border rounded p-2 text-sm" value={newInspectionPayment.part} onChange={e => setNewInspectionPayment({...newInspectionPayment, part: e.target.value})} /><button onClick={handleAddInspectionPayment} className="bg-green-600 text-white p-2 rounded-lg hover:bg-green-700"><Plus size={16}/></button></div></div>
                                </div>
                                <div className="overflow-x-auto"><table className="w-full text-sm text-right"><thead className="bg-gray-100 text-gray-700"><tr><th className="p-3">بانک</th><th className="p-3">مبلغ</th><th className="p-3">تاریخ</th><th className="p-3">پارت</th><th className="p-3">حذف</th></tr></thead><tbody>{inspectionForm.payments?.map(p => (<tr key={p.id} className="border-b hover:bg-gray-50"><td className="p-3">{p.bank}</td><td className="p-3 font-mono">{formatCurrency(p.amount)}</td><td className="p-3">{p.date}</td><td className="p-3">{p.part}</td><td className="p-3"><button onClick={()=>handleDeleteInspectionPayment(p.id)} className="text-red-500"><Trash2 size={16}/></button></td></tr>))}</tbody></table></div>
                            </div>
                        </div>
                    )}

                    {/* CLEARANCE DOCS TAB */}
                    {activeTab === 'clearance_docs' && (
                        <div className="p-6 max-w-5xl mx-auto space-y-6">
                            
                            {/* NEW: Button to open the Clearance Declaration Form */}
                            <div className="flex justify-end">
                                <button 
                                    onClick={() => setShowClearancePrint(true)} 
                                    className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-blue-700 flex items-center gap-2 font-bold"
                                >
                                    <Printer size={18}/> چاپ اعلامیه ورود کالا (ترخیصیه)
                                </button>
                            </div>

                            <div className="bg-white p-6 rounded-xl shadow-sm border space-y-4">
                                <h3 className="font-bold text-gray-800 flex items-center gap-2"><Warehouse size={20} className="text-indigo-600"/> قبض انبار و ترخیصیه</h3>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end bg-indigo-50 p-4 rounded-lg">
                                    <div className="space-y-1"><label className="text-xs font-bold text-gray-700">شماره قبض انبار</label><input className="w-full border rounded p-2 text-sm" value={newWarehouseReceipt.number} onChange={e => setNewWarehouseReceipt({...newWarehouseReceipt, number: e.target.value})} /></div>
                                    <div className="space-y-1"><label className="text-xs font-bold text-gray-700">تاریخ صدور</label><input className="w-full border rounded p-2 text-sm dir-ltr" value={newWarehouseReceipt.issueDate} onChange={e => setNewWarehouseReceipt({...newWarehouseReceipt, issueDate: e.target.value})} /></div>
                                    <div className="space-y-1"><label className="text-xs font-bold text-gray-700">پارت / توضیحات</label><input className="w-full border rounded p-2 text-sm" value={newWarehouseReceipt.part} onChange={e => setNewWarehouseReceipt({...newWarehouseReceipt, part: e.target.value})} /></div>
                                    <button onClick={handleAddWarehouseReceipt} className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 h-[38px]"><Plus size={16} className="mx-auto"/></button>
                                </div>
                                <div className="space-y-2">{clearanceForm.receipts?.map(r => (<div key={r.id} className="flex justify-between items-center border p-3 rounded-lg bg-gray-50"><div><span className="font-bold text-sm">شماره: {r.number}</span> <span className="text-xs text-gray-500 mx-2">تاریخ: {r.issueDate}</span> <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">{r.part}</span></div><button onClick={()=>handleDeleteWarehouseReceipt(r.id)} className="text-red-500"><Trash2 size={16}/></button></div>))}</div>
                            </div>
                            <div className="bg-white p-6 rounded-xl shadow-sm border space-y-4">
                                <h3 className="font-bold text-gray-800">هزینه‌های ترخیصیه ( کشتیرانی / ایجنت )</h3>
                                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end bg-gray-50 p-4 rounded-lg">
                                    <div className="space-y-1 md:col-span-2"><label className="text-xs font-bold text-gray-700">بانک پرداخت کننده</label><select className="w-full border rounded p-2 text-sm" value={newClearancePayment.bank} onChange={e => setNewClearancePayment({...newClearancePayment, bank: e.target.value})}><option value="">انتخاب بانک</option>{availableBanks.map(b => <option key={b} value={b}>{b}</option>)}</select></div>
                                    <div className="space-y-1"><label className="text-xs font-bold text-gray-700">مبلغ (ریال)</label><input className="w-full border rounded p-2 text-sm dir-ltr" value={formatNumberString(newClearancePayment.amount)} onChange={e => setNewClearancePayment({...newClearancePayment, amount: deformatNumberString(e.target.value)})} /></div>
                                    <div className="space-y-1"><label className="text-xs font-bold text-gray-700">تاریخ</label><input className="w-full border rounded p-2 text-sm dir-ltr" value={newClearancePayment.date} onChange={e => setNewClearancePayment({...newClearancePayment, date: e.target.value})} /></div>
                                    <button onClick={handleAddClearancePayment} className="bg-green-600 text-white p-2 rounded-lg hover:bg-green-700 h-[38px]"><Plus size={16} className="mx-auto"/></button>
                                </div>
                                <div className="overflow-x-auto"><table className="w-full text-sm text-right"><thead className="bg-gray-100 text-gray-700"><tr><th className="p-3">بانک</th><th className="p-3">مبلغ</th><th className="p-3">تاریخ</th><th className="p-3">حذف</th></tr></thead><tbody>{clearanceForm.payments?.map(p => (<tr key={p.id} className="border-b hover:bg-gray-50"><td className="p-3">{p.bank}</td><td className="p-3 font-mono">{formatCurrency(p.amount)}</td><td className="p-3">{p.date}</td><td className="p-3"><button onClick={()=>handleDeleteClearancePayment(p.id)} className="text-red-500"><Trash2 size={16}/></button></td></tr>))}</tbody></table></div>
                            </div>
                        </div>
                    )}

                    {/* ... (Green Leaf, Internal Shipping, Agent Fees, Final Calc kept the same) ... */}
                    {activeTab === 'green_leaf' && (
                        /* ... Green Leaf Logic ... */
                        <div className="p-6 max-w-5xl mx-auto space-y-6">
                            <div className="bg-white p-6 rounded-xl shadow-sm border space-y-4">
                                <h3 className="font-bold text-gray-800 flex items-center gap-2"><Leaf size={20} className="text-green-600"/> اظهارنامه و کوتاژ (حقوق ورودی)</h3>
                                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end bg-green-50 p-4 rounded-lg">
                                    <div className="space-y-1"><label className="text-xs font-bold text-gray-700">شماره کوتاژ</label><input className="w-full border rounded p-2 text-sm" value={newCustomsDuty.cottageNumber} onChange={e => setNewCustomsDuty({...newCustomsDuty, cottageNumber: e.target.value})} /></div>
                                    <div className="space-y-1"><label className="text-xs font-bold text-gray-700">مبلغ کل (ریال)</label><input className="w-full border rounded p-2 text-sm dir-ltr" value={formatNumberString(newCustomsDuty.amount)} onChange={e => setNewCustomsDuty({...newCustomsDuty, amount: deformatNumberString(e.target.value)})} /></div>
                                    <div className="space-y-1"><label className="text-xs font-bold text-gray-700">روش پرداخت</label><select className="w-full border rounded p-2 text-sm" value={newCustomsDuty.paymentMethod} onChange={e => setNewCustomsDuty({...newCustomsDuty, paymentMethod: e.target.value as 'Bank' | 'Guarantee'})}><option value="Bank">نقدی (بانک)</option><option value="Guarantee">ضمانت‌نامه</option></select></div>
                                    <div className="space-y-1"><label className="text-xs font-bold text-gray-700">پارت</label><input className="w-full border rounded p-2 text-sm" value={newCustomsDuty.part} onChange={e => setNewCustomsDuty({...newCustomsDuty, part: e.target.value})} /></div>
                                    <button onClick={handleAddCustomsDuty} className="bg-green-600 text-white p-2 rounded-lg hover:bg-green-700 h-[38px]"><Plus size={16} className="mx-auto"/></button>
                                </div>
                                <div className="space-y-2">{greenLeafForm.duties?.map(d => (<div key={d.id} className="flex justify-between items-center border p-3 rounded-lg bg-gray-50"><div><span className="font-bold text-sm">کوتاژ: {d.cottageNumber}</span> <span className="text-xs bg-gray-200 px-2 py-0.5 rounded mx-2">{d.paymentMethod === 'Bank' ? 'نقدی' : 'ضمانت‌نامه'}</span> <span className="font-mono font-bold text-green-700">{formatCurrency(d.amount)}</span></div><button onClick={()=>handleDeleteCustomsDuty(d.id)} className="text-red-500"><Trash2 size={16}/></button></div>))}</div>
                            </div>

                            <div className="bg-white p-6 rounded-xl shadow-sm border space-y-4">
                                <h3 className="font-bold text-gray-800 flex items-center gap-2"><ShieldCheck size={20} className="text-orange-600"/> ضمانت‌نامه‌های گمرکی</h3>
                                <div className="bg-orange-50 p-4 rounded-lg space-y-3">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div className="space-y-1"><label className="text-xs font-bold text-gray-700">مربوط به کوتاژ</label><select className="w-full border rounded p-2 text-sm bg-white" value={selectedDutyForGuarantee} onChange={e => setSelectedDutyForGuarantee(e.target.value)}><option value="">انتخاب کوتاژ</option>{greenLeafForm.duties.map(d => <option key={d.id} value={d.id}>{d.cottageNumber} ({formatCurrency(d.amount)})</option>)}</select></div>
                                        <div className="space-y-1"><label className="text-xs font-bold text-gray-700">شماره ضمانت‌نامه</label><input className="w-full border rounded p-2 text-sm dir-ltr" value={newGuaranteeDetails.guaranteeNumber} onChange={e => setNewGuaranteeDetails({...newGuaranteeDetails, guaranteeNumber: e.target.value})} /></div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                                        <div className="space-y-1"><label className="text-xs font-bold text-gray-700">شماره چک تضمین</label><input className="w-full border rounded p-2 text-sm dir-ltr" value={newGuaranteeDetails.chequeNumber} onChange={e => setNewGuaranteeDetails({...newGuaranteeDetails, chequeNumber: e.target.value})} /></div>
                                        <div className="space-y-1"><label className="text-xs font-bold text-gray-700">مبلغ چک (ریال)</label><input className="w-full border rounded p-2 text-sm dir-ltr" value={formatNumberString(newGuaranteeDetails.chequeAmount)} onChange={e => setNewGuaranteeDetails({...newGuaranteeDetails, chequeAmount: deformatNumberString(e.target.value)})} /></div>
                                        <div className="space-y-1"><label className="text-xs font-bold text-gray-700">بانک چک</label><select className="w-full border rounded p-2 text-sm bg-white" value={newGuaranteeDetails.chequeBank} onChange={e => setNewGuaranteeDetails({...newGuaranteeDetails, chequeBank: e.target.value})}><option value="">انتخاب بانک</option>{availableBanks.map(b => <option key={b} value={b}>{b}</option>)}</select></div>
                                        <div className="space-y-1"><label className="text-xs font-bold text-gray-700">سپرده نقدی (ریال)</label><input className="w-full border rounded p-2 text-sm dir-ltr" value={formatNumberString(newGuaranteeDetails.cashAmount)} onChange={e => setNewGuaranteeDetails({...newGuaranteeDetails, cashAmount: deformatNumberString(e.target.value)})} /></div>
                                    </div>
                                    <button onClick={handleAddGuarantee} className="w-full bg-orange-600 text-white p-2 rounded-lg font-bold hover:bg-orange-700">ثبت ضمانت‌نامه</button>
                                </div>
                                <div className="space-y-2">{greenLeafForm.guarantees?.map(g => (<div key={g.id} className="border p-3 rounded-lg bg-gray-50 flex justify-between items-center"><div className="text-sm space-y-1"><div className="font-bold">شماره: {g.guaranteeNumber}</div><div className="text-xs text-gray-600">چک: {g.chequeNumber} ({g.chequeBank}) - مبلغ: {formatCurrency(g.chequeAmount || 0)}</div><div className="text-xs text-gray-600">سپرده نقدی: {formatCurrency(g.cashAmount || 0)}</div></div><div className="flex gap-2 items-center"><button onClick={() => handleToggleGuaranteeDelivery(g.id)} className={`text-xs px-2 py-1 rounded font-bold transition-colors ${g.isDelivered ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{g.isDelivered ? 'عودت شد' : 'نزد سازمان'}</button><button onClick={()=>handleDeleteGuarantee(g.id)} className="text-red-500"><Trash2 size={16}/></button></div></div>))}</div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-white p-6 rounded-xl shadow-sm border space-y-4">
                                    <h3 className="font-bold text-gray-800">مالیات بر ارزش افزوده</h3>
                                    <div className="flex gap-2 items-end"><input className="flex-1 border rounded p-2 text-sm dir-ltr" placeholder="مبلغ (ریال)" value={formatNumberString(newTax.amount)} onChange={e => setNewTax({...newTax, amount: deformatNumberString(e.target.value)})} /><button onClick={handleAddTax} className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700"><Plus size={16}/></button></div>
                                    <div className="space-y-1">{greenLeafForm.taxes?.map(t => (<div key={t.id} className="flex justify-between bg-gray-50 p-2 rounded text-sm"><span className="font-mono">{formatCurrency(t.amount)}</span><button onClick={()=>handleDeleteTax(t.id)} className="text-red-500"><X size={14}/></button></div>))}</div>
                                </div>
                                <div className="bg-white p-6 rounded-xl shadow-sm border space-y-4">
                                    <h3 className="font-bold text-gray-800">عوارض راهداری / هلال احمر</h3>
                                    <div className="flex gap-2 items-end"><input className="flex-1 border rounded p-2 text-sm dir-ltr" placeholder="مبلغ (ریال)" value={formatNumberString(newRoadToll.amount)} onChange={e => setNewRoadToll({...newRoadToll, amount: deformatNumberString(e.target.value)})} /><button onClick={handleAddRoadToll} className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700"><Plus size={16}/></button></div>
                                    <div className="space-y-1">{greenLeafForm.roadTolls?.map(t => (<div key={t.id} className="flex justify-between bg-gray-50 p-2 rounded text-sm"><span className="font-mono">{formatCurrency(t.amount)}</span><button onClick={()=>handleDeleteRoadToll(t.id)} className="text-red-500"><X size={14}/></button></div>))}</div>
                                </div>
                            </div>
                            <div className="bg-green-100 p-4 rounded-lg flex justify-between items-center font-bold text-green-900 border border-green-200"><span>جمع کل هزینه‌های گمرکی (نقدی + سپرده + مالیات + عوارض)</span><span className="font-mono text-lg">{formatCurrency(calculateGreenLeafTotal(greenLeafForm))}</span></div>
                        </div>
                    )}

                    {/* ... (Internal Shipping, Agent Fees, Final Calc kept same) ... */}
                    {activeTab === 'internal_shipping' && (
                        <div className="p-6 max-w-5xl mx-auto space-y-6">
                            <div className="bg-white p-6 rounded-xl shadow-sm border space-y-4">
                                <h3 className="font-bold text-gray-800 flex items-center gap-2"><Truck size={20} className="text-indigo-600"/> هزینه‌های حمل داخلی</h3>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-indigo-50 p-4 rounded-lg">
                                    <div className="space-y-1"><label className="text-xs font-bold text-gray-700">شرح / پارت</label><input className="w-full border rounded p-2 text-sm" placeholder="مثال: کرایه حمل تا انبار" value={newShippingPayment.part} onChange={e => setNewShippingPayment({...newShippingPayment, part: e.target.value})} /></div>
                                    <div className="space-y-1"><label className="text-xs font-bold text-gray-700">مبلغ (ریال)</label><input className="w-full border rounded p-2 text-sm dir-ltr" value={formatNumberString(newShippingPayment.amount)} onChange={e => setNewShippingPayment({...newShippingPayment, amount: deformatNumberString(e.target.value)})} /></div>
                                    <div className="space-y-1"><label className="text-xs font-bold text-gray-700">تاریخ پرداخت</label><input className="w-full border rounded p-2 text-sm dir-ltr" placeholder="1403/01/01" value={newShippingPayment.date} onChange={e => setNewShippingPayment({...newShippingPayment, date: e.target.value})} /></div>
                                    <div className="space-y-1"><label className="text-xs font-bold text-gray-700">بانک</label><select className="w-full border rounded p-2 text-sm" value={newShippingPayment.bank} onChange={e => setNewShippingPayment({...newShippingPayment, bank: e.target.value})}><option value="">انتخاب بانک</option>{availableBanks.map(b => <option key={b} value={b}>{b}</option>)}</select></div>
                                    <div className="md:col-span-4 space-y-1"><label className="text-xs font-bold text-gray-700">توضیحات تکمیلی</label><input className="w-full border rounded p-2 text-sm" placeholder="توضیحات..." value={newShippingPayment.description} onChange={e => setNewShippingPayment({...newShippingPayment, description: e.target.value})} /></div>
                                    <div className="md:col-span-4 flex justify-end"><button onClick={handleAddShippingPayment} className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 flex items-center gap-2"><Plus size={16}/> افزودن پرداخت</button></div>
                                </div>
                                
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-right">
                                        <thead className="bg-gray-100 text-gray-700"><tr><th className="p-3">شرح / پارت</th><th className="p-3">مبلغ (ریال)</th><th className="p-3">تاریخ</th><th className="p-3">بانک</th><th className="p-3">توضیحات</th><th className="p-3">حذف</th></tr></thead>
                                        <tbody>
                                            {internalShippingForm.payments?.map((p) => (
                                                <tr key={p.id} className="border-b hover:bg-gray-50">
                                                    <td className="p-3 font-bold">{p.part}</td>
                                                    <td className="p-3 font-mono">{formatCurrency(p.amount)}</td>
                                                    <td className="p-3">{p.date}</td>
                                                    <td className="p-3">{p.bank}</td>
                                                    <td className="p-3 text-gray-500 text-xs">{p.description}</td>
                                                    <td className="p-3"><button onClick={() => handleDeleteShippingPayment(p.id)} className="text-red-500 hover:text-red-700"><Trash2 size={16}/></button></td>
                                                </tr>
                                            ))}
                                            <tr className="bg-indigo-50 font-bold border-t-2 border-indigo-200">
                                                <td className="p-3">جمع کل حمل داخلی</td>
                                                <td className="p-3 font-mono text-indigo-700">{formatCurrency(internalShippingForm.payments?.reduce((acc, p) => acc + p.amount, 0) || 0)}</td>
                                                <td colSpan={4}></td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'agent_fees' && (
                        <div className="p-6 max-w-5xl mx-auto space-y-6">
                            <div className="bg-white p-6 rounded-xl shadow-sm border space-y-4">
                                <h3 className="font-bold text-gray-800 flex items-center gap-2"><UserCheck size={20} className="text-teal-600"/> هزینه‌های ترخیص (کارمزد ترخیص‌کار)</h3>
                                
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-teal-50 p-4 rounded-lg">
                                    <div className="space-y-1"><label className="text-xs font-bold text-gray-700">نام ترخیص‌کار</label><input className="w-full border rounded p-2 text-sm" placeholder="نام شخص یا شرکت" value={newAgentPayment.agentName} onChange={e => setNewAgentPayment({...newAgentPayment,agentName: e.target.value})} /></div>
                                    <div className="space-y-1"><label className="text-xs font-bold text-gray-700">مبلغ ترخیص (ریال)</label><input className="w-full border rounded p-2 text-sm dir-ltr" value={formatNumberString(newAgentPayment.amount)} onChange={e => setNewAgentPayment({...newAgentPayment, amount: deformatNumberString(e.target.value)})} /></div>
                                    <div className="space-y-1"><label className="text-xs font-bold text-gray-700">تاریخ پرداخت</label><input className="w-full border rounded p-2 text-sm dir-ltr" placeholder="1403/01/01" value={newAgentPayment.date} onChange={e => setNewAgentPayment({...newAgentPayment, date: e.target.value})} /></div>
                                    <div className="space-y-1"><label className="text-xs font-bold text-gray-700">بانک</label><select className="w-full border rounded p-2 text-sm" value={newAgentPayment.bank} onChange={e => setNewAgentPayment({...newAgentPayment, bank: e.target.value})}><option value="">انتخاب بانک</option>{availableBanks.map(b => <option key={b} value={b}>{b}</option>)}</select></div>
                                    <div className="md:col-span-2 space-y-1"><label className="text-xs font-bold text-gray-700">پارت / مرحله</label><input className="w-full border rounded p-2 text-sm" placeholder="مثال: پیش پرداخت" value={newAgentPayment.part} onChange={e => setNewAgentPayment({...newAgentPayment, part: e.target.value})} /></div>
                                    <div className="md:col-span-2 space-y-1"><label className="text-xs font-bold text-gray-700">توضیحات</label><input className="w-full border rounded p-2 text-sm" placeholder="..." value={newAgentPayment.description} onChange={e => setNewAgentPayment({...newAgentPayment, description: e.target.value})} /></div>
                                    <div className="md:col-span-4 flex justify-end"><button onClick={handleAddAgentPayment} className="bg-teal-600 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-teal-700 flex items-center gap-2"><Plus size={16}/> ثبت پرداخت</button></div>
                                </div>
                                
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-right">
                                        <thead className="bg-gray-100 text-gray-700"><tr><th className="p-3">ترخیص‌کار</th><th className="p-3">مبلغ (ریال)</th><th className="p-3">بانک</th><th className="p-3">تاریخ</th><th className="p-3">پارت</th><th className="p-3">توضیحات</th><th className="p-3">حذف</th></tr></thead>
                                        <tbody>
                                            {agentForm.payments?.map((p) => (
                                                <tr key={p.id} className="border-b hover:bg-gray-50">
                                                    <td className="p-3 font-bold">{p.agentName}</td>
                                                    <td className="p-3 font-mono">{formatCurrency(p.amount)}</td>
                                                    <td className="p-3">{p.bank}</td>
                                                    <td className="p-3">{p.date}</td>
                                                    <td className="p-3">{p.part}</td>
                                                    <td className="p-3 text-gray-500 text-xs">{p.description}</td>
                                                    <td className="p-3"><button onClick={() => handleDeleteAgentPayment(p.id)} className="text-red-500 hover:text-red-700"><Trash2 size={16}/></button></td>
                                                </tr>
                                            ))}
                                            <tr className="bg-teal-50 font-bold border-t-2 border-teal-200">
                                                <td className="p-3">جمع کل هزینه‌های ترخیص</td>
                                                <td className="p-3 font-mono text-teal-700">{formatCurrency(agentForm.payments?.reduce((acc, p) => acc + p.amount, 0) || 0)}</td>
                                                <td colSpan={5}></td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'final_calculation' && (
                        /* ... Final Calculation Logic ... */
                        <div id="print-trade-final" className="p-6 max-w-6xl mx-auto space-y-8">
                            <div className="bg-white p-6 rounded-xl shadow-sm border flex flex-col md:flex-row justify-between items-center gap-4">
                                <div><h3 className="font-bold text-gray-800 text-lg mb-1">وضعیت نهایی پرونده</h3><p className="text-xs text-gray-500">مدیریت تعهدات و بایگانی پرونده</p></div>
                                <div className="flex gap-2 flex-wrap justify-end">
                                    <button onClick={toggleCommitment} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 border transition-colors ${selectedRecord.isCommitmentFulfilled ? 'bg-green-100 text-green-700 border-green-300' : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-green-50'}`}>{selectedRecord.isCommitmentFulfilled ? <CheckCircle2 size={18}/> : <AlertCircle size={18}/>}{selectedRecord.isCommitmentFulfilled ? 'رفع تعهد شده' : 'رفع تعهد نشده'}</button>
                                    
                                    {!selectedRecord.isArchived ? (
                                        <button onClick={handleArchiveRecord} className="px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors bg-blue-600 text-white hover:bg-blue-700 shadow-md">
                                            <Archive size={18}/> ترخیص شد (بایگانی)
                                        </button>
                                    ) : (
                                        <button onClick={handleUnarchiveRecord} className="px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors bg-amber-500 text-white hover:bg-amber-600 shadow-md">
                                            <Undo2 size={18}/> بازگشت به جریان
                                        </button>
                                    )}
                                </div>
                            </div>
                            
                            {/* ACTIVATED PRINT/PDF BUTTONS */}
                            <div className="flex justify-end gap-2" data-html2canvas-ignore>
                                <button onClick={handlePrintTrade} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-50 text-sm"><Printer size={16}/> چاپ گزارش</button>
                                <button onClick={handleDownloadFinalReportPDF} disabled={isGeneratingPdf} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-50 text-sm">{isGeneratingPdf ? <Loader2 size={16} className="animate-spin"/> : <FileDown size={16}/>} دانلود PDF (صورتحساب)</button>
                            </div>

                            {/* --- NEW CALCULATION LOGIC IMPLEMENTATION (WEIGHT BASED + EFFECTIVE RATE) --- */}
                            {(() => {
                                // 1. Calculate Total Proforma Currency (Items + Freight)
                                const totalItemsCurrency = selectedRecord.items.reduce((a, b) => a + b.totalPrice, 0);
                                const totalFreightCurrency = selectedRecord.freightCost || 0;
                                const totalProformaCurrency = totalItemsCurrency + totalFreightCurrency;

                                // 2. Calculate Net Rial Cost of Currency Purchase (Rial Paid - Return)
                                // REPLACED OLD RATE LOGIC
                                const currencyTranches = selectedRecord.currencyPurchaseData?.tranches || [];
                                const netCurrencyRialCost = currencyTranches.reduce((acc, t) => {
                                    const paid = t.rialAmount || 0;
                                    const ret = t.returnAmount || 0;
                                    return acc + (paid - ret);
                                }, 0);

                                // 3. Calculate Other Rial Overheads
                                const overheadStages = [
                                    TradeStage.LICENSES, TradeStage.INSURANCE, TradeStage.INSPECTION,
                                    TradeStage.CLEARANCE_DOCS, TradeStage.GREEN_LEAF,
                                    TradeStage.INTERNAL_SHIPPING, TradeStage.AGENT_FEES
                                ];
                                const totalOverheadsRial = overheadStages.reduce((sum, stage) => 
                                    sum + (selectedRecord.stages[stage]?.costRial || 0), 0);

                                // 4. Grand Total Rial Cost (Total Project Cost)
                                const grandTotalRialProject = netCurrencyRialCost + totalOverheadsRial;

                                // 5. Total Weight
                                const totalWeight = selectedRecord.items.reduce((sum, item) => sum + item.weight, 0);

                                // 6. Calculation Core:
                                // Effective Rate = Total Project Cost (Rial) / Total Proforma Currency (Items + Freight)
                                const effectiveRate = totalProformaCurrency > 0 ? grandTotalRialProject / totalProformaCurrency : 0;
                                
                                // Freight per KG (Currency) = Total Freight (Currency) / Total Weight
                                const freightPerKgCurrency = totalWeight > 0 ? totalFreightCurrency / totalWeight : 0;

                                const costPerKg = totalWeight > 0 ? grandTotalRialProject / totalWeight : 0;

                                return (
                                    <>
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                            <div className="bg-white p-6 rounded-xl shadow-sm border h-fit">
                                                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Calculator size={20} className="text-rose-600"/> صورت کلی هزینه‌ها</h3>
                                                <div className="overflow-hidden rounded-lg border">
                                                    <table className="w-full text-sm text-right">
                                                        <thead className="bg-gray-100 text-gray-700"><tr><th className="p-3">شرح هزینه</th><th className="p-3">مبلغ ریالی</th></tr></thead>
                                                        <tbody className="divide-y divide-gray-100">
                                                            <tr>
                                                                <td className="p-3 text-gray-600">هزینه خرید ارز (خالص ریالی)</td>
                                                                <td className="p-3 font-mono">{formatCurrency(netCurrencyRialCost)}</td>
                                                            </tr>
                                                            {STAGES.map(stage => {
                                                                // Skip currency stage as we added it manually above
                                                                if (stage === TradeStage.CURRENCY_PURCHASE) return null;
                                                                const data = selectedRecord.stages[stage];
                                                                if (!data || data.costRial === 0) return null;
                                                                return (<tr key={stage}><td className="p-3 text-gray-600">{stage}</td><td className="p-3 font-mono">{formatCurrency(data.costRial)}</td></tr>);
                                                            })}
                                                            <tr className="bg-rose-50 font-bold border-t-2 border-rose-200">
                                                                <td className="p-3">جمع کل هزینه نهایی پروژه (ریالی)</td>
                                                                <td className="p-3 font-mono dir-ltr">{formatCurrency(grandTotalRialProject)}</td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                </div>
                                                
                                                <div className="mt-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className="text-xs font-bold text-gray-600">مبلغ کل پروفرما (کالا + حمل):</span>
                                                        <span className="text-sm font-bold text-blue-700 dir-ltr font-mono">{formatNumberString(totalProformaCurrency)} {selectedRecord.mainCurrency}</span>
                                                    </div>
                                                    
                                                    <div className="flex justify-between items-center pt-2 border-t border-gray-300">
                                                        <span className="text-sm font-bold text-gray-700">نرخ ریالی هر واحد ارز (فی ارز):</span>
                                                        <span className="text-lg font-black text-rose-700 dir-ltr">{formatCurrency(effectiveRate)}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center mt-1">
                                                        <span className="text-xs font-bold text-gray-500">هزینه حمل ارزی هر کیلو:</span>
                                                        <span className="text-sm font-bold text-gray-700 dir-ltr">{formatNumberString(freightPerKgCurrency)} {selectedRecord.mainCurrency}</span>
                                                    </div>
                                                    <div className="mt-1 flex justify-between items-center border-t border-gray-200 pt-1">
                                                        <span className="text-xs text-gray-500">میانگین قیمت هر کیلو (ریال):</span>
                                                        <span className="text-sm font-bold text-gray-700 dir-ltr">{formatCurrency(costPerKg)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="bg-white p-6 rounded-xl shadow-sm border h-fit"><h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><ShieldCheck size={20} className="text-blue-600"/> لیست چک‌های ضمانت</h3><div className="overflow-x-auto"><table className="w-full text-sm text-right"><thead className="bg-gray-100 text-gray-700"><tr><th className="p-3">نوع</th><th className="p-3">شماره / بانک</th><th className="p-3">مبلغ (ریال)</th><th className="p-3">وضعیت</th><th className="p-3">عملیات</th></tr></thead><tbody>{getAllGuarantees().map((g, i) => (<tr key={i} className="border-b hover:bg-gray-50"><td className="p-3">{g.type}</td><td className="p-3">{g.number}<br/><span className="text-xs text-gray-500">{g.bank}</span></td><td className="p-3 font-mono">{formatCurrency(g.amount)}</td><td className="p-3"><button onClick={g.toggleFunc} className={`text-xs px-2 py-1 rounded font-bold ${g.isDelivered ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{g.isDelivered ? 'عودت شد' : 'نزد سازمان'}</button></td><td className="p-3"></td></tr>))}</tbody></table></div></div>
                                        </div>

                                        <div className="bg-white p-6 rounded-xl shadow-sm border mt-6">
                                            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><PieChart size={20} className="text-green-600"/> قیمت تمام شده به تفکیک کالا</h3>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm text-right">
                                                    <thead className="bg-gray-100 text-gray-700">
                                                        <tr>
                                                            <th className="p-3">ردیف</th>
                                                            <th className="p-3">شرح کالا</th>
                                                            <th className="p-3">وزن (KG)</th>
                                                            <th className="p-3">فی ارزی (خرید)</th>
                                                            <th className="p-3 text-blue-800 bg-blue-50">فی ارزی نهایی (با حمل)</th>
                                                            <th className="p-3 font-bold">قیمت تمام شده (ریال)</th>
                                                            <th className="p-3 bg-gray-50 font-bold">فی تمام شده (هر کیلو)</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {selectedRecord.items.map((item, idx) => {
                                                            // 1. Calculate Item Share of Freight in Currency based on weight
                                                            const itemFreightShareCurrency = item.weight * freightPerKgCurrency;
                                                            
                                                            // 2. Adjusted Item Total Price in Currency
                                                            const itemAdjustedTotalPriceCurrency = item.totalPrice + itemFreightShareCurrency;
                                                            
                                                            // 3. Final Cost in Rial = Adjusted Currency Total * Effective Rate
                                                            const itemFinalCostRial = itemAdjustedTotalPriceCurrency * effectiveRate;
                                                            
                                                            // 4. Per Kg
                                                            const itemFinalCostPerKg = item.weight > 0 ? itemFinalCostRial / item.weight : 0;
                                                            
                                                            // Display: Unit Price Adjusted
                                                            const itemAdjustedUnitPriceCurrency = item.weight > 0 ? itemAdjustedTotalPriceCurrency / item.weight : 0;

                                                            return (
                                                                <tr key={item.id} className="border-b hover:bg-gray-50">
                                                                    <td className="p-3 text-center">{idx + 1}</td>
                                                                    <td className="p-3 font-bold">{item.name}</td>
                                                                    <td className="p-3 font-mono">{formatNumberString(item.weight)}</td>
                                                                    <td className="p-3 font-mono">{formatNumberString(item.unitPrice)}</td>
                                                                    <td className="p-3 font-mono text-blue-800 bg-blue-50/30 font-bold">{formatNumberString(itemAdjustedUnitPriceCurrency)}</td>
                                                                    <td className="p-3 font-mono font-bold text-rose-700">{formatCurrency(itemFinalCostRial)}</td>
                                                                    <td className="p-3 font-mono font-bold bg-gray-50">{formatCurrency(itemFinalCostPerKg)}</td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Default Dashboard View
    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <Container className="text-blue-600" /> پرونده‌های بازرگانی
                    </h1>
                    <div className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                        <button onClick={goRoot} className="hover:text-blue-600 flex items-center gap-1"><Home size={14}/> خانه</button>
                        {selectedCompany && <><ChevronRight size={14}/> <button onClick={() => goCompany(selectedCompany)} className="hover:text-blue-600">{selectedCompany}</button></>}
                        {selectedGroup && <><ChevronRight size={14}/> <span>{selectedGroup}</span></>}
                    </div>
                </div>
                <div className="flex gap-3">
                    <div className="relative">
                        <input className="border rounded-xl pl-8 pr-3 py-2 text-sm w-48 focus:w-64 transition-all" placeholder="جستجو..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        <Search className="absolute left-2 top-2.5 text-gray-400" size={16} />
                    </div>
                    {/* ADDED BUTTON HERE */}
                    <button 
                        onClick={() => setShowArchived(!showArchived)} 
                        className={`px-4 py-2 rounded-xl flex items-center gap-2 font-bold transition-colors border ${showArchived ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                    >
                        <Archive size={20} />
                        {showArchived ? 'نمایش جاری' : 'نمایش بایگانی'}
                    </button>
                    {/* END ADDED BUTTON */}
                    <button onClick={() => setViewMode('reports')} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-gray-50 font-bold transition-colors">
                        <FileSpreadsheet size={20} /> گزارشات
                    </button>
                    <button onClick={() => setShowNewModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-bold transition-colors shadow-lg shadow-blue-600/20">
                        <Plus size={20} /> ثبت پرونده جدید
                    </button>
                </div>
            </div>

            {/* Dashboard Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {navLevel !== 'GROUP' ? (
                    groupedData.map((item: any) => (
                        <div key={item.name} onClick={() => item.type === 'company' ? goCompany(item.name) : goGroup(item.name)} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer group relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-2 h-full bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className="flex justify-between items-center mb-4">
                                <div className="bg-blue-50 p-3 rounded-xl text-blue-600 group-hover:scale-110 transition-transform">
                                    {item.type === 'company' ? <Building2 size={24} /> : <Package size={24} />}
                                </div>
                                <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-bold">{item.count} پرونده</span>
                            </div>
                            <h3 className="font-bold text-gray-800 text-lg mb-1">{item.name}</h3>
                            <p className="text-xs text-gray-500">کلیک برای مشاهده جزئیات</p>
                        </div>
                    ))
                ) : (
                    records
                        .filter(r => (showArchived ? r.isArchived : !r.isArchived) && (r.company === selectedCompany) && (r.commodityGroup === selectedGroup) && (r.goodsName.includes(searchTerm) || r.fileNumber.includes(searchTerm)))
                        .map(record => (
                            <div key={record.id} onClick={() => { setSelectedRecord(record); setViewMode('details'); setActiveTab('timeline'); }} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer group border-l-4 border-l-transparent hover:border-l-blue-500 relative">
                                {/* DELETE BUTTON ADDED HERE - Moved to Right to avoid status overlap */}
                                <button 
                                    onClick={(e) => handleDeleteRecord(record.id, e)} 
                                    className="absolute top-4 right-4 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all z-10"
                                    title="حذف پرونده"
                                >
                                    <Trash2 size={18}/>
                                </button>

                                <div className="flex justify-between items-start mb-3">
                                    <h3 className="font-bold text-gray-800 line-clamp-1 pr-8" title={record.goodsName}>{record.goodsName}</h3>
                                    <span className={`text-[10px] px-2 py-1 rounded-lg ${record.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-blue-700'}`}>{record.status === 'Completed' ? 'تکمیل شده' : 'جاری'}</span>
                                </div>
                                <div className="space-y-1.5 text-xs text-gray-500">
                                    <div className="flex items-center gap-1"><FolderOpen size={12} /> پرونده: <span className="font-mono text-gray-700 font-bold">{record.fileNumber}</span></div>
                                    <div className="flex items-center gap-1"><Building2 size={12} /> فروشنده: <span className="text-gray-700">{record.sellerName}</span></div>
                                    <div className="flex items-center gap-1"><History size={12} /> شروع: <span>{new Date(record.startDate).toLocaleDateString('fa-IR')}</span></div>
                                </div>
                            </div>
                        ))
                )}
            </div>
            
            {/* New Record Modal */}
            {showNewModal && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-scale-in">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-xl text-gray-800">ثبت پرونده جدید</h3>
                            <button onClick={() => setShowNewModal(false)}><X size={24} className="text-gray-400 hover:text-red-500" /></button>
                        </div>
                        <div className="space-y-4">
                            <div><label className="block text-sm font-bold text-gray-700 mb-1">شماره پرونده</label><input className="w-full border rounded-xl p-3 bg-gray-50 font-mono text-left dir-ltr" value={newFileNumber} onChange={e => setNewFileNumber(e.target.value)} placeholder="File No..." /></div>
                            <div><label className="block text-sm font-bold text-gray-700 mb-1">نام کالا (شرح کلی)</label><input className="w-full border rounded-xl p-3" value={newGoodsName} onChange={e => setNewGoodsName(e.target.value)} placeholder="مثال: قطعات یدکی..." /></div>
                            <div><label className="block text-sm font-bold text-gray-700 mb-1">فروشنده</label><input className="w-full border rounded-xl p-3" value={newSellerName} onChange={e => setNewSellerName(e.target.value)} placeholder="Seller Name..." /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-bold text-gray-700 mb-1">گروه کالایی</label><input list="commodity-groups" className="w-full border rounded-xl p-3" value={newCommodityGroup} onChange={e => setNewCommodityGroup(e.target.value)} placeholder="انتخاب..." /><datalist id="commodity-groups">{commodityGroups.map(g => <option key={g} value={g} />)}</datalist></div>
                                <div><label className="block text-sm font-bold text-gray-700 mb-1">ارز پایه</label><select className="w-full border rounded-xl p-3 bg-white" value={newMainCurrency} onChange={e => setNewMainCurrency(e.target.value)}>{CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}</select></div>
                            </div>
                            <div><label className="block text-sm font-bold text-gray-700 mb-1">شرکت</label><select className="w-full border rounded-xl p-3 bg-white" value={newRecordCompany} onChange={e => setNewRecordCompany(e.target.value)}><option value="">انتخاب شرکت...</option>{availableCompanies.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                            <button onClick={handleCreateRecord} disabled={!newFileNumber || !newGoodsName || !newRecordCompany} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-600/20 mt-4 disabled:opacity-50 transition-all">ایجاد پرونده</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TradeModule;
