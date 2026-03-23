import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { ref, set, onValue, remove } from 'firebase/database';

export default function Admin() {
  const [idFromPhone, setIdFromPhone] = useState("");
  const [idFromIC, setIdFromIC] = useState("");
  const [list, setList] = useState({});
  const [name, setName] = useState("");

  useEffect(() => {
    // 監聽手機 ID
    onValue(ref(db, 'system/last_scan'), s => setIdFromPhone(s.val()?.id || ""));
    // 監聽地端 IC
    const timer = setInterval(async () => {
      try {
        const res = await fetch('http://localhost:5000/scan');
        const data = await res.json();
        setIdFromIC(data.status === "success" ? data.id : "");
      } catch (e) {}
    }, 1000);
    // 監聽名單
    onValue(ref(db, 'authorized_cards'), s => setList(s.val() || {}));
    return () => clearInterval(timer);
  }, []);

  const handleAdd = async (rawId) => {
    if (!name || !rawId) return alert("請輸入姓名並感應卡片");
    const cleanId = rawId.replace(/[\s:]/g, '');
    await set(ref(db, `authorized_cards/${cleanId}`), { name, id: rawId, role: 'teacher' });
    if (rawId === idFromPhone) await set(ref(db, 'system/last_scan'), null); // 清空手機快取
    setName("");
    alert("註冊成功！");
  };

  return (
    <div style={{ padding: '30px', fontFamily: 'sans-serif' }}>
      <h1>🛠️ 萬能權限管理 (ID + IC)</h1>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div style={{ background: '#e0f2fe', padding: '20px', borderRadius: '15px' }}>
          <h3>📲 手機感應 (ID/NFC)</h3>
          <p>ID: <b>{idFromPhone || "無"}</b></p>
          <button onClick={() => handleAdd(idFromPhone)} disabled={!idFromPhone}>註冊此 ID 卡</button>
        </div>
        
        <div style={idFromIC ? { background: '#fef3c7', padding: '20px', borderRadius: '15px' } : { background: '#f1f5f9', padding: '20px', borderRadius: '15px' }}>
          <h3>💳 讀卡機感應 (IC)</h3>
          <p>ID: <b>{idFromIC || "尚未插卡"}</b></p>
          <button onClick={() => handleAdd(idFromIC)} disabled={!idFromIC}>註冊此 IC 卡</button>
        </div>
      </div>

      <div style={{ marginTop: '20px' }}>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="先輸入姓名再點註冊" style={{padding:'10px', width:'250px'}} />
      </div>

      <hr />
      <h3>👥 已授權名單</h3>
      {Object.entries(list).map(([key, val]) => (
        <div key={key} style={{ padding: '10px', borderBottom: '1px solid #ddd' }}>
          {val.name} ({val.id}) <button onClick={()=>remove(ref(db, `authorized_cards/${key}`))}>刪除</button>
        </div>
      ))}
    </div>
  );
}
