import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { ref, onValue, set, remove } from 'firebase/database';

export default function Admin() {
  const [lastId, setLastId] = useState("");
  const [list, setList] = useState({});
  const [name, setName] = useState("");

  useEffect(() => {
    onValue(ref(db, 'system/last_scan'), s => setLastId(s.val()?.id || ""));
    onValue(ref(db, 'authorized_cards'), s => setList(s.val() || {}));
  }, []);

  const add = async () => {
    if (!name || !lastId) return;
    await set(ref(db, `authorized_cards/${lastId.replace(/:/g, '')}`), { name, id: lastId, role: 'teacher' });
    setName("");
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>🛠️ 管理員控制台</h1>
      <div style={{ background: '#eee', padding: '15px', marginBottom: '20px' }}>
        <p>最新掃描 ID：<b>{lastId}</b></p>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="教師姓名" />
        <button onClick={add}>註冊為教師卡</button>
      </div>
      <h3>授權名單</h3>
      {Object.entries(list).map(([key, val]) => (
        <div key={key} style={{ borderBottom: '1px solid #ccc', padding: '10px' }}>
          {val.name} - {val.id} <button onClick={()=>remove(ref(db, `authorized_cards/${key}`))}>刪除</button>
        </div>
      ))}
      <button onClick={()=>window.location.href='/'} style={{ marginTop: '20px' }}>登出系統</button>
    </div>
  );
}
