import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { db } from '../lib/firebase';
import { ref, onValue, set, remove } from 'firebase/database';

export default function Admin() {
  const router = useRouter();
  const [lastScanId, setLastScanId] = useState("");
  const [cardList, setCardList] = useState({});
  const [newName, setNewName] = useState("");

  useEffect(() => {
    onValue(ref(db, 'system/last_scan'), (s) => setLastScanId(s.val()?.id || ""));
    onValue(ref(db, 'authorized_cards'), (s) => setCardList(s.val() || {}));
  }, []);

  const handleAdd = async () => {
    if (!newName || !lastScanId) return alert("請輸入姓名並感應卡片");
    const cleanId = lastScanId.replace(/:/g, '');
    await set(ref(db, `authorized_cards/${cleanId}`), { name: newName, id: lastScanId, role: 'teacher' });
    
    // 🚩 註冊完後，把當前掃描到的 ID 擦掉，避免重複註冊
    await set(ref(db, 'system/last_scan'), null);
    setNewName("");
    alert("註冊成功！");
  };

  const clearScan = () => set(ref(db, 'system/last_scan'), null);

  return (
    <div style={{ padding: '30px', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h1>🛠️ 管理員控制台</h1>
      
      <div style={{ background: '#f1f5f9', padding: '20px', borderRadius: '15px', marginBottom: '20px' }}>
        <h3>🆕 快速註冊名單</h3>
        <p>當前感應 ID：<b style={{color: '#1e293b'}}>{lastScanId || "等待新卡感應..."}</b></p>
        {lastScanId && <button onClick={clearScan} style={{marginBottom:'10px'}}>重置感應狀態</button>}
        <br />
        <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="輸入姓名" style={{padding:'8px'}} />
        <button onClick={handleAdd} style={{padding:'8px 15px', marginLeft:'10px', background:'#0f172a', color:'white'}}>確認新增</button>
      </div>

      <h3>👥 已授權名單</h3>
      {Object.entries(cardList).map(([key, val]) => (
        <div key={key} style={{ padding: '10px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between' }}>
          <span>{val.name} (ID: {val.id})</span>
          <button onClick={() => remove(ref(db, `authorized_cards/${key}`))} style={{color:'red'}}>刪除</button>
        </div>
      ))}
      <br />
      <button onClick={() => router.push('/')}>登出系統</button>
    </div>
  );
}
