import { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { ref, onValue, set, remove, push } from 'firebase/database';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('students'); // 'students', 'attendance', 'teachers'
  const [lastScan, setLastScan] = useState("");

  // 資料狀態
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [logs, setLogs] = useState([]);

  // 表單狀態
  const [newStudent, setNewStudent] = useState({ classInfo: '', seat: '', name: '' });
  const [newTeacherName, setNewTeacherName] = useState("");
  const [bindingTarget, setBindingTarget] = useState(null); // 正在等待綁卡的學生 ID

  useEffect(() => {
    // 監聽最新感應卡號
    onValue(ref(db, 'system/last_scan'), (s) => {
      const data = s.val();
      if (data && data.id) setLastScan(data.id.replace(/[\s:]/g, '').toUpperCase());
    });

    // 監聽學生名冊
    onValue(ref(db, 'school_roster'), (s) => {
      const data = s.val();
      setStudents(data ? Object.keys(data).map(k => ({ dbId: k, ...data[k] })) : []);
    });

    // 監聽老師名單
    onValue(ref(db, 'authorized_cards'), (s) => {
      const data = s.val();
      if (data) {
        const tList = Object.keys(data)
          .map(k => ({ cardId: k, ...data[k] }))
          .filter(item => item.role === 'teacher');
        setTeachers(tList);
      } else { setTeachers([]); }
    });

    // 監聽打卡紀錄 (反轉排序，最新的在最前)
    onValue(ref(db, 'student_logs'), (s) => {
      const data = s.val();
      setLogs(data ? Object.values(data).reverse() : []);
    });
  }, []);

  // -------------------------
  // 區塊 1: 學生預填與綁卡
  // -------------------------
  const handleAddStudent = async () => {
    if (!newStudent.name || !newStudent.classInfo) return alert("請填寫班級與姓名");
    await push(ref(db, 'school_roster'), { ...newStudent, cardId: null });
    setNewStudent({ classInfo: '', seat: '', name: '' });
  };

  const startBinding = (student) => {
    setBindingTarget(student);
    setLastScan(""); // 清空之前的紀錄，等待新卡
  };

  const confirmBinding = async () => {
    if (!lastScan || !bindingTarget) return;
    // 1. 更新學生名冊的卡號
    await set(ref(db, `school_roster/${bindingTarget.dbId}/cardId`), lastScan);
    // 2. 寫入授權卡片庫，賦予學生打卡權限
    await set(ref(db, `authorized_cards/${lastScan}`), {
      name: `${bindingTarget.classInfo}-${bindingTarget.seat} ${bindingTarget.name}`,
      role: 'student',
      refId: bindingTarget.dbId
    });
    setBindingTarget(null);
    setLastScan("");
    alert("✅ 學生綁卡成功！");
  };

  // -------------------------
  // 區塊 3: 老師註冊
  // -------------------------
  const handleAddTeacher = async () => {
    if (!lastScan || !newTeacherName) return alert("請感應卡片並填寫老師姓名");
    await set(ref(db, `authorized_cards/${lastScan}`), { name: newTeacherName, role: 'teacher' });
    setNewTeacherName("");
    setLastScan("");
    alert("✅ 老師註冊成功！");
  };

  // --- 介面渲染 ---
  return (
    <div style={layout}>
      <header style={header}>
        <h2>⚙️ TerryEdu 核心管理系統</h2>
        <div style={tabs}>
          <button onClick={() => setActiveTab('students')} style={activeTab === 'students' ? activeBtn : btn}>1. 學生註冊綁卡</button>
          <button onClick={() => setActiveTab('attendance')} style={activeTab === 'attendance' ? activeBtn : btn}>2. 打卡記錄管理</button>
          <button onClick={() => setActiveTab('teachers')} style={activeTab === 'teachers' ? activeBtn : btn}>3. 老師權限管理</button>
        </div>
      </header>

      <main style={mainContent}>
        {/* 區塊 1：快速註冊 */}
        {activeTab === 'students' && (
          <div>
            <h3>🎒 預填全校名單 & 綁定卡片</h3>
            <div style={formCard}>
              <input placeholder="班級 (例:201)" value={newStudent.classInfo} onChange={e => setNewStudent({...newStudent, classInfo: e.target.value})} style={input} />
              <input placeholder="座號 (例:05)" value={newStudent.seat} onChange={e => setNewStudent({...newStudent, seat: e.target.value})} style={input} />
              <input placeholder="姓名" value={newStudent.name} onChange={e => setNewStudent({...newStudent, name: e.target.value})} style={input} />
              <button onClick={handleAddStudent} style={actionBtn}>新增至名冊</button>
            </div>

            {bindingTarget && (
              <div style={alertBox}>
                ⚠️ 正在為 <b>{bindingTarget.name}</b> 綁卡。<br/>
                請感應卡片... 目前感應到: <code>{lastScan || "等待中"}</code>
                {lastScan && <button onClick={confirmBinding} style={confirmBtn}>確認綁定</button>}
                <button onClick={() => setBindingTarget(null)} style={cancelBtn}>取消</button>
              </div>
            )}

            <table style={table}>
              <thead><tr><th>班級</th><th>座號</th><th>姓名</th><th>卡片狀態</th><th>操作</th></tr></thead>
              <tbody>
                {students.map(s => (
                  <tr key={s.dbId}>
                    <td>{s.classInfo}</td><td>{s.seat}</td><td>{s.name}</td>
                    <td>{s.cardId ? <span style={{color:'green'}}>已綁定</span> : <span style={{color:'red'}}>未綁定</span>}</td>
                    <td>
                      {!s.cardId && <button onClick={() => startBinding(s)} style={actionBtn}>+ 註冊卡片</button>}
                      {s.cardId && <button onClick={() => remove(ref(db, `authorized_cards/${s.cardId}`)).then(()=>set(ref(db, `school_roster/${s.dbId}/cardId`), null))} style={cancelBtn}>解除</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 區塊 2：打卡管理 */}
        {activeTab === 'attendance' && (
          <div>
            <h3>📊 學生打卡即時紀錄</h3>
            <table style={table}>
              <thead><tr><th>打卡時間</th><th>學生姓名</th><th>卡號</th></tr></thead>
              <tbody>
                {logs.slice(0, 100).map((log, i) => (
                  <tr key={i}>
                    <td>{new Date(log.time).toLocaleString()}</td>
                    <td><b>{log.name}</b></td>
                    <td><code>{log.id}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 區塊 3：老師管理 */}
        {activeTab === 'teachers' && (
          <div>
            <h3>🍎 老師授權清單</h3>
            <div style={formCard}>
              <p>請感應老師卡片：<code>{lastScan || "等待感應..."}</code></p>
              <input placeholder="輸入老師姓名" value={newTeacherName} onChange={e => setNewTeacherName(e.target.value)} style={input} />
              <button onClick={handleAddTeacher} style={actionBtn}>新增老師</button>
            </div>
            
            <table style={table}>
              <thead><tr><th>老師姓名</th><th>綁定卡號</th><th>操作</th></tr></thead>
              <tbody>
                {teachers.map(t => (
                  <tr key={t.cardId}>
                    <td>{t.name}</td><td><code>{t.cardId}</code></td>
                    <td><button onClick={() => remove(ref(db, `authorized_cards/${t.cardId}`))} style={cancelBtn}>移除</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

// --- 樣式定義 ---
const layout = { padding: '20px', maxWidth: '1000px', margin: '0 auto', fontFamily: 'sans-serif' };
const header = { borderBottom: '2px solid #e2e8f0', paddingBottom: '20px', marginBottom: '20px' };
const tabs = { display: 'flex', gap: '10px' };
const btn = { padding: '10px 20px', border: '1px solid #cbd5e1', background: '#f8fafc', borderRadius: '8px', cursor: 'pointer' };
const activeBtn = { ...btn, background: '#0284c7', color: 'white', borderColor: '#0284c7', fontWeight: 'bold' };
const mainContent = { background: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' };
const formCard = { display: 'flex', gap: '10px', padding: '15px', background: '#f1f5f9', borderRadius: '8px', marginBottom: '20px', alignItems: 'center' };
const input = { padding: '8px', borderRadius: '5px', border: '1px solid #cbd5e1', flex: 1 };
const actionBtn = { padding: '8px 15px', background: '#10b981', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' };
const cancelBtn = { padding: '8px 15px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', marginLeft: '5px' };
const confirmBtn = { padding: '8px 15px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', marginLeft: '10px' };
const alertBox = { padding: '15px', background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '8px', marginBottom: '20px', color: '#b45309' };
const table = { width: '100%', borderCollapse: 'collapse', textAlign: 'left' };
// 為表格加入底線與 padding
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.innerHTML = `th, td { border-bottom: 1px solid #e2e8f0; padding: 12px; } th { background: #f8fafc; }`;
  document.head.appendChild(style);
}
