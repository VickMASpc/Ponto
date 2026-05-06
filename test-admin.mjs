import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { firebaseConfig } from "./firebase-config.js";

async function testAdminCreation() {
  console.log("Starting test...");
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  
  const itCode = "Admin123"; // Dummy code, we will read the real one first
  
  try {
    console.log("Checking system/config...");
    const snap = await getDoc(doc(db, "system", "config"));
    if (!snap.exists()) {
      console.log("system/config does not exist!");
      return;
    }
    const realCode = snap.data().it_access_code;
    console.log("Real IT Code found:", typeof realCode, `'${realCode}'`);
    
    // Attempt creation
    console.log("Creating secondary app...");
    const secondaryApp = initializeApp(firebaseConfig, `admin-create-${Date.now()}`);
    const secondaryAuth = getAuth(secondaryApp);
    
    const email = `test-admin-${Date.now()}@example.com`;
    const password = "password123";
    
    console.log(`Creating user in Auth: ${email}`);
    const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    console.log("User created in Auth! UID:", credential.user.uid);
    
    console.log("Attempting setDoc with main db instance...");
    await setDoc(doc(db, "users", credential.user.uid), {
      email,
      role: "admin",
      active: true,
      it_access_code: realCode,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    console.log("SUCCESS! Admin document created.");
    
    await deleteApp(secondaryApp);
  } catch (error) {
    console.error("ERROR CAUGHT:");
    console.error(error.code, error.message);
  } finally {
    console.log("Test finished.");
    process.exit(0);
  }
}

testAdminCreation();
