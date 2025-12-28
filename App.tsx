
import React, { useState, useEffect, useRef } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import CreateOrder from './components/CreateOrder';
import ManageOrders from './components/ManageOrders';
import Login from './components/Login';
import ManageUsers from './components/ManageUsers';
import Settings from './components/Settings';
import ChatRoom from './components/ChatRoom';
import TradeModule from './components/TradeModule';
import CreateExitPermit from './components/CreateExitPermit'; 
import ManageExitPermits from './components/ManageExitPermits'; 
import WarehouseModule from './components/WarehouseModule';
import SecurityModule from './components/SecurityModule'; 
import PrintVoucher from './components/PrintVoucher'; 
import { getOrders, getSettings } from './services/storageService';
import { getCurrentUser, getUsers } from './services/authService';
import { PaymentOrder, User, OrderStatus, UserRole, AppNotification, SystemSettings, PaymentMethod } from './types';
import { Loader2, Bell, X } from 'lucide-react';
import { sendNotification, isNotificationEnabledInApp } from './services/notificationService';
import { generateUUID, parsePersianDate, formatCurrency } from './constants';
import { apiCall } from './services/apiService';

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTabState] = useState('dashboard');
  const [orders, setOrders] = useState<PaymentOrder[]>([]);
  const [settings, setSettings] = useState<SystemSettings | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [manageOrdersInitialTab, setManageOrdersInitialTab] = useState<'current' | 'archive'>('current');
  const [dashboardStatusFilter, setDashboardStatusFilter] = useState<any>(null); 
  const [exitPermitStatusFilter, setExitPermitStatusFilter] = useState<'pending' | null>(null);

  // Toast Notification State
  const [toast, setToast] = useState<{show: boolean, title: string, message: string} | null>(null);
  const toastTimeoutRef = useRef<any>(null);

  // Background Job Queue
  const [backgroundJobs, setBackgroundJobs] = useState<{order: PaymentOrder, type: 'create' | 'approve'}[]>([]);
  const processingJobRef = useRef(false);

  const isFirstLoad = useRef(true);
  const idleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const IDLE_LIMIT = 60 * 60 * 1000; 
  const NOTIFICATION_CHECK_KEY = 'last_notification_check';

  const safePushState = (state: any, title: string, url?: string) => { try { if (url) window.history.pushState(state, title, url); else window.history.pushState(state, title); } catch (e) { try { window.history.pushState(state, title); } catch(e2) {} } };
  const safeReplaceState = (state: any, title: string, url?: string) => { try { if (url) window.history.replaceState(state, title, url); else window.history.replaceState(state, title); } catch (e) { try { window.history.replaceState(state, title); } catch(e2) {} } };
  const setActiveTab = (tab: string, addToHistory = true) => { setActiveTabState(tab); if (addToHistory) safePushState({ tab }, '', `#${tab}`); };

  // --- BACKGROUND JOB LISTENER ---
  useEffect(() => {
      const handleJob = (e: CustomEvent) => {
          console.log("Job Received:", e.detail);
          setBackgroundJobs(prev => [...prev, e.detail]);
      };
      window.addEventListener('QUEUE_WHATSAPP_JOB' as any, handleJob);
      return () => window.removeEventListener('QUEUE_WHATSAPP_JOB' as any, handleJob);
  }, []);

  // --- BACKGROUND JOB PROCESSOR ---
  useEffect(() => {
      if (backgroundJobs.length > 0 && !processingJobRef.current) {
          processNextJob();
      }
  }, [backgroundJobs]);

  const processNextJob = async () => {
      processingJobRef.current = true;
      const job = backgroundJobs[0];
      const { order, type } = job;

      await new Promise(resolve => setTimeout(resolve, 1500));

      const element = document.getElementById(`bg-print-voucher-${order.id}`);
      if (element) {
          try {
              // @ts-ignore
              const canvas = await window.html2canvas(element, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
              const base64 = canvas.toDataURL('image/png').split(',')[1];
              
              const usersList = await getUsers();
              let targetUser: User | undefined;
              let caption = '';

              if (type === 'create') {
                  targetUser = usersList.find(u => u.role === UserRole.FINANCIAL && u.phoneNumber);
                  caption = `📢 *درخواست پرداخت جدید*\nشماره: ${order.trackingNumber}\nمبلغ: ${formatCurrency(order.totalAmount)}\nدرخواست کننده: ${order.requester}\n\nلطفا بررسی نمایید.`;
              } else if (type === 'approve') {
                  if (order.status === OrderStatus.APPROVED_FINANCE) {
                      targetUser = usersList.find(u => u.role === UserRole.MANAGER && u.phoneNumber);
                      caption = `✅ *تایید مالی انجام شد*\nشماره: ${order.trackingNumber}\nمنتظر تایید مدیریت.`;
                  } else if (order.status === OrderStatus.APPROVED_MANAGER) {
                      targetUser = usersList.find(u => u.role === UserRole.CEO && u.phoneNumber);
                      caption = `✅ *تایید مدیریت انجام شد*\nشماره: ${order.trackingNumber}\nمنتظر تایید نهایی مدیرعامل.`;
                  } else if (order.status === OrderStatus.APPROVED_CEO) {
                      targetUser = usersList.find(u => u.role === UserRole.FINANCIAL && u.phoneNumber);
                      caption = `💰 *دستور پرداخت تایید نهایی شد*\nشماره: ${order.trackingNumber}\nلطفا پرداخت نمایید.`;
                  }
              }

              if (targetUser && targetUser.phoneNumber) {
                  await apiCall('/send-whatsapp', 'POST', { 
                      number: targetUser.phoneNumber, 
                      message: caption, 
                      mediaData: { data: base64, mimeType: 'image/png', filename: `Order_${order.trackingNumber}.png` } 
                  });
              }

          } catch (e) {
              console.error("Background Job Failed", e);
          }
      }

      setBackgroundJobs(prev => prev.slice(1));
      processingJobRef.current = false;
  };

  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash && ['dashboard', 'create', 'manage', 'chat', 'trade', 'users', 'settings', 'create-exit', 'manage-exit', 'warehouse', 'security'].includes(hash)) {
        setActiveTabState(hash);
        safeReplaceState({ tab: hash }, '', `#${hash}`);
    } else {
        safeReplaceState({ tab: 'dashboard' }, '', '#dashboard');
    }
    const handlePopState = (event: PopStateEvent) => { if (event.state && event.state.tab) setActiveTabState(event.state.tab); else setActiveTabState('dashboard'); };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => { const user = getCurrentUser(); if (user) setCurrentUser(user); }, []);

  const handleLogout = () => { setCurrentUser(null); isFirstLoad.current = true; if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current); };

  useEffect(() => {
    if (currentUser) {
        const resetIdleTimer = () => {
            if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
            idleTimeoutRef.current = setTimeout(() => { handleLogout(); alert("به دلیل عدم فعالیت به مدت ۱ ساعت، از سیستم خارج شدید."); }, IDLE_LIMIT);
        };
        const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
        events.forEach(event => window.addEventListener(event, resetIdleTimer));
        resetIdleTimer();
        return () => { events.forEach(event => window.removeEventListener(event, resetIdleTimer)); if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current); };
    }
  }, [currentUser]);

  // --- SOUND EFFECT ---
  const playNotificationSound = () => {
      // Play sound regardless of preference to ensure user hears it if they are in app
      // Browser policy might block this if no interaction, but we try anyway.
      try {
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'); 
          audio.volume = 1.0;
          audio.play().catch(e => console.log("Audio play blocked by browser policy (interaction needed)"));
      } catch (e) { }
  };

  // --- UNIFIED NOTIFICATION HANDLER ---
  const addAppNotification = (title: string, message: string) => { 
      // 1. In-App List (Bell Icon)
      setNotifications(prev => [{ id: generateUUID(), title, message, timestamp: Date.now(), read: false }, ...prev]); 
      
      // 2. Sound
      playNotificationSound();

      // 3. Show Toast (Floating Alert) - Guaranteed Visibility
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      setToast({ show: true, title, message });
      toastTimeoutRef.current = setTimeout(() => setToast(null), 5000); // Hide after 5s

      // 4. Browser Notification (System Push via Service Worker)
      sendNotification(title, message);
  };

  const closeToast = () => {
      setToast(null);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
  };

  const loadData = async (silent = false) => {
    if (!currentUser) return;
    if (!silent) setLoading(true);
    try {
        const [ordersData, settingsData] = await Promise.all([getOrders(), getSettings()]);
        setSettings(settingsData);
        const lastCheck = parseInt(localStorage.getItem(NOTIFICATION_CHECK_KEY) || '0');
        checkForNotifications(ordersData, currentUser, lastCheck);
        if (isFirstLoad.current) { checkChequeAlerts(ordersData); }
        localStorage.setItem(NOTIFICATION_CHECK_KEY, Date.now().toString());
        setOrders(ordersData);
        isFirstLoad.current = false;
    } catch (error) { console.error("Failed to load data", error); } finally { if (!silent) setLoading(false); }
  };

  const checkChequeAlerts = (list: PaymentOrder[]) => {
      const now = new Date();
      let alertCount = 0;
      list.forEach(order => {
          order.paymentDetails.forEach(detail => {
              if (detail.method === PaymentMethod.CHEQUE && detail.chequeDate) {
                  const dueDate = parsePersianDate(detail.chequeDate);
                  if (dueDate) {
                      const diffTime = dueDate.getTime() - now.getTime();
                      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                      if (diffDays <= 2 && diffDays >= 0) { alertCount++; }
                  }
              }
          });
      });
      if (alertCount > 0) { addAppNotification('هشدار سررسید چک', `${alertCount} چک در ۲ روز آینده سررسید می‌شوند.`); }
  };

  const checkForNotifications = (newList: PaymentOrder[], user: User, lastCheckTime: number) => {
     const newEvents = newList.filter(o => o.updatedAt && o.updatedAt > lastCheckTime);
     
     newEvents.forEach(newItem => {
        const status = newItem.status;
        const isAdmin = user.role === UserRole.ADMIN;
        
        if (isAdmin) {
             const isAdminSelfChange = (status === OrderStatus.PENDING && newItem.requester === user.fullName); 
             if (!isAdminSelfChange) { addAppNotification(`تغییر وضعیت (${newItem.trackingNumber})`, `وضعیت جدید: ${status}`); }
        }
        
        if (status === OrderStatus.PENDING && user.role === UserRole.FINANCIAL) { addAppNotification('درخواست پرداخت جدید', `شماره: ${newItem.trackingNumber} | درخواست کننده: ${newItem.requester}`); }
        else if (status === OrderStatus.APPROVED_FINANCE && user.role === UserRole.MANAGER) { addAppNotification('تایید مالی شد', `درخواست ${newItem.trackingNumber} منتظر تایید مدیریت است.`); }
        else if (status === OrderStatus.APPROVED_MANAGER && user.role === UserRole.CEO) { addAppNotification('تایید مدیریت شد', `درخواست ${newItem.trackingNumber} منتظر تایید نهایی شماست.`); }
        else if (status === OrderStatus.APPROVED_CEO) { if (user.role === UserRole.FINANCIAL) { addAppNotification('تایید نهایی شد (پرداخت)', `درخواست ${newItem.trackingNumber} تایید شد. لطفا اقدام به پرداخت کنید.`); } if (newItem.requester === user.fullName) { addAppNotification('درخواست تایید شد', `درخواست شما (${newItem.trackingNumber}) تایید نهایی شد.`); } }
        else if (status === OrderStatus.REJECTED && newItem.requester === user.fullName) { addAppNotification('درخواست رد شد', `درخواست ${newItem.trackingNumber} رد شد. دلیل: ${newItem.rejectionReason || 'نامشخص'}`); }
     });
  };

  useEffect(() => { if (currentUser) { loadData(false); const intervalId = setInterval(() => loadData(true), 15000); return () => clearInterval(intervalId); } }, [currentUser]);

  const handleOrderCreated = () => { loadData(); setManageOrdersInitialTab('current'); setDashboardStatusFilter(null); setActiveTab('manage'); };
  const handleLogin = (user: User) => { setCurrentUser(user); setActiveTab('dashboard'); };
  const handleViewArchive = () => { setManageOrdersInitialTab('archive'); setDashboardStatusFilter(null); setActiveTab('manage'); };
  const handleDashboardFilter = (status: any) => { setDashboardStatusFilter(status); setManageOrdersInitialTab('current'); setActiveTab('manage'); };

  const handleGoToPaymentApprovals = () => {
      let filter: any = 'pending_all';
      if (currentUser?.role === UserRole.FINANCIAL) filter = 'cartable_financial';
      else if (currentUser?.role === UserRole.MANAGER) filter = 'cartable_manager';
      else if (currentUser?.role === UserRole.CEO) filter = 'cartable_ceo';
      setDashboardStatusFilter(filter);
      setManageOrdersInitialTab('current');
      setActiveTab('manage');
  };

  const handleGoToExitApprovals = () => {
      setExitPermitStatusFilter('pending');
      setActiveTab('manage-exit');
  };

  const [warehouseInitialTab, setWarehouseInitialTab] = useState<'dashboard' | 'approvals'>('dashboard');
  const handleGoToWarehouseApprovals = () => {
      setWarehouseInitialTab('approvals');
      setActiveTab('warehouse');
  };

  if (!currentUser) return <Login onLogin={handleLogin} />;

  return (
    <Layout 
      activeTab={activeTab} 
      setActiveTab={(t) => { setActiveTab(t); if(t!=='warehouse') setWarehouseInitialTab('dashboard'); if(t!=='manage-exit') setExitPermitStatusFilter(null); if(t!=='manage') setDashboardStatusFilter(null); }} 
      currentUser={currentUser} 
      onLogout={handleLogout} 
      notifications={notifications} 
      clearNotifications={() => setNotifications([])}
      onAddNotification={addAppNotification} 
    >
      
      {/* Toast Notification Component */}
      {toast && toast.show && (
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[9999] bg-white border-l-4 border-blue-600 shadow-2xl rounded-lg p-4 flex items-start gap-4 min-w-[300px] max-w-sm animate-slide-down" onClick={closeToast}>
              <div className="bg-blue-100 p-2 rounded-full text-blue-600">
                  <Bell size={20} className="animate-pulse" />
              </div>
              <div className="flex-1">
                  <h4 className="font-bold text-gray-800 text-sm mb-1">{toast.title}</h4>
                  <p className="text-xs text-gray-600 leading-relaxed">{toast.message}</p>
              </div>
              <button onClick={(e) => { e.stopPropagation(); closeToast(); }} className="text-gray-400 hover:text-red-500">
                  <X size={16} />
              </button>
          </div>
      )}

      {backgroundJobs.length > 0 && (
          <div className="hidden-print-export" style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
              <div id={`bg-print-voucher-${backgroundJobs[0].order.id}`}>
                  <PrintVoucher order={backgroundJobs[0].order} embed settings={settings || undefined} />
              </div>
          </div>
      )}

      {loading && orders.length === 0 ? ( <div className="flex h-[50vh] items-center justify-center text-blue-600"><Loader2 size={48} className="animate-spin" /></div> ) : (
        <>
            {activeTab === 'dashboard' && 
                <Dashboard 
                    orders={orders} 
                    settings={settings} 
                    currentUser={currentUser} 
                    onViewArchive={handleViewArchive} 
                    onFilterByStatus={handleDashboardFilter}
                    onGoToPaymentApprovals={handleGoToPaymentApprovals}
                    onGoToExitApprovals={handleGoToExitApprovals}
                    onGoToBijakApprovals={handleGoToWarehouseApprovals}
                />
            }
            {activeTab === 'create' && <CreateOrder onSuccess={handleOrderCreated} currentUser={currentUser} />}
            {activeTab === 'manage' && <ManageOrders orders={orders} refreshData={() => loadData(true)} currentUser={currentUser} initialTab={manageOrdersInitialTab} settings={settings} statusFilter={dashboardStatusFilter} />}
            {activeTab === 'create-exit' && <CreateExitPermit onSuccess={() => setActiveTab('manage-exit')} currentUser={currentUser} />}
            {activeTab === 'manage-exit' && <ManageExitPermits currentUser={currentUser} settings={settings} statusFilter={exitPermitStatusFilter} />}
            {activeTab === 'warehouse' && <WarehouseModule currentUser={currentUser} settings={settings} initialTab={warehouseInitialTab} />}
            {activeTab === 'trade' && <TradeModule currentUser={currentUser} />}
            {activeTab === 'users' && <ManageUsers />}
            {activeTab === 'settings' && <Settings />}
            {activeTab === 'security' && <SecurityModule currentUser={currentUser} />}
            {activeTab === 'chat' && <ChatRoom currentUser={currentUser} onNotification={addAppNotification} />}
        </>
      )}
    </Layout>
  );
}
export default App;
