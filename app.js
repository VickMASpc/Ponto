import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const state = {
  currentUser: null,
  userProfile: null,
  workerProfile: null,
  activeAttendance: null,
  departments: [],
  titles: [],
  workers: [],
  attendance: [],
  itCode: null,
  // Gestor-specific
  gestorWorkers: [],    // workers of gestor's department
  qrScanner: null,      // Html5Qrcode instance
  scanPaused: false,    // prevents double-scan while overlay is up
};

const $ = (id) => document.getElementById(id);
const fmtDateTime = (value) => {
  if (!value) return "—";
  const date = value instanceof Timestamp ? value.toDate() : new Date(value);
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(date);
};
const fmtDate = (value) => {
  if (!value) return "—";
  const date = value instanceof Timestamp ? value.toDate() : new Date(value);
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(date);
};
const fmtTime = (value) => {
  if (!value) return "—";
  const date = value instanceof Timestamp ? value.toDate() : new Date(value);
  return new Intl.DateTimeFormat("pt-BR", { timeStyle: "short" }).format(date);
};
const todayKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const normalize = (value) => String(value || "").trim().toLowerCase();
const uuid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function showToast(message, type = "success") {
  const toast = $("toast");
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => (toast.className = "toast"), 3200);
}

function setLoading(button, isLoading, text) {
  if (!button) return;
  if (isLoading) {
    button.dataset.originalText = button.textContent;
    button.textContent = text || "Processando...";
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalText || button.textContent;
    button.disabled = false;
  }
}

function displayAuthView() {
  $("authView").classList.remove("hidden");
  $("appView").classList.add("hidden");
}

function displayAppView(role) {
  $("authView").classList.add("hidden");
  $("appView").classList.remove("hidden");
  $("workerView").classList.toggle("hidden", role !== "worker");
  $("adminView").classList.toggle("hidden", role !== "admin");
  $("gestorView").classList.toggle("hidden", role !== "gestor");

  const badge = $("roleBadge");
  badge.textContent = role === "gestor" ? "Gestor" : role === "admin" ? "Admin" : "Funcionário";
  badge.className = `badge ${role === "gestor" ? "gestor" : ""}`;
}

async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

async function loadReferenceData() {
  const role = state.userProfile?.role;
  const tasks = [
    getDocs(query(collection(db, "departments"), orderBy("name"))),
    getDocs(query(collection(db, "titles"), orderBy("name")))
  ];

  if (role === "admin") {
    tasks.push(getDocs(query(collection(db, "workers"), orderBy("name"))));
  }

  try {
    const results = await Promise.all(tasks);
    state.departments = results[0].docs.map((d) => ({ id: d.id, ...d.data() }));
    state.titles = results[1].docs.map((d) => ({ id: d.id, ...d.data() }));
    if (role === "admin" && results[2]) {
      state.workers = results[2].docs.map((d) => ({ id: d.id, ...d.data() }));
    }
    if (role === "admin") renderReferenceControls();
  } catch (error) {
    console.error("Error loading reference data:", error);
    if (error.code !== "permission-denied") {
      showToast("Erro ao carregar dados do sistema.", "error");
    }
  }
}

function departmentName(id) {
  return state.departments.find((item) => item.id === id)?.name || "—";
}
function titleName(id) {
  return state.titles.find((item) => item.id === id)?.name || "—";
}
function workerName(id) {
  return state.workers.find((item) => item.id === id)?.name || "—";
}
function workerById(id) {
  return state.workers.find((item) => item.id === id);
}

function renderReferenceControls() {
  const departmentOptions = state.departments.map((d) => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join("");
  const titleOptions = state.titles.map((t) => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join("");
  $("workerDepartment").innerHTML = `<option value="">Selecionar departamento</option>${departmentOptions}`;
  $("workerTitle").innerHTML = `<option value="">Selecionar cargo</option>${titleOptions}`;
  $("attendanceDepartmentFilter").innerHTML = `<option value="">Todos os departamentos</option>${departmentOptions}`;

  $("departmentsList").innerHTML = state.departments.map((department) => `
    <li>
      <span>${escapeHtml(department.name)}</span>
      <button class="danger-btn small-btn" data-delete-department="${department.id}">Excluir</button>
    </li>
  `).join("") || `<li><span>Nenhum departamento cadastrado.</span></li>`;

  $("titlesList").innerHTML = state.titles.map((title) => `
    <li>
      <span>${escapeHtml(title.name)}</span>
      <button class="danger-btn small-btn" data-delete-title="${title.id}">Excluir</button>
    </li>
  `).join("") || `<li><span>Nenhum cargo cadastrado.</span></li>`;

  $("metricDepartments").textContent = state.departments.length;
  $("metricTitles").textContent = state.titles.length;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ─── WORKER EXPERIENCE ────────────────────────────────────────────────────────

async function loadWorkerExperience() {
  const workerId = state.userProfile.workerId;
  if (!workerId) throw new Error("Esta conta não tem um perfil de funcionário atribuído.");
  const workerSnap = await getDoc(doc(db, "workers", workerId));
  if (!workerSnap.exists()) throw new Error("Perfil de funcionário não encontrado.");

  // Load reference data for worker (departments/titles)
  const [deptSnap, titleSnap] = await Promise.all([
    getDocs(query(collection(db, "departments"), orderBy("name"))),
    getDocs(query(collection(db, "titles"), orderBy("name")))
  ]);
  state.departments = deptSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  state.titles = titleSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  state.workerProfile = { id: workerSnap.id, ...workerSnap.data() };
  await loadWorkerActiveAttendance(workerId);
  await renderWorkerDashboard();
}

async function loadWorkerActiveAttendance(workerId) {
  const activeSnap = await getDocs(query(
    collection(db, "attendance"),
    where("userId", "==", state.currentUser.uid),
    where("workerId", "==", workerId),
    where("status", "==", "clocked-in"),
    limit(1)
  ));
  state.activeAttendance = activeSnap.empty ? null : { id: activeSnap.docs[0].id, ...activeSnap.docs[0].data() };
}

async function renderWorkerDashboard() {
  const worker = state.workerProfile;
  $("welcomeTitle").textContent = `Olá, ${worker.name}`;
  $("workerNameValue").textContent = worker.name;
  $("workerDepartmentValue").textContent = departmentName(worker.departmentId);
  $("workerTitleValue").textContent = titleName(worker.titleId);
  $("clockInValue").textContent = fmtDateTime(state.activeAttendance?.clockInAt);

  const isClockedIn = Boolean(state.activeAttendance);
  $("workerStatusTitle").textContent = isClockedIn ? "Você está em serviço" : "Você não está em serviço";
  $("workerStatusText").textContent = isClockedIn
    ? "Clique no botão abaixo quando terminar seu turno."
    : "Clique no botão abaixo quando começar seu turno.";
  $("clockActionBtn").textContent = isClockedIn ? "Bater Ponto (Saída)" : "Bater Ponto (Entrada)";

  await renderWorkerAttendance();
}

async function renderWorkerAttendance() {
  const snap = await getDocs(query(
    collection(db, "attendance"),
    where("userId", "==", state.currentUser.uid),
    where("workerId", "==", state.workerProfile.id)
  ));
  let rows = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  rows.sort((a, b) => (b.clockInAt?.toMillis() || 0) - (a.clockInAt?.toMillis() || 0));
  rows = rows.slice(0, 10);
  $("workerAttendanceTable").innerHTML = rows.map((row) => `
    <tr>
      <td>${fmtDate(row.clockInAt)}</td>
      <td>${fmtTime(row.clockInAt)}</td>
      <td>${fmtTime(row.clockOutAt)}</td>
      <td>${row.status === "clocked-in" ? "Em serviço" : "Concluído"}</td>
    </tr>
  `).join("") || `<tr><td colspan="4">Nenhum registro de presença ainda.</td></tr>`;
}

async function handleClockAction() {
  const button = $("clockActionBtn");
  setLoading(button, true, "Salvando...");
  try {
    if (state.activeAttendance) {
      await updateDoc(doc(db, "attendance", state.activeAttendance.id), {
        clockOutAt: serverTimestamp(),
        status: "completed",
        updatedAt: serverTimestamp()
      });
      state.activeAttendance = null;
      showToast("Saída registrada com sucesso.");
    } else {
      await addDoc(collection(db, "attendance"), {
        workerId: state.workerProfile.id,
        userId: state.currentUser.uid,
        workerName: state.workerProfile.name,
        departmentId: state.workerProfile.departmentId,
        titleId: state.workerProfile.titleId,
        clockInAt: serverTimestamp(),
        clockOutAt: null,
        dateKey: todayKey(),
        status: "clocked-in",
        method: "self",
        recordedByUserId: state.currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      await loadWorkerActiveAttendance(state.workerProfile.id);
      showToast("Entrada registrada com sucesso.");
    }
    await renderWorkerDashboard();
  } catch (error) {
    console.error(error);
    showToast(error.message, "error");
  } finally {
    setLoading(button, false);
  }
}

// ─── ADMIN EXPERIENCE ─────────────────────────────────────────────────────────

async function loadAdminDashboard() {
  await loadReferenceData();
  await Promise.all([renderWorkers(), renderAttendance(), renderOverview()]);
  $("welcomeTitle").textContent = "Painel administrativo";
}

async function renderWorkers() {
  const search = normalize($("workerSearch").value);
  const rows = state.workers.filter((worker) => normalize(`${worker.name} ${worker.email}`).includes(search));
  $("workersTable").innerHTML = rows.map((worker) => `
    <tr>
      <td>${escapeHtml(worker.name)}</td>
      <td>${escapeHtml(worker.email)}</td>
      <td>${escapeHtml(departmentName(worker.departmentId))}</td>
      <td>${escapeHtml(titleName(worker.titleId))}</td>
      <td>${escapeHtml(worker.role || "worker")}</td>
      <td>${worker.active === false ? "Inativo" : "Ativo"}</td>
      <td class="row-actions">
        <button class="ghost-btn small-btn" data-badge-worker="${worker.id}">🪪 Crachá</button>
        <button class="ghost-btn small-btn" data-toggle-worker="${worker.id}" data-active="${worker.active === false ? "true" : "false"}">${worker.active === false ? "Ativar" : "Desativar"}</button>
      </td>
    </tr>
  `).join("") || `<tr><td colspan="7">Nenhum funcionário encontrado.</td></tr>`;
  $("metricWorkers").textContent = state.workers.filter((w) => w.active !== false).length;
}

async function renderAttendance() {
  const snap = await getDocs(query(collection(db, "attendance"), orderBy("clockInAt", "desc"), limit(100)));
  state.attendance = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const departmentFilter = $("attendanceDepartmentFilter").value;
  const statusFilter = $("attendanceStatusFilter").value;
  const rows = state.attendance.filter((record) => {
    return (!departmentFilter || record.departmentId === departmentFilter) && (!statusFilter || record.status === statusFilter);
  });

  $("attendanceTable").innerHTML = rows.map((record) => `
    <tr>
      <td>${fmtDate(record.clockInAt)}</td>
      <td>${escapeHtml(record.workerName || workerName(record.workerId))}</td>
      <td>${escapeHtml(departmentName(record.departmentId))}</td>
      <td>${fmtTime(record.clockInAt)}</td>
      <td>${fmtTime(record.clockOutAt)}</td>
      <td>${record.status === "clocked-in" ? "Em serviço" : "Concluído"}</td>
      <td>${escapeHtml(record.method || "self")}</td>
    </tr>
  `).join("") || `<tr><td colspan="7">Nenhum registro de presença encontrado.</td></tr>`;
}

async function renderOverview() {
  await renderAttendance();
  const activeRows = state.attendance.filter((record) => record.status === "clocked-in");
  $("metricClockedIn").textContent = activeRows.length;
  $("clockedInTable").innerHTML = activeRows.map((record) => {
    const worker = workerById(record.workerId);
    return `
      <tr>
        <td>${escapeHtml(record.workerName || worker?.name || "—")}</td>
        <td>${escapeHtml(departmentName(record.departmentId))}</td>
        <td>${escapeHtml(titleName(record.titleId))}</td>
        <td>${fmtTime(record.clockInAt)}</td>
      </tr>
    `;
  }).join("") || `<tr><td colspan="4">Nenhum funcionário está em serviço no momento.</td></tr>`;
}

async function createWorkerAccount({ name, email, password, departmentId, titleId, role }) {
  const secondaryApp = initializeApp(firebaseConfig, `worker-create-${Date.now()}`);
  const secondaryAuth = getAuth(secondaryApp);
  try {
    const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const qrId = uuid();
    const workerRef = doc(collection(db, "workers"));
    await setDoc(workerRef, {
      name,
      email,
      departmentId,
      titleId,
      userId: credential.user.uid,
      role: role || "worker",
      qrId,
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    const userDoc = {
      email,
      role: role || "worker",
      workerId: workerRef.id,
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    if (role === "gestor") {
      userDoc.departmentId = departmentId;
    }
    await setDoc(doc(db, "users", credential.user.uid), userDoc);
  } finally {
    await signOut(secondaryAuth).catch(() => {});
    await deleteApp(secondaryApp).catch(() => {});
  }
}

async function createAdminAccount({ email, password, itCode }) {
  const secondaryApp = initializeApp(firebaseConfig, `admin-create-${Date.now()}`);
  const secondaryAuth = getAuth(secondaryApp);
  try {
    const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    await setDoc(doc(db, "users", credential.user.uid), {
      email,
      role: "admin",
      active: true,
      it_access_code: itCode,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } finally {
    await signOut(secondaryAuth).catch(() => {});
    await deleteApp(secondaryApp).catch(() => {});
  }
}

async function addNamedRecord(collectionName, name) {
  await addDoc(collection(db, collectionName), {
    name,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

// ─── BADGE / QR GENERATION ────────────────────────────────────────────────────

function showBadge(workerId) {
  const worker = state.workers.find((w) => w.id === workerId);
  if (!worker) return;

  $("badgeName").textContent = worker.name;
  $("badgeDept").textContent = departmentName(worker.departmentId);
  $("badgeTitleRole").textContent = `${titleName(worker.titleId)} · ${worker.role === "gestor" ? "Gestor" : "Funcionário"}`;
  $("badgeQrId").textContent = worker.qrId || "sem QR";

  const canvas = $("badgeQrCanvas");
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (worker.qrId && typeof QRCode !== "undefined" && typeof QRCode.toCanvas === "function") {
    QRCode.toCanvas(canvas, worker.qrId, {
      width: 200,
      color: {
        dark: "#152033",
        light: "#ffffff"
      },
      errorCorrectionLevel: "M"
    }, (err) => {
      if (err) {
        console.error("Erro ao gerar QR do crachá:", err);
      }
    });
  } else if (ctx) {
    ctx.font = "14px sans-serif";
    ctx.fillStyle = "#6b7280";
    ctx.textAlign = "center";
    ctx.fillText("QR indisponível", canvas.width / 2, canvas.height / 2);
  }

  $("badgeModalOverlay").classList.remove("hidden");
}

// ─── GESTOR EXPERIENCE ────────────────────────────────────────────────────────

async function loadGestorExperience() {
  const profile = state.userProfile;
  if (!profile.departmentId) throw new Error("Gestor sem departamento atribuído. Contate o administrador.");

  // Load departments and titles for display
  const [deptSnap, titleSnap] = await Promise.all([
    getDocs(query(collection(db, "departments"), orderBy("name"))),
    getDocs(query(collection(db, "titles"), orderBy("name")))
  ]);
  state.departments = deptSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  state.titles = titleSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Load workers of this department
  await loadGestorWorkers();

  $("welcomeTitle").textContent = `Gestor — ${departmentName(profile.departmentId)}`;
  $("gestorDeptLabel").textContent = departmentName(profile.departmentId);

  await renderGestorDashboard();
}

async function loadGestorWorkers() {
  const deptId = state.userProfile.departmentId;
  try {
    const snap = await getDocs(query(
      collection(db, "workers"),
      where("departmentId", "==", deptId)
    ));
    state.gestorWorkers = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((worker) => (worker.role || "worker") === "worker" && worker.active !== false);
  } catch (err) {
    console.error("Erro ao carregar workers do gestor:", err);
    state.gestorWorkers = [];
  }
}

async function renderGestorDashboard() {
  const deptId = state.userProfile.departmentId;
  const today = todayKey();

  try {
    const snap = await getDocs(query(
      collection(db, "attendance"),
      where("departmentId", "==", deptId),
      where("dateKey", "==", today),
      orderBy("clockInAt", "desc"),
      limit(50)
    ));
    const records = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // Present now (clocked-in)
    const present = records.filter((r) => r.status === "clocked-in");
    $("gestorMetricPresent").textContent = present.length;
    $("gestorMetricScans").textContent = records.length;

    $("gestorPresentTable").innerHTML = present.map((r) => `
      <tr>
        <td>${escapeHtml(r.workerName || "—")}</td>
        <td>${fmtTime(r.clockInAt)}</td>
        <td>${fmtTime(r.clockOutAt)}</td>
        <td>${r.status === "clocked-in" ? "✅ Em serviço" : "🏁 Saiu"}</td>
      </tr>
    `).join("") || `<tr><td colspan="4">Nenhuma presença registrada hoje.</td></tr>`;

    // Recent scans = all attendance events sorted
    $("gestorScansTable").innerHTML = records.slice(0, 20).map((r) => `
      <tr>
        <td>${escapeHtml(r.workerName || "—")}</td>
        <td>${r.clockOutAt ? "Saída" : "Entrada"}</td>
        <td>${r.clockOutAt ? fmtTime(r.clockOutAt) : fmtTime(r.clockInAt)}</td>
        <td>${escapeHtml(r.method || "self")}</td>
      </tr>
    `).join("") || `<tr><td colspan="4">Nenhum registro hoje.</td></tr>`;

  } catch (err) {
    console.error("Erro ao carregar dashboard do gestor:", err);
    showToast("Erro ao carregar dados do departamento.", "error");
  }
}

// ─── QR SCANNER ───────────────────────────────────────────────────────────────

function openScanner() {
  $("scannerScreen").classList.remove("hidden");
  $("cameraDeniedMsg").classList.add("hidden");
  $("scannerHint").classList.remove("hidden");
  state.scanPaused = false;
  startScanner();
}

function closeScanner() {
  stopScanner();
  $("scannerScreen").classList.add("hidden");
  hideScanResultOverlay();
}

async function startScanner() {
  if (typeof Html5Qrcode === "undefined") {
    $("scannerHint").textContent = "Biblioteca de QR não carregada. Verifique a conexão.";
    return;
  }

  // Clean up any previous instance
  if (state.qrScanner) {
    try { await state.qrScanner.stop(); } catch (_) {}
    try { state.qrScanner.clear(); } catch (_) {}
    state.qrScanner = null;
  }

  state.qrScanner = new Html5Qrcode("qr-reader");

  try {
    await state.qrScanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 280, height: 280 }, aspectRatio: 1.0 },
      onQrCodeScanned,
      () => {} // silent decode errors (frames without QR)
    );
    $("scannerHint").textContent = "Aponte a câmera para o QR do crachá do funcionário.";
  } catch (err) {
    console.error("Camera error:", err);
    if (err && (err.name === "NotAllowedError" || String(err).includes("NotAllowedError") || String(err).includes("Permission"))) {
      $("cameraDeniedMsg").classList.remove("hidden");
      $("scannerHint").classList.add("hidden");
    } else {
      $("scannerHint").textContent = `Erro ao acessar câmera: ${err?.message || err}`;
    }
  }
}

async function stopScanner() {
  if (state.qrScanner) {
    try { await state.qrScanner.stop(); } catch (_) {}
    try { state.qrScanner.clear(); } catch (_) {}
    state.qrScanner = null;
  }
}

function onQrCodeScanned(decodedText) {
  if (state.scanPaused) return;
  state.scanPaused = true;

  const qrId = decodedText.trim();
  const worker = state.gestorWorkers.find((w) => w.qrId === qrId);

  if (!worker) {
    showScanError(
      "⚠️",
      "QR não reconhecido",
      "Este QR não pertence a nenhum funcionário do seu departamento."
    );
    return;
  }

  // Lookup active attendance for this worker (today)
  lookupWorkerAttendance(worker);
}

async function lookupWorkerAttendance(worker) {
  try {
    const snap = await getDocs(query(
      collection(db, "attendance"),
      where("workerId", "==", worker.id),
      where("departmentId", "==", state.userProfile.departmentId),
      where("status", "==", "clocked-in"),
      limit(1)
    ));
    const activeRec = snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
    showScanWorkerCard(worker, activeRec);
  } catch (err) {
    console.error(err);
    showScanError("⚠️", "Erro de leitura", "Não foi possível verificar o status do funcionário.");
  }
}

function showScanResultOverlay() {
  $("scanResultOverlay").classList.remove("hidden");
  $("scanWorkerCard").classList.add("hidden");
  $("scanErrorCard").classList.add("hidden");
}

function hideScanResultOverlay() {
  $("scanResultOverlay").classList.add("hidden");
}

function showScanError(icon, title, text) {
  showScanResultOverlay();
  $("scanErrorIcon").textContent = icon;
  $("scanErrorTitle").textContent = title;
  $("scanErrorText").textContent = text;
  $("scanErrorCard").classList.remove("hidden");
}

function showScanWorkerCard(worker, activeRec) {
  showScanResultOverlay();

  const initials = worker.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  $("scanWorkerAvatar").textContent = initials;
  $("scanWorkerName").textContent = worker.name;
  $("scanWorkerDept").textContent = departmentName(worker.departmentId) + " · " + titleName(worker.titleId);

  const statusEl = $("scanWorkerStatus");
  const entradaBtn = $("registrarEntradaBtn");
  const saidaBtn = $("registrarSaidaBtn");

  if (activeRec) {
    statusEl.textContent = `✅ Em serviço desde ${fmtTime(activeRec.clockInAt)}`;
    statusEl.className = "scan-result-status status-in";
    entradaBtn.classList.add("hidden");
    saidaBtn.classList.remove("hidden");
    saidaBtn.dataset.attendanceId = activeRec.id;
  } else {
    statusEl.textContent = "⏸ Fora de serviço";
    statusEl.className = "scan-result-status status-out";
    entradaBtn.classList.remove("hidden");
    saidaBtn.classList.add("hidden");
  }

  entradaBtn.dataset.workerId = worker.id;
  entradaBtn.dataset.workerUserId = worker.userId || "";
  entradaBtn.dataset.workerName = worker.name;
  entradaBtn.dataset.departmentId = worker.departmentId;
  entradaBtn.dataset.titleId = worker.titleId;
  saidaBtn.dataset.workerId = worker.id;
  saidaBtn.dataset.workerUserId = worker.userId || "";
  saidaBtn.dataset.workerName = worker.name;
  saidaBtn.dataset.departmentId = worker.departmentId;

  $("scanWorkerCard").classList.remove("hidden");
}

async function registerAttendanceByGestor(action) {
  const btn = action === "entrada" ? $("registrarEntradaBtn") : $("registrarSaidaBtn");
  setLoading(btn, true, "Salvando...");

  const workerId = btn.dataset.workerId;
  const workerUserId = btn.dataset.workerUserId; // worker's Firebase Auth UID
  const workerNameVal = btn.dataset.workerName;
  const departmentId = btn.dataset.departmentId;
  const titleId = btn.dataset.titleId;
  const attendanceId = btn.dataset.attendanceId;

  try {
    if (action === "saida" && attendanceId) {
      await updateDoc(doc(db, "attendance", attendanceId), {
        clockOutAt: serverTimestamp(),
        status: "completed",
        clockOutMethod: "camera-qr",
        clockOutRecordedByUserId: state.currentUser.uid,
        updatedAt: serverTimestamp()
      });
    } else {
      await addDoc(collection(db, "attendance"), {
        workerId,
        userId: workerUserId || workerId, // worker's Firebase Auth UID so they can read their own history
        workerName: workerNameVal,
        departmentId,
        titleId,
        clockInAt: serverTimestamp(),
        clockOutAt: null,
        dateKey: todayKey(),
        status: "clocked-in",
        method: "camera-qr",
        recordedByUserId: state.currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }

    hideScanResultOverlay();
    showConfirmation(action, workerNameVal, departmentId);
  } catch (err) {
    console.error(err);
    showToast("Erro ao registrar presença: " + err.message, "error");
    setLoading(btn, false);
    state.scanPaused = false;
  }
}

function showConfirmation(action, name, departmentId) {
  const overlay = $("confirmationOverlay");
  overlay.className = `confirmation-overlay ${action === "entrada" ? "entrada-confirm" : "saida-confirm"}`;

  $("confirmIcon").textContent = action === "entrada" ? "✅" : "🏁";
  $("confirmType").textContent = action === "entrada" ? "ENTRADA REGISTRADA" : "SAÍDA REGISTRADA";
  $("confirmName").textContent = name;
  $("confirmTime").textContent = new Intl.DateTimeFormat("pt-BR", { timeStyle: "short" }).format(new Date());
  $("confirmDept").textContent = departmentName(departmentId);

  overlay.classList.remove("hidden");

  setTimeout(async () => {
    overlay.classList.add("hidden");
    state.scanPaused = false;
    // Refresh gestor dashboard in background
    await loadGestorWorkers();
    await renderGestorDashboard();
  }, 3000);
}

// ─── EVENT BINDING ─────────────────────────────────────────────────────────────

function bindEvents() {
  $("loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.submitter;
    setLoading(button, true, "Entrando...");
    try {
      await signInWithEmailAndPassword(auth, $("loginEmail").value, $("loginPassword").value);
    } catch (error) {
      showToast("E-mail ou senha inválidos.", "error");
    } finally {
      setLoading(button, false);
    }
  });

  $("logoutBtn").addEventListener("click", () => {
    closeScanner();
    signOut(auth);
  });
  $("clockActionBtn").addEventListener("click", handleClockAction);
  $("refreshWorkerLogsBtn").addEventListener("click", renderWorkerAttendance);
  $("refreshOverviewBtn").addEventListener("click", renderOverview);
  $("refreshAttendanceBtn").addEventListener("click", renderAttendance);
  $("workerSearch").addEventListener("input", renderWorkers);
  $("attendanceDepartmentFilter").addEventListener("change", renderAttendance);
  $("attendanceStatusFilter").addEventListener("change", renderAttendance);

  // Gestor events
  $("openScannerBtn").addEventListener("click", openScanner);
  $("closeScannerBtn").addEventListener("click", closeScanner);
  $("refreshGestorBtn").addEventListener("click", async () => {
    await loadGestorWorkers();
    await renderGestorDashboard();
  });

  // Scan result events
  $("registrarEntradaBtn").addEventListener("click", () => registerAttendanceByGestor("entrada"));
  $("registrarSaidaBtn").addEventListener("click", () => registerAttendanceByGestor("saida"));
  $("cancelScanBtn").addEventListener("click", () => {
    hideScanResultOverlay();
    state.scanPaused = false;
  });
  $("dismissScanErrorBtn").addEventListener("click", () => {
    hideScanResultOverlay();
    state.scanPaused = false;
  });

  // Badge events
  $("closeBadgeBtn").addEventListener("click", () => $("badgeModalOverlay").classList.add("hidden"));
  $("printBadgeBtn").addEventListener("click", () => window.print());

  // Admin tab nav
  document.querySelectorAll(".tab-btn").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((btn) => btn.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.add("hidden"));
      button.classList.add("active");
      $(button.dataset.tab).classList.remove("hidden");
    });
  });

  // Worker / Gestor creation form
  $("workerForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.submitter;
    setLoading(button, true, "Criando...");
    try {
      await createWorkerAccount({
        name: $("workerName").value.trim(),
        email: $("workerEmail").value.trim(),
        password: $("workerPassword").value,
        departmentId: $("workerDepartment").value,
        titleId: $("workerTitle").value,
        role: $("workerRole").value
      });
      event.target.reset();
      await loadAdminDashboard();
      showToast("Conta criada com sucesso.");
    } catch (error) {
      console.error(error);
      showToast(error.message, "error");
    } finally {
      setLoading(button, false);
    }
  });

  $("departmentForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = $("departmentName").value.trim();
    if (!name) return;
    await addNamedRecord("departments", name);
    event.target.reset();
    await loadAdminDashboard();
    showToast("Departamento salvo com sucesso.");
  });

  $("titleForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = $("titleName").value.trim();
    if (!name) return;
    await addNamedRecord("titles", name);
    event.target.reset();
    await loadAdminDashboard();
    showToast("Cargo salvo com sucesso.");
  });

  document.addEventListener("click", async (event) => {
    const departmentId = event.target.dataset?.deleteDepartment;
    const titleId = event.target.dataset?.deleteTitle;
    const workerId = event.target.dataset?.toggleWorker;
    const badgeWorkerId = event.target.dataset?.badgeWorker;

    if (departmentId && confirm("Excluir este departamento? As referências de funcionários existentes não serão alteradas.")) {
      await deleteDoc(doc(db, "departments", departmentId));
      await loadAdminDashboard();
      showToast("Departamento excluído.");
    }
    if (titleId && confirm("Excluir este cargo? As referências de funcionários existentes não serão alteradas.")) {
      await deleteDoc(doc(db, "titles", titleId));
      await loadAdminDashboard();
      showToast("Cargo excluído.");
    }
    if (workerId) {
      const active = event.target.dataset.active === "true";
      await updateDoc(doc(db, "workers", workerId), { active, updatedAt: serverTimestamp() });
      const worker = state.workers.find((item) => item.id === workerId);
      if (worker?.userId) {
        await updateDoc(doc(db, "users", worker.userId), { active, updatedAt: serverTimestamp() });
      }
      await loadAdminDashboard();
      showToast(active ? "Funcionário ativado." : "Funcionário desativado.");
    }
    if (badgeWorkerId) {
      showBadge(badgeWorkerId);
    }
  });

  // IT Admin Events
  $("itToggleBtn").addEventListener("click", () => {
    $("itPanel").classList.toggle("hidden");
    $("itAccessCode").value = "";
    $("itCodeStep").classList.remove("hidden");
    $("itCreateStep").classList.add("hidden");
  });

  $("itVerifyBtn").addEventListener("click", async () => {
    const code = $("itAccessCode").value.trim();
    if (!code) return;
    setLoading($("itVerifyBtn"), true, "Verificando...");
    try {
      const snap = await getDoc(doc(db, "system", "config"));
      if (snap.exists() && snap.data().it_access_code === code) {
        state.itCode = code;
        $("itCodeStep").classList.add("hidden");
        $("itCreateStep").classList.remove("hidden");
      } else {
        showToast("Código de acesso inválido.", "error");
      }
    } catch (error) {
      console.error(error);
      showToast("Erro ao verificar código.", "error");
    } finally {
      setLoading($("itVerifyBtn"), false);
    }
  });

  $("itAdminForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.submitter;
    setLoading(button, true, "Criando...");
    try {
      await createAdminAccount({
        email: $("itAdminEmail").value.trim(),
        password: $("itAdminPassword").value,
        itCode: state.itCode
      });
      showToast("Administrador criado com sucesso!");
      $("itAdminForm").reset();
      $("itPanel").classList.add("hidden");
    } catch (error) {
      console.error(error);
      showToast(error.message, "error");
    } finally {
      setLoading(button, false);
    }
  });

  $("itResetBtn").addEventListener("click", () => {
    $("itCodeStep").classList.remove("hidden");
    $("itCreateStep").classList.add("hidden");
  });
}

// ─── AUTH STATE ───────────────────────────────────────────────────────────────

onAuthStateChanged(auth, async (user) => {
  try {
    if (!user) {
      state.currentUser = null;
      state.userProfile = null;
      displayAuthView();
      return;
    }

    state.currentUser = user;
    state.userProfile = await getUserProfile(user.uid);
    if (!state.userProfile || state.userProfile.active === false) {
      await signOut(auth);
      showToast("Sua conta não está ativa ou não possui um perfil de cargo.", "error");
      return;
    }

    displayAppView(state.userProfile.role);

    if (state.userProfile.role === "admin") {
      await loadAdminDashboard();
    } else if (state.userProfile.role === "worker") {
      await loadWorkerExperience();
    } else if (state.userProfile.role === "gestor") {
      await loadGestorExperience();
    } else {
      throw new Error("Papel de usuário não suportado: " + state.userProfile.role);
    }
  } catch (error) {
    console.error(error);
    showToast(error.message, "error");
  }
});

bindEvents();
