import { useEffect, useState, useRef } from 'react';
import { BrowserMultiFormatReader } from '@zxing/library'; // 🚩 換成專業 ZXing
import { db } from '../lib/firebase';
import { ref, get, set, push, serverTimestamp } from 'firebase/database';

export default function MobileStation() {
  const [status, setStatus] = useState("等待啟動...");
  const [isDone, setIsDone] = useState(false);
  const videoRef = useRef(null);
  const codeReader = new BrowserMultiFormatReader();

  const startSensors = async () => {
    setStatus("🚀 專業鏡頭啟動中...");
    
    // 1. 啟動 NFC (Android 專屬)
    if ('NDEFReader' in window) {
      try {
        const ndef = new NDEFReader();
        await ndef.scan();
        ndef.onreading = (event) => handleProcess(event.serialNumber, "NFC");
      } catch (e) { console.error("NFC Error", e); }
    }

    // 2. 啟動 ZXing 條碼掃描
    try {
      // 🚩 直接開始掃描並掛載到 videoRef
      codeReader.decodeFromVideoDevice(null, videoRef.current, (result, err) => {
        if (result) {
          handleProcess(result.getText(), "BARCODE");
        }
      });
      setStatus("📡 監控中：請靠近感應或掃描");
    } catch (err) {
      console.error(err);
      setStatus("❌ 鏡頭啟動失敗");
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
      setStatus("📡 監控中...");
    }, 3000);
  };

  return (
    <div style={isDone ? successBg : normalBg}>
      <h1 style={{ fontSize: '1.2rem', marginBottom: '10px' }}>TERRY EDU STATION (ZXing)</h1>
      
      {/* 🚩 這次我們直接放 Video 標籤，保證看得到畫面 */}
      <div style={scanWindow}>
        <video 
          ref={videoRef} 
          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
        />
        <div style={redLine}></div>
        {isDone && <div style={overlay}>✅</div>}
      </div>

      <p style={statusText}>{status}</p>
      {!isDone && <button onClick={startSensors} style={btnStyle}>點擊啟動監控</button>}
    </div>
  );
}

// 樣式保持專業感
const normalBg = { height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#000', color: '#10b981', textAlign: 'center' };
const successBg = { ...normalBg, background: '#064e3b', color: '#fff' };
const scanWindow = { width: '90%', maxWidth: '400px', height: '300px', background: '#222', borderRadius: '20px', position: 'relative', overflow: 'hidden', border: '3px solid #334155' };
const redLine = { position: 'absolute', top: '50%', left: '5%', width: '90%', height: '2px', background: 'rgba(239, 68, 68, 0.7)', zIndex: 10, boxShadow: '0 0 10px red' };
const overlay = { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(6, 78, 59, 0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '5rem', zIndex: 20 };
const statusText = { fontSize: '1.2rem', margin: '30px', fontWeight: 'bold' };
const btnStyle = { padding: '15px 40px', background: '#10b981', color: 'white', border: 'none', borderRadius: '50px', fontSize: '1.2rem', fontWeight: 'bold' };
