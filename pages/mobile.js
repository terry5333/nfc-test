import { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { ref, set, push, serverTimestamp, get } from 'firebase/database';

export default function MobileStation() {
  const [status, setStatus] = useState("等待啟動...");
  const [scanning, setScanning] = useState(false);
  const [isDone, setIsDone] = useState(false);

  // --- 1. 啟動 NFC 與 條碼掃描 ---
  const startAllSensors = async () => {
    setScanning(true);
    setStatus("📡 監控中：請靠近卡片或對準條碼");
    
    // A. 啟動條碼掃描 (動態載入套件預防 SSR 錯誤)
    try {
      const { Html5QrcodeScanner } = await import("html5-qrcode");
      const scanner = new Html5QrcodeScanner("mobile-reader", { 
        fps: 15, 
        qrbox: { width: 280, height: 160 } 
      });
      scanner.render((text) => handleProcess(text, "BARCODE"));
    } catch (err) {
      console.error("相機啟動失敗", err);
    }

    // B. 啟動 NFC 監控
    if ('NDEFReader' in window) {
      try {
        const ndef = new NDEFReader();
        await ndef.scan();
        ndef.onreading = (event) => handleProcess(event.serialNumber, "NFC");
      } catch (err) {
        console.error("NFC 啟動失敗", err);
      }
    }
  };

  // --- 2. 統一處理判斷邏輯 ---
  const handleProcess = async (cardId, type) => {
    if (isDone) return; // 防止重複感應
    
    const cleanId = cardId.replace(/[\s:]/g, '').toUpperCase();
    setIsDone(true);
    
    if (navigator.vibrate) navigator.vibrate(200); // 成功震動

    try {
      // 檢查是否為老師
      const teacherSnap = await get(ref(db, `authorized_cards/${cleanId}`));
      
      if (teacherSnap.exists()) {
        setStatus(`🍎 老師好：${teacherSnap.val().name}`);
        // 老師卡傳送到 system/last_scan 讓電腦端 index 頁面跳轉
        await set(ref(db, 'system/last_scan'), { id: cleanId, timestamp: Date.now() });
      } else {
        setStatus(`🎒 學生打卡成功：${cleanId.substring(0,8)}`);
        // 學生卡直接存入紀錄，不影響電腦畫面跳轉
        await push(ref(db, 'student_logs'), { id: cleanId, time: serverTimestamp(), type: type });
      }
    } catch (e) {
      setStatus("寫入錯誤，請檢查網路");
    }

    // 3 秒後重置畫面
    setTimeout(() => {
      setIsDone(false);
      setStatus("📡 監控中：請靠近卡片或對準條碼");
    }, 3000);
  };

  return (
    <div style={isDone ? successStyle : containerStyle}>
      <h1 style={{ fontSize: '2rem' }}>{isDone ? "OK!" : "TERRY EDU 門口機"}</h1>
      
      {!scanning ? (
        <button onClick={startAllSensors} style={startBtn}>點擊啟動監控</button>
      ) : (
        <div id="mobile-reader" style={{ width: '300px', margin: '20px auto', display: isDone ? 'none' : 'block' }}></div>
      )}

      <p style={{ fontSize: '1.2rem', padding: '20px', fontWeight: 'bold' }}>{status}</p>
      
      <div style={{ fontSize: '0.8rem', opacity: 0.5 }}>
        模式：雙軌自動識別 (學生/老師)
      </div>
    </div>
  );
}

// 樣式
const containerStyle = { height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: '#111', color: '#10b981', textAlign: 'center', padding: '20px' };
const successStyle = { ...containerStyle, background: '#064e3b', color: 'white' };
const startBtn = { padding: '20px 40px', fontSize: '1.5rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '50px', fontWeight: 'bold' };
