import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, query, where, limit, getDocs, setDoc, doc, serverTimestamp } from "firebase/firestore";
import { firebaseConfig } from "./firebase-config.js";

async function testWorkerActiveQuery() {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const auth = getAuth(app);
  
  try {
    console.log("Logging in as Admin...");
    await signInWithEmailAndPassword(auth, "test-admin-1778101664849@example.com", "password123");

    const workerEmail = `worker-active-${Date.now()}@example.com`;
    const password = "password123";

    const secondaryApp = initializeApp(firebaseConfig, `worker-create-${Date.now()}`);
    const secondaryAuth = getAuth(secondaryApp);
    
    const credential = await createUserWithEmailAndPassword(secondaryAuth, workerEmail, password);
    const workerUid = credential.user.uid;
    
    const workerRef = doc(collection(db, "workers"));
    const workerId = workerRef.id;
    await setDoc(workerRef, {
      name: "Test Active Worker",
      email: workerEmail,
      departmentId: "dep1",
      titleId: "title1",
      userId: workerUid,
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    await setDoc(doc(db, "users", workerUid), {
      email: workerEmail,
      role: "worker",
      workerId: workerId,
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    await deleteApp(secondaryApp);
    
    console.log("Logging in as Worker...");
    await signInWithEmailAndPassword(auth, workerEmail, password);
    
    console.log("Testing getDocs on attendance for ACTIVE attendance...");
    const activeSnap = await getDocs(query(
      collection(db, "attendance"),
      where("userId", "==", workerUid),
      where("workerId", "==", workerId),
      where("status", "==", "clocked-in"),
      limit(1)
    ));
    console.log("getDocs active attendance successful? docs count:", activeSnap.docs.length);

  } catch (error) {
    console.error("TEST FAILED:", error.code, error.message);
  } finally {
    process.exit(0);
  }
}

testWorkerActiveQuery();
