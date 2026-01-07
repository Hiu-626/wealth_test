import React, { createContext, useContext, useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// --- 1. 定義 Firebase 資料的 Context ---
export const SyncContext = createContext<{
  data: any;
  userPwd: string | null;
  setPwd: (pwd: string) => void;
}>({ data: null, userPwd: null, setPwd: () => {} });

const RootProvider = ({ children }: { children: React.ReactNode }) => {
  const [data, setData] = useState(null);
  const [userPwd, setUserPwd] = useState<string | null>(localStorage.getItem('wealth_pwd'));

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    let retryTimer: number | null = null;

    const setupSync = () => {
      // 從 window 取得 HTML 注入的實例
      const { firebaseDB, firebaseRef, firebaseOnValue } = window as any;

      // 檢查 Firebase 是否真的準備好了
      if (userPwd && firebaseDB && firebaseOnValue && firebaseRef) {
        try {
          const statusRef = firebaseRef(firebaseDB, `users/${userPwd}/current_status`);
          
          unsubscribe = firebaseOnValue(statusRef, (snapshot: any) => {
            const val = snapshot.val();
            if (val) {
              console.log("✅ Firebase 同步成功，收到數據:", val);
              setData(val);
            }
          });
          
          if (retryTimer) clearInterval(retryTimer);
          console.log("📡 監聽器已掛載至路徑:", `users/${userPwd}/current_status`);
        } catch (err) {
          console.error("❌ 設置監聽器時發生錯誤:", err);
        }
      } else {
        // 如果 Firebase 還沒準備好，每 500ms 檢查一次 (最多重試，直到成功)
        if (!retryTimer) {
          console.warn("⏳ Firebase 尚未就緒，正在等待初始化...");
          retryTimer = window.setInterval(setupSync, 500);
        }
      }
    };

    setupSync();

    // 清理函數：卸載時清除監聽器和定時器
    return () => {
      if (unsubscribe) unsubscribe();
      if (retryTimer) clearInterval(retryTimer);
    };
  }, [userPwd]);

  const setPwd = (pwd: string) => {
    localStorage.setItem('wealth_pwd', pwd);
    setUserPwd(pwd);
  };

  return (
    <SyncContext.Provider value={{ data, userPwd, setPwd }}>
      {children}
    </SyncContext.Provider>
  );
};

// --- 2. 標準 React 19 掛載 (保持原樣且不簡化) ---
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("