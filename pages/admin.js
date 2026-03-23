import { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { ref, onValue, remove } from 'firebase/database';

export default function Admin() {
  const [teachers, setTeachers] = useState([]);

  useEffect(() => {
    // 🚩 修正路徑與資料轉換
    return onValue(ref(db, 'authorized_cards'), (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.keys(data).map(id => ({ dbId: id, ...data[id] }));
        setTeachers(list);
      } else {
        setTeachers([]);
      }
    });
  }, []);

  return (
    <div style={{ padding: '30px', maxWidth: '600px', margin: '0 auto' }}>
      <h2>🍎 老師授權清單 ({teachers.length})</h2>
      <div style={{ background: '#f8fafc', borderRadius: '15px', padding: '10px' }}>
        {teachers.length === 0 && <p>目前沒有授權資料</p>}
        {teachers.map(t => (
          <div key={t.dbId} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', borderBottom: '1px solid #ddd' }}>
            <span><b>{t.name}</b> <br/> <small>{t.dbId}</small></span>
            <button onClick={() => remove(ref(db, `authorized_cards/${t.dbId}`))} style={{ color: 'red' }}>移除</button>
          </div>
        ))}
      </div>
    </div>
  );
}
