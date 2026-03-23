// 🚩 資料處理：精準比對 YYYY-MM-DD
  const generateDailyReport = () => {
    const dailyStatus = {};
    
    logs.forEach(log => {
      if (!log.time) return;
      
      const d = new Date(log.time);
      
      // 🚩 強制把 Firebase 的時間戳轉換成標準的 YYYY-MM-DD (避免時差與斜線問題)
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const logDate = `${year}-${month}-${day}`; 
      
      // 比對日期：如果打卡日期等於查詢日期，就塞進矩陣
      if (logDate === queryDate && log.id) {
        if (!dailyStatus[log.id]) dailyStatus[log.id] = {};
        // 記錄時間 (時:分:秒)
        dailyStatus[log.id][log.period || '上學'] = d.toLocaleTimeString('zh-TW', { hour12: false });
      }
    });

    // 排序學生 (先排班級，再排座號)
    const sortedStudents = [...students].sort((a, b) => {
      if (a.classInfo !== b.classInfo) return a.classInfo.localeCompare(b.classInfo);
      return a.seat.padStart(2, '0').localeCompare(b.seat.padStart(2, '0'));
    });

    return { sortedStudents, dailyStatus };
  };
