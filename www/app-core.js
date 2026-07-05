import v1 from "./supabase.js";
import { ENABLE_REALTIME, PAGE_SIZE, GEMINI_API_KEY } from "./config.js";
import { validateSession, CLASS_OPTIONS, TERMS, TERM_DATE_MAP, SUBJECT_COLORS, DEFAULT_SUBJECTS, openModal, closeModal, toast, logout, escapeHtml, getTeacherAssignments, getLocalToday, initNepaliDatePicker, formatDateLabel, fetchProfileMap, uploadStudentPhoto } from "./shared.js";
window.supabaseClient = v1;
window.currentUser = null;
window.currentTeacherName = "Teacher";
window.state = {
  attendance: {},
  students: [],
  homework: {},
  marks: {},
  subjects: [],
  selectedMarksClass: "Grade 1",
  selectedTerm: "First Mid Term",
  selectedDate: getLocalToday(),
  selectedAttClass: "All",
  currentView: "dashboard",
  selectedStudentClass: "All",
  selectedHwClass: "All",
  selectedRoutineType: "Class",
  selectedRoutineTerm: "Regular",
  messages: [],
  lastFetch: {},
  notifChannel: null
};
const state = window.state;
window.getToday = () => {
  return getLocalToday();
};
window.formatDateLabel = v2 => {
  return formatDateLabel(v2);
};
function generateId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, v3 => {
    const v4 = Math.random() * 16 | 0;
    return (v3 === "x" ? v4 : v4 & 3 | 8).toString(16);
  });
}
async function logActivity(v5, v6) {
  try {
    await v1.from("teacher_activity").insert({
      teacher_id: window.currentUser?.id || null,
      teacher_name: window.currentTeacherName || "Teacher",
      action: v5,
      details: v6
    });
  } catch (v7) {
    console.warn("logActivity failed", v7);
  }
}
async function initializeApp() {
  const v8 = await validateSession();
  if (!v8) {
    return;
  }
  try {
    window.currentUser = v8.user;
    let v9 = null;
    try {
      const v10 = localStorage.getItem("userProfile");
      if (v10) {
        const v11 = JSON.parse(v10);
        if (v11 && v11.id === v8.user.id) {
          v9 = v11;
        } else {
          console.warn("Cached profile belongs to a different user. Clearing...");
          localStorage.removeItem("userProfile");
        }
      }
    } catch (v12) {
      console.warn("Corrupted profile cache detected. Clearing...");
      localStorage.removeItem("userProfile");
    }
    if (!v9) {
      const {
        data: v13
      } = await v1.from("profiles").select("*").eq("id", v8.user.id).single();
      v9 = v13;
      localStorage.setItem("userProfile", JSON.stringify({
        ...v9,
        _cachedAt: Date.now()
      }));
    }
    window.currentUserProfile = v9;
    window.currentTeacherName = v9.full_name || v9.name || v9.email || "Teacher";
    await Promise.all([loadSubjectsFromDb(), loadStudentsFromDb(), window.loadLeaveApplications()]);
    window.switchView("dashboard", false);
    history.replaceState({
      view: "dashboard"
    }, "");
    hideSplashScreen();
    if (typeof window.initNotificationSubscription === "function") {
      window.initNotificationSubscription();
    }
  } catch (v14) {
    console.error("App init failed:", v14);
  } finally {
    const v15 = document.getElementById("splash-screen");
    if (v15) {
      v15.style.opacity = "0";
      setTimeout(() => v15.remove(), 300);
    }
  }
}
function hideSplashScreen() {
  const v16 = document.getElementById("splash-screen");
  if (v16) {
    v16.classList.add("hidden");
    setTimeout(() => v16.remove(), 500);
  }
}
document.addEventListener("DOMContentLoaded", initializeApp);
const _CLASS_MAP = new Map(CLASS_OPTIONS.map(v17 => [v17.toLowerCase(), v17]));
function normalizeClass(v18) {
  if (!v18) return "";
  let clean = String(v18).trim().toLowerCase();
  
  const directMatch = CLASS_OPTIONS.find(c => c.toLowerCase() === clean);
  if (directMatch) return directMatch;
  
  const wordToNumber = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12
  };
  
  const pattern = /(?:class|grade)\s*(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)/i;
  const match = clean.match(pattern);
  if (match) {
    const val = match[1];
    if (/^\d+$/.test(val)) {
      const target = "Grade " + val;
      const found = CLASS_OPTIONS.find(c => c.toLowerCase() === target.toLowerCase());
      if (found) return found;
    } else {
      const num = wordToNumber[val];
      if (num) {
        const target = "Grade " + num;
        const found = CLASS_OPTIONS.find(c => c.toLowerCase() === target.toLowerCase());
        if (found) return found;
      }
    }
  }
  
  if (/^\d+$/.test(clean)) {
    const target = "Grade " + clean;
    const found = CLASS_OPTIONS.find(c => c.toLowerCase() === target.toLowerCase());
    if (found) return found;
  }
  
  if (wordToNumber[clean]) {
    const target = "Grade " + wordToNumber[clean];
    const found = CLASS_OPTIONS.find(c => c.toLowerCase() === target.toLowerCase());
    if (found) return found;
  }
  
  const simpleNumberMatch = clean.match(/\b(\d+)\b/);
  if (simpleNumberMatch) {
    const num = simpleNumberMatch[1];
    const target = "Grade " + num;
    const found = CLASS_OPTIONS.find(c => c.toLowerCase() === target.toLowerCase());
    if (found) return found;
  }

  const substringMatch = CLASS_OPTIONS.find(c => clean.includes(c.toLowerCase()));
  if (substringMatch) return substringMatch;
  
  return v18;
}
function sortStudents() {
  window.state.students.sort((v20, v21) => {
    const v22 = CLASS_OPTIONS.indexOf(v20.class);
    const v23 = CLASS_OPTIONS.indexOf(v21.class);
    if (v22 !== v23) {
      return (v22 === -1 ? 99 : v22) - (v23 === -1 ? 99 : v23);
    }
    const v24 = parseInt(v20.roll) || 0;
    const v25 = parseInt(v21.roll) || 0;
    if (v24 !== v25) {
      return v24 - v25;
    }
    return v20.name.localeCompare(v21.name);
  });
}
async function loadStudentsFromDb(v26 = false) {
  const v27 = "students";
  const v28 = Date.now();
  if (!v26 && state.students.length > 0 && state.lastFetch[v27] && v28 - state.lastFetch[v27] < 300000) {
    console.log("Using fresh student state (SWR 5min)");
    return;
  }
  try {
    if (state.students.length === 0) {
      const v31 = localStorage.getItem("cache_students");
      if (v31) {
        state.students = JSON.parse(v31);
        sortStudents();
        if (state.currentView === "students") {
          renderStudentList(state.students);
        }
      }
    }
    const v29 = await window.fetchAllPaginated((s, e) => v1.from("students").select("id, name, roll, class, dob, parents, mobile").range(s, e));
    const v30 = null;
    state.students = (v29 || []).map(v32 => {
      const v33 = String(v32.id);
      return {
        id: v33,
        name: String(v32.name || ""),
        roll: String(v32.roll || ""),
        dob: String(v32.dob || ""),
        parents: String(v32.parents || ""),
        mobile: String(v32.mobile || ""),
        class: normalizeClass(v32.class),
        photo: null
      };
    });
    sortStudents();
    state.lastFetch[v27] = v28;
    localStorage.setItem("cache_students", JSON.stringify(state.students));
    if (state.currentView === "students") {
      const v34 = document.getElementById("student-list");
      if (v34) {
        v34.innerHTML = renderStudentList(state.students);
      }
      if (window.lucide) {
        lucide.createIcons();
      }
    }
  } catch (v35) {
    console.error("Error loading students from Supabase", v35);
  }
}
async function loadSubjectsFromDb(v36 = false) {
  const v37 = "subjects";
  const v38 = Date.now();
  if (!v36 && state.subjects.length > 0 && state.lastFetch[v37] && v38 - state.lastFetch[v37] < 300000) {
    return;
  }
  try {
    if (state.subjects.length === 0) {
      const v41 = localStorage.getItem("cache_subjects");
      if (v41) {
        state.subjects = JSON.parse(v41);
      }
      const v42 = localStorage.getItem("cache_subjects_db");
      if (v42) {
        state.subjectsDb = JSON.parse(v42);
      }
    }
    const {
      data: v39,
      error: v40
    } = await v1.from("subjects").select("id, name, sort_order").order("sort_order");
    if (v40) {
      throw v40;
    }
    if (v39 && v39.length) {
      state.subjects = [...new Set(v39.map(v43 => window.normalizeSubjectName ? window.normalizeSubjectName(v43.name) : v43.name))];
      state.subjectsDb = v39.map(v44 => ({
        id: v44.id || v44.name,
        name: window.normalizeSubjectName ? window.normalizeSubjectName(v44.name) : v44.name
      }));
      state.lastFetch[v37] = v38;
      localStorage.setItem("cache_subjects", JSON.stringify(state.subjects));
      localStorage.setItem("cache_subjects_db", JSON.stringify(state.subjectsDb));
    }
  } catch (v45) {
    console.error("loadSubjectsFromDb error", v45);
  }
}
async function loadMarksFromDb(v46, v47 = false) {
  const v48 = "marks_" + v46;
  const v49 = Date.now();
  if (!v47 && state.lastFetch[v48] && v49 - state.lastFetch[v48] < 60000) {
    return;
  }
  try {
    const v50 = await window.fetchAllPaginated((s, e) => v1.from("marks").select("student_id, subject, value").eq("term", v46).range(s, e));
    const v51 = null;
    if (!state.marks[v46]) {
      state.marks[v46] = {};
    }
    (v50 || []).forEach(v53 => {
      if (!state.marks[v46][v53.student_id]) {
        state.marks[v46][v53.student_id] = {};
      }
      const normSub = window.normalizeSubjectName ? window.normalizeSubjectName(v53.subject) : v53.subject;
      state.marks[v46][v53.student_id][normSub] = v53.value;
      if (normSub === "हाम्रो सेरोफेरो" || normSub === "Our Surroundings") {
          const student = state.students.find(s => s.id === v53.student_id);
          if (student && student.class && (student.class.match(/grade\s*[1-3]$/i) || student.class.match(/^class\s*[1-3]$/i) || ["PG", "Nursery", "LKG", "UKG"].includes(student.class))) {
              state.marks[v46][v53.student_id]["Social Studies"] = v53.value;
              state.marks[v46][v53.student_id]["Science & Technology"] = v53.value;
              state.marks[v46][v53.student_id]["Health, Physical & Creative Arts"] = v53.value;
          }
      }
    });
    state.lastFetch[v48] = v49;
    const v52 = Object.keys(state.marks);
    if (v52.length > 2) {
      v52.slice(0, v52.length - 2).forEach(v54 => delete state.marks[v54]);
    }
  } catch (v55) {
    console.error("loadMarksFromDb error", v55);
  }
}
window.switchView = function (v56, v57 = true, v58 = 0) {
  if (!v56 || !window.state) {
    return;
  }
  if (!window.views) {
    if (v58 >= 20) {
      console.error("switchView: views still not ready after 20 retries, giving up.");
      return;
    }
    console.warn("Views not ready, retrying in 100ms... (" + (v58 + 1) + "/20)");
    setTimeout(() => window.switchView(v56, v57, v58 + 1), 100);
    return;
  }
  if (v57 && state.currentView !== v56) {
    history.pushState({
      view: v56
    }, "");
  }
  state.currentView = v56;
  const v59 = {
    dashboard: "Dashboard",
    students: "Students",
    attendance: "Attendance",
    homework: "Homework",
    messages: "Message Centre",
    performance: "Marks",
    hwTracking: "HW Tracking"
  };
  const v60 = document.getElementById("view-title");
  if (v60) {
    v60.textContent = v59[v56] || v56;
  }
  const v61 = document.getElementById("main-content");
  if (!v61) {
    return;
  }
  if (v56 === "performance") {
    v61.innerHTML = "<div style=\"padding:2rem;text-align:center\"><p style=\"color:var(--text-muted)\">Loading marks...</p></div>";
    loadMarksFromDb(state.selectedTerm).then(() => {
      if (state.currentView === "performance") {
        v61.innerHTML = window.views.performance();
        if (window.lucide) {
          lucide.createIcons();
        }
      }
    });
  } else if (v56 === "practicalmarks") {
    v61.innerHTML = "<div style=\"padding:2rem;text-align:center\"><p style=\"color:var(--text-muted)\">Loading practical marks...</p></div>";
    loadPracticalMarksFromDb(state.selectedPracticalTerm || "First Term").then(() => {
      if (state.currentView === "practicalmarks") {
        v61.innerHTML = window.views.practicalmarks();
        if (window.lucide) {
          lucide.createIcons();
        }
      }
    });
  } else if (window.views[v56]) {
    if (v56 === "attendance") {
      v61.innerHTML = "<div style=\"padding:2rem;text-align:center\"><p style=\"color:var(--text-muted)\">Loading attendance...</p></div>";
      Promise.all([window.loadLeaveApplications(), loadAttendanceForDate(state.selectedDate)]).then(() => {
        if (state.currentView === "attendance") {
          v61.innerHTML = window.views.attendance();
          if (window.initNepaliDatePicker) {
            setTimeout(() => window.initNepaliDatePicker(".nepali-date-picker"), 100);
          }
          if (window.lucide) {
            lucide.createIcons();
          }
          loadAttendanceForDate(state.selectedDate);
        }
      });
    } else {
      v61.innerHTML = window.views[v56]();
      if (window.lucide) {
        lucide.createIcons();
      }
      if (v56 === "homework") {
        loadHomeworkFromDb();
      }
      if (v56 === "messages") {
        loadMessagesFromDb();
      }
    }
    if (v56 === "routine") {
      v61.innerHTML = "<div style=\"padding:2rem;text-align:center\"><p style=\"color:var(--text-muted)\">Loading routine...</p></div>";
      window.loadRoutineForClass(state.selectedRoutineClass).then(() => {
        if (state.currentView === "routine") {
          v61.innerHTML = window.views.routine();
          window.renderRoutineContent();
          if (window.lucide) {
            lucide.createIcons();
          }
        }
      });
    }
    if (v56 === "leave") {
      v61.innerHTML = "<div style=\"padding:2rem;text-align:center\"><p style=\"color:var(--text-muted)\">Loading leave applications...</p></div>";
      window.loadLeaveApplications().then(() => {
        if (state.currentView === "leave") {
          v61.innerHTML = window.views.leave();
          window.renderLeaveApps();
          if (window.lucide) {
            lucide.createIcons();
          }
        }
      });
    }
    if (v56 === "hwTracking") {
      (async () => {
        await loadHwStatusForHw(state.trackingHwId);
        v61.innerHTML = window.views.hwTracking();
        if (window.lucide) {
          lucide.createIcons();
        }
      })();
    }
  }
  document.querySelectorAll(".nav-item").forEach(v62 => {
    const v63 = v62.dataset.view === v56;
    v62.classList.toggle("active", v63);
    const v64 = v62.querySelector(".nav-icon-wrap");
    if (v64) {
      v64.style.background = v63 ? "var(--primary-light)" : "";
    }
  });
  if (v56 === "messages") {
    const v65 = document.getElementById("badge-messages");
    if (v65) {
      v65.style.display = "none";
    }
  }
  if (v56 === "leave") {
    const v66 = document.getElementById("badge-leave");
    if (v66) {
      v66.style.display = "none";
    }
  }
};
window.addEventListener("popstate", v67 => {
  if (window.ignoreNextPopstate) {
    window.ignoreNextPopstate = false;
    return;
  }
  const v68 = document.getElementById("modal-overlay");
  if (v68 && v68.classList.contains("open")) {
    return;
  }
  const v69 = v67.state;
  if (v69 && v69.view) {
    window.switchView(v69.view, false);
  } else {
    window.switchView("dashboard", false);
  }
});
async function loadAttendanceForDate(v70, v71 = false) {
  if (!v70) {
    return;
  }
  const v72 = "att_" + v70;
  const v73 = Date.now();
  if (!v71 && state.lastFetch[v72] && v73 - state.lastFetch[v72] < 60000) {
    console.log("Using cached attendance for " + v70);
    document.querySelectorAll(".att-row").forEach(v74 => {
      const v75 = v74.dataset.sid;
      const v76 = (state.attendance[v70] || {})[v75] || "";
      v74.querySelectorAll(".toggle-btn").forEach(v77 => v77.classList.toggle("active", v77.dataset.status === v76));
    });
    updateAttSummary();
    return;
  }
  try {
    const v78 = (state.students || []).map(v83 => v83.id);
    if (v78.length === 0) {
      state.attendance[v70] = {};
      updateAttSummary();
      return;
    }
    let v79 = v70;
    if (window.NepaliFunctions) {
      v79 = window.NepaliFunctions.BS2AD(v70, "YYYY-MM-DD", "YYYY-MM-DD") || v70;
    }
    const {
      data: v80,
      error: v81
    } = await v1.from("attendance").select("student_id,status").eq("date", v79).in("student_id", v78);
    if (v81) {
      console.error("Failed to load attendance", v81);
      toast("Failed to load attendance");
      return;
    }
    state.attendance[v70] = {};
    (v80 || []).forEach(v84 => {
      state.attendance[v70][String(v84.student_id)] = v84.status;
    });
    state.lastFetch[v72] = v73;
    const v82 = Object.keys(state.attendance);
    if (v82.length > 30) {
      v82.slice(0, v82.length - 30).forEach(v85 => delete state.attendance[v85]);
    }
    document.querySelectorAll(".att-row").forEach(v86 => {
      const v87 = v86.dataset.sid;
      const v88 = (state.attendance[v70] || {})[v87] || "";
      v86.querySelectorAll(".toggle-btn").forEach(v89 => v89.classList.toggle("active", v89.dataset.status === v88));
    });
    updateAttSummary();
  } catch (v90) {
    console.error("loadAttendanceForDate error", v90);
    toast("Unexpected error loading attendance");
  }
}
async function upsertAttendanceRecord(v91, v92, v93) {
  if (!v91 || !v92) {
    return;
  }
  try {
    let v94 = v91;
    if (window.NepaliFunctions) {
      v94 = window.NepaliFunctions.BS2AD(v91, "YYYY-MM-DD", "YYYY-MM-DD") || v91;
    }
    if (!v93) {
      const {
        error: v95
      } = await v1.from("attendance").delete().match({
        date: v94,
        student_id: v92
      });
      if (v95) {
        console.error("delete attendance error", v95);
        toast("Failed to remove attendance");
      }
    } else {
      const v96 = {
        date: v94,
        student_id: v92,
        status: v93,
        teacher_id: window.currentUser?.id || null
      };
      const {
        error: v97
      } = await v1.from("attendance").upsert(v96, {
        onConflict: "date,student_id"
      });
      if (v97) {
        console.error("upsertAttendanceRecord error", v97);
        toast("Failed to save attendance");
      }
    }
  } catch (v98) {
    console.error("upsertAttendanceRecord exception", v98);
    toast("Unexpected error saving attendance");
  }
}
window.toggleAttendance = function (v99, v100) {
  const v101 = state.selectedDate;
  if (!state.attendance[v101]) {
    state.attendance[v101] = {};
  }
  if (state.attendance[v101][v99] === v100) {
    delete state.attendance[v101][v99];
    upsertAttendanceRecord(v101, v99, null);
  } else {
    state.attendance[v101][v99] = v100;
    upsertAttendanceRecord(v101, v99, v100);
  }
  const v102 = document.querySelector(".att-row[data-sid=\"" + v99 + "\"]");
  if (v102) {
    v102.querySelectorAll(".toggle-btn").forEach(v103 => {
      v103.classList.toggle("active", v103.dataset.status === (state.attendance[v101][v99] || ""));
    });
  }
  updateAttSummary();
};
function updateAttSummary() {
  const v104 = state.selectedDate;
  const v105 = state.attendance[v104] || {};
  let v106 = 0;
  let v107 = 0;
  let v108 = 0;
  let v109 = state.students;
  if (state.selectedAttClass !== "All") {
    v109 = v109.filter(v113 => String(v113.class || "").trim().toLowerCase() === String(state.selectedAttClass || "").trim().toLowerCase());
  }
  v109.forEach(v114 => {
    if (v105[v114.id] === "P") {
      v106++;
    } else if (v105[v114.id] === "A") {
      v107++;
    } else if (v105[v114.id] === "L") {
      v108++;
    }
  });
  const v110 = document.getElementById("att-p");
  if (v110) {
    v110.textContent = v106;
  }
  const v111 = document.getElementById("att-a");
  if (v111) {
    v111.textContent = v107;
  }
  const v112 = document.getElementById("att-l");
  if (v112) {
    v112.textContent = v108;
  }
}
window.changeAttDate = function (v115) {
  state.selectedDate = v115;
  switchView("attendance");
};
window.changeAttClass = function (v116) {
  state.selectedAttClass = v116;
  switchView("attendance");
};
window.saveAttendance = function () {
  const v117 = state.selectedDate;
  if (!state.attendance[v117]) {
    state.attendance[v117] = {};
  }
  let v118 = state.students;
  if (state.selectedAttClass !== "All") {
    v118 = v118.filter(v119 => String(v119.class || "").trim().toLowerCase() === String(state.selectedAttClass || "").trim().toLowerCase());
  } else {
    const v120 = getTeacherAssignments();
    if (!v120.isAdmin) {
      const v121 = v120.assignments.filter(v122 => v122.isHomeroom).map(v123 => v123.className);
      v118 = v118.filter(v124 => v121.includes(v124.class));
    }
  }
  v118.forEach(v125 => {
    if (!state.attendance[v117][v125.id]) {
      state.attendance[v117][v125.id] = "P";
    }
  });
  (async () => {
    try {
      let v126 = v117;
      if (window.NepaliFunctions) {
        v126 = window.NepaliFunctions.BS2AD(v117, "YYYY-MM-DD", "YYYY-MM-DD") || v117;
      }
      const v127 = v118.map(v128 => ({
        date: v126,
        student_id: v128.id,
        status: state.attendance[v117][v128.id] || "P",
        teacher_id: window.currentUser?.id || null
      }));
      if (v127.length) {
        const {
          error: v129
        } = await v1.from("attendance").upsert(v127, {
          onConflict: "date,student_id"
        });
        if (v129) {
          toast(v129.message || "Failed to save attendance");
          return;
        }
      }
      await logActivity("Saved Attendance", "Class: " + state.selectedAttClass + ", Date: " + v117);
      toast("Marked successfully!");
      updateAttSummary();
      switchView("attendance");
    } catch (v130) {
      console.error("saveAttendance error", v130);
      toast("Unexpected error saving attendance");
    }
  })();
};
window.openStudentForm = function (v131 = null) {
  const v132 = v131 ? state.students.find(v133 => v133.id === v131) : {
    id: null,
    name: "",
    roll: "",
    dob: "",
    parents: "",
    mobile: "",
    class: "Grade 1",
    photo: null
  };
  const formattedParents = window.formatParentsName(v132.parents);
  const casCollapsible = window.getCasDetailsCollapsible(v132.parents);
  openModal("\n    <div class=\"modal-handle\"></div>\n    <p class=\"modal-title\">" + (v131 ? "Edit Student" : "Add Student") + "</p>\n    <div class=\"photo-upload\" onclick=\"document.getElementById('ph-inp').click()\">\n      <img id=\"ph-prev\" src=\"" + (v132.photo || "") + "\" style=\"" + (v132.photo ? "" : "display:none") + "\">\n      " + (v132.photo ? "" : "<i data-lucide=\"camera\" style=\"color:#4f46e5\"></i>") + "\n      <input type=\"file\" id=\"ph-inp\" accept=\"image/*\" onchange=\"handlePhoto(this)\">\n    </div>\n    <p style=\"text-align:center;font-size:0.7rem;margin-bottom:1rem\">Tap to upload photo</p>\n    <div class=\"form-group\"><label class=\"form-label\">Full Name</label><input class=\"form-input\" id=\"fn\" value=\"" + escapeHtml(v132.name) + "\" placeholder=\"Student full name\"></div>\n    <div class=\"form-group\"><label class=\"form-label\">Roll Number</label><input class=\"form-input\" id=\"fr\" value=\"" + escapeHtml(v132.roll) + "\" placeholder=\"e.g. 101\"></div>\n    <div class=\"form-group\"><label class=\"form-label\">Date of Birth</label><input type=\"text\" class=\"form-input nepali-date-picker\" id=\"fd\" value=\"" + escapeHtml(v132.dob) + "\" placeholder=\"YYYY-MM-DD\" readonly></div>\n    <div class=\"form-group\"><label class=\"form-label\">Parent's Name</label><input class=\"form-input\" id=\"fp\" value=\"" + escapeHtml(formattedParents) + "\" placeholder=\"Father & Mother name\"></div>\n    <div class=\"form-group\"><label class=\"form-label\">Mobile Number</label><input class=\"form-input\" id=\"fm\" type=\"tel\" value=\"" + escapeHtml(v132.mobile) + "\" placeholder=\"98XXXXXXXX\"></div>\n    <div class=\"form-group\"><label class=\"form-label\">Class</label>\n      <select class=\"form-input\" id=\"fc\">\n        " + CLASS_OPTIONS.map(v134 => "<option " + (v132.class === v134 ? "selected" : "") + ">" + escapeHtml(v134) + "</option>").join("") + "\n      </select>\n    </div>\n    " + casCollapsible + "\n    <button class=\"btn btn-primary btn-block\" style=\"margin-top:1rem;\" onclick=\"saveStudent('" + v131 + "')\"><i data-lucide=\"save\"></i> Save</button>\n    " + (v131 ? "<button class=\"btn btn-danger btn-block\" style=\"margin-top:0.5rem\" onclick=\"deleteStudent('" + v131 + "')\"><i data-lucide=\"trash-2\"></i> Delete Student</button>" : "") + "\n  ");
  if (window.initNepaliDatePicker) {
    window.initNepaliDatePicker(".nepali-date-picker");
  }
};
window.handlePhoto = function (v135) {
  const v136 = v135.files[0];
  if (!v136) {
    return;
  }
  state.tempPhotoFile = v136;
  const v137 = document.getElementById("ph-prev");
  if (v137) {
    v137.src = URL.createObjectURL(v136);
    v137.style.display = "block";
  }
};
window.saveStudent = function (v138) {
  (async () => {
    const v139 = document.getElementById("fn").value.trim();
    const v140 = document.getElementById("fr").value.trim();
    const v141 = document.getElementById("fc").value;
    if (!v139 || !v140) {
      toast("Name and roll are required");
      return;
    }
    let v142 = null;
    const v143 = v138 && v138 !== "null";
    const v144 = v143 ? v138 : generateId();
    if (state.tempPhotoFile) {
      toast("Uploading photo...", 2000);
      v142 = await uploadStudentPhoto(state.tempPhotoFile, v144);
    } else if (v143) {
      v142 = (state.students.find(v146 => v146.id === v138) || {}).photo || null;
    }
    state.tempPhotoFile = null;
    const v145 = {
      id: v144,
      name: v139,
      roll: v140,
      dob: document.getElementById("fd").value || null,
      parents: window.serializeCasDetails(document.getElementById("fp").value || null),
      mobile: document.getElementById("fm").value || null,
      class: v141,
      photo: v142
    };
    try {
      let v147 = null;
      if (v138 && v138 !== "null") {
        const {
          data: v149,
          error: v150
        } = await v1.from("students").upsert(v145).select().single();
        if (v150) {
          toast(v150.message || "Failed to update student");
          return;
        }
        v147 = v149;
      } else {
        const {
          data: v151,
          error: v152
        } = await v1.from("students").insert(v145).select().single();
        if (v152) {
          toast(v152.message || "Failed to add student");
          return;
        }
        v147 = v151;
      }
      const v148 = {
        id: String(v147.id),
        name: String(v147.name || ""),
        roll: String(v147.roll || ""),
        dob: String(v147.dob || ""),
        parents: String(v147.parents || ""),
        mobile: String(v147.mobile || ""),
        class: normalizeClass(v147.class),
        photo: v147.photo || null
      };
      if (v138 && v138 !== "null") {
        const v153 = state.students.findIndex(v154 => v154.id === v138);
        if (v153 !== -1) {
          state.students[v153] = v148;
        }
        await logActivity("Updated Student", v139 + " — " + v141);
        toast("Student updated!");
      } else {
        state.students.push(v148);
        await logActivity("Added Student", v139 + " — " + v141);
        toast("Student added!");
      }
      sortStudents();
      closeModal();
      switchView("students");
    } catch (v155) {
      console.error("saveStudent error", v155);
      toast("Unexpected error");
    }
  })();
};
window.deleteStudent = function (v156) {
  (async () => {
    const v157 = state.students.find(v158 => v158.id === v156);
    if (!confirm("Delete this student? This cannot be undone.")) {
      return;
    }
    try {
      const {
        error: v159
      } = await v1.from("students").delete().eq("id", v156);
      if (v159) {
        toast(v159.message || "Failed to delete student");
        return;
      }
      state.students = state.students.filter(v160 => v160.id !== v156);
      await logActivity("Deleted Student", v157?.name || v156);
      closeModal();
      toast("Student removed");
      switchView("students");
    } catch (v161) {
      console.error("deleteStudent error", v161);
      toast("Unexpected error");
    }
  })();
};
window.changeStudentClass = function (v162) {
  state.selectedStudentClass = v162;
  switchView("students");
};
window.filterStudents = function (v163) {
  let v164 = state.students;
  if (state.selectedStudentClass && state.selectedStudentClass !== "All") {
    v164 = v164.filter(v165 => String(v165.class || "").trim().toLowerCase() === String(state.selectedStudentClass || "").trim().toLowerCase());
  }
  v164 = v164.filter(v166 => (v166.name || "").toLowerCase().includes(v163.toLowerCase()) || String(v166.roll || "").includes(v163));
  document.getElementById("student-list").innerHTML = renderStudentList(v164);
  lucide.createIcons();
};
export const renderStudentList = function (v167) {
  if (!v167 || !v167.length) {
    return "<div class=\"empty-state\"><i data-lucide=\"search\" style=\"width:48px;height:48px;color:var(--text-muted);opacity:0.3\"></i><p>No students found</p></div>";
  }
  return v167.map(v168 => "\n    <div class=\"student-row\" onclick=\"window.viewStudent('" + v168.id + "')\">\n      <div class=\"avatar\">" + (v168.photo ? "<img src=\"" + v168.photo + "\" loading=\"lazy\" decoding=\"async\">" : "" + escapeHtml((v168.name || "?").charAt(0))) + "</div>\n      <div class=\"student-info\"><h3>" + escapeHtml(v168.name || "Unknown") + "</h3><p>Roll: " + escapeHtml(v168.roll || "—") + " &bull; " + escapeHtml(v168.class || "No Class") + "</p></div>\n      <i data-lucide=\"chevron-right\" style=\"color:#cbd5e1;flex-shrink:0\"></i>\n    </div>").join("");
};
async function loadHomeworkFromDb(v169 = false) {
  const v170 = "homework_all";
  const v171 = Date.now();
  if (!v169 && state.lastFetch[v170] && v171 - state.lastFetch[v170] < 60000) {
    console.log("Using cached homework list");
    return;
  }
  try {
    const v172 = getTeacherAssignments();
    let v173 = v1.from("homework").select("id, class, subject, task, date, teacher_id, due, created_at").order("created_at", {
      ascending: false
    }).limit(100);
    if (!v172.isAdmin && v172.teacherId) {
      v173 = v173.eq("teacher_id", v172.teacherId);
    }
    const {
      data: v174,
      error: v175
    } = await v173;
    if (v175) {
      console.error("Failed to load homework", v175);
      return;
    }
    const v176 = [...new Set((v174 || []).map(v179 => v179.teacher_id).filter(Boolean))];
    const v177 = v176.length > 0 ? await fetchProfileMap(v176) : {};
    state.homework = {};
    (v174 || []).forEach(v180 => {
      let v181 = v180.date;
      if (window.NepaliFunctions) {
        v181 = window.NepaliFunctions.AD2BS(v180.date, "YYYY-MM-DD", "YYYY-MM-DD") || v180.date;
      }
      let v182 = v180.due;
      if (window.NepaliFunctions && v180.due) {
        v182 = window.NepaliFunctions.AD2BS(v180.due, "YYYY-MM-DD", "YYYY-MM-DD") || v180.due;
      }
      if (!state.homework[v181]) {
        state.homework[v181] = [];
      }
      state.homework[v181].push({
        id: v180.id,
        date: v181,
        class: v180.class,
        subject: v180.subject,
        task: v180.task,
        due: v182 || v181,
        teacher_id: v180.teacher_id,
        teacher_name: v177[v180.teacher_id] || null
      });
    });
    const v178 = (v174 || []).map(v183 => v183.id);
    if (v178.length > 0) {
      const {
        data: v184
      } = await v1.from("hw_status").select("*").in("hw_id", v178);
      if (!state.hwStatus) {
        state.hwStatus = {};
      }
      (v184 || []).forEach(v185 => {
        if (!state.hwStatus[v185.hw_id]) {
          state.hwStatus[v185.hw_id] = {};
        }
        state.hwStatus[v185.hw_id][String(v185.student_id)] = v185.status;
      });
    }
    state.lastFetch[v170] = v171;
  } catch (v186) {
    console.error("loadHomeworkFromDb error", v186);
  }
}
async function loadHwStatusForHw(v187, v188 = false) {
  if (!v187) {
    return;
  }
  const v189 = "hw_status_" + v187;
  const v190 = Date.now();
  if (!v188 && state.lastFetch[v189] && v190 - state.lastFetch[v189] < 60000) {
    console.log("Using cached status for hw " + v187);
    return;
  }
  try {
    const {
      data: v191,
      error: v192
    } = await v1.from("hw_status").select("student_id,status").eq("hw_id", v187);
    if (v192) {
      console.error("Failed to load hw_status", v192);
      return;
    }
    if (!state.hwStatus) {
      state.hwStatus = {};
    }
    state.hwStatus[v187] = {};
    (v191 || []).forEach(v194 => {
      state.hwStatus[v187][String(v194.student_id)] = v194.status;
    });
    state.lastFetch[v189] = v190;
    const v193 = Object.keys(state.hwStatus);
    if (v193.length > 50) {
      v193.slice(0, v193.length - 50).forEach(v195 => delete state.hwStatus[v195]);
    }
  } catch (v196) {
    console.error("loadHwStatusForHw error", v196);
  }
}
window.openAddHomework = function () {
  const v197 = getTeacherAssignments();
  let v198;
  let v199;
  if (v197.isAdmin) {
    v198 = ["All", ...CLASS_OPTIONS];
    v199 = state.subjects.length ? state.subjects : DEFAULT_SUBJECTS;
  } else {
    v198 = v197.assignments.map(v203 => v203.className);
    if (v198.length === 0) {
      toast("You have no class assignments. Contact admin.");
      return;
    }
    const v202 = v197.assignments[0];
    v199 = v202 && v202.subjects && v202.subjects.length > 0 ? v202.subjects : state.subjects.length ? state.subjects : DEFAULT_SUBJECTS;
  }
  const v200 = v204 => {
    if (v197.isAdmin) {
      if (state.subjects.length) {
        return state.subjects;
      } else {
        return DEFAULT_SUBJECTS;
      }
    }
    const v205 = v197.assignments.find(v206 => v206.className === v204);
    if (v205 && v205.subjects && v205.subjects.length > 0) {
      return v205.subjects;
    } else if (state.subjects.length) {
      return state.subjects;
    } else {
      return DEFAULT_SUBJECTS;
    }
  };
  const v201 = v198.includes(state.selectedHwClass) ? state.selectedHwClass : v198[0];
  v199 = v200(v201);
  openModal("\n    <div class=\"modal-handle\"></div>\n    <p class=\"modal-title\">Assign Homework</p>\n    <div class=\"form-group\"><label class=\"form-label\">Class</label>\n      <select class=\"form-input\" id=\"hw-class\" onchange=\"window._updateHwSubjects && window._updateHwSubjects(this.value)\">\n        " + v198.map(v207 => "<option value=\"" + v207 + "\" " + (v207 === v201 ? "selected" : "") + ">" + v207 + "</option>").join("") + "\n      </select>\n    </div>\n    <div class=\"form-group\"><label class=\"form-label\">Subject</label>\n      <select class=\"form-input\" id=\"hw-sub\">\n        " + v199.map(v208 => "<option value=\"" + v208 + "\">" + v208 + "</option>").join("") + "\n      </select>\n    </div>\n    <div class=\"form-group\"><label class=\"form-label\">Task / Description</label>\n      <textarea class=\"form-input\" id=\"hw-task\" placeholder=\"Describe the homework task...\"></textarea>\n    </div>\n    <button class=\"btn btn-primary btn-block\" onclick=\"saveHomework()\"><i data-lucide=\"check-circle\"></i> Assign</button>\n  ");
  window._updateHwSubjects = function (v209) {
    const v210 = v200(v209);
    const v211 = document.getElementById("hw-sub");
    if (v211) {
      v211.innerHTML = v210.map(v212 => "<option value=\"" + v212 + "\">" + v212 + "</option>").join("");
    }
  };
};
window.saveHomework = function () {
  const v213 = document.getElementById("hw-class").value;
  const v214 = document.getElementById("hw-sub").value.trim();
  const v215 = document.getElementById("hw-task").value.trim();
  if (!v214) {
    toast("Please specify a subject");
    return;
  }
  if (!v215) {
    toast("Please describe the task");
    return;
  }
  const v216 = getToday();
  (async () => {
    try {
      let v217 = v216;
      if (window.NepaliFunctions) {
        v217 = window.NepaliFunctions.BS2AD(v216, "YYYY-MM-DD", "YYYY-MM-DD") || v216;
      }
      const v218 = {
        id: generateId(),
        date: v217,
        class: v213,
        subject: v214,
        task: v215,
        due: v217,
        teacher_id: window.currentUser?.id || null
      };
      const {
        data: v219,
        error: v220
      } = await v1.from("homework").insert(v218).select().single();
      if (v220) {
        toast(v220.message || "Failed to save homework");
        return;
      }
      if (!state.homework[v216]) {
        state.homework[v216] = [];
      }
      state.homework[v216].push({
        id: v219.id,
        subject: v214,
        task: v215,
        class: v213,
        teacher_id: window.currentUser?.id || null,
        teacher_name: window.currentTeacherName || null
      });
      await logActivity("Assigned Homework", "Class: " + v213 + ", Subject: " + v214);
      try {
        await v1.from("notifications").insert({
          title: "New Homework: " + v214,
          body: "Task: " + v215,
          type: "homework",
          target_type: "class",
          target_value: v213
        });
      } catch (v221) {
        console.error("HW notif err", v221);
      }
      toast("Homework assigned!");
      closeModal();
      state.lastFetch.homework_all = 0;
      switchView("homework");
    } catch (v222) {
      console.error("saveHomework error", v222);
      toast("Unexpected error saving homework");
    }
  })();
};
window.changeHwClass = function (v223) {
  state.selectedHwClass = v223;
  switchView("homework");
};
window.changeHwDate = function (v224) {
  state.selectedHwDate = v224;
  switchView("homework");
};
window.deleteHomework = function (v225, v226) {
  const v227 = state.homework[v225]?.find(v230 => v230.id === v226 || String(v230.id) === String(v226));
  const v228 = v227 && v227.teacher_id === window.currentUser?.id;
  const v229 = window.currentUserProfile?.role === "admin";
  if (!v228 && !v229) {
    toast("You can only delete your own homework");
    return;
  }
  if (!confirm("Delete this homework?")) {
    return;
  }
  (async () => {
    try {
      const {
        error: v231
      } = await v1.from("homework").delete().eq("id", v226);
      if (v231) {
        toast(v231.message || "Failed to delete homework");
        return;
      }
      state.homework[v225] = state.homework[v225].filter(v232 => v232.id !== v226);
      state.lastFetch.homework_all = 0;
      toast("Homework deleted");
      switchView("homework");
    } catch (v233) {
      console.error("deleteHomework error", v233);
      toast("Unexpected error deleting homework");
    }
  })();
};
window.openEditHomework = function (v234, v235) {
  const v236 = state.homework[v234].find(v240 => v240.id === v235 || String(v240.id) === String(v235));
  if (!v236) {
    toast("Homework not found");
    return;
  }
  const v237 = v236.teacher_id === window.currentUser?.id;
  const v238 = window.currentUserProfile?.role === "admin";
  if (!v237 && !v238) {
    toast("You can only edit your own homework");
    return;
  }
  const v239 = ["All", ...CLASS_OPTIONS];
  openModal("\n    <div class=\"modal-handle\"></div>\n    <p class=\"modal-title\">Edit Homework</p>\n    <div class=\"form-group\"><label class=\"form-label\">Class</label>\n      <select class=\"form-input\" id=\"edit-hw-class\">\n        " + v239.map(v241 => "<option value=\"" + v241 + "\" " + (v241 === v236.class ? "selected" : "") + ">" + v241 + "</option>").join("") + "\n      </select>\n    </div>\n    <div class=\"form-group\"><label class=\"form-label\">Subject</label>\n      <input type=\"text\" class=\"form-input\" id=\"edit-hw-sub\" list=\"subject-list\" value=\"" + escapeHtml(v236.subject) + "\" placeholder=\"Select or type subject...\">\n      <datalist id=\"subject-list\">\n        " + state.subjects.map(v242 => "<option value=\"" + v242 + "\">").join("") + "\n      </datalist>\n    </div>\n    <div class=\"form-group\"><label class=\"form-label\">Task / Description</label>\n      <textarea class=\"form-input\" id=\"edit-hw-task\" placeholder=\"Describe the homework task...\">" + escapeHtml(v236.task) + "</textarea>\n    </div>\n    <button class=\"btn btn-primary btn-block\" onclick=\"updateHomework('" + v234 + "','" + v235 + "')\"><i data-lucide=\"check-circle\"></i> Save Changes</button>\n  ");
};
window.updateHomework = function (v243, v244) {
  const v245 = document.getElementById("edit-hw-class").value;
  const v246 = document.getElementById("edit-hw-sub").value.trim();
  const v247 = document.getElementById("edit-hw-task").value.trim();
  if (!v246) {
    toast("Subject is required");
    return;
  }
  if (!v247) {
    toast("Task description is required");
    return;
  }
  (async () => {
    try {
      const {
        error: v248
      } = await v1.from("homework").update({
        subject: v246,
        task: v247,
        class: v245
      }).eq("id", v244);
      if (v248) {
        toast(v248.message || "Failed to update homework");
        return;
      }
      const v249 = state.homework[v243].findIndex(v250 => v250.id === v244 || String(v250.id) === String(v244));
      if (v249 !== -1) {
        state.homework[v243][v249] = {
          ...state.homework[v243][v249],
          subject: v246,
          task: v247,
          class: v245
        };
      }
      toast("Homework updated!");
      closeModal();
      switchView("homework");
    } catch (v251) {
      console.error("updateHomework error", v251);
      toast("Unexpected error updating homework");
    }
  })();
};
async function loadMessagesFromDb(v252 = false) {
  const v253 = "messages_all";
  const v254 = Date.now();
  if (!v252 && state.lastFetch[v253] && v254 - state.lastFetch[v253] < 60000) {
    return;
  }
  try {
    const v255 = getTeacherAssignments();
    const v256 = v255.isAdmin ? [] : v255.assignments.filter(v262 => v262.isHomeroom).map(v263 => v263.className);
    let v257 = v1.from("messages").select("*").order("created_at", {
      ascending: false
    }).limit(50);
    let v258 = ["sender_id.eq." + window.currentUser?.id, "recipient_id.eq." + window.currentUser?.id, "target_type.eq.school"];
    if (v256.length > 0) {
      v258.push("and(target_type.eq.class,target_value.in.(" + v256.map(v265 => "\"" + v265 + "\"").join(",") + "))");
      const v264 = (state.students || []).filter(v266 => v256.includes(v266.class)).map(v267 => v267.id);
      if (v264.length > 0) {
        v258.push("and(target_type.eq.individual,target_value.in.(" + v264.map(v268 => "\"" + v268 + "\"").join(",") + "))");
      }
    }
    v257 = v257.or(v258.join(","));
    const {
      data: v259,
      error: v260
    } = await v257;
    if (v260) {
      throw v260;
    }
    const v261 = (v259 || []).map(v269 => v269.sender_id).filter(Boolean);
    if (v261.length > 0) {
      const v270 = await fetchProfileMap(v261);
      state.messages = (v259 || []).map(v271 => ({
        ...v271,
        sender_name: v270[v271.sender_id] || null
      }));
    } else {
      state.messages = v259 || [];
    }
    state.lastFetch[v253] = v254;
    if (state.currentView === "messages") {
      const v272 = document.getElementById("main-content");
      if (v272) {
        v272.innerHTML = window.views.messages();
        if (window.lucide) {
          lucide.createIcons();
        }
      }
    }
  } catch (v273) {
    console.error("loadMessagesFromDb error", v273);
  }
}
window.sendMessage = async function () {
  const v274 = document.getElementById("msg-target-type").value;
  const v275 = document.getElementById("msg-target-value").value;
  const v276 = document.getElementById("msg-subject").value.trim();
  const v277 = document.getElementById("msg-body").value.trim();
  if (!v276 || !v277) {
    toast("Subject and message body are required");
    return;
  }
  if (v274 !== "school" && !v275) {
    toast("Please select a recipient");
    return;
  }
  try {
    const v278 = {
      sender_id: window.currentUser?.id,
      target_type: v274,
      target_value: v275 || null,
      subject: v276,
      body: v277
    };
    const {
      error: v279
    } = await v1.from("messages").insert(v278);
    if (v279) {
      throw v279;
    }
    state.lastFetch.messages_all = 0;
    toast("Message sent successfully!");
    closeModal();
    loadMessagesFromDb(true);
  } catch (v280) {
    console.error("sendMessage error", v280);
    toast("Failed to send message: " + (v280.message || "Unknown error"));
  }
};
window.switchMessageTab = function (v281) {
  state.activeMessageTab = v281;
  if (state.currentView === "messages") {
    const v282 = document.getElementById("main-content");
    if (v282) {
      v282.innerHTML = window.views.messages();
      if (window.lucide) {
        lucide.createIcons();
      }
    }
  }
};
window.viewMessageDetail = function (v283) {
  const v284 = state.messages.find(v292 => String(v292.id) === String(v283));
  if (!v284) {
    return;
  }
  const v285 = new Date(v284.created_at);
  const v286 = v285.toLocaleTimeString("en-NP", {
    hour: "2-digit",
    minute: "2-digit"
  });
  const v287 = formatDateLabel(v284.created_at ? v284.created_at.split("T")[0] : "") + " " + v286;
  const v288 = v284.sender_id === window.currentUser?.id;
  const v289 = v284.target_type === "class" ? "👥" : v284.target_type === "school" ? "🏫" : "👤";
  let v290 = "Unknown";
  if (v284.target_type === "school") {
    v290 = "Whole School";
  } else if (v284.target_type === "class") {
    v290 = v284.target_value;
  } else {
    v290 = state.students.find(v293 => v293.id === v284.target_value)?.name || "Student";
  }
  const v291 = v284.sender_name || (v288 ? "You" : "System");
  openModal("\n        <div class=\"message-detail-modal\" style=\"padding: 0.25rem;\">\n            <div style=\"display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #e2e8f0; padding-bottom:0.75rem; margin-bottom:1rem; flex-wrap:wrap; gap:0.5rem;\">\n                <h2 style=\"font-size:1.15rem; font-weight:800; margin:0; color:var(--text-main);\">Message Detail</h2>\n                \n                <!-- Dynamic Font Zoom Controls -->\n                <div class=\"zoom-controls\" style=\"display:flex; gap:0.35rem; align-items:center; background:#f1f5f9; padding:0.25rem 0.5rem; border-radius:20px; box-shadow:inset 0 1px 2px rgba(0,0,0,0.05);\">\n                    <span style=\"font-size:0.7rem; font-weight:700; color:var(--text-muted); margin-right:4px;\">Zoom:</span>\n                    <button class=\"btn btn-ghost\" onclick=\"window.zoomMessageBody(-15)\" style=\"width:26px; height:26px; padding:0; border-radius:50%; background:white; font-weight:800; font-size:0.85rem; min-height:0; display:flex; align-items:center; justify-content:center; border:1px solid #e2e8f0; color:var(--text-main);\" title=\"Zoom Out\">-</button>\n                    <span id=\"zoom-level-text\" style=\"font-size:0.75rem; font-weight:700; color:var(--primary); min-width:36px; text-align:center;\">100%</span>\n                    <button class=\"btn btn-ghost\" onclick=\"window.zoomMessageBody(15)\" style=\"width:26px; height:26px; padding:0; border-radius:50%; background:white; font-weight:800; font-size:0.85rem; min-height:0; display:flex; align-items:center; justify-content:center; border:1px solid #e2e8f0; color:var(--text-main);\" title=\"Zoom In\">+</button>\n                    <button class=\"btn btn-ghost\" onclick=\"window.resetMessageZoom()\" style=\"font-size:0.65rem; font-weight:700; padding:0 0.5rem; height:26px; border-radius:13px; background:white; border:1px solid #e2e8f0; color:var(--text-muted); min-height:0; display:flex; align-items:center; justify-content:center; margin-left:4px;\" title=\"Reset font size\">Reset</button>\n                </div>\n            </div>\n            \n            <div style=\"background:#f8fafc; padding:0.75rem; border-radius:12px; margin-bottom:1rem; border:1px solid #e2e8f0;\">\n                <div style=\"display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;\">\n                    <div>\n                        <div style=\"font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;\">From: " + escapeHtml(v291) + "</div>\n                        <div style=\"font-size:0.75rem; font-weight:700; color:var(--primary); text-transform:uppercase; margin-top:0.15rem;\">" + v289 + " To: " + escapeHtml(v290) + "</div>\n                    </div>\n                    <div style=\"font-size:0.7rem; color:var(--text-muted); font-weight:500;\">" + v287 + "</div>\n                </div>\n            </div>\n            \n            <h3 style=\"font-size:1.1rem; font-weight:800; margin-bottom:0.75rem; color:var(--text-main); line-height:1.4;\">" + escapeHtml(v284.subject) + "</h3>\n            \n            <div id=\"msg-detail-body\" style=\"font-size:0.95rem; color:var(--text-main); white-space:pre-wrap; word-break:break-word; line-height:1.6; padding:0.75rem; border:1px solid #e2e8f0; border-radius:8px; background:white; transition: font-size 0.1s ease-out; box-shadow:inset 0 1px 2px rgba(0,0,0,0.02);\">" + escapeHtml(v284.body) + "</div>\n        </div>\n    ");
  window.currentMsgZoom = 100;
  window.zoomMessageBody = function (v294) {
    const v295 = document.getElementById("msg-detail-body");
    const v296 = document.getElementById("zoom-level-text");
    if (!v295) {
      return;
    }
    window.currentMsgZoom = Math.min(220, Math.max(70, window.currentMsgZoom + v294));
    v295.style.fontSize = window.currentMsgZoom / 100 * 0.95 + "rem";
    if (v296) {
      v296.innerText = window.currentMsgZoom + "%";
    }
  };
  window.resetMessageZoom = function () {
    const v297 = document.getElementById("msg-detail-body");
    const v298 = document.getElementById("zoom-level-text");
    if (!v297) {
      return;
    }
    window.currentMsgZoom = 100;
    v297.style.fontSize = "0.95rem";
    if (v298) {
      v298.innerText = "100%";
    }
  };
};
window.openHwStatus = function (v299, v300) {
  const v301 = state.homework[v299].find(v304 => v304.id === v300 || String(v304.id) === String(v300));
  if (!v301) {
    toast("Homework not found");
    return;
  }
  let v302 = v301.class || "All";
  if (v302 === "All" && state.selectedHwClass && state.selectedHwClass !== "All") {
    v302 = state.selectedHwClass;
  }
  let v303 = state.students;
  if (v302 !== "All") {
    v303 = v303.filter(v305 => String(v305.class || "").trim().toLowerCase() === String(v302 || "").trim().toLowerCase());
  }
  if (!state.hwStatus) {
    state.hwStatus = {};
  }
  if (!state.hwStatus[v300]) {
    state.hwStatus[v300] = {};
  }
  (async () => {
    await loadHwStatusForHw(v300);
    const v306 = state.hwStatus[v300] || {};
    let v307 = 0;
    let v308 = 0;
    let v309 = 0;
    Object.values(v306).forEach(v310 => {
      if (v310 === "Done") {
        v307++;
      } else if (v310 === "Not Done") {
        v308++;
      } else if (v310 === "Incomplete") {
        v309++;
      }
    });
    openModal("\n      <div class=\"modal-handle\"></div>\n      <p class=\"modal-title\">Track: " + escapeHtml(v301.subject) + " (" + escapeHtml(v302) + ")</p>\n      \n      <div style=\"display:flex;justify-content:space-between;background:var(--background);padding:0.6rem;border-radius:10px;margin-bottom:1rem;font-size:0.75rem;font-weight:700;\">\n        <span style=\"color:#10b981\">Done: " + v307 + "</span>\n        <span style=\"color:#ef4444\">Missed: " + v308 + "</span>\n        <span style=\"color:#f59e0b\">Partial: " + v309 + "</span>\n        <span style=\"color:#0ea5e9\">Absent: " + Object.values(v306).filter(v311 => v311 === "Absent").length + "</span>\n      </div>\n\n      <div class=\"att-card\" style=\"max-height:50vh;overflow-y:auto;margin-bottom:1rem;\">\n        " + (v303.length === 0 ? "<p style=\"text-align:center;padding:2rem;color:var(--text-muted);\">No students found for class: <strong>" + escapeHtml(v302) + "</strong></p>" : v303.map(v312 => {
      const v313 = state.hwStatus[v300][v312.id] || "";
      return "<div class=\"att-row\" data-sid=\"" + v312.id + "\" style=\"flex-wrap:wrap;gap:0.4rem;\">\n                <div style=\"flex:1;min-width:80px;\"><div class=\"att-name\">" + escapeHtml(v312.name) + "</div><div class=\"att-roll\">Roll: " + escapeHtml(v312.roll) + "</div></div>\n                <div style=\"display:flex;gap:0.3rem;flex-shrink:0;\">\n                  <button class=\"toggle-btn p-btn " + (v313 === "Done" ? "active" : "") + "\" data-status=\"Done\" onclick=\"setHwStatus('" + v300 + "','" + v312.id + "','Done',this)\" style=\"font-size:0.6rem;padding:0.25rem 0.4rem;width:auto;min-width:36px;\">✓</button>\n                  <button class=\"toggle-btn a-btn " + (v313 === "Not Done" ? "active" : "") + "\" data-status=\"Not Done\" onclick=\"setHwStatus('" + v300 + "','" + v312.id + "','Not Done',this)\" style=\"font-size:0.6rem;padding:0.25rem 0.4rem;width:auto;min-width:36px;\">✗</button>\n                  <button class=\"toggle-btn l-btn " + (v313 === "Incomplete" ? "active" : "") + "\" data-status=\"Incomplete\" onclick=\"setHwStatus('" + v300 + "','" + v312.id + "','Incomplete',this)\" style=\"font-size:0.6rem;padding:0.25rem 0.4rem;width:auto;min-width:36px;\">½</button>\n                  <button class=\"toggle-btn abs-btn " + (v313 === "Absent" ? "active" : "") + "\" data-status=\"Absent\" style=\"font-size:0.6rem;padding:0.25rem 0.4rem;width:auto;min-width:36px;background:" + (v313 === "Absent" ? "#0ea5e9" : "#f1f5f9") + ";color:" + (v313 === "Absent" ? "white" : "#64748b") + "\" onclick=\"setHwStatus('" + v300 + "','" + v312.id + "','Absent',this)\">A</button>\n                </div>\n              </div>";
    }).join("")) + "\n      </div>\n      <div style=\"display:flex;gap:0.5rem;\">\n        <button class=\"btn btn-ghost btn-block\" onclick=\"window.exportHwStatus('" + v300 + "','" + escapeHtml(v301.subject) + "','" + escapeHtml(v302) + "')\">\n          <i data-lucide=\"download\" style=\"width:15px;height:15px;\"></i> Export\n        </button>\n        <button class=\"btn btn-primary btn-block\" onclick=\"closeModal()\"><i data-lucide=\"check-circle\"></i> Done</button>\n      </div>\n    ");
  })();
};
window.setHwStatus = function (v314, v315, v316, v317) {
  if (!state.hwStatus) {
    state.hwStatus = {};
  }
  if (!state.hwStatus[v314]) {
    state.hwStatus[v314] = {};
  }
  const v318 = state.hwStatus[v314][v315];
  const v319 = v318 === v316 ? null : v316;
  state.hwStatus[v314][v315] = v319;
  const v320 = v317.closest(".att-row");
  if (v320) {
    v320.querySelectorAll(".toggle-btn").forEach(v330 => {
      const v331 = v330.dataset.status;
      const v332 = v331 === v319;
      v330.classList.toggle("active", v332);
      if (v331 === "Absent") {
        v330.style.background = v332 ? "#0ea5e9" : "#f1f5f9";
        v330.style.color = v332 ? "white" : "#64748b";
      }
    });
  }
  const v321 = state.hwStatus[v314];
  let v322 = 0;
  let v323 = 0;
  let v324 = 0;
  let v325 = 0;
  Object.values(v321).forEach(v333 => {
    if (v333 === "Done") {
      v322++;
    } else if (v333 === "Not Done") {
      v323++;
    } else if (v333 === "Incomplete") {
      v324++;
    } else if (v333 === "Absent") {
      v325++;
    }
  });
  const v326 = document.getElementById("track-done-count");
  const v327 = document.getElementById("track-missed-count");
  const v328 = document.getElementById("track-partial-count");
  const v329 = document.getElementById("track-absent-count");
  if (v326) {
    v326.innerText = v322;
  }
  if (v327) {
    v327.innerText = v323;
  }
  if (v328) {
    v328.innerText = v324;
  }
  if (v329) {
    v329.innerText = v325;
  }
  (async () => {
    try {
      if (!v319) {
        await v1.from("hw_status").delete().match({
          hw_id: v314,
          student_id: v315
        });
      } else {
        await v1.from("hw_status").upsert({
          hw_id: v314,
          student_id: v315,
          status: v319
        }, {
          onConflict: "hw_id, student_id"
        });
      }
      const v334 = (state.students || []).find(v336 => String(v336.id) === String(v315));
      const v335 = v334 ? v334.name : "Student (" + v315 + ")";
      logActivity("Track Homework", v335 + ": " + (v319 || "None"));
    } catch (v337) {
      console.error("setHwStatus error", v337);
      toast("Failed to save status");
    }
  })();
};
window.exportHwStatus = function (v338, v339, v340) {
  const v341 = (state.hwStatus || {})[v338] || {};
  let v342 = state.students;
  if (v340 && v340 !== "All") {
    v342 = v342.filter(v344 => String(v344.class || "").trim().toLowerCase() === v340.trim().toLowerCase());
  }
  const v343 = v342.map(v345 => ({
    Name: v345.name,
    Roll: v345.roll,
    Class: v345.class,
    Status: v341[v345.id] || "Not Recorded"
  }));
  if (!v343.length) {
    toast("No students to export");
    return;
  }
  try {
    const v346 = XLSX.utils.json_to_sheet(v343);
    const v347 = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(v347, v346, "HW Status");
    const v348 = "HW_" + v339.replace(/\s+/g, "_") + "_" + v340.replace(/\s+/g, "_") + "_" + getToday() + ".xlsx";
    const v349 = XLSX.write(v347, {
      bookType: "xlsx",
      type: "binary"
    });
    const v350 = new ArrayBuffer(v349.length);
    const v351 = new Uint8Array(v350);
    for (let v355 = 0; v355 < v349.length; v355++) {
      v351[v355] = v349.charCodeAt(v355) & 255;
    }
    const v352 = new Blob([v350], {
      type: "application/octet-stream"
    });
    const v353 = URL.createObjectURL(v352);
    const v354 = document.createElement("a");
    v354.href = v353;
    v354.download = v348;
    document.body.appendChild(v354);
    v354.click();
    setTimeout(() => {
      document.body.removeChild(v354);
      URL.revokeObjectURL(v353);
    }, 200);
    toast("Saved as \"" + v348 + "\" — check your Downloads folder");
  } catch (v356) {
    console.error("exportHwStatus error", v356);
    toast("Export failed: " + v356.message);
  }
};
window.updateMarks = function (v357, v358, v359) {
  const v360 = state.selectedTerm;
  if (!state.marks[v360]) {
    state.marks[v360] = {};
  }
  if (!state.marks[v360][v357]) {
    state.marks[v360][v357] = {};
  }
  const v361 = state.selectedTerm && state.selectedTerm.toLowerCase().includes("mid");
  const v362 = v361 ? 50 : 100;
  const v363 = Math.max(0, Math.min(v362, parseInt(v359) || 0));
  if (v359 === "") {
    delete state.marks[v360][v357][v358];
    v1.from("marks").delete().match({
      term: v360,
      student_id: v357,
      subject: v358
    }).then(({
      error: v364
    }) => {
      if (v364) {
        console.error("delete marks error", v364);
      }
    });
  } else {
    state.marks[v360][v357][v358] = v363;
    v1.from("marks").upsert({
      term: v360,
      student_id: v357,
      subject: v358,
      theory_marks: v363,
      value: v363,
      teacher_id: window.currentUser?.id || null
    }).then(({
      error: v365
    }) => {
      if (v365) {
        console.error("upsert marks error", v365);
      } else {
        v1.from("notifications").insert({
          title: "Mark Updated: " + v358,
          body: "A new mark has been entered for " + v360 + ".",
          type: "mark",
          target_type: "individual",
          target_value: v357
        }).then(() => {}).catch(() => {});
      }
    });
  }
};
window.changeTerm = function (v366) {
  state.selectedTerm = v366;
  loadMarksFromDb(v366).then(() => {
    if (state.currentView === "performance") {
      document.getElementById("main-content").innerHTML = window.views.performance();
      if (window.lucide) {
        lucide.createIcons();
      }
    }
  });
};
window.changeMarksClass = function (v367) {
  state.selectedMarksClass = v367;
  switchView("performance");
};
const getClassLevel = v368 => {
  const v369 = v368 ? v368.match(/Grade\s+(\d+)/i) : null;
  if (v369) {
    const v371 = parseInt(v369[1]);
    if (v371 >= 1 && v371 <= 3) {
      return "Primary";
    }
    if (v371 >= 4 && v371 <= 8) {
      return "Basic";
    }
    if (v371 >= 9 && v371 <= 12) {
      return "Secondary";
    }
  }
  const v370 = ["PG", "Nursery", "LKG", "UKG"];
  if (v368 && v370.includes(v368)) {
    return "Primary";
  }
  return "Basic";
};
window.getClassLevel = getClassLevel;
const getMidTermForTerm = v372 => {
  if (v372 === "First Term") {
    return "First Mid Term";
  }
  if (v372 === "Second Term") {
    return "Second Mid Term";
  }
  if (v372 === "Third Term") {
    return "Third Mid Term";
  }
  if (v372 === "Final Term") {
    return "Third Mid Term";
  }
  return v372.replace(" Term", " Mid Term");
};
const isLanguageSubject = v373 => {
  const v374 = (v373 || "").toLowerCase().trim();
  return v374.includes("english") || v374.includes("nepali");
};
const calculateTerminalWeightage = (v375, v376) => {
  if (v376 === "Basic") {
    return v375 / 50 * 10;
  }
  if (v376 === "Primary") {
    return v375 / 50 * 5;
  }
  if (v376 === "Secondary") {
    return v375 / 75 * 6;
  }
  return 0;
};
const getCdcLimits = (v377, v378) => {
  if (v377 === "Primary") {
    if (isLanguageSubject(v378)) {
      return {
        type: "primary-language",
        participation: 2,
        listening: 4,
        speaking: 4,
        reading: 4,
        writing: 4,
        integratedTask: 2,
        terminal: 5,
        total: 25
      };
    }
    return {
      type: "primary-nonlanguage",
      participation: 2,
      practicalWork: 18,
      terminal: 5,
      total: 25
    };
  }
  if (v377 === "Basic") {
    if (isLanguageSubject(v378)) {
      return {
        type: "basic-language",
        participation: 4,
        listening: 8,
        speaking: 8,
        reading: 8,
        writing: 8,
        integratedTask: 4,
        terminal: 10,
        total: 50
      };
    }
    return {
      type: "basic-nonlanguage",
      participation: 4,
      practicalWork: 36,
      terminal: 10,
      total: 50
    };
  }
  return {
    type: "secondary",
    attendance: 3,
    practicalWork: 16,
    terminal: 6,
    total: 25
  };
};
window.changePracticalClass = function (v379) {
  state.selectedPracticalClass = v379;
  switchView("practicalmarks");
};
window.changePracticalTerm = function (v380) {
  state.selectedPracticalTerm = v380;
  switchView("practicalmarks");
};
async function loadPracticalMarksFromDb(v381) {
  try {
    const {
      data: v382,
      error: v383
    } = await v1.from("student_practical_marks").select("student_id, subject_id, criteria_breakdown, total_practical_score").eq("term_id", v381);
    if (v383) {
      throw v383;
    }
    if (!state.practicalMarks) {
      state.practicalMarks = {};
    }
    state.practicalMarks[v381] = {};
    (v382 || []).forEach(v384 => {
      const v385 = (state.subjectsDb || []).find(v387 => v387.id === v384.subject_id);
      const v386 = v385 ? v385.name : v384.subject_id;
      const normSub = window.normalizeSubjectName ? window.normalizeSubjectName(v386) : v386;
      if (!state.practicalMarks[v381][v384.student_id]) {
        state.practicalMarks[v381][v384.student_id] = {};
      }
      state.practicalMarks[v381][v384.student_id][normSub] = {
        breakdown: v384.criteria_breakdown || {},
        total_practical_score: v384.total_practical_score ? parseFloat(v384.total_practical_score) : 0
      };
    });
  } catch (v388) {
    console.error("loadPracticalMarksFromDb error", v388);
  }
}
window.openEvaluateModal = async function (v389, v390) {
  const v391 = state.students.find(v406 => v406.id === v389);
  if (!v391) {
    return;
  }
  const v392 = state.selectedPracticalTerm || "First Term";
  const v393 = getClassLevel(v391.class);
  const v394 = getCdcLimits(v393, v390);
  if (!state.subjectsDb) {
    await loadSubjectsFromDb();
  }
  const v395 = (state.subjectsDb || []).find(v407 => v407.name === v390);
  if (!v395) {
    toast("Subject configuration not found");
    return;
  }
  openModal("\n    <div class=\"modal-handle\"></div>\n    <p class=\"modal-title\">Loading Evaluation Details...</p>\n    <div style=\"padding:2rem;text-align:center\"><div class=\"spinner\" style=\"margin:0 auto\"></div></div>\n  ");
  const v396 = getMidTermForTerm(v392);
  let v397 = 0;
  try {
    const {
      data: v408
    } = await v1.from("marks").select("value").eq("student_id", v389).eq("subject", v390).eq("term", v396).maybeSingle();
    if (v408 && v408.value !== undefined && v408.value !== null) {
      v397 = parseFloat(v408.value) || 0;
    }
  } catch (v409) {
    console.warn("Failed to fetch mid-term theory score", v409);
  }
  const v398 = state.practicalMarks && state.practicalMarks[v392] && state.practicalMarks[v392][v389] || {};
  const v399 = v398[v390] || {};
  const v400 = v399.breakdown || {};
  const v401 = (v410, v411 = 0) => v400[v410] !== undefined ? v400[v410] : v411;
  const v402 = (v412, v413, v414, v415, v416, v417 = "") => "<div class=\"form-group\" style=\"margin-bottom:0.65rem\">\n      <label class=\"form-label\" style=\"font-size:0.73rem;font-weight:700\">" + v414 + "</label>\n      <input type=\"number\" class=\"form-input\" id=\"" + v412 + "\" min=\"0\" max=\"" + v413 + "\" value=\"" + v416 + "\" oninput=\"window.updateEvalTotal('" + v393 + "','" + v394.type + "')\" style=\"padding:0.45rem 0.75rem\" placeholder=\"" + (v417 || "0 - " + v413) + "\">\n    </div>";
  let v403 = "";
  let v404 = 0;
  let v405 = "";
  if (v394.type === "basic-language" || v394.type === "primary-language") {
    const v418 = v394.type === "primary-language";
    const v419 = v418 ? 2 : 4;
    const v420 = v418 ? 4 : 8;
    const v421 = v418 ? 2 : 4;
    const v422 = v401("participation");
    const v423 = v401("listening");
    const v424 = v401("speaking");
    const v425 = v401("reading");
    const v426 = v401("writing");
    const v427 = v401("integrated_task");
    const v428 = calculateTerminalWeightage(v397, v393);
    v404 = v422 + v423 + v424 + v425 + v426 + v427 + v428;
    v403 = "\n      " + v402("eval-participation", v419, "Participation — Attendance & Active Learning (Max " + v419 + ")", "", v422) + "\n      <div style=\"background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:0.75rem;margin-bottom:0.65rem\">\n        <p style=\"font-size:0.72rem;font-weight:800;color:#16a34a;margin:0 0 0.5rem\">Language Skills Assessment — " + (v418 ? 18 : 36) + " Marks Total</p>\n        " + v402("eval-listening", v420, "Listening — Dictation, audio comprehension, listen & act tasks (Max " + v420 + ")", "", v423) + "\n        " + v402("eval-speaking", v420, "Speaking — Roleplay, project presentations, speaking fluency (Max " + v420 + ")", "", v424) + "\n        " + v402("eval-reading", v420, "Reading — Reading aloud, vocabulary checks, comprehension (Max " + v420 + ")", "", v425) + "\n        " + v402("eval-writing", v420, "Writing — Guided writing, spelling, sentence construction (Max " + v420 + ")", "", v426) + "\n        " + v402("eval-integrated-task", v421, "Integrated Task — Combined language skills test (Max " + v421 + ")", "", v427) + "\n      </div>\n      <div class=\"form-group\" style=\"margin-bottom:0.65rem\">\n        <label class=\"form-label\" style=\"font-size:0.73rem;font-weight:700\">Mid-Term Theory Score (0-50) <span style=\"font-weight:400;color:var(--text-muted)\">→ auto-converts to " + v394.terminal + " terminal marks</span></label>\n        <input type=\"number\" class=\"form-input\" id=\"eval-mid-term-theory\" min=\"0\" max=\"50\" value=\"" + v397 + "\" oninput=\"window.updateEvalTotal('" + v393 + "','" + v394.type + "')\" style=\"padding:0.45rem 0.75rem\" placeholder=\"Enter mid-term marks (0-50)\">\n      </div>";
    v405 = "<div style=\"display:flex;justify-content:space-between;font-size:0.75rem;color:var(--text-muted);margin-bottom:0.35rem;font-weight:600\">\n        <span>Terminal Exam Weightage (auto):</span><span><span id=\"eval-terminal-weightage-val\" style=\"color:var(--text-main);font-weight:700\">" + v428.toFixed(2) + "</span> / " + v394.terminal + "</span></div>";
  } else if (v394.type === "basic-nonlanguage" || v394.type === "primary-nonlanguage") {
    const v429 = v394.type === "primary-nonlanguage";
    const v430 = v429 ? 2 : 4;
    const v431 = v429 ? 18 : 36;
    const v432 = v401("participation");
    const v433 = v401("practical_work");
    const v434 = calculateTerminalWeightage(v397, v393);
    v404 = v432 + v433 + v434;
    v403 = "\n      " + v402("eval-participation", v430, "Participation — Attendance & Active Learning (Max " + v430 + ")", "", v432) + "\n      <div class=\"form-group\" style=\"margin-bottom:0.65rem\">\n        <label class=\"form-label\" style=\"font-size:0.73rem;font-weight:700\">Practical Work — Models, Experiments, Field, Portfolio & Presentation (Max " + v431 + ")</label>\n        <input type=\"number\" class=\"form-input\" id=\"eval-practical-work\" min=\"0\" max=\"" + v431 + "\" value=\"" + v433 + "\" oninput=\"window.updateEvalTotal('" + v393 + "','" + v394.type + "')\" style=\"padding:0.45rem 0.75rem\" placeholder=\"0 - " + v431 + " (continuous assessment)\">\n      </div>\n      <div class=\"form-group\" style=\"margin-bottom:0.65rem\">\n        <label class=\"form-label\" style=\"font-size:0.73rem;font-weight:700\">Mid-Term Theory Score (0-50) <span style=\"font-weight:400;color:var(--text-muted)\">→ auto-converts to " + v394.terminal + " terminal marks</span></label>\n        <input type=\"number\" class=\"form-input\" id=\"eval-mid-term-theory\" min=\"0\" max=\"50\" value=\"" + v397 + "\" oninput=\"window.updateEvalTotal('" + v393 + "','" + v394.type + "')\" style=\"padding:0.45rem 0.75rem\" placeholder=\"Enter mid-term marks (0-50)\">\n      </div>";
    v405 = "<div style=\"display:flex;justify-content:space-between;font-size:0.75rem;color:var(--text-muted);margin-bottom:0.35rem;font-weight:600\">\n        <span>Terminal Exam Weightage (auto):</span><span><span id=\"eval-terminal-weightage-val\" style=\"color:var(--text-main);font-weight:700\">" + v434.toFixed(2) + "</span> / " + v394.terminal + "</span></div>";
  } else {
    const v435 = v401("attendance");
    const v436 = v401("practical_work");
    const v437 = calculateTerminalWeightage(v397, v393);
    v404 = v435 + v436 + v437;
    v403 = "\n      " + v402("eval-attendance", 3, "Attendance & Classroom Behavior (Max 3)", "", v435) + "\n      <div class=\"form-group\" style=\"margin-bottom:0.65rem\">\n        <label class=\"form-label\" style=\"font-size:0.73rem;font-weight:700\">Practical Work — Formal experiments, field reports, viva voce (Max 16)</label>\n        <input type=\"number\" class=\"form-input\" id=\"eval-practical-work\" min=\"0\" max=\"16\" value=\"" + v436 + "\" oninput=\"window.updateEvalTotal('" + v393 + "','" + v394.type + "')\" style=\"padding:0.45rem 0.75rem\" placeholder=\"0 - 16\">\n      </div>\n      <div class=\"form-group\" style=\"margin-bottom:0.65rem\">\n        <label class=\"form-label\" style=\"font-size:0.73rem;font-weight:700\">Mid-Term Theory Score (0-75) <span style=\"font-weight:400;color:var(--text-muted)\">→ auto-converts to " + v394.terminal + " terminal marks</span></label>\n        <input type=\"number\" class=\"form-input\" id=\"eval-mid-term-theory\" min=\"0\" max=\"75\" value=\"" + v397 + "\" oninput=\"window.updateEvalTotal('" + v393 + "','" + v394.type + "')\" style=\"padding:0.45rem 0.75rem\" placeholder=\"Enter mid-term marks (0-75)\">\n      </div>";
    v405 = "<div style=\"display:flex;justify-content:space-between;font-size:0.75rem;color:var(--text-muted);margin-bottom:0.35rem;font-weight:600\">\n        <span>Terminal Exam Weightage (auto):</span><span><span id=\"eval-terminal-weightage-val\" style=\"color:var(--text-main);font-weight:700\">" + v437.toFixed(2) + "</span> / " + v394.terminal + "</span></div>";
  }
  openModal("\n    <div class=\"modal-handle\"></div>\n    <p class=\"modal-title\" style=\"margin-bottom:0.25rem\">Evaluate Practical Marks</p>\n    <p style=\"font-size:0.78rem;color:var(--text-muted);margin-bottom:0.5rem;line-height:1.4\">\n      <strong style=\"color:var(--text-main)\">" + escapeHtml(v391.name) + "</strong> (Roll: " + escapeHtml(v391.roll) + ") &nbsp;&bull;&nbsp;\n      <strong style=\"color:var(--text-main)\">" + escapeHtml(v390) + "</strong> &nbsp;&bull;&nbsp; " + escapeHtml(v391.class) + "\n    </p>\n    <div style=\"background:var(--primary-light,#eef2ff);border-radius:10px;padding:0.45rem 0.85rem;margin-bottom:0.85rem;font-size:0.72rem;color:var(--primary);font-weight:700;display:flex;justify-content:space-between\">\n      <span>CDC System: " + (v393 === "Primary" ? "Grade 1-3" : v393 === "Basic" ? "Grade 4-8" : "Grade 9-12") + " " + (v394.type === "basic-language" || v394.type === "primary-language" ? "(Language)" : v394.type === "basic-nonlanguage" || v394.type === "primary-nonlanguage" ? "(Non-Language)" : "") + "</span>\n      <span>Max: " + v394.total + " marks</span>\n    </div>\n\n    " + v403 + "\n\n    <div style=\"background:#f8fafc;padding:0.75rem 1rem;border-radius:12px;border:1px solid #e2e8f0;margin-bottom:1.25rem\">\n      " + v405 + "\n      <div style=\"display:flex;justify-content:space-between;font-size:0.88rem;font-weight:800;color:var(--primary)\">\n        <span>Total Practical Score:</span>\n        <span><span id=\"eval-total-val\" style=\"font-size:1rem\">" + v404.toFixed(2) + "</span> / " + v394.total + "</span>\n      </div>\n    </div>\n\n    <button class=\"btn btn-primary btn-block\" onclick=\"window.saveEvaluation('" + v389 + "','" + escapeHtml(v390) + "','" + v395.id + "','" + v393 + "','" + v394.type + "')\">\n      <i data-lucide=\"check-circle\" style=\"width:16px;height:16px;margin-right:0.25rem\"></i> Save Evaluation\n    </button>\n  ");
  if (window.lucide) {
    lucide.createIcons();
  }
};
window.updateEvalTotal = function (v438, v439) {
  let v440 = 0;
  const v441 = (v444, v445) => Math.max(0, Math.min(v445, parseFloat(v444) || 0));
  const v442 = v446 => {
    const v447 = document.getElementById(v446);
    if (v447) {
      return parseFloat(v447.value) || 0;
    } else {
      return 0;
    }
  };
  if (v439 === "basic-language" || v439 === "primary-language") {
    const v448 = v439 === "primary-language";
    const v449 = v448 ? 2 : 4;
    const v450 = v448 ? 4 : 8;
    const v451 = v448 ? 2 : 4;
    const v452 = v441(v442("eval-participation"), v449);
    const v453 = v441(v442("eval-listening"), v450);
    const v454 = v441(v442("eval-speaking"), v450);
    const v455 = v441(v442("eval-reading"), v450);
    const v456 = v441(v442("eval-writing"), v450);
    const v457 = v441(v442("eval-integrated-task"), v451);
    const v458 = v441(v442("eval-mid-term-theory"), 50);
    const v459 = calculateTerminalWeightage(v458, v438);
    v440 = v452 + v453 + v454 + v455 + v456 + v457 + v459;
    const v460 = document.getElementById("eval-terminal-weightage-val");
    if (v460) {
      v460.innerText = v459.toFixed(2);
    }
  } else if (v439 === "basic-nonlanguage" || v439 === "primary-nonlanguage") {
    const v461 = v439 === "primary-nonlanguage";
    const v462 = v461 ? 2 : 4;
    const v463 = v461 ? 18 : 36;
    const v464 = v441(v442("eval-participation"), v462);
    const v465 = v441(v442("eval-practical-work"), v463);
    const v466 = v441(v442("eval-mid-term-theory"), 50);
    const v467 = calculateTerminalWeightage(v466, v438);
    v440 = v464 + v465 + v467;
    const v468 = document.getElementById("eval-terminal-weightage-val");
    if (v468) {
      v468.innerText = v467.toFixed(2);
    }
  } else {
    const v469 = v441(v442("eval-attendance"), 3);
    const v470 = v441(v442("eval-practical-work"), 16);
    const v471 = v441(v442("eval-mid-term-theory"), 75);
    const v472 = calculateTerminalWeightage(v471, v438);
    v440 = v469 + v470 + v472;
    const v473 = document.getElementById("eval-terminal-weightage-val");
    if (v473) {
      v473.innerText = v472.toFixed(2);
    }
  }
  const v443 = document.getElementById("eval-total-val");
  if (v443) {
    v443.innerText = Math.round(v440).toString();
  }
};
window.saveEvaluation = async function (v474, v475, v476, v477, v478) {
  const v479 = (v486, v487) => Math.max(0, Math.min(v487, parseFloat(v486) || 0));
  const v480 = v488 => {
    const v489 = document.getElementById(v488);
    if (v489) {
      return parseFloat(v489.value) || 0;
    } else {
      return 0;
    }
  };
  let v481 = 0;
  let v482 = {};
  if (v478 === "basic-language" || v478 === "primary-language") {
    const v490 = v478 === "primary-language";
    const v491 = v490 ? 2 : 4;
    const v492 = v490 ? 4 : 8;
    const v493 = v490 ? 2 : 4;
    const v494 = v479(v480("eval-participation"), v491);
    const v495 = v479(v480("eval-listening"), v492);
    const v496 = v479(v480("eval-speaking"), v492);
    const v497 = v479(v480("eval-reading"), v492);
    const v498 = v479(v480("eval-writing"), v492);
    const v499 = v479(v480("eval-integrated-task"), v493);
    const v500 = v479(v480("eval-mid-term-theory"), 50);
    const v501 = calculateTerminalWeightage(v500, v477);
    v481 = v494 + v495 + v496 + v497 + v498 + v499 + v501;
    v482 = {
      subject_type: v478,
      participation: v494,
      listening: v495,
      speaking: v496,
      reading: v497,
      writing: v498,
      integrated_task: v499,
      terminal_weightage: v501,
      mid_term_theory: v500
    };
  } else if (v478 === "basic-nonlanguage" || v478 === "primary-nonlanguage") {
    const v502 = v478 === "primary-nonlanguage";
    const v503 = v502 ? 2 : 4;
    const v504 = v502 ? 18 : 36;
    const v505 = v479(v480("eval-participation"), v503);
    const v506 = v479(v480("eval-practical-work"), v504);
    const v507 = v479(v480("eval-mid-term-theory"), 50);
    const v508 = calculateTerminalWeightage(v507, v477);
    v481 = v505 + v506 + v508;
    v482 = {
      subject_type: v478,
      participation: v505,
      practical_work: v506,
      terminal_weightage: v508,
      mid_term_theory: v507
    };
  } else {
    const v509 = v479(v480("eval-attendance"), 3);
    const v510 = v479(v480("eval-practical-work"), 16);
    const v511 = v479(v480("eval-mid-term-theory"), 75);
    const v512 = calculateTerminalWeightage(v511, v477);
    v481 = v509 + v510 + v512;
    v482 = {
      subject_type: "secondary",
      attendance: v509,
      practical_work: v510,
      terminal_weightage: v512,
      mid_term_theory: v511
    };
  }
  const v483 = state.selectedPracticalTerm || "First Term";
  const v484 = Math.round(v481);
  const v485 = {
    student_id: v474,
    subject_id: v476,
    term_id: v483,
    evaluated_by: window.currentUser?.id || null,
    criteria_breakdown: v482,
    total_practical_score: v484
  };
  try {
    const {
      data: v513
    } = await v1.from("student_practical_marks").select("id").eq("student_id", v474).eq("subject_id", v476).eq("term_id", v483).maybeSingle();
    let v514 = null;
    if (v513) {
      const {
        error: v515
      } = await v1.from("student_practical_marks").update(v485).eq("id", v513.id);
      v514 = v515;
    } else {
      const {
        error: v516
      } = await v1.from("student_practical_marks").insert(v485);
      v514 = v516;
    }
    if (v514) {
      throw v514;
    }
    toast("Evaluation saved successfully!");
    closeModal();
    if (!state.practicalMarks) {
      state.practicalMarks = {};
    }
    if (!state.practicalMarks[v483]) {
      state.practicalMarks[v483] = {};
    }
    if (!state.practicalMarks[v483][v474]) {
      state.practicalMarks[v483][v474] = {};
    }
    state.practicalMarks[v483][v474][v475] = {
      breakdown: v482,
      total_practical_score: v484
    };
    if (state.currentView === "practicalmarks") {
      const v517 = document.getElementById("main-content");
      if (v517) {
        v517.innerHTML = window.views.practicalmarks();
        if (window.lucide) {
          lucide.createIcons();
        }
      }
    }
  } catch (v518) {
    console.error("saveEvaluation error", v518);
    toast("Error saving evaluation: " + (v518.message || "Unknown error"));
  }
};
window.exportEduScore = async function () {
  const v519 = state.selectedPracticalTerm || "First Term";
  const v520 = state.selectedPracticalClass;
  const v521 = (state.students || []).filter(v522 => v522.class === v520);
  if (!v521.length) {
    toast("No students in this class to export");
    return;
  }
  toast("Generating EduScore export...");
  try {
    const v523 = v521.map(v535 => v535.id);
    const {
      data: v524,
      error: v525
    } = await v1.from("student_practical_marks").select("student_id, subject_id, total_practical_score").eq("term_id", v519).in("student_id", v523);
    if (v525) {
      throw v525;
    }
    if (!state.subjectsDb || !state.subjectsDb.length) {
      await loadSubjectsFromDb();
    }
    const v526 = getTeacherAssignments();
    const v527 = v526.isAdmin ? null : v526.assignments.find(v536 => v536.className === v520);
    const v528 = v526.isAdmin ? state.subjects || [] : v527?.subjects || [];
    const v529 = window.getClassLevel ? window.getClassLevel(v520 || "") : "Basic";
    const v530 = v528.filter(v537 => {
      const v538 = v537.toLowerCase().trim();
      
      if (v529 === "Basic" || v529 === "Primary") {
        if (v538.includes("optional math") || v538.includes("opt math") || v538 === "opt. math") {
          return false;
        }
        return true;
      } else {
        if (v538.includes("local subject") || v538.includes("local curriculum") || v538 === "lc") {
          return false;
        }
        if (v538.includes("health physical") || v538.includes("health & physical") || v538 === "hpe") {
          return false;
        }
        return true;
      }
    });
    const v531 = [];
    v521.sort((v541, v542) => (parseInt(v541.roll) || 0) - (parseInt(v542.roll) || 0));
    v521.forEach(v543 => {
      const v544 = {
        "Roll No": v543.roll || "",
        Name: v543.name,
        Class: v543.class
      };
      v530.forEach(v545 => {
        const v546 = (state.subjectsDb || []).find(v549 => v549.id === v545 || v549.name === v545);
        const v547 = v546 ? v546.id : v545;
        const v548 = (v524 || []).find(v550 => v550.student_id === v543.id && v550.subject_id === v547);
        v544[v545] = v548 && v548.total_practical_score !== null ? parseFloat(v548.total_practical_score) : "";
      });
      v531.push(v544);
    });
    if (!v531.length) {
      toast("No assessment records found to export");
      return;
    }
    const v532 = XLSX.utils.json_to_sheet(v531);
    const v533 = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(v533, v532, "marks");
    const v534 = "EduScore_Practical_Marks_" + v520.replace(/\s+/g, "_") + "_" + v519.replace(/\s+/g, "_") + "_" + getToday() + ".xlsx";
    XLSX.writeFile(v533, v534);
    toast("EduScore export saved as \"" + v534 + "\"");
  } catch (v551) {
    console.error("exportEduScore error", v551);
    toast("Export failed: " + (v551.message || "Unknown error"));
  }
};

window.exportEduScoreTheory = async function () {
  const term = state.selectedTerm || "First Term";
  const cls = state.selectedMarksClass;
  const studentsInClass = (state.students || []).filter(s => s.class === cls);
  
  if (!studentsInClass.length) {
    toast("No students in this class to export");
    return;
  }
  
  toast("Generating EduScore Theory export...");
  try {
    const assignments = getTeacherAssignments();
    const assignment = assignments.isAdmin ? null : assignments.assignments.find(a => a.className === cls);
    const assignedSubjects = assignments.isAdmin ? state.subjects || [] : assignment?.subjects || [];
    const classLevel = window.getClassLevel ? window.getClassLevel(cls || "") : "Basic";
    
    const filteredSubjects = assignedSubjects.filter(sub => {
      const lowerSub = sub.toLowerCase().trim();
      
      if (classLevel === "Basic" || classLevel === "Primary") {
        if (classLevel === "Primary" && (lowerSub.includes("optional math") || lowerSub.includes("opt math") || lowerSub === "opt. math")) return false;
        return true;
      } else {
        if (lowerSub.includes("local subject") || lowerSub.includes("local curriculum") || lowerSub === "lc") return false;
        if (lowerSub.includes("health physical") || lowerSub.includes("health & physical") || lowerSub === "hpe") return false;
        return true;
      }
    });

    const rows = [];
    studentsInClass.sort((a, b) => (parseInt(a.roll) || 0) - (parseInt(b.roll) || 0));
    studentsInClass.forEach(st => {
      const row = {
        "Roll No": st.roll || "",
        "Name": st.name,
        "Class": st.class
      };
      
      const termMarks = state.marks[term] ? state.marks[term][st.id] || {} : {};
      
      filteredSubjects.forEach(sub => {
        row[sub] = termMarks[sub] !== undefined ? termMarks[sub] : "";
      });
      rows.push(row);
    });
    
    if (!rows.length) {
      toast("No assessment records found to export");
      return;
    }
    
    const sheet = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "marks");
    
    const dateStr = getToday();
    const filename = `EduScore_Theory_Marks_${cls.replace(/\s+/g, "_")}_${term.replace(/\s+/g, "_")}_${dateStr}.xlsx`;
    
    XLSX.writeFile(wb, filename);
    toast(`EduScore export saved as "${filename}"`);
  } catch (err) {
    console.error("exportEduScoreTheory error", err);
    toast("Export failed: " + (err.message || "Unknown error"));
  }
};

window.exportData = function () {
  const v552 = getToday();
  const v553 = XLSX.utils.book_new();
  const v554 = state.students.map(v557 => {
    const v558 = {
      Roll: v557.roll,
      Name: v557.name,
      Class: v557.class
    };
    Object.keys(state.attendance).sort().slice(-30).forEach(v559 => {
      v558[v559] = (state.attendance[v559] || {})[v557.id] || "-";
    });
    return v558;
  });
  XLSX.utils.book_append_sheet(v553, XLSX.utils.json_to_sheet(v554), "Attendance");
  const v555 = [];
  Object.keys(state.homework).forEach(v560 => {
    (state.homework[v560] || []).forEach(v561 => v555.push({
      Date: v560,
      Class: v561.class || "All",
      Subject: v561.subject,
      Task: v561.task,
      Due: v561.due
    }));
  });
  XLSX.utils.book_append_sheet(v553, XLSX.utils.json_to_sheet(v555.length ? v555 : [{
    Note: "No homework records"
  }]), "Homework");
  const v556 = [];
  TERMS.forEach(v562 => {
    state.students.forEach(v563 => {
      const v564 = state.marks[v562] && state.marks[v562][v563.id] ? state.marks[v562][v563.id] : {};
      if (Object.keys(v564).length > 0) {
        const v565 = {
          Term: v562,
          Roll: v563.roll,
          Name: v563.name,
          Class: v563.class
        };
        Object.keys(v564).forEach(v566 => {
          v565[v566] = v564[v566];
        });
        v556.push(v565);
      }
    });
  });
  XLSX.utils.book_append_sheet(v553, XLSX.utils.json_to_sheet(v556.length ? v556 : [{
    Note: "No marks recorded"
  }]), "Marks");
  XLSX.writeFile(v553, "HolyGarden_Report_" + v552 + ".xlsx");
  toast("Excel exported!");
};
const getVal = (v567, v568) => {
  const v569 = Object.keys(v567).find(v570 => v570.trim().toLowerCase() === v568.toLowerCase());
  if (v569) {
    return v567[v569];
  } else {
    return undefined;
  }
};
window.importStudentsExcel = function (v571) {
  const v572 = v571.target.files[0];
  if (!v572) {
    return;
  }
  const v573 = new FileReader();
  v573.onload = async function (v574) {
    try {
      const v575 = new Uint8Array(v574.target.result);
      const v576 = XLSX.read(v575, {
        type: "array"
      });
      const v577 = XLSX.utils.sheet_to_json(v576.Sheets[v576.SheetNames[0]]);
      let v578 = 0;
      let v579 = 0;
      const v580 = [];
      v577.forEach(v581 => {
        const v582 = getVal(v581, "name");
        const v583 = getVal(v581, "roll") || getVal(v581, "roll no") || getVal(v581, "rollno");
        const v584 = normalizeClass(getVal(v581, "class") || "Grade 1");
        if (!v582 || !v583) {
          return;
        }
        const v585 = state.students.find(v586 => v586.roll == v583 && v586.class == v584);
        if (v585) {
          v585.name = String(v582).trim();
          if (getVal(v581, "dob")) {
            v585.dob = getVal(v581, "dob");
          }
          if (getVal(v581, "parents")) {
            v585.parents = getVal(v581, "parents");
          }
          if (getVal(v581, "mobile")) {
            v585.mobile = getVal(v581, "mobile");
          }
          v580.push({
            id: v585.id,
            name: v585.name,
            roll: v585.roll,
            dob: v585.dob,
            parents: v585.parents,
            mobile: v585.mobile,
            class: v585.class
          });
          v579++;
        } else {
          const v587 = generateId();
          const v588 = {
            id: v587,
            name: String(v582).trim(),
            roll: String(v583).trim(),
            dob: getVal(v581, "dob") || "",
            parents: getVal(v581, "parents") || "",
            mobile: getVal(v581, "mobile") || "",
            class: v584,
            photo: null
          };
          state.students.push(v588);
          v580.push({
            id: v587,
            name: v588.name,
            roll: v588.roll,
            dob: v588.dob,
            parents: v588.parents,
            mobile: v588.mobile,
            class: v588.class
          });
          v578++;
        }
      });
      if (v580.length) {
        const {
          error: v589
        } = await v1.from("students").upsert(v580);
        if (v589) {
          toast("Supabase error: " + v589.message, 4000);
          return;
        }
      }
      sortStudents();
      switchView("students");
      toast("Imported: " + v578 + " added, " + v579 + " updated!");
    } catch (v590) {
      console.error(v590);
      toast("Error: " + v590.message, 4000);
    }
    v571.target.value = "";
  };
  v573.readAsArrayBuffer(v572);
};
window.importMarksExcel = function (v591) {
  const v592 = v591.target.files[0];
  if (!v592) {
    return;
  }
  const v593 = new FileReader();
  v593.onload = async function (v594) {
    try {
      const v595 = new Uint8Array(v594.target.result);
      const v596 = XLSX.read(v595, {
        type: "array"
      });
      let v597 = 0;
      const v598 = state.selectedTerm;
      
      const { data: existingMarks } = await v1.from("marks").select("*").eq("term", v598);
      const existingMarksMap = {};
      if (existingMarks) {
          for (const m of existingMarks) {
              existingMarksMap[m.student_id + "_" + m.subject] = m;
          }
      }
      
      if (!state.marks[v598]) {
        state.marks[v598] = {};
      }
      const v599 = [];
      for (const v600 of v596.SheetNames) {
        const v601 = v596.Sheets[v600];
        const v602 = XLSX.utils.sheet_to_json(v601, {
          header: 1,
          defval: ""
        });
        if (!v602 || v602.length < 3) {
          continue;
        }
        let v603 = null;
        const v604 = v602[0].join(" ");
        const v605 = v604.match(/class\s*[:\-]?\s*(\d+)/i);
        if (v605) {
          v603 = normalizeClass(v605[1]);
        } else {
          v603 = normalizeClass(v600);
        }
        let v606 = -1;
        let v607 = -1;
        for (let v615 = 0; v615 < Math.min(v602.length, 15); v615++) {
          const v616 = v602[v615].map(v617 => String(v617).trim().toUpperCase());
          if (v616.filter(v618 => v618 === "TH").length >= 2 && v616.filter(v619 => v619 === "PR").length >= 2) {
            v607 = v615;
            v606 = v615 - 1;
            break;
          }
        }
        if (v607 === -1 || v606 === -1) {
          console.warn("Sheet \"" + v600 + "\": TH/PR row not found — skipped");
          continue;
        }
        const v608 = v602[v606];
        const v609 = v602[v607];
        const v610 = ["ROLL NO", "ROLL", "NAME", "SN", "GPA", "RANK", "ATTENDANCE", "TOTAL", "PERCENT", ""];
        const v611 = {};
        let v612 = null;
        for (let v620 = 0; v620 < v609.length; v620++) {
          const v621 = String(v608[v620] || "").trim().toUpperCase();
          if (v621 && !v610.includes(v621)) {
            v612 = v621;
          }
          const v622 = String(v609[v620] || "").trim().toUpperCase();
          if (!v612) {
            continue;
          }
          if (v622 === "TH") {
            if (!v611[v612]) {
              v611[v612] = {};
            }
            v611[v612].th = v620;
          } else if (v622 === "PR") {
            if (!v611[v612]) {
              v611[v612] = {};
            }
            v611[v612].pr = v620;
          }
        }
        let v613 = -1;
        let v614 = -1;
        for (let v623 = 0; v623 < v608.length; v623++) {
          const v624 = String(v608[v623] || "").trim().toLowerCase();
          const v625 = String(v609[v623] || "").trim().toLowerCase();
          if (v624.includes("roll") || v625.includes("roll")) {
            v613 = v623;
          }
          if (v624.includes("name") || v625.includes("name")) {
            v614 = v623;
          }
        }
        for (let v626 = v607 + 1; v626 < v602.length; v626++) {
          const v627 = v602[v626];
          if (!v627 || v627.every(v632 => v632 === "" || v632 == null)) {
            continue;
          }
          const v628 = v613 !== -1 ? String(v627[v613] || "").trim() : "";
          const v629 = v614 !== -1 ? String(v627[v614] || "").trim() : "";
          if (!v628 || !v629) {
            continue;
          }
          if (v628.toLowerCase().includes("roll") || v629.toLowerCase().includes("name") || v629.toLowerCase().includes("total") || v629.toLowerCase().includes("average")) {
            continue;
          }
          const v630 = state.students.find(v633 => String(v633.roll).trim() === v628 && String(v633.class).trim().toLowerCase() === (v603 || "").toLowerCase());
          if (!v630) {
            console.warn("No student: Roll=" + v628 + " Class=" + v603);
            continue;
          }
          if (!state.marks[v598][v630.id]) {
            state.marks[v598][v630.id] = {};
          }
          let v631 = false;
          for (const [v634, v635] of Object.entries(v611)) {
            const v636 = v635.th !== undefined ? String(v627[v635.th] || "").trim() : "";
            const v637 = v635.pr !== undefined ? String(v627[v635.pr] || "").trim() : "";
            const v638 = v636 === "" || v636 === "-";
            const v639 = v637 === "" || v637 === "-";
            if (v638 && v639) {
              continue;
            }
            const v640 = v638 ? 0 : parseFloat(v636) || 0;
            const v643 = {
              ENG: "English",
              NEP: "Nepali",
              MAT: "Mathematics",
              MATH: "Mathematics",
              SCI: "Science & Technology",
              SOC: "Social Studies",
              SS: "Social Studies",
              HP: "Health, Physical & Creative Arts",
              HPE: "Health, Physical & Creative Arts",
              HEALTH: "Health, Physical & Creative Arts",
              "HEALTH PHYS": "Health, Physical & Creative Arts",
              "HEALTH PHYSICAL": "Health, Physical & Creative Arts",
              "CREATIVE ARTS": "Health, Physical & Creative Arts",
              "CREATIVE ART": "Health, Physical & Creative Arts",
              HPCA: "Health, Physical & Creative Arts",
              LC: "Local Subject",
              OPT: "Optional Mathematics",
              OPTMATH: "Optional Mathematics",
              "O.MATH": "Optional Mathematics",
              "OPT.MATH": "Optional Mathematics",
              OMATH: "Optional Mathematics",
              "O.ACC": "Optional Accountancy",
              "OPT.ACC": "Optional Accountancy",
              OACC: "Optional Accountancy",
              COM: "Computer Science",
              COMP: "Computer Science",
              ACC: "Optional Accountancy",
              ECO: "Economics",
              PHY: "Physics",
              CHE: "Chemistry",
              BIO: "Biology",
              GEO: "Geography",
              HIS: "History",
              MOR: "Moral Education",
              EVS: "Environment",
              ART: "Art",
              MUS: "Music"
            };
            const v644 = v643[v634.toUpperCase()];
            const v645 = v644 ? state.subjects.find(v646 => v646.toLowerCase() === v644.toLowerCase()) || v644 : state.subjects.find(v647 => v647.toUpperCase() === v634 || v647.toUpperCase().startsWith(v634) || v634.startsWith(v647.toUpperCase())) || v634;
            const finalSubject = window.normalizeSubjectName ? window.normalizeSubjectName(v645) : v645;
            
            let finalPr = v639 ? 0 : parseFloat(v637) || 0;
            const exist = existingMarksMap[v630.id + "_" + finalSubject];
            if (v635.pr === undefined && exist && exist.practical_marks !== undefined && exist.practical_marks !== null) {
                finalPr = exist.practical_marks;
            }
            
            const v642 = Math.max(0, Math.round(v640 + finalPr));
            
            state.marks[v598][v630.id][finalSubject] = v642;
            v599.push({
              term: v598,
              student_id: v630.id,
              subject: finalSubject,
              theory_marks: v640,
              practical_marks: finalPr,
              value: v642,
              teacher_id: window.currentUser?.id || null
            });
            v631 = true;
          }
          if (v631) {
            v597++;
          }
        }
      }
      if (v599.length) {
        const {
          error: v648
        } = await v1.from("marks").upsert(v599, {
          onConflict: "term,student_id,subject"
        });
        if (v648) {
          toast("Supabase error: " + v648.message, 4000);
          return;
        }
      }
      await logActivity("Imported Marks", "Term: " + v598 + ", Records: " + v599.length);
      switchView("performance");
      toast("Imported marks for " + v597 + " student(s) — " + v599.length + " subject records!");
    } catch (v649) {
      console.error(v649);
      toast("Error: " + v649.message, 4000);
    }
    v591.target.value = "";
  };
  v593.readAsArrayBuffer(v592);
};
window.fetchStudentPhotoOnNeed = async function (v650) {
  const v651 = state.students.find(v652 => v652.id === v650);
  if (v651 && v651.photo) {
    return v651.photo;
  }
  try {
    const {
      data: v653,
      error: v654
    } = await v1.from("students").select("photo").eq("id", v650).single();
    if (v654) {
      throw v654;
    }
    if (v653 && v653.photo) {
      if (v651) {
        v651.photo = v653.photo;
      }
      return v653.photo;
    }
  } catch (v655) {
    console.error("Error fetching student photo:", v655);
  }
  return null;
};
window.viewStudent = function (v656) {
  state.activeProfileTab = "details";
  state.activeStudentId = v656;
  state.studentStats = null;
  state.fullStudentAttendance = null;
  renderStudentDetail(v656);
  (async () => {
    try {
      const v657 = await window.fetchStudentPhotoOnNeed(v656);
      if (v657 && state.activeStudentId === v656) {
        renderStudentDetail(v656);
      }
    } catch (v658) {
      console.warn("Photo fetch error in viewStudent", v658);
    }
  })();
  (async () => {
    try {
      const {
        data: v659
      } = await v1.from("attendance").select("date, status").eq("student_id", v656).order("date", {
        ascending: true
      });
      const v660 = {};
      const v661 = ["Baisakh", "Jestha", "Ashadh", "Shrawan", "Bhadra", "Ashwin", "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"];
      const uniqueAttendance = [];
      const seenDates = new Set();
      (v659 || []).forEach(record => {
        if (record.date) {
          let bsDateStr = "";
          const dateParts = record.date.split('T')[0].split(' ')[0].split('-');
          const year = parseInt(dateParts[0]);
          if (year > 2050) {
            bsDateStr = record.date.split('T')[0].split(' ')[0];
          } else {
            try {
              if (window.NepaliFunctions) {
                bsDateStr = window.NepaliFunctions.AD2BS(record.date, "YYYY-MM-DD", "YYYY-MM-DD") || "";
              }
            } catch (e) {}
          }
          if (bsDateStr) {
            if (!seenDates.has(bsDateStr)) {
              seenDates.add(bsDateStr);
              record.resolvedBsDate = bsDateStr;
              uniqueAttendance.push(record);
            }
          } else {
            const dateStr = record.date.split('T')[0].split(' ')[0];
            if (!seenDates.has(dateStr)) {
              seenDates.add(dateStr);
              record.resolvedBsDate = null;
              uniqueAttendance.push(record);
            }
          }
        }
      });
      uniqueAttendance.forEach(v662 => {
        let v663 = "";
        let v664 = "";
        try {
          if (v662.resolvedBsDate && window.NepaliFunctions) {
            const v666 = window.NepaliFunctions.ConvertToDateObject(v662.resolvedBsDate, "YYYY-MM-DD");
            if (v666 && v666.year && v666.month) {
              v663 = v666.year + "-" + String(v666.month).padStart(2, "0");
              v664 = v661[v666.month - 1] + " " + v666.year;
            }
          }
        } catch (v667) {
          console.warn("NepaliFunctions error in viewStudent monthly grouping", v667);
        }
        if (!v663 || !v664) {
          const v668 = new Date(v662.date);
          const v669 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
          v663 = v668.getFullYear() + "-" + String(v668.getMonth() + 1).padStart(2, "0");
          v664 = v669[v668.getMonth()] + " " + v668.getFullYear();
        }
        if (!v660[v663]) {
          v660[v663] = {
            label: v664,
            p: 0,
            a: 0,
            l: 0
          };
        }
        if (v662.status === "P") {
          v660[v663].p++;
        } else if (v662.status === "A") {
          v660[v663].a++;
        } else if (v662.status === "L") {
          v660[v663].l++;
        }
      });
      state.fullStudentAttendance = uniqueAttendance;
      state.studentStats = {
        monthly: v660
      };
      if (state.activeStudentId === v656) {
        renderStudentDetail(v656);
      }
    } catch (v670) {
      console.warn("studentStats load error", v670);
    }
  })();
};
window.setProfileTab = function (v671, v672) {
  state.activeProfileTab = v671;
  if (v671 === "leave") {
    window.loadLeaveApplications().then(() => renderStudentDetail(v672));
  } else if (v671 === "marks") {
    const v673 = state.students.find(v674 => v674.id === v672);
    if (!state.selectedTerm) {
        state.selectedTerm = (window.state.activeMarks && window.state.activeMarks.selectedTerm) ? window.state.activeMarks.selectedTerm : (window.TERMS ? window.TERMS[0] : "First Term");
    }
    if (window.loadMarksFromDb) {
        window.loadMarksFromDb(state.selectedTerm).then(() => {
            window.loadClassSubjects(v673?.class).then(() => renderStudentDetail(v672));
        });
    } else {
        window.loadClassSubjects(v673?.class).then(() => renderStudentDetail(v672));
    }
  } else if (v671 === "cas") {
    renderStudentDetail(v672);
    if (typeof window.switchStudentSubTab === "function") {
      window.switchStudentSubTab("cas", v672);
    }
  } else {
    renderStudentDetail(v672);
  }
};
window.loadClassSubjects = async function (v675) {
  if (!v675) {
    return;
  }
  if (state.classSubjects && state.classSubjects[v675]) {
    return;
  }
  try {
    const {
      data: v676,
      error: v677
    } = await v1.from("profiles").select("assigned_classes").eq("role", "teacher");
    if (v677) {
      throw v677;
    }
    const v678 = new Set();
    (v676 || []).forEach(v679 => {
      const v680 = safeParseAssignments(v679.assigned_classes);
      v680.forEach(v681 => {
        if (v681.className === v675 && v681.subjects) {
          v681.subjects.forEach(v682 => v678.add(v682));
        }
      });
    });
    if (!state.classSubjects) {
      state.classSubjects = {};
    }
    state.classSubjects[v675] = Array.from(v678).sort();
  } catch (v683) {
    console.error("Error loading class subjects", v683);
  }
};
window.changeDetailTerm = function (v684, v685) {
  state.selectedTerm = v684;
  loadMarksFromDb(v684).then(() => renderStudentDetail(v685));
};
function renderStudentDetail(v686) {
  const v687 = state.students.find(v703 => v703.id === v686);
  if (!v687) {
    return;
  }
  const v688 = v687.class ? v687.class.match(/Grade\s+(\d+)/i) : null;
  const v689 = v688 ? parseInt(v688[1]) >= 6 && parseInt(v688[1]) <= 10 : false;
  let v690 = state.activeProfileTab;
  if (v689 && v690 === "cas") {
    v690 = "details";
    state.activeProfileTab = "details";
  }
  const v691 = state.fullStudentAttendance || [];
  let v692 = 0;
  let v693 = 0;
  let v694 = 0;
  let v695 = v691.length;
  v691.forEach(v704 => {
    if (v704.status === "P") {
      v692++;
    } else if (v704.status === "A") {
      v693++;
    } else if (v704.status === "L") {
      v694++;
    }
  });
  const v696 = TERM_DATE_MAP[state.selectedTerm] || {
    start: "1900-01-01",
    end: "2100-12-31"
  };
  const v697 = v691.filter(v705 => v705.date >= v696.start && v705.date <= v696.end);
  const v698 = state.studentStats;
  const v699 = v698?.monthly || {};
  const v700 = Object.keys(v699).sort();
  const v701 = v700.length === 0 ? "<p style=\"color:var(--text-muted);font-size:0.8rem;text-align:center;padding:0.5rem;\">" + (v691.length === 0 ? "No attendance records found." : "Loading monthly data...") + "</p>" : "<table style=\"width:100%;border-collapse:collapse;font-size:0.8rem;\">\n        <thead><tr>\n          <th style=\"text-align:left;padding:0.3rem 0.5rem;border-bottom:2px solid #e2e8f0;color:var(--text-muted);font-size:0.7rem;\">Month</th>\n          <th style=\"text-align:center;padding:0.3rem;border-bottom:2px solid #e2e8f0;color:#10b981;font-size:0.7rem;\">P</th>\n          <th style=\"text-align:center;padding:0.3rem;border-bottom:2px solid #e2e8f0;color:#ef4444;font-size:0.7rem;\">A</th>\n          <th style=\"text-align:center;padding:0.3rem;border-bottom:2px solid #e2e8f0;color:#f59e0b;font-size:0.7rem;\">L</th>\n          <th style=\"text-align:center;padding:0.3rem;border-bottom:2px solid #e2e8f0;color:var(--primary);font-size:0.7rem;\">%</th>\n        </tr></thead>\n        <tbody>\n        " + v700.map(v706 => {
    const v707 = v699[v706];
    const v708 = v707.p + v707.a + v707.l;
    const v709 = v708 ? Math.round(v707.p / v708 * 100) : 0;
    const v710 = v709 < 75 ? "#fff1f2" : "";
    return "<tr style=\"background:" + v710 + ";\">\n            <td style=\"padding:0.3rem 0.5rem;font-weight:600;\">" + v707.label + "</td>\n            <td style=\"text-align:center;padding:0.3rem;color:#10b981;font-weight:700;\">" + v707.p + "</td>\n            <td style=\"text-align:center;padding:0.3rem;color:#ef4444;font-weight:700;\">" + v707.a + "</td>\n            <td style=\"text-align:center;padding:0.3rem;color:#f59e0b;font-weight:700;\">" + v707.l + "</td>\n            <td style=\"text-align:center;padding:0.3rem;font-weight:800;color:" + (v709 < 75 ? "#ef4444" : v709 < 85 ? "#f59e0b" : "#10b981") + ";\">" + v709 + "%</td>\n          </tr>";
  }).join("") + "\n        </tbody>\n      </table>";
  const v702 = document.getElementById("main-content");
  v702.innerHTML = "<div class=\"view\">\n    <div class=\"back-row\">\n      <button class=\"btn btn-ghost btn-icon\" onclick=\"switchView('students')\"><i data-lucide=\"arrow-left\"></i></button>\n      <h2>Student Profile</h2>\n      <button class=\"btn btn-ghost btn-icon\" style=\"margin-left:auto\" onclick=\"openStudentForm('" + v686 + "')\"><i data-lucide=\"edit-2\"></i></button>\n    </div>\n    <div class=\"card\" style=\"text-align:center;padding:1.5rem;background:linear-gradient(135deg,#4f46e5,#818cf8);border:none;color:white\">\n      <div style=\"width:72px;height:72px;border-radius:50%;background:rgba(255,255,255,0.2);margin:0 auto 0.75rem;overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:1.8rem;font-weight:800;color:white;border:3px solid rgba(255,255,255,0.5)\">\n        " + (v687.photo ? "<img src=\"" + v687.photo + "\" loading=\"lazy\" decoding=\"async\" style=\"width:100%;height:100%;object-fit:cover\">" : "" + escapeHtml(v687.name.charAt(0))) + "\n      </div>\n      <h2 style=\"color:white;font-size:1.2rem;margin-bottom:0.75rem;\">" + escapeHtml(v687.name) + "</h2>\n\n      <div style=\"display:grid;grid-template-columns:repeat(4,1fr);gap:0.4rem;margin-top:0.5rem\">\n        <div style=\"background:rgba(255,255,255,0.15);border-radius:0.5rem;padding:0.4rem\">\n          <div style=\"font-weight:800;color:white;font-size:1rem\">" + v692 + "</div>\n          <div style=\"font-size:0.6rem;color:rgba(255,255,255,0.7)\">Present</div>\n        </div>\n        <div style=\"background:rgba(255,255,255,0.15);border-radius:0.5rem;padding:0.4rem\">\n          <div style=\"font-weight:800;color:white;font-size:1rem\">" + v693 + "</div>\n          <div style=\"font-size:0.6rem;color:rgba(255,255,255,0.7)\">Absent</div>\n        </div>\n        <div style=\"background:rgba(255,255,255,0.15);border-radius:0.5rem;padding:0.4rem\">\n          <div style=\"font-weight:800;color:white;font-size:1rem\">" + v694 + "</div>\n          <div style=\"font-size:0.6rem;color:rgba(255,255,255,0.7)\">Late</div>\n        </div>\n        <div style=\"background:rgba(255,255,255,0.15);border-radius:0.5rem;padding:0.4rem\">\n          <div style=\"font-weight:800;color:white;font-size:1rem\">" + (v695 ? Math.round(v692 / v695 * 100) : 0) + "%</div>\n          <div style=\"font-size:0.6rem;color:rgba(255,255,255,0.7)\">Rate</div>\n        </div>\n      </div>\n      " + (v695 === 0 ? "<p style=\"margin-top:0.5rem; font-size:0.7rem; color:rgba(255,255,255,0.9); font-weight:700;\">No attendance data for this term.</p>" : "") + "\n    </div>\n\n    " + (() => {
    const v711 = getTeacherAssignments();
    const v712 = v711.isAdmin || v711.assignments?.some(v713 => v713.isHomeroom && v713.className === v687.class);
    if (v712) {
      return "\n            <div style=\"margin:1rem 0; text-align:center;\">\n                <button class=\"btn\" style=\"background:#0f172a; color:#fff; width:100%; justify-content:center; padding:0.75rem; border-radius:8px;\" onclick=\"window.openAIReportModal('" + v686 + "')\">\n                    <i data-lucide=\"bot\" style=\"width:18px; height:18px; margin-right:8px; color:#10b981;\"></i> Generate मासिक / त्रैमासिक प्रतिवेदन (Gemini AI)\n                </button>\n            </div>\n            ";
    }
    return "";
  })() + "\n    <div class=\"tabs\">\n      <div class=\"tab " + (v690 === "details" ? "active" : "") + "\" onclick=\"setProfileTab('details','" + v686 + "')\">Details</div>\n      <div class=\"tab " + (v690 === "marks" ? "active" : "") + "\" onclick=\"setProfileTab('marks','" + v686 + "')\">Marks</div>\n      " + (v689 ? "" : "<div class=\"tab " + (v690 === "cas" ? "active" : "") + "\" onclick=\"setProfileTab('cas','" + v686 + "')\">CAS</div>") + "\n    </div>\n    " + (v690 === "details" ? "\n      <div class=\"card\">\n        <div class=\"detail-row\"><span class=\"detail-label\">Date of Birth</span><input type=\"text\" class=\"form-input nepali-date-picker\" style=\"width:auto;border:none;padding:0;text-align:right;background:transparent;color:var(--text-main);font-weight:700;\" value=\"" + (v687.dob || "") + "\" onchange=\"window.updateStudentField('" + v687.id + "','dob',this.value)\" readonly></div>\n        <div class=\"detail-row\"><span class=\"detail-label\">Parents</span><span class=\"detail-value\">" + escapeHtml(window.formatParentsName(v687.parents) || "—") + "</span></div>\n        <div class=\"detail-row\"><span class=\"detail-label\">Mobile</span><span class=\"detail-value\">" + escapeHtml(v687.mobile || "—") + "</span></div>\n        <div class=\"detail-row\"><span class=\"detail-label\">Class</span><span class=\"detail-value\">" + escapeHtml(v687.class) + "</span></div>\n      </div>\n      <div class=\"card\" style=\"padding:0.75rem;\">\n        <p style=\"font-weight:800;font-size:0.85rem;margin-bottom:0.5rem;\"><i data-lucide=\"calendar-check\" style=\"width:14px;height:14px;vertical-align:middle;margin-right:4px;\"></i>Monthly Attendance</p>\n        " + v701 + "\n      </div>\n      " + (v687.mobile ? "<a href=\"tel:" + v687.mobile + "\" class=\"btn btn-primary btn-block\" style=\"margin-top:0;text-decoration:none\"><i data-lucide=\"phone\"></i> Call Parents</a>" : "") + "\n    " : v690 === "marks" ? "\n      <div class=\"card\" style=\"padding:0.5rem\">\n        <div style=\"margin-bottom:0.75rem;padding:0.5rem;\">\n          <select class=\"form-input\" onchange=\"changeDetailTerm(this.value,'" + v686 + "')\">\n            " + TERMS.map(v714 => "<option value=\"" + v714 + "\" " + (v714 === state.selectedTerm ? "selected" : "") + ">" + v714 + "</option>").join("") + "\n          </select>\n        </div>\n        <table class=\"marks-table\"><thead><tr><th>Subject</th><th>Score</th><th>Grade</th></tr></thead><tbody>\n        " + (() => {
    let v715 = state.classSubjects?.[v687.class] || [];
    const v716 = window.currentUserProfile;
    const v717 = v716 ? safeParseAssignments(v716.assigned_classes) : [];
    const v718 = v716 && v716.role === "admin";
    const isHomeroom = v717.some(v729 => v729.isHomeroom === true && (String(v729.className).trim().toLowerCase() === String(v687.class).trim().toLowerCase() || (v687.class.match(/\d+/)?.[0] && v729.className.match(/\d+/)?.[0] === v687.class.match(/\d+/)?.[0])));
    
    if (v715.length === 0) {
        v715 = state.subjects || [];
    }
    v715 = [...new Set(v715)].filter(s => s && s.trim() !== "");
    if (window.filterSubjectsByClass) {
        v715 = window.filterSubjectsByClass(v715, v687.class);
    }
    if (window.sortSubjectsByStandardOrder) {
        v715 = window.sortSubjectsByStandardOrder(v715);
    }

    if (state.marks && state.marks[state.selectedTerm] && state.marks[state.selectedTerm][v686]) {
      Object.keys(state.marks[state.selectedTerm][v686]).forEach(v719a => {
        const normSubName = window.normalizeSubjectName ? window.normalizeSubjectName(v719a) : v719a;
        if (!v715.includes(normSubName)) {
          v715.push(normSubName);
        }
      });
    }

    if (v715.length === 0) {
      return "<tr><td colspan=\"3\" style=\"padding:1.5rem; text-align:center; color:var(--text-muted);\">No subjects found for this class.</td></tr>";
    }
    return v715.map(v719 => {
      const v720 = state.marks[state.selectedTerm] || {};
      const normalizedStudentMarks = {};
      if (window.normalizeSubjectName && v720[v686]) {
          Object.entries(v720[v686]).forEach(([k, v]) => {
              normalizedStudentMarks[window.normalizeSubjectName(k)] = v;
          });
      } else if (v720[v686]) {
          Object.assign(normalizedStudentMarks, v720[v686]);
      }
      const normSubKey = window.normalizeSubjectName ? window.normalizeSubjectName(v719) : v719;
      const v721 = normalizedStudentMarks[normSubKey];
      const v722 = v721 !== undefined ? v721 : "";
      const v723 = state.selectedTerm && state.selectedTerm.toLowerCase().includes("mid");
      let fullMarks = v723 ? 50 : 100;
      if (v723) {
          const ls = v719.toLowerCase().trim();
          const classLevel = window.getClassLevel ? window.getClassLevel(v687.class) : "Basic";
          if (ls.includes("oral") || ls.includes("computer") || ls.includes("moral") || ls === "gk" || ls.includes("general knowledge") || ls.includes("drawing") || ls.includes("rhyme") || ls.includes("hygiene")) {
              fullMarks = 25;
          } else if (classLevel === "Primary" && (ls.includes("local") || ls === "lc")) {
              fullMarks = 25;
          }
      }
      const v724 = v722 === "" ? null : v723 ? (parseFloat(v722) / fullMarks) * 100 : parseFloat(v722);
      const v725 = v724 === null ? "—" : v724 >= 90 ? "A+" : v724 >= 80 ? "A" : v724 >= 70 ? "B+" : v724 >= 60 ? "B" : v724 >= 50 ? "C+" : v724 >= 40 ? "C" : v724 >= 32 ? "D" : "E";
      const v726 = v717.some(v729 => {
        const classMatches = String(v729.className).trim().toLowerCase() === String(v687.class).trim().toLowerCase() ||
                             (v687.class.match(/\d+/)?.[0] && v729.className.match(/\d+/)?.[0] === v687.class.match(/\d+/)?.[0]);
        if (!classMatches) return false;
        if (v729.isHomeroom === true) return true;
        return Array.isArray(v729.subjects) && v729.subjects.some(v730 => {
          const ass = String(v730).trim().toLowerCase();
          const tgt = String(v719).trim().toLowerCase();
          if (ass === tgt) return true;
          const mappings = {
            "नेपाली": ["nepali", "byakaran", "grammar", "नेपाली व्याकरण", "नेपाली"],
            "english": ["english", "english grammar", "english language"],
            "mathematics": ["math", "maths", "compulsory math", "c. math", "c.math", "गणित", "mathematics"],
            "हाम्रो सेरोफेरो": ["hamro serofero", "serofero", "our surroundings", "environment", "evs", "environmental study", "हाम्रो सेरोफेरो"],
            "सामाजिक अध्ययन": ["social", "social studies", "social studies & human value education", "social studies and human value education", "samajik", "सामाजिक अध्ययन", "hamro serofero"],
            "science & technology": ["science", "science & tech", "science and tech", "science & technology", "science and technology", "sci", "natural science", "विज्ञान तथा प्रविधि", "विज्ञान र प्रविधि", "विज्ञान"],
            "science and technology": ["science", "science & tech", "science and tech", "science & technology", "science and technology", "sci", "natural science", "विज्ञान तथा प्रविधि", "विज्ञान र प्रविधि", "विज्ञान"],
            "health, physical & creative arts": [
              "health", "hpe", "hpca", "hp", "physical education", "pe", "creative arts", "creative art", "drawing", "art", "painting",
              "health physical & creative", "health physical and creative",
              "health, physical & creative", "health, physical and creative",
              "health, physical & creative arts", "health, physical and creative arts",
              "health phys", "health phys.", "health, phys.", "health, phys", "health & creative", "health & creative arts", "health physical & creative arts"
            ],
            "health, physical and creative arts": [
              "health", "hpe", "hpca", "hp", "physical education", "pe", "creative arts", "creative art", "drawing", "art", "painting",
              "health physical & creative", "health physical and creative",
              "health, physical & creative", "health, physical and creative",
              "health, physical & creative arts", "health, physical and creative arts",
              "health phys", "health phys.", "health, phys.", "health, phys", "health & creative", "health & creative arts", "health physical & creative arts"
            ],
            "local subject": ["local subject", "local curriculum", "local", "lc", "mother tongue", "matribhasha", "मातृभाषा", "tamang", "local subject (mother tongue)"]
          };
          for (let key in mappings) {
            if (key.toLowerCase() === tgt || tgt.includes(key.toLowerCase()) || key.toLowerCase().includes(tgt)) {
              const aliases = mappings[key];
              if (aliases.some(alias => ass === alias || ass.includes(alias) || alias.includes(ass))) return true;
            }
          }
          return ass.includes(tgt) || tgt.includes(ass);
        });
      });
      const v727 = v718 || v726;
      let v728 = "";
      if (!v718) {
        if (v726) {
          v728 = "<span class=\"badge badge-success\" style=\"font-size:0.65rem; padding:0.15rem 0.35rem; background:#dcfce7; color:#15803d; border-radius:4px; margin-left:6px; font-weight:700; display:inline-block; vertical-align:middle;\">Assigned</span>";
        } else {
          v728 = "<span class=\"badge badge-muted\" style=\"font-size:0.65rem; padding:0.15rem 0.35rem; background:#f1f5f9; color:#64748b; border-radius:4px; margin-left:6px; font-weight:700; display:inline-block; vertical-align:middle;\"><i data-lucide=\"lock\" style=\"width:10px; height:10px; display:inline-block; vertical-align:middle; margin-right:2px; margin-top:-2px;\"></i>View Only</span>";
        }
      }
      return "<tr>\n                  <td>\n                      <span style=\"font-weight:600; display:inline-block; vertical-align:middle;\">" + escapeHtml(v719) + "</span>\n                      " + v728 + "\n                  </td>\n                  <td>\n                      <input class=\"marks-input\" type=\"number\" min=\"0\" \n                          max=\"" + fullMarks + "\" \n                          value=\"" + v722 + "\" \n                          onchange=\"updateMarks('" + v686 + "','" + v719 + "',this.value)\"\n                          " + (v727 ? "" : "disabled style=\"background:#f1f5f9; color:#94a3b8; border-color:#e2e8f0; cursor:not-allowed;\"") + "\n                      >\n                  </td>\n                  <td><strong>" + v725 + "</strong></td>\n              </tr>";
    }).join("");
  })() + "\n        </tbody></table>\n      </div>\n    " : v690 === "cas" ? "\n      <div id=\"student-subtab-content\" style=\"padding: 0.5rem 0.25rem;\">\n        <p style=\"text-align:center;padding:2rem;color:var(--text-muted)\">Loading CAS logs...</p>\n      </div>\n    " : "\n      <div class=\"card\"><p>Unknown Tab</p></div>\n    ") + "\n  </div>";
  lucide.createIcons();
}
window.renderStudentDetail = renderStudentDetail;
window.openManageSubjects = function () {
  openModal("\n    <div class=\"modal-handle\"></div>\n    <p class=\"modal-title\">Manage Subjects</p>\n    <div style=\"display:flex;gap:0.5rem;margin-bottom:1rem\">\n      <input type=\"text\" id=\"new-sub-name\" class=\"form-input\" placeholder=\"New subject name\">\n      <button class=\"btn btn-primary\" onclick=\"addSubject()\">Add</button>\n    </div>\n    <div class=\"att-card\" id=\"subj-list\" style=\"max-height:50vh;overflow-y:auto;padding-right:0.5rem\">\n      " + renderSubjectsList() + "\n    </div>\n    <button class=\"btn btn-block\" onclick=\"closeModal()\">Done</button>\n  ");
};
window.renderSubjectsList = function () {
  return state.subjects.map((v731, v732) => "\n    <div class=\"att-row\" style=\"padding:0.5rem;margin-bottom:0.5rem\">\n      <div style=\"font-weight:600\">" + v731 + "</div>\n      <button class=\"delete-btn\" onclick=\"deleteSubject(" + v732 + ")\"><i data-lucide=\"trash-2\" style=\"width:14px;height:14px\"></i></button>\n    </div>").join("");
};
window.addSubject = async function () {
  const v733 = document.getElementById("new-sub-name").value.trim();
  if (!v733) {
    return;
  }
  if (state.subjects.includes(v733)) {
    toast("Subject already exists");
    return;
  }
  try {
    const {
      error: v734
    } = await v1.from("subjects").insert({
      name: v733,
      sort_order: state.subjects.length + 1
    });
    if (v734) {
      toast(v734.message);
      return;
    }
    state.subjects.push(v733);
    document.getElementById("subj-list").innerHTML = renderSubjectsList();
    lucide.createIcons();
    document.getElementById("new-sub-name").value = "";
    toast("Subject added");
    if (state.currentView === "performance") {
      switchView("performance");
    }
  } catch (v735) {
    console.error("addSubject error", v735);
  }
};
window.deleteSubject = async function (v736) {
  if (!confirm("Delete this subject?")) {
    return;
  }
  const v737 = state.subjects[v736];
  try {
    const {
      error: v738
    } = await v1.from("subjects").delete().eq("name", v737);
    if (v738) {
      toast(v738.message);
      return;
    }
    state.subjects.splice(v736, 1);
    document.getElementById("subj-list").innerHTML = renderSubjectsList();
    lucide.createIcons();
    toast("Subject deleted");
    if (state.currentView === "performance") {
      switchView("performance");
    }
  } catch (v739) {
    console.error("deleteSubject error", v739);
  }
};
window.updateStudentField = async function (v740, v741, v742) {
  try {
    const {
      error: v743
    } = await v1.from("students").update({
      [v741]: v742
    }).eq("id", v740);
    if (v743) {
      toast(v743.message);
      return;
    }
    const v744 = state.students.findIndex(v745 => v745.id === v740);
    if (v744 !== -1) {
      state.students[v744][v741] = v742;
    }
    toast("Updated");
  } catch (v746) {
    console.error("updateStudentField error", v746);
  }
};
window.openChangePasswordModal = function () {
  openModal("\n        <div class=\"modal-handle\"></div>\n        <p class=\"modal-title\">Change Password</p>\n        <div class=\"form-group\">\n            <label class=\"form-label\">New Password</label>\n            <input type=\"password\" id=\"new-password\" class=\"form-input\" placeholder=\"Min 6 characters\">\n        </div>\n        <div class=\"form-group\">\n            <label class=\"form-label\">Confirm New Password</label>\n            <input type=\"password\" id=\"confirm-password\" class=\"form-input\" placeholder=\"Repeat new password\">\n        </div>\n        <div style=\"background:var(--primary-light); padding:0.75rem; border-radius:8px; margin-bottom:1.5rem;\">\n            <p style=\"font-size:0.7rem; color:var(--primary); line-height:1.4;\">\n                <i data-lucide=\"shield-check\" style=\"width:12px;height:12px;vertical-align:middle;margin-right:2px\"></i>\n                For security, choose a strong password that you don't use elsewhere.\n            </p>\n        </div>\n        <button class=\"btn btn-primary btn-block\" onclick=\"window.updateUserPassword()\">\n            <i data-lucide=\"lock\" style=\"width:16px;height:16px\"></i> Update Password\n        </button>\n        <button class=\"btn btn-ghost btn-block\" style=\"margin-top:0.5rem\" onclick=\"closeModal()\">Cancel</button>\n    ");
  if (window.lucide) {
    lucide.createIcons();
  }
};
window.updateUserPassword = async function () {
  const v747 = document.getElementById("new-password").value;
  const v748 = document.getElementById("confirm-password").value;
  if (!v747 || v747.length < 6) {
    toast("Password must be at least 6 characters");
    return;
  }
  if (v747 !== v748) {
    toast("Passwords do not match");
    return;
  }
  try {
    toast("Updating password...", 10000);
    const {
      error: v749
    } = await v1.auth.updateUser({
      password: v747
    });
    if (v749) {
      throw v749;
    }
    toast("✅ Password updated successfully!");
    closeModal();
  } catch (v750) {
    console.error("Password update failed:", v750);
    toast("Error: " + (v750.message || "Failed to update password"));
  }
};
window.loadRoutineForClass = async function (v751) {
  if (!v751) {
    return;
  }
  try {
    const v752 = state.selectedRoutineType || "Class";
    const v753 = state.selectedRoutineTerm || "Regular";
    const {
      data: v754,
      error: v755
    } = await v1.from("routines").select("*").eq("class", v751).eq("routine_type", v752).eq("term", v753).order("created_at", {
      ascending: false
    }).limit(1).single();
    if (v755 && v755.code !== "PGRST116") {
      const {
        data: v756,
        error: v757
      } = await v1.from("routines").select("*").eq("class", v751).order("created_at", {
        ascending: false
      }).limit(1).single();
      if (!v757) {
        state.currentRoutine = v756 || null;
      } else {
        state.currentRoutine = null;
      }
    } else {
      state.currentRoutine = v754 || null;
    }
  } catch (v758) {
    console.error("loadRoutine error", v758);
    state.currentRoutine = null;
  }
};
window.changeRoutineFilter = async function (v759, v760) {
  state[v759] = v760;
  const v761 = document.getElementById("routine-content");
  if (v761) {
    v761.innerHTML = "<p style=\"text-align:center;padding:2rem;color:var(--text-muted)\">Loading routine...</p>";
  }
  await window.loadRoutineForClass(state.selectedRoutineClass);
  window.renderRoutineContent();
};
window.renderRoutineContent = function () {
  const v762 = document.getElementById("routine-content");
  if (!v762) {
    return;
  }
  const v763 = ["Class", "Exam"];
  const v764 = ["First Mid Term", "First Term", "Second Mid Term", "Second Term", "Third Mid Term", "Final Term"];
  const v765 = state.selectedRoutineType === "Class" ? ["Regular"] : v764;
  const v766 = "\n        <div style=\"display:flex; gap:0.5rem; margin-bottom:1rem;\">\n            <select class=\"form-input\" style=\"flex:1\" onchange=\"window.changeRoutineFilter('selectedRoutineType', this.value)\">\n                " + v763.map(v769 => "<option value=\"" + v769 + "\" " + (v769 === state.selectedRoutineType ? "selected" : "") + ">" + v769 + " Routine</option>").join("") + "\n            </select>\n            <select class=\"form-input\" style=\"flex:1\" onchange=\"window.changeRoutineFilter('selectedRoutineTerm', this.value)\">\n                " + v765.map(v770 => "<option value=\"" + v770 + "\" " + (v770 === state.selectedRoutineTerm ? "selected" : "") + ">" + v770 + "</option>").join("") + "\n            </select>\n        </div>\n    ";
  if (state.selectedRoutineType === "Class" && state.selectedRoutineTerm !== "Regular") {
    state.selectedRoutineTerm = "Regular";
  } else if (state.selectedRoutineType === "Exam" && state.selectedRoutineTerm === "Regular") {
    state.selectedRoutineTerm = "First Mid Term";
  }
  if (!state.currentRoutine) {
    v762.innerHTML = "\n            " + v766 + "\n            <div class=\"empty-state\">\n                <i data-lucide=\"calendar-x\" style=\"opacity:0.3; width:48px; height:48px; margin-bottom:1rem\"></i>\n                <p>No " + state.selectedRoutineType + " routine found for " + state.selectedRoutineTerm + ".</p>\n                <button class=\"btn btn-secondary btn-sm\" style=\"margin-top:1rem\" onclick=\"window.openAddRoutineModal('" + state.selectedRoutineClass + "')\">Add New Routine</button>\n            </div>";
    lucide.createIcons();
    return;
  }
  const v767 = state.currentRoutine.routine_data || {};
  let v768;
  if (state.selectedRoutineType === "Exam") {
    const v771 = Object.keys(v767).filter(v772 => v767[v772] && v767[v772].length > 0);
    if (v771.length > 0) {
      const v773 = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      v768 = v771.sort((v774, v775) => {
        const v776 = parseInt(v774.replace("Day ", ""));
        const v777 = parseInt(v775.replace("Day ", ""));
        if (!isNaN(v776) && !isNaN(v777)) {
          return v776 - v777;
        }
        const v778 = v773.indexOf(v774);
        const v779 = v773.indexOf(v775);
        if (v778 !== -1 && v779 !== -1) {
          return v778 - v779;
        }
        return v774.localeCompare(v775);
      });
    } else {
      v768 = Array.from({
        length: 15
      }, (v780, v781) => "Day " + (v781 + 1));
    }
  } else {
    v768 = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  }
  v762.innerHTML = "\n        " + v766 + "\n        <div class=\"card\" style=\"padding:1.25rem;\">\n            <div style=\"display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; border-bottom:1px solid #f1f5f9; padding-bottom:0.75rem;\">\n                <div>\n                    <h3 style=\"color:var(--primary); font-size:1rem; margin:0;\">" + escapeHtml(state.currentRoutine.title || "Routine") + "</h3>\n                    <p style=\"font-size:0.7rem; color:var(--text-muted); margin-top:2px;\">" + state.currentRoutine.routine_type + " | " + state.currentRoutine.term + "</p>\n                </div>\n                <button class=\"btn btn-ghost btn-sm\" onclick=\"window.openAddRoutineModal('" + state.selectedRoutineClass + "')\">\n                    <i data-lucide=\"edit-2\" style=\"width:14px; height:14px\"></i> Edit\n                </button>\n            </div>\n            <div style=\"display:flex; flex-direction:column; gap:1.25rem;\">\n                " + v768.map(v782 => {
    const v783 = v767[v782] || [];
    return "\n                        <div>\n                            <h4 style=\"font-size:0.75rem; text-transform:uppercase; color:var(--text-muted); margin-bottom:0.6rem; letter-spacing:0.05em; font-weight:800;\">" + v782 + "</h4>\n                            <div style=\"display:flex; flex-wrap:wrap; gap:0.5rem;\">\n                                " + (v783.length === 0 ? "<span style=\"font-size:0.8rem; color:#cbd5e1; font-style:italic;\">No schedule</span>" : v783.map((v784, v785) => {
      let v786 = v784;
      if (v784.includes(" | ")) {
        const v787 = v784.split(" | ");
        const v788 = v787[0];
        const v789 = v787[1] || "";
        const v790 = v787[2] || "";
        let v791 = "";
        if (v789 && window.NepaliFunctions) {
          try {
            v791 = window.NepaliFunctions.BS.GetFullDay(v789) || "";
          } catch (v792) {
            console.error(v792);
          }
        }
        v786 = v788;
        if (v789) {
          v786 += " | " + v789;
          if (v791) {
            v786 += " (" + v791 + ")";
          }
        }
        if (v790) {
          v786 += " | " + v790;
        }
      }
      return "\n                                    <div style=\"background:#f8fafc; border:1px solid #e2e8f0; padding:0.4rem 0.75rem; border-radius:0.5rem; font-size:0.85rem; display:flex; align-items:center; gap:0.4rem;\">\n                                        <span style=\"font-weight:800; color:var(--primary); font-size:0.75rem; opacity:0.7;\">" + (v785 + 1) + "</span>\n                                        <span style=\"font-weight:600; color:var(--text-main);\">" + escapeHtml(v786) + "</span>\n                                    </div>\n                                    ";
    }).join("")) + "\n                            </div>\n                        </div>\n                    ";
  }).join("") + "\n            </div>\n        </div>\n        <p style=\"text-align:center; font-size:0.65rem; color:var(--text-muted); margin-top:1.5rem;\">Last update: " + (window.formatDateLabel(state.currentRoutine.updated_at ? state.currentRoutine.updated_at.split("T")[0] : "") + " " + (state.currentRoutine.updated_at ? new Date(state.currentRoutine.updated_at).toLocaleTimeString("en-NP", {
    hour: "2-digit",
    minute: "2-digit"
  }) : "")) + "</p>\n    ";
  lucide.createIcons();
};
window.openAddRoutineModal = function (v793) {
  const v794 = state.currentRoutine || {
    title: "",
    routine_data: {}
  };
  window._currentModalRoutineData = v794.routine_data || {};
  const v795 = ["Class", "Exam"];
  const v796 = ["First Mid Term", "First Term", "Second Mid Term", "Second Term", "Third Mid Term", "Final Term"];
  window._generateDaysHtml = function (v800, v801, v802) {
    let v803;
    if (v800 === "Exam") {
      const v804 = Object.keys(v801);
      const v805 = v804.some(v806 => ["Sunday", "Monday", "Tuesday"].includes(v806));
      if (v805) {
        v803 = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      } else {
        v803 = Array.from({
          length: 15
        }, (v807, v808) => "Day " + (v808 + 1));
      }
    } else {
      v803 = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    }
    window.updateModalDateDay = function (v809) {
      const v810 = v809.value.trim();
      const v811 = v809.parentElement.querySelector(".routine-day-label");
      if (v811) {
        let v812 = "";
        if (v810 && window.NepaliFunctions) {
          try {
            v812 = window.NepaliFunctions.BS.GetFullDay(v810) || "";
          } catch (v813) {}
        }
        v811.textContent = v812;
      }
    };
    return v803.map(v814 => {
      const v815 = v801[v814] || [];
      const v816 = v814.replace(/ /g, "-");
      return "\n                <div class=\"form-group\" style=\"margin-bottom:1rem; background:#f8fafc; padding:0.75rem; border-radius:0.75rem; border:1px solid #e2e8f0;\">\n                    <label class=\"form-label\" style=\"display:flex; justify-content:space-between; font-size:0.7rem;\">\n                        " + v814.toUpperCase() + " \n                        <button type=\"button\" class=\"btn btn-ghost btn-sm\" style=\"padding:0; height:auto; color:var(--primary); font-size:0.7rem;\" onclick=\"window.addRoutinePeriod('" + v814 + "')\">+ Add Item</button>\n                    </label>\n                    <div id=\"periods-" + v816 + "\" style=\"display:flex; flex-direction:column; gap:0.4rem; margin-top:0.4rem;\">\n                        " + v815.map(v817 => {
        let v818 = v817;
        let v819 = "";
        if (v817.includes(" | ")) {
          const v822 = v817.split(" | ");
          v818 = v822[0];
          v819 = v822[1] || "";
        }
        const v820 = v800 === "Exam";
        let v821 = "";
        if (v819 && window.NepaliFunctions) {
          try {
            v821 = window.NepaliFunctions.BS.GetFullDay(v819) || "";
          } catch (v823) {}
        }
        return "\n                            <div style=\"display:flex; gap:0.3rem; flex-wrap:wrap; margin-bottom:0.2rem; align-items:center;\">\n                                <input type=\"text\" class=\"form-input routine-subj\" data-day=\"" + v814 + "\" value=\"" + escapeHtml(v818) + "\" style=\"flex:2; padding:0.4rem; min-width:100px;\" placeholder=\"Subject\">\n                                <input type=\"text\" class=\"form-input routine-date nepali-date-picker\" data-day=\"" + v814 + "\" value=\"" + escapeHtml(v819) + "\" style=\"flex:1.5; padding:0.4rem; min-width:100px; display: " + (v820 ? "block" : "none") + ";\" placeholder=\"Date (YYYY-MM-DD)\" onchange=\"window.updateModalDateDay(this)\">\n                                <span class=\"routine-day-label\" style=\"font-size:0.7rem; color:var(--text-muted); font-weight:700; min-width:65px; display: " + (v820 ? "inline-block" : "none") + ";\">" + v821 + "</span>\n                                <button type=\"button\" class=\"btn btn-ghost\" style=\"color:var(--error); padding:0 0.4rem;\" onclick=\"this.parentElement.remove()\">✕</button>\n                            </div>\n                            ";
      }).join("") + "\n                    </div>\n                </div>\n            ";
    }).join("");
  };
  const v797 = v824 => {
    const v825 = document.getElementById("routine-term");
    const v826 = v824 === "Class" ? ["Regular"] : v796;
    v825.innerHTML = v826.map(v827 => "<option value=\"" + v827 + "\">" + v827 + "</option>").join("");
    document.getElementById("routine-title").value = v824 + " Routine (" + v825.value + ")";
  };
  window._onModalTypeChange = function (v828) {
    state.selectedRoutineType = v828;
    v797(v828);
    const v829 = v828 === "Exam";
    const v830 = document.getElementById("routine-global-time-group");
    if (v830) {
      v830.style.display = v829 ? "block" : "none";
    }
    const v831 = document.getElementById("routine-days-container");
    const v832 = document.getElementById("routine-global-time");
    const v833 = v832 ? v832.value : "";
    if (v831) {
      v831.innerHTML = window._generateDaysHtml(v828, window._currentModalRoutineData, v833);
      if (window.initNepaliDatePicker) {
        window.initNepaliDatePicker(".nepali-date-picker");
      }
    }
  };
  window._onModalTermChange = function (v834) {
    const v835 = document.getElementById("routine-type").value;
    document.getElementById("routine-title").value = v835 + " Routine (" + v834 + ")";
  };
  let v798 = "";
  if (state.selectedRoutineType === "Exam" && v794.routine_data) {
    const v836 = Object.keys(v794.routine_data);
    for (const v837 of v836) {
      const v838 = v794.routine_data[v837] || [];
      for (const v839 of v838) {
        if (v839.includes(" | ")) {
          const v840 = v839.split(" | ");
          if (v840[2]) {
            v798 = v840[2];
            break;
          }
        }
      }
      if (v798) {
        break;
      }
    }
  }
  let v799 = window._generateDaysHtml(state.selectedRoutineType, window._currentModalRoutineData, v798);
  openModal("\n        <div class=\"modal-handle\"></div>\n        <p class=\"modal-title\">Manage Routine: " + v793 + "</p>\n        \n        <div style=\"display:flex; gap:0.5rem; margin-bottom:1rem;\">\n            <div style=\"flex:1\">\n                <label class=\"form-label\">Type</label>\n                <select id=\"routine-type\" class=\"form-input\" onchange=\"window._onModalTypeChange(this.value)\">\n                    " + v795.map(v841 => "<option value=\"" + v841 + "\" " + (v841 === state.selectedRoutineType ? "selected" : "") + ">" + v841 + "</option>").join("") + "\n                </select>\n            </div>\n            <div style=\"flex:1\">\n                <label class=\"form-label\">Term</label>\n                <select id=\"routine-term\" class=\"form-input\" onchange=\"window._onModalTermChange(this.value)\">\n                    " + (state.selectedRoutineType === "Class" ? ["Regular"] : v796).map(v842 => "<option value=\"" + v842 + "\" " + (v842 === state.selectedRoutineTerm ? "selected" : "") + ">" + v842 + "</option>").join("") + "\n                </select>\n            </div>\n        </div>\n\n        <div style=\"display:flex; gap:0.5rem; margin-bottom:1rem;\">\n            <div style=\"flex:1\">\n                <label class=\"form-label\">Title</label>\n                <input type=\"text\" id=\"routine-title\" class=\"form-input\" value=\"" + escapeHtml(v794.title || state.selectedRoutineType + " Routine (" + state.selectedRoutineTerm + ")") + "\" placeholder=\"e.g. Regular Schedule\">\n            </div>\n            <div id=\"routine-global-time-group\" style=\"flex:1; display: " + (state.selectedRoutineType === "Exam" ? "block" : "none") + ";\">\n                <label class=\"form-label\">Exam Time</label>\n                <input type=\"time\" id=\"routine-global-time\" class=\"form-input\" value=\"" + escapeHtml(v798) + "\">\n            </div>\n        </div>\n        \n        <div id=\"routine-days-container\" style=\"max-height:300px; overflow-y:auto; margin-bottom:1rem; padding-right:5px;\">\n            " + v799 + "\n        </div>\n        \n        <button class=\"btn btn-primary btn-block\" onclick=\"window.saveRoutineFromForm('" + v793 + "')\">\n            <i data-lucide=\"check\"></i> Save Routine\n        </button>\n        <button class=\"btn btn-ghost btn-block\" style=\"margin-top:0.5rem\" onclick=\"closeModal()\">Cancel</button>\n    ");
  window.addRoutinePeriod = function (v843) {
    const v844 = document.getElementById("routine-type").value === "Exam";
    const v845 = v843.replace(/ /g, "-");
    const v846 = document.getElementById("periods-" + v845);
    const v847 = document.createElement("div");
    v847.style.display = "flex";
    v847.style.gap = "0.3rem";
    v847.style.flexWrap = "wrap";
    v847.style.marginBottom = "0.2rem";
    v847.style.alignItems = "center";
    v847.innerHTML = "\n            <input type=\"text\" class=\"form-input routine-subj\" data-day=\"" + v843 + "\" value=\"\" style=\"flex:2; padding:0.4rem; min-width:100px;\" placeholder=\"Subject\">\n            <input type=\"text\" class=\"form-input routine-date nepali-date-picker\" data-day=\"" + v843 + "\" value=\"\" style=\"flex:1.5; padding:0.4rem; min-width:100px; display: " + (v844 ? "block" : "none") + ";\" placeholder=\"Date (YYYY-MM-DD)\" onchange=\"window.updateModalDateDay(this)\">\n            <span class=\"routine-day-label\" style=\"font-size:0.7rem; color:var(--text-muted); font-weight:700; min-width:65px; display: " + (v844 ? "inline-block" : "none") + ";\"></span>\n            <button type=\"button\" class=\"btn btn-ghost\" style=\"color:var(--error); padding:0 0.5rem;\" onclick=\"this.parentElement.remove()\">✕</button>\n        ";
    v846.appendChild(v847);
    if (window.initNepaliDatePicker) {
      window.initNepaliDatePicker(".nepali-date-picker");
    }
  };
  if (window.lucide) {
    lucide.createIcons();
  }
  setTimeout(() => {
    if (window.initNepaliDatePicker) {
      window.initNepaliDatePicker(".nepali-date-picker");
    }
  }, 100);
};
window.saveRoutineFromForm = async function (v848) {
  const v849 = document.getElementById("routine-title").value || "Class Routine";
  const v850 = document.getElementById("routine-type").value;
  const v851 = document.getElementById("routine-global-time") ? document.getElementById("routine-global-time").value : "";
  const v852 = {};
  let v853;
  if (v850 === "Exam") {
    const v854 = Object.keys(window._currentModalRoutineData || {});
    const v855 = v854.some(v856 => ["Sunday", "Monday", "Tuesday"].includes(v856));
    if (v855) {
      v853 = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    } else {
      v853 = Array.from({
        length: 15
      }, (v857, v858) => "Day " + (v858 + 1));
    }
  } else {
    v853 = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  }
  v853.forEach(v859 => {
    const v860 = v859.replace(/ /g, "-");
    const v861 = document.querySelectorAll("#periods-" + v860 + " > div");
    const v862 = [];
    v861.forEach(v863 => {
      const v864 = v863.querySelector(".routine-subj");
      if (v864 && v864.value.trim() !== "") {
        let v865 = v864.value.trim();
        if (v850 === "Exam") {
          const v866 = v863.querySelector(".routine-date")?.value.trim() || "";
          if (v866 || v851) {
            v865 += " | " + v866 + " | " + v851;
          }
        }
        v862.push(v865);
      }
    });
    if (v862.length > 0 || v850 === "Class") {
      v852[v859] = v862;
    }
  });
  try {
    toast("Saving routine...", 10000);
    const v867 = document.getElementById("routine-term").value;
    const v868 = {
      class: v848,
      teacher_id: window.currentUser?.id,
      title: v849,
      routine_type: v850,
      term: v867,
      routine_data: v852,
      updated_at: new Date().toISOString()
    };
    let v869;
    const {
      data: v870
    } = await v1.from("routines").select("id").eq("class", v848).eq("routine_type", v850).eq("term", v867).limit(1).single();
    if (v870) {
      const {
        error: v871
      } = await v1.from("routines").update(v868).eq("id", v870.id);
      v869 = v871;
    } else {
      const {
        error: v872
      } = await v1.from("routines").insert(v868);
      v869 = v872;
    }
    if (v869) {
      throw v869;
    }
    try {
      await v1.from("notifications").insert({
        title: "New Routine: " + v849,
        body: "A new " + v850 + " routine has been published for " + v867 + ".",
        type: "routine",
        target_type: "class",
        target_value: v848
      });
    } catch (v873) {
      console.error("Routine notif err", v873);
    }
    toast("✅ Routine saved and sent to parents!");
    closeModal();
    await logActivity("Updated Routine", "Class: " + v848);
    window.switchView("routine");
  } catch (v874) {
    console.error("saveRoutine error", v874);
    toast("Error saving routine: " + v874.message);
  }
};
window.loadLeaveApplications = async function () {
  try {
    const v875 = window.currentUser?.id;
    const v876 = getTeacherAssignments();
    console.log("[Leave] userId:", v875, "| isAdmin:", v876.isAdmin);
    const {
      data: v877,
      error: v878
    } = await v1.from("leave_applications").select("id, student_id, parent_id, target_teacher_id, start_date, end_date, reason, status, created_at").order("created_at", {
      ascending: false
    });
    if (v878) {
      console.error("[Leave] DB error:", v878.code, v878.message);
      state.leaveApplications = [];
      return;
    }
    console.log("[Leave] Total rows returned from DB:", (v877 || []).length);
    if (v877 && v877.length > 0) {
      console.log("[Leave] First row target_teacher_id:", v877[0].target_teacher_id, "| My userId:", v875);
    }
    const v879 = (v877 || []).map(v880 => ({
      ...v880,
      students: state.students.find(v881 => String(v881.id) === String(v880.student_id)) || null,
      parentName: null
    }));
    if (v876.isAdmin) {
      state.leaveApplications = v879;
    } else if (v875) {
      state.leaveApplications = v879.filter(v882 => String(v882.target_teacher_id) === String(v875));
    } else {
      console.warn("[Leave] currentUser not ready");
      state.leaveApplications = [];
    }
    console.log("[Leave] Final count after filter:", state.leaveApplications.length);
  } catch (v883) {
    console.error("[Leave] Exception:", v883);
    state.leaveApplications = [];
  }
};
window.renderLeaveApps = function () {
  const v884 = document.getElementById("leave-apps-list");
  if (!v884) {
    return;
  }
  if (!state.leaveApplications || state.leaveApplications.length === 0) {
    v884.innerHTML = "\n            <div class=\"empty-state\">\n                <i data-lucide=\"file-check-2\" style=\"opacity:0.3; width:48px; height:48px; margin-bottom:1rem\"></i>\n                <p>No leave applications received yet.</p>\n            </div>";
    lucide.createIcons();
    return;
  }
  v884.innerHTML = state.leaveApplications.map(v885 => {
    const v886 = v885.students || {
      name: "Unknown",
      roll: "?",
      class: "?"
    };
    const v887 = v885.status === "Approved" ? "#10b981" : v885.status === "Rejected" ? "#ef4444" : "#f59e0b";
    const v888 = v885.status === "Pending";
    return "\n            <div class=\"card\" style=\"padding:1.25rem; margin-bottom:1rem; border-left: 4px solid " + v887 + "\">\n                <div style=\"display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.75rem;\">\n                    <div>\n                        <h3 style=\"font-size:1rem; margin-bottom:0.2rem;\">" + escapeHtml(v886.name) + "</h3>\n                        <p style=\"font-size:0.75rem; color:var(--text-muted); font-weight:700;\">Roll " + v886.roll + " &bull; " + v886.class + "</p>\n                    </div>\n                    <span style=\"background:" + v887 + "22; color:" + v887 + "; padding:0.25rem 0.6rem; border-radius:1rem; font-size:0.7rem; font-weight:800; text-transform:uppercase;\">" + v885.status + "</span>\n                </div>\n                \n                <div style=\"background:#f8fafc; padding:0.75rem; border-radius:0.5rem; margin-bottom:1rem;\">\n                    <p style=\"font-size:0.85rem; font-weight:700; margin-bottom:0.25rem;\">\n                        <i data-lucide=\"calendar\" style=\"width:12px; height:12px; vertical-align:middle; margin-right:4px;\"></i>\n                        " + v885.start_date + " to " + v885.end_date + "\n                    </p>\n                    <p style=\"font-size:0.85rem; line-height:1.4; color:var(--text-main);\">" + escapeHtml(v885.reason) + "</p>\n                </div>\n\n                <div style=\"display:flex; justify-content:space-between; align-items:center;\">\n                    <span style=\"font-size:0.7rem; color:var(--text-muted);\">By: " + escapeHtml(v885.parentName || "Parent") + "</span>\n                    <div style=\"display:flex; gap:0.5rem;\">\n                    " + (v888 ? "\n                        <button class=\"btn btn-secondary btn-sm\" style=\"color:#10b981; background:#dcfce7; border:none; padding:0.4rem 0.75rem;\" onclick=\"window.updateLeaveStatus('" + v885.id + "', 'Approved')\">Approve</button>\n                        <button class=\"btn btn-secondary btn-sm\" style=\"color:#ef4444; background:#fee2e2; border:none; padding:0.4rem 0.75rem;\" onclick=\"window.updateLeaveStatus('" + v885.id + "', 'Rejected')\">Reject</button>\n                    " : "") + "\n                    <button class=\"btn btn-secondary btn-sm\" style=\"color:#94a3b8; background:#f1f5f9; border:none; padding:0.4rem 0.6rem;\" onclick=\"window.deleteLeaveApp('" + v885.id + "')\" title=\"Delete\"><i data-lucide=\"trash-2\" style=\"width:14px;height:14px\"></i></button>\n                    </div>\n                </div>\n            </div>\n        ";
  }).join("");
  lucide.createIcons();
};
window.updateLeaveStatus = async function (v889, v890) {
  try {
    toast("Marking as " + v890 + "...");
    const {
      error: v891
    } = await v1.from("leave_applications").update({
      status: v890
    }).eq("id", v889);
    if (v891) {
      throw v891;
    }
    toast("✅ Application " + v890 + "!");
    await logActivity("Updated Leave App", "Status: " + v890);
    await window.loadLeaveApplications();
    window.renderLeaveApps();
  } catch (v892) {
    console.error("updateLeaveStatus error", v892);
    toast("Error updating application status");
  }
};
window.deleteLeaveApp = async function (v893) {
  if (!confirm("Delete this leave application? This cannot be undone.")) {
    return;
  }
  try {
    toast("Deleting...");
    const {
      error: v894
    } = await v1.from("leave_applications").delete().eq("id", v893);
    if (v894) {
      throw v894;
    }
    toast("✅ Application deleted.");
    await logActivity("Deleted Leave App", "ID: " + v893);
    await window.loadLeaveApplications();
    window.renderLeaveApps();
  } catch (v895) {
    console.error("deleteLeaveApp error", v895);
    toast("Error deleting application");
  }
};
window.updateLeaveStatusFromProfile = async function (v896, v897, v898) {
  try {
    toast("Marking as " + v897 + "...");
    const {
      error: v899
    } = await v1.from("leave_applications").update({
      status: v897
    }).eq("id", v896);
    if (v899) {
      throw v899;
    }
    toast("✅ Application " + v897 + "!");
    await logActivity("Updated Leave App", "Status: " + v897);
    await window.loadLeaveApplications();
    renderStudentDetail(v898);
  } catch (v900) {
    console.error("updateLeaveStatusFromProfile error", v900);
    toast("Error updating application status");
  }
};
let notifDebounceTimeout = null;
window.updateNotificationBadges = async function () {
  if (notifDebounceTimeout) {
    clearTimeout(notifDebounceTimeout);
  }
  notifDebounceTimeout = setTimeout(async () => {
    await executeUpdateNotificationBadges();
  }, 300);
};
async function executeUpdateNotificationBadges() {
  if (!window.currentUser) {
    return;
  }
  try {
    const v901 = window.currentUser?.id;
    const v902 = getTeacherAssignments();
    const {
      count: v903,
      error: v904
    } = await v1.from("messages").select("*", {
      count: "exact",
      head: true
    }).eq("recipient_id", v901).eq("is_read", false);
    if (!v904) {
      const v908 = document.getElementById("badge-messages");
      if (v908) {
        v908.textContent = v903 > 0 ? v903 > 9 ? "9+" : v903 : "";
        v908.style.display = v903 > 0 ? "block" : "none";
      }
    }
    let v905 = v1.from("leave_applications").select("*", {
      count: "exact",
      head: true
    }).eq("status", "Pending");
    if (!v902.isAdmin) {
      const v909 = v902.assignments.map(v911 => v911.className);
      const v910 = state.students.filter(v912 => v909.includes(v912.class)).map(v913 => v913.id);
      if (v910.length > 0) {
        v905 = v905.in("student_id", v910);
      } else {
        const v914 = document.getElementById("badge-leave");
        if (v914) {
          v914.style.display = "none";
        }
        return;
      }
    }
    const {
      count: v906,
      error: v907
    } = await v905;
    if (!v907) {
      const v915 = document.getElementById("badge-leave");
      if (v915) {
        v915.textContent = v906 > 0 ? v906 > 9 ? "9+" : v906 : "";
        v915.style.display = v906 > 0 ? "block" : "none";
      }
    }
  } catch (v916) {
    console.warn("updateNotificationBadges error", v916);
  }
}
window.initNotificationSubscription = function () {
  if (!ENABLE_REALTIME) {
    return;
  }
  if (state.notifChannel) {
    v1.removeChannel(state.notifChannel);
  }
  state.notifChannel = v1.channel("notification-updates").on("postgres_changes", {
    event: "INSERT",
    schema: "public",
    table: "messages"
  }, v917 => {
    const v918 = v917.new;
    const v919 = v918.recipient_id === window.currentUser?.id || v918.target_type === "school";
    if (v919) {
      toast("🔔 New Message: " + (v918.subject || "No Subject"));
    }
    window.updateNotificationBadges();
  }).on("postgres_changes", {
    event: "*",
    schema: "public",
    table: "messages"
  }, v920 => {
    if (v920.event !== "INSERT") {
      window.updateNotificationBadges();
    }
  }).on("postgres_changes", {
    event: "*",
    schema: "public",
    table: "leave_applications"
  }, v921 => {
    window.updateNotificationBadges();
  }).subscribe();
  window.updateNotificationBadges();
};
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (state.notifChannel) {
      v1.removeChannel(state.notifChannel);
      state.notifChannel = null;
    }
  } else if (window.currentUser) {
    window.initNotificationSubscription();
  }
});
window.onCasConfigurationChange = async function (v922, v923 = true) {
  const v924 = document.getElementById("cas-term-picker").value;
  const v925 = parseInt(document.getElementById("cas-week-picker").value);
  await window.fetchAndRenderWeeklyRubric(v922, v924, v925, v923);
};
window.selectRubricValue = function (v926, v927) {
  const v928 = v926.closest(".rubric-btn-group");
  v928.querySelectorAll(".r-btn").forEach(v929 => {
    v929.classList.remove("active");
    v929.style.background = "white";
    v929.style.color = "#475569";
    v929.style.borderColor = "#cbd5e1";
  });
  v926.classList.add("active");
  if (v927 === 1) {
    v926.style.background = "#dc2626";
    v926.style.color = "white";
    v926.style.borderColor = "#dc2626";
  } else if (v927 === 2) {
    v926.style.background = "#ea580c";
    v926.style.color = "white";
    v926.style.borderColor = "#ea580c";
  } else if (v927 === 3) {
    v926.style.background = "#eab308";
    v926.style.color = "white";
    v926.style.borderColor = "#eab308";
  } else if (v927 === 4) {
    v926.style.background = "#16a34a";
    v926.style.color = "white";
    v926.style.borderColor = "#16a34a";
  }
};
window.exportStudentTermCas = async function (v981) {
  const v982 = document.getElementById("cas-term-picker").value;
  const v983 = (window.state?.students || []).find(v984 => v984.id === v981);
  if (!v983) {
    return;
  }
  toast("Fetching CAS data for export...");
  try {
    const {
      data: v985,
      error: v986
    } = await v1.from("cas_weekly_logs").select("*").eq("student_id", v981).eq("term_id", v982).order("week_number", {
      ascending: true
    });
    if (v986) {
      throw v986;
    }
    if (!v985 || v985.length === 0) {
      toast("No CAS logs found for this term.");
      return;
    }
    const v987 = [];
    const v988 = [];
    Object.keys(window.CAS_CRITERIA).forEach(v992 => {
      window.CAS_CRITERIA[v992].forEach(v993 => {
        v988.push({
          id: v993.id,
          label: v992.toUpperCase() + ": " + v993.label
        });
      });
    });
    v985.forEach(v994 => {
      let v995 = {};
      if (v994.rubric_data) {
        try {
          const v997 = atob(v994.rubric_data);
          v995 = JSON.parse(v997);
        } catch (v998) {
          v995 = v994.rubric_data;
        }
      }
      const v996 = {
        Week: "Week " + v994.week_number
      };
      v988.forEach(v999 => {
        v996[v999.label] = v995[v999.id] || "—";
      });
      v987.push(v996);
    });
    const v989 = XLSX.utils.json_to_sheet(v987);
    const v990 = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(v990, v989, "CAS Rubrics");
    const v991 = "CAS_" + v983.name.replace(/\s+/g, "_") + "_" + v982.replace(/\s+/g, "_") + "_" + getLocalToday() + ".xlsx";
    await window.saveExcel(v990, v991);
  } catch (v1000) {
    console.error("exportStudentTermCas error", v1000);
    toast("Export failed: " + v1000.message);
  }
};
const originalLogout = window.logout;
window.logout = async function () {
  try {
    v1.removeAllChannels();
    state.notifChannel = null;
  } catch (v1001) {}
  if (typeof originalLogout === "function") {
    await originalLogout();
  } else {
    try {
      await Promise.race([v1.auth.signOut(), new Promise(v1002 => setTimeout(v1002, 1500))]).catch(v1003 => console.warn("Background sign out error", v1003));
    } catch (v1004) {}
    window.location.href = "login.html";
  }
};
window.openAIReportModal = async function (v1005) {
  const v1006 = state.students.find(v1007 => v1007.id === v1005);
  if (!v1006) {
    return;
  }
  const savedOverride = (() => { try { return localStorage.getItem("gemini_key_override") || ""; } catch(e) { return ""; } })();
  const keyWarningHtml = `
      <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:1rem; margin-bottom:1rem; text-align:left;">
        <div style="font-weight:800; color:#166534; margin-bottom:0.5rem; display:flex; align-items:center; font-size:0.85rem;">
          <i data-lucide="key" style="width:16px; height:16px; margin-right:6px;"></i> Free Gemini API Integration
        </div>
        <div style="color:#15803d; font-size:0.75rem; margin-bottom:0.75rem; line-height:1.4;">
          To generate AI reports, please integrate a free Gemini API key. Get your free key instantly at 
          <a href="https://aistudio.google.com/apikey" target="_blank" style="color:#16a34a; font-weight:700; text-decoration:underline;">Google AI Studio</a>.
        </div>
        <input id="ai-key-override" class="form-input" type="password" placeholder="Paste your free Gemini API key here..." value="${savedOverride}" style="margin-top:0.25rem; font-size:0.85rem; border-color:#86efac; background:#fff;" />
      </div>`;
  openModal(`
    <div class="modal-handle"></div>
    <div style="text-align:center; margin-bottom:1rem;">
        <i data-lucide="bot" style="width:48px; height:48px; color:#10b981; margin-bottom:0.5rem;"></i>
        <h2 style="color:var(--primary); margin-bottom:0.25rem;">मासिक / त्रैमासिक प्रतिवेदन</h2>
        <p style="font-size:0.85rem; color:var(--text-muted);">Generate performance report for ${escapeHtml(v1006.name)} in Nepali</p>
    </div>
    ${keyWarningHtml}
    <div class="form-group">
        <label class="form-label">Report Type</label>
        <select id="ai-report-type" class="form-input">
            <option value="monthly">मासिक प्रतिवेदन (Monthly)</option>
            <option value="trimonthly">त्रैमासिक प्रतिवेदन (Quarterly)</option>
        </select>
    </div>
    <button id="btn-gen-ai" class="btn btn-primary btn-block" onclick="window.generateAIReport('${v1005}')">Generate with Gemini AI</button>
    
    <div id="ai-report-output" style="display:none; margin-top:1.5rem;">
        <h3 style="font-size:0.9rem; margin-bottom:0.5rem; color:var(--text-main);">Generated Pratibedan:</h3>
        <div id="ai-report-content" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:1rem; font-size:0.85rem; line-height:1.6; white-space:pre-wrap; max-height:300px; overflow-y:auto; margin-bottom:1rem; text-align:left;"></div>
        <button class="btn btn-secondary btn-block" onclick="window.saveAIReport('${v1005}')" id="btn-save-ai">Save Report to Database</button>
    </div>
  `);
  lucide.createIcons();
};
let currentGeminiKeyIndex = 0;
function getActiveGeminiKey() {
  if (!GEMINI_API_KEY) return "";
  const keys = GEMINI_API_KEY.split(",").map(k => k.trim()).filter(k => k !== "");
  if (keys.length === 0) return "";
  return keys[currentGeminiKeyIndex % keys.length];
}
function rotateGeminiKey() {
  if (!GEMINI_API_KEY) return;
  const keys = GEMINI_API_KEY.split(",").map(k => k.trim()).filter(k => k !== "");
  if (keys.length > 1) {
    currentGeminiKeyIndex = (currentGeminiKeyIndex + 1) % keys.length;
    console.log("Rotated Gemini API Key. New active index:", currentGeminiKeyIndex);
  }
}

window.generateAIReport = async function (v1008) {
  const v1009 = document.getElementById("ai-report-type").value;
  const v1010 = document.getElementById("btn-gen-ai");
  const v1011 = document.getElementById("ai-report-output");
  const v1012 = document.getElementById("ai-report-content");
  v1010.disabled = true;
  v1010.innerHTML = "<div class=\"spinner\" style=\"width:16px; height:16px; border-width:2px; margin-right:8px; display:inline-block;\"></div> Analyzing...";
  v1011.style.display = "none";
  try {
    const v1013 = state.students.find(v1030 => v1030.id === v1008);
    const v1014 = state.fullStudentAttendance || [];
    let v1015 = 0;
    let v1016 = 0;
    let v1017 = 0;
    v1014.forEach(v1031 => {
      if (v1031.status === "P") {
        v1015++;
      } else if (v1031.status === "A") {
        v1016++;
      } else if (v1031.status === "L") {
        v1017++;
      }
    });
    const [marksResult, reportsResult, hwResult] = await Promise.all([
      v1.from("marks").select("*").eq("student_id", v1008).order("created_at", { ascending: false }).limit(20),
      v1.from("ai_reports").select("*").eq("student_id", v1008).order("created_at", { ascending: false }).limit(2),
      v1.from("hw_status").select("status, homework(subject)").eq("student_id", v1008)
    ]);
    const v1019 = marksResult.data;
    const v1021 = reportsResult.data;
    const v1025 = hwResult.data;
    let v1018 = "No recent marks available.";
    if (v1019 && v1019.length > 0) {
      v1018 = v1019.map(v1032 => v1032.subject + ": " + (v1032.theory_marks || 0) + " Theory, " + (v1032.practical_marks || 0) + " Practical (" + v1032.term + ")").join("\\n");
    }
    let v1020 = "No previous reports.";
    if (v1021 && v1021.length > 0) {
      v1020 = v1021.map(v1033 => "[Past " + v1033.report_type + " report]: " + v1033.report_content.substring(0, 200) + "...").join("\\n");
    }
    
    const subjectHwStats = {};
    if (v1025) {
      v1025.forEach(v1034 => {
        const subj = v1034.homework?.subject || "General";
        if (!subjectHwStats[subj]) {
          subjectHwStats[subj] = { completed: 0, incomplete: 0, late: 0, total: 0 };
        }
        subjectHwStats[subj].total++;
        if (v1034.status === "Completed" || v1034.status === "Done") {
          subjectHwStats[subj].completed++;
        } else if (v1034.status === "Incomplete") {
          subjectHwStats[subj].incomplete++;
        } else if (v1034.status === "Late" || v1034.status === "Not Done") {
          subjectHwStats[subj].late++;
        }
      });
    }

    let hwDetailsStr = "";
    for (const [subj, stats] of Object.entries(subjectHwStats)) {
      hwDetailsStr += `- ${subj}: ${stats.completed} Completed, ${stats.incomplete} Incomplete, ${stats.late} Late (Out of ${stats.total} total homeworks)\n`;
    }
    if (!hwDetailsStr) hwDetailsStr = "No homework records found.";

    let monthlyAttendanceStr = "";
    const monthlyStats = state.studentStats?.monthly || {};
    for (const [mKey, stats] of Object.entries(monthlyStats)) {
      monthlyAttendanceStr += `- ${stats.label}: ${stats.p} Present, ${stats.a} Absent, ${stats.l} Late\n`;
    }
    if (!monthlyAttendanceStr) monthlyAttendanceStr = "No monthly attendance records found.";

    const v1026 = "You are an expert homeroom teacher's AI assistant at Holy Garden English Secondary School, Byasi, Bhaktapur-2, Nepal. Generate a professional " + v1009 + " performance report (मासिक / त्रैमासिक प्रतिवेदन) for student " + v1013.name + " (Class: " + v1013.class + ") of Holy Garden English Secondary School, Byasi, Bhaktapur-2, Nepal.\n\n" +
      "Data:\n" +
      "- Monthly Attendance Breakdown:\n" + monthlyAttendanceStr + "\n" +
      "- Subject-wise Homework Tracking:\n" + hwDetailsStr + "\n" +
      "- Exam Marks Analysis:\n" + v1018 + "\n\n" +
      "Past contextual reports:\n" + v1020 + "\n\n" +
      "Instructions:\n" +
      "Generate a comprehensive report suitable to be sent to parents. The report MUST include:\n" +
      "1. Separate analysis of monthly attendance (evaluating regularity and behavior).\n" +
      "2. Separate analysis of subject-wise homework completion rates (identifying subjects where they perform well vs need improvement).\n" +
      "3. Exam marks analysis (highlighting strengths and specific subject weaknesses based on test scores).\n" +
      "4. Concrete suggestions/recommendations (actionable advice for the student to improve their academic performance).\n\n" +
      "Tone should be professional, encouraging, and constructive. Return pure text without any markdown bolding symbols like **. The report MUST be written entirely in the Nepali language.";

    let attempts = 0;
    const maxAttempts = 5;
    let success = false;
    let v1029 = "";

    // Allow user-entered key override from modal input
    const keyOverrideEl = document.getElementById("ai-key-override");
    const keyOverride = keyOverrideEl ? keyOverrideEl.value.trim() : "";
    if (keyOverride) {
      // Save to localStorage so it persists across opens
      try { localStorage.setItem("gemini_key_override", keyOverride); } catch(e) {}
    }
    // Also try previously saved override
    const savedOverride = (() => { try { return localStorage.getItem("gemini_key_override") || ""; } catch(e) { return ""; } })();

    function resolveKey() {
      const override = keyOverrideEl?.value?.trim() || savedOverride;
      if (override && override.length > 10) return override;
      return getActiveGeminiKey();
    }

    // Models to try in order - fallback chain
    const GEMINI_MODELS = [
      "gemini-2.0-flash",
      "gemini-1.5-flash",
      "gemini-1.5-flash-8b",
      "gemini-1.5-pro"
    ];
    let modelIndex = 0;

    // AQ. keys are OAuth-style and need Bearer auth; AIza keys use ?key= param
    function buildRequest(key, model, prompt) {
      const isOAuthKey = key.startsWith("AQ.");
      const url = isOAuthKey
        ? `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
        : `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
      const headers = { "Content-Type": "application/json" };
      if (isOAuthKey) headers["Authorization"] = "Bearer " + key;
      else headers["x-goog-api-key"] = key;
      return { url, headers };
    }

    while (attempts < maxAttempts && !success) {
      const activeKey = resolveKey();
      if (!activeKey || activeKey.length < 10) {
        throw new Error("No API key set. Please paste your Gemini API key in the field above.");
      }

      const currentModel = GEMINI_MODELS[modelIndex % GEMINI_MODELS.length];
      const { url, headers } = buildRequest(activeKey, currentModel, v1026);
      headers["Content-Type"] = "application/json";

      console.log(`Attempt ${attempts + 1}: model=${currentModel}, keyPrefix=${activeKey.substring(0,6)}...`);

      const v1027 = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          contents: [{ parts: [{ text: v1026 }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
        })
      });

      if (v1027.ok) {
        const v1028 = await v1027.json();
        v1029 = v1028?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (!v1029) throw new Error("AI returned an empty response. Please try again.");
        success = true;
      } else {
        const errText = await v1027.text();
        attempts++;
        console.warn(`API error ${v1027.status} (${currentModel}): ${errText.substring(0, 200)}`);

        if (v1027.status === 429) {
          // Rate limit — rotate key and try next model
          rotateGeminiKey();
          modelIndex++;
          if (attempts < maxAttempts) {
            const waitTime = Math.min(Math.pow(2, attempts) * 800 + Math.random() * 500, 10000);
            console.log(`Rate limited. Trying model ${GEMINI_MODELS[modelIndex % GEMINI_MODELS.length]} in ${Math.round(waitTime)}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        } else if (v1027.status === 404) {
          // Model not found — try next model
          modelIndex++;
          console.warn(`Model ${currentModel} not available, trying next...`);
          if (modelIndex >= GEMINI_MODELS.length) {
            throw new Error("None of the Gemini models are available for your API key. Please check your key at aistudio.google.com");
          }
        } else if (v1027.status === 401 || v1027.status === 403) {
          throw new Error(`API key rejected (${v1027.status}). Please get a valid key from aistudio.google.com`);
        } else if (v1027.status === 400) {
          throw new Error(`API Request Error (400). Please ensure your API key is correct.`);
        } else {
          throw new Error(`API Error (${v1027.status}). Please try again later.`);
        }
      }
    }

    if (!success) {
      throw new Error("All Gemini models rate-limited. Please wait 1 minute and try again.");
    }

    v1012.innerText = v1029;
    v1011.style.display = "block";
    window.currentGeneratedAIReport = v1029;
    window.currentGeneratedAIReportType = v1009;
  } catch (v1036) {
    toast("Failed to generate report: " + v1036.message, 4000);
  } finally {
    v1010.disabled = false;
    v1010.innerHTML = "Generate with Gemini AI";
  }
};
window.saveAIReport = async function (v1037) {
  if (!window.currentGeneratedAIReport) {
    return;
  }
  try {
    toast("Saving report...");
    document.getElementById("btn-save-ai").disabled = true;
    const {
      error: v1038
    } = await v1.from("ai_reports").insert({
      student_id: v1037,
      teacher_id: window.currentUser?.id,
      report_type: window.currentGeneratedAIReportType,
      report_content: window.currentGeneratedAIReport
    });
    if (v1038) {
      throw v1038;
    }
    const {
      error: v1039
    } = await v1.from("messages").insert({
      sender_id: window.currentUser?.id || null,
      target_type: "individual",
      target_value: v1037,
      subject: window.currentGeneratedAIReportType + " Progress Report",
      body: window.currentGeneratedAIReport
    });
    if (v1039) {
      console.warn("Failed to send to parent portal", v1039);
    }
    toast("✅ Report saved successfully and sent to parent portal!");
    closeModal();
  } catch (v1040) {
    toast("Error saving report: " + v1040.message);
    document.getElementById("btn-save-ai").disabled = false;
  }
};
window.initTeacherCASData = function () {
  const v1041 = document.getElementById("cas-class");
  if (v1041) {
    const v1042 = window.getTeacherAssignments();
    const v1043 = v1042.isAdmin ? window.CLASS_OPTIONS : v1042.assignments.map(v1045 => v1045.className);
    const v1044 = v1043.filter(v1046 => v1046.match(/grade\s*[1-5]$/i) || v1046.match(/^class\s*[1-5]$/i) || ["PG", "Nursery", "LKG", "UKG"].includes(v1046));
    v1041.innerHTML = "<option value=\"\">-- Class --</option>" + v1044.map(v1047 => "<option value=\"" + escapeHtml(v1047) + "\">" + escapeHtml(v1047) + "</option>").join("");
  }
};
window.onTeacherCasClassChange = function () {
  const v1048 = document.getElementById("cas-class")?.value;
  const v1049 = document.getElementById("cas-student");
  const v1050 = document.getElementById("cas-subject");
  const v1051 = document.getElementById("cas-content-wrap");
  if (!v1048) {
    if (v1049) {
      v1049.innerHTML = "<option value=\"\">-- Student --</option>";
    }
    if (v1050) {
      v1050.innerHTML = "<option value=\"\">-- Subject --</option>";
    }
    if (v1051) {
      v1051.innerHTML = "<div style=\"text-align:center; padding:2rem; color:var(--text-muted); font-size:0.85rem;\">Please select Class, Student, Subject, and Theme to load evaluations.</div>";
    }
    return;
  }
  const v1052 = (window.state.students || []).filter(v1053 => v1053.class === v1048);
  if (v1049) {
    v1049.innerHTML = "<option value=\"\">-- Student --</option>" + v1052.map(v1054 => "<option value=\"" + v1054.id + "\">" + escapeHtml(v1054.name) + " (Roll: " + (v1054.roll || "-") + ")</option>").join("");
  }
  if (window.CAS_CONFIG && window.CAS_CONFIG.subjects) {
    const v1055 = window.getTeacherAssignments();
    const v1048NormNum = v1048.match(/\d+/)?.[0] || "";
    
    let v1056 = null;
    let v1056IsHomeroom = true;
    
    if (!v1055.isAdmin) {
        const matchingAssignments = v1055.assignments.filter(v1058 => {
            return v1058.className === v1048 ||
              (v1048NormNum && v1058.className.match(/\d+/)?.[0] === v1048NormNum);
        });
        v1056 = [...new Set(matchingAssignments.flatMap(a => a.subjects || []))].filter(s => s && s.trim() !== "");
        v1056IsHomeroom = matchingAssignments.some(a => a.isHomeroom === true);
    }
    
    let v1057 = Object.keys(window.CAS_CONFIG.subjects);
    v1057 = v1057.filter(v1059 => {
      if (v1056 !== null) {
        const v1061 = [v1059];
        if (v1059 === "हाम्रो सेरोफेरो" || v1059 === "Our Surroundings") {
          v1061.push(
            "Social", "Social Studies", "Social Studies & Human Value Education",
            "Hamro Serofero", "Hamaaro Serofero", "सेरोफेरो",
            "Mero Serofero",
            "Environment", "EVS", "Environmental Study"
          );
        }
        if (v1059 === "नेपाली") {
          v1061.push("Nepali", "Byakaran", "नेपाली व्याकरण");
        }
        if (v1059 === "सामाजिक अध्ययन") {
          v1061.push("Social", "Social Studies", "Social Studies & Human Value Education", "Hamro Serofero");
        }
        if (v1059 === "Science & Technology" || v1059 === "Science and Technology") {
          v1061.push("Science", "Science & Tech", "Science and Tech", "Sci", "Natural Science");
        }
        if (v1059 === "Health, Physical & Creative Arts" || v1059 === "Health, Physical and Creative Arts") {
          v1061.push(
            "Health", "HPCA", "Physical Education", "PE",
            "Creative Arts", "Creative Art",
            "Drawing", "Art", "Painting",
            "Health Physical & Creative", "Health Physical and Creative",
            "Health, Physical & Creative", "Health, Physical and Creative"
          );
        }
        if (v1059 === "Mathematics") {
          v1061.push("Math", "Maths", "Compulsory Math", "C. Math");
        }
        if (v1059 === "Local Subject") {
          v1061.push("Local Curriculum", "Local", "LC", "Mother Tongue", "Matribhasha", "मातृभाषा");
        }
        const v1062 = v1061.some(v1063 => {
          const val = v1063.toLowerCase();
          return v1056.some(assigned => {
            const ass = assigned.toLowerCase();
            return ass === val;
          });
        });
        if (!v1062) {
          return false;
        }
      }
      const v1060 = window.CAS_CONFIG.subjects[v1059];
      if (v1060.classes && v1060.classes.length > 0) {
        const v1064 = v1048.replace(/grade/i, "Class").trim();
        return v1060.classes.includes(v1064);
      }
      return true;
    });
    if (v1050) {
      v1050.innerHTML = "<option value=\"\">-- Subject --</option>" + v1057.map(v1065 => "<option value=\"" + escapeHtml(v1065) + "\">" + escapeHtml(v1065) + "</option>").join("");
    }
  }
};
window.onTeacherCasSubjectChange = function () {
  const v1066 = document.getElementById("cas-subject")?.value;
  const v1067 = document.getElementById("cas-theme");
  const v1068 = document.getElementById("cas-class")?.value;
  if (!v1066 || !window.CAS_CONFIG || !window.CAS_CONFIG.subjects[v1066]) {
    if (v1067) {
      v1067.innerHTML = "<option value=\"\">-- Theme --</option>";
    }
    return;
  }
  const v1069 = window.getCASSubjectConfig(v1066, v1068 || "");
  if (v1067 && v1069 && v1069.themes) {
    v1067.innerHTML = "<option value=\"\">-- Theme --</option>" + v1069.themes.map(v1070 => "<option value=\"" + escapeHtml(v1070) + "\">" + escapeHtml(v1070) + "</option>").join("");
  }
  window.loadTeacherCASData();
};
window.loadTeacherCASData = async function () {
  const v1071 = document.getElementById("cas-student")?.value;
  const v1072 = document.getElementById("cas-subject")?.value;
  const v1073 = document.getElementById("cas-theme")?.value;
  const v1074 = document.getElementById("cas-content-wrap");
  const v1075 = document.getElementById("cas-class")?.value;
  const v1076 = document.getElementById("cas-term")?.value || "First Term";
  if (!v1074) {
    return;
  }
  
  const mode = window._currentTeacherCasMode || 'cdc';
  
  if (!v1071 || !v1075) {
      v1074.innerHTML = "<div style=\"text-align:center; padding:2rem; color:var(--text-muted); font-size:0.85rem;\">Please select Class and Student to load evaluations.</div>";
      return;
  }

  if (mode === 'weekly') {
      v1074.innerHTML = window.window.views.casWeeklyRubricPanel(v1071, 1, v1076, true);
      if (window.fetchAndRenderWeeklyRubric) {
          window.fetchAndRenderWeeklyRubric(v1071, v1076, 1, true);
      }
      return;
  }

  // CDC Mode logic
  if (!v1072 || !v1073) {
    v1074.innerHTML = "<div style=\"text-align:center; padding:2rem; color:var(--text-muted); font-size:0.85rem;\">Please select Subject and Theme to load evaluations.</div>";
    return;
  }
  const v1077 = v1075.match(/grade\s*[1-3]$/i) || v1075.match(/^class\s*[1-3]$/i) || ["PG", "Nursery", "LKG", "UKG"].includes(v1075) ? "1-3" : "4-5";
  const v1078 = window.getCASSubjectConfig(v1072, v1075);
  if (!v1078) {
    return;
  }
  v1074.innerHTML = "<div style=\"text-align:center; padding:2rem;\"><div class=\"spinner\" style=\"margin:0 auto\"></div><p style=\"color:var(--text-muted);margin-top:0.5rem;\">Loading CAS...</p></div>";
  try {
    const {
      data: v1079,
      error: v1080
    } = await v1.from("cas_learning_outcomes").select("*").eq("subject", v1072).eq("class_level", v1077).eq("theme", v1073);
    if (v1080) {
      throw v1080;
    }
    let v1081 = v1079 || [];
    
    // Grade-based indicator filtering (Class 1, 2, 3, 4, 5 client-side prefix matching)
    const gradeMatch = v1075.match(/\d+/);
    const gradeNum = gradeMatch ? gradeMatch[0] : null;
    if (gradeNum) {
      v1081 = v1081.filter(item => {
        const parts = item.indicator_code.split('-');
        if (parts.length >= 2) {
          return parts[1] === gradeNum;
        }
        return true;
      });
    }

    if (v1081.length === 0) {
      v1081 = v1078.criteria
        .filter(c => !c.theme || c.theme === v1073)
        .map((v1091, v1092) => ({
          id: "fallback-" + v1092,
          indicator_code: v1091.code || "IND-" + (v1092 + 1),
          description: v1091.desc || v1091
        }));
    }
    const {
      data: v1082,
      error: v1083
    } = await v1.from("cas_student_portfolio_log").select("*").eq("student_id", v1071).eq("term_id", v1076);
    if (v1083) {
      throw v1083;
    }
    const v1084 = v1082 || [];
    
    // Read Student Portfolio (Karyasanchayika) metadata logs from logs array
    const portfolioMeta = v1084.find(log => log.outcome_id === "portfolio-metadata-" + v1073) || {};
    const representativeWorks = portfolioMeta.phase1_method || "";
    const parentInformed = portfolioMeta.phase1_rating === 1;
    const parentInformedDate = portfolioMeta.phase2_date ? portfolioMeta.phase2_date.substring(0, 10) : "";

    // Generate suggested tasks & specific rubrics legends helper panels
    let helpPanelHTML = "";
    if (window.CAS_SUGGESTED_TASKS && window.CAS_SUGGESTED_TASKS[v1075] && window.CAS_SUGGESTED_TASKS[v1075][v1072] && window.CAS_SUGGESTED_TASKS[v1075][v1072][v1073]) {
      const tasks = window.CAS_SUGGESTED_TASKS[v1075][v1072][v1073];
      helpPanelHTML = `
        <div class="card" style="margin-bottom:1.25rem; background:#f8fafc; border-left:4px solid var(--primary); padding:1rem; border-radius:8px;">
          <h4 style="margin:0 0 0.5rem 0; color:var(--primary); font-size:0.85rem; font-weight:800; display:flex; align-items:center; gap:0.4rem;">
            <i data-lucide="list-checks" style="width:16px; height:16px;"></i> Suggested Tasks & Materials (निर्देशन तथा सामग्री)
          </h4>
          <ol style="margin:0; padding-left:1.2rem; font-size:0.78rem; color:var(--text-main); line-height:1.5;">
            ${tasks.map(t => `<li style="margin-bottom:0.35rem;">${escapeHtml(t)}</li>`).join("")}
          </ol>
        </div>
      `;
    } else if (window.CAS_SPECIFIC_RUBRICS && window.CAS_SPECIFIC_RUBRICS[v1075] && window.CAS_SPECIFIC_RUBRICS[v1075][v1072]) {
      const subRubrics = window.CAS_SPECIFIC_RUBRICS[v1075][v1072];
      let matchedSkillKey = null;
      for (const key in subRubrics) {
        const cleanKey = key.split("(")[0].trim();
        if (v1073.includes(cleanKey) || cleanKey.includes(v1073) || (v1072 === "नेपाली" && (
            (cleanKey.includes("श्रुतिकथन") && v1073.includes("परिवार")) ||
            (cleanKey.includes("शब्द भण्डार") && v1073.includes("दैनिक")) ||
            (cleanKey.includes("पठन अभ्यास") && v1073.includes("समुदाय")) ||
            (cleanKey.includes("लेखन अभ्यास") && v1073.includes("विद्यालय"))
        ))) {
          matchedSkillKey = key;
          break;
        }
      }
      if (matchedSkillKey) {
        const levels = subRubrics[matchedSkillKey];
        helpPanelHTML = `
          <div class="card" style="margin-bottom:1.25rem; background:#f8fafc; border-left:4px solid #10b981; padding:1rem; border-radius:8px;">
            <h4 style="margin:0 0 0.5rem 0; color:#059669; font-size:0.85rem; font-weight:800; display:flex; align-items:center; gap:0.4rem;">
              <i data-lucide="award" style="width:16px; height:16px;"></i> Specific Rubric: ${escapeHtml(matchedSkillKey)}
            </h4>
            <div style="display:flex; flex-direction:column; gap:0.35rem; font-size:0.75rem; line-height:1.4;">
              <div><strong style="color:#047857;">Level 4 (Advanced):</strong> ${escapeHtml(levels["4"])}</div>
              <div><strong style="color:#b45309;">Level 3 (Proficient):</strong> ${escapeHtml(levels["3"])}</div>
              <div><strong style="color:#1d4ed8;">Level 2 (Basic):</strong> ${escapeHtml(levels["2"])}</div>
              <div><strong style="color:#b91c1c;">Level 1 (Below Basic):</strong> ${escapeHtml(levels["1"])}</div>
            </div>
          </div>
        `;
      } else {
        helpPanelHTML = `
          <div class="card" style="margin-bottom:1.25rem; background:#f8fafc; border-left:4px solid #10b981; padding:1rem; border-radius:8px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem; cursor:pointer;" onclick="const el = document.getElementById('specific-rubrics-details'); el.style.display = el.style.display === 'none' ? 'block' : 'none';">
              <h4 style="margin:0; color:#059669; font-size:0.85rem; font-weight:800; display:flex; align-items:center; gap:0.4rem;">
                <i data-lucide="award" style="width:16px; height:16px;"></i> Specific Rubrics Reference
              </h4>
              <span style="font-size:0.7rem; color:var(--text-muted); font-weight:700;">Show/Hide</span>
            </div>
            <div id="specific-rubrics-details" style="display:none; font-size:0.72rem; line-height:1.4; margin-top:0.5rem;">
              ${Object.keys(subRubrics).map(skill => `
                <div style="margin-bottom:0.75rem; border-top:1px solid #e2e8f0; padding-top:0.5rem;">
                  <strong style="color:#059669; display:block; margin-bottom:0.25rem;">${escapeHtml(skill)}</strong>
                  <div style="padding-left:0.5rem;">
                    <div><strong>4:</strong> ${escapeHtml(subRubrics[skill]["4"])}</div>
                    <div><strong>3:</strong> ${escapeHtml(subRubrics[skill]["3"])}</div>
                    <div><strong>2:</strong> ${escapeHtml(subRubrics[skill]["2"])}</div>
                    <div><strong>1:</strong> ${escapeHtml(subRubrics[skill]["1"])}</div>
                  </div>
                </div>
              `).join("")}
            </div>
          </div>
        `;
      }
    } else if (v1072 === "Local Subject") {
      helpPanelHTML = `
        <div class="card" style="margin-bottom:1.25rem; background:#fef3c7; border-left:4px solid #d97706; padding:1rem; border-radius:8px;">
          <h4 style="margin:0 0 0.5rem 0; color:#b45309; font-size:0.85rem; font-weight:800; display:flex; align-items:center; gap:0.4rem;">
            <i data-lucide="info" style="width:16px; height:16px;"></i> स्थानीय विषय (मातृभाषा) मूल्याङ्कन निर्देशिका
          </h4>
          <p style="margin:0; font-size:0.75rem; color:#78350f; line-height:1.5;">
            राष्ट्रिय पाठ्यक्रम प्रारूपअनुसार स्थानीय विषय वा मातृभाषाको लागि राष्ट्रिय स्तरबाट हुबहु थिम वा मापदण्डहरू तोकिएको छैन। विद्यालय वा स्थानीय तह आफैँले पाठ्यक्रम विकास गरी मूल्याङ्कन प्रक्रिया (साधन तथा मापदण्ड) निर्माण र अभिलेखीकरण गर्नुपर्ने व्यवस्था छ। सिकाइ स्तर रेटिङ १ देखि ४ र कार्यसञ्चयिका व्यवस्थापन अन्य राष्ट्रिय विषय सरह निरन्तर रूपमा गर्नुपर्नेछ।
          </p>
        </div>
      `;
    }

    let v1085 = "<div class=\"card\" style=\"padding:1.5rem; overflow-x:auto;\">";
    let v1086 = 0;
    let v1087 = 0;
    const v1103 = ["Classroom Participation", "Oral Work", "Written Work", "Project/Practical Work", "Observation"];
    if (v1077 === "1-3") {
      v1085 += "<h3 style=\"margin-top:0; color:var(--primary); font-size:1rem; font-weight:800;\">Class 1-3 Continuous Monitoring</h3>";
      v1085 += "<table style=\"width:100%; border-collapse:collapse; text-align:left; font-size:0.9rem;\">";
      v1085 += "<thead><tr style=\"border-bottom:2px solid var(--border);\"><th style=\"padding:0.75rem 0.5rem;\">Learning Outcome / Indicator</th><th style=\"padding:0.75rem 0.5rem; width:220px;\">Regular Rating (1 - 4) & Method</th><th style=\"padding:0.75rem 0.5rem; width:220px;\">After Additional Support (3 - 4)</th></tr></thead><tbody>";
      v1081.forEach(v1093 => {
        const v1094 = v1084.find(v1104 => v1104.outcome_id === v1093.id || v1093.id.startsWith && v1093.id.startsWith("fallback-") && v1104.outcome_id === v1093.id);
        const v1095 = v1094 ? v1094.phase1_rating : "";
        const v1096 = v1094 ? v1094.phase1_method : "Observation";
        const v1097 = v1094 ? v1094.phase2_rating : "";
        const v1098 = v1094 ? v1094.phase2_method : "Oral Work";
        const v1099 = v1094 ? v1094.remedial_status : "";
        const v1100 = v1095 ? parseInt(v1095, 10) : null;
        const v1101 = v1097 ? parseInt(v1097, 10) : null;
        let v1102 = "";
        if (v1101) {
          v1102 = v1101;
        } else if (v1100 && v1100 >= 3) {
          v1102 = v1100;
        }
        if (v1102) {
          v1086 += parseInt(v1102, 10);
          v1087++;
        }
        v1085 += "<tr style=\"border-bottom:1px solid #f1f5f9;\">\n                    <td style=\"padding:0.75rem 0.5rem;\">\n                        <span style=\"font-weight:700; color:var(--primary); font-size:0.75rem; display:block;\">[" + v1093.indicator_code + "]</span>\n                        <span style=\"color:var(--text-main); font-weight:500; white-space: pre-line; display: block; line-height: 1.5; margin-top: 0.25rem;\">" + escapeHtml(v1093.description) + "</span>\n                        " + (v1099 === "Requires Support" ? "<span class=\"badge badge-a\" style=\"margin-left:0.5rem; background:#fee2e2; color:#dc2626; padding:2px 6px; border-radius:4px; font-size:0.7rem; font-weight:700;\">Requires Support</span>" : "") + "\n                    </td>\n                    <td style=\"padding:0.75rem 0.5rem;\">\n                        <div style=\"display:flex; gap:0.25rem; margin-bottom:0.35rem;\">\n                            " + [1, 2, 3, 4].map(v1105 => "\n                                <button class=\"btn btn-sm " + (v1100 === v1105 ? "btn-primary" : "btn-ghost") + "\" style=\"flex:1; padding:0.25rem; font-weight:700;\" onclick=\"window.saveTeacherCASRating('" + v1071 + "', '" + v1093.id + "', 1, " + v1105 + ", document.getElementById('method-p1-" + v1093.id + "').value)\">" + v1105 + "</button>\n                            ").join("") + "\n                        </div>\n                        <select id=\"method-p1-" + v1093.id + "\" class=\"form-input\" style=\"padding:0.25rem; font-size:0.75rem; height:auto;\" onchange=\"window.saveTeacherCASRating('" + v1071 + "', '" + v1093.id + "', 1, " + (v1100 || "null") + ", this.value)\">\n                            " + v1103.map(v1106 => "<option value=\"" + v1106 + "\" " + (v1096 === v1106 ? "selected" : "") + ">" + v1106 + "</option>").join("") + "\n                        </select>\n                    </td>\n                    <td style=\"padding:0.75rem 0.5rem;\">\n                        " + (v1100 === 1 || v1100 === 2 ? "\n                            <div style=\"display:flex; gap:0.25rem; margin-bottom:0.35rem;\">\n                                " + [3, 4].map(v1107 => "\n                                    <button class=\"btn btn-sm " + (v1101 === v1107 ? "btn-primary" : "btn-ghost") + "\" style=\"flex:1; padding:0.25rem; font-weight:700;\" onclick=\"window.saveTeacherCASRating('" + v1071 + "', '" + v1093.id + "', 2, " + v1107 + ", document.getElementById('method-p2-" + v1093.id + "').value)\">" + v1107 + "</button>\n                                ").join("") + "\n                            </div>\n                            <select id=\"method-p2-" + v1093.id + "\" class=\"form-input\" style=\"padding:0.25rem; font-size:0.75rem; height:auto;\" onchange=\"window.saveTeacherCASRating('" + v1071 + "', '" + v1093.id + "', 2, " + (v1101 || "null") + ", this.value)\">\n                                " + v1103.map(v1108 => "<option value=\"" + v1108 + "\" " + (v1098 === v1108 ? "selected" : "") + ">" + v1108 + "</option>").join("") + "\n                            </select>\n                        " : "<span style=\"color:var(--text-muted); font-size:0.8rem; font-style:italic;\">No support needed</span>") + "\n                    </td>\n                </tr>";
      });
      v1085 += "</tbody></table>";
    } else {
      v1085 += "<h3 style=\"margin-top:0; color:var(--primary); font-size:1rem; font-weight:800;\">Class 4-5 Continuous Evaluation (2083)</h3>";
      v1085 += "<table style=\"width:100%; border-collapse:collapse; text-align:left; font-size:0.9rem;\">";
      v1085 += "<thead><tr style=\"border-bottom:2px solid var(--border);\"><th style=\"padding:0.75rem 0.5rem;\">Learning Outcome / Indicator</th><th style=\"padding:0.75rem 0.5rem; width:220px;\">Regular Evaluation (नियमित) & Method</th><th style=\"padding:0.75rem 0.5rem; width:220px;\">Support Evaluation (थप सहायता)</th></tr></thead><tbody>";
      v1081.forEach(v1109 => {
        const v1110 = v1084.find(v1116 => v1116.outcome_id === v1109.id || v1109.id.startsWith && v1109.id.startsWith("fallback-") && v1116.outcome_id === v1109.id);
        const v1111 = v1110 ? v1110.phase1_rating : "";
        const v1112 = v1110 ? v1110.phase2_rating : "";
        const v1096 = v1110 ? v1110.phase1_method : "Observation";
        const v1098 = v1110 ? v1110.phase2_method : "Oral Work";
        const v1113 = v1111 ? parseInt(v1111, 10) : null;
        const v1114 = v1112 ? parseInt(v1112, 10) : null;
        let v1115 = v1114 || v1113;
        if (v1115) {
          v1086 += v1115;
          v1087++;
        }
        v1085 += "<tr style=\"border-bottom:1px solid #f1f5f9;\">\n                    <td style=\"padding:0.75rem 0.5rem;\">\n                        <span style=\"font-weight:700; color:var(--primary); font-size:0.75rem; display:block;\">[" + v1109.indicator_code + "]</span>\n                        <span style=\"color:var(--text-main); font-weight:500; white-space: pre-line; display: block; line-height: 1.5; margin-top: 0.25rem;\">" + escapeHtml(v1109.description) + "</span>\n                        " + ((v1113 === 1 || v1113 === 2) && !v1114 ? "<div style=\"background:#fee2e2; color:#dc2626; padding:0.35rem; border-radius:6px; font-size:0.75rem; font-weight:700; margin-top:0.25rem;\">⚠️ Corrective teaching required! Log Phase 2 support score.</div>" : "") + "\n                    </td>\n                    <td style=\"padding:0.75rem 0.5rem;\">\n                        <div style=\"display:flex; gap:0.25rem; margin-bottom:0.35rem;\">\n                            " + [1, 2, 3, 4].map(v1117 => "\n                                <button class=\"btn btn-sm " + (v1113 === v1117 ? "btn-primary" : "btn-ghost") + "\" style=\"flex:1; padding:0.25rem; font-weight:700;\" onclick=\"window.saveTeacherCASRating('" + v1071 + "', '" + v1109.id + "', 1, " + v1117 + ", document.getElementById('method-p1-" + v1109.id + "').value)\">" + v1117 + "</button>\n                            ").join("") + "\n                        </div>\n                        <select id=\"method-p1-" + v1109.id + "\" class=\"form-input\" style=\"padding:0.25rem; font-size:0.75rem; height:auto;\" onchange=\"window.saveTeacherCASRating('" + v1071 + "', '" + v1109.id + "', 1, " + (v1113 || "null") + ", this.value)\">\n                            " + v1103.map(v1106 => "<option value=\"" + v1106 + "\" " + (v1096 === v1106 ? "selected" : "") + ">" + v1106 + "</option>").join("") + "\n                        </select>\n                    </td>\n                    <td style=\"padding:0.75rem 0.5rem;\">\n                        " + (v1113 === 1 || v1113 === 2 ? "\n                            <div style=\"display:flex; gap:0.25rem; margin-bottom:0.35rem;\">\n                                " + [3, 4].map(v1118 => "\n                                    <button class=\"btn btn-sm " + (v1114 === v1118 ? "btn-primary" : "btn-ghost") + "\" style=\"flex:1; padding:0.25rem; font-weight:700;\" onclick=\"window.saveTeacherCASRating('" + v1071 + "', '" + v1109.id + "', 2, " + v1118 + ", document.getElementById('method-p2-" + v1109.id + "').value)\">" + v1118 + "</button>\n                                ").join("") + "\n                            </div>\n                            <select id=\"method-p2-" + v1109.id + "\" class=\"form-input\" style=\"padding:0.25rem; font-size:0.75rem; height:auto;\" onchange=\"window.saveTeacherCASRating('" + v1071 + "', '" + v1109.id + "', 2, " + (v1114 || "null") + ", this.value)\">\n                                " + v1103.map(v1108 => "<option value=\"" + v1108 + "\" " + (v1098 === v1108 ? "selected" : "") + ">" + v1108 + "</option>").join("") + "\n                            </select>\n                        " : "<span style=\"color:var(--text-muted); font-size:0.8rem; font-style:italic;\">No support needed</span>") + "\n                    </td>\n                </tr>";
      });
      v1085 += "</tbody></table>";
    }
    const v1088 = v1087 * 4;
    const v1089 = v1088 > 0 ? (v1086 / v1088 * 100).toFixed(1) : 0;
    let v1090 = "";
    if (v1077 === "1-3") {
      const v1119 = v1087 > 0 ? (v1086 / v1087).toFixed(1) : "—";
      let v1120 = "—";
      if (v1087 > 0) {
        const v1121 = Math.round(v1086 / v1087);
        v1120 = window.CAS_CONFIG.grading["1-3"][v1121]?.label || "—";
      }
      v1090 = "\n                <div>\n                    <div style=\"font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;\">Evaluated Indicators</div>\n                    <div style=\"font-size:1.5rem; font-weight:800; color:var(--text-main);\">" + v1087 + " <span style=\"font-size:1rem; color:var(--text-muted); font-weight:500;\">/ " + v1081.length + "</span></div>\n                </div>\n                <div>\n                    <div style=\"font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;\">Average Level</div>\n                    <div style=\"font-size:1.5rem; font-weight:800; color:var(--text-main);\">" + v1119 + "</div>\n                </div>\n                <div>\n                    <div style=\"font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;\">Overall Level</div>\n                    <div style=\"font-size:1.25rem; font-weight:800; color:var(--primary);\">" + v1120 + "</div>\n                </div>\n            ";
    } else {
      const v1122 = window.CAS_CONFIG.grading["4-5"] || [];
      const v1123 = v1122.find(v1124 => v1089 >= v1124.min && v1089 <= v1124.max) || v1122[v1122.length - 1] || {};
      v1090 = "\n                <div>\n                    <div style=\"font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;\">Total Score</div>\n                    <div style=\"font-size:1.5rem; font-weight:800; color:var(--text-main);\">" + v1086 + " <span style=\"font-size:1rem; color:var(--text-muted); font-weight:500;\">/ " + v1088 + "</span></div>\n                </div>\n                <div>\n                    <div style=\"font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;\">Achievement %</div>\n                    <div style=\"font-size:1.5rem; font-weight:800; color:var(--text-main);\">" + v1089 + "%</div>\n                </div>\n                <div>\n                    <div style=\"font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;\">Grade</div>\n                    <div style=\"font-size:1.5rem; font-weight:800; color:var(--text-main);\">" + (v1123.grade || "-") + "</div>\n                </div>\n                <div>\n                    <div style=\"font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;\">GPA</div>\n                    <div style=\"font-size:1.5rem; font-weight:800; color:var(--primary);\">" + (v1123.gpa || "-") + "</div>\n                </div>\n            ";
    }
    
    // Inject Student Portfolio (Karyasanchayika) input form if Grade 1-3
    if (v1077 === "1-3") {
      v1085 += `
        <div style="margin-top:1.5rem; padding:1.25rem; background:#eff6ff; border-radius:8px; border:1px solid #bfdbfe; margin-bottom:1rem;">
            <h4 style="margin-top:0; color:#1e40af; font-size:0.85rem; font-weight:800; display:flex; align-items:center; gap:0.4rem; margin-bottom:0.75rem;">
                <i data-lucide="folder-open" style="width:18px; height:18px;"></i> Student Portfolio (कार्यसञ्चयिका) & Parental Log
            </h4>
            
            <div class="form-group" style="margin-bottom:0.75rem;">
                <label class="form-label" style="font-size:0.75rem; font-weight:700; color:#1e3a8a; margin-bottom:3px; display:block;">
                    Representative Sample Tasks / Creative Works (प्रतिनिधि कार्यहरू)
                </label>
                <textarea id="cas-portfolio-works" class="form-input" style="height:60px; font-size:0.8rem; padding:0.4rem;" placeholder="e.g. Worksheet 1, Drawing of plant, Rhyming cards game... (1-3 representative works)">${escapeHtml(representativeWorks)}</textarea>
            </div>
            
            <div style="display:flex; gap:1rem; align-items:center; flex-wrap:wrap;">
                <div style="display:flex; align-items:center; gap:0.4rem;">
                    <input type="checkbox" id="cas-parent-informed" style="width:16px; height:16px; cursor:pointer;" ${parentInformed ? "checked" : ""}>
                    <label for="cas-parent-informed" style="font-size:0.75rem; font-weight:700; color:#1e3a8a; cursor:pointer; margin:0;">
                        Parent Informed (अभिभावकलाई जानकारी गराइएको)
                    </label>
                </div>
                <div style="display:flex; align-items:center; gap:0.4rem; flex:1; min-width:150px;">
                    <label style="font-size:0.72rem; font-weight:700; color:#1e3a8a; white-space:nowrap; margin:0;">
                        Notification Date:
                    </label>
                    <input type="text" id="cas-parent-informed-date" class="form-input nepali-date-picker" style="padding:0.25rem; font-size:0.75rem; height:auto;" value="${escapeHtml(parentInformedDate)}" readonly>
                </div>
            </div>
            
            <button class="btn btn-primary btn-sm btn-block" style="margin-top:0.75rem; padding:0.4rem; font-weight:700; font-size:0.8rem; display:flex; align-items:center; justify-content:center; gap:0.35rem;" onclick="window.saveCASPortfolioMetadata('${v1071}', '${v1073}')">
                <i data-lucide="save" style="width:14px; height:14px;"></i> Save Portfolio & Parent Log
            </button>
        </div>
      `;
    }

    v1085 += "<div style=\"margin-top:1.5rem; padding:1.25rem; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0;\">\n            <div style=\"display:grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap:1rem; text-align:center; margin-bottom:1rem;\">\n                " + v1090 + "\n            </div>\n            <button class=\"btn btn-secondary btn-block\" onclick=\"window.printCASReportCard('" + v1071 + "', '" + v1076 + "')\" style=\"margin-top:0.75rem; display:flex; align-items:center; justify-content:center; gap:0.5rem;\">\n                <i data-lucide=\"printer\" style=\"width:16px; height:16px;\"></i> Print / Save Report Card\n            </button>\n        </div>";
    v1085 += "</div>";
    v1074.innerHTML = helpPanelHTML + v1085;
    if (window.lucide) {
      window.lucide.createIcons();
    }
  } catch (v1125) {
    console.error("CAS Load Error:", v1125);
    v1074.innerHTML = "<div style=\"color:var(--error); padding:2rem; text-align:center;\">Failed to load data: " + v1125.message + "</div>";
  }
};

window.saveCASPortfolioMetadata = async function (studentId, theme) {
  try {
    const termId = document.getElementById("cas-term")?.value || "First Term";
    const works = document.getElementById("cas-portfolio-works")?.value || "";
    const informed = document.getElementById("cas-parent-informed")?.checked ? 1 : 0;
    const dateVal = document.getElementById("cas-parent-informed-date")?.value || null;
    
    const outcomeId = "portfolio-metadata-" + theme;
    const meta = {
      student_id: studentId,
      outcome_id: outcomeId,
      term_id: termId,
      phase1_method: works,
      phase1_rating: informed,
      phase2_date: dateVal ? new Date(dateVal).toISOString() : null,
      evaluated_by: window.currentUserProfile?.id,
      updated_at: new Date().toISOString()
    };
    
    const {
      data: existing
    } = await v1.from("cas_student_portfolio_log").select("*").eq("student_id", studentId).eq("outcome_id", outcomeId).eq("term_id", termId).maybeSingle();
    
    const {
      error
    } = await v1.from("cas_student_portfolio_log").upsert({
      ...(existing || {}),
      ...meta
    }, {
      onConflict: "student_id, outcome_id, term_id"
    });
    
    if (error) {
      throw error;
    }
    toast("Portfolio log updated ✓");
    window.loadTeacherCASData();
  } catch (err) {
    console.error("Error saving portfolio metadata:", err);
    toast("Failed to save portfolio log: " + err.message);
  }
};
window.saveTeacherCASRating = async function (v1126, v1127, v1128, v1129, v1130) {
  try {
    const v1131 = document.getElementById("cas-term")?.value || "First Term";
    const v1132 = {
      student_id: v1126,
      outcome_id: v1127,
      term_id: v1131,
      evaluated_by: window.currentUserProfile?.id,
      updated_at: new Date().toISOString()
    };
    if (v1128 === 1) {
      v1132.phase1_rating = v1129 === "null" ? null : v1129;
      v1132.phase1_method = v1130;
      v1132.remedial_status = v1129 <= 2 ? "Requires Support" : "Completed";
    } else {
      v1132.phase2_rating = v1129 === "null" ? null : v1129;
      v1132.phase2_method = v1130;
      v1132.remedial_status = "Completed";
      v1132.phase2_date = new Date().toISOString();
    }
    const {
      data: v1133
    } = await v1.from("cas_student_portfolio_log").select("*").eq("student_id", v1126).eq("outcome_id", v1127).eq("term_id", v1131).maybeSingle();
    const {
      error: v1134
    } = await v1.from("cas_student_portfolio_log").upsert({
      ...(v1133 || {}),
      ...v1132
    }, {
      onConflict: "student_id, outcome_id, term_id"
    });
    if (v1134) {
      throw v1134;
    }
    toast("Evaluation logged ✓");
    window.loadTeacherCASData();
  } catch (v1135) {
    console.error("Error saving CAS:", v1135);
    toast("Failed to save portfolio rating");
  }
};
window.switchTeacherCasMode = function(mode) {
    window._currentTeacherCasMode = mode;
    const cdcTab = document.getElementById('tab-cas-cdc');
    const weeklyTab = document.getElementById('tab-cas-weekly');
    const cdcFilters = document.getElementById('cas-cdc-filters');
    
    if (mode === 'cdc') {
        cdcTab.classList.add('active');
        cdcTab.style.borderBottom = '2px solid var(--primary)';
        cdcTab.style.color = 'var(--primary)';
        cdcTab.style.fontWeight = '700';
        
        weeklyTab.classList.remove('active');
        weeklyTab.style.borderBottom = 'none';
        weeklyTab.style.color = 'var(--text-muted)';
        weeklyTab.style.fontWeight = '500';
        
        cdcFilters.style.display = 'flex';
    } else {
        weeklyTab.classList.add('active');
        weeklyTab.style.borderBottom = '2px solid var(--primary)';
        weeklyTab.style.color = 'var(--primary)';
        weeklyTab.style.fontWeight = '700';
        
        cdcTab.classList.remove('active');
        cdcTab.style.borderBottom = 'none';
        cdcTab.style.color = 'var(--text-muted)';
        cdcTab.style.fontWeight = '500';
        
        cdcFilters.style.display = 'none';
    }
    window.loadTeacherCASData();
};


