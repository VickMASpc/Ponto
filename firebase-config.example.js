// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
export const firebaseConfig = {
  apiKey: "AIzaSyCi9ZcclGbW5Mbwbs56HRVYz_fy6OQDJB0",
  authDomain: "clockin-2539b.firebaseapp.com",
  projectId: "clockin-2539b",
  storageBucket: "clockin-2539b.firebasestorage.app",
  messagingSenderId: "1092584651468",
  appId: "1:1092584651468:web:588110f4515d296b0c2069",
  measurementId: "G-569VXD85VM"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);