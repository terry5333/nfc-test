import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  // ... 其他欄位
};

// 增加一個防錯機制，防止 Config 為空時崩潰
if (!firebaseConfig.apiKey) {
  console.error("Firebase API Key 遺失，請檢查環境變數！");
}

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
