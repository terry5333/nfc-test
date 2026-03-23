import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { db } from '../lib/firebase';
import { ref, onValue, get, set, update, push, serverTimestamp } from 'firebase/database';

export default function Home() {
  const router = useRouter();
  const [status, setStatus] = useState("⌛ 待命：請感應或嗶卡");
  const [isSuccess, setIsSuccess] = useState(false);
  const [scanMode, setScanMode] = useState("上學"); // 預設狀態
  const [processing, setProcessing] = useState(false);

  // 🚩 設定你的神卡卡號 (請確保全大寫、無空白)
  const MY_GOD_CARD = process.env.NEXT_PUBLIC_MY_GOD_CARD || "你的神卡卡號";

  useEffect(() => {
    // 1. 監聽組長的門禁總開關
    const unsubMode = onValue(ref(db, 'system/settings/scanMode'), (s) => {
      setScanMode(s.val() || "上學");
    });

    // 2. 監聽地端 Python (USB 實體讀卡機)
    const checkLocal = setInterval(async () => {
      try {
        const res = await fetch('http://localhost:5000/scan');
        const data = await res.json();
        
        if (data.status === "success" && data.id) {
          handleAuth(data.id, "實體讀卡");
        } else if (data.status === "removed") {
          setIsSuccess(false);
          setStatus(`⌛ 待命：請感應或嗶卡 (${scanMode}中)`);
        }
      } catch (e) {}
    }, 1000);

    // 3. 監聽雲端 Firebase (手機 NFC/掃描)
    const scanRef = ref(db, 'system/last_scan');
    const unsubScan = onValue(scanRef, (s) => {
      const data = s.val();
      if (data && data.id) handleAuth(data.id, "手機感應");
    });

    return () => { clearInterval(checkLocal); unsubMode(); unsubScan(); };
  }, [scanMode, processing]); // 依賴 scanMode 確保狀態最新

  async function handleAuth(cardId, source) {
    if (processing) return; // 防止重複觸發
    setProcessing(true);
    
    const cleanId = cardId.replace(/[\s:]/g, '').toUpperCase();
    const godId = MY_GOD_CARD.replace(/[\s:]/g, '').toUpperCase();

    // 👑 判斷神卡
    if (cleanId === godId) {
      setIsSuccess(true);
      setStatus("👑 管理員神卡確認，進入系統...");
      if (source === "手機感應") await set(ref(db, 'system/last_scan'), null);
      setTimeout(() => router.push('/admin'), 1000);
      return;
    }
    
    // 一般卡片處理
    try {
      const snap = await get(ref(db, `authorized_cards/${cleanId}`));
      if (snap.exists()) {
        const user = snap.val();

        // ⛔ 檢查是否被鎖卡 (封印狀態)
        if (user.isLocked) {
          setIsSuccess(false);
          setStatus(`⛔ 卡片已鎖定：請找資訊組長解鎖`);
          if (source === "手機感應") await set(ref(db, 'system/last_scan'), null);
        } 
        // 🍎 老師登入
        else if (user.role === 'teacher') {
          setIsSuccess(true);
          setStatus(`✅ 歡迎 ${user.name} 老師`);
          if (source === "手機感應") await set(ref(db, 'system/last_scan'), null);
        } 
        // 🎒 學生打卡防呆邏輯
        else {
          const today = new Date().toLocaleDateString('zh-TW'); // 例: 2026/3/24

          if (user.lastCheckInDate === today && user.lastCheckInPeriod === scanMode) {
            // ⚠️ 已經打過卡了，增加警告次數
            const newSpamCount = (user.spamCount || 0) + 1;
            if (newSpamCount >= 3) {
              await update(ref(db, `authorized_cards/${cleanId}`), { isLocked: true, spamCount: 0 });
              setStatus(`⛔ 惡意連刷！卡片已遭封印`);
            } else {
              await update(ref(db, `authorized_cards/${cleanId}`), { spamCount: newSpamCount });
              setStatus(`⚠️ ${scanMode}已打卡，請勿重複感應`);
            }
          } else {
            // ✅ 正常打卡
            setIsSuccess(true);
            setStatus(`✅ ${user.name} ${scanMode}打卡成功`);
            
            // 更新狀態與紀錄
            await update(ref(db, `authorized_cards/${cleanId}`), {
              lastCheckInDate: today, lastCheckInPeriod: scanMode, spamCount: 0
            });
            await push(ref(db, 'student_logs'), { 
              name: user.name, id: cleanId, time: serverTimestamp(), source, period: scanMode 
            });
          }
          if (source === "手機感應") await set(ref(db, 'system/last_scan'), null);
        }
      } else {
        // 未註冊卡片
        setIsSuccess(false);
        setStatus(`🚫 未註冊卡片: ${cleanId.substring(0,8)}`);
        await set(ref(db, 'system/last_scan'), { id: cleanId, time: Date.now() });
      }
    } catch (e) {
      setStatus("連線錯誤");
    }

    // 3秒後恢復待命 (針對手機感應)
    setTimeout(() => { 
      setProcessing(false); 
      if (source === "手機感應") {
        setIsSuccess(false); 
        setStatus(`⌛ 待命：請感應或嗶卡 (${scanMode}中)`); 
      }
    }, 3000);
  }

  return (
    <div style={isSuccess ? successBg : normalBg}>
      <div style={cardStyle}>
        <h1 style={{ letterSpacing: '5px' }}>TERRY EDU</h1>
        <div style={{ fontSize: '5rem', margin: '20px 0' }}>{isSuccess ? "🔓" : "🛡️"}</div>
        <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{status}</p>
        <p style={{ marginTop: '20px', opacity: 0.5 }}>目前門禁：{scanMode}</p>
      </div>
    </div>
  );
}

// 樣式
const normalBg = { height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#0f172a', color: 'white', textAlign: 'center', fontFamily: 'sans-serif' };
const successBg = { ...normalBg, background: '#064e3b' };
const cardStyle = { padding: '50px', borderRadius: '30px', background: 'rgba(255,255,255,0.05)', border: '2px solid rgba(255,255,255,0.1)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', width: '80%', maxWidth: '500px' };
