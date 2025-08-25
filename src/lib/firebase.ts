import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Firebase 설정
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyBuqtsInY2RwGsAtblcZbVLz-75S82VUmc",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "flowershoper-pv1.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "flowershoper-pv1",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "flowershoper-pv1.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "875038211942",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:875038211942:web:31f55a6c1558481ca152a7"
};

// Initialize Firebase
let app;
let auth;
let storage;
let db;

// Firebase 초기화 함수
const initializeFirebase = () => {
  try {
    // 앱이 이미 초기화되었는지 확인
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
      console.log('Firebase app initialized successfully');
    } else {
      app = getApp();
      console.log('Using existing Firebase app');
    }
    
    // Firebase 설정 로그
    console.log('Firebase configuration loaded:', {
      projectId: firebaseConfig.projectId,
      authDomain: firebaseConfig.authDomain
    });

    // Auth 초기화
    auth = getAuth(app);
    console.log('Firebase Auth initialized');

    // Storage 초기화
    storage = getStorage(app);
    console.log('Firebase Storage initialized');

    // Firestore 초기화 - 단순화된 설정
    try {
      db = initializeFirestore(app, {
        experimentalForceLongPolling: true,
        cacheSizeBytes: 50 * 1024 * 1024,
        ignoreUndefinedProperties: true,
      });
      console.log('Firestore initialized with custom settings');
    } catch (error) {
      console.warn('Firestore initialization failed, falling back to default:', error);
      db = getFirestore(app);
      console.log('Firestore initialized with default settings');
    }

    return { app, auth, db, storage };

  } catch (error) {
    console.error('Firebase initialization error:', error);
    throw error;
  }
};

// 클라이언트 사이드에서만 초기화
if (typeof window !== 'undefined') {
  try {
    const firebaseInstance = initializeFirebase();
    app = firebaseInstance.app;
    auth = firebaseInstance.auth;
    db = firebaseInstance.db;
    storage = firebaseInstance.storage;
    console.log('Firebase initialization completed successfully');
  } catch (error) {
    console.error('Failed to initialize Firebase:', error);
  }
}

// Firebase 인스턴스 내보내기
export { app, auth, db, storage };

// 간단한 Firestore 연결 확인 함수
export const checkFirestoreConnection = async () => {
  if (!db) {
    console.error('Firestore not initialized');
    return false;
  }
  
  try {
    const { collection } = await import('firebase/firestore');
    const testQuery = collection(db, 'test');
    return true;
  } catch (error) {
    console.error('Firestore connection test failed:', error);
    return false;
  }
};
