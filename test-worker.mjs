import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, query, where, orderBy, limit, getDocs, getDoc, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { firebaseConfig } from "./firebase-config.js";

async function testWorkerQueries() {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const auth = getAuth(app);
  
  try {
    console.log("Logging in as Admin...");
    await signInWithEmailAndPassword(auth, "test-admin-1778101664849@example.com", "password123");
    console.log("Logged in as Admin.");

    const workerEmail = `worker-test-${Date.now()}@example.com`;
    const password = "password123";

    console.log("Creating secondary app for worker creation...");
    const secondaryApp = initializeApp(firebaseConfig, `worker-create-${Date.now()}`);
    const secondaryAuth = getAuth(secondaryApp);
    
    console.log("Creating worker Auth account...");
    const credential = await createUserWithEmailAndPassword(secondaryAuth, workerEmail, password);
    const workerUid = credential.user.uid;
    
    console.log("Creating worker doc in Firestore...");
    const workerRef = doc(collection(db, "workers"));
    const workerId = workerRef.id;
    await setDoc(workerRef, {
      name: "Test Worker",
      email: workerEmail,
      departmentId: "dep1",
      titleId: "title1",
      userId: workerUid,
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    console.log("Creating user doc in Firestore...");
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
    console.log("Logged in as Worker.");
    
    // TEST 1: getDoc on workers
    console.log("Testing getDoc on workers...");
    const workerSnap = await getDoc(doc(db, "workers", workerId));
    console.log("getDoc workers successful?", workerSnap.exists());

    // TEST 2: getDocs on attendance with userId and workerId
    console.log("Testing getDocs on attendance...");
    const snap = await getDocs(query(
      collection(db, "attendance"),
      where("userId", "==", workerUid),
      where("workerId", "==", workerId),
      orderBy("clockInAt", "desc"),
      limit(10)
    ));
    console.log("getDocs attendance successful? docs count:", snap.docs.length);

  } catch (error) {
    console.error("TEST FAILED:", error.code, error.message);
  } finally {
    process.exit(0);
  }
}

testWorkerQueries();
