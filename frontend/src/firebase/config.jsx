import { initializeApp, getApps } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "WEB_API_KEY",
  authDomain: "tellustheodds-chat.firebaseapp.com",
  databaseURL: "https://tellustheodd-default-rtdb.firebaseio.com",
  projectId: "TellUSTheOdd",
  storageBucket: "TellUSTheOdd.appspot.com",
  messagingSenderId: "SENDER_ID",
  appId: "APP_ID",
};

const fbApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const db = getDatabase(fbApp);
export const API = "http://192.168.0.245:8000";