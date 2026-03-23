import { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { ref, onValue, get, push, set, serverTimestamp } from 'firebase/database';

export default function UnifiedScanStation() {
  const [status, setStatus] = useState("⌛ 系統待命：請感應或掃描");
  const [isSuccess, setIsSuccess] = useState(false);
  const [isClient, setIsClient] = useState(false); // 🚩 確保是瀏覽器環境

  useEffect(() => {
    setIsClient(true);
    
    // 1. NFC 監聽 (不受鏡頭影響)
    const scanRef = ref(db, 'system/last_scan');
    const unsubscribe = onValue(scanRef, (snapshot) => {
      const data = snapshot.val();
      if (data && data.id) handleProcess(data.id, "NFC/ID");
    });

    // 2. 條碼掃描 (放在動態載入中)
    let html5QrCode;
    const startScanner = async () => {
      try {
        const { Html5QrcodeScanner } = await import("html5-qrcode");
        html5QrCode = new Html5QrcodeScanner("reader", { 
          fps: 10, 
          qrbox: { width: 250, height: 150 },
          rememberLastUsedCamera: true
        });
        html5QrCode.render(onScanSuccess, onScanError);
      } catch (err) {
        console.error("掃描器啟動失敗:", err);
        setStatus("⚠️ 鏡頭啟動失敗，請使用 NFC 感應");
      }
    };

    if (typeof window !== 'undefined') startScanner();

    return () => {
      unsubscribe();
      if (html5QrCode) html5QrCode.clear();
    };
  }, []);

  const onScanSuccess = (decodedText) => handleProcess(decodedText, "BARCODE");
  const onScanError = (err) => { /* 掃描中正常的尋找條碼錯誤，不處理 */ };

  async function handleProcess(cardId, type) {
    if (isSuccess) return;
    const cleanId = cardId.replace(/[\s:]/g, '').toUpperCase();
    
    try {
      const teacherSnap = await get(ref(db, `authorized_cards/${cleanId}`));
      if (teacherSnap.exists()) {
        setStatus(`🍎 老師好：${teacherSnap.val().name}`);
      } else {
        setStatus(`🎒 學生打卡：${cleanId.substring(0, 8)}`);
        await push(ref(db, 'student_logs'), { id: cleanId, time: serverTimestamp(), type });
      }
      
      setIsSuccess(true);
      await set(ref(db, 'system/last_scan'), null);
      setTimeout(() => {
        setIsSuccess(false);
        setStatus("⌛ 系統待命：請感應或掃描");
      }, 3000);
    } catch (e) {
      console.error("處理失敗:", e);
    }
  }

  if (!isClient) return null; // 預防伺服器端渲染錯誤

  return (
    <div style={isSuccess ? successBg : normalBg}>
      <h1 style={{ fontSize: '2.5rem' }}>TERRY EDU</h1>
      
      {/* 🚩 掃描器容器：確保 ID 叫 reader */}
      <div id="reader" style={{ width: '100%', maxWidth: '400px', margin: '20px auto', display: isSuccess ? 'none' : 'block' }}></div>
      
      <p style={{ fontSize: '1.5rem', fontWeight: 'bold', padding: '20px' }}>{status}</p>
      <div style={{ opacity: 0.5 }}>[ 支援 ID卡 / IC卡 / 條碼 ]</div>
    </div>
  );
}

const normalBg = { height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: '#0f172a', color: 'white', textAlign: 'center' };
const successBg = { ...normalBg, background: '#064e3b' };
