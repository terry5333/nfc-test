import { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { ref, get, set, push, serverTimestamp } from 'firebase/database';

export default function MobileStation() {
  const [status, setStatus] = useState("⌛ 系統待命：請感應卡片");
  const [isDone, setIsDone] = useState(false);
  const [manualId, setManualId] = useState("");

  // --- 啟動 NFC 監聽 (僅限 Android Chrome) ---
  const startNFC = async () => {
    if ('NDEFReader' in window) {
      try {
        const ndef = new NDEFReader();import { useEffect, useState, useRef } from 'react';
import { db } from '../lib/firebase';
import { ref, onValue, get, set, update, push, serverTimestamp } from 'firebase/database';

export default function MobileStation() {
  const [status, setStatus] = useState("⌛ 待命：請感應或嗶卡");
  const [isSuccess, setIsSuccess] = useState(false);
  const [scanModeDisplay, setScanModeDisplay] = useState("上學");
  
  // 🚩 使用 useRef 同步最新狀態，避免連刷吃 Bug
  const scanModeRef = useRef("上學");
  const processingRef = useRef(false);
  const inputRef = useRef(null);

  // 取得嚴格日期 YYYY-MM-DD
  const getTodayStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    // 1. 強制隱藏輸入框保持對焦 (給掃描槍用)
    const keepFocus = () => inputRef.current?.focus();
    document.addEventListener('click', keepFocus);
    keepFocus();

    // 2. 監聽組長的門禁總開關
    const unsubMode = onValue(ref(db, 'system/settings/scanMode'), (s) => {
      const mode = s.val() || "上學";
      scanModeRef.current = mode;
      setScanModeDisplay(mode);
    });

    // 3. 啟動 Android NFC 監控
    if ('NDEFReader' in window) {
      const ndef = new NDEFReader();
      ndef.scan().then(() => {
        ndef.onreading = (e) => handleProcess(e.serialNumber, "NFC");
      }).catch(err => console.error("NFC啟動失敗", err));
    }

    return () => { document.removeEventListener('click', keepFocus); unsubMode(); };
  }, []);

  // --- 核心打卡與防呆邏輯 ---
  const handleProcess = async (cardId, type) => {
    // 擋住重複觸發
    if (processingRef.current || !cardId) return;
    processingRef.current = true;
    
    const cleanId = cardId.replace(/[\s:]/g, '').toUpperCase();
    const currentMode = scanModeRef.current;
    
    if (navigator.vibrate) navigator.vibrate(200);

    try {
      const snap = await get(ref(db, `authorized_cards/${cleanId}`));
      if (snap.exists()) {
        const user = snap.val();

        // ⛔ 檢查鎖定狀態
        if (user.isLocked) {
          setIsSuccess(false);
          setStatus(`⛔ 卡片已鎖定：請找資訊組長`);
        } 
        // 🍎 老師登入
        else if (user.role === 'teacher') {
          setIsSuccess(true);
          setStatus(`✅ 歡迎 ${user.name} 老師`);
          await set(ref(db, 'system/last_scan'), { id: cleanId, time: Date.now() });
        } 
        // 🎒 學生防屁孩邏輯
        else {
          const today = getTodayStr();

          if (user.lastCheckInDate === today && user.lastCheckInPeriod === currentMode) {
            const currentCount = user.spamCount || 1; 
            const newCount = currentCount + 1;

            if (newCount >= 3) {
              // ⛔ 連刷三次，直接鎖卡
              await update(ref(db, `authorized_cards/${cleanId}`), { isLocked: true, spamCount: newCount });
              setStatus(`⛔ 連刷 3 次！卡片已遭封印`);
              setIsSuccess(false);
            } else {
              // ⚠️ 警告次數
              await update(ref(db, `authorized_cards/${cleanId}`), { spamCount: newCount });
              setStatus(`⚠️ ${currentMode}已打卡，請勿重複感應 (第${newCount}次)`);
              setIsSuccess(false);
            }
          } else {
            // ✅ 正常打卡
            setIsSuccess(true);
            setStatus(`✅ ${user.name} ${currentMode}打卡成功`);
            
            await update(ref(db, `authorized_cards/${cleanId}`), {
              lastCheckInDate: today, 
              lastCheckInPeriod: currentMode, 
              spamCount: 1 
            });
            await push(ref(db, 'student_logs'), { 
              name: user.name, id: cleanId, time: serverTimestamp(), source: type, period: currentMode 
            });
          }
        }
      } else {
        // 未註冊
        setIsSuccess(false);
        setStatus(`🚫 未註冊卡片: ${cleanId.substring(0,8)}`);
        await set(ref(db, 'system/last_scan'), { id: cleanId, time: Date.now() });
      }
    } catch (e) {
      setStatus("連線錯誤");
    }

    // 2 秒後解開防護鎖，準備迎接下一個學生
    setTimeout(() => { 
      processingRef.current = false; 
      setIsSuccess(false); 
      setStatus(`⌛ 待命：請感應或嗶卡 (${scanModeRef.current}中)`); 
    }, 2000);
  };

  return (
    <div style={isSuccess ? successBg : normalBg}>
      <h1 style={{ letterSpacing: '3px', fontSize: '1.2rem', marginBottom: '10px' }}>TERRY EDU STATION</h1>
      
      <div style={cardStyle}>
        <div style={{ fontSize: '4rem', marginBottom: '10px' }}>{isSuccess ? "✅" : "🪪"}</div>
        <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{status}</p>
        <p style={{ marginTop: '15px', color: '#10b981', fontWeight: 'bold' }}>⛩️ 目前：{scanModeDisplay}</p>
      </div>

      {/* 隱藏輸入框：給 USB 掃描槍用 */}
      <input 
        ref={inputRef}
        type="text"
        style={{ opacity: 0, position: 'absolute', top: '-1000px' }} 
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            handleProcess(e.target.value, "SCANNER_GUN");
            e.target.value = ""; 
          }
        }}
      />
      
      <p style={{ marginTop: '30px', opacity: 0.5, fontSize: '0.9rem' }}>支援：NFC 感應 / USB 掃描槍</p>
    </div>
  );
}

// 樣式
const normalBg = { height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#000', color: '#fff', textAlign: 'center', fontFamily: 'sans-serif' };
const successBg = { ...normalBg, background: '#064e3b' };
const cardStyle = { padding: '40px 20px', borderRadius: '25px', background: '#111', border: '2px solid #333', width: '85%', maxWidth: '400px', boxShadow: '0 10px 30px rgba(0,0,0,0.8)' };
        await ndef.scan();
        setStatus("📡 NFC 已啟動，請靠近感應");
        ndef.onreading = (event) => handleProcess(event.serialNumber, "NFC");
      } catch (e) {
        setStatus("❌ NFC 啟動失敗");
      }
    } else {
      setStatus("📱 此裝置不支援 NFC (建議用實體讀卡機)");
    }
  };

  const handleProcess = async (cardId, type) => {
    if (isDone) return;
    const cleanId = cardId.replace(/[\s:]/g, '').toUpperCase();
    setIsDone(true);
    if (navigator.vibrate) navigator.vibrate(200);

    const snap = await get(ref(db, `authorized_cards/${cleanId}`));
    if (snap.exists()) {
      const user = snap.val();
      setStatus(`✅ ${user.name} 打卡成功`);
      if (user.role === 'teacher') {
        await set(ref(db, 'system/last_scan'), { id: cleanId, time: Date.now() });
      } else {
        await push(ref(db, 'student_logs'), { name: user.name, id: cleanId, time: serverTimestamp(), type });
      }
    } else {
      setStatus(`⚠️ 未註冊：${cleanId}`);
      await set(ref(db, 'system/last_scan'), { id: cleanId, time: Date.now() });
    }

    setTimeout(() => {
      setIsDone(false);
      setStatus("⌛ 系統待命：請感應卡片");
    }, 3000);
  };

  return (
    <div style={isDone ? successBg : normalBg}>
      <h1>TERRY EDU</h1>
      <div style={statusCard}>
        <div style={{ fontSize: '4rem', marginBottom: '10px' }}>{isDone ? "✅" : "🪪"}</div>
        <p style={{ fontWeight: 'bold' }}>{status}</p>
      </div>

      {!isDone && (
        <div style={{ marginTop: '20px' }}>
          <button onClick={startNFC} style={nfcBtn}>啟動 NFC 監測</button>
          
          {/* 備案：手動輸入 (Vibe 補登) */}
          <div style={{ marginTop: '30px', borderTop: '1px solid #333', paddingTop: '20px' }}>
            <input 
              value={manualId} 
              onChange={(e) => setManualId(e.target.value)} 
              placeholder="或輸入卡號/學號"
              style={inputStyle}
            />
            <button onClick={() => handleProcess(manualId, "MANUAL")} style={manualBtn}>補登</button>
          </div>
        </div>
      )}
    </div>
  );
}

// 樣式
const normalBg = { height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#000', color: '#fff', textAlign: 'center' };
const successBg = { ...normalBg, background: '#064e3b' };
const statusCard = { padding: '30px', borderRadius: '20px', background: '#111', border: '2px solid #333', width: '80%' };
const nfcBtn = { padding: '15px 30px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold' };
const inputStyle = { padding: '10px', borderRadius: '5px', border: '1px solid #444', background: '#222', color: '#fff', width: '150px' };
const manualBtn = { padding: '10px 20px', marginLeft: '10px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '5px' };
