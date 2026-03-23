import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { db } from '../lib/firebase';
import { ref, onValue, get, set } from 'firebase/database';

export default function Home() {
  const router = useRouter();
  const [status, setStatus] = useState("🔒 系統鎖定中，請感應卡片...");
  const [isError, setIsError] = useState(false);
  
  // 從 Vercel Env 抓取你的管理員神之卡 ID
  const MY_GOD_CARD = process.env.NEXT_PUBLIC_MY_GOD_CARD;

  useEffect(() => {
    const scanRef = ref(db, 'system/last_scan');
    
    // 監聽 Firebase 上的掃描紀錄
    const unsubscribe = onValue(scanRef, async (snapshot) => {
      const data = snapshot.val();
      // 如果資料為空 (null)，代表目前沒有新卡感應
      if (!data || !data.id) {
        setStatus("🔒 系統鎖定中，待感應...");
        setIsError(false);
        return;
      }

      const cardId = data.id;

      // 1. 判定是否為管理員（神之卡）
      if (cardId === MY_GOD_CARD) {
        setStatus("✅ 管理員驗證成功，正在解鎖...");
        setIsError(false);
        
        // 🚩 關鍵：跳轉前先清空雲端資料，防止拔卡後重複讀取
        await set(ref(db, 'system/last_scan'), null);
        
        setTimeout(() => router.push('/admin'), 500);
        return;
      }

      // 2. 判定是否為已授權的教師
      const cleanId = cardId.replace(/:/g, ''); // 移除 ID 中的冒號
      const userSnap = await get(ref(db, `authorized_cards/${cleanId}`));
      
      if (userSnap.exists()) {
        const userData = userSnap.val();
        setStatus(`👋 歡迎 ${userData.name} 老師，登入中...`);
        setIsError(false);
        
        // 🚩 成功登入，同樣清空雲端資料
        await set(ref(db, 'system/last_scan'), null);
        
        setTimeout(() => router.push('/teacher'), 500);
      } else {
        setStatus(`🚫 未授權卡片 (${cardId})`);
        setIsError(true);
        // 未授權卡片不自動抹除，讓管理員可以在 /admin 頁面看到它並進行註冊
      }
    });

    return () => unsubscribe();
  }, [router, MY_GOD_CARD]);

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '10px' }}>TERRY EDU</h1>
        <div style={{ fontSize: '5rem', marginBottom: '20px' }}>{isError ? '❌' : '🛡️'}</div>
        <p style={{ fontSize: '1.2rem', color: isError ? '#ff4b2b' : '#00d2ff', fontWeight: 'bold' }}>{status}</p>
        <div style={{ marginTop: '30px', opacity: 0.5, fontSize: '0.9rem' }}>
          請在門口手機感應器出示證件
        </div>
      </div>
    </div>
  );
}

// UI 樣式
const containerStyle = { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0f172a', color: 'white', fontFamily: 'sans-serif' };
const cardStyle = { textAlign: 'center', padding: '60px', borderRadius: '40px', background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 25px 60px rgba(0,0,0,0.4)', width: '450px' };
