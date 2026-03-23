import { useEffect, useState, useRef } from 'react';
import Quagga from '@ericblade/quagga2'; // 🚩 換成專業條碼庫
import { db } from '../lib/firebase';
import { ref, get, set, push, serverTimestamp } from 'firebase/database';

export default function MobileScanner() {
  const [status, setStatus] = useState("等待啟動...");
  const [isDone, setIsDone] = useState(false);
  const scannerRef = useRef(null);

  const startScanner = () => {
    setStatus("📡 專業掃描模式啟動...");
    Quagga.init({
      inputStream: {
        type: "LiveStream",
        constraints: { width: 640, height: 480, facingMode: "environment" },
        target: scannerRef.current
      },
      decoder: {
        // 🚩 針對身分證/學生證常見條碼優化
        readers: ["code_128_reader", "code_39_reader", "ean_reader"] 
      },
      locate: true // 🚩 自動定位條碼位置，不用對很準
    }, (err) => {
      if (err) return setStatus("相機啟動失敗");
      Quagga.start();
    });

    Quagga.onDetected((result) => {
      const code = result.codeResult.code;
      if (code) handleProcess(code, "BARCODE");
    });
  };

  const handleProcess = async (cardId, type) => {
    if (isDone) return;
    const cleanId = cardId.replace(/[\s:]/g, '').toUpperCase();
    setIsDone(true);
    if (navigator.vibrate) navigator.vibrate(200);

    const snap = await get(ref(db, `authorized_cards/${cleanId}`));
    if (snap.exists()) {
      const user = snap.val();
      if (user.role === 'teacher') {
        setStatus(`🍎 老師：${user.name}`);
        await set(ref(db, 'system/last_scan'), { id: cleanId, time: Date.now() });
      } else {
        setStatus(`🎒 學生：${user.name} 打卡成功`);
        await push(ref(db, 'student_logs'), { name: user.name, id: cleanId, time: serverTimestamp() });
      }
    } else {
      setStatus(`⚠️ 未註冊：${cleanId}`);
      // 傳給 Admin 方便組長直接註冊
      await set(ref(db, 'system/last_scan'), { id: cleanId, time: Date.now() });
    }

    setTimeout(() => { setIsDone(false); setStatus("📡 監控中..."); }, 3000);
  };

  return (
    <div style={containerStyle}>
      <h2 style={{ color: isDone ? '#fff' : '#10b981' }}>{isDone ? "SUCCESS" : "PROFESSIONAL SCANNER"}</h2>
      
      {/* 🚩 掃描預覽區域 */}
      <div ref={scannerRef} style={videoContainer}>
        {isDone && <div style={overlay}>✅</div>}
      </div>

      <p style={statusText}>{status}</p>
      <button onClick={startScanner} style={btn}>開啟鏡頭</button>
    </div>
  );
}

// 樣式：確保掃描框有專業感
const videoContainer = { width: '100%', maxWidth: '500px', height: '300px', position: 'relative', overflow: 'hidden', borderRadius: '20px', background: '#000' };
const overlay = { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(6, 78, 59, 0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '5rem', zIndex: 10 };
const containerStyle = { height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#111', color: 'white' };
const btn = { marginTop: '20px', padding: '15px 40px', background: '#10b981', border: 'none', borderRadius: '50px', color: 'white', fontWeight: 'bold' };
const statusText = { fontSize: '1.2rem', margin: '20px', textAlign: 'center' };
