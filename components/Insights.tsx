import React, { useMemo, useState, useEffect } from 'react';
import { 
  Area, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  BarChart, Bar, AreaChart,
  PieChart, Pie, Cell
} from 'recharts';
import { Account, FixedDeposit, HistoricalDataPoint } from '../types';
import { MOCK_RATES } from '../constants';
import { 
  TrendingUp, CalendarClock, Zap, 
  ArrowRight, Trophy, AlertCircle, Coffee, 
  Briefcase, Landmark, Coins, Target, ChevronRight, Sparkles, FileText
} from 'lucide-react';
import MonthlyReport from './MonthlyReport';
import Confetti from './Confetti';

// --- 動畫數字組件 ---
const CountUp: React.FC<{ end: number; duration?: number; prefix?: string; suffix?: string; decimals?: number; className?: string }> = ({ 
  end, duration = 1500, prefix = '', suffix = '', decimals = 0, className = ''
}) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let start = 0;
    const increment = end / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) { clearInterval(timer); setCount(end); } 
      else { setCount(start); }
    }, 16);
    return () => clearInterval(timer);
  }, [end, duration]);
  return <span className={className}>{prefix}{count.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</span>;
};

interface InsightsProps {
  accounts: Account[];
  fixedDeposits: FixedDeposit[];
  history: HistoricalDataPoint[];
  wealthGoal: number;
  onUpdateGoal: (goal: number) => void;
}

const Insights: React.FC<InsightsProps> = ({ accounts, fixedDeposits, history, wealthGoal, onUpdateGoal }) => {
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [tempGoal, setTempGoal] = useState(wealthGoal.toString());
  
  // 假設每月基本開支 (可延伸為 Props)
  const monthlyExpenseBase = 15000;

  const toHKD = (amount: number, currency: string) => {
    if (currency === 'HKD') return amount;
    if (currency === 'AUD') return amount * MOCK_RATES.AUD;
    if (currency === 'USD') return amount * MOCK_RATES.USD;
    return amount;
  };

  const handleSaveGoal = () => {
    const val = parseFloat(tempGoal);
    if (val > 0) { onUpdateGoal(val); setIsEditingGoal(false); }
  };

  // --- 計算核心數據 ---
  const passiveData = useMemo(() => {
    const netWorth = history.length > 0 ? history[history.length - 1].totalValueHKD : 0;
    
    // 1. 定期收益
    const fdDetails = fixedDeposits.map(fd => ({
      name: fd.bankName,
      monthly: (toHKD(fd.principal, fd.currency) * ((fd.interestRate || 0) / 100) / 12),
      yield: fd.interestRate || 0,
      type: 'FD',
      currency: fd.currency,
      raw: fd
    }));
    const totalFDMonthly = fdDetails.reduce((sum, item) => sum + item.monthly, 0);

    // 2. 股票股息 (模擬計算)
    const stockDetails = accounts.filter(a => a.type === 'Stock').map(acc => {
      const yieldRate = acc.currency === 'USD' ? 1.5 : 4.5;
      return {
        name: acc.symbol || acc.name,
        monthly: (toHKD(acc.balance, acc.currency) * (yieldRate / 100) / 12),
        yield: yieldRate,
        type: 'Stock',
        currency: acc.currency,
        raw: acc
      };
    });
    const totalStockMonthly = stockDetails.reduce((sum, item) => sum + item.monthly, 0);

    // 3. 活期利息
    const cashReserve = accounts.filter(a => a.type === 'Cash').reduce((sum, acc) => sum + toHKD(acc.balance, acc.currency), 0);
    const totalCashMonthly = (cashReserve * 0.005 / 12); // 假設 0.5%

    const totalMonthly = totalFDMonthly + totalStockMonthly + totalCashMonthly;
    
    // 員工排名
    const employees = [...fdDetails, ...stockDetails].sort((a, b) => b.monthly - a.monthly);

    return {
      totalMonthly,
      totalFDMonthly,
      totalStockMonthly,
      totalCashMonthly,
      employees,
      netWorth,
      cashReserve,
      efficiencyScore: netWorth > 0 ? ((netWorth - cashReserve) / netWorth) * 100 : 0
    };
  }, [accounts, fixedDeposits, history]);

  // 模擬趨勢數據
  const yieldTrendData = useMemo(() => {
    return [
      { month: 'Oct', fd: 1200, stock: 800, cash: 100 },
      { month: 'Nov', fd: 1300, stock: 950, cash: 110 },
      { month: 'Dec', fd: 1300, stock: 1200, cash: 90 },
      { month: 'Jan', fd: 1500, stock: 1400, cash: 120 },
      { month: 'Feb', fd: 1800, stock: 1700, cash: 130 },
      { month: 'Mar', fd: passiveData.totalFDMonthly, stock: passiveData.totalStockMonthly, cash: passiveData.totalCashMonthly },
    ];
  }, [passiveData]);

  const coveragePercent = Math.min(100, (passiveData.totalMonthly / monthlyExpenseBase) * 100);
  const goalPercent = Math.min(100, (passiveData.netWorth / wealthGoal) * 100);

  return (
    <div className="p-6 pb-28 space-y-6 bg-gray-50/50 min-h-screen font-sans animate-in fade-in duration-500">
      <Confetti active={showConfetti} onComplete={() => setShowConfetti(false)} />

      {/* --- HEADER --- */}
      <div className="flex justify-between items-end mb-2">
        <div>
           <h1 className="text-3xl font-black text-gray-900 tracking-tighter">Insights</h1>
           <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Wealth Engine Status</p>
        </div>
        <button 
          onClick={() => setShowReport(true)}
          className="bg-white border border-gray-100 p-3 rounded-2xl shadow-sm text-blue-600 hover:scale-105 transition-transform active:scale-95"
        >
           <FileText className="w-5 h-5" />
        </button>
      </div>

      {/* --- MAIN CARD: PASSIVE INCOME ENGINE --- */}
      <section className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-blue-900/5 border border-white relative overflow-hidden group">
         <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
         
         <div className="relative z-10">
            <div className="flex items-center space-x-2 mb-4">
               <div className="p-2 bg-blue-50 rounded-xl">
                 <Zap className="w-5 h-5 text-blue-600 fill-current" />
               </div>
               <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Monthly Passive Income</span>
            </div>

            <div className="flex items-baseline space-x-1">
               <CountUp 
                  end={passiveData.totalMonthly} 
                  prefix="$" 
                  className="text-5xl font-black text-gray-800 tracking-tighter font-roboto" 
               />
               <span className="text-sm font-bold text-gray-400">/ mo</span>
            </div>

            <p className="mt-4 text-sm font-medium text-gray-500 leading-relaxed">
               Your assets work as hard as <span className="text-blue-600 font-black">{(passiveData.totalMonthly / 5000).toFixed(1)} full-time employees</span>.
            </p>
         </div>
         
         {/* Decorative Blur */}
         <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-blue-50 rounded-full blur-3xl opacity-50 group-hover:opacity-80 transition-opacity" />
      </section>

      {/* --- INCOME SOURCES BREAKDOWN --- */}
      <div className="grid grid-cols-3 gap-3">
         <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center space-y-2">
            <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center text-orange-500">
               <Landmark className="w-4 h-4" />
            </div>
            <div>
               <div className="text-[10px] font-black text-gray-400 uppercase">Fixed Dep.</div>
               <div className="text-sm font-black text-gray-800">${Math.round(passiveData.totalFDMonthly)}</div>
            </div>
         </div>
         <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center space-y-2">
            <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500">
               <TrendingUp className="w-4 h-4" />
            </div>
            <div>
               <div className="text-[10px] font-black text-gray-400 uppercase">Dividends</div>
               <div className="text-sm font-black text-gray-800">${Math.round(passiveData.totalStockMonthly)}</div>
            </div>
         </div>
         <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center space-y-2">
            <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500">
               <Coins className="w-4 h-4" />
            </div>
            <div>
               <div className="text-[10px] font-black text-gray-400 uppercase">Savings</div>
               <div className="text-sm font-black text-gray-800">${Math.round(passiveData.totalCashMonthly)}</div>
            </div>
         </div>
      </div>

      {/* --- LIFESTYLE COVERAGE --- */}
      <section className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-gray-100">
         <div className="flex justify-between items-center mb-6">
            <div className="flex items-center space-x-2">
               <Coffee className="w-4 h-4 text-gray-400" />
               <h3 className="text-xs font-black text-gray-800 uppercase tracking-widest">Lifestyle Coverage</h3>
            </div>
            <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded-lg">Target: ${monthlyExpenseBase}</span>
         </div>
         
         <div className="relative pt-2 pb-6">
            <div className="flex justify-between text-xs font-bold text-gray-400 mb-2 px-1">
               <span>0%</span>
               <span>50%</span>
               <span>100%</span>
            </div>
            <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
               <div 
                 className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all duration-1000 ease-out relative"
                 style={{ width: `${coveragePercent}%` }}
               >
                  <div className="absolute top-0 right-0 h-full w-4 bg-white/20 animate-pulse" />
               </div>
            </div>
            <div 
               className="absolute top-8 transform -translate-x-1/2 bg-gray-900 text-white text-[10px] font-bold px-2 py-1 rounded-lg shadow-lg transition-all duration-1000"
               style={{ left: `${coveragePercent}%` }}
            >
               {coveragePercent.toFixed(0)}%
               <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45" />
            </div>
         </div>
         
         <div className="text-xs text-gray-500 font-medium leading-relaxed bg-gray-50 p-4 rounded-2xl">
            You can cover <span className="font-bold text-gray-800">{coveragePercent.toFixed(0)}%</span> of your basic expenses purely through passive income.
            {coveragePercent > 50 && " That includes rent and utilities!"}
         </div>
      </section>

      {/* --- YIELD TREND CHART --- */}
      <section className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-gray-100">
         <div className="flex justify-between items-center mb-6">
            <h3 className="text-xs font-black text-gray-800 uppercase tracking-widest">Yield Growth</h3>
            <div className="flex space-x-2">
               <div className="flex items-center text-[9px] font-bold text-gray-400"><span className="w-2 h-2 bg-orange-400 rounded-full mr-1"/>FD</div>
               <div className="flex items-center text-[9px] font-bold text-gray-400"><span className="w-2 h-2 bg-indigo-500 rounded-full mr-1"/>Div</div>
            </div>
         </div>
         <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={yieldTrendData}>
                  <defs>
                     <linearGradient id="gradFD" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#FB923C" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#FB923C" stopOpacity={0}/>
                     </linearGradient>
                     <linearGradient id="gradStock" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                     </linearGradient>
                  </defs>
                  <Tooltip 
                     contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontSize: '12px', fontWeight: 'bold'}}
                     itemStyle={{padding: 0}}
                  />
                  <Area type="monotone" dataKey="fd" stackId="1" stroke="#FB923C" fill="url(#gradFD)" strokeWidth={3} />
                  <Area type="monotone" dataKey="stock" stackId="1" stroke="#6366F1" fill="url(#gradStock)" strokeWidth={3} />
               </AreaChart>
            </ResponsiveContainer>
         </div>
      </section>

      {/* --- TOP PERFORMERS --- */}
      <section className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-gray-100">
         <div className="flex items-center justify-between mb-6">
            <h3 className="text-xs font-black text-gray-800 uppercase tracking-widest flex items-center">
              <Sparkles className="w-4 h-4 mr-2 text-yellow-500" /> Star Employees
            </h3>
         </div>
         <div className="space-y-3">
            {passiveData.employees.slice(0, 4).map((emp, index) => (
               <div key={index} className="flex items-center justify-between p-3 rounded-2xl hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                     <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shadow-sm ${index === 0 ? 'bg-yellow-100 text-yellow-600' : 'bg-gray-100 text-gray-500'}`}>
                        {index === 0 ? <Trophy className="w-4 h-4" /> : index + 1}
                     </div>
                     <div>
                        <div className="text-xs font-black text-gray-800">{emp.name}</div>
                        <div className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                           {emp.type === 'FD' ? <Landmark size={10}/> : <TrendingUp size={10}/>} {emp.yield}% Yield
                        </div>
                     </div>
                  </div>
                  <div className="text-right">
                     <div className="text-xs font-black text-gray-900">+${Math.round(emp.monthly)}</div>
                     <div className="text-[9px] font-bold text-gray-400">/mo</div>
                  </div>
               </div>
            ))}
         </div>
      </section>

      {/* --- GOAL PROGRESS --- */}
      <div 
        onClick={() => setIsEditingGoal(true)}
        className="bg-gray-900 rounded-[2.5rem] p-6 shadow-xl shadow-gray-200 cursor-pointer active:scale-95 transition-transform relative overflow-hidden"
      >
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-white opacity-5 rounded-full blur-2xl" />
          
          <div className="flex justify-between items-start mb-6 relative z-10">
             <div>
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-2">
                   <Target className="w-4 h-4" /> Net Worth Goal
                </h3>
                <div className="text-2xl font-black text-white tracking-tight">${wealthGoal.toLocaleString()}</div>
             </div>
             <div className="bg-gray-800 p-2 rounded-full text-white">
                <ChevronRight className="w-5 h-5" />
             </div>
          </div>

          <div className="relative h-2 bg-gray-700 rounded-full overflow-hidden">
             <div 
               className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-400 to-indigo-400 transition-all duration-1000"
               style={{ width: `${goalPercent}%` }}
             />
          </div>
          <div className="flex justify-between mt-2 text-[10px] font-bold text-gray-500 uppercase">
             <span>Current: ${passiveData.netWorth.toLocaleString()}</span>
             <span>{goalPercent.toFixed(1)}%</span>
          </div>
      </div>

      {/* --- MODALS --- */}
      {isEditingGoal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsEditingGoal(false)} />
              <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 relative z-10 animate-in zoom-in-95">
                  <h2 className="text-xl font-black text-gray-900 mb-6 text-center">Update Wealth Goal</h2>
                  <input type="number" autoFocus value={tempGoal} onChange={(e) => setTempGoal(e.target.value)} 
                    className="w-full bg-gray-50 p-6 rounded-3xl text-3xl font-black text-blue-600 text-center outline-none focus:ring-4 focus:ring-blue-100" />
                  <button onClick={handleSaveGoal} className="w-full bg-gray-900 text-white font-black py-5 rounded-[2rem] mt-6 shadow-xl">
                    CONFIRM TARGET
                  </button>
              </div>
          </div>
      )}

      {showReport && (
         <MonthlyReport accounts={accounts} fixedDeposits={fixedDeposits} history={history} wealthGoal={wealthGoal} onClose={() => { setShowReport(false); setShowConfetti(true); }} onNavigateToFD={() => setShowReport(false)} />
      )}
    </div>
  );
};

export default Insights;