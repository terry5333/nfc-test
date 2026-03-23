import { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { ref, onValue, get, push, set, serverTimestamp } from 'firebase/database';

export default function UnifiedScanStation() {
  const [status, setStatus] = useState("⌛ 系統待命列隊中...");
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    // 監聽感應紀錄 (NFC/ID)
    const scanRef = ref(db, 'system/last_scan');
    const unsubscribe = onValue(scanRef, async (snapshot) => {
      const data = snapshot.val();
      if (data && data.id) {
        handleProcess(data.id, "NFC/ID");
      }
    });

    // 處理感應流程
    async function handleProcess(cardId, type) {
      const cleanId = cardId.replace(/[\s:]/g, '').toUpperCase();
      
      // 1. 先查老師名單
      const teacherSnap = await get(ref(db, `authorized_cards/${cleanId}`));
      
      if (teacherSnap.exists()) {
        const teacher = teacherSnap.val();
        setStatus(`🍎 老師好：${teacher.name}`);
        setIsSuccess(true);
        // 老師卡感應後清空雲端並跳轉 (或是依組長需求停留在這)
        await set(ref(db, 'system/last_scan'), null);
        // setTimeout(() => router.push('/admin'), 1500); 
      } 
      else {
        // 2. 不是老師，就視為學生打卡
        setStatus(`🎒 學生打卡成功：${cardId.substring(0,8)}`);
        setIsSuccess(true);
        
        // 存入學生打卡紀錄
        await push(ref(db, 'student_logs'), {
          id: cardId,
          time: serverTimestamp(),
          type: type
        });

        // 🚩 關鍵：學生打卡完後立刻清空 ID，讓下一位能感應
        await set(ref(db, 'system/last_scan'), null);
      }

      // 3 秒後恢復待機狀態
      setTimeout(() => {
        setIsSuccess(false);
        setStatus("⌛ 系統待命列隊中...");
      }, 3000);
    }

    return () => unsubscribe();
  }, []);

  return (
    <div style={isSuccess ? successBg : normalBg}>
      <h1 style={{ fontSize: '4rem' }}>{isSuccess ? "PASS" : "TERRY EDU"}</h1>
      <p style={{ fontSize: '2rem' }}>{status}</p>
      <div style={{ marginTop: '50px', fontSize: '1.2rem', opacity: 0.5 }}>
        支援：學生證 / 悠遊卡 / 健保卡
      </div>
    </div>
  );
}

const normalBg = { height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: '#0f172a', color: 'white', transition: '0.5s' };
const successBg = { ...normalBg, background: '#064e3b' };
