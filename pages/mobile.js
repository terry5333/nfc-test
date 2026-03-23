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
        const ndef = new NDEFReader();
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
