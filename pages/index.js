import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { db } from '../lib/firebase';
import { ref, onValue, get } from 'firebase/database';

export default function Home() {
  const router = useRouter();
  const [status, setStatus] = useState("🔒 系統鎖定中，待感應...");
  const [isError, setIsError] = useState(false);
  
  // 從 Vercel Env 抓取你的神之卡 ID
  const MY_GOD_CARD = process.env.NEXT_PUBLIC_MY_GOD_CARD;

  useEffect(() => {
    const scanRef = ref(db, 'system/last_scan');
    
    // 監聽 Firebase 上的掃描紀錄
    const unsubscribe = onValue(scanRef, async (snapshot) => {
      const data = snapshot.val();
      if (!data) return;

      const cardId = data.id;
      console.log("偵測到卡片感應:", cardId);

      // 1. 判斷是否為管理員（神之卡）
      if (cardId === MY_GOD_CARD) {
        setStatus("✅ 管理員驗證成功，正在進入後台...");
        setIsError(false);
        setTimeout(() => router.push('/admin'), 800);
        return;
      }

      // 2. 判斷是否為已註冊的教師
      try {
        const cleanId = cardId.replace(/:/g, ''); // 移除冒號作為 Key
        const userSnap = await get(ref(db, `authorized_cards/${cleanId}`));
        
        if (userSnap.exists()) {
          const userData = userSnap.val();
          setStatus(`👋 歡迎 ${userData.name} 老師，登入中...`);
          setIsError(false);
          setTimeout(() => router.push('/teacher'), 800);
        } else {
          setStatus(`🚫 未知卡片 (${cardId})，請聯繫組長。`);
          setIsError(true);
        }
      } catch (err) {
        console.error("Firebase 讀取錯誤:", err);
      }
    });

    return () => unsubscribe();
  }, [router, MY_GOD_CARD]);

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '10px' }}>TERRY EDU</h1>
        <div style={{ fontSize: '4rem', marginBottom: '20px' }}>{isError ? '❌' : '🛡️'}</div>
        <p style={{ fontSize: '1.2rem', color: isError ? '#ff4b2b' : '#00d2ff' }}>{status}</p>
        <div style={footerStyle}>請在門口手機感應器出示證件</div>
      </div>
    </div>
  );
}

// 簡單的 CSS-in-JS 讓畫面有 Vibe
const containerStyle = { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0f172a', color: 'white', fontFamily: 'sans-serif' };
const cardStyle = { textAlign: 'center', padding: '50px', borderRadius: '30px', background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' };
const footerStyle = { marginTop: '30px', fontSize: '0.9rem', opacity: 0.5 };
