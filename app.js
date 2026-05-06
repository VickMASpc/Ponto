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
  itCode: null
};

const $ = (id) => document.getElementById(id);
const fmtDateTime = (value) => {
  if (!value) return "—";
  const date = value instanceof Timestamp ? value.toDate() : new Date(value);
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
};
const fmtDate = (value) => {
  if (!value) return "—";
  const date = value instanceof Timestamp ? value.toDate() : new Date(value);
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
};
const todayKey = () => new Date().toISOString().slice(0, 10);
const normalize = (value) => String(value || "").trim().toLowerCase();

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
  $("roleBadge").textContent = role;
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

  // Only admins can list all workers
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
    renderReferenceControls();
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

async function loadWorkerExperience() {
  const workerId = state.userProfile.workerId;
  if (!workerId) throw new Error("Esta conta não tem um perfil de funcionário atribuído.");
  const workerSnap = await getDoc(doc(db, "workers", workerId));
  if (!workerSnap.exists()) throw new Error("Perfil de funcionário não encontrado.");

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
  $("welcomeTitle").textContent = `Welcome, ${worker.name}`;
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
      <td>${fmtDateTime(row.clockInAt)}</td>
      <td>${fmtDateTime(row.clockOutAt)}</td>
      <td>${escapeHtml(row.status)}</td>
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
      <td>${worker.active === false ? "Inativo" : "Ativo"}</td>
      <td class="row-actions">
        <button class="ghost-btn small-btn" data-toggle-worker="${worker.id}" data-active="${worker.active === false ? "true" : "false"}">${worker.active === false ? "Ativar" : "Desativar"}</button>
      </td>
    </tr>
  `).join("") || `<tr><td colspan="6">Nenhum funcionário encontrado.</td></tr>`;
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
      <td>${fmtDateTime(record.clockInAt)}</td>
      <td>${fmtDateTime(record.clockOutAt)}</td>
      <td>${escapeHtml(record.status)}</td>
    </tr>
  `).join("") || `<tr><td colspan="6">Nenhum registro de presença encontrado.</td></tr>`;
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
        <td>${fmtDateTime(record.clockInAt)}</td>
      </tr>
    `;
  }).join("") || `<tr><td colspan="4">Nenhum funcionário está em serviço no momento.</td></tr>`;
}

async function createWorkerAccount({ name, email, password, departmentId, titleId }) {
  const secondaryApp = initializeApp(firebaseConfig, `worker-create-${Date.now()}`);
  const secondaryAuth = getAuth(secondaryApp);
  try {
    const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const workerRef = doc(collection(db, "workers"));
    await setDoc(workerRef, {
      name,
      email,
      departmentId,
      titleId,
      userId: credential.user.uid,
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    await setDoc(doc(db, "users", credential.user.uid), {
      email,
      role: "worker",
      workerId: workerRef.id,
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
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
      it_access_code: itCode, // Authorization for Firestore rules
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

function bindEvents() {
  $("loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.submitter;
    setLoading(button, true, "Entrando...");
    try {
      await signInWithEmailAndPassword(auth, $("loginEmail").value, $("loginPassword").value);
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setLoading(button, false);
    }
  });

  $("logoutBtn").addEventListener("click", () => signOut(auth));
  $("clockActionBtn").addEventListener("click", handleClockAction);
  $("refreshWorkerLogsBtn").addEventListener("click", renderWorkerAttendance);
  $("refreshOverviewBtn").addEventListener("click", renderOverview);
  $("refreshAttendanceBtn").addEventListener("click", renderAttendance);
  $("workerSearch").addEventListener("input", renderWorkers);
  $("attendanceDepartmentFilter").addEventListener("change", renderAttendance);
  $("attendanceStatusFilter").addEventListener("change", renderAttendance);

  document.querySelectorAll(".tab-btn").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((btn) => btn.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.add("hidden"));
      button.classList.add("active");
      $(button.dataset.tab).classList.remove("hidden");
    });
  });

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
        titleId: $("workerTitle").value
      });
      event.target.reset();
      await loadAdminDashboard();
      showToast("Conta de funcionário criada com sucesso.");
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

    await loadReferenceData();
    displayAppView(state.userProfile.role);
    if (state.userProfile.role === "admin") {
      await loadAdminDashboard();
    } else if (state.userProfile.role === "worker") {
      await loadWorkerExperience();
    } else {
      throw new Error("Cargo de usuário não suportado.");
    }
  } catch (error) {
    console.error(error);
    showToast(error.message, "error");
  }
});

bindEvents();
