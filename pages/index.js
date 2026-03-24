import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { db } from '../lib/firebase';
import { ref, onValue, get, set, update, push, serverTimestamp } from 'firebase/database';

export default function Home() {
  const router = useRouter();
  const [status, setStatus] = useState("⌛ 待命：請感應或嗶卡");
  const [isSuccess, setIsSuccess] = useState(false);
  const [scanModeDisplay, setScanModeDisplay] = useState("上學");
  
  const scanModeRef = useRef("上學");
  const processingRef = useRef(false);
  
  // 🚩 新增：給 Barcode to PC 用的隱藏輸入框 Ref
  const inputRef = useRef(null);

  // 設定神卡
  const MY_GOD_CARD = process.env.NEXT_PUBLIC_MY_GOD_CARD || "你的神卡卡號";

  const getTodayStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    // 🚩 1. 強制隱藏輸入框保持對焦 (不管你滑鼠點哪裡，焦點都會拉回隱藏框)
    const keepFocus = () => inputRef.current?.focus();
    document.addEventListener('click', keepFocus);
    keepFocus(); // 初始化先對焦一次

    // 2. 監聽總開關
    const unsubMode = onValue(ref(db, 'system/settings/scanMode'), (s) => {
      const mode = s.val() || "上學";
      scanModeRef.current = mode; 
      setScanModeDisplay(mode);   
    });

    // 3. 監聽實體讀卡機
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

    // 4. 監聽手機 NFC
    const unsubScan = onValue(ref(db, 'system/last_scan'), (s) => {
      const data = s.val();
      if (data && data.id) handleAuth(data.id, "手機感應");
    });

    return () => { 
      clearInterval(checkLocal); 
      unsubMode(); 
      unsubScan(); 
      document.removeEventListener('click', keepFocus); // 清除對焦監聽
    };
  }, []); 

  async function handleAuth(cardId, source) {
    if (processingRef.current || !cardId) return; 
    processingRef.current = true;
    
    const cleanId = cardId.replace(/[\s:]/g, '').toUpperCase();
    const godId = MY_GOD_CARD.replace(/[\s:]/g, '').toUpperCase();
    const currentMode = scanModeRef.current;

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
          await set(ref(db, 'system/last_scan'), { id: cleanId, time: Date.now() });
        } 
        else if (user.role === 'teacher') {
          setIsSuccess(true);
          setStatus(`✅ 歡迎 ${user.name} 老師`);
          await set(ref(db, 'system/last_scan'), { id: cleanId, time: Date.now() });
        } 
        else {
          const today = getTodayStr();

          if (user.lastCheckInDate === today && user.lastCheckInPeriod === currentMode) {
            const currentCount = user.spamCount || 1; 
            const newCount = currentCount + 1;

            if (newCount >= 3) {
              await update(ref(db, `authorized_cards/${cleanId}`), { isLocked: true, spamCount: newCount });
              setStatus(`⛔ 連刷 3 次！卡片已遭封印`);
              setIsSuccess(false);
              await set(ref(db, 'system/last_scan'), { id: cleanId, time: Date.now() });
            } else {
              await update(ref(db, `authorized_cards/${cleanId}`), { spamCount: newCount });
              setStatus(`⚠️ ${currentMode}已打卡，請勿重複感應 (第${newCount}次)`);
              setIsSuccess(false); 
            }
          } else {
            setIsSuccess(true);
            setStatus(`✅ ${user.name} ${currentMode}打卡成功`);
            
            await update(ref(db, `authorized_cards/${cleanId}`), {
              lastCheckInDate: today, 
              lastCheckInPeriod: currentMode, 
              spamCount: 1 
            });
            await push(ref(db, 'student_logs'), { 
              name: user.name, id: cleanId, time: serverTimestamp(), source, period: currentMode 
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
      processingRef.current = false; 
      if (source === "手機感應" || source === "Barcode2PC") {
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

      {/* 🚩 隱藏輸入框：專門接收 Barcode to PC 傳來的鍵盤訊號 */}
      <input 
        ref={inputRef}
        type="text"
        style={{ opacity: 0, position: 'absolute', top: '-1000px' }} 
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            handleAuth(e.target.value, "Barcode2PC"); // 觸發打卡邏輯
            e.target.value = ""; // 清空，準備迎接下一個條碼
          }
        }}
      />
    </div>
  );
}

const normalBg = { height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#0f172a', color: 'white', textAlign: 'center', fontFamily: 'sans-serif' };
const successBg = { ...normalBg, background: '#064e3b' };
const cardStyle = { padding: '50px', borderRadius: '30px', background: 'rgba(255,255,255,0.05)', border: '2px solid rgba(255,255,255,0.1)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', width: '80%', maxWidth: '500px' };
