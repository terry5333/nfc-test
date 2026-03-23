import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { db } from '../lib/firebase';
import { ref, onValue, get, set, update, push, serverTimestamp } from 'firebase/database';

export default function Home() {
  const router = useRouter();
  const [status, setStatus] = useState("⌛ 待命：請感應或嗶卡");
  const [isSuccess, setIsSuccess] = useState(false);
  const [scanMode, setScanMode] = useState("上學"); 
  const [processing, setProcessing] = useState(false);

  // 🚩 設定你的神卡卡號
  const MY_GOD_CARD = process.env.NEXT_PUBLIC_MY_GOD_CARD || "你的神卡卡號";

  useEffect(() => {
    // 監聽門禁開關
    const unsubMode = onValue(ref(db, 'system/settings/scanMode'), (s) => setScanMode(s.val() || "上學"));

    // 監聽實體讀卡機
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

    // 監聽手機 NFC
    const unsubScan = onValue(ref(db, 'system/last_scan'), (s) => {
      const data = s.val();
      if (data && data.id) handleAuth(data.id, "手機感應");
    });

    return () => { clearInterval(checkLocal); unsubMode(); unsubScan(); };
  }, [scanMode, processing]);

  async function handleAuth(cardId, source) {
    if (processing) return; 
    setProcessing(true);
    
    const cleanId = cardId.replace(/[\s:]/g, '').toUpperCase();
    const godId = MY_GOD_CARD.replace(/[\s:]/g, '').toUpperCase();

    // 👑 神卡判斷
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

        if (user.isLocked) {
          setIsSuccess(false);
          setStatus(`⛔ 卡片已鎖定：請找資訊組長解鎖`);
          if (source === "手機感應") await set(ref(db, 'system/last_scan'), null);
        } 
        else if (user.role === 'teacher') {
          setIsSuccess(true);
          setStatus(`✅ 歡迎 ${user.name} 老師`);
          if (source === "手機感應") await set(ref(db, 'system/last_scan'), null);
        } 
        else {
          const today = new Date().toLocaleDateString('zh-TW');

          // 🚩 防屁孩邏輯
          if (user.lastCheckInDate === today && user.lastCheckInPeriod === scanMode) {
            const currentCount = user.spamCount || 1; 
            const newCount = currentCount + 1;

            if (newCount >= 3) {
              await update(ref(db, `authorized_cards/${cleanId}`), { isLocked: true, spamCount: newCount });
              setStatus(`⛔ 連刷 3 次！卡片已遭封印`);
            } else {
              await update(ref(db, `authorized_cards/${cleanId}`), { spamCount: newCount });
              setStatus(`⚠️ ${scanMode}已打卡，請勿重複感應 (第${newCount}次)`);
            }
          } else {
            // ✅ 正常打卡 (重置為1次)
            setIsSuccess(true);
            setStatus(`✅ ${user.name} ${scanMode}打卡成功`);
            
            await update(ref(db, `authorized_cards/${cleanId}`), {
              lastCheckInDate: today, 
              lastCheckInPeriod: scanMode, 
              spamCount: 1 
            });
            await push(ref(db, 'student_logs'), { 
              name: user.name, id: cleanId, time: serverTimestamp(), source, period: scanMode 
            });
          }
          if (source === "手機感應") await set(ref(db, 'system/last_scan'), null);
        }
      } else {
        setIsSuccess(false);
        setStatus(`🚫 未註冊卡片: ${cleanId.substring(0,8)}`);
        await set(ref(db, 'system/last_scan'), { id: cleanId, time: Date.now() });
      }
    } catch (e) {
      setStatus("連線錯誤");
    }

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

const normalBg = { height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#0f172a', color: 'white', textAlign: 'center', fontFamily: 'sans-serif' };
const successBg = { ...normalBg, background: '#064e3b' };
const cardStyle = { padding: '50px', borderRadius: '30px', background: 'rgba(255,255,255,0.05)', border: '2px solid rgba(255,255,255,0.1)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', width: '80%', maxWidth: '500px' };
