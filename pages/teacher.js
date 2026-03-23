export default function Teacher() {
  return (
    <div style={{ padding: '50px', textAlign: 'center' }}>
      <h1>👨‍🏫 教師工作站</h1>
      <div style={{ border: '2px solid #3498db', padding: '30px', borderRadius: '20px' }}>
        <h2>歡迎回來！</h2>
        <p>今日課表：資訊科學 (09:00)</p>
        <button style={{ padding: '10px 20px', background: '#3498db', color: 'white', border: 'none' }}>開始點名</button>
      </div>
      <button onClick={()=>window.location.href='/'} style={{ marginTop: '50px' }}>退出</button>
    </div>
  );
}
