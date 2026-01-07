import React, { createContext, useContext, useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// --- 1. 定義 Firebase 資料的 Context ---
// 確保導出 SyncContext 供 App.tsx 使用
export const SyncContext = createContext<{
  data: any;
  userPwd: string | null;
  setPwd: (pwd: string) => void;
}>({ data: null, userPwd: null, setPwd: () => {} });

const RootProvider = ({ children }: { children: React.ReactNode }) => {
  const [data, setData] = useState<any>(null);
  const [userPwd, setUserPwd] = useState<string | null>(localStorage.getItem('wealth_pwd'));

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    let retryInterval: any = null;

    const setupSync = () => {
      // 1. 從 window 取得 index.html 注入的實例
      const { firebaseDB, firebaseRef, firebaseOnValue } = window as any;

      // 2. 檢查 Firebase 是否準備就緒且已輸入密碼
      if (userPwd && firebaseDB && firebaseOnValue && firebaseRef) {
        // 如果已經在重試，清除定時器
        if (retryInterval) {
          clearInterval(retryInterval);
          retryInterval = null;
        }

        try {
          // 修正路徑確保正確指向用戶資料夾
          const statusRef = firebaseRef(firebaseDB, `users/${userPwd}/current_status`);
          
          console.log(`📡 正在嘗試監聽 Firebase 路徑: users/${userPwd}/current_status`);
          
          unsubscribe = firebaseOnValue(statusRef, (snapshot: any) => {
            const val = snapshot.val();
            // 關鍵修正：即使 val 是 null (新用戶)，也要執行 setData
            // 這樣 App.tsx 才知道同步檢查已經完成
            console.log("✅ Firebase 同步回傳:", val ? "找到數據" : "全新用戶(無數據)");
            setData(val || { _isNewUser: true }); 
          }, (error: any) => {
            console.error("❌ Firebase 讀取權限錯誤:", error);
          });

        } catch (err) {
          console.error("❌ 設置監聽器失敗:", err);
        }
      } else if (userPwd && !retryInterval) {
        // 如果有密碼但 Firebase 還沒 Ready，每 500ms 檢查一次
        console.warn("⏳ Firebase 實例尚未就緒，500ms 後重試...");
        retryInterval = setInterval(setupSync, 500);
      }
    };

    setupSync();

    // 清理函數
    return () => {
      if (unsubscribe) {
        console.log("🔌 正在卸載 Firebase 監聽器");
        unsubscribe();
      }
      if (retryInterval) clearInterval(retryInterval);
    };
  }, [userPwd]);

  const setPwd = (pwd: string) => {
    console.log("🔐 設定新密碼:", pwd);
    localStorage.setItem('wealth_pwd', pwd);
    setUserPwd(pwd);
  };

  return (
    <SyncContext.Provider value={{ data, userPwd, setPwd }}>
      {children}
    </SyncContext.Provider>
  );
};

// --- 2. 標準 React 19 掛載 ---
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("找不到 root 節點，請檢查 index.html 是否包含 <div id='root'></div>");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <RootProvider>
      <App />
    </RootProvider>
  </React.StrictMode>
);