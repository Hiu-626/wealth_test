import React, { useState, useEffect, useContext, useCallback } from 'react';
import { AppState, ViewState, Account, FixedDeposit } from './types';
import { getStoredData, saveStoredData, calculateTotalWealthHKD } from './services/storageService';
import { SyncContext } from './index'; // 引入我們之前建立的同步 Context
import Layout from './components/Layout';
import Overview from './components/Overview';
import UpdatePage from './components/UpdatePage';
import Insights from './components/Insights';
import FDManager from './components/FDManager';
import { RefreshCw, CloudCheck, CloudOff, ShieldCheck } from 'lucide-react';

const App: React.FC = () => {
  // 從 Context 取得 Firebase 即時數據與帳戶資訊
  const { data: cloudData, userPwd, setPwd } = useContext(SyncContext);
  
  const [data, setData] = useState<AppState | null>(null);
  const [currentView, setCurrentView] = useState<ViewState>('overview');
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'offline'>('synced');

  // --- 初始加載 ---
  useEffect(() => {
    const loadedData = getStoredData();
    setData(loadedData);
  }, []);

  // --- 關鍵修復：自定義計算總資產函數 (保留你的原始邏輯) ---
  const calculateCorrectedTotalWealth = useCallback((accounts: Account[], fds: FixedDeposit[]) => {
    const effectiveFDs = fds.filter(fd => fd.type !== 'Savings');
    return calculateTotalWealthHKD(accounts, effectiveFDs);
  }, []);

  // --- 核心功能：同步至 Google Sheets & Firebase ---
  const triggerCloudSync = async (newState: AppState) => {
    if (!userPwd) return;
    setSyncStatus('syncing');
    
    try {
      // 1. 發送至 Google Apps Script (方案 B)
      const scriptUrl = "https://script.google.com/macros/s/AKfycbzxghw8YJtPrE8ft8eGpaZGiHk9K41CkOnKBWxGrfLwHdjwU72ADWuu7cItPFg-FSdhxg/exec";
      const response = await fetch(scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userPwd,
          assets: [
            ...newState.accounts.map(acc => ({ category: 'CASH', institution: acc.bank, amount: acc.balance, currency: acc.currency })),
            ...newState.fixedDeposits.map(fd => ({ category: 'STOCK', symbol: fd.bank, amount: fd.principal, currency: fd.currency }))
          ]
        })
      });

      if (response.ok) {
        setSyncStatus('synced');
      }
    } catch (error) {
      console.error("同步失敗:", error);
      setSyncStatus('offline');
    }
  };

  // --- 狀態更新封裝器 (處理儲存與同步) ---
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
    
    if (existingIndex >= 0) {
      newHistory[existingIndex] = { ...newHistory[existingIndex], totalValueHKD: totalWealth };
    } else {
      newHistory.push({ date: todayStr, totalValueHKD: totalWealth });
    }

    const newState: AppState = {
      ...data,
      accounts: newAccounts,
      history: newHistory,
      lastUpdated: new Date().toISOString()
    };
    updateStateAndSync(newState);
    setCurrentView('overview');
  };

  const handleUpdateFDs = (newFDs: FixedDeposit[]) => {
    if (!data) return;
    const totalWealth = calculateCorrectedTotalWealth(data.accounts, newFDs);
    const todayStr = new Date().toISOString().slice(0, 7);
    const newHistory = [...(data.history || [])];
    const existingIndex = newHistory.findIndex(h => h.date === todayStr);
    
    if (existingIndex >= 0) {
      newHistory[existingIndex] = { ...newHistory[existingIndex], totalValueHKD: totalWealth };
    } else {
      newHistory.push({ date: todayStr, totalValueHKD: totalWealth });
    }

    const newState = { ...data, fixedDeposits: newFDs, history: newHistory, lastUpdated: new Date().toISOString() };
    updateStateAndSync(newState);
  };

  const handleSettleFD = (fdId: string, targetAccountId: string, finalAmount: number) => {
    if (!data) return;
    const newAccounts = data.accounts.map(acc => acc.id === targetAccountId ? { ...acc, balance: acc.balance + finalAmount } : acc);
    const newFDs = data.fixedDeposits.filter(fd => fd.id !== fdId);
    const totalWealth = calculateCorrectedTotalWealth(newAccounts, newFDs);
    const todayStr = new Date().toISOString().slice(0, 7);
    const newHistory = [...data.history];
    const existingIndex = newHistory.findIndex(h => h.date === todayStr);
    
    if (existingIndex >= 0) {
      newHistory[existingIndex] = { ...newHistory[existingIndex], totalValueHKD: totalWealth };
    } else {
      newHistory.push({ date: todayStr, totalValueHKD: totalWealth });
    }

    const newState: AppState = { ...data, accounts: newAccounts, fixedDeposits: newFDs, history: newHistory, lastUpdated: new Date().toISOString() };
    updateStateAndSync(newState);
  };

  const handleUpdateGoal = (newGoal: number) => {
    if (!data) return;
    const newState = { ...data, wealthGoal: newGoal };
    updateStateAndSync(newState);
  };

  if (!data) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[#F8F9FA]">
        <RefreshCw className="h-10 w-10 animate-spin text-[#0052CC] mb-4" />
        <div className="text-[#0052CC] font-bold text-lg tracking-tight">WealthSnapshot Loading...</div>
      </div>
    );
  }

  return (
    <Layout currentView={currentView} onNavigate={setCurrentView}>
      {/* 專業頂部同步狀態條 */}
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-1 bg-white/80 backdrop-blur-md border-b border-gray-100 text-[10px] uppercase tracking-widest font-bold text-gray-500">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-3 w-3 text-green-500" />
          <span>Account: {userPwd || 'Guest'}</span>
        </div>
        <div className="flex items-center gap-2">
          {syncStatus === 'syncing' && <><RefreshCw className="h-3 w-3 animate-spin" /> Syncing</>}
          {syncStatus === 'synced' && <><CloudCheck className="h-3 w-3 text-blue-500" /> Cloud Secure</>}
          {syncStatus === 'offline' && <><CloudOff className="h-3 w-3 text-red-400" /> Offline Mode</>}
        </div>
      </div>

      <div className="pt-8"> {/* 為狀態條留出空間 */}
        {currentView === 'overview' && (
          <Overview 
            key={data.lastUpdated}
            accounts={data.accounts}
            fixedDeposits={data.fixedDeposits}
            lastUpdated={data.lastUpdated}
            onNavigateToFD={() => setCurrentView('fd-manager')}
            onNavigateToUpdate={() => setCurrentView('update')}
          />
        )}
        
        {currentView === 'update' && (
          <UpdatePage 
            accounts={data.accounts}
            onSave={handleUpdateAccounts}
          />
        )}
        
        {currentView === 'insights' && (
          <Insights 
            accounts={data.accounts}
            fixedDeposits={data.fixedDeposits}
            history={data.history}
            wealthGoal={data.wealthGoal || 2000000}
            onUpdateGoal={handleUpdateGoal}
          />
        )}

        {currentView === 'fd-manager' && (
          <FDManager 
            fds={data.fixedDeposits} 
            accounts={data.accounts}
            onUpdate={handleUpdateFDs}
            onSettle={handleSettleFD}
            onBack={() => setCurrentView('overview')}
          />
        )}
      </div>
    </Layout>
  );
};

export default App;