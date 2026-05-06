import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { firebaseConfig } from "./firebase-config.js";

async function testAuthAdminCreation() {
  console.log("Starting auth test...");
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const auth = getAuth(app);
  
  const snap = await getDoc(doc(db, "system", "config"));
  const realCode = snap.data().it_access_code;
  
  // First create a regular worker user
  const workerEmail = `worker-${Date.now()}@example.com`;
  console.log("Creating worker...");
  await createUserWithEmailAndPassword(auth, workerEmail, "password");
  console.log("Logged in as worker!", auth.currentUser.uid);
  
  // Attempt creation
  console.log("Creating secondary app...");
  const secondaryApp = initializeApp(firebaseConfig, `admin-create-${Date.now()}`);
  const secondaryAuth = getAuth(secondaryApp);
  
  const email = `test-admin-${Date.now()}@example.com`;
  
  console.log(`Creating user in Auth: ${email}`);
  const credential = await createUserWithEmailAndPassword(secondaryAuth, email, "password");
  
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
  process.exit(0);
}

testAuthAdminCreation();
