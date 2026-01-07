import React, { useState, useEffect, useContext, useCallback } from 'react';
import { AppState, ViewState, Account, FixedDeposit } from './types';
import { getStoredData, saveStoredData, calculateTotalWealthHKD } from './services/storageService';
import { SyncContext } from './index'; 
import Layout from './components/Layout';
import Overview from './components/Overview';
import UpdatePage from './components/UpdatePage';
import Insights from './components/Insights';
import FDManager from './components/FDManager';
import { 
  RefreshCw, 
  CloudCheck, 
  CloudOff, 
  ShieldCheck, 
  Lock, 
  ChevronRight,
  Database
} from 'lucide-react';

const App: React.FC = () => {
  const { data: cloudData, userPwd, setPwd } = useContext(SyncContext);
  
  // --- 1. 初始加載 (Lazy Initialization) ---
  // 使用 callback 形式的 useState，確保組件掛載時立即讀取 LocalStorage
  // 這避免了 useEffect 異步執行導致的 "Loading..." 畫面卡住問題
  const [data, setData] = useState<AppState | null>(() => {
    try {
      return getStoredData();
    } catch (e) {
      console.error("Critical: Failed to load initial data", e);
      return null;
    }
  });

  const [currentView, setCurrentView] = useState<ViewState>('overview');
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'offline'>('synced');
  const [inputPwd, setInputPwd] = useState('');

  // --- 2. 雲端數據同步 ---
  // 當收到新的雲端數據時，與本地數據比對時間戳，若雲端較新則覆蓋
  useEffect(() => {
    if (cloudData) {
      const isCloudNewer = !data || (
        cloudData.lastUpdated && 
        (!data.lastUpdated || new Date(cloudData.lastUpdated) > new Date(data.lastUpdated))
      );

      // 嚴格比對內容差異，避免不必要的重渲染循環
      if (isCloudNewer && JSON.stringify(cloudData) !== JSON.stringify(data)) {
        console.log("📲 Applying cloud update...");
        setData(cloudData);
        saveStoredData(cloudData);
      }
    }
  }, [cloudData, data]);

  // --- 3. 登入介面 ---
  if (!userPwd) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
        <div className="w-20 h-20 bg-[#0052CC] rounded-[2rem] shadow-xl shadow-blue-100 flex items-center justify-center mb-8 rotate-3 transition-transform hover:rotate-6">
          <Lock className="text-white w-10 h-10" />
        </div>
        <h1 className="text-3xl font-black text-gray-900 mb-2 tracking-tight">WealthSnapshot</h1>
        <p className="text-gray-500 mb-10 font-medium text-sm tracking-wide">請輸入您的存取密碼以啟用雲端同步</p>
        
        <div className="w-full max-w-sm space-y-4">
          <input
            type="password"
            value={inputPwd}
            onChange={(e) => setInputPwd(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && setPwd(inputPwd)}
            placeholder="請輸入密碼"
            className="w-full bg-white border-2 border-gray-100 px-6 py-4 rounded-2xl text-center text-xl font-mono tracking-widest focus:border-[#0052CC] focus:outline-none transition-all shadow-sm placeholder:tracking-normal placeholder:font-sans"
          />
          <button
            onClick={() => setPwd(inputPwd)}
            className="w-full bg-gray-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-black transition-colors active:scale-95"
          >
            登入並同步 <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        <div className="mt-12 flex items-center gap-2 text-gray-400 text-[10px] font-bold tracking-widest uppercase">
          <Database className="w-3 h-3" />
          <span>Secured by Firebase Singapore</span>
        </div>
      </div>
    );
  }

  // --- 4. 同步與資產更新函數 ---
  const calculateCorrectedTotalWealth = useCallback((accounts: Account[], fds: FixedDeposit[]) => {
    const effectiveFDs = fds.filter(fd => fd.type !== 'Savings');
    return calculateTotalWealthHKD(accounts, effectiveFDs);
  }, []);

  const triggerCloudSync = async (newState: AppState) => {
    setSyncStatus('syncing');
    const { firebaseDB, firebaseRef, firebaseSet } = window as any;
    
    // 1. Firebase Sync
    if (firebaseDB && firebaseRef && firebaseSet) {
      try {
        const userRef = firebaseRef(firebaseDB, `users/${userPwd}/current_status`);
        await firebaseSet(userRef, newState);
      } catch (e) { console.error("Firebase write error:", e); }
    }

    // 2. Google Script Backup
    try {
      const scriptUrl = "https://script.google.com/macros/s/AKfycbwUMlONXGA-3KqBo69Ml5y9zJS4VhhQBtewBNswG83uxZ6K9mE_zvnAUxlEvG7dOzrF/exec";
      fetch(scriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userPwd,
          assets: [
            ...newState.accounts.map(acc => ({ category: 'CASH', institution: acc.name, amount: acc.balance, currency: acc.currency })),
            ...newState.fixedDeposits.map(fd => ({ category: 'FD', symbol: fd.bankName, amount: fd.principal, currency: fd.currency }))
          ]
        })
      }).then(() => setSyncStatus('synced')).catch(() => setSyncStatus('offline'));
    } catch (error) { setSyncStatus('offline'); }
  };

  const updateStateAndSync = (newState: AppState) => {
    saveStoredData(newState);
    setData(newState);
    triggerCloudSync(newState);
  };

  const handleUpdateAccounts = (newAccounts: Account[]) => {
    if (!data) return;
    const totalWealth = calculateCorrectedTotalWealth(newAccounts, data.fixedDeposits);
    const todayStr = new Date().toISOString().slice(0, 7);
    const newHistory = [...(data.history || [])];
    const existingIndex = newHistory.findIndex(h => h.date === todayStr);
    if (existingIndex >= 0) newHistory[existingIndex] = { ...newHistory[existingIndex], totalValueHKD: totalWealth };
    else newHistory.push({ date: todayStr, totalValueHKD: totalWealth });

    const newState: AppState = { ...data, accounts: newAccounts, history: newHistory, lastUpdated: new Date().toISOString() };
    updateStateAndSync(newState);
    setCurrentView('overview');
  };

  const handleUpdateFDs = (newFDs: FixedDeposit[]) => {
    if (!data) return;
    const totalWealth = calculateCorrectedTotalWealth(data.accounts, newFDs);
    const todayStr = new Date().toISOString().slice(0, 7);
    const newHistory = [...(data.history || [])];
    const existingIndex = newHistory.findIndex(h => h.date === todayStr);
    if (existingIndex >= 0) newHistory[existingIndex] = { ...newHistory[existingIndex], totalValueHKD: totalWealth };
    else newHistory.push({ date: todayStr, totalValueHKD: totalWealth });

    const newState = { ...data, fixedDeposits: newFDs, history: newHistory, lastUpdated: new Date().toISOString() };
    updateStateAndSync(newState);
  };

  const handleSettleFD = (fdId: string, targetAccountId: string, finalAmount: number) => {
    if (!data) return;
    const newAccounts = data.accounts.map(acc => acc.id === targetAccountId ? { ...acc, balance: acc.balance + finalAmount } : acc);
    const newFDs = data.fixedDeposits.filter(fd => fd.id !== fdId);
    const totalWealth = calculateCorrectedTotalWealth(newAccounts, newFDs);
    const todayStr = new Date().toISOString().slice(0, 7);
    const newHistory = [...(data.history || [])];
    const existingIndex = newHistory.findIndex(h => h.date === todayStr);
    if (existingIndex >= 0) newHistory[existingIndex] = { ...newHistory[existingIndex], totalValueHKD: totalWealth };
    else newHistory.push({ date: todayStr, totalValueHKD: totalWealth });

    const newState: AppState = { ...data, accounts: newAccounts, fixedDeposits: newFDs, history: newHistory, lastUpdated: new Date().toISOString() };
    updateStateAndSync(newState);
  };

  const handleUpdateGoal = (newGoal: number) => {
    if (!data) return;
    const newState = { ...data, wealthGoal: newGoal };
    updateStateAndSync(newState);
  };

  if (!data) {
    // 萬一 lazy init 失敗 (極少見)，提供一個重置按鈕
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[#F8F9FA] p-6 text-center">
        <RefreshCw className="h-10 w-10 animate-spin text-[#0052CC] mb-4" />
        <div className="text-[#0052CC] font-bold text-lg mb-4">正在載入數據...</div>
        <button 
           onClick={() => {
             localStorage.removeItem('wealth_snapshot_v1');
             window.location.reload();
           }}
           className="text-xs text-red-400 underline"
        >
          如果卡住太久，點此重置數據
        </button>
      </div>
    );
  }

  return (
    <Layout currentView={currentView} onNavigate={setCurrentView}>
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-1.5 bg-white/90 backdrop-blur-md border-b border-gray-100 text-[10px] uppercase tracking-[0.15em] font-black text-gray-400 transition-all">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-3 w-3 text-green-500" />
          <span className="truncate max-w-[80px]">USER: {userPwd}</span>
        </div>
        <div className="flex items-center gap-2">
          {syncStatus === 'syncing' && <><RefreshCw className="h-2.5 w-2.5 animate-spin" /> Updating</>}
          {syncStatus === 'synced' && <><CloudCheck className="h-3 w-3 text-blue-500" /> Synced</>}
          {syncStatus === 'offline' && <><CloudOff className="h-3 w-3 text-red-400" /> Offline</>}
        </div>
      </div>

      <div className="pt-8 animate-in fade-in duration-300">
        {currentView === 'overview' && <Overview key={data.lastUpdated} accounts={data.accounts} fixedDeposits={data.fixedDeposits} lastUpdated={data.lastUpdated} onNavigateToFD={() => setCurrentView('fd-manager')} onNavigateToUpdate={() => setCurrentView('update')} />}
        {currentView === 'update' && <UpdatePage accounts={data.accounts} onSave={handleUpdateAccounts} />}
        {currentView === 'insights' && <Insights accounts={data.accounts} fixedDeposits={data.fixedDeposits} history={data.history} wealthGoal={data.wealthGoal || 2000000} onUpdateGoal={handleUpdateGoal} />}
        {currentView === 'fd-manager' && <FDManager fds={data.fixedDeposits} accounts={data.accounts} onUpdate={handleUpdateFDs} onSettle={handleSettleFD} onBack={() => setCurrentView('overview')} />}
      </div>
    </Layout>
  );
};

export default App;