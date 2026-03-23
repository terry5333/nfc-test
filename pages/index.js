import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { db } from '../lib/firebase';
import { ref, onValue, get, set, update, push, serverTimestamp } from 'firebase/database';

export default function Home() {
  const router = useRouter();
  const [status, setStatus] = useState("⌛ 待命：請感應或嗶卡");
  const [isSuccess, setIsSuccess] = useState(false);
  const [scanModeDisplay, setScanModeDisplay] = useState("上學");
  
  // 🚩 使用 useRef 來存放變數，避免 React 計時器抓到舊資料
  const scanModeRef = useRef("上學");
  const processingRef = useRef(false);

  // 設定神卡
  const MY_GOD_CARD = process.env.NEXT_PUBLIC_MY_GOD_CARD || "你的神卡卡號";

  // 🚩 嚴格的日期產出工具，保證絕對是 YYYY-MM-DD
  const getTodayStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    // 監聽總開關
    const unsubMode = onValue(ref(db, 'system/settings/scanMode'), (s) => {
      const mode = s.val() || "上學";
      scanModeRef.current = mode; // 同步給底層邏輯
      setScanModeDisplay(mode);   // 同步給畫面
    });

    // 監聽實體讀卡機
    const checkLocal = setInterval(async () => {
      try {
        const res = await fetch('http://localhost:5000/scan');
        const data = await res.json();
        
        if (data.status === "success" && data.id) {
          handleAuth(data.id, "實體讀卡");
        } else if (data.status === "removed") {
          setIsSuccess(false);
          setStatus(`⌛ 待命：請感應或嗶卡 (${scanModeRef.current}中)`);
        }
      } catch (e) {}
    }, 1000);

    // 監聽手機 NFC
    const unsubScan = onValue(ref(db, 'system/last_scan'), (s) => {
      const data = s.val();
      if (data && data.id) handleAuth(data.id, "手機感應");
    });

    // 🚩 這裡的 dependency array 是空的，保證計時器不會被打斷
    return () => { clearInterval(checkLocal); unsubMode(); unsubScan(); };
  }, []); 

  async function handleAuth(cardId, source) {
    // 🚩 如果正在處理中，直接擋掉，但狀態是最新的
    if (processingRef.current) return; 
    processingRef.current = true;
    
    const cleanId = cardId.replace(/[\s:]/g, '').toUpperCase();
    const godId = MY_GOD_CARD.replace(/[\s:]/g, '').toUpperCase();
    const currentMode = scanModeRef.current; // 取得當下最新的門禁狀態

    // 👑 神卡
    if (cleanId === godId) {
      setIsSuccess(true);
      setStatus("👑 管理員神卡確認，進入系統...");
      if (source === "手機感應") await set(ref(db, 'system/last_scan'), null);
      setTimeout(() => router.push('/admin'), 1000);
      return; 
    }
    
    try {
      const snap = await get(ref(db, `authorized_cards/${cleanId}`));
      if (snap.exists()) {
        const user = snap.val();

        // ⛔ 檢查鎖卡
        if (user.isLocked) {
          setIsSuccess(false);
          setStatus(`⛔ 卡片已鎖定：請找資訊組長解鎖`);
        } 
        // 🍎 老師登入
        else if (user.role === 'teacher') {
          setIsSuccess(true);
          setStatus(`✅ 歡迎 ${user.name} 老師`);
        } 
        // 🎒 學生防屁孩邏輯
        else {
          const today = getTodayStr(); // 取得嚴格日期

          if (user.lastCheckInDate === today && user.lastCheckInPeriod === currentMode) {
            // 已經打過卡了
            const currentCount = user.spamCount || 1; 
            const newCount = currentCount + 1;

            if (newCount >= 3) {
              // ⛔ 第三次：直接鎖卡
              await update(ref(db, `authorized_cards/${cleanId}`), { isLocked: true, spamCount: newCount });
              setStatus(`⛔ 連刷 3 次！卡片已遭封印`);
              setIsSuccess(false); // 畫面變紅/警告
            } else {
              // ⚠️ 第二次：警告
              await update(ref(db, `authorized_cards/${cleanId}`), { spamCount: newCount });
              setStatus(`⚠️ ${currentMode}已打卡，請勿重複感應 (第${newCount}次)`);
              setIsSuccess(false); 
            }
          } else {
            // ✅ 第一次：正常打卡
            setIsSuccess(true);
            setStatus(`✅ ${user.name} ${currentMode}打卡成功`);
            
            // 寫入日期、時段，並把次數重置為 1
            await update(ref(db, `authorized_cards/${cleanId}`), {
              lastCheckInDate: today, 
              lastCheckInPeriod: currentMode, 
              spamCount: 1 
            });
            await push(ref(db, 'student_logs'), { 
              name: user.name, id: cleanId, time: serverTimestamp(), source, period: currentMode 
            });
          }
        }
      } else {
        // 未註冊卡
        setIsSuccess(false);
        setStatus(`🚫 未註冊卡片: ${cleanId.substring(0,8)}`);
        await set(ref(db, 'system/last_scan'), { id: cleanId, time: Date.now() });
      }
    } catch (e) {
      setStatus("連線錯誤");
    }

    // 清除手機端的遠端掃描紀錄
    if (source === "手機感應") await set(ref(db, 'system/last_scan'), null);

    // 🚩 防抖時間縮短至 2 秒，然後解開防護鎖
    setTimeout(() => { 
      processingRef.current = false; 
      if (source === "手機感應") {
        setIsSuccess(false); 
        setStatus(`⌛ 待命：請感應或嗶卡 (${scanModeRef.current}中)`); 
      }
    }, 2000); 
  }

  return (
    <div style={isSuccess ? successBg : normalBg}>
      <div style={cardStyle}>
        <h1 style={{ letterSpacing: '5px' }}>TERRY EDU</h1>
        <div style={{ fontSize: '5rem', margin: '20px 0' }}>{isSuccess ? "🔓" : "🛡️"}</div>
        <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{status}</p>
        <p style={{ marginTop: '20px', opacity: 0.5 }}>目前門禁：{scanModeDisplay}</p>
      </div>
    </div>
  );
}

const normalBg = { height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#0f172a', color: 'white', textAlign: 'center', fontFamily: 'sans-serif' };
const successBg = { ...normalBg, background: '#064e3b' };
const cardStyle = { padding: '50px', borderRadius: '30px', background: 'rgba(255,255,255,0.05)', border: '2px solid rgba(255,255,255,0.1)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', width: '80%', maxWidth: '500px' };
