import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { ref, onValue } from 'firebase/database';

export default function AdminDashboard() {
  const [teachers, setTeachers] = useState({});
  const [studentLogs, setStudentLogs] = useState([]);

  useEffect(() => {
    // 讀取老師名單
    onValue(ref(db, 'authorized_cards'), s => setTeachers(s.val() || {}));
    // 讀取最近學生打卡 (最後 20 筆)
    onValue(ref(db, 'student_logs'), s => {
      const data = s.val();
      if (data) setStudentLogs(Object.values(data).reverse().slice(0, 20));
    });
  }, []);

  return (
    <div style={{ padding: '30px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
      <section>
        <h2>🍎 老師授權清單</h2>
        {Object.entries(teachers).map(([id, t]) => (
          <div key={id} style={cardItem}>{t.name} <small>({id})</small></div>
        ))}
      </section>
      
      <section>
        <h2>🎒 學生打卡紀錄</h2>
        {studentLogs.map((log, i) => (
          <div key={i} style={logItem}>
            <span>{new Date(log.time).toLocaleTimeString()}</span>
            <b>{log.id.substring(0,10)}...</b>
          </div>
        ))}
      </section>
    </div>
  );
}

const cardItem = { padding: '10px', background: '#f1f5f9', marginBottom: '5px', borderRadius: '5px' };
const logItem = { display: 'flex', justifyContent: 'space-between', padding: '8px', borderBottom: '1px solid #eee' };
