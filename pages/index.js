import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { db } from '../lib/firebase';
import { ref, onValue, get } from 'firebase/database';

export default function Home() {
  const router = useRouter();
  const [status, setStatus] = useState("等待感應...");
  const MY_GOD_CARD = process.env.NEXT_PUBLIC_MY_GOD_CARD;

  useEffect(() => {
    const scanRef = ref(db, 'system/last_scan');
    return onValue(scanRef, async (snapshot) => {
      const data = snapshot.val();
      if (!data) return;

      const cardId = data.id;
      
      // 1. 判定是否為管理員
      if (cardId === MY_GOD_CARD) {
        router.push('/admin');
        return;
      }

      // 2. 判定是否為已授權教師
      const userSnap = await get(ref(db, `authorized_cards/${cardId.replace(/:/g, '')}`));
      if (userSnap.exists() && userSnap.val().role === 'teacher') {
        router.push('/teacher');
      } else {
        setStatus(`未知卡片：${cardId} (請聯絡管理員)`);
      }
    });
  }, [router, MY_GOD_CARD]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#1a1a2e', color: 'white', textAlign: 'center' }}>
      <div>
        <h1 style={{ fontSize: '3rem' }}>🛡️ TERRY EDU</h1>
        <p style={{ fontSize: '1.5rem', color: '#00d2ff' }}>{status}</p>
        <p>請在門口感應器出示您的證件</p>
      </div>
    </div>
  );
}
