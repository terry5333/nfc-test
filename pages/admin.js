import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { ref, onValue, remove, set } from 'firebase/database';

export default function Admin() {
  const [teachers, setTeachers] = useState([]); // 使用陣列存儲方便顯示
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 🚩 指向 Firebase 中的授權名單節點
    const teachersRef = ref(db, 'authorized_cards');

    // 開始監聽
    const unsubscribe = onValue(teachersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Firebase 回傳的是物件 { ID1: {name...}, ID2: {name...} }
        // 我們把它轉成陣列 [{id: ID1, ...}, {id: ID2, ...}]
        const teacherList = Object.keys(data).map(key => ({
          dbKey: key, // 這是資料庫裡的 Key (通常是卡號)
          ...data[key]
        }));
        setTeachers(teacherList);
      } else {
        setTeachers([]); // 如果沒資料就設為空
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 刪除老師功能
  const deleteTeacher = (dbKey) => {
    if (confirm("確定要刪除這位老師的權限嗎？")) {
      remove(ref(db, `authorized_cards/${dbKey}`));
    }
  };

  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h1>🛠️ TerryEdu 管理後台</h1>
      
      <section style={{ marginTop: '30px' }}>
        <h3>🍎 老師授權清單</h3>
        {loading ? (
          <p>讀取中...</p>
        ) : teachers.length > 0 ? (
          <div style={listStyle}>
            {teachers.map((t) => (
              <div key={t.dbKey} style={itemStyle}>
                <div>
                  <strong style={{ fontSize: '1.2rem' }}>{t.name}</strong>
                  <div style={{ fontSize: '0.8rem', color: '#666' }}>ID: {t.id}</div>
                </div>
                <button onClick={() => deleteTeacher(t.dbKey)} style={delBtnStyle}>
                  移除
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div style={emptyStyle}>
            目前名單為空，請先感應卡片並完成註冊。
          </div>
        )}
      </section>
    </div>
  );
}

// 樣式參考
const listStyle = { border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' };
const itemStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', borderBottom: '1px solid #f1f5f9', background: 'white' };
const delBtnStyle = { background: '#fee2e2', color: '#ef4444', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer' };
const emptyStyle = { padding: '40px', textAlign: 'center', color: '#94a3b8', background: '#f8fafc', borderRadius: '10px', border: '2px dashed #e2e8f0' };
