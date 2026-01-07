import React, { createContext, useContext, useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// --- 1. 定義 Firebase 資料的 Context ---
// 這樣你的 App 內任何地方都能存取同步數據
export const SyncContext = createContext<{
  data: any;
  userPwd: string | null;
  setPwd: (pwd: string) => void;
}>({ data: null, userPwd: null, setPwd: () => {} });

const RootProvider = ({ children }: { children: React.ReactNode }) => {
  const [data, setData] = useState(null);
  const [userPwd, setUserPwd] = useState<string | null>(localStorage.getItem('wealth_pwd'));

  useEffect(() => {
    // 檢查 window 是否已載入 HTML 中定義的 Firebase 工具
    const { firebaseDB, firebaseRef, firebaseOnValue } = window as any;

    if (userPwd && firebaseDB && firebaseOnValue) {
      // 監聽路徑：users/你的密碼/current_status
      const statusRef = firebaseRef(firebaseDB, `users/${userPwd}/current_status`);
      
      const unsubscribe = firebaseOnValue(statusRef, (snapshot: any) => {
        const val = snapshot.val();
        if (val) {
          console.log("Firebase 同步成功:", val);
          setData(val);
        }
      });

      return () => unsubscribe(); // 組件卸載時停止監聽
    }
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
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <RootProvider>
      <App />
    </RootProvider>
  </React.StrictMode>
);