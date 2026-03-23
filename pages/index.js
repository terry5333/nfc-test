import { useEffect, useState } from 'react';
import { Html5QrcodeScanner } from "html5-qrcode";
import { db } from '../lib/firebase';
import { ref, get, push, set, serverTimestamp } from 'firebase/database';

export default function UnifiedScanStation() {
  const [status, setStatus] = useState("⌛ 系統待命：請感應卡片或掃描條碼");
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    // --- A. 條碼掃描初始化 ---
    const scanner = new Html5QrcodeScanner("reader", { 
      fps: 10, 
      qrbox: { width: 250, height: 150 } // 設定為長方形適合掃描條碼
    });

    scanner.render((decodedText) => {
      // 掃到條碼後的動作
      handleProcess(decodedText, "BARCODE");
    }, (error) => {
      // 掃描中的正常錯誤忽略
    });

    // --- B. 原有的 NFC 監聽邏輯 ---
    const scanRef = ref(db, 'system/last_scan');
    const unsubscribe = onValue(scanRef, (snapshot) => {
      const data = snapshot.val();
      if (data && data.id) handleProcess(data.id, "NFC/ID");
    });

    // --- C. 統一處理中心 ---
    async function handleProcess(cardId, type) {
      if (isSuccess) return; // 防止重複觸發

      const cleanId = cardId.replace(/[\s:]/g, '').toUpperCase();
      const teacherSnap = await get(ref(db, `authorized_cards/${cleanId}`));
      
      if (teacherSnap.exists()) {
        setStatus(`🍎 老師好：${teacherSnap.val().name}`);
      } else {
        setStatus(`🎒 學生打卡成功：${cleanId}`);
        await push(ref(db, 'student_logs'), { id: cleanId, time: serverTimestamp(), type: type });
      }

      setIsSuccess(true);
      await set(ref(db, 'system/last_scan'), null); // 清空 NFC 狀態

      setTimeout(() => {
        setIsSuccess(false);
        setStatus("⌛ 系統待命：請感應卡片或掃描條碼");
      }, 3000);
    }

    return () => {
      scanner.clear();
      unsubscribe();
    };
  }, [isSuccess]);

  return (
    <div style={isSuccess ? successBg : normalBg}>
      <h1 style={{ fontSize: '2.5rem' }}>{isSuccess ? "PASS" : "TERRY EDU 感應站"}</h1>
      
      {/* 條碼掃描顯示區域 */}
      {!isSuccess && (
        <div id="reader" style={{ width: '300px', margin: '20px auto', background: 'white', borderRadius: '10px' }}></div>
      )}
      
      <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{status}</p>
      
      <div style={{ marginTop: '20px', fontSize: '0.9rem', opacity: 0.6 }}>
        支援：身分證條碼 / 學生證條碼 / NFC / IC 卡
      </div>
    </div>
  );
}

const normalBg = { height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: '#0f172a', color: 'white', transition: '0.5s', textAlign: 'center' };
const successBg = { ...normalBg, background: '#064e3b' };
