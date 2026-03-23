import { useEffect, useState, useRef } from 'react';
import Quagga from '@ericblade/quagga2';
import { db } from '../lib/firebase';
import { ref, get, set, push, serverTimestamp } from 'firebase/database';

export default function MobileStation() {
  const [status, setStatus] = useState("等待啟動...");
  const [isDone, setIsDone] = useState(false);
  const scannerRef = useRef(null);

  // --- 1. 啟動所有感測器 ---
  const startSensors = async () => {
    setStatus("📡 監控中：請靠近卡片或掃描條碼");
    
    // A. 啟動 NFC (Web NFC API)
    if ('NDEFReader' in window) {
      try {
        const ndef = new NDEFReader();
        await ndef.scan();
        ndef.onreading = (event) => {
          console.log("NFC 偵測到 ID:", event.serialNumber);
          handleProcess(event.serialNumber, "NFC");
        };
      } catch (error) {
        console.error("NFC 啟動失敗:", error);
      }
    } else {
      console.log("此裝置不支援 NFC");
    }

    // B. 啟動專業條碼掃描 (Quagga)
    Quagga.init({
      inputStream: {
        type: "LiveStream",
        constraints: { width: 1280, height: 720, facingMode: "environment" },
        target: scannerRef.current
      },
      decoder: { readers: ["code_128_reader", "code_39_reader"] },
      locate: true
    }, (err) => {
      if (!err) Quagga.start();
    });

    Quagga.onDetected((res) => {
      if (res.codeResult.confidence > 0.6) {
        handleProcess(res.codeResult.code, "BARCODE");
      }
    });
  };

  // --- 2. 統一處理判斷邏輯 ---
  const handleProcess = async (cardId, type) => {
    if (isDone) return;
    const cleanId = cardId.replace(/[\s:]/g, '').toUpperCase();
    
    setIsDone(true);
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]); // 成功時震動兩下

    try {
      const snap = await get(ref(db, `authorized_cards/${cleanId}`));
      
      if (snap.exists()) {
        const user = snap.val();
        setStatus(`✅ ${user.name} (${user.role === 'teacher' ? '老師' : '學生'})`);
        
        if (user.role === 'teacher') {
          // 老師：觸發電腦端跳轉
          await set(ref(db, 'system/last_scan'), { id: cleanId, time: Date.now() });
        } else {
          // 學生：純紀錄
          await push(ref(db, 'student_logs'), { name: user.name, id: cleanId, time: serverTimestamp(), type });
        }
      } else {
        // 未註冊：傳給 Admin 畫面
        setStatus(`⚠️ 未註冊卡號：${cleanId}`);
        await set(ref(db, 'system/last_scan'), { id: cleanId, time: Date.now() });
      }
    } catch (e) {
      setStatus("連線錯誤");
    }

    // 3 秒後重置
    setTimeout(() => {
      setIsDone(false);
      setStatus("📡 監控中：請靠近或掃描");
    }, 3000);
  };

  return (
    <div style={isDone ? successBg : normalBg}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '10px' }}>TERRY EDU STATION</h1>
      
      <div ref={scannerRef} style={scanWindow}>
        <div style={nfcIcon}>{(isDone) ? "✅" : "📡"}</div>
        <p style={{ position: 'absolute', bottom: '10px', width: '100%', textAlign: 'center', color: '#fff', fontSize: '0.8rem' }}>
          感應區：手機背面鏡頭旁
        </p>
      </div>

      <p style={statusText}>{status}</p>
      
      {!isDone && <button onClick={startSensors} style={btnStyle}>點擊啟動監控</button>}
      
      <div style={{ marginTop: '20px', opacity: 0.4, fontSize: '0.8rem' }}>
        支援 NFC 感應 & 1D 條碼掃描
      </div>
    </div>
  );
}

// 樣式
const normalBg = { height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#000', color: '#10b981', fontFamily: 'sans-serif' };
const successBg = { ...normalBg, background: '#064e3b', color: '#fff' };
const scanWindow = { width: '90%', maxWidth: '400px', height: '250px', background: '#222', borderRadius: '20px', position: 'relative', overflow: 'hidden', border: '2px solid #333' };
const nfcIcon = { fontSize: '5rem', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' };
const statusText = { fontSize: '1.2rem', margin: '30px', fontWeight: 'bold' };
const btnStyle = { padding: '15px 40px', background: '#10b981', color: 'white', border: 'none', borderRadius: '50px', fontSize: '1.2rem', fontWeight: 'bold' };
