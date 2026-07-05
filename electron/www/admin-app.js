import v1 from "./supabase.js";
import { validateSession, openModal, closeModal, toast, logout, escapeHtml, CLASS_OPTIONS, DEFAULT_SUBJECTS, getLocalToday, initNepaliDatePicker, sortClassList, formatDateLabel, sortStudentsList } from "./shared.js";
window.supabaseClient = v1;
window.currentUser = null;
let allTeachers = [];
let allParents = [];
let allStudents = [];
window.allStudents = allStudents;
let allClasses = new Set();
let allAttendance = [];
let allSubjects = [];
let currentAttendanceDate = getLocalToday();
let selectedActivityTeacherId = "";
const lastFetch = {};
const attDataCache = {};
const activityCache = {};
async function callEdgeFn(v2) {
  const {
    data: v3
  } = await v1.auth.getSession();
  const v4 = v3?.session?.access_token;
  const v5 = await fetch("https://rfcrnvomvfgermqbtilp.supabase.co/functions/v1/create-user", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + v4
    },
    body: JSON.stringify(v2)
  });
  const v6 = await v5.json();
  if (!v5.ok) {
    throw new Error(v6.error || v6.message || "Edge function error");
  }
  return v6;
}
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const v7 = await validateSession();
    if (!v7) {
      window.location.href = "login.html";
      return;
    }
    window.currentUser = v7.user;
    const v8 = window.currentUserProfile;
    if (!v8 || v8.role !== "admin") {
      window.location.href = "login.html";
      return;
    }
    initializeUI();
    setupEventListeners();
    const v9 = localStorage.getItem("cache_students");
    if (v9) {
      try {
        allStudents = sortStudentsList(JSON.parse(v9));
      } catch (v11) {}
    }
    const v10 = localStorage.getItem("cache_teachers");
    if (v10) {
      try {
        allTeachers = JSON.parse(v10);
      } catch (v12) {}
    }
    
    hideSplashScreen();
    await Promise.all([loadStudents(false), loadSubjects(false), loadTeachers(false)]);
    window.renderAdminDashboard(false);
    
    setTimeout(() => {
      loadParents(false);
      if (window.loadAdminNotices) {
        window.loadAdminNotices(false);
      }
      if (window.loadSentMessages) {
        window.loadSentMessages(false);
      }
      if (window.updateNotificationBadges) {
        window.updateNotificationBadges();
      }
    }, 1000);
    setInterval(() => {
      if (window.updateNotificationBadges) {
        window.updateNotificationBadges();
      }
    }, 60000);
  } catch (v13) {
    console.error("Initialization failed", v13);
    if (window.toast) {
      window.toast("Error loading data. Please refresh.");
    }
  } finally {
    hideSplashScreen();
  }
});
function hideSplashScreen() {
  const v14 = document.getElementById("splash-screen");
  if (v14) {
    v14.classList.add("hidden");
    setTimeout(() => v14.remove(), 500);
  }
}
function initializeUI() {
  lucide.createIcons();
  switchTabSilent("dashboard");
  history.replaceState({
    tab: "dashboard"
  }, "");
}
function setupEventListeners() {
  document.querySelectorAll(".tab").forEach(v16 => {
    v16.addEventListener("click", v17 => {
      v17.preventDefault();
      window.switchTab(v16.dataset.tab);
    });
  });
  document.querySelectorAll(".nav-item").forEach(v18 => {
    v18.addEventListener("click", v19 => {
      v19.preventDefault();
      const v20 = v18.dataset.view;
      const v21 = {
        "admin-dashboard": "dashboard",
        "admin-teachers": "teachers",
        "admin-parents": "parents",
        "admin-students": "students",
        "admin-attendance": "attendance",
        "admin-marks": "marks",
        "admin-activity": "activity",
        "admin-reports": "reports",
        "admin-notices": "notices",
        "admin-messages": "messages",
        "admin-leave": "leave",
        "admin-more": "more"
      };
      if (v21[v20]) {
        window.switchTab(v21[v20]);
      }
    });
  });
  const v15 = document.getElementById("student-search");
  if (v15) {
    v15.addEventListener("input", () => window.applyStudentFilters());
  }
}
window.loadInitialData = async function (v22 = false) {
  try {
    await Promise.all([loadStudents(v22), loadSubjects(v22), loadTeachers(v22)]);
    
    const v23 = document.querySelector(".tab-content.active")?.id.replace("tab-", "") || "dashboard";
    if (v23 === "dashboard") {
      window.renderAdminDashboard(v22);
    }
    if (v23 === "teachers") {
      window.renderTeachers();
    }
    if (v23 === "students") {
      renderStudents();
    }
    if (v23 === "parents") {
      window.renderParents();
    }
    Promise.allSettled([window.loadAttendanceData(v22), loadParents(v22), window.loadAdminNotices ? window.loadAdminNotices(v22) : Promise.resolve(), window.loadSentMessages ? window.loadSentMessages(v22) : Promise.resolve()]);
  } catch (v24) {
    console.error("Error loading data:", v24);
    throw v24;
  }
};
function switchTabSilent(v25) {
  document.querySelectorAll(".tab").forEach(v27 => {
    v27.classList.toggle("active", v27.dataset.tab === v25);
  });
  document.querySelectorAll(".tab-content").forEach(v28 => {
    v28.classList.remove("active");
  });
  const v26 = document.getElementById("tab-" + v25);
  if (v26) {
    v26.classList.add("active");
  }
}
window.switchTab = function (v29, v30 = true) {
  if (v30) {
    const v31 = document.querySelector(".tab-content.active");
    const v32 = v31 ? v31.id.replace("tab-", "") : "";
    if (v32 !== v29) {
      history.pushState({
        tab: v29
      }, "");
    }
  }
  document.querySelectorAll(".tab").forEach(v33 => {
    v33.classList.toggle("active", v33.dataset.tab === v29);
  });
  document.querySelectorAll(".nav-item").forEach(v34 => {
    const v35 = {
      dashboard: "admin-dashboard",
      teachers: "admin-more",
      parents: "admin-more",
      students: "admin-students",
      attendance: "admin-attendance",
      marks: "admin-marks",
      activity: "admin-more",
      reports: "admin-more",
      notices: "admin-more",
      messages: "admin-more",
      leave: "admin-more",
      more: "admin-more"
    };
    v34.classList.toggle("active", v34.dataset.view === v35[v29]);
  });
  document.querySelectorAll(".tab-content").forEach(v36 => {
    v36.classList.remove("active");
  });
  document.getElementById("tab-" + v29).classList.add("active");
  if (v29 === "dashboard") {
    window.renderAdminDashboard();
  } else if (v29 === "students") {
    loadStudents();
  } else if (v29 === "attendance") {
    window.loadAttendanceData(false);
  } else if (v29 === "marks") {
    window.loadMarksData(true);
  } else if (v29 === "activity") {
    window.loadActivityLog(false);
  } else if (v29 === "parents") {
    window.renderParents();
  } else if (v29 === "teachers") {
    window.renderTeachers();
  } else if (v29 === "notices") {
    window.loadAdminNotices();
  } else if (v29 === "messages") {
    window.loadSentMessages();
    window.initMessageTab();
  } else if (v29 === "leave") {
    if (window.loadLeaveApplications) {
      window.loadLeaveApplications();
    }
  } else if (v29 === "reports") {
    if (window.initNepaliReportsDropdowns) {
      window.initNepaliReportsDropdowns();
    }
  } else if (v29 === "more") {
    if (window.updateNotificationBadges) {
      window.updateNotificationBadges();
    }
  }
  lucide.createIcons();
  if (window.initNepaliDatePicker) {
    window.initNepaliDatePicker(".nepali-date-picker");
  }
};
window.addEventListener("popstate", v37 => {
  if (window.ignoreNextPopstate) {
    window.ignoreNextPopstate = false;
    return;
  }
  const v38 = document.getElementById("modal-overlay");
  if (v38 && v38.classList.contains("open")) {
    return;
  }
  const v39 = v37.state;
  if (v39 && v39.tab) {
    window.switchTab(v39.tab, false);
  } else {
    window.switchTab("dashboard", false);
  }
});
async function loadSubjects(v40 = false) {
  const v41 = "subjects";
  const v42 = Date.now();
  if (!v40 && allSubjects.length > 0 && lastFetch[v41] && v42 - lastFetch[v41] < 60000) {
    return;
  }
  try {
    const {
      data: v43,
      error: v44
    } = await v1.from("subjects").select("id, name").order("sort_order");
    if (v44) {
      throw v44;
    }
    if (v43 && v43.length > 0) {
      window.subjectsDb = v43;
      allSubjects = v43.map(v45 => v45.name);
    } else {
      allSubjects = DEFAULT_SUBJECTS;
    }
    lastFetch[v41] = v42;
  } catch (v46) {
    console.warn("Failed to load subjects, using defaults", v46);
    allSubjects = DEFAULT_SUBJECTS;
  }
}
async function loadTeachers(v47 = false) {
  const v48 = "teachers";
  const v49 = Date.now();
  if (!v47 && allTeachers.length > 0 && lastFetch[v48] && v49 - lastFetch[v48] < 60000) {
    return;
  }
  try {
    if (allTeachers.length === 0) {
      const v52 = localStorage.getItem("cache_teachers");
      if (v52) {
        allTeachers = JSON.parse(v52);
        window.renderTeachers();
      }
    }
    const v50 = await window.fetchAllPaginated((s, e) => v1.from("profiles").select("*").eq("role", "teacher").range(s, e));
    const v51 = null;
    allTeachers = v50 || [];
    lastFetch[v48] = v49;
    localStorage.setItem("cache_teachers", JSON.stringify(allTeachers));
    window.renderTeachers();
  } catch (v53) {
    console.error("Error in loadTeachers:", v53);
  }
}
window.renderTeachers = function () {
  const v54 = document.getElementById("teachers-list");
  if (!v54) {
    return;
  }
  const v55 = document.getElementById("teacher-search")?.value.toLowerCase() || "";
  const v56 = allTeachers.filter(v57 => (v57.full_name || "").toLowerCase().includes(v55));
  if (v56.length === 0) {
    v54.innerHTML = "\n            <div class=\"empty-state\">\n                <i data-lucide=\"user-x\" style=\"width: 48px; height: 48px; margin-bottom: 1rem; color: var(--text-muted); opacity: 0.3;\"></i>\n                <p>No teachers found.</p>\n                <p style=\"font-size: 0.75rem; margin-top: 0.25rem;\">Use the <b>+ Add</b> button above to create a teacher account.</p>\n            </div>\n        ";
    return;
  }
  v54.innerHTML = v56.map(v58 => {
    let v59 = "No classes assigned";
    try {
      if (v58.assigned_classes) {
        const v60 = typeof v58.assigned_classes === "string" ? JSON.parse(v58.assigned_classes) : v58.assigned_classes;
        if (Array.isArray(v60)) {
          v59 = v60.join(", ");
        } else if (v60 && v60.assignments) {
          v59 = v60.assignments.map(v61 => {
            const v62 = v61.isHomeroom ? " (Homeroom)" : "";
            const v63 = v61.subjects && v61.subjects.length > 0 ? " [" + v61.subjects.join(", ") + "]" : "";
            return "" + v61.className + v62 + v63;
          }).join(" | ");
        }
      }
    } catch (v64) {
      console.warn("Class parse error", v64);
      v59 = String(v58.assigned_classes);
    }
    return "\n            <div class=\"card\" style=\"display: block; position: relative; padding-right: 3rem; cursor: pointer;\" onclick=\"window.openEditTeacherForm('" + v58.id + "')\">\n                <h3 style=\"margin-bottom: 0.35rem; color: var(--primary);\">" + escapeHtml(v58.full_name || "Teacher") + "</h3>\n                " + (v58.mobile ? "<div style=\"font-size:0.78rem;color:var(--text-muted);margin-bottom:0.25rem;display:flex;align-items:center;gap:0.3rem;\"><i data-lucide=\"phone\" style=\"width:12px;height:12px;\"></i>" + escapeHtml(v58.mobile) + "</div>" : "") + "\n                " + (v58.description ? "<div style=\"font-size:0.78rem;color:var(--text-muted);margin-bottom:0.4rem;font-style:italic;\">" + escapeHtml(v58.description) + "</div>" : "") + "\n                <div style=\"font-size: 0.8rem; color: var(--text-main); line-height: 1.5; padding-top:0.35rem; border-top:1px solid var(--border); margin-top:0.35rem;\">\n                    <span style=\"font-size:0.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.04em;\">Classes: </span>\n                    " + escapeHtml(v59) + "\n                </div>\n                <button class=\"btn btn-icon\" onclick=\"event.stopPropagation(); window.deleteTeacher('" + v58.id + "')\" \n                    style=\"position: absolute; top: 1rem; right: 1rem; color: var(--error); background: var(--error-light); width: 32px; height: 32px; padding: 0;\">\n                    <i data-lucide=\"trash-2\" style=\"width: 16px; height: 16px;\"></i>\n                </button>\n            </div>\n        ";
  }).join("");
  lucide.createIcons();
};
window.openEditTeacherForm = function (v65) {
  const v66 = allTeachers.find(v72 => v72.id === v65);
  if (!v66) {
    return;
  }
  let v67 = [];
  try {
    const v73 = typeof v66.assigned_classes === "string" ? JSON.parse(v66.assigned_classes) : v66.assigned_classes;
    if (v73 && v73.assignments) {
      v67 = v73.assignments;
    }
  } catch (v74) {}
  const v68 = CLASS_OPTIONS;
  const v69 = allSubjects && allSubjects.length > 0 ? allSubjects : DEFAULT_SUBJECTS;
  const v70 = v68.map(v75 => {
    const v76 = v67.find(v80 => v80.className === v75) || {};
    const v77 = !!v76.className;
    const v78 = !!v76.isHomeroom;
    const v79 = v76.subjects || [];
    return "\n            <div class=\"class-assignment-row\" style=\"padding: 1rem; border-bottom: 1px solid #edf2f7; background: #fff;\">\n                <div style=\"display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;\">\n                    <label style=\"font-weight: 700; display: flex; align-items: center; gap: 0.5rem; cursor: pointer;\">\n                        <input type=\"checkbox\" class=\"class-check\" data-class=\"" + v75 + "\" onchange=\"this.parentElement.parentElement.nextElementSibling.style.display = this.checked ? 'block' : 'none'\" " + (v77 ? "checked" : "") + ">\n                        " + v75 + "\n                    </label>\n                    <label style=\"font-size: 0.75rem; display: flex; align-items: center; gap: 0.3rem; color: var(--primary); font-weight: 600;\">\n                        <input type=\"checkbox\" class=\"homeroom-check\" data-class=\"" + v75 + "\" " + (v78 ? "checked" : "") + "> Homeroom?\n                    </label>\n                </div>\n                <div class=\"subject-selection\" style=\"display: " + (v77 ? "block" : "none") + "; padding-left: 1.5rem;\">\n                    <p style=\"font-size: 0.7rem; color: var(--text-muted); margin-bottom: 0.4rem; font-weight: 600; text-transform: uppercase;\">Subjects Taught:</p>\n                    <div style=\"display: grid; grid-template-columns: 1fr 1fr; gap: 0.3rem;\">\n                        " + v69.map(v81 => "\n                            <label style=\"font-size: 0.8rem; display: flex; align-items: center; gap: 0.4rem; cursor: pointer;\">\n                                <input type=\"checkbox\" class=\"subject-check\" data-class=\"" + v75 + "\" data-sub=\"" + v81 + "\" " + (v79.includes(v81) ? "checked" : "") + "> " + v81 + "\n                            </label>\n                        ").join("") + "\n                    </div>\n                </div>\n            </div>\n        ";
  }).join("");
  const v71 = "\n        <div class=\"modal-title\">Edit Teacher Profile: " + escapeHtml(v66.full_name) + "</div>\n        <form id=\"teacher-form\">\n            <div class=\"form-group\">\n                <label class=\"form-label\">Full Name</label>\n                <input type=\"text\" name=\"full_name\" class=\"form-input\" required value=\"" + escapeHtml(v66.full_name || "") + "\">\n            </div>\n            <div class=\"form-group\">\n                <label class=\"form-label\">Phone Number</label>\n                <input type=\"tel\" name=\"mobile\" class=\"form-input\" value=\"" + escapeHtml(v66.mobile || "") + "\">\n            </div>\n            <div class=\"form-group\">\n                <label class=\"form-label\">Profile Description / Bio</label>\n                <textarea name=\"description\" class=\"form-input\" rows=\"3\">" + escapeHtml(v66.description || "") + "</textarea>\n            </div>\n\n            <details style=\"margin-bottom:1rem; border:1px solid #e2e8f0; border-radius:0.75rem; overflow:hidden;\">\n                <summary style=\"padding:0.85rem 1rem; font-weight:700; font-size:0.85rem; cursor:pointer; background:#f8fafc; color:var(--primary); display:flex; align-items:center; gap:0.5rem;\">\n                    <i data-lucide=\"key\" style=\"width:15px;height:15px;\"></i> Change Login Credentials\n                </summary>\n                <div style=\"padding:1rem; background:#fff;\">\n                    <p style=\"font-size:0.72rem;color:var(--text-muted);margin-bottom:0.75rem;\">Leave fields blank to keep unchanged. New email/password will take effect on next login.</p>\n                    <div class=\"form-group\">\n                        <label class=\"form-label\">New Email Address</label>\n                        <input type=\"email\" name=\"new_email\" class=\"form-input\" placeholder=\"Leave blank to keep current\">\n                    </div>\n                    <div class=\"form-group\">\n                        <label class=\"form-label\">New Password</label>\n                        <input type=\"password\" name=\"new_password\" class=\"form-input\" minlength=\"6\" placeholder=\"Leave blank to keep current\">\n                    </div>\n                </div>\n            </details>\n\n            <div class=\"form-group\">\n                <label class=\"form-label\">Class & Subject Assignments</label>\n                <div style=\"background: #f8fafc; border-radius: 0.5rem; border: 2px solid #e2e8f0; max-height: 300px; overflow-y: auto;\">\n                    " + v70 + "\n                </div>\n            </div>\n            <button type=\"submit\" class=\"btn btn-primary btn-block\" style=\"margin-top: 1.5rem;\">Save Changes</button>\n        </form>\n    ";
  window.openModal(v71);
  document.getElementById("teacher-form").addEventListener("submit", async v82 => {
    v82.preventDefault();
    const v83 = new FormData(v82.target);
    const v84 = Object.fromEntries(v83);
    const v85 = [];
    document.querySelectorAll(".class-check:checked").forEach(v86 => {
      const v87 = v86.dataset.class;
      const v88 = document.querySelector(".homeroom-check[data-class=\"" + v87 + "\"]").checked;
      const v89 = Array.from(document.querySelectorAll(".subject-check[data-class=\"" + v87 + "\"]:checked")).map(v90 => v90.dataset.sub);
      v85.push({
        className: v87,
        isHomeroom: v88,
        subjects: v89
      });
    });
    if (v85.length === 0) {
      alert("Please assign at least one class to the teacher.");
      return;
    }
    try {
      toast("Saving changes...", 3000);
      const {
        error: v91
      } = await v1.from("profiles").update({
        full_name: v84.full_name,
        mobile: v84.mobile || null,
        description: v84.description || null,
        assigned_classes: {
          assignments: v85
        }
      }).eq("id", v65);
      if (v91) {
        throw v91;
      }
      const v92 = v84.new_email?.trim();
      const v93 = v84.new_password?.trim();
      if (v92 || v93) {
        toast("Updating login credentials...", 3000);
        await callEdgeFn({
          action: "update-credentials",
          userId: v65,
          ...(v92 ? {
            email: v92
          } : {}),
          ...(v93 ? {
            password: v93
          } : {})
        });
        if (v92) {
          const v95 = allTeachers.findIndex(v96 => v96.id === v65);
          if (v95 !== -1) {
            allTeachers[v95].email = v92;
          }
        }
      }
      const v94 = allTeachers.findIndex(v97 => v97.id === v65);
      if (v94 !== -1) {
        allTeachers[v94].full_name = v84.full_name;
        allTeachers[v94].mobile = v84.mobile || null;
        allTeachers[v94].description = v84.description || null;
        allTeachers[v94].assigned_classes = {
          assignments: v85
        };
      }
      toast("Teacher profile saved successfully!");
      window.closeModal();
      window.renderTeachers();
    } catch (v98) {
      console.error("Error updating teacher:", v98);
      toast("Error: " + v98.message);
    }
  });
};
window.deleteTeacher = async function (v99) {
  if (!confirm("Are you sure you want to delete this teacher?")) {
    return;
  }
  try {
    const {
      error: v100
    } = await v1.from("profiles").delete().eq("id", v99);
    if (v100) {
      throw v100;
    }
    toast("Teacher deleted successfully!");
    await loadTeachers();
  } catch (v101) {
    console.error("Error deleting teacher:", v101);
    toast("Error deleting teacher");
  }
};
window.openManageSubjects = function () {
  openModal("\n        <div class=\"modal-handle\"></div>\n        <p class=\"modal-title\">Manage Subjects</p>\n        <div style=\"display:flex;gap:0.5rem;margin-bottom:1rem\">\n            <input type=\"text\" id=\"new-sub-name\" class=\"form-input\" placeholder=\"New subject name\">\n            <button class=\"btn btn-primary\" onclick=\"addSubject()\">Add</button>\n        </div>\n        <div class=\"att-card\" id=\"subj-list\" style=\"max-height:50vh;overflow-y:auto;padding-right:0.5rem\">\n            " + window.renderSubjectsList() + "\n        </div>\n        <button class=\"btn btn-block\" onclick=\"closeModal()\">Done</button>\n    ");
  lucide.createIcons();
};
window.renderSubjectsList = function () {
  return allSubjects.map((v102, v103) => "\n        <div class=\"att-row\" style=\"padding:0.5rem;margin-bottom:0.5rem; display:flex; justify-content:space-between; align-items:center;\">\n            <div style=\"font-weight:600\">" + escapeHtml(v102) + "</div>\n            <button class=\"btn btn-icon\" onclick=\"deleteSubject(" + v103 + ")\" style=\"color:var(--error); padding:4px;\"><i data-lucide=\"trash-2\" style=\"width:16px;height:16px\"></i></button>\n        </div>").join("");
};
window.addSubject = async function () {
  const v104 = document.getElementById("new-sub-name").value.trim();
  if (!v104) {
    return;
  }
  if (allSubjects.includes(v104)) {
    toast("Subject already exists");
    return;
  }
  try {
    const {
      error: v105
    } = await v1.from("subjects").insert({
      name: v104,
      sort_order: allSubjects.length + 1
    });
    if (v105) {
      toast(v105.message);
      return;
    }
    allSubjects.push(v104);
    document.getElementById("subj-list").innerHTML = window.renderSubjectsList();
    lucide.createIcons();
    document.getElementById("new-sub-name").value = "";
    toast("Subject added");
  } catch (v106) {
    console.error("addSubject error", v106);
    toast("Failed to add subject");
  }
};
window.deleteSubject = async function (v107) {
  if (!confirm("Delete this subject?")) {
    return;
  }
  const v108 = allSubjects[v107];
  try {
    const {
      error: v109
    } = await v1.from("subjects").delete().eq("name", v108);
    if (v109) {
      toast(v109.message);
      return;
    }
    allSubjects.splice(v107, 1);
    document.getElementById("subj-list").innerHTML = window.renderSubjectsList();
    lucide.createIcons();
    toast("Subject deleted");
  } catch (v110) {
    console.error("deleteSubject error", v110);
    toast("Failed to delete subject");
  }
};
async function loadStudents(v111 = false) {
  const v112 = "students";
  const v113 = Date.now();
  if (!v111 && allStudents.length > 0 && lastFetch[v112] && v113 - lastFetch[v112] < 60000) {
    return;
  }
  try {
    if (allStudents.length === 0) {
      const v116 = localStorage.getItem("cache_students");
      if (v116) {
        allStudents = sortStudentsList(JSON.parse(v116));
        window.allStudents = allStudents;
        renderStudents();
      }
    }
    const v114 = await window.fetchAllPaginated((s, e) => v1.from("students").select("id, name, roll, class, dob, parents, mobile").order("class").order("roll", {
      ascending: true,
      nullsFirst: false
    }).range(s, e));
    const v115 = null;
    allStudents = sortStudentsList(v114 || []);
    window.allStudents = allStudents;
    lastFetch[v112] = v113;
    localStorage.setItem("cache_students", JSON.stringify(allStudents));
    renderStudents();
    if (window.renderParents) {
      window.renderParents();
    }
    if (typeof window.updateClassFilters === "function") {
      window.updateClassFilters();
    }
  } catch (v117) {
    console.error("Error loading students:", v117);
  }
}
window.exportStudents = async function () {
  try {
    toast("Preparing student export...", 2000);
    const {
      data: v118,
      error: v119
    } = await v1.from("students").select("name, roll, dob, parents, mobile, class").order("class").order("roll");
    if (v119) {
      throw v119;
    }
    if (!v118 || v118.length === 0) {
      toast("No students to export");
      return;
    }
    const v120 = v118.map(v125 => ({
      Name: v125.name,
      "Roll No": v125.roll,
      DOB: v125.dob,
      "Parent Name": v125.parents,
      Phone: v125.mobile,
      Class: v125.class
    }));
    const v121 = XLSX.utils.json_to_sheet(v120);
    const v122 = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(v122, v121, "Students");
    const v123 = new Date().toISOString().split("T")[0];
    const v124 = "Holy_Garden_Students_" + v123 + ".xlsx";
    await window.saveExcel(v122, v124);
    toast("Exported: " + v124);
  } catch (v126) {
    console.error("Export failed", v126);
    toast("Export failed: " + v126.message);
  }
};
window.handleStudentImport = async function (v127) {
  const v128 = v127.target.files[0];
  if (!v128) {
    return;
  }
  try {
    toast("Reading Excel file...", 3000);
    const v129 = await v128.arrayBuffer();
    const v130 = XLSX.read(v129);
    const v131 = "all class";
    if (!v130.SheetNames.includes(v131)) {
      throw new Error("Sheet \"" + v131 + "\" not found in Excel file.");
    }
    const v132 = v130.Sheets[v131];
    const v133 = XLSX.utils.sheet_to_json(v132);
    if (!v133.length) {
      throw new Error("Excel sheet is empty");
    }
    const v134 = v140 => {
      let v141 = String(v140 || "").trim();
      if (/^\d+$/.test(v141)) {
        v141 = "Grade " + v141;
      } else if (/^(class|grade)\s*(\d+)$/i.test(v141)) {
        v141 = "Grade " + v141.match(/\d+/)[0];
      }
      const v142 = CLASS_OPTIONS.find(v143 => v143.toLowerCase() === v141.toLowerCase());
      return v142 || v141;
    };
    const v135 = v133.map(v144 => ({
      id: crypto.randomUUID(),
      name: String(v144.Name || "").trim(),
      roll: String(v144["Roll No"] || "").trim(),
      dob: String(v144.DOB || "").trim(),
      parents: String(v144["Parent Name"] || "").trim(),
      mobile: String(v144.Phone || "").trim(),
      class: v134(v144.Class)
    })).filter(v145 => v145.name && v145.name !== "");
    if (v135.length === 0) {
      throw new Error("No valid students found (Name column missing or empty)");
    }
    const v136 = [];
    const v137 = [];
    const v138 = [];
    v135.forEach(v146 => {
      const v147 = allStudents.find(v148 => String(v148.name).toLowerCase().trim() === v146.name.toLowerCase());
      if (v147) {
        const v149 = String(v147.class).trim() === v146.class && String(v147.roll).trim() === v146.roll;
        if (v149) {
          v138.push(v146);
        } else {
          v146.id = v147.id;
          v137.push(v146);
        }
      } else {
        v136.push(v146);
      }
    });
    const v139 = "\n            <div class=\"modal-title\">Confirm Import</div>\n            <div style=\"margin-bottom: 1rem;\">\n                <p>Found <strong>" + v135.length + "</strong> students in Excel.</p>\n                <ul style=\"font-size: 0.85rem; margin-top: 0.5rem; color: var(--text-main);\">\n                    <li>New (Insert): <span style=\"color: var(--primary); font-weight: 700;\">" + v136.length + "</span></li>\n                    <li>Existing (Update): <span style=\"color: #f59e0b; font-weight: 700;\">" + v137.length + "</span></li>\n                    <li>Duplicates (Skip): <span style=\"color: var(--error); font-weight: 700;\">" + v138.length + "</span></li>\n                </ul>\n                <p style=\"font-size: 0.75rem; color: var(--text-muted); margin-top: 0.5rem;\">\n                    * Updates are based on matching Names. Exact matches (Name+Class+Roll) are skipped.\n                </p>\n            </div>\n            <div style=\"display: flex; gap: 0.5rem;\">\n                <button id=\"confirm-import-btn\" class=\"btn btn-primary\" style=\"flex: 1;\">Start Import</button>\n                <button class=\"btn btn-ghost\" onclick=\"window.closeModal()\" style=\"flex: 1;\">Cancel</button>\n            </div>\n        ";
    openModal(v139);
    document.getElementById("confirm-import-btn").onclick = async () => {
      const v150 = [...v136, ...v137];
      if (v150.length === 0) {
        toast("Nothing to import (all duplicates)");
        closeModal();
        return;
      }
      try {
        toast("Importing students...", 10000);
        const {
          error: v151
        } = await v1.from("students").upsert(v150);
        if (v151) {
          throw v151;
        }
        toast("Success: " + v136.length + " New, " + v137.length + " Updated, " + v138.length + " Skipped");
        closeModal();
        await loadStudents();
        window.updateClassFilters();
      } catch (v152) {
        console.error("Import process error:", v152);
        toast("Import failed: " + v152.message);
      }
    };
  } catch (v153) {
    console.error("Import failed", v153);
    alert("Import Error: " + v153.message);
  } finally {
    v127.target.value = "";
  }
};
let studentFilterTimeout = null;
window.applyStudentFilters = function () {
  if (studentFilterTimeout) {
    clearTimeout(studentFilterTimeout);
  }
  studentFilterTimeout = setTimeout(() => {
    renderStudents();
  }, 300);
};
function renderStudents() {
  const v154 = document.getElementById("student-search")?.value.toLowerCase() || "";
  const v155 = document.getElementById("student-class-filter")?.value || "";
  let v156 = allStudents;
  if (v154) {
    v156 = v156.filter(v159 => (v159.name || "").toLowerCase().includes(v154));
  }
  if (v155) {
    v156 = v156.filter(v160 => v160.class === v155);
  }
  const v157 = document.getElementById("students-list");
  if (!v157) {
    return;
  }
  if (v156.length === 0) {
    v157.innerHTML = "\n            <div style=\"margin-bottom: 1rem;\">\n                <button class=\"btn btn-primary\" onclick=\"window.openAddStudentForm()\">\n                    <i data-lucide=\"plus\" style=\"width:16px;height:16px;\"></i> Add Student\n                </button>\n            </div>\n            <div class=\"empty-state\"><i data-lucide=\"user-x\" style=\"width:48px;height:48px;color:var(--text-muted);opacity:0.3\"></i><p>No students found</p></div>\n        ";
    lucide.createIcons();
    return;
  }
  const v158 = v156.length > 200 ? v156.slice(0, 200) : v156;
  v157.innerHTML = "\n        <div style=\"margin-bottom: 1rem;\">\n            <button class=\"btn btn-primary\" onclick=\"window.openAddStudentForm()\">\n                <i data-lucide=\"plus\" style=\"width:16px;height:16px;\"></i> Add Student\n            </button>\n        </div>\n    " + v158.map(v161 => "\n        <div class=\"student-row\">\n            <div class=\"avatar\">" + escapeHtml((v161.name || "?").charAt(0)) + "</div>\n            <div class=\"student-info\">\n                <h3>" + escapeHtml(v161.name || "Unknown") + "</h3>\n                <p>Roll: " + escapeHtml(v161.roll || "—") + " &bull; " + escapeHtml(v161.class || "No Class") + "</p>\n            </div>\n            <div style=\"display: flex; gap: 0.5rem;\">\n                <button class=\"btn btn-icon\" onclick=\"window.editStudent('" + v161.id + "')\" title=\"Edit\">\n                    <i data-lucide=\"edit-2\" style=\"width: 16px; height: 16px;\"></i>\n                </button>\n                <button class=\"btn btn-icon\" onclick=\"window.deleteStudent('" + v161.id + "')\" title=\"Delete\" style=\"color: var(--error);\">\n                    <i data-lucide=\"trash-2\" style=\"width: 16px; height: 16px;\"></i>\n                </button>\n            </div>\n        </div>\n    ").join("") + (v156.length > 200 ? "<div style=\"text-align: center; padding: 1rem; color: var(--text-muted); font-size: 0.8rem;\">Showing 200 of " + v156.length + " students. Use search to find more.</div>" : "");
  lucide.createIcons();
}
window.openAddStudentForm = function () {
  const casCollapsible = window.getCasDetailsCollapsible("");
  const v162 = "\n        <div class=\"modal-title\">Add Student</div>\n        <form id=\"add-student-form\">\n            <div class=\"form-group\">\n                <label class=\"form-label\">Name</label>\n                <input type=\"text\" name=\"name\" class=\"form-input\" required>\n            </div>\n            <div class=\"form-group\">\n                <label class=\"form-label\">Roll</label>\n                <input type=\"text\" name=\"roll\" class=\"form-input\" required>\n            </div>\n            <div class=\"form-group\">\n                <label class=\"form-label\">Class</label>\n                <select name=\"class\" class=\"form-input\">\n                    " + CLASS_OPTIONS.map(v163 => "<option value=\"" + v163 + "\">" + v163 + "</option>").join("") + "\n                </select>\n            </div>\n            <div class=\"form-group\"><label class=\"form-label\">Date of Birth</label><input type=\"text\" name=\"dob\" class=\"form-input nepali-date-picker\" placeholder=\"YYYY-MM-DD\" readonly></div>\n            <div class=\"form-group\">\n                <label class=\"form-label\">Parents</label>\n                <input type=\"text\" id=\"fp\" name=\"parents\" class=\"form-input\">\n            </div>\n            <div class=\"form-group\">\n                <label class=\"form-label\">Mobile</label>\n                <input type=\"tel\" name=\"mobile\" class=\"form-input\">\n            </div>\n            " + casCollapsible + "\n            <div style=\"display: flex; gap: 0.5rem; margin-top: 1.5rem;\">\n                <button type=\"submit\" class=\"btn btn-primary\" style=\"flex: 1;\">Create</button>\n                <button type=\"button\" class=\"btn btn-secondary\" style=\"flex: 1;\" onclick=\"closeModal()\">Cancel</button>\n            </div>\n        </form>\n    ";
  openModal(v162);
  if (window.initNepaliDatePicker) {
    window.initNepaliDatePicker(".nepali-date-picker");
  }
  document.getElementById("add-student-form").onsubmit = async v164 => {
    v164.preventDefault();
    const v165 = new FormData(v164.target);
    let v166 = v165.get("roll");
    if (v166 && isNaN(parseInt(v166))) {
      toast("Roll must be a number");
      return;
    }
    const v167 = crypto.randomUUID();
    const v168 = {
      id: v167,
      name: v165.get("name"),
      roll: v166 ? parseInt(v166) : null,
      class: v165.get("class"),
      dob: v165.get("dob") || null,
      parents: window.serializeCasDetails(v165.get("parents") || null),
      mobile: v165.get("mobile") || null
    };
    v164.target.querySelector("button[type=\"submit\"]").disabled = true;
    v164.target.querySelector("button[type=\"submit\"]").innerHTML = "<div class=\"spinner\" style=\"width:14px;height:14px\"></div> Creating...";
    try {
      const {
        error: v169
      } = await v1.from("students").insert(v168);
      if (v169) {
        throw v169;
      }
      allStudents.push(v168);
      allStudents = sortStudentsList(allStudents);
      window.allStudents = allStudents;
      if (!allClasses.has(v168.class)) {
        allClasses.add(v168.class);
        updateClassFilters();
      }
      toast("Student added successfully");
      renderStudents();
      closeModal();
    } catch (v170) {
      console.error("Error adding student:", v170);
      toast(v170.message || "Failed to add student");
    }
  };
};
window.editStudent = function (v171) {
  const v172 = allStudents.find(v174 => v174.id === v171);
  if (!v172) {
    return;
  }
  const formattedParents = window.formatParentsName(v172.parents);
  const casCollapsible = window.getCasDetailsCollapsible(v172.parents);
  const v173 = "\n        <div class=\"modal-title\">Edit Student</div>\n        <form id=\"edit-student-form\">\n            <div class=\"form-group\">\n                <label class=\"form-label\">Name</label>\n                <input type=\"text\" name=\"name\" class=\"form-input\" value=\"" + escapeHtml(v172.name) + "\" required>\n            </div>\n            <div class=\"form-group\">\n                <label class=\"form-label\">Roll</label>\n                <input type=\"text\" name=\"roll\" class=\"form-input\" value=\"" + (v172.roll !== null && v172.roll !== undefined ? v172.roll : "") + "\" required>\n            </div>\n            <div class=\"form-group\">\n                <label class=\"form-label\">Class</label>\n<select name=\"class\" class=\"form-input\">\n    " + CLASS_OPTIONS.map(v175 => "<option value=\"" + v175 + "\" " + (v172.class === v175 ? "selected" : "") + ">" + v175 + "</option>").join("") + "\n</select>            </div>\n            <div class=\"form-group\"><label class=\"form-label\">Date of Birth</label><input type=\"text\" name=\"dob\" class=\"form-input nepali-date-picker\" value=\"" + escapeHtml(v172.dob || "") + "\" placeholder=\"YYYY-MM-DD\" readonly></div>\n            <div class=\"form-group\">\n                <label class=\"form-label\">Parents</label>\n                <input type=\"text\" id=\"fp\" name=\"parents\" class=\"form-input\" value=\"" + escapeHtml(formattedParents || "") + "\">\n            </div>\n            <div class=\"form-group\">\n                <label class=\"form-label\">Mobile</label>\n                <input type=\"tel\" name=\"mobile\" class=\"form-input\" value=\"" + escapeHtml(v172.mobile || "") + "\">\n            </div>\n            " + casCollapsible + "\n            <div style=\"display: flex; gap: 0.5rem; margin-top: 1.5rem;\">\n                <button type=\"submit\" class=\"btn btn-primary\" style=\"flex: 1;\">Save Changes</button>\n                <button type=\"button\" class=\"btn btn-ghost\" onclick=\"window.closeModal()\" style=\"flex: 1;\">Cancel</button>\n            </div>\n        </form>\n    ";
  window.openModal(v173);
  if (window.initNepaliDatePicker) {
    window.initNepaliDatePicker(".nepali-date-picker");
  }
  document.getElementById("edit-student-form").addEventListener("submit", async v176 => {
    v176.preventDefault();
    const v177 = new FormData(v176.target);
    let v178 = v177.get("roll");
    if (v178 && isNaN(parseInt(v178))) {
      toast("Roll must be a number");
      return;
    }
    const v179 = {
      name: v177.get("name"),
      roll: v178 ? parseInt(v178) : null,
      class: v177.get("class"),
      dob: v177.get("dob") || null,
      parents: window.serializeCasDetails(v177.get("parents") || null),
      mobile: v177.get("mobile") || null
    };
    const v180 = v176.target.querySelector("button[type=\"submit\"]");
    v180.disabled = true;
    const v181 = v180.innerHTML;
    v180.innerHTML = "<div class=\"spinner\" style=\"width:14px;height:14px;display:inline-block\"></div> Saving...";
    try {
      const {
        error: v182
      } = await v1.from("students").update(v179).eq("id", v171);
      if (v182) {
        throw v182;
      }
      window.closeModal();
      toast("Student updated successfully!");
      await loadStudents();
    } catch (v183) {
      console.error("Error updating student:", v183);
      toast("Error updating: " + (v183.message || JSON.stringify(v183)));
    } finally {
      v180.disabled = false;
      v180.innerHTML = v181;
    }
  });
};
window.deleteStudent = async function (v184) {
  if (!confirm("Are you sure you want to delete this student?")) {
    return;
  }
  try {
    toast("Deleting related records...");
    await Promise.all([
      v1.from("attendance").delete().eq("student_id", v184),
      v1.from("marks").delete().eq("student_id", v184),
      v1.from("student_practical_marks").delete().eq("student_id", v184),
      v1.from("cas_student_portfolio_log").delete().eq("student_id", v184),
      v1.from("cas_weekly_logs").delete().eq("student_id", v184),
      v1.from("hw_status").delete().eq("student_id", v184),
      v1.from("ai_reports").delete().eq("student_id", v184),
      v1.from("leave_applications").delete().eq("student_id", v184),
      v1.from("transactions").delete().eq("student_id", v184),
      v1.from("fees").delete().eq("student_id", v184)
    ]);

    const {
      error: v185
    } = await v1.from("students").delete().eq("id", v184);
    if (v185) {
      throw v185;
    }
    toast("Student deleted successfully!");
    await loadStudents();
  } catch (v186) {
    console.error("Error deleting student:", v186);
    toast("Error deleting student: " + (v186.message || JSON.stringify(v186)));
  }
};
window.updateClassFilters = function () {
  const v187 = new Set();
  allStudents.forEach(v192 => {
    if (v192.class) {
      v187.add(v192.class.trim().toLowerCase());
    }
  });
  const v188 = CLASS_OPTIONS.filter(v193 => v187.size === 0 || v187.has(v193.toLowerCase()));
  const v189 = v188.length > 0 ? v188 : CLASS_OPTIONS;
  const v190 = v189.map(v194 => "<option value=\"" + escapeHtml(v194) + "\">" + escapeHtml(v194) + "</option>").join("");
  const v191 = ["student-class-filter", "att-class-filter", "marks-class", "report-att-class", "report-nepali-att-class", "report-hw-class", "parent-class-filter"];
  v191.forEach(v195 => {
    const v196 = document.getElementById(v195);
    if (v196) {
      const v197 = v196.value;
      v196.innerHTML = "<option value=\"\">All Classes</option>" + v190;
      if (v197 && v189.includes(v197)) {
        v196.value = v197;
      }
    }
  });
};
window.loadAttendanceData = async function (v198 = false) {
  const v199 = document.getElementById("att-date");
  if (v199 && !v199.value) {
    v199.value = getLocalToday();
  }
  const v200 = v199?.value || currentAttendanceDate;
  currentAttendanceDate = v200;
  let v201 = v200;
  if (window.NepaliFunctions) {
    v201 = window.NepaliFunctions.BS2AD(v200, "YYYY-MM-DD", "YYYY-MM-DD") || v200;
  }
  const v202 = "att_" + v200;
  const v203 = Date.now();
  if (!v198 && lastFetch[v202] && v203 - lastFetch[v202] < 60000 && attDataCache[v202]) {
    allAttendance = attDataCache[v202];
    renderAttendanceTable();
    return;
  }
  try {
    const v204 = document.getElementById("att-class-filter")?.value || "";
    let v205 = v1.from("attendance").select("id, date, status, students(name, roll, class)").eq("date", v201);
    const {
      data: v206,
      error: v207
    } = await v205;
    if (v207) {
      throw v207;
    }
    let v208 = v206 || [];
    if (v204) {
      v208 = v208.filter(v209 => v209.students?.class === v204);
    }
    allAttendance = v208;
    attDataCache[v202] = v208;
    lastFetch[v202] = v203;
    renderAttendanceTable();
  } catch (v210) {
    console.error("Error loading attendance:", v210);
  }
};
function renderAttendanceTable() {
  const v211 = document.getElementById("attendance-table-wrap");
  if (!v211) {
    return;
  }
  if (allAttendance.length === 0) {
    v211.innerHTML = "<div class=\"empty-state\"><i data-lucide=\"clipboard\" style=\"width:48px;height:48px;color:var(--text-muted);opacity:0.3\"></i><p>No records for this date</p></div>";
    return;
  }
  const v212 = {};
  allAttendance.forEach(v214 => {
    const v215 = v214.students?.class || "Unknown";
    if (!v212[v215]) {
      v212[v215] = [];
    }
    v212[v215].push(v214);
  });
  let v213 = "";
  sortClassList(Object.keys(v212)).forEach(v216 => {
    v213 += "<h3 style=\"margin-top: 1rem; margin-bottom: 0.75rem; font-size: 0.95rem;\">" + escapeHtml(v216) + "</h3><div class=\"att-card\">";
    v212[v216].sort((v217, v218) => (parseInt(v217.students?.roll) || 0) - (parseInt(v218.students?.roll) || 0)).forEach(v219 => {
      const v220 = v219.status || "--";
      const v221 = v220 === "P" ? "background:#d1fae5;color:#10b981" : v220 === "A" ? "background:#fee2e2;color:#ef4444" : "background:#ffedd5;color:#f97316";
      v213 += "\n                <div class=\"att-row\">\n                    <div>\n                        <div class=\"att-name\">" + escapeHtml(v219.students?.name || "N/A") + "</div>\n                        <div class=\"att-roll\">Roll: " + (v219.students?.roll || "--") + "</div>\n                    </div>\n                    <div style=\"" + v221 + "; padding: 0.25rem 0.75rem; border-radius: 0.25rem; font-weight: 700; font-size: 0.8rem;\">" + v220 + "</div>\n                </div>";
    });
    v213 += "</div>";
  });
  v211.innerHTML = v213;
  lucide.createIcons();
}
window.loadMarksData = async function (isInitialLoad = false) {
  const classSelect = document.getElementById("marks-class");
  const termSelect = document.getElementById("marks-term");
  if (isInitialLoad && classSelect && termSelect) {
      if (!classSelect.value) classSelect.value = "Nursery";
      if (!termSelect.value) termSelect.value = "First Mid Term";
  }
  const v222 = classSelect?.value;
  const v223 = termSelect?.value;
  const v224 = document.getElementById("marks-table-wrap");
  if (!v224) {
    return;
  }
  try {
    const v226 = await window.fetchAllPaginated((s, e) => {
      let q = v1.from("marks").select("term, subject, value, students(id, name, roll, class)").range(s, e);
      if (v223) q = q.eq("term", v223);
      return q;
    });

    if (!window.subjectsDb) {
      try {
        const { data: sDb } = await v1.from("subjects").select("id, name");
        if (sDb) window.subjectsDb = sDb;
      } catch (err) {}
    }

    let practicalData = [];
    try {
      let pq = v1.from("student_practical_marks").select("student_id, subject_id, total_practical_score, term_id");
      if (v223) {
        let pTerm = v223;
        if (v223 === "First Mid Term") pTerm = "First Term";
        else if (v223 === "Second Mid Term") pTerm = "Second Term";
        else if (v223 === "Third Mid Term") pTerm = "Third Term";
        pq = pq.in("term_id", [v223, pTerm]);
      }
      const { data: pData } = await pq;
      if (pData) practicalData = pData;
    } catch (err) {
      console.warn("Failed to fetch practical marks", err);
    }

    const v227 = null;
    let v228 = v226 || []; console.log('Loaded marks total rows:', v228.length, 'Class filter:', v222, 'Term filter:', v223);
    if (v222) {
      v228 = v228.filter(v233 => v233.students?.class === v222);
    }
    if (!v228.length) {
      v224.innerHTML = "<div class=\"empty-state\"><i data-lucide=\"bar-chart-2\" style=\"width:48px;height:48px;color:var(--text-muted);opacity:0.3\"></i><p>No marks found.</p></div>";
      lucide.createIcons();
      return;
    }
    const v229 = {};
    v228.forEach(v234 => {
      const v235 = v234.students?.name;
      if (!v229[v235]) {
        v229[v235] = {
          ...v234.students,
          subjects: {}
        };
      }
      const normSub = window.normalizeSubjectName ? window.normalizeSubjectName(v234.subject) : v234.subject;
      v229[v235].subjects[normSub] = v234.value;
    });
    const v230 = [...new Set(v228.map(v236 => window.normalizeSubjectName ? window.normalizeSubjectName(v236.subject) : v236.subject))].filter(s => !s.startsWith('FINAL_GPA_')).sort();
    let v231 = "<div style=\"overflow-x:auto\"><table class=\"marks-table\"><thead><tr><th>Name</th><th>Roll</th><th>Class</th>";
    v230.forEach(v237 => v231 += "<th>" + escapeHtml(v237) + "</th>");
    v231 += "<th>Total</th><th>Average</th><th>GPA</th><th>Grade</th></tr></thead><tbody>";
      const v232 = v223 && (
        v223.toLowerCase().includes("mid") || 
        v223.toLowerCase() === "first term" || 
        v223.toLowerCase() === "second term" || 
        v223.toLowerCase() === "third term" ||
        v223.toLowerCase() === "first terminal" ||
        v223.toLowerCase() === "second terminal" ||
        v223.toLowerCase() === "third terminal"
      );
    function getFallbackSubjectConfig(subjectName, cls) {
        const sub = (subjectName || "").toLowerCase().trim();
        const isPrimary = cls && (cls.toLowerCase().includes("nursery") || cls.toLowerCase().includes("lkg") || cls.toLowerCase().includes("ukg") || cls.toLowerCase().includes("pg") || cls.toLowerCase().includes("grade 1") || cls.toLowerCase().includes("grade 2") || cls.toLowerCase().includes("grade 3") || cls.toLowerCase().includes("class 1") || cls.toLowerCase().includes("class 2") || cls.toLowerCase().includes("class 3"));
        
        let thFull = 75, prFull = 25, credit = 4;
        
        if (isPrimary) {
            thFull = 100; prFull = 0;
            if (sub.includes("oral") || sub.includes("computer") || sub.includes("moral") || sub === "gk" || sub.includes("general knowledge") || sub.includes("drawing") || sub.includes("rhyme") || sub.includes("hygiene") || sub === "com" || sub === "mor" || sub === "dra") {
                thFull = 50; prFull = 0; credit = 2;
            } else if (sub.includes("local") || sub === "lc" || sub === "loc") {
                thFull = 50; prFull = 0; credit = 3;
            } else if (sub.includes("nepali") || sub === "nep" || sub === "नेपाली") credit = 4;
            else if (sub.includes("english") || sub === "eng" || sub === "अंग्रेजी") credit = 4;
            else if (sub.includes("math") || sub === "mat" || sub === "गणित") credit = 4;
            else if (sub.includes("science") || sub === "sci" || sub === "विज्ञान") credit = 4;
            else if (sub.includes("serofero") || sub.includes("surroundings") || sub === "mer" || sub.includes("सेरोफेरो")) credit = 4;
            else credit = 2;
        } else {
            if (sub.includes("oral") || sub.includes("moral") || sub === "gk" || sub.includes("general knowledge") || sub.includes("drawing") || sub.includes("rhyme") || sub.includes("hygiene") || sub === "mor" || sub === "dra") {
                thFull = 50; prFull = 0; credit = 2;
            } else if (sub === "math" || sub === "mathematics" || sub === "mat" || sub.includes("o.math") || sub.includes("opt. math") || sub.includes("optional math") || sub.includes("opt math") || sub.includes("account")) {
                thFull = 100; prFull = 0; credit = 4;
            } else if (sub.includes("computer") || sub === "com" || sub.includes("grammar")) {
                thFull = 50; prFull = 50; credit = 2;
            } else if (sub.includes("health") || sub.includes("physical") || sub.includes("creative") || sub.includes("hpe") || sub === "hea") {
                thFull = 75; prFull = 25; credit = 3;
            }
        }
        const total = thFull + prFull;
        return { thFull, prFull, creditHour: credit, thCreditHour: total > 0 ? (thFull/total)*credit : credit, prCreditHour: total > 0 ? (prFull/total)*credit : 0 };
    }

    function getSubjectTheoryCredit(sub, className) {
        if (!sub) return 3;
        if (sub.thCreditHour !== undefined && sub.thCreditHour !== null && !isNaN(parseFloat(sub.thCreditHour))) {
            return parseFloat(sub.thCreditHour);
        }
        if (sub.creditHour) {
            return Math.round(sub.creditHour * 0.75 * 2) / 2;
        }
        return getFallbackSubjectConfig(sub.name, className).thCreditHour;
    }
    
    function getSubjectPracticalCredit(sub, className) {
        if (!sub) return 0;
        if (sub.prCreditHour !== undefined && sub.prCreditHour !== null && !isNaN(parseFloat(sub.prCreditHour))) {
            return parseFloat(sub.prCreditHour);
        }
        if (sub.creditHour) {
            const thCh = getSubjectTheoryCredit(sub, className);
            return Math.max(0, sub.creditHour - thCh);
        }
        return getFallbackSubjectConfig(sub.name, className).prCreditHour;
    }

    function getSubjectFullMarks(sub, className) {
        let th = parseFloat(sub.thFull);
        let pr = parseFloat(sub.prFull);
        if (isNaN(th) || isNaN(pr)) {
            const fallback = getFallbackSubjectConfig(sub.name, className);
            th = isNaN(th) ? fallback.thFull : th;
            pr = isNaN(pr) ? fallback.prFull : pr;
        }
        return { thFull: th, prFull: pr };
    }
    
    function getMidTermSubjectFullMarks(subject, cls) {
        const fm = getSubjectFullMarks(subject, cls);
        const totalFM = fm.thFull + fm.prFull;
        const midFM = Math.round(totalFM * 0.5 * 2) / 2;
        return { thFull: midFM, prFull: 0 };
    }
    
    function getGradeFromPercentage(percentage) {
        if(percentage >= 90) return { grade: 'A+', point: 4.0 };
        if(percentage >= 80) return { grade: 'A', point: 3.6 };
        if(percentage >= 70) return { grade: 'B+', point: 3.2 };
        if(percentage >= 60) return { grade: 'B', point: 2.8 };
        if(percentage >= 50) return { grade: 'C+', point: 2.4 };
        if(percentage >= 40) return { grade: 'C', point: 2.0 };
        if(percentage >= 35) return { grade: 'D', point: 1.6 };
        return { grade: 'NG', point: 0.0 };
    }

    let studentsArray = Object.values(v229);
    studentsArray.sort((a, b) => {
        const rollA = parseInt(a.roll) || 999999;
        const rollB = parseInt(b.roll) || 999999;
        return rollA - rollB;
    });

    studentsArray.forEach(v238 => {
      let totalWeightedGpa = 0;
      let totalCreditHours = 0;
      let ngCount = 0;
      let totalMarks = 0;
      let totalMaxMarks = 0;

      v230.forEach(v245 => {
        const s = v245.toLowerCase().trim();
        const subjectObj = window.subjectsDb?.find(sub => (window.normalizeSubjectName ? window.normalizeSubjectName(sub.name) : sub.name).toLowerCase().trim() === s) || { name: v245, thFull: 75, prFull: 25 };
        
        let termTh = 0;
        let termPr = 0;
        
        let v113Raw = v238.subjects[v245];
        if (v113Raw === '' || v113Raw === null || v113Raw === undefined || isNaN(parseInt(v113Raw))) {
            termTh = 0;
        } else {
            termTh = parseFloat(v113Raw);
        }
        
        let v114 = 0;
        if (!v232) {
          const pMarkObj = practicalData.find(p => {
            if (String(p.student_id) !== String(v238.id)) return false;
            const pSubName = window.subjectsDb?.find(sub => sub.id === p.subject_id)?.name || p.subject_id;
            const normPSub = (window.normalizeSubjectName ? window.normalizeSubjectName(pSubName) : pSubName).toLowerCase().trim();
            return normPSub === s;
          });
          if (pMarkObj) {
            v114 = parseFloat(pMarkObj.total_practical_score) || 0;
          }
        }
        termPr = v114;

        if (v113Raw !== '' && v113Raw !== null && v113Raw !== undefined && !isNaN(parseInt(v113Raw))) {
            const fm = v232 ? getMidTermSubjectFullMarks(subjectObj, v238.class) : getSubjectFullMarks(subjectObj, v238.class);
            const thFull = fm.thFull;
            const prFull = fm.prFull;
            
            let thCh = getSubjectTheoryCredit(subjectObj, v238.class);
            let prCh = getSubjectPracticalCredit(subjectObj, v238.class);
            if (v232 && prFull === 0) {
                thCh = thCh + prCh;
                prCh = 0;
            }
            
            totalMarks += (termTh + termPr);
            totalMaxMarks += (thFull + prFull);
            
            const thPercentage = thFull > 0 ? (termTh / thFull) * 100 : 0;
            const prPercentage = prFull > 0 ? (termPr / prFull) * 100 : 0;
            
            let thPass = thFull > 0 ? thPercentage >= 35 : true;
            let prPass = prFull > 0 ? prPercentage >= 35 : true;
            
            let thGradeData = getGradeFromPercentage(thPercentage);
            let prGradeData = getGradeFromPercentage(prPercentage);
            
            if(!thPass) { thGradeData = { grade: 'NG', point: 0.0 }; }
            if(!prPass) { prGradeData = { grade: 'NG', point: 0.0 }; }
            if(!thPass || !prPass) { ngCount++; }
            
            if(thFull > 0) { totalWeightedGpa += (thGradeData.point * thCh); totalCreditHours += thCh; }
            if(prFull > 0) { totalWeightedGpa += (prGradeData.point * prCh); totalCreditHours += prCh; }
        }
      });
      
      const v241 = totalMaxMarks > 0 ? Math.round((totalMarks / totalMaxMarks) * 100) : 0;
      const v242 = v241 >= 90 ? "A+" : v241 >= 80 ? "A" : v241 >= 70 ? "B+" : v241 >= 60 ? "B" : v241 >= 50 ? "C+" : v241 >= 40 ? "C" : v241 >= 35 ? "D" : "NG";
      const v243 = v241 >= 90 ? "#10b981" : v241 >= 75 ? "#059669" : v241 >= 60 ? "#2563eb" : v241 >= 40 ? "#d97706" : "#dc2626";
      
      const isNG = ngCount > 3;
      let finalGpa = "—";
      let finalGpaKey = Object.keys(v238.subjects).find(k => k.startsWith('FINAL_GPA_'));
      if (finalGpaKey !== undefined) {
        let pushedGpaVal = parseInt(finalGpaKey.split('_')[2]);
        if (!isNaN(pushedGpaVal)) {
            finalGpa = (pushedGpaVal / 100).toFixed(2);
            if (pushedGpaVal === 0 && isNG) finalGpa = 'NG';
        }
      } else if (totalCreditHours > 0) {
          finalGpa = isNG ? 'NG' : (totalWeightedGpa / totalCreditHours).toFixed(2);
      }

      v231 += "<tr><td>" + escapeHtml(v238.name) + "</td><td>" + v238.roll + "</td><td>" + escapeHtml(v238.class) + "</td>";
      v230.forEach(v246 => {
        let v113 = parseInt(v238.subjects[v246]);
        if (!isNaN(v113)) {
          let v114 = 0;
          if (!v232) {
            const pMarkObj = practicalData.find(p => {
              if (String(p.student_id) !== String(v238.id)) return false;
              const pSubName = window.subjectsDb?.find(sub => sub.id === p.subject_id)?.name || p.subject_id;
              const normPSub = (window.normalizeSubjectName ? window.normalizeSubjectName(pSubName) : pSubName).toLowerCase().trim();
              return normPSub === v246.toLowerCase().trim();
            });
            if (pMarkObj) {
              v114 = parseFloat(pMarkObj.total_practical_score) || 0;
            }
          }
          if (v114 > 0) {
            v231 += "<td style=\"text-align:center\">" + (v113 + v114) + "<div style=\"font-size:0.6rem;color:var(--text-muted);margin-top:2px;\">TH:" + v113 + "+PR:" + v114 + "</div></td>";
          } else {
            v231 += "<td style=\"text-align:center\">" + v113 + "</td>";
          }
        } else {
          v231 += "<td style=\"text-align:center\">—</td>";
        }
      });
      v231 += "<td style=\"text-align:center;font-weight:700\">" + totalMarks + "</td>";
      v231 += "<td style=\"text-align:center;font-weight:700\">" + v241 + "%</td>";
      v231 += "<td style=\"text-align:center;font-weight:900;color:var(--primary)\">" + finalGpa + "</td>";
      v231 += "<td style=\"text-align:center;font-weight:800;color:" + v243 + "\">" + v242 + "</td></tr>";
    });
    v231 += "</tbody></table></div>";
    v224.innerHTML = v231;
    lucide.createIcons();
  } catch (v247) {
    console.error(v247);
    v224.innerHTML = "<p>Error loading marks.</p>";
  }
};
const _normClass = v248 => {
  if (!v248) return "";
  let clean = String(v248).trim().toLowerCase();
  
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
  
  return v248;
};
const ABBR_MAP_ADMIN = {
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
window.adminImportMarks = async function (v252) {
  const v253 = v252.target.files[0];
  if (!v253) {
    return;
  }
  v252.target.value = "";
  toast("Reading marks file...", 3000);
  try {
    const v254 = document.getElementById("marks-term")?.value || "";
    if (!v254) {
      toast("Please select a Term before importing", 4000);
      return;
    }
    const v255 = await v253.arrayBuffer();
    const v256 = XLSX.read(v255, {
      type: "array"
    });
    const v257 = [];
    let v258 = 0;
    for (const v260 of v256.SheetNames) {
      const v261 = v256.Sheets[v260];
      const v262 = XLSX.utils.sheet_to_json(v261, {
        header: 1,
        defval: ""
      });
      if (!v262 || v262.length < 3) {
        continue;
      }
      let v263 = null;
      const v264 = v262[0].join(" ");
      const v265 = v264.match(/class\s*[:\-]?\s*(\d+)/i);
      v263 = v265 ? _normClass(v265[1]) : _normClass(v260);
      let v266 = -1;
      let v267 = -1;
      for (let v275 = 0; v275 < Math.min(v262.length, 15); v275++) {
        const v276 = v262[v275].map(v277 => String(v277).trim().toUpperCase());
        if (v276.filter(v278 => v278 === "TH").length >= 2 && v276.filter(v279 => v279 === "PR").length >= 2) {
          v267 = v275;
          v266 = v275 - 1;
          break;
        }
      }
      if (v267 === -1) {
        continue;
      }
      const v268 = v262[v266];
      const v269 = v262[v267];
      const v270 = ["ROLL NO", "ROLL", "NAME", "SN", "GPA", "RANK", "ATTENDANCE", "TOTAL", "PERCENT", ""];
      const v271 = {};
      let v272 = null;
      for (let v280 = 0; v280 < v269.length; v280++) {
        const v281 = String(v268[v280] || "").trim().toUpperCase();
        if (v281 && !v270.includes(v281)) {
          v272 = v281;
        }
        const v282 = String(v269[v280] || "").trim().toUpperCase();
        if (!v272) {
          continue;
        }
        if (v282 === "TH") {
          if (!v271[v272]) {
            v271[v272] = {};
          }
          v271[v272].th = v280;
        } else if (v282 === "PR") {
          if (!v271[v272]) {
            v271[v272] = {};
          }
          v271[v272].pr = v280;
        }
      }
      let v273 = -1;
      let v274 = -1;
      for (let v283 = 0; v283 < v268.length; v283++) {
        const v284 = String(v268[v283] || "").trim().toLowerCase();
        const v285 = String(v269[v283] || "").trim().toLowerCase();
        if (v284.includes("roll") || v285.includes("roll")) {
          v273 = v283;
        }
        if (v284.includes("name") || v285.includes("name")) {
          v274 = v283;
        }
      }
      for (let v286 = v267 + 1; v286 < v262.length; v286++) {
        const v287 = v262[v286];
        if (!v287 || v287.every(v292 => v292 === "" || v292 == null)) {
          continue;
        }
        const v288 = v273 !== -1 ? String(v287[v273] || "").trim() : "";
        const v289 = v274 !== -1 ? String(v287[v274] || "").trim() : "";
        if (!v288 || !v289) {
          continue;
        }
        if (v288.toLowerCase().includes("roll") || v289.toLowerCase().includes("name")) {
          continue;
        }
        if (v289.toLowerCase().includes("total") || v289.toLowerCase().includes("average")) {
          continue;
        }
        const v290 = allStudents.find(v293 => String(v293.roll).trim() === v288 && String(v293.class).trim().toLowerCase() === (v263 || "").toLowerCase());
        if (!v290) {
          console.warn("No match: Roll=" + v288 + " Class=" + v263);
          continue;
        }
        let v291 = false;
        for (const [v294, v295] of Object.entries(v271)) {
          const v296 = v295.th !== undefined ? String(v287[v295.th] || "").trim() : "";
          const v297 = v295.pr !== undefined ? String(v287[v295.pr] || "").trim() : "";
          if ((v296 === "" || v296 === "-") && (v297 === "" || v297 === "-")) {
            continue;
          }
          const v298 = v296 === "" || v296 === "-" ? 0 : parseFloat(v296) || 0;
          const v299 = v297 === "" || v297 === "-" ? 0 : parseFloat(v297) || 0;
          const v300 = Math.max(0, Math.round(v298 + v299));
          const v301 = ABBR_MAP_ADMIN[v294.toUpperCase()];
          const v302 = v301 ? allSubjects.find(v303 => v303.toLowerCase() === v301.toLowerCase()) || v301 : allSubjects.find(v304 => v304.toUpperCase() === v294 || v304.toUpperCase().startsWith(v294) || v294.startsWith(v304.toUpperCase())) || v294;
          const finalSubject = window.normalizeSubjectName ? window.normalizeSubjectName(v302) : v302;
          v257.push({
            term: v254,
            student_id: v290.id,
            subject: finalSubject,
            value: v300,
            theory_marks: v298,
            practical_marks: v299,
            teacher_id: window.currentUser?.id || null
          });
          v291 = true;
        }
        if (v291) {
          v258++;
        }
      }
    }
    if (!v257.length) {
      toast("No marks found to import. Check file format.", 4000);
      return;
    }
    const {
      error: v259
    } = await v1.from("marks").upsert(v257, {
      onConflict: "term,student_id,subject"
    });
    if (v259) {
      toast("Supabase error: " + v259.message, 4000);
      return;
    }
    toast("Imported marks for " + v258 + " student(s) — " + v257.length + " records!");
    await window.loadMarksData();
  } catch (v305) {
    console.error("adminImportMarks error", v305);
    toast("Import error: " + v305.message, 4000);
  }
};
window.exportMarksExcel = async function () {
  try {
    toast("Preparing marks export...", 2000);
    const v306 = document.getElementById("marks-class")?.value || "";
    const v307 = document.getElementById("marks-term")?.value || "";
    const v309 = await window.fetchAllPaginated((s, e) => {
      let q = v1.from("marks").select("term, subject, value, students(name, roll, class)").range(s, e);
      if (v307) q = q.eq("term", v307);
      return q;
    });
    const v310 = null;
    let v311 = v309 || [];
    if (v306) {
      v311 = v311.filter(v317 => v317.students?.class === v306);
    }
    if (!v311.length) {
      toast("No marks to export");
      return;
    }
    const v312 = {};
    v311.forEach(v318 => {
      const v319 = v318.students?.class || "Unknown";
      if (!v312[v319]) {
        v312[v319] = {};
      }
      const v320 = v318.students?.name + "||" + v318.students?.roll;
      if (!v312[v319][v320]) {
        v312[v319][v320] = {
          name: v318.students?.name,
          roll: v318.students?.roll,
          class: v319,
          term: v318.term,
          subjects: {}
        };
      }
      const normSub = window.normalizeSubjectName ? window.normalizeSubjectName(v318.subject) : v318.subject;
      v312[v319][v320].subjects[normSub] = v318.value;
    });
    const v313 = XLSX.utils.book_new();
    for (const [v321, v322] of Object.entries(v312)) {
      const v323 = [...new Set(v311.filter(v325 => v325.students?.class === v321).map(v326 => window.normalizeSubjectName ? window.normalizeSubjectName(v326.subject) : v326.subject))].sort();
      const v324 = Object.values(v322).map(v327 => {
        const v328 = {
          Roll: v327.roll,
          Name: v327.name,
          Class: v327.class,
          Term: v327.term
        };
        v323.forEach(v330 => {
          v328[v330] = v327.subjects[v330] ?? "";
        });
        const v329 = v323.reduce((v331, v332) => v331 + (parseInt(v327.subjects[v332]) || 0), 0);
        v328.Total = v329;
        return v328;
      });
      v324.sort((v333, v334) => (parseInt(v333.Roll) || 0) - (parseInt(v334.Roll) || 0));
      XLSX.utils.book_append_sheet(v313, XLSX.utils.json_to_sheet(v324), v321.replace("Grade ", "G"));
    }
    const v314 = new Date().toISOString().split("T")[0];
    const v315 = v307 ? "_" + v307.replace(/\s+/g, "_") : "";
    const v316 = "Marks" + v315 + "_" + v314 + ".xlsx";
    await window.saveExcel(v313, v316);
  } catch (v335) {
    console.error("exportMarksExcel error", v335);
    toast("Export failed: " + v335.message);
  }
};

window.exportEduScoreAdmin = async function (type) {
  try {
    toast(`Preparing EduScore ${type} export...`, 2000);
    const selectedClass = document.getElementById("marks-class")?.value || "";
    const selectedTerm = document.getElementById("marks-term")?.value || "";
    
    const data = await window.fetchAllPaginated((s, e) => {
      let q = v1.from("marks").select("term, subject, theory_marks, practical_marks, students(name, roll, class)").range(s, e);
      if (selectedTerm) q = q.eq("term", selectedTerm);
      return q;
    });
    const error = null;
    
    let marksData = data || [];
    if (selectedClass) {
      marksData = marksData.filter(m => m.students?.class === selectedClass);
    }
    
    if (!marksData.length) {
      toast("No marks found to export for EduScore.");
      return;
    }
    
    const dataByClass = {};
    marksData.forEach(m => {
      const cls = m.students?.class || "Unknown";
      if (!dataByClass[cls]) dataByClass[cls] = {};
      
      const studentKey = m.students?.name + "||" + m.students?.roll;
      if (!dataByClass[cls][studentKey]) {
        dataByClass[cls][studentKey] = {
          name: m.students?.name,
          roll: m.students?.roll,
          class: cls,
          term: m.term,
          subjects: {}
        };
      }
      const normSub = window.normalizeSubjectName ? window.normalizeSubjectName(m.subject) : m.subject;
      // Depending on type, pull theory_marks or practical_marks
      dataByClass[cls][studentKey].subjects[normSub] = type === "theory" ? m.theory_marks : m.practical_marks;
    });
    
    const wb = XLSX.utils.book_new();
    for (const [cls, students] of Object.entries(dataByClass)) {
      const classLevel = window.getClassLevel ? window.getClassLevel(cls) : "Basic";
      
      // Filter subjects for EduScore exactly like in app-core.js
      let allSubjects = [...new Set(marksData.filter(m => m.students?.class === cls).map(m => window.normalizeSubjectName ? window.normalizeSubjectName(m.subject) : m.subject))].sort();
      
      const filteredSubjects = allSubjects.filter(sub => {
        const lowerSub = sub.toLowerCase().trim();
        const ignoreList = ["grammar", "moral", "g.k.", "byakaran", "drawing", "workbook", "conversation", "handwriting", "dictation", "rhymes"];
        if (ignoreList.some(ig => lowerSub === ig || lowerSub.includes(ig))) return false;
        if (lowerSub === "gk" || lowerSub === "general knowledge" || lowerSub === "computer science" || lowerSub === "computer") return false;
        
        if (classLevel === "Basic" || classLevel === "Primary") {
          if (lowerSub.includes("optional math") || lowerSub.includes("opt math") || lowerSub === "opt. math") return false;
          return true;
        } else {
          if (lowerSub.includes("local subject") || lowerSub.includes("local curriculum") || lowerSub === "lc") return false;
          if (lowerSub.includes("health physical") || lowerSub.includes("health & physical") || lowerSub === "hpe") return false;
          return true;
        }
      });

      const sheetData = Object.values(students).map(s => {
        const row = {
          "Roll No": s.roll || "",
          "Name": s.name,
          "Class": s.class,
          "Term": s.term
        };
        filteredSubjects.forEach(sub => {
          row[sub] = s.subjects[sub] ?? "";
        });
        return row;
      });
      
      sheetData.sort((a, b) => (parseInt(a["Roll No"]) || 0) - (parseInt(b["Roll No"]) || 0));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetData), cls.replace("Grade ", "G").substring(0, 31));
    }
    
    const dateStr = new Date().toISOString().split("T")[0];
    const termStr = selectedTerm ? "_" + selectedTerm.replace(/\s+/g, "_") : "";
    const typeStr = type === "theory" ? "Theory" : "Practical";
    const filename = `EduScore_${typeStr}_Marks${termStr}_${dateStr}.xlsx`;
    
    await window.saveExcel(wb, filename);
    toast(`EduScore ${typeStr} export saved as "${filename}"`);
  } catch (err) {
    console.error("exportEduScoreAdmin error", err);
    toast("Export failed: " + err.message);
  }
};

window.exportAllData = async function () {
  try {
    toast("Preparing full export...", 2000);
    const v336 = XLSX.utils.book_new();
    const {
      data: v337
    } = await v1.from("students").select("name, roll, dob, parents, mobile, class").order("class");
    if (v337?.length) {
      const v342 = v337.map(v343 => ({
        Name: v343.name,
        "Roll No": v343.roll,
        DOB: v343.dob,
        "Parent Name": v343.parents,
        Phone: v343.mobile,
        Class: v343.class
      }));
      XLSX.utils.book_append_sheet(v336, XLSX.utils.json_to_sheet(v342), "Students");
    }
    const {
      data: v338
    } = await v1.from("attendance").select("date, status, students(name, roll, class)");
    if (v338?.length) {
      const v344 = v338.map(v345 => ({
        Date: v345.date,
        Student: v345.students?.name,
        Roll: v345.students?.roll,
        Class: v345.students?.class,
        Status: v345.status
      }));
      XLSX.utils.book_append_sheet(v336, XLSX.utils.json_to_sheet(v344), "Attendance");
    }
    const {
      data: v339
    } = await v1.from("homework").select("date, class, subject, task, due");
    if (v339?.length) {
      XLSX.utils.book_append_sheet(v336, XLSX.utils.json_to_sheet(v339), "Homework");
    }
    const v340 = window.getLocalToday ? window.getLocalToday() : new Date().toISOString().split("T")[0];
    const v341 = "Holy_Garden_Full_Export_" + v340 + ".xlsx";
    await window.saveExcel(v336, v341);
  } catch (v346) {
    console.error(v346);
    toast("Export failed: " + v346.message);
  }
};
function timeAgo(v347) {
  const v348 = new Date(v347);
  const v349 = new Date();
  const v350 = v349 - v348;
  const v351 = Math.round(v350 / 60000);
  const v352 = Math.round(v351 / 60);
  const v353 = Math.round(v352 / 24);
  if (v351 < 1) {
    return "Just now";
  }
  if (v351 < 60) {
    return v351 + " min ago";
  }
  if (v352 < 24) {
    return v352 + " hours ago";
  }
  if (v353 === 1) {
    return "Yesterday";
  }
  return v353 + " days ago";
}
window.viewTeacherDetail = async function (v354) {
  if (!v354) {
    return;
  }
  let v355 = null;
  const v356 = allTeachers.find(v357 => v357.full_name === v354);
  if (v356 && v356.assigned_classes) {
    try {
      const v358 = typeof v356.assigned_classes === "string" ? JSON.parse(v356.assigned_classes) : v356.assigned_classes;
      if (v358 && v358.assignments) {
        const v359 = v358.assignments.find(v360 => v360.isHomeroom);
        if (v359) {
          v355 = v359.className;
        }
      }
    } catch (v361) {}
  }
  openModal("<div style=\"text-align:center;padding:1rem;\">Loading teacher details...</div>");
  try {
    const v362 = window.getLocalToday ? window.getLocalToday() : new Date().toISOString().split("T")[0];
    let v363 = v362;
    if (window.NepaliFunctions) {
      v363 = window.NepaliFunctions.BS2AD(v362, "YYYY-MM-DD", "YYYY-MM-DD") || v362;
    }
    let v364 = "";
    if (v355) {
      const v373 = allStudents.filter(v380 => v380.class === v355);
      const v374 = v373.length;
      const {
        data: v375
      } = await v1.from("attendance").select("student_id, status").eq("date", v363);
      let v376 = 0;
      let v377 = 0;
      const v378 = v375 || [];
      const v379 = new Set(v373.map(v381 => String(v381.id)));
      v378.forEach(v382 => {
        if (v379.has(String(v382.student_id))) {
          if (v382.status === "P") {
            v376++;
          } else if (v382.status === "A") {
            v377++;
          }
        }
      });
      v364 = "\n                <div style=\"margin-bottom:1rem;background:var(--background);padding:0.75rem;border-radius:8px;\">\n                    <p style=\"font-weight:700;font-size:0.85rem;color:var(--text-main);margin-bottom:0.5rem;text-transform:uppercase;\">Homeroom: " + escapeHtml(v355) + "</p>\n                    <div style=\"display:flex;gap:0.5rem;\">\n                        <div style=\"flex:1;text-align:center;\"><div style=\"font-size:1.1rem;font-weight:800;\">" + v374 + "</div><div style=\"font-size:0.7rem;color:var(--text-muted)\">Students</div></div>\n                        <div style=\"flex:1;text-align:center;color:#10b981;\"><div style=\"font-size:1.1rem;font-weight:800;\">" + v376 + "</div><div style=\"font-size:0.7rem;color:var(--text-muted)\">Present</div></div>\n                        <div style=\"flex:1;text-align:center;color:#ef4444;\"><div style=\"font-size:1.1rem;font-weight:800;\">" + v377 + "</div><div style=\"font-size:0.7rem;color:var(--text-muted)\">Absent</div></div>\n                    </div>\n                </div>\n            ";
    }
    const {
      data: v365
    } = await v1.from("homework").select("*").eq("date", v363);
    let v366 = [];
    if (v356) {
      v366 = (v365 || []).filter(v383 => v383.teacher_id === v356.id);
    }
    let v367 = "<h4 style=\"margin-bottom:0.5rem;font-size:0.9rem;\">Today's Homework Given</h4>";
    if (v366.length === 0) {
      v367 += "<p style=\"color:var(--text-muted);font-size:0.8rem;margin-bottom:1rem;\">No homework assigned today.</p>";
    } else {
      v367 += "<div style=\"margin-bottom:1rem;\">";
      v366.forEach(v384 => {
        v367 += "\n                    <div style=\"background:#f8fafc;padding:0.5rem;border-radius:6px;margin-bottom:0.4rem;font-size:0.8rem;border-left:3px solid var(--primary);\">\n                        <strong>" + escapeHtml(v384.subject) + "</strong> (" + escapeHtml(v384.class || "All") + ")\n                        <div style=\"color:var(--text-muted);margin-top:0.25rem;\">" + escapeHtml(v384.task) + "</div>\n                    </div>\n                ";
      });
      v367 += "</div>";
    }
    const {
      data: v368
    } = await v1.from("teacher_activity").select("*").eq("teacher_name", v354).order("created_at", {
      ascending: false
    }).limit(30);
    if (!allStudents || allStudents.length === 0) {
      try {
        const {
          data: v385
        } = await v1.from("students").select("id, name, class, roll, parents, mobile");
        allStudents = sortStudentsList(v385 || []);
      } catch (v386) {
        console.error("Failed to load students cache in viewTeacherDetail:", v386);
      }
    }
    const v369 = [];
    let v370 = null;
    (v368 || []).forEach(v387 => {
      let v388 = null;
      const v389 = String(v387.action).toLowerCase();
      const v390 = v387.details || "";
      const v391 = v389.includes("homework") && v389.includes("track") || v390.includes(":") || v390.includes("student ID");
      if (v391) {
        if (v390.includes(":")) {
          const v392 = v390.split(":");
          if (v392.length >= 2) {
            v388 = {
              name: v392[0].trim(),
              status: v392[1].trim()
            };
          }
        }
        if (!v388) {
          const v393 = v390.match(/Set\s+status\s+([\w\s]+)\s+for\s+student\s+ID\s+([a-zA-Z0-9-]+)/i);
          if (v393) {
            const v394 = v393[1].trim();
            const v395 = v393[2].trim();
            const v396 = allStudents.find(v398 => String(v398.id) === String(v395));
            const v397 = v396 ? v396.name : "Student (" + v395.substring(0, 8) + ")";
            v388 = {
              name: v397,
              status: v394
            };
          }
        }
      }
      if (v388) {
        if (v370 && v370.action === v387.action && v370.teacher_name === v387.teacher_name && new Date(v370.created_at) - new Date(v387.created_at) < 600000) {
          v370.students.push(v388);
        } else {
          if (v370) {
            v369.push(v370);
          }
          v370 = {
            ...v387,
            isGroup: true,
            students: [v388]
          };
        }
      } else {
        if (v370) {
          v369.push(v370);
          v370 = null;
        }
        v369.push(v387);
      }
    });
    if (v370) {
      v369.push(v370);
    }
    v369.sort((v399, v400) => new Date(v400.created_at) - new Date(v399.created_at));
    let v371 = "<h4 style=\"margin-bottom:0.5rem;font-size:0.9rem;\">Recent Activity</h4>";
    if (v369.length === 0) {
      v371 += "<p style=\"color:var(--text-muted);font-size:0.8rem;\">No recent activities.</p>";
    } else {
      v371 += "<div style=\"max-height:220px;overflow-y:auto;border: 1px solid #f1f5f9; border-radius: 6px; padding: 0 0.5rem; display:flex; flex-direction:column; gap:0.15rem;\">";
      v369.slice(0, 10).forEach((v401, v402) => {
        let v403 = "";
        const v404 = String(v401.action).toLowerCase();
        if (v401.isGroup) {
          const v405 = {
            Done: [],
            "Not Done": [],
            Incomplete: [],
            Partial: [],
            Absent: []
          };
          v401.students.forEach(v407 => {
            const v408 = v407.status;
            if (v408 === "Done") {
              v405.Done.push(v407.name);
            } else if (v408 === "Not Done") {
              v405["Not Done"].push(v407.name);
            } else if (v408 === "Incomplete" || v408 === "Partial") {
              v405.Partial.push(v407.name);
            } else if (v408 === "Absent") {
              v405.Absent.push(v407.name);
            } else {
              if (!v405[v408]) {
                v405[v408] = [];
              }
              v405[v408].push(v407.name);
            }
          });
          const v406 = [];
          if (v405.Done.length > 0) {
            v406.push("<div style=\"margin-bottom: 0.1rem;\"><span style=\"color:#10b981;font-weight:700;\">Done (" + v405.Done.length + "):</span> <span style=\"color:var(--text-main);\">" + escapeHtml(v405.Done.join(", ")) + "</span></div>");
          }
          if (v405["Not Done"].length > 0) {
            v406.push("<div style=\"margin-bottom: 0.1rem;\"><span style=\"color:#ef4444;font-weight:700;\">Not Done (" + v405["Not Done"].length + "):</span> <span style=\"color:var(--text-main);\">" + escapeHtml(v405["Not Done"].join(", ")) + "</span></div>");
          }
          if (v405.Partial.length > 0) {
            v406.push("<div style=\"margin-bottom: 0.1rem;\"><span style=\"color:#f59e0b;font-weight:700;\">Partial (" + v405.Partial.length + "):</span> <span style=\"color:var(--text-main);\">" + escapeHtml(v405.Partial.join(", ")) + "</span></div>");
          }
          if (v405.Absent.length > 0) {
            v406.push("<div style=\"margin-bottom: 0.1rem;\"><span style=\"color:var(--text-muted);font-weight:700;\">Absent (" + v405.Absent.length + "):</span> <span style=\"color:var(--text-main);\">" + escapeHtml(v405.Absent.join(", ")) + "</span></div>");
          }
          Object.keys(v405).forEach(v409 => {
            if (["Done", "Not Done", "Incomplete", "Partial", "Absent"].includes(v409)) {
              return;
            }
            if (v405[v409].length > 0) {
              v406.push("<div style=\"margin-bottom: 0.1rem;\"><span style=\"font-weight:700;\">" + escapeHtml(v409) + " (" + v405[v409].length + "):</span> <span style=\"color:var(--text-main);\">" + escapeHtml(v405[v409].join(", ")) + "</span></div>");
            }
          });
          v403 = "<div style=\"display:flex;flex-direction:column;gap:0.1rem;margin-top:0.2rem;font-size:0.75rem;line-height:1.3;\">" + v406.join("") + "</div>";
        } else {
          let v410 = v401.details || "";
          if (v404.includes("homework") && v404.includes("track") && v410.includes("student ID")) {
            const v411 = v410.match(/Set\s+status\s+([\w\s]+)\s+for\s+student\s+ID\s+([a-zA-Z0-9-]+)/i);
            if (v411) {
              const v412 = v411[1].trim();
              const v413 = v411[2].trim();
              const v414 = allStudents.find(v416 => String(v416.id) === String(v413));
              const v415 = v414 ? v414.name : "Student (" + v413.substring(0, 8) + ")";
              v410 = v415 + ": " + v412;
            }
          }
          v403 = "<div style=\"color:var(--text-muted);margin-top:0.2rem;\">" + escapeHtml(v410) + "</div>";
        }
        v371 += "\n                    <div style=\"padding:0.5rem 0;font-size:0.8rem;" + (v402 < Math.min(v369.length, 10) - 1 ? "border-bottom:1px solid #f1f5f9;" : "") + "\">\n                        <span style=\"color:var(--text-muted);float:right;\">" + timeAgo(v401.created_at) + "</span>\n                        <strong>" + escapeHtml(v401.action) + "</strong>\n                        " + v403 + "\n                    </div>\n                ";
      });
      v371 += "</div>";
    }
    const v372 = "\n            <div class=\"modal-handle\"></div>\n            <p class=\"modal-title\" style=\"margin-bottom:1rem;font-size:1.1rem;color:var(--primary);\">" + escapeHtml(v354) + "</p>\n            " + v364 + "\n            " + v367 + "\n            " + v371 + "\n            <button class=\"btn btn-primary btn-block\" style=\"margin-top:1.5rem;\" onclick=\"closeModal()\"><i data-lucide=\"check-circle\"></i> Close</button>\n        ";
    openModal(v372);
  } catch (v417) {
    console.error("viewTeacherDetail error", v417);
    openModal("<div class=\"modal-handle\"></div><p style=\"text-align:center;color:var(--error);padding:2rem;\">Failed to load details.</p><button class=\"btn btn-primary btn-block\" onclick=\"closeModal()\">Close</button>");
  }
};
window.loadActivityLog = async function (v418 = false, v419 = undefined) {
  const v420 = document.getElementById("activity-feed");
  const v421 = document.getElementById("activity-summary");
  if (!v420 || !v421) {
    return;
  }
  if (v419 !== undefined) {
    selectedActivityTeacherId = v419;
  }
  const v422 = document.getElementById("activity-date-filter")?.value || "";
  const v423 = Date.now();
  const v424 = "admin_activity_" + (v422 || "today") + "_" + (selectedActivityTeacherId || "all");
  if (!v418 && lastFetch[v424] && v423 - lastFetch[v424] < 60000 && activityCache[v424]) {
    console.log("Using cached activity log");
    v421.innerHTML = activityCache[v424].summaryHtml;
    v420.innerHTML = activityCache[v424].feedHtml;
    if (window.lucide) {
      lucide.createIcons();
    }
    return;
  }
  try {
    v420.innerHTML = "<div style=\"text-align:center;padding:2rem;color:var(--text-muted)\">Loading activity...</div>";
    const v425 = window.getLocalToday ? window.getLocalToday() : new Date().toISOString().split("T")[0];
    const v426 = v422 || v425;
    let v427 = v426;
    if (window.NepaliFunctions) {
      v427 = window.NepaliFunctions.BS2AD(v426, "YYYY-MM-DD", "YYYY-MM-DD") || v426;
    }
    let v428 = v1.from("teacher_activity").select("*").order("created_at", {
      ascending: false
    }).limit(50);
    if (selectedActivityTeacherId) {
      v428 = v428.eq("teacher_id", selectedActivityTeacherId);
    }
    if (v427) {
      v428 = v428.gte("created_at", v427 + "T00:00:00.000Z").lte("created_at", v427 + "T23:59:59.999Z");
    } else {
      v428 = v428.limit(200);
    }
    const {
      data: v429,
      error: v430
    } = await v428;
    if (v430) {
      throw v430;
    }
    const {
      data: v431,
      error: v432
    } = await v1.from("attendance").select("date, students(class)").eq("date", v427);
    if (v432) {
      throw v432;
    }
    const {
      data: v433,
      error: v434
    } = await v1.from("homework").select("*").eq("date", v427);
    if (v434) {
      throw v434;
    }
    const v435 = v429 || [];
    let v436 = v435;
    let v437 = v431 || [];
    let v438 = v433 || [];
    const v439 = document.getElementById("activity-teacher-filter")?.value || "";
    const v440 = allTeachers.find(v456 => v456.id === v439);
    const v441 = v440 ? v440.full_name : "";
    if (v441) {
      v436 = v435.filter(v457 => v457.teacher_name === v441);
      v437 = (v431 || []).filter(v458 => v458.teacher_id === v439 || true);
      v438 = (v433 || []).filter(v459 => v459.teacher_id === v439);
    }
    const v442 = new Set();
    v437.forEach(v460 => {
      if (v460.students?.class) {
        v442.add(v460.students.class);
      }
    });
    const v443 = v442.size;
    const v444 = v438.length;
    const v445 = v436.filter(v461 => v461.created_at.startsWith(v427));
    const v446 = new Set(v445.map(v462 => v462.teacher_name).filter(Boolean)).size;
    v421.innerHTML = "\n            <div class=\"stat-pill\" style=\"flex:1\">\n                <i data-lucide=\"calendar-check\" style=\"width:16px;height:16px;color:var(--primary);margin-right:0.25rem;\"></i>\n                <div><div class=\"num\">" + v443 + "</div><div class=\"lbl\">Classes Marked</div></div>\n            </div>\n            <div class=\"stat-pill\" style=\"flex:1\">\n                <i data-lucide=\"book-open\" style=\"width:16px;height:16px;color:var(--primary);margin-right:0.25rem;\"></i>\n                <div><div class=\"num\">" + v444 + "</div><div class=\"lbl\">HW Given</div></div>\n            </div>\n            <div class=\"stat-pill\" style=\"flex:1\">\n                <i data-lucide=\"users\" style=\"width:16px;height:16px;color:var(--primary);margin-right:0.25rem;\"></i>\n                <div><div class=\"num\">" + v446 + "</div><div class=\"lbl\">Teachers Active</div></div>\n            </div>\n        ";
    const v447 = {};
    v445.forEach(v463 => {
      const v464 = v463.teacher_name;
      if (!v464) {
        return;
      }
      if (!v447[v464]) {
        v447[v464] = {
          count: 0,
          lastAction: v463.created_at
        };
      }
      v447[v464].count++;
      if (new Date(v463.created_at) > new Date(v447[v464].lastAction)) {
        v447[v464].lastAction = v463.created_at;
      }
    });
    const v448 = document.getElementById("activity-teacher-filter");
    if (v448) {
      v448.innerHTML = "<option value=\"\">All Teachers</option>" + allTeachers.map(v465 => "<option value=\"" + v465.id + "\">" + escapeHtml(v465.full_name) + "</option>").join("");
      v448.value = selectedActivityTeacherId;
    }
    let v449 = "<div style=\"display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:1.5rem;\">";
    const v450 = v441 ? {
      [v441]: v447[v441]
    } : v447;
    if (Object.keys(v450).length === 0 || v441 && !v447[v441]) {
      v449 += "<div style=\"grid-column:1/-1;text-align:center;padding:1rem;color:var(--text-muted);font-size:0.9rem;\">No activity for selected teacher today.</div>";
    } else {
      Object.entries(v450).forEach(([v466, v467]) => {
        if (!v467) {
          return;
        }
        v449 += "\n                    <div class=\"card\" onclick=\"window.viewTeacherDetail('" + escapeHtml(v466) + "')\" style=\"cursor:pointer;padding:1rem;\">\n                        <div style=\"font-weight:700;color:var(--primary);margin-bottom:0.25rem;\">" + escapeHtml(v466) + "</div>\n                        <div style=\"font-size:0.8rem;color:var(--text-muted);display:flex;justify-content:space-between;\">\n                            <span>" + v467.count + " actions today</span>\n                            <span>" + timeAgo(v467.lastAction) + "</span>\n                        </div>\n                    </div>\n                ";
      });
    }
    v449 += "</div>";
    let v451 = v435;
    if (v441) {
      v451 = v451.filter(v468 => v468.teacher_name === v441);
    }
    let v452 = v422;
    if (v422 && window.NepaliFunctions) {
      v452 = window.NepaliFunctions.BS2AD(v422, "YYYY-MM-DD", "YYYY-MM-DD") || v422;
    }
    if (v422) {
      v451 = v451.filter(v469 => v469.created_at.startsWith(v452));
    }
    if (!allStudents || allStudents.length === 0) {
      try {
        const {
          data: v470
        } = await v1.from("students").select("id, name, class, roll, parents, mobile");
        allStudents = sortStudentsList(v470 || []);
      } catch (v471) {
        console.error("Failed to load students cache in activity log:", v471);
      }
    }
    const v453 = [];
    let v454 = null;
    v451.forEach(v472 => {
      let v473 = null;
      const v474 = String(v472.action).toLowerCase();
      const v475 = v472.details || "";
      const v476 = v474.includes("homework") && v474.includes("track") || v475.includes(":") || v475.includes("student ID");
      if (v476) {
        if (v475.includes(":")) {
          const v477 = v475.split(":");
          if (v477.length >= 2) {
            v473 = {
              name: v477[0].trim(),
              status: v477[1].trim()
            };
          }
        }
        if (!v473) {
          const v478 = v475.match(/Set\s+status\s+([\w\s]+)\s+for\s+student\s+ID\s+([a-zA-Z0-9-]+)/i);
          if (v478) {
            const v479 = v478[1].trim();
            const v480 = v478[2].trim();
            const v481 = allStudents.find(v483 => String(v483.id) === String(v480));
            const v482 = v481 ? v481.name : "Student (" + v480.substring(0, 8) + ")";
            v473 = {
              name: v482,
              status: v479
            };
          }
        }
      }
      if (v473) {
        if (v454 && v454.action === v472.action && v454.teacher_name === v472.teacher_name && new Date(v454.created_at) - new Date(v472.created_at) < 600000) {
          v454.students.push(v473);
        } else {
          if (v454) {
            v453.push(v454);
          }
          v454 = {
            ...v472,
            isGroup: true,
            students: [v473]
          };
        }
      } else {
        if (v454) {
          v453.push(v454);
          v454 = null;
        }
        v453.push(v472);
      }
    });
    if (v454) {
      v453.push(v454);
    }
    v453.sort((v484, v485) => new Date(v485.created_at) - new Date(v484.created_at));
    let v455 = "<h3 style=\"margin-bottom:0.75rem;font-size:1rem;\">" + (v441 ? escapeHtml(v441) + "'s Activity" : "Recent Activity Feed") + "</h3>";
    v455 += v453.length === 0 ? "<div class=\"empty-state\"><i data-lucide=\"activity\" style=\"width:48px;height:48px;color:var(--text-muted);opacity:0.3\"></i><p>No activity records.</p></div>" : v453.map(v486 => {
      let v487 = "var(--text-muted)";
      const v488 = String(v486.action).toLowerCase();
      if (v488.includes("attendance")) {
        v487 = "#10b981";
      } else if (v488.includes("homework")) {
        v487 = "#3b82f6";
      } else if (v488.includes("student")) {
        v487 = "#f59e0b";
      }
      let v489 = "";
      if (v486.isGroup) {
        const v490 = {
          Done: [],
          "Not Done": [],
          Incomplete: [],
          Partial: [],
          Absent: []
        };
        v486.students.forEach(v492 => {
          const v493 = v492.status;
          if (v493 === "Done") {
            v490.Done.push(v492.name);
          } else if (v493 === "Not Done") {
            v490["Not Done"].push(v492.name);
          } else if (v493 === "Incomplete" || v493 === "Partial") {
            v490.Partial.push(v492.name);
          } else if (v493 === "Absent") {
            v490.Absent.push(v492.name);
          } else {
            if (!v490[v493]) {
              v490[v493] = [];
            }
            v490[v493].push(v492.name);
          }
        });
        const v491 = [];
        if (v490.Done.length > 0) {
          v491.push("<div style=\"margin-bottom: 0.15rem;\"><span style=\"color:#10b981;font-weight:700;\">Done (" + v490.Done.length + "):</span> <span style=\"color:var(--text-main);\">" + escapeHtml(v490.Done.join(", ")) + "</span></div>");
        }
        if (v490["Not Done"].length > 0) {
          v491.push("<div style=\"margin-bottom: 0.15rem;\"><span style=\"color:#ef4444;font-weight:700;\">Not Done (" + v490["Not Done"].length + "):</span> <span style=\"color:var(--text-main);\">" + escapeHtml(v490["Not Done"].join(", ")) + "</span></div>");
        }
        if (v490.Partial.length > 0) {
          v491.push("<div style=\"margin-bottom: 0.15rem;\"><span style=\"color:#f59e0b;font-weight:700;\">Partial (" + v490.Partial.length + "):</span> <span style=\"color:var(--text-main);\">" + escapeHtml(v490.Partial.join(", ")) + "</span></div>");
        }
        if (v490.Absent.length > 0) {
          v491.push("<div style=\"margin-bottom: 0.15rem;\"><span style=\"color:var(--text-muted);font-weight:700;\">Absent (" + v490.Absent.length + "):</span> <span style=\"color:var(--text-main);\">" + escapeHtml(v490.Absent.join(", ")) + "</span></div>");
        }
        Object.keys(v490).forEach(v494 => {
          if (["Done", "Not Done", "Incomplete", "Partial", "Absent"].includes(v494)) {
            return;
          }
          if (v490[v494].length > 0) {
            v491.push("<div style=\"margin-bottom: 0.15rem;\"><span style=\"font-weight:700;\">" + escapeHtml(v494) + " (" + v490[v494].length + "):</span> <span style=\"color:var(--text-main);\">" + escapeHtml(v490[v494].join(", ")) + "</span></div>");
          }
        });
        v489 = "<div style=\"display:flex;flex-direction:column;gap:0.15rem;margin-top:0.35rem;font-size:0.78rem;line-height:1.4;\">" + v491.join("") + "</div>";
      } else {
        let v495 = v486.details || "";
        if (v488.includes("homework") && v488.includes("track") && v495.includes("student ID")) {
          const v496 = v495.match(/Set\s+status\s+([\w\s]+)\s+for\s+student\s+ID\s+([a-zA-Z0-9-]+)/i);
          if (v496) {
            const v497 = v496[1].trim();
            const v498 = v496[2].trim();
            const v499 = allStudents.find(v501 => String(v501.id) === String(v498));
            const v500 = v499 ? v499.name : "Student (" + v498.substring(0, 8) + ")";
            v495 = v500 + ": " + v497;
          }
        }
        v489 = "<div style=\"font-size:0.8rem; color:var(--text-muted)\">" + escapeHtml(v495) + "</div>";
      }
      return "\n                <div class=\"card\" style=\"margin-bottom:0.75rem; padding:1rem; border-left: 4px solid " + v487 + ";\">\n                    <div style=\"display:flex; justify-content:space-between; align-items:center; margin-bottom: 0.5rem;\">\n                        <span style=\"font-weight:700; font-size:0.9rem; color: var(--primary)\">" + escapeHtml(v486.teacher_name || "System") + "</span>\n                        <span style=\"font-size:0.7rem; color:var(--text-muted)\">" + timeAgo(v486.created_at) + "</span>\n                    </div>\n                    <div style=\"font-weight:600; font-size:0.85rem; margin-bottom: 0.25rem;\">" + escapeHtml(v486.action) + "</div>\n                    " + v489 + "\n                </div>";
    }).join("");
    if (v441) {
      v420.innerHTML = v455;
    } else {
      v420.innerHTML = v449 + v455;
    }
    lucide.createIcons();
    activityCache[v424] = {
      summaryHtml: v421.innerHTML,
      feedHtml: v420.innerHTML
    };
    lastFetch[v424] = v423;
  } catch (v502) {
    console.error("Activity log error:", v502);
    v420.innerHTML = "<p style=\"text-align:center; padding:2rem; color:var(--error)\">Error loading logs: " + v502.message + "</p>";
  }
};
const style = document.createElement("style");
style.textContent = "\n    .tab-content { display: none; }\n    .tab-content.active { display: block; animation: slideUp 0.25s ease-out forwards; }\n";
document.head.appendChild(style);
window.renderAdminDashboard = async function (v503 = false) {
  const v504 = document.getElementById("dashboard-content");
  if (!v504) {
    return;
  }
  const v505 = Date.now();
  const v506 = "admin_dashboard";
  if (!v503 && lastFetch[v506] && v505 - lastFetch[v506] < 60000) {
    if (v504.innerHTML && v504.innerHTML.includes("Welcome, Admin")) {
      return;
    }
  }
  v504.innerHTML = "<div style=\"text-align:center;padding:2rem;color:var(--text-muted)\">Loading dashboard...</div>";
  try {
    const v507 = window.getLocalToday ? window.getLocalToday() : new Date().toISOString().split("T")[0];
    let v508 = v507;
    if (window.NepaliFunctions) {
      v508 = window.NepaliFunctions.BS2AD(v507, "YYYY-MM-DD", "YYYY-MM-DD") || v507;
    }
    const [v509, v510] = await Promise.all([v1.from("students").select("*", {
      count: "exact",
      head: true
    }), v1.from("attendance").select("student_id, status, students(name, roll, class)").eq("date", v508)]);
    if (v509.error) {
      throw v509.error;
    }
    if (v510.error) {
      throw v510.error;
    }
    const v511 = v509.count || 0;
    const v512 = v510.data || [];
    let v513 = 0;
    let v514 = 0;
    let v515 = 0;
    const v516 = [];
    v512.forEach(v521 => {
      if (v521.status === "P" || v521.status === "Present") {
        v513++;
      } else if (v521.status === "A" || v521.status === "Absent") {
        v514++;
        if (v521.students) {
          v516.push({
            id: v521.student_id,
            name: v521.students.name,
            roll: v521.students.roll,
            class: v521.students.class
          });
        }
      } else if (v521.status === "L" || v521.status === "Late") {
        v515++;
      }
    });
    let v517 = window._cachedTopAbsences || [];
    const v518 = Date.now();
    if (v503 || !window._cachedTopAbsences || v518 - (lastFetch.admin_absences || 0) > 300000) {
      const v522 = new Date(v518 - 5184000000).toISOString().split("T")[0];
      const {
        data: v523,
        error: v524
      } = await v1.from("attendance").select("student_id, students(name, roll, class)").eq("status", "A").gte("date", v522);
      if (v524) {
        throw v524;
      }
      const v525 = {};
      (v523 || []).forEach(v526 => {
        if (!v526.students) {
          return;
        }
        const v527 = String(v526.student_id);
        if (!v525[v527]) {
          v525[v527] = {
            name: v526.students.name,
            class: v526.students.class,
            roll: v526.students.roll,
            count: 0
          };
        }
        v525[v527].count++;
      });
      v517 = Object.values(v525).sort((v528, v529) => v529.count - v528.count).slice(0, 20);
      window._cachedTopAbsences = v517;
      lastFetch.admin_absences = v518;
    }
    lastFetch[v506] = v518;
    const v519 = formatDateLabel(getLocalToday());
    let v520 = "\n            <div style=\"display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;flex-wrap:wrap;gap:1rem;\">\n                <div>\n                    <h2 style=\"margin-bottom:0.25rem; display: flex; align-items: center; gap: 0.5rem;\">\n                        Welcome, Admin\n                        <button class=\"btn btn-icon\" onclick=\"window.loadInitialData(true)\" title=\"Force Refresh Data\" style=\"padding: 4px; height: auto; width: auto; background: transparent; border: none; cursor: pointer;\">\n                            <i data-lucide=\"refresh-cw\" style=\"width:16px;height:16px; color: var(--text-muted);\"></i>\n                        </button>\n                    </h2>\n                    <p style=\"color:var(--text-muted);font-size:0.85rem;\">" + escapeHtml(v519) + "</p>\n                </div>\n                <button class=\"btn btn-secondary btn-icon\" onclick=\"exportAllData()\" title=\"Export All Data\" style=\"background:#e0e7ff;color:var(--primary);\">\n                    <i data-lucide=\"download\" style=\"width:20px;height:20px;\"></i>\n                </button>\n            </div>\n\n            <div style=\"display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:1.5rem;\">\n                <div class=\"card\" style=\"padding:1rem;background:#eff6ff;color:#1e3a8a;border:none;\">\n                    <div style=\"display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;\">\n                        <i data-lucide=\"users\" style=\"width:20px;height:20px;\"></i>\n                        <span style=\"font-size:0.8rem;font-weight:600;text-transform:uppercase;\">Total Students</span>\n                    </div>\n                    <div style=\"font-size:1.8rem;font-weight:800;\">" + v511 + "</div>\n                </div>\n                <div class=\"card\" style=\"padding:1rem;background:#dcfce7;color:#14532d;border:none;\">\n                    <div style=\"display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;\">\n                        <i data-lucide=\"user-check\" style=\"width:20px;height:20px;\"></i>\n                        <span style=\"font-size:0.8rem;font-weight:600;text-transform:uppercase;\">Present</span>\n                    </div>\n                    <div style=\"font-size:1.8rem;font-weight:800;\">" + v513 + "</div>\n                </div>\n                <div class=\"card\" style=\"padding:1rem;background:#fee2e2;color:#7f1d1d;border:none;\">\n                    <div style=\"display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;\">\n                        <i data-lucide=\"user-x\" style=\"width:20px;height:20px;\"></i>\n                        <span style=\"font-size:0.8rem;font-weight:600;text-transform:uppercase;\">Absent</span>\n                    </div>\n                    <div style=\"font-size:1.8rem;font-weight:800;\">" + v514 + "</div>\n                </div>\n                <div class=\"card\" style=\"padding:1rem;background:#ffedd5;color:#7c2d12;border:none;\">\n                    <div style=\"display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;\">\n                        <i data-lucide=\"clock\" style=\"width:20px;height:20px;\"></i>\n                        <span style=\"font-size:0.8rem;font-weight:600;text-transform:uppercase;\">Late</span>\n                    </div>\n                    <div style=\"font-size:1.8rem;font-weight:800;\">" + v515 + "</div>\n                </div>\n            </div>\n\n            <h3 style=\"margin-bottom:0.75rem;font-size:1rem;\">Today's Absentees</h3>\n            <div class=\"att-card\" style=\"margin-bottom:1.5rem;\">\n                " + (v516.length === 0 ? "<div style=\"padding:1rem;text-align:center;color:var(--text-muted);font-size:0.9rem;\">All students present today.</div>" : v516.map(v530 => "\n                    <div class=\"att-row\">\n                        <div>\n                            <div class=\"att-name\">" + escapeHtml(v530.name) + "</div>\n                            <div class=\"att-roll\">Roll: " + v530.roll + "</div>\n                        </div>\n                        <div style=\"background:#fee2e2;color:#ef4444;padding:0.25rem 0.5rem;border-radius:4px;font-size:0.8rem;font-weight:700;\">\n                            " + escapeHtml(v530.class) + "\n                        </div>\n                    </div>").join("")) + "\n            </div>\n\n            <h3 style=\"margin-bottom:0.75rem;font-size:1rem;\">Term Absence Records (Last 60 Days)</h3>\n            <div style=\"overflow-x:auto;background:white;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.05);\">\n                " + (v517.length === 0 ? "<div style=\"padding:1rem;text-align:center;color:var(--text-muted);font-size:0.9rem;\">No absence records found.</div>" : "<table class=\"marks-table\">\n                        <thead>\n                            <tr>\n                                <th>Student Name</th>\n                                <th>Class</th>\n                                <th>Roll</th>\n                                <th style=\"text-align:center;\">Times Absent</th>\n                            </tr>\n                        </thead>\n                        <tbody>\n                            " + v517.map(v531 => "\n                                <tr>\n                                    <td>" + escapeHtml(v531.name) + "</td>\n                                    <td>" + escapeHtml(v531.class) + "</td>\n                                    <td>" + v531.roll + "</td>\n                                    <td style=\"text-align:center;font-weight:700;color:var(--error);\">" + v531.count + "</td>\n                                </tr>\n                            ").join("") + "\n                        </tbody>\n                    </table>") + "\n            </div>\n        ";
    v504.innerHTML = v520;
    lucide.createIcons();
  } catch (v532) {
    console.error("Error rendering admin dashboard:", v532);
    v504.innerHTML = "<p style=\"text-align:center;padding:2rem;color:var(--error)\">Error loading dashboard: " + v532.message + "</p>";
  }
};
window.renderTeachers = renderTeachers;
window.switchTab = switchTab;
window.logout = logout;
window.exportAllData = exportAllData;
window.openEditTeacherForm = openEditTeacherForm;
window.applyStudentFilters = applyStudentFilters;
window.exportAttendanceRangeExcel = async function () {
  const v533 = document.getElementById("report-att-class").value;
  const v534 = document.getElementById("report-att-start").value;
  const v535 = document.getElementById("report-att-end").value;
  if (!v534 || !v535) {
    toast("Please select both start and end dates");
    return;
  }
  try {
    toast("Fetching attendance data...");
    let v536 = v1.from("students").select("id, name, roll, class");
    if (v533) {
      v536 = v536.eq("class", v533);
    }
    const {
      data: v537
    } = await v536.order("class").order("roll");
    if (!v537 || v537.length === 0) {
      toast("No students found for this filter");
      return;
    }
    let v538 = v534;
    let v539 = v535;
    if (window.NepaliFunctions) {
      v538 = window.NepaliFunctions.BS2AD(v534, "YYYY-MM-DD", "YYYY-MM-DD") || v534;
      v539 = window.NepaliFunctions.BS2AD(v535, "YYYY-MM-DD", "YYYY-MM-DD") || v535;
    }
    let v540 = v1.from("attendance").select("student_id, date, status").gte("date", v538).lte("date", v539).limit(1000);
    const {
      data: v541
    } = await v540;
    const v542 = {};
    const v543 = new Set();
    (v541 || []).forEach(v548 => {
      if (!v542[v548.date]) {
        v542[v548.date] = {};
      }
      v542[v548.date][v548.student_id] = v548.status;
      v543.add(v548.date);
    });
    const v544 = [...v543].sort();
    const v545 = v537.map(v549 => {
      const v550 = {
        Roll: v549.roll,
        Name: v549.name,
        Class: v549.class
      };
      v544.forEach(v551 => {
        const v552 = formatDateLabel(v551);
        v550[v552] = v542[v551] ? v542[v551][v549.id] || "-" : "-";
      });
      return v550;
    });
    const v546 = XLSX.utils.json_to_sheet(v545);
    const v547 = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(v547, v546, "Attendance");
    await window.saveExcel(v547, "Attendance_Report_" + (v533 || "All") + "_" + v534 + "_to_" + v535 + ".xlsx");
    toast("Export successful");
  } catch (v553) {
    console.error(v553);
    toast("Export failed");
  }
};
window.initNepaliReportsDropdowns = function () {
  const v554 = document.getElementById("report-nepali-att-year");
  const v555 = document.getElementById("report-nepali-att-month");
  if (!v554 || !v555) {
    return;
  }
  if (v554.children.length > 0) {
    return;
  }
  if (window.NepaliFunctions) {
    const v556 = window.NepaliFunctions.BS.GetMonths();
    v555.innerHTML = v556.map((v560, v561) => "<option value=\"" + (v561 + 1) + "\">" + v560 + "</option>").join("");
    const v557 = window.NepaliFunctions.BS.GetCurrentDate();
    const v558 = v557.year;
    let v559 = "";
    for (let v562 = 2080; v562 <= v558 + 1; v562++) {
      v559 += "<option value=\"" + v562 + "\" " + (v562 === v558 ? "selected" : "") + ">" + v562 + "</option>";
    }
    v554.innerHTML = v559;
    v555.value = v557.month;
  } else {
    const v563 = ["Baisakh", "Jestha", "Ashadh", "Shrawan", "Bhadra", "Ashoj", "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"];
    v555.innerHTML = v563.map((v564, v565) => "<option value=\"" + (v565 + 1) + "\">" + v564 + "</option>").join("");
    v554.innerHTML = "<option value=\"2080\">2080</option><option value=\"2081\" selected>2081</option><option value=\"2082\">2082</option><option value=\"2083\">2083</option>";
  }
};
window.exportNepaliMonthlyAttendance = async function () {
  const v566 = document.getElementById("report-nepali-att-class").value;
  const v567 = document.getElementById("report-nepali-att-year");
  const v568 = document.getElementById("report-nepali-att-month");
  if (!v567 || !v568 || !v567.value || !v568.value) {
    toast("Please select both Year and Month");
    return;
  }
  const v569 = parseInt(v567.value);
  const v570 = parseInt(v568.value);
  try {
    toast("Fetching attendance data...");
    let v571 = v1.from("students").select("id, name, roll, class");
    if (v566) {
      v571 = v571.eq("class", v566);
    }
    const {
      data: v572
    } = await v571.order("class").order("roll");
    if (!v572 || v572.length === 0) {
      toast("No students found for this filter");
      return;
    }
    if (!window.NepaliFunctions) {
      toast("Nepali calendar functions are not available.");
      return;
    }
    const v573 = v587 => String(v587).padStart(2, "0");
    const v574 = v569 + "-" + v573(v570) + "-01";
    const v575 = window.NepaliFunctions.BS.GetDaysInMonth(v569, v570);
    const v576 = v569 + "-" + v573(v570) + "-" + v573(v575);
    const v577 = window.NepaliFunctions.BS2AD(v574, "YYYY-MM-DD", "YYYY-MM-DD");
    const v578 = window.NepaliFunctions.BS2AD(v576, "YYYY-MM-DD", "YYYY-MM-DD");
    let v579 = v1.from("attendance").select("student_id, date, status").gte("date", v577).lte("date", v578).limit(1000);
    const {
      data: v580
    } = await v579;
    const v581 = {};
    (v580 || []).forEach(v588 => {
      if (!v581[v588.date]) {
        v581[v588.date] = {};
      }
      v581[v588.date][v588.student_id] = v588.status;
    });
    const v582 = window.NepaliFunctions.BS.GetMonths();
    const v583 = v582[v570 - 1] || "Month-" + v570;
    const v584 = v572.map(v589 => {
      const v590 = {
        Roll: v589.roll,
        Name: v589.name,
        Class: v589.class
      };
      for (let v591 = 1; v591 <= v575; v591++) {
        const v592 = v569 + "-" + v573(v570) + "-" + v573(v591);
        const v593 = window.NepaliFunctions.BS2AD(v592, "YYYY-MM-DD", "YYYY-MM-DD");
        const v594 = "" + v573(v591);
        v590[v594] = v581[v593] ? v581[v593][v589.id] || "-" : "-";
      }
      return v590;
    });
    const v585 = XLSX.utils.json_to_sheet(v584);
    const v586 = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(v586, v585, "Attendance");
    await window.saveExcel(v586, "Attendance_" + (v566 || "All") + "_" + v583 + "_" + v569 + ".xlsx");
    toast("Export successful");
  } catch (v595) {
    console.error(v595);
    toast("Export failed");
  }
};
window.exportHomeworkRangeExcel = async function () {
  const v596 = document.getElementById("report-hw-class").value;
  const v597 = document.getElementById("report-hw-start").value;
  const v598 = document.getElementById("report-hw-end").value;
  if (!v597 || !v598) {
    toast("Please select both start and end dates");
    return;
  }
  try {
    toast("Fetching homework data...");
    let v599 = v597;
    let v600 = v598;
    if (window.NepaliFunctions) {
      v599 = window.NepaliFunctions.BS2AD(v597, "YYYY-MM-DD", "YYYY-MM-DD") || v597;
      v600 = window.NepaliFunctions.BS2AD(v598, "YYYY-MM-DD", "YYYY-MM-DD") || v598;
    }
    let v601 = v1.from("homework").select("id, date, class, subject, task, due").gte("date", v599).lte("date", v600).limit(500);
    if (v596) {
      v601 = v601.eq("class", v596);
    }
    const {
      data: v602
    } = await v601.order("date", {
      ascending: false
    });
    if (!v602 || v602.length === 0) {
      toast("No homework found for this filter");
      return;
    }
    const v603 = v602.map(v609 => v609.id);
    const {
      data: v604
    } = await v1.from("hw_status").select("hw_id, status, students(name, roll, class)").in("hw_id", v603);
    const v605 = {};
    (v604 || []).forEach(v610 => {
      if (!v605[v610.hw_id]) {
        v605[v610.hw_id] = [];
      }
      v605[v610.hw_id].push(v610);
    });
    const v606 = v602.map(v611 => {
      const v612 = v605[v611.id] || [];
      const v613 = v612.filter(v616 => v616.status === "Done").map(v617 => v617.students?.name).join(", ");
      const v614 = v612.filter(v618 => v618.status === "Not Done").map(v619 => v619.students?.name).join(", ");
      const v615 = v612.filter(v620 => v620.status === "Incomplete").map(v621 => v621.students?.name).join(", ");
      return {
        Date: formatDateLabel(v611.date),
        Class: v611.class,
        Subject: v611.subject,
        Task: v611.task,
        Done: v613,
        Missed: v614,
        Partial: v615
      };
    });
    const v607 = XLSX.utils.json_to_sheet(v606);
    const v608 = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(v608, v607, "Homework");
    await window.saveExcel(v608, "Homework_Report_" + (v596 || "All") + "_" + v597 + "_to_" + v598 + ".xlsx");
    toast("Export successful");
  } catch (v622) {
    console.error(v622);
    toast("Export failed");
  }
};
async function loadParents(v623 = false) {
  const v624 = "parents";
  const v625 = Date.now();
  if (!v623 && allParents.length > 0 && lastFetch[v624] && v625 - lastFetch[v624] < 60000) {
    return;
  }
  try {
    if (allParents.length === 0) {
      const v628 = localStorage.getItem("cache_parents");
      if (v628) {
        allParents = JSON.parse(v628);
        window.renderParents();
      }
    }
    const v626 = await window.fetchAllPaginated((s, e) => v1.from("profiles").select("id, full_name, assigned_classes, can_view_portal, role").eq("role", "parent").range(s, e));
    const v627 = null;
    allParents = v626 || [];
    lastFetch[v624] = v625;
    localStorage.setItem("cache_parents", JSON.stringify(allParents));
    window.renderParents();
  } catch (v629) {
    console.error("Load parents error", v629);
  }
}
window.renderParents = function () {
  const v630 = document.getElementById("parents-list");
  if (!v630) {
    return;
  }
  const v631 = document.getElementById("parent-search")?.value.toLowerCase() || "";
  const v632 = document.getElementById("parent-class-filter")?.value || "";
  const v633 = allParents.filter(v634 => {
    let v635 = false;
    let v636 = false;
    let v637 = [];
    try {
      const v641 = typeof v634.assigned_classes === "string" ? JSON.parse(v634.assigned_classes) : v634.assigned_classes;
      if (Array.isArray(v641)) {
        v637 = v641;
      } else if (v641) {
        v637 = v641.studentIds || [];
      }
    } catch (v642) {}
    const v638 = (v634.full_name || "").toLowerCase().includes(v631);
    if (v637.length > 0) {
      v637.forEach(v643 => {
        const v644 = allStudents.find(v645 => v645.id === v643);
        if (v644) {
          if (v644.class === v632) {
            v635 = true;
          }
          if ((v644.name || "").toLowerCase().includes(v631)) {
            v636 = true;
          }
        }
      });
    }
    const v639 = !v632 || v635;
    const v640 = !v631 || v638 || v636;
    return v639 && v640;
  });
  if (v633.length === 0) {
    v630.innerHTML = "<div class=\"empty-state\"><p>No parent accounts found.</p></div>";
    return;
  }
  v630.innerHTML = v633.map(v646 => {
    let v647 = "No children linked";
    let v648 = false;
    let v_cas_visible = false;
    try {
      const v649 = typeof v646.assigned_classes === "string" ? JSON.parse(v646.assigned_classes) : v646.assigned_classes;
      let v650 = [];
      if (Array.isArray(v649)) {
        v650 = v649;
        v648 = v646.can_view_marks === true;
        v_cas_visible = true;
      } else if (v649) {
        v650 = v649.studentIds || [];
        v648 = v649.can_view_marks === true;
        v_cas_visible = v649.can_view_cas !== false;
      }
      if (v650.length > 0) {
        const v651 = v650.map(v652 => allStudents.find(v653 => v653.id === v652)?.name || "Unknown").filter(v654 => v654 !== "Unknown");
        if (v651.length > 0) {
          v647 = v651.join(", ");
        }
      }
    } catch (v655) {}
    return "\n            <div class=\"card\" style=\"position:relative; padding-right:3.5rem; transition: transform 0.1s active; cursor: default;\">\n                <div onclick=\"window.openEditParentForm('" + v646.id + "')\" style=\"cursor:pointer;\">\n                    <h3 style=\"color:var(--primary); margin-bottom:0.4rem;\">" + escapeHtml(v646.full_name) + "</h3>\n                    <p style=\"font-size:0.85rem; color:var(--text-main);\"><strong>Children:</strong> " + escapeHtml(v647) + "</p>\n                    <div style=\"margin-top:0.6rem; display:flex; gap:0.4rem; flex-wrap:wrap;\">\n                        <span class=\"badge " + (v646.can_view_portal ? "badge-success" : "badge-error") + "\">" + (v646.can_view_portal ? "Portal: On" : "Portal: Off") + "</span>\n                        <span class=\"badge " + (v648 ? "badge-success" : "badge-warning") + "\" style=\"background:" + (v648 ? "" : "#fff7ed") + "; color:" + (v648 ? "" : "#c2410c") + ";\">" + (v648 ? "Marks: Visible" : "Marks: Hidden") + "</span>\n                        <span class=\"badge " + (v_cas_visible ? "badge-success" : "badge-warning") + "\" style=\"background:" + (v_cas_visible ? "" : "#fee2e2") + "; color:" + (v_cas_visible ? "" : "#b91c1c") + ";\">" + (v_cas_visible ? "CAS: Visible" : "CAS: Hidden") + "</span>\n                    </div>\n                </div>\n                \n                <div style=\"position:absolute; top:50%; right:1rem; transform:translateY(-50%); display:flex; flex-direction:column; gap:0.5rem;\">\n                    <button class=\"btn btn-icon\" onclick=\"window.openEditParentForm('" + v646.id + "')\" \n                        style=\"color:var(--primary); background:var(--primary-light); width:36px; height:36px; padding:0; border:none; border-radius:50%;\">\n                        <i data-lucide=\"edit-3\" style=\"width:18px; height:18px;\"></i>\n                    </button>\n                    <button class=\"btn btn-icon\" onclick=\"window.deleteParent('" + v646.id + "')\" \n                        style=\"color:var(--error); background:var(--error-light); width:36px; height:36px; padding:0; border:none; border-radius:50%;\">\n                        <i data-lucide=\"trash-2\" style=\"width:18px; height:18px;\"></i>\n                    </button>\n                </div>\n            </div>\n        ";
  }).join("");
  lucide.createIcons();
};
window.openAddParentForm = function () {
  const v656 = "\n        <div class=\"modal-title\">Add New Parent Account</div>\n        <form id=\"add-parent-form\">\n            <div class=\"form-group\">\n                <label class=\"form-label\">Full Name</label>\n                <input type=\"text\" name=\"full_name\" class=\"form-input\" required placeholder=\"e.g. John Doe\">\n            </div>\n            <div class=\"form-group\">\n                <label class=\"form-label\">Email Address</label>\n                <input type=\"email\" name=\"email\" class=\"form-input\" required placeholder=\"parent@example.com\">\n            </div>\n            <div class=\"form-group\">\n                <label class=\"form-label\">Password</label>\n                <input type=\"password\" name=\"password\" class=\"form-input\" required minlength=\"6\" placeholder=\"Min 6 characters\">\n            </div>\n            <div style=\"display:flex; gap:0.5rem; margin-top:1.5rem;\">\n                <button type=\"submit\" class=\"btn btn-primary\" style=\"flex:1;\">Create Parent</button>\n                <button type=\"button\" class=\"btn btn-ghost\" onclick=\"window.closeModal()\" style=\"flex:1;\">Cancel</button>\n            </div>\n        </form>\n    ";
  openModal(v656);
  document.getElementById("add-parent-form").addEventListener("submit", async v657 => {
    v657.preventDefault();
    const v658 = new FormData(v657.target);
    const v659 = Object.fromEntries(v658);
    const v660 = v657.target.querySelector("button[type=\"submit\"]");
    v660.disabled = true;
    v660.innerHTML = "<div class=\"spinner\" style=\"width:14px;height:14px;\"></div> Creating...";
    toast("Creating user...");
    try {
      const {
        data: v661
      } = await v1.auth.getSession();
      const v662 = v661?.session?.access_token;
      const v663 = await fetch("https://rfcrnvomvfgermqbtilp.supabase.co/functions/v1/create-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + v662
        },
        body: JSON.stringify({
          action: "create",
          email: v659.email,
          password: v659.password,
          full_name: v659.full_name,
          role: "parent"
        })
      });
      const v664 = await v663.json();
      if (!v663.ok) {
        throw new Error(v664.error || v664.message || "Failed to create parent");
      }
      toast("Parent account created successfully!");
      closeModal();
      await loadParents(true);
    } catch (v665) {
      toast("Error: " + v665.message);
      v660.disabled = false;
      v660.innerText = "Create Parent";
    }
  });
};
window.openEditParentForm = function (v666) {
  const v667 = allParents.find(v671 => v671.id === v666);
  if (!v667) {
    return;
  }
  let v668 = [];
  let v669 = false;
  let v_cas_checked = false;
  try {
    const v672 = typeof v667.assigned_classes === "string" ? JSON.parse(v667.assigned_classes) : v667.assigned_classes;
    if (Array.isArray(v672)) {
      v668 = v672;
      v669 = v667.can_view_marks === true;
      v_cas_checked = true;
    } else if (v672) {
      v668 = v672.studentIds || [];
      v669 = v672.can_view_marks === true;
      v_cas_checked = v672.can_view_cas !== false;
    }
  } catch (v673) {}
  const v670 = "\n        <div class=\"modal-title\">Edit Parent: " + escapeHtml(v667.full_name) + "</div>\n        <form id=\"edit-parent-form\">\n            <div class=\"form-group\" style=\"background:#f1f5f9; padding:1rem; border-radius:0.75rem; margin-bottom:1rem;\">\n                <label style=\"display:flex; justify-content:space-between; align-items:center; cursor:pointer; font-weight:700; color:var(--primary);\">\n                    Grant Portal Access\n                    <input type=\"checkbox\" name=\"can_view_portal\" " + (v667.can_view_portal ? "checked" : "") + " style=\"width:20px; height:20px;\">\n                </label>\n                <p style=\"font-size:0.7rem; color:var(--text-muted); margin-top:0.3rem;\">If enabled, this parent can log in to view their child's records.</p>\n            </div>\n\n            <div class=\"form-group\" style=\"background:#fff7ed; padding:1rem; border-radius:0.75rem; margin-bottom:1rem; border:1px solid #fed7aa;\">\n                <label style=\"display:flex; justify-content:space-between; align-items:center; cursor:pointer; font-weight:700; color:#c2410c;\">\n                    Allow Marks Visibility\n                    <input type=\"checkbox\" name=\"can_view_marks\" " + (v669 ? "checked" : "") + " style=\"width:20px; height:20px;\">\n                </label>\n                <p style=\"font-size:0.7rem; color:var(--text-muted); margin-top:0.3rem;\">If enabled, the parent can see their child's academic marks. Keep disabled to hide marks until results are released.</p>\n            </div>\n\n            <div class=\"form-group\" style=\"background:#ecfdf5; padding:1rem; border-radius:0.75rem; margin-bottom:1rem; border:1px solid #a7f3d0;\">\n                <label style=\"display:flex; justify-content:space-between; align-items:center; cursor:pointer; font-weight:700; color:#047857;\">\n                    Allow CAS Visibility\n                    <input type=\"checkbox\" name=\"can_view_cas\" " + (v_cas_checked ? "checked" : "") + " style=\"width:20px; height:20px;\">\n                </label>\n                <p style=\"font-size:0.7rem; color:var(--text-muted); margin-top:0.3rem;\">If enabled, the parent can see their child's Continuous Assessment (CAS) evaluations. Keep disabled to hide evaluations.</p>\n            </div>\n\n            <details style=\"margin-bottom:1rem; border:1px solid #e2e8f0; border-radius:0.75rem; overflow:hidden;\">\n                <summary style=\"padding:0.85rem 1rem; font-weight:700; font-size:0.85rem; cursor:pointer; background:#f8fafc; color:var(--primary); display:flex; align-items:center; gap:0.5rem;\">\n                    <i data-lucide=\"key\" style=\"width:15px;height:15px;\"></i> Change Login Credentials\n                </summary>\n                <div style=\"padding:1rem; background:#fff;\">\n                    <p style=\"font-size:0.72rem;color:var(--text-muted);margin-bottom:0.75rem;\">Leave fields blank to keep unchanged. New email/password will take effect on next login.</p>\n                    <div class=\"form-group\">\n                        <label class=\"form-label\">New Email Address</label>\n                        <input type=\"email\" name=\"new_email\" class=\"form-input\" placeholder=\"Leave blank to keep current\">\n                    </div>\n                    <div class=\"form-group\">\n                        <label class=\"form-label\">New Password</label>\n                        <input type=\"password\" name=\"new_password\" class=\"form-input\" minlength=\"6\" placeholder=\"Leave blank to keep current\">\n                    </div>\n                </div>\n            </details>\n\n            <div class=\"form-group\">\n                <label class=\"form-label\">Linked Children</label>\n                <div class=\"search-wrap\" style=\"margin-bottom:0.5rem;\">\n                    <i data-lucide=\"search\" class=\"search-icon\"></i>\n                    <input type=\"text\" placeholder=\"Search students...\" class=\"search-input\" style=\"font-size:0.8rem; height:36px;\" oninput=\"window.filterModalStudents(this.value)\">\n                </div>\n                <div id=\"modal-students-list\" style=\"max-height:250px; overflow-y:auto; border:1px solid var(--border); border-radius:0.5rem; background:#fff;\">\n                    " + allStudents.map(v674 => {
    const v675 = v668.includes(v674.id);
    return "\n                        <div class=\"student-link-row\" \n                            style=\"display:flex; align-items:center; gap:0.75rem; padding:0.75rem 1rem; border-bottom:1px solid #f1f5f9; cursor:pointer; background: " + (v675 ? "#f0f9ff" : "transparent") + ";\" \n                            onclick=\"const cb = this.querySelector('input'); cb.checked = !cb.checked; this.style.background = cb.checked ? '#f0f9ff' : 'transparent';\">\n                            <input type=\"checkbox\" class=\"student-link-check\" value=\"" + v674.id + "\" " + (v675 ? "checked" : "") + " \n                                onclick=\"event.stopPropagation(); this.parentElement.style.background = this.checked ? '#f0f9ff' : 'transparent';\" \n                                style=\"width:20px; height:20px; cursor:pointer;\">\n                            <div style=\"flex:1;\">\n                                <div style=\"font-weight:600; font-size:0.95rem; color: " + (v675 ? "var(--primary)" : "var(--text-main)") + ";\">  " + escapeHtml(v674.name) + "</div>\n                                <div style=\"font-size:0.75rem; color:var(--text-muted);\">" + v674.class + " | Roll: " + v674.roll + "</div>\n                            </div>\n                        </div>";
  }).join("") + "\n                </div>\n            </div>\n\n            <div style=\"display:flex; gap:0.5rem; margin-top:1.5rem;\">\n                <button type=\"submit\" class=\"btn btn-primary\" style=\"flex:1;\">Save Settings</button>\n                <button type=\"button\" class=\"btn btn-ghost\" onclick=\"window.closeModal()\" style=\"flex:1;\">Cancel</button>\n            </div>\n        </form>\n    ";
  openModal(v670);
  lucide.createIcons();
  document.getElementById("edit-parent-form").addEventListener("submit", async v676 => {
    v676.preventDefault();
    const v677 = v676.target.querySelector("input[name=\"can_view_portal\"]");
    const v678 = v677 ? v677.checked : false;
    const v679 = v676.target.querySelector("input[name=\"can_view_marks\"]");
    const v680 = v679 ? v679.checked : false;
    const v_cas_input = v676.target.querySelector("input[name=\"can_view_cas\"]");
    const v_cas_val = v_cas_input ? v_cas_input.checked : false;
    const v681 = Array.from(v676.target.querySelectorAll(".student-link-check:checked")).map(v682 => v682.value);
    try {
      toast("Updating parent access...");
      const v683 = {
        studentIds: v681,
        can_view_marks: v680,
        can_view_cas: v_cas_val
      };
      const {
        error: v684
      } = await v1.from("profiles").update({
        can_view_portal: v678,
        can_view_marks: v680,
        assigned_classes: v683
      }).eq("id", v666);
      if (v684) {
        console.error("Database Update Error:", v684);
        throw new Error(v684.message);
      }
      const v685 = v676.target.querySelector("input[name=\"new_email\"]")?.value?.trim();
      const v686 = v676.target.querySelector("input[name=\"new_password\"]")?.value?.trim();
      if (v685 || v686) {
        toast("Updating login credentials...", 3000);
        await callEdgeFn({
          action: "update-credentials",
          userId: v666,
          ...(v685 ? {
            email: v685
          } : {}),
          ...(v686 ? {
            password: v686
          } : {})
        });
        if (v685) {
          const v687 = allParents.findIndex(v688 => v688.id === v666);
          if (v687 !== -1) {
            allParents[v687].email = v685;
          }
        }
      }
      toast("Success! Access " + (v678 ? "Enabled" : "Disabled"));
      closeModal();
      await loadParents(true);
    } catch (v689) {
      console.error("Save failed:", v689);
      alert("Failed to save: " + v689.message + "\n\nCheck if you are still logged in as Admin.");
      toast("Save failed");
    }
  });
};
window.deleteParent = async function (v690) {
  if (!confirm("Are you sure you want to delete this parent profile? This will not delete the Auth account.")) {
    return;
  }
  try {
    const {
      error: v691
    } = await v1.from("profiles").delete().eq("id", v690);
    if (v691) {
      throw v691;
    }
    toast("Parent profile deleted");
    await loadParents();
  } catch (v692) {
    toast("Delete failed");
  }
};
window.setAllParentsMarksVisibility = async function (visible) {
  const visibleText = visible ? "visible" : "hidden";
  if (!confirm(`Are you sure you want to make marks ${visibleText} for ALL parent accounts?`)) {
    return;
  }
  try {
    toast(`Setting all parent marks to ${visibleText}...`);
    const { data: parents, error: fetchErr } = await v1.from("profiles").select("id, assigned_classes").eq("role", "parent");
    if (fetchErr) {
      throw fetchErr;
    }
    
    const updatePromises = (parents || []).map(async p => {
      let parsed = {};
      try {
        parsed = typeof p.assigned_classes === "string" ? JSON.parse(p.assigned_classes) : p.assigned_classes || {};
      } catch (e) {}
      let updatedAssigned = {};
      if (Array.isArray(parsed)) {
        updatedAssigned = { studentIds: parsed, can_view_marks: visible };
      } else {
        updatedAssigned = { ...parsed, can_view_marks: visible };
      }
      const { error: updErr } = await v1.from("profiles").update({
        can_view_marks: visible,
        assigned_classes: updatedAssigned
      }).eq("id", p.id);
      if (updErr) {
        console.error("Failed to update parent:", p.id, updErr);
      }
    });

    await Promise.all(updatePromises);
    toast(`Successfully set all parent marks to ${visibleText}! ✓`);
    await loadParents(true);
  } catch (err) {
    console.error("Bulk marks update error:", err);
    toast("Failed to update marks: " + err.message);
  }
};
window.setAllParentsCasVisibility = async function (visible) {
  const visibleText = visible ? "visible" : "hidden";
  if (!confirm(`Are you sure you want to make CAS evaluations ${visibleText} for ALL parent accounts?`)) {
    return;
  }
  try {
    toast(`Setting all parent CAS to ${visibleText}...`);
    const { data: parents, error: fetchErr } = await v1.from("profiles").select("id, assigned_classes").eq("role", "parent");
    if (fetchErr) {
      throw fetchErr;
    }
    
    const updatePromises = (parents || []).map(async p => {
      let parsed = {};
      try {
        parsed = typeof p.assigned_classes === "string" ? JSON.parse(p.assigned_classes) : p.assigned_classes || {};
      } catch (e) {}
      let updatedAssigned = {};
      if (Array.isArray(parsed)) {
        updatedAssigned = { studentIds: parsed, can_view_marks: true, can_view_cas: visible };
      } else {
        updatedAssigned = { ...parsed, can_view_cas: visible };
      }
      const { error: updErr } = await v1.from("profiles").update({
        assigned_classes: updatedAssigned
      }).eq("id", p.id);
      if (updErr) {
        console.error("Failed to update parent CAS:", p.id, updErr);
      }
    });

    await Promise.all(updatePromises);
    toast(`Successfully set all parent CAS to ${visibleText}! ✓`);
    await loadParents(true);
  } catch (err) {
    console.error("Bulk CAS update error:", err);
    toast("Failed to update CAS: " + err.message);
  }
};
window.filterModalStudents = function (v693) {
  const v694 = v693.toLowerCase();
  document.querySelectorAll(".student-link-row").forEach(v695 => {
    v695.style.display = v695.textContent.toLowerCase().includes(v694) ? "flex" : "none";
  });
};
window.openAddTeacherForm = function () {
  const v696 = "\n        <div class=\"modal-title\">Add New Teacher Account</div>\n        <form id=\"add-teacher-form\">\n            <div class=\"form-group\">\n                <label class=\"form-label\">Full Name</label>\n                <input type=\"text\" name=\"full_name\" class=\"form-input\" required placeholder=\"e.g. Jane Smith\">\n            </div>\n            <div class=\"form-group\">\n                <label class=\"form-label\">Email Address</label>\n                <input type=\"email\" name=\"email\" class=\"form-input\" required placeholder=\"teacher@example.com\">\n            </div>\n            <div class=\"form-group\">\n                <label class=\"form-label\">Phone Number</label>\n                <input type=\"tel\" name=\"mobile\" class=\"form-input\" placeholder=\"e.g. 9841234567\">\n            </div>\n            <div class=\"form-group\">\n                <label class=\"form-label\">Password</label>\n                <input type=\"password\" name=\"password\" class=\"form-input\" required minlength=\"6\" placeholder=\"Min 6 characters\">\n            </div>\n            <div class=\"form-group\">\n                <label class=\"form-label\">Profile Description / Bio</label>\n                <textarea name=\"description\" class=\"form-input\" rows=\"3\" placeholder=\"e.g. Science teacher with 5 years experience...\"></textarea>\n            </div>\n            <div style=\"display:flex; gap:0.5rem; margin-top:1.5rem;\">\n                <button type=\"submit\" class=\"btn btn-primary\" style=\"flex:1;\">Create Teacher</button>\n                <button type=\"button\" class=\"btn btn-ghost\" onclick=\"window.closeModal()\" style=\"flex:1;\">Cancel</button>\n            </div>\n        </form>\n    ";
  openModal(v696);
  document.getElementById("add-teacher-form").addEventListener("submit", async v697 => {
    v697.preventDefault();
    const v698 = new FormData(v697.target);
    const v699 = Object.fromEntries(v698);
    const v700 = v697.target.querySelector("button[type=\"submit\"]");
    v700.disabled = true;
    v700.innerHTML = "<div class=\"spinner\" style=\"width:14px;height:14px;\"></div> Creating...";
    toast("Creating user...");
    try {
      const {
        data: v701
      } = await v1.auth.getSession();
      const v702 = v701?.session?.access_token;
      const v703 = await fetch("https://rfcrnvomvfgermqbtilp.supabase.co/functions/v1/create-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + v702
        },
        body: JSON.stringify({
          action: "create",
          email: v699.email,
          password: v699.password,
          full_name: v699.full_name,
          mobile: v699.mobile,
          description: v699.description,
          role: "teacher"
        })
      });
      const v704 = await v703.json();
      if (!v703.ok) {
        throw new Error(v704.error || v704.message || "Failed to create teacher");
      }
      toast("Teacher account created successfully!");
      closeModal();
      await loadTeachers(true);
      setTimeout(() => {
        if (window.confirm("Would you like to assign a homeroom class to " + v699.full_name + " now?")) {
          const v705 = allTeachers.find(v706 => v706.email === v699.email);
          if (v705) {
            window.openEditTeacherForm(v705.id);
          }
        }
      }, 500);
    } catch (v707) {
      toast("Error: " + v707.message);
      v700.disabled = false;
      v700.innerText = "Create Teacher";
    }
  });
};
window.loadParents = loadParents;
const CLASS_ORDER = ["Nursery", "LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
window.switchActivityView = function (v708) {
  const v709 = document.getElementById("view-teacher-logs");
  const v710 = document.getElementById("view-student-trace");
  const v711 = document.getElementById("btn-teacher-logs");
  const v712 = document.getElementById("btn-student-trace");
  [v711, v712].forEach(v713 => {
    v713.style.background = "transparent";
    v713.style.color = "var(--text-muted)";
    v713.style.fontWeight = "500";
  });
  if (v708 === "teacher") {
    v709.style.display = "block";
    v710.style.display = "none";
    v711.style.background = "#fff";
    v711.style.color = "var(--primary)";
    v711.style.fontWeight = "700";
    v711.style.boxShadow = "0 2px 4px rgba(0,0,0,0.05)";
    window.loadActivityLog(true);
  } else {
    v709.style.display = "none";
    v710.style.display = "block";
    v712.style.background = "#fff";
    v712.style.color = "var(--primary)";
    v712.style.fontWeight = "700";
    v712.style.boxShadow = "0 2px 4px rgba(0,0,0,0.05)";
    window.populateTraceDropdowns();
  }
};
window.populateTraceDropdowns = function () {
  const v714 = document.getElementById("trace-class-filter");
  if (!v714) {
    return;
  }
  const v715 = sortClassList([...new Set(allStudents.map(v716 => v716.class))]);
  v714.innerHTML = "<option value=\"\">Select Class</option>" + v715.map(v717 => "<option value=\"" + escapeHtml(v717) + "\">" + escapeHtml(v717) + "</option>").join("");
};
window.populateTraceStudents = function () {
  const v718 = document.getElementById("trace-class-filter").value;
  const v719 = document.getElementById("trace-student-select");
  if (!v719) {
    return;
  }
  if (!v718) {
    v719.innerHTML = "<option value=\"\">Select Student</option>";
    return;
  }
  const v720 = allStudents.filter(v721 => v721.class === v718).sort((v722, v723) => {
    const v724 = parseInt(v722.roll) || 999;
    const v725 = parseInt(v723.roll) || 999;
    return v724 - v725;
  });
  v719.innerHTML = "<option value=\"\">Select Student</option>" + v720.map(v726 => "<option value=\"" + v726.id + "\">Roll " + v726.roll + ": " + escapeHtml(v726.name) + "</option>").join("");
};
window.loadStudentTrace = async function () {
  const v727 = document.getElementById("trace-student-select").value;
  const v728 = document.getElementById("trace-date-filter").value;
  const v729 = document.getElementById("student-trace-content");
  if (!v727 || !v729) {
    return;
  }
  try {
    v729.innerHTML = "<div class=\"spinner-wrap\"><div class=\"spinner\"></div><p>Aggregating student data...</p></div>";
    let v730 = v1.from("hw_status").select("status, hw_id, homework(subject, date, task)").eq("student_id", v727);
    const [v731, v732, v733, v734] = await Promise.all([v1.from("attendance").select("status, date").eq("student_id", v727), v730, v1.from("marks").select("*").eq("student_id", v727), v1.from("fees").select("*").eq("student_id", v727)]);
    const v735 = v731.data || [];
    let v736 = v732.data || [];
    const v737 = v733.data || [];
    const v738 = v734.data || [];
    let v739 = v728;
    if (v728 && window.NepaliFunctions) {
      v739 = window.NepaliFunctions.BS2AD(v728, "YYYY-MM-DD", "YYYY-MM-DD") || v728;
    }
    if (v728) {
      v736 = v736.filter(v746 => v746.homework?.date === v739);
    }
    v736.sort((v747, v748) => {
      const v749 = v747.homework?.date || "";
      const v750 = v748.homework?.date || "";
      return v750.localeCompare(v749);
    });
    const v740 = v735.length;
    const v741 = v735.filter(v751 => v751.status === "P" || v751.status === "Present").length;
    const v742 = v740 > 0 ? Math.round(v741 / v740 * 100) : 0;
    let v743 = 0;
    let v744 = 0;
    v738.forEach(v752 => {
      v743 += v752.total_fee || 0;
      v744 += v752.paid_amount || 0;
    });
    const v745 = v743 - v744;
    v729.innerHTML = "\n            <div style=\"display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; margin-bottom:1rem;\">\n                <div class=\"card\" style=\"padding:1rem; border-left:4px solid var(--primary);\">\n                    <div style=\"font-size:0.7rem; color:var(--text-muted); font-weight:700; text-transform:uppercase;\">Attendance</div>\n                    <div style=\"font-size:1.5rem; font-weight:800;\">" + v742 + "%</div>\n                    <div style=\"font-size:0.75rem; color:var(--text-muted);\">" + v741 + "/" + v740 + " Days Present</div>\n                </div>\n                <div class=\"card\" style=\"padding:1rem; border-left:4px solid " + (v745 > 0 ? "var(--error)" : "var(--success)") + ";\">\n                    <div style=\"font-size:0.7rem; color:var(--text-muted); font-weight:700; text-transform:uppercase;\">Financial Due</div>\n                    <div style=\"font-size:1.5rem; font-weight:800; color:" + (v745 > 0 ? "var(--error)" : "var(--success)") + "\">Rs." + v745 + "</div>\n                    <div style=\"font-size:0.75rem; color:var(--text-muted);\">Paid: Rs." + v744 + "</div>\n                </div>\n            </div>\n\n            <div class=\"card\" style=\"margin-bottom:1rem;\">\n                <div style=\"padding:1rem; font-weight:700; border-bottom:1px solid #f1f5f9;\">Academic Performance (Marks)</div>\n                <div style=\"padding:1rem;\">\n                    " + (v737.length === 0 ? "<p style=\"font-size:0.85rem; color:var(--text-muted);\">No marks recorded yet.</p>" : "<div style=\"max-height:200px; overflow-y:auto;\">\n                            <table style=\"width:100%; font-size:0.85rem; border-collapse:collapse;\">\n                                <thead style=\"text-align:left; color:var(--text-muted); border-bottom:1px solid #f1f5f9;\">\n                                    <tr><th style=\"padding:0.5rem 0;\">Subject</th><th>Term</th><th style=\"text-align:center;\">Mark</th><th style=\"text-align:right;\">Grade</th></tr>\n                                </thead>\n                                <tbody>\n                                    " + v737.map(v753 => {
      const v754 = v753.term && v753.term.toLowerCase().includes("mid");
      const v755 = v754 ? 50 : 100;
      const v756 = v754 ? v753.value * 2 : v753.value;
      const v757 = v756 >= 90 ? "A+" : v756 >= 80 ? "A" : v756 >= 70 ? "B+" : v756 >= 60 ? "B" : v756 >= 50 ? "C+" : v756 >= 40 ? "C" : v756 >= 35 ? "D" : "NG";
      const v758 = v756 >= 80 ? "#10b981" : v756 >= 60 ? "#2563eb" : v756 >= 40 ? "#d97706" : "#dc2626";
      return "\n                                            <tr style=\"border-bottom:1px solid #f8fafc;\">\n                                                <td style=\"padding:0.5rem 0; font-weight:600;\">" + escapeHtml(v753.subject) + "</td>\n                                                <td>" + escapeHtml(v753.term) + "</td>\n                                                <td style=\"font-weight:700; color:var(--text-main); text-align:center;\">" + v753.value + "/" + v755 + "</td>\n                                                <td style=\"font-weight:800; color:" + v758 + "; text-align:right;\">" + v757 + "</td>\n                                            </tr>\n                                        ";
    }).join("") + "\n                                </tbody>\n                            </table>\n                        </div>") + "\n                </div>\n            </div>\n\n            <div class=\"card\">\n                <div style=\"padding:1rem; font-weight:700; border-bottom:1px solid #f1f5f9;\">Recent Homework Activity</div>\n                <div style=\"padding:0.5rem;\">\n                    " + (v736.length === 0 ? "<p style=\"text-align:center; color:var(--text-muted); padding:2rem; font-size:0.85rem;\">No homework found " + (v728 ? "for " + v728 : "yet") + ".</p>" : "<div style=\"display:flex; flex-direction:column; gap:0.5rem;\">\n                            " + v736.slice(0, 20).map(v759 => {
      const v760 = v759.homework || {
        subject: "Unknown",
        date: "N/A"
      };
      let v761 = (v759.status || "NOT TRACKED").toUpperCase();
      if (v761 === "NOT DONE") {
        v761 = "NOT TRACKED";
      }
      const v762 = v761 === "DONE" ? "#1e293b" : v761 === "INCOMPLETE" ? "#f59e0b" : "#ef4444";
      return "\n                                    <div style=\"display:flex; justify-content:space-between; align-items:center; background:#fff; padding:0.75rem 1rem; border-radius:0.75rem; border:1px solid #f1f5f9;\">\n                                        <div>\n                                            <div style=\"font-size:0.95rem; font-weight:700; color:#1e293b;\">" + escapeHtml(v760.subject) + "</div>\n                                            <div style=\"font-size:0.75rem; color:var(--text-muted);\">" + formatDateLabel(v760.date) + "</div>\n                                        </div>\n                                        <div style=\"font-size:0.85rem; font-weight:800; color:" + v762 + ";\">" + v761 + "</div>\n                                    </div>\n                                ";
    }).join("") + "\n                        </div>") + "\n                </div>\n            </div>\n        ";
    lucide.createIcons();
  } catch (v763) {
    console.error("Trace Error:", v763);
    v729.innerHTML = "<div class=\"empty-state\"><p>Error loading student trace. Please try again.</p></div>";
  }
};
let allAdminNotices = [];
window.loadAdminNotices = async function (v764 = false) {
  const v765 = document.getElementById("notices-admin-list");
  if (!v765) {
    return;
  }
  const v766 = "notices";
  const v767 = Date.now();
  if (!v764 && allAdminNotices.length > 0 && lastFetch[v766] && v767 - lastFetch[v766] < 60000) {
    return;
  }
  v765.innerHTML = "<div style=\"text-align:center;padding:2rem;color:var(--text-muted);\">Loading notices…</div>";
  try {
    const {
      data: v768,
      error: v769
    } = await v1.from("notices").select("*").order("created_at", {
      ascending: false
    }).limit(20);
    if (v769) {
      throw v769;
    }
    allAdminNotices = v768 || [];
    lastFetch[v766] = v767;
    renderAdminNotices();
  } catch (v770) {
    console.error("Error loading notices:", v770);
    v765.innerHTML = "<div class=\"empty-state\"><p>Error loading notices. Have you run the SQL to create the notices table?</p></div>";
  }
};
function renderAdminNotices() {
  const v771 = document.getElementById("notices-admin-list");
  if (!v771) {
    return;
  }
  if (allAdminNotices.length === 0) {
    v771.innerHTML = "\n            <div class=\"empty-state\">\n                <i data-lucide=\"megaphone\" style=\"width:48px;height:48px;opacity:0.3;margin-bottom:1rem;\"></i>\n                <p>No notices yet.</p>\n                <p style=\"font-size:0.75rem;margin-top:0.25rem;\">Click <b>+ New Notice</b> to publish one on the login screen.</p>\n            </div>\n        ";
    lucide.createIcons();
    return;
  }
  v771.innerHTML = allAdminNotices.map(v772 => {
    const v773 = formatDateLabel(v772.created_at.split("T")[0]);
    const v774 = v772.is_active ? "var(--accent)" : "var(--text-muted)";
    const v775 = v772.is_active ? "var(--accent-light)" : "#f1f5f9";
    const v776 = v772.is_active ? "Active" : "Inactive";
    const imageHtml = v772.image_url ? "\n                        <div style=\"margin-top:0.75rem; margin-bottom:0.75rem; max-width: 150px; border-radius: 8px; overflow:hidden; border:1px solid #cbd5e1; cursor: pointer;\" onclick=\"window.viewNoticeImage('" + escapeHtml(v772.image_url) + "')\">\n                            <img src=\"" + v772.image_url + "\" style=\"width:100%; max-height:120px; object-fit:cover; display:block;\">\n                        </div>" : "";
    return "\n            <div class=\"card\" style=\"position:relative; padding:1rem 1.1rem;\">\n                <div style=\"display:flex;justify-content:space-between;align-items:flex-start;gap:0.5rem;\">\n                    <div style=\"flex:1;\">\n                        <div style=\"font-weight:700;font-size:0.95rem;color:var(--text-main);margin-bottom:0.3rem;\">" + escapeHtml(v772.title) + "</div>\n                        <div style=\"font-size:0.82rem;color:var(--text-muted);line-height:1.5;\">" + escapeHtml(v772.body) + "</div>\n" + imageHtml + "\n                        <div style=\"font-size:0.7rem;color:var(--text-muted);margin-top:0.5rem;\">📅 " + v773 + "</div>\n                    </div>\n                    <div style=\"display:flex;flex-direction:column;gap:0.4rem;align-items:flex-end;flex-shrink:0;\">\n                        <span style=\"font-size:0.68rem;font-weight:700;padding:0.2rem 0.6rem;border-radius:999px;background:" + v775 + ";color:" + v774 + ";\">" + v776 + "</span>\n                        <div style=\"display:flex;gap:0.35rem;\">\n                            <button class=\"btn btn-icon\" onclick=\"window.toggleNoticeActive('" + v772.id + "', " + v772.is_active + ")\" \n                                title=\"" + (v772.is_active ? "Deactivate" : "Activate") + "\"\n                                style=\"width:30px;height:30px;padding:0;background:" + v775 + ";color:" + v774 + ";\">\n                                <i data-lucide=\"" + (v772.is_active ? "eye-off" : "eye") + "\" style=\"width:14px;height:14px;\"></i>\n                            </button>\n                            <button class=\"btn btn-icon\" onclick=\"window.deleteNotice('" + v772.id + "')\" \n                                title=\"Delete\"\n                                style=\"width:30px;height:30px;padding:0;color:var(--error);background:var(--error-light);\">\n                                <i data-lucide=\"trash-2\" style=\"width:14px;height:14px;\"></i>\n                            </button>\n                        </div>\n                    </div>\n                </div>\n            </div>\n        ";
  }).join("");
  lucide.createIcons();
}

function compressImage(file, maxWidth = 800, quality = 0.6) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = event => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxWidth) {
            width = Math.round((width * maxWidth) / height);
            height = maxWidth;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(blob => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Canvas compression failed'));
          }
        }, 'image/jpeg', quality);
      };
      img.onerror = error => reject(error);
    };
    reader.onerror = error => reject(error);
  });
}

window.viewNoticeImage = function(imgSrc) {
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.backgroundColor = 'rgba(0,0,0,0.85)';
  overlay.style.backdropFilter = 'blur(10px)';
  overlay.style.zIndex = '99999';
  overlay.style.display = 'flex';
  overlay.style.justifyContent = 'center';
  overlay.style.alignItems = 'center';
  overlay.style.opacity = '0';
  overlay.style.transition = 'opacity 0.25s ease';
  overlay.style.cursor = 'pointer';
  overlay.onclick = () => {
    overlay.style.opacity = '0';
    img.style.transform = 'scale(0.95)';
    setTimeout(() => overlay.remove(), 250);
  };

  const img = document.createElement('img');
  img.src = imgSrc;
  img.style.maxWidth = '100%';
  img.style.maxHeight = '80vh';
  img.style.borderRadius = '16px';
  img.style.boxShadow = '0 25px 50px -12px rgba(0,0,0,0.5)';
  img.style.transform = 'scale(0.95)';
  img.style.transition = 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)';
  img.style.objectFit = 'contain';

  const closeText = document.createElement('div');
  closeText.style.position = 'absolute';
  closeText.style.bottom = '2rem';
  closeText.style.color = 'rgba(255,255,255,0.6)';
  closeText.style.fontSize = '0.75rem';
  closeText.style.letterSpacing = '0.05em';
  closeText.innerText = 'Click anywhere to close';
  closeText.style.textTransform = 'uppercase';

  overlay.appendChild(img);
  overlay.appendChild(closeText);
  document.body.appendChild(overlay);
  
  requestAnimationFrame(() => {
    overlay.style.opacity = '1';
    img.style.transform = 'scale(1)';
  });
};

window.openAddNoticeModal = function () {
  const v777 = "\n        <div class=\"modal-title\">📢 Publish New Notice</div>\n        <form id=\"notice-form\">\n            <div class=\"form-group\">\n                <label class=\"form-label\">Notice Title</label>\n                <input type=\"text\" id=\"notice-title\" class=\"form-input\" placeholder=\"e.g. Annual Sports Day Announcement\" required>\n            </div>\n            <div class=\"form-group\">\n                <label class=\"form-label\">Notice Body</label>\n                <textarea id=\"notice-body\" class=\"form-input\" rows=\"5\" placeholder=\"Write the full notice message here…\" required></textarea>\n            </div>\n            <div class=\"form-group\">\n                <label class=\"form-label\">Notice Photo (Optional)</label>\n                <input type=\"file\" id=\"notice-photo\" class=\"form-input\" accept=\"image/*\">\n                <div id=\"notice-photo-preview-container\" style=\"display:none; margin-top:0.5rem; border-radius:8px; overflow:hidden; border:1px solid #cbd5e1; max-width:200px; max-height:150px; position:relative;\">\n                    <img id=\"notice-photo-preview\" style=\"width:100%; height:100%; object-fit:cover; display:block;\">\n                    <button type=\"button\" id=\"btn-remove-photo\" style=\"position:absolute; top:4px; right:4px; border:none; background:rgba(0,0,0,0.6); color:white; border-radius:50%; width:24px; height:24px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-weight:bold; font-size:14px; padding:0; line-height:1;\">\n                      &times;\n                    </button>\n                </div>\n            </div>\n            <p style=\"font-size:0.75rem;color:var(--text-muted);margin-bottom:1rem;\">This notice will be visible on the school login screen immediately after publishing.</p>\n            <div style=\"display:flex;gap:0.5rem;\">\n                <button type=\"submit\" class=\"btn btn-primary\" style=\"flex:1;\">\n                    <i data-lucide=\"megaphone\" style=\"width:14px;height:14px;\"></i> Publish Notice\n                </button>\n                <button type=\"button\" class=\"btn btn-ghost\" onclick=\"window.closeModal()\" style=\"flex:1;\">Cancel</button>\n            </div>\n        </form>\n    ";
  window.openModal(v777);

  const photoInput = document.getElementById("notice-photo");
  const previewContainer = document.getElementById("notice-photo-preview-container");
  const previewImg = document.getElementById("notice-photo-preview");
  const removeBtn = document.getElementById("btn-remove-photo");

  photoInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        previewImg.src = event.target.result;
        previewContainer.style.display = "block";
      };
      reader.readAsDataURL(file);
    } else {
      previewImg.src = "";
      previewContainer.style.display = "none";
    }
  });

  removeBtn.addEventListener("click", () => {
    photoInput.value = "";
    previewImg.src = "";
    previewContainer.style.display = "none";
  });

  document.getElementById("notice-form").addEventListener("submit", async v778 => {
    v778.preventDefault();
    const v779 = document.getElementById("notice-title").value.trim();
    const v780 = document.getElementById("notice-body").value.trim();
    if (!v779 || !v780) {
      return;
    }
    const submitBtn = v778.target.querySelector("button[type='submit']");
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = "Publishing...";

    try {
      let imageUrl = null;
      const file = photoInput.files[0];
      if (file) {
        toast("Compressing image...", 2000);
        const compressedBlob = await compressImage(file, 800, 0.6);
        const fileName = "notice-" + Date.now() + ".jpg";
        
        toast("Uploading image...", 5000);
        try {
          const { data, error } = await v1.storage
            .from("notices")
            .upload(fileName, compressedBlob, { contentType: "image/jpeg" });
          if (!error) {
            const { data: urlData } = v1.storage.from("notices").getPublicUrl(fileName);
            imageUrl = urlData.publicUrl;
          } else {
            throw error;
          }
        } catch (storageError) {
          console.warn("Upload to notices bucket failed, trying student-photos bucket...", storageError);
          try {
            const { data, error } = await v1.storage
              .from("student-photos")
              .upload("notices/" + fileName, compressedBlob, { contentType: "image/jpeg" });
            if (!error) {
              const { data: urlData } = v1.storage.from("student-photos").getPublicUrl("notices/" + fileName);
              imageUrl = urlData.publicUrl;
            } else {
              throw error;
            }
          } catch (photoBucketError) {
            console.warn("Upload to student-photos bucket failed, using base64 fallback...", photoBucketError);
            imageUrl = await new Promise((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result);
              reader.readAsDataURL(compressedBlob);
            });
          }
        }
      }

      toast("Publishing notice...", 3000);
      const {
        error: v781
      } = await v1.from("notices").insert({
        title: v779,
        body: v780,
        image_url: imageUrl,
        is_active: true,
        created_by: window.currentUser?.id || null
      });
      if (v781) {
        throw v781;
      }
      toast("Notice published successfully!");
      window.closeModal();
      window.loadAdminNotices();
    } catch (v782) {
      console.error("Error publishing notice:", v782);
      toast("Error: " + v782.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
    }
  });
};

window.toggleNoticeActive = async function (v783, v784) {
  try {
    const {
      error: v785
    } = await v1.from("notices").update({
      is_active: !v784
    }).eq("id", v783);
    if (v785) {
      throw v785;
    }
    toast(v784 ? "Notice deactivated" : "Notice activated!");
    window.loadAdminNotices();
  } catch (v786) {
    console.error("Toggle notice error:", v786);
    toast("Error updating notice");
  }
};

window.deleteNotice = async function (v787) {
  if (!confirm("Delete this notice? It will be removed from the login screen.")) {
    return;
  }
  try {
    const {
      error: v788
    } = await v1.from("notices").delete().eq("id", v787);
    if (v788) {
      throw v788;
    }
    toast("Notice deleted");
    window.loadAdminNotices();
  } catch (v789) {
    console.error("Delete notice error:", v789);
    toast("Error deleting notice");
  }
};
let currentMsgTarget = "school";
window.initMessageTab = function () {
  const v790 = document.getElementById("msg-class");
  if (v790 && allStudents && allStudents.length > 0) {
    const v791 = [...new Set(allStudents.map(v792 => v792.class).filter(Boolean))].sort((v793, v794) => {
      const v795 = parseInt((v793.match(/\d+/) || ["0"])[0]);
      const v796 = parseInt((v794.match(/\d+/) || ["0"])[0]);
      return v795 - v796;
    });
    v790.innerHTML = "<option value=\"\">-- Select Class --</option>" + v791.map(v797 => "<option value=\"" + escapeHtml(v797) + "\">" + escapeHtml(v797) + "</option>").join("");
  }
  window.selectMsgTarget(currentMsgTarget);
  lucide.createIcons();
};
window.selectMsgTarget = function (v798) {
  currentMsgTarget = v798;
  const v799 = ["school", "class", "individual"];
  v799.forEach(v802 => {
    const v803 = document.getElementById("msg-target-" + v802);
    if (!v803) {
      return;
    }
    if (v802 === v798) {
      v803.className = "btn btn-sm btn-primary msg-target-btn";
    } else {
      v803.className = "btn btn-sm btn-ghost msg-target-btn";
    }
  });
  const v800 = document.getElementById("msg-class-group");
  const v801 = document.getElementById("msg-student-group");
  if (v800) {
    v800.style.display = v798 === "class" || v798 === "individual" ? "block" : "none";
  }
  if (v801) {
    v801.style.display = v798 === "individual" ? "block" : "none";
  }
  lucide.createIcons();
};
window.onMsgClassChange = function () {
  if (currentMsgTarget !== "individual") {
    return;
  }
  const v804 = document.getElementById("msg-class")?.value;
  const v805 = document.getElementById("msg-student");
  if (!v805) {
    return;
  }
  const v806 = allStudents.filter(v807 => v807.class === v804);
  v805.innerHTML = "<option value=\"\">-- Select Student --</option>" + v806.map(v808 => "<option value=\"" + escapeHtml(v808.id) + "\">" + escapeHtml(v808.name) + " (Roll: " + escapeHtml(String(v808.roll || "")) + ")</option>").join("");
};
window.sendMessage = async function () {
  const v809 = document.getElementById("msg-subject")?.value.trim();
  const v810 = document.getElementById("msg-body")?.value.trim();
  if (!v809 || !v810) {
    toast("Please fill in subject and message body.");
    return;
  }
  let v811 = null;
  if (currentMsgTarget === "class") {
    v811 = document.getElementById("msg-class")?.value;
    if (!v811) {
      toast("Please select a class.");
      return;
    }
  } else if (currentMsgTarget === "individual") {
    v811 = document.getElementById("msg-student")?.value;
    if (!v811) {
      toast("Please select a student.");
      return;
    }
  }
  const v812 = currentMsgTarget === "school" ? "the whole school" : currentMsgTarget === "class" ? "Class: " + v811 : (() => {
    const v813 = allStudents.find(v814 => v814.id === v811);
    if (v813) {
      return v813.name;
    } else {
      return "selected student";
    }
  })();
  if (!confirm("Send this message to " + v812 + "?")) {
    return;
  }
  try {
    toast("Sending message…", 3000);
    const {
      error: v815
    } = await v1.from("messages").insert({
      sender_id: window.currentUser?.id || null,
      target_type: currentMsgTarget,
      target_value: v811,
      subject: v809,
      body: v810
    });
    if (v815) {
      throw v815;
    }
    toast("Message sent successfully!");
    document.getElementById("msg-subject").value = "";
    document.getElementById("msg-body").value = "";
    window.loadSentMessages();
  } catch (v816) {
    console.error("Send message error:", v816);
    toast("Error: " + v816.message);
  }
};
window.loadSentMessages = async function () {
  const v817 = document.getElementById("sent-messages-list");
  if (!v817) {
    return;
  }
  v817.innerHTML = "<div style=\"text-align:center;padding:1rem;color:var(--text-muted);font-size:0.82rem;\">Loading…</div>";
  try {
    const {
      data: v818,
      error: v819
    } = await v1.from("messages").select("*").order("created_at", {
      ascending: false
    }).limit(15);
    if (v819) {
      throw v819;
    }
    if (!v818 || v818.length === 0) {
      v817.innerHTML = "<div class=\"empty-state\" style=\"padding:1.5rem;\"><p>No messages sent yet.</p></div>";
      return;
    }
    const v820 = {
      school: "🏫",
      class: "👥",
      individual: "👤"
    };
    const v821 = {
      school: "Whole School",
      class: "Class",
      individual: "Student"
    };
    v817.innerHTML = v818.map(v822 => {
      const v823 = new Date(v822.created_at);
      const v824 = v823.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit"
      });
      const v825 = formatDateLabel(v822.created_at.split("T")[0]) + " " + v824;
      const v826 = v820[v822.target_type] || "📨";
      const v827 = v821[v822.target_type] || v822.target_type;
      const v828 = v822.target_type === "individual" ? (() => {
        const v829 = allStudents.find(v830 => v830.id === v822.target_value);
        if (v829) {
          return v829.name;
        } else {
          return v822.target_value;
        }
      })() : v822.target_value || "All";
      return "\n                <div class=\"card\" style=\"padding:0.85rem 1rem; margin-bottom:0.5rem;\">\n                    <div style=\"display:flex;justify-content:space-between;align-items:flex-start;gap:0.5rem;\">\n                        <div style=\"flex:1;\">\n                            <div style=\"font-weight:700;font-size:0.88rem;color:var(--text-main);margin-bottom:0.2rem;\">" + escapeHtml(v822.subject) + "</div>\n                            <div style=\"font-size:0.78rem;color:var(--text-muted);line-height:1.4;\">" + escapeHtml(v822.body.length > 120 ? v822.body.slice(0, 120) + "…" : v822.body) + "</div>\n                            <div style=\"font-size:0.68rem;color:var(--text-muted);margin-top:0.4rem;\">📅 " + v825 + "</div>\n                        </div>\n                        <div style=\"flex-shrink:0;text-align:right; display:flex; flex-direction:column; align-items:flex-end;\">\n                            <div style=\"font-size:0.68rem;font-weight:700;background:var(--primary-light);color:var(--primary);padding:0.2rem 0.5rem;border-radius:999px;\">" + v826 + " " + v827 + "</div>\n                            <div style=\"font-size:0.7rem;color:var(--text-muted);margin-top:0.3rem;\">" + escapeHtml(v828) + "</div>\n                            <button class=\"btn btn-ghost\" onclick=\"window.deleteMessage('" + v822.id + "')\" style=\"padding:0.25rem; margin-top:0.5rem; color:var(--error); height:28px; width:28px;\">\n                                <i data-lucide=\"trash-2\" style=\"width:14px; height:14px;\"></i>\n                            </button>\n                        </div>\n                    </div>\n                </div>\n            ";
    }).join("");
    lucide.createIcons();
  } catch (v831) {
    console.error("Load messages error:", v831);
    v817.innerHTML = "<div class=\"empty-state\" style=\"padding:1rem;\"><p>Error loading messages. Have you run the SQL to create the messages table?</p></div>";
  }
};
window.deleteMessage = async function (v832) {
  if (!confirm("Are you sure you want to delete this message?")) {
    return;
  }
  try {
    toast("Deleting message…");
    const {
      error: v833
    } = await v1.from("messages").delete().eq("id", v832);
    if (v833) {
      throw v833;
    }
    toast("Message deleted successfully");
    window.loadSentMessages();
  } catch (v834) {
    console.error("Delete message error:", v834);
    toast("Error deleting message");
  }
};
let adminLeaveApplications = [];
window.loadLeaveApplications = async function () {
  try {
    const v835 = document.getElementById("admin-leave-list");
    if (v835 && adminLeaveApplications.length === 0) {
      v835.innerHTML = "<div style=\"text-align:center;padding:2rem;color:var(--text-muted)\">Loading applications...</div>";
    }
    const {
      data: v836,
      error: v837
    } = await v1.from("leave_applications").select("id, student_id, parent_id, target_teacher_id, start_date, end_date, reason, status, created_at").order("created_at", {
      ascending: false
    });
    if (v837) {
      throw v837;
    }
    adminLeaveApplications = (v836 || []).map(v838 => {
      const v839 = allStudents.find(v840 => String(v840.id) === String(v838.student_id)) || null;
      return {
        ...v838,
        studentName: v839 ? v839.name : "Unknown Student",
        studentRoll: v839 ? v839.roll : "?",
        studentClass: v839 ? v839.class : "?"
      };
    });
    window.renderLeaveApps();
  } catch (v841) {
    console.error("loadLeaveApplications error", v841);
    const v842 = document.getElementById("admin-leave-list");
    if (v842) {
      v842.innerHTML = "<p style=\"text-align:center;padding:2rem;color:var(--error)\">Error loading leave applications: " + v841.message + "</p>";
    }
  }
};
window.renderLeaveApps = function () {
  const v843 = document.getElementById("admin-leave-list");
  if (!v843) {
    return;
  }
  if (adminLeaveApplications.length === 0) {
    v843.innerHTML = "\n            <div class=\"empty-state\" style=\"text-align:center;padding:3rem;\">\n                <i data-lucide=\"file-check-2\" style=\"opacity:0.3; width:48px; height:48px; margin-bottom:1rem; color:var(--text-muted)\"></i>\n                <p style=\"color:var(--text-muted)\">No leave applications received yet.</p>\n            </div>";
    if (window.lucide) {
      lucide.createIcons();
    }
    return;
  }
  v843.innerHTML = adminLeaveApplications.map(v844 => {
    const v845 = v844.status === "Approved" ? "#10b981" : v844.status === "Rejected" ? "#ef4444" : "#f59e0b";
    const v846 = v844.status === "Pending";
    return "\n            <div class=\"card\" style=\"padding:1.25rem; margin-bottom:1rem; border-left: 4px solid " + v845 + "\">\n                <div style=\"display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.75rem;\">\n                    <div>\n                        <h3 style=\"font-size:1rem; margin-bottom:0.2rem;\">" + escapeHtml(v844.studentName) + "</h3>\n                        <p style=\"font-size:0.75rem; color:var(--text-muted); font-weight:700;\">Roll " + v844.studentRoll + " &bull; " + v844.studentClass + "</p>\n                    </div>\n                    <span style=\"background:" + v845 + "22; color:" + v845 + "; padding:0.25rem 0.6rem; border-radius:1rem; font-size:0.7rem; font-weight:800; text-transform:uppercase;\">" + v844.status + "</span>\n                </div>\n                \n                <div style=\"background:#f8fafc; padding:0.75rem; border-radius:0.5rem; margin-bottom:1rem;\">\n                    <p style=\"font-size:0.85rem; font-weight:700; margin-bottom:0.25rem;\">\n                        <i data-lucide=\"calendar\" style=\"width:12px; height:12px; vertical-align:middle; margin-right:4px;\"></i>\n                        " + formatDateLabel(v844.start_date) + " to " + formatDateLabel(v844.end_date) + "\n                    </p>\n                    <p style=\"font-size:0.85rem; line-height:1.4; color:var(--text-main);\">" + escapeHtml(v844.reason) + "</p>\n                </div>\n\n                <div style=\"display:flex; justify-content:space-between; align-items:center;\">\n                    <span style=\"font-size:0.7rem; color:var(--text-muted);\">Submitted: " + formatDateLabel(v844.created_at.split("T")[0]) + "</span>\n                    <div style=\"display:flex; gap:0.5rem;\">\n                    " + (v846 ? "\n                        <button class=\"btn btn-secondary btn-sm\" style=\"color:#10b981; background:#dcfce7; border:none; padding:0.4rem 0.75rem;\" onclick=\"window.updateLeaveStatus('" + v844.id + "', 'Approved')\">Approve</button>\n                        <button class=\"btn btn-secondary btn-sm\" style=\"color:#ef4444; background:#fee2e2; border:none; padding:0.4rem 0.75rem;\" onclick=\"window.updateLeaveStatus('" + v844.id + "', 'Rejected')\">Reject</button>\n                    " : "") + "\n                        <button class=\"btn btn-secondary btn-sm\" style=\"color:#94a3b8; background:#f1f5f9; border:none; padding:0.4rem 0.6rem;\" onclick=\"window.deleteLeaveApp('" + v844.id + "')\" title=\"Delete\"><i data-lucide=\"trash-2\" style=\"width:14px;height:14px\"></i></button>\n                    </div>\n                </div>\n            </div>\n        ";
  }).join("");
  if (window.lucide) {
    lucide.createIcons();
  }
};
window.updateLeaveStatus = async function (v847, v848) {
  try {
    toast("Marking as " + v848 + "...");
    const {
      error: v849
    } = await v1.from("leave_applications").update({
      status: v848
    }).eq("id", v847);
    if (v849) {
      throw v849;
    }
    toast("✅ Application " + v848 + "!");
    await window.loadLeaveApplications();
  } catch (v850) {
    console.error("updateLeaveStatus error", v850);
    toast("Error updating status");
  }
};
window.deleteLeaveApp = async function (v851) {
  if (!confirm("Delete this leave application? This cannot be undone.")) {
    return;
  }
  try {
    toast("Deleting...");
    const {
      error: v852
    } = await v1.from("leave_applications").delete().eq("id", v851);
    if (v852) {
      throw v852;
    }
    toast("✅ Application deleted.");
    await window.loadLeaveApplications();
    if (window.updateNotificationBadges) {
      window.updateNotificationBadges();
    }
  } catch (v853) {
    console.error("deleteLeaveApp error", v853);
    toast("Error deleting application");
  }
};
window.updateNotificationBadges = async function () {
  try {
    const {
      count: v854,
      error: v855
    } = await v1.from("leave_applications").select("*", {
      count: "exact",
      head: true
    }).eq("status", "Pending");
    if (v855) {
      throw v855;
    }
    const v856 = document.getElementById("more-badge-leave");
    if (v856) {
      if (v854 > 0) {
        v856.textContent = v854;
        v856.style.display = "flex";
        v856.style.alignItems = "center";
        v856.style.justifyContent = "center";
      } else {
        v856.style.display = "none";
      }
    }
    const v857 = document.getElementById("badge-more");
    if (v857) {
      if (v854 > 0) {
        v857.style.display = "block";
      } else {
        v857.style.display = "none";
      }
    }
  } catch (v858) {
    console.warn("Failed to update notification badges", v858);
  }
};
window.openSubjectsModal = async function () {
  openModal("<div style=\"text-align:center;padding:2rem;\"><div class=\"spinner\"></div><p style=\"margin-top:1rem;color:var(--text-muted)\">Loading subjects...</p></div>");
  try {
    await loadSubjects(true);
    window.renderSubjectsModal();
  } catch (v859) {
    console.error(v859);
    openModal("<div style=\"padding:1.5rem;text-align:center;color:var(--error)\">Error loading subjects</div>");
  }
};
window.renderSubjectsModal = function () {
  const v860 = allSubjects.map((v862, v863) => "\n        <div style=\"display:flex; justify-content:space-between; align-items:center; padding:0.75rem 1rem; background:#f8fafc; border-radius:12px; margin-bottom:0.5rem; border:1px solid #e2e8f0;\">\n            <span style=\"font-weight:600; color:var(--text-main); font-size:0.9rem;\">" + escapeHtml(v862) + "</span>\n            <div style=\"display:flex; gap:0.35rem;\">\n                <button class=\"btn btn-secondary btn-sm\" style=\"color:var(--primary); background:#e0e7ff; border:none; padding:0.35rem 0.6rem; border-radius:8px; display:flex; align-items:center; justify-content:center;\" onclick=\"window.editSubject('" + escapeHtml(v862) + "')\" title=\"Edit Subject\">\n                    <i data-lucide=\"edit-2\" style=\"width:14px; height:14px;\"></i>\n                </button>\n                <button class=\"btn btn-secondary btn-sm\" style=\"color:var(--error); background:#fee2e2; border:none; padding:0.35rem 0.6rem; border-radius:8px; display:flex; align-items:center; justify-content:center;\" onclick=\"window.deleteSubject('" + escapeHtml(v862) + "')\" title=\"Delete Subject\">\n                    <i data-lucide=\"trash-2\" style=\"width:14px; height:14px;\"></i>\n                </button>\n            </div>\n        </div>\n    ").join("");
  const v861 = "\n        <div style=\"padding:0.5rem;\">\n            <div style=\"display:flex; align-items:center; gap:0.5rem; margin-bottom:1.25rem;\">\n                <div style=\"background:#f1f5f9; color:#475569; width:36px; height:36px; border-radius:10px; display:flex; align-items:center; justify-content:center;\">\n                    <i data-lucide=\"book-open\" style=\"width:20px; height:20px;\"></i>\n                </div>\n                <h2 style=\"font-size:1.15rem; font-weight:800; margin:0;\">Subject Management</h2>\n            </div>\n\n            <p style=\"font-size:0.75rem; color:var(--text-muted); margin-bottom:1rem; line-height:1.4;\">\n                Total active subjects: <b>" + allSubjects.length + "</b>. Teachers will see these subjects when assigning homework or entering marks.\n            </p>\n\n            <div style=\"max-height:220px; overflow-y:auto; margin-bottom:1.25rem; padding-right:4px;\">\n                " + (allSubjects.length === 0 ? "\n                    <p style=\"text-align:center; color:var(--text-muted); padding:1rem; font-size:0.8rem;\">No subjects added yet.</p>\n                " : v860) + "\n            </div>\n\n            <div style=\"border-top:1px solid #e2e8f0; padding-top:1rem;\">\n                <h4 style=\"margin:0 0 0.5rem 0; font-size:0.85rem; font-weight:800; color:var(--text-main);\">Add New Subject</h4>\n                <div style=\"display:flex; gap:0.5rem;\">\n                    <input type=\"text\" id=\"new-subject-name\" placeholder=\"Subject Name (e.g. Science)\" style=\"flex:1; padding:0.55rem 0.75rem; border:1px solid #cbd5e1; border-radius:10px; font-size:0.85rem;\" />\n                    <button class=\"btn btn-primary\" onclick=\"window.addSubject()\" style=\"padding:0.55rem 1.1rem; border-radius:10px; font-size:0.85rem; font-weight:800;\">Add</button>\n                </div>\n            </div>\n        </div>\n    ";
  openModal(v861);
  if (window.lucide) {
    lucide.createIcons();
  }
};
window.editSubject = async function (v864) {
  const v865 = prompt("Enter new name for subject \"" + v864 + "\":", v864);
  if (v865 === null) {
    return;
  }
  const v866 = v865.trim();
  if (!v866) {
    toast("Subject name cannot be empty");
    return;
  }
  if (v866 === v864) {
    return;
  }
  if (allSubjects.includes(v866)) {
    toast("Subject already exists");
    return;
  }
  try {
    toast("Updating subject...");
    const {
      error: v867
    } = await v1.from("subjects").update({
      name: v866
    }).eq("name", v864);
    if (v867) {
      throw v867;
    }
    toast("✅ Subject renamed successfully!");
    await loadSubjects(true);
    window.renderSubjectsModal();
  } catch (v868) {
    console.error("editSubject error", v868);
    toast("Error renaming subject: " + v868.message);
  }
};
window.addSubject = async function () {
  const v869 = document.getElementById("new-subject-name");
  const v870 = v869?.value?.trim();
  if (!v870) {
    toast("Please enter a subject name");
    return;
  }
  if (allSubjects.includes(v870)) {
    toast("Subject already exists");
    return;
  }
  try {
    toast("Adding subject...");
    const {
      error: v871
    } = await v1.from("subjects").insert({
      name: v870,
      sort_order: allSubjects.length + 1
    });
    if (v871) {
      throw v871;
    }
    toast("✅ Subject added!");
    await loadSubjects(true);
    window.renderSubjectsModal();
  } catch (v872) {
    console.error("addSubject error", v872);
    toast("Error adding subject: " + v872.message);
  }
};
window.deleteSubject = async function (v873) {
  if (!confirm("Are you sure you want to delete \"" + v873 + "\"? Teachers won't be able to select it for new homework/marks.")) {
    return;
  }
  try {
    toast("Deleting subject...");
    const {
      error: v874
    } = await v1.from("subjects").delete().eq("name", v873);
    if (v874) {
      throw v874;
    }
    toast("✅ Subject deleted!");
    await loadSubjects(true);
    window.renderSubjectsModal();
  } catch (v875) {
    console.error("deleteSubject error", v875);
    toast("Error deleting subject: " + v875.message);
  }
};
window.exportTeachers = async function () {
  try {
    toast("Preparing teacher export...", 2000);
    const {
      data: v876,
      error: v877
    } = await v1.from("profiles").select("full_name, email, mobile, description, assigned_classes").eq("role", "teacher").order("full_name");
    if (v877) {
      throw v877;
    }
    if (!v876 || v876.length === 0) {
      toast("No teachers to export");
      return;
    }
    const v878 = v876.map(v883 => {
      let v884 = "No classes assigned";
      try {
        if (v883.assigned_classes) {
          const v885 = typeof v883.assigned_classes === "string" ? JSON.parse(v883.assigned_classes) : v883.assigned_classes;
          if (Array.isArray(v885)) {
            v884 = v885.join(", ");
          } else if (v885 && v885.assignments) {
            v884 = v885.assignments.map(v886 => {
              const v887 = v886.isHomeroom ? " (Homeroom)" : "";
              const v888 = v886.subjects && v886.subjects.length > 0 ? " [" + v886.subjects.join(", ") + "]" : "";
              return "" + v886.className + v887 + v888;
            }).join(" | ");
          }
        }
      } catch (v889) {
        v884 = String(v883.assigned_classes || "");
      }
      return {
        Name: v883.full_name || "",
        Email: v883.email || "",
        Phone: v883.mobile || "",
        "Bio / Description": v883.description || "",
        "Assigned Classes": v884
      };
    });
    const v879 = XLSX.utils.json_to_sheet(v878);
    const v880 = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(v880, v879, "Teachers");
    const v881 = new Date().toISOString().split("T")[0];
    const v882 = "Holy_Garden_Teachers_" + v881 + ".xlsx";
    await window.saveExcel(v880, v882);
    toast("Exported: " + v882);
  } catch (v890) {
    console.error("Teacher export failed", v890);
    toast("Export failed: " + v890.message);
  }
};
window.initCASData = function () {
  const v891 = document.getElementById("cas-class");
  if (v891) {
    const v892 = CLASS_OPTIONS.filter(v893 => v893.match(/grade\s*[1-5]$/i) || v893.match(/^class\s*[1-5]$/i));
    v891.innerHTML = "<option value=\"\">-- Class --</option>" + v892.map(v894 => "<option value=\"" + escapeHtml(v894) + "\">" + escapeHtml(v894) + "</option>").join("");
  }
};
window.onCasClassChange = function () {
  const v895 = document.getElementById("cas-class")?.value;
  const v896 = document.getElementById("cas-student");
  const v897 = document.getElementById("cas-subject");
  const v898 = document.getElementById("cas-unsupported-alert");
  const v899 = document.getElementById("cas-content-wrap");
  if (!v895) {
    if (v896) {
      v896.innerHTML = "<option value=\"\">-- Student --</option>";
    }
    if (v897) {
      v897.innerHTML = "<option value=\"\">-- Subject --</option>";
    }
    return;
  }
  if (!v895.match(/grade\s*[1-5]$/i) && !v895.match(/^class\s*[1-5]$/i)) {
    if (v898) {
      v898.style.display = "block";
    }
    if (v899) {
      v899.innerHTML = "";
    }
    return;
  } else if (v898) {
    v898.style.display = "none";
  }
  const v900 = allStudents.filter(v901 => v901.class === v895);
  if (v896) {
    v896.innerHTML = "<option value=\"\">-- Student --</option>" + v900.map(v902 => "<option value=\"" + v902.id + "\">" + escapeHtml(v902.name) + " (Roll: " + (v902.roll || "-") + ")</option>").join("");
  }
  if (window.CAS_CONFIG && window.CAS_CONFIG.subjects) {
    let v903 = Object.keys(window.CAS_CONFIG.subjects);
    v903 = v903.filter(v904 => {
      const v905 = window.CAS_CONFIG.subjects[v904];
      if (v905.classes && v905.classes.length > 0) {
        const v906 = v895.replace(/grade/i, "Class").trim();
        return v905.classes.includes(v906);
      }
      return true;
    });
    if (v897) {
      v897.innerHTML = "<option value=\"\">-- Subject --</option>" + v903.map(v907 => "<option value=\"" + escapeHtml(v907) + "\">" + escapeHtml(v907) + "</option>").join("");
    }
  }
};
window.onCasSubjectChange = function () {
  const v908 = document.getElementById("cas-subject")?.value;
  const v909 = document.getElementById("cas-theme");
  const v910 = document.getElementById("cas-class")?.value;
  if (!v908 || !window.CAS_CONFIG || !window.CAS_CONFIG.subjects[v908]) {
    if (v909) {
      v909.innerHTML = "<option value=\"\">-- Theme --</option>";
    }
    return;
  }
  const v911 = window.getCASSubjectConfig(v908, v910 || "");
  if (v909 && v911 && v911.themes) {
    v909.innerHTML = "<option value=\"\">-- Theme --</option>" + v911.themes.map(v912 => "<option value=\"" + escapeHtml(v912) + "\">" + escapeHtml(v912) + "</option>").join("");
  }
  window.loadCASData();
};
window.loadCASData = async function () {
  const v913 = document.getElementById("cas-student")?.value;
  const v914 = document.getElementById("cas-subject")?.value;
  const v915 = document.getElementById("cas-theme")?.value;
  const v916 = document.getElementById("cas-content-wrap");
  const v917 = document.getElementById("cas-class")?.value;
  const v918 = document.getElementById("cas-term")?.value || "First Term";
  if (!v916) {
    return;
  }
  if (!v913 || !v914 || !v915 || !v917) {
    v916.innerHTML = "<div style=\"text-align:center; padding:2rem; color:var(--text-muted); font-size:0.85rem;\">Please select Class, Student, Subject, and Theme to load evaluations.</div>";
    return;
  }
  const v919 = v917.match(/grade\s*[1-3]$/i) || v917.match(/^class\s*[1-3]$/i) ? "1-3" : "4-5";
  const v920 = window.getCASSubjectConfig(v914, v917);
  if (!v920) {
    return;
  }
  v916.innerHTML = "<div style=\"text-align:center; padding:2rem;\"><div class=\"spinner\" style=\"margin:0 auto\"></div><p style=\"color:var(--text-muted);margin-top:0.5rem;\">Loading CAS...</p></div>";
  try {
    const {
      data: v921,
      error: v922
    } = await v1.from("cas_learning_outcomes").select("*").eq("subject", v914).eq("class_level", v919).eq("theme", v915);
    if (v922) {
      throw v922;
    }
    let v923 = v921 || [];
    
    // Grade-based indicator filtering (Class 1, 2, 3, 4, 5 client-side prefix matching)
    const gradeMatch = v917.match(/\d+/);
    const gradeNum = gradeMatch ? gradeMatch[0] : null;
    if (gradeNum) {
      v923 = v923.filter(item => {
        const parts = item.indicator_code.split('-');
        if (parts.length >= 2) {
          return parts[1] === gradeNum;
        }
        return true;
      });
    }

    if (v923.length === 0) {
      v923 = v920.criteria
        .filter(c => !c.skill || c.skill === v915 || c.theme === v915)
        .map((v933, v934) => ({
          id: "fallback-" + v934,
          indicator_code: v933.code || "IND-" + (v934 + 1),
          description: v933.desc || v933
        }));
    }
    const {
      data: v924,
      error: v925
    } = await v1.from("cas_student_portfolio_log").select("*").eq("student_id", v913).eq("term_id", v918);
    if (v925) {
      throw v925;
    }
    const v926 = v924 || [];
    let v927 = "<div class=\"card\" style=\"padding:1.5rem; overflow-x:auto;\">";
    let v928 = 0;
    let v929 = 0;
    if (v919 === "1-3") {
      v927 += "<h3 style=\"margin-top:0; color:var(--primary); font-size:1rem; font-weight:800;\">Class 1-3 Continuous Monitoring (No Terminal Written Exams)</h3>";
      v927 += "<table style=\"width:100%; border-collapse:collapse; text-align:left; font-size:0.9rem;\">";
      v927 += "<thead><tr style=\"border-bottom:2px solid var(--border);\"><th style=\"padding:0.75rem 0.5rem;\">Learning Outcome / Indicator</th><th style=\"padding:0.75rem 0.5rem; width:220px;\">Regular Rating (1 - 4) & Method</th><th style=\"padding:0.75rem 0.5rem; width:220px;\">After Additional Support (3 - 4)</th></tr></thead><tbody>";
      v923.forEach(v935 => {
        const v936 = v926.find(v946 => v946.outcome_id === v935.id || v935.id.startsWith && v935.id.startsWith("fallback-") && v946.outcome_id === v935.id);
        const v937 = v936 ? v936.phase1_rating : "";
        const v938 = v936 ? v936.phase1_method : "Observation";
        const v939 = v936 ? v936.phase2_rating : "";
        const v940 = v936 ? v936.phase2_method : "Oral Work";
        const v941 = v936 ? v936.remedial_status : "";
        const v942 = v937 ? parseInt(v937, 10) : null;
        const v943 = v939 ? parseInt(v939, 10) : null;
        let v944 = "";
        if (v943) {
          v944 = v943;
        } else if (v942 && v942 >= 3) {
          v944 = v942;
        }
        if (v944) {
          v928 += parseInt(v944, 10);
          v929++;
        }
        const v945 = ["Classroom Participation", "Oral Work", "Written Work", "Project/Practical Work", "Observation"];
        v927 += "<tr style=\"border-bottom:1px solid #f1f5f9;\">\n                    <td style=\"padding:0.75rem 0.5rem;\">\n                        <span style=\"font-weight:700; color:var(--primary); font-size:0.75rem; display:block;\">[" + v935.indicator_code + "]</span>\n                        <span style=\"color:var(--text-main); font-weight:500;\">" + escapeHtml(v935.description) + "</span>\n                        " + (v941 === "Requires Support" ? "<span class=\"badge badge-a\" style=\"margin-left:0.5rem; background:#fee2e2; color:#dc2626; padding:2px 6px; border-radius:4px; font-size:0.7rem; font-weight:700;\">Requires Support</span>" : "") + "\n                    </td>\n                    <td style=\"padding:0.75rem 0.5rem;\">\n                        <div style=\"display:flex; gap:0.25rem; margin-bottom:0.35rem;\">\n                            " + [1, 2, 3, 4].map(v947 => "\n                                <button class=\"btn btn-sm " + (v942 === v947 ? "btn-primary" : "btn-ghost") + "\" style=\"flex:1; padding:0.25rem; font-weight:700;\" onclick=\"window.savePortfolioLog('" + v913 + "', '" + v935.id + "', 1, " + v947 + ", document.getElementById('method-p1-" + v935.id + "').value)\">" + v947 + "</button>\n                            ").join("") + "\n                        </div>\n                        <select id=\"method-p1-" + v935.id + "\" class=\"form-input\" style=\"padding:0.25rem; font-size:0.75rem; height:auto;\" onchange=\"window.savePortfolioLog('" + v913 + "', '" + v935.id + "', 1, " + (v942 || "null") + ", this.value)\">\n                            " + v945.map(v948 => "<option value=\"" + v948 + "\" " + (v938 === v948 ? "selected" : "") + ">" + v948 + "</option>").join("") + "\n                        </select>\n                    </td>\n                    <td style=\"padding:0.75rem 0.5rem;\">\n                        " + (v942 === 1 || v942 === 2 ? "\n                            <div style=\"display:flex; gap:0.25rem; margin-bottom:0.35rem;\">\n                                " + [3, 4].map(v949 => "\n                                    <button class=\"btn btn-sm " + (v943 === v949 ? "btn-primary" : "btn-ghost") + "\" style=\"flex:1; padding:0.25rem; font-weight:700;\" onclick=\"window.savePortfolioLog('" + v913 + "', '" + v935.id + "', 2, " + v949 + ", document.getElementById('method-p2-" + v935.id + "').value)\">" + v949 + "</button>\n                                ").join("") + "\n                            </div>\n                            <select id=\"method-p2-" + v935.id + "\" class=\"form-input\" style=\"padding:0.25rem; font-size:0.75rem; height:auto;\" onchange=\"window.savePortfolioLog('" + v913 + "', '" + v935.id + "', 2, " + (v943 || "null") + ", this.value)\">\n                                " + v945.map(v950 => "<option value=\"" + v950 + "\" " + (v940 === v950 ? "selected" : "") + ">" + v950 + "</option>").join("") + "\n                            </select>\n                        " : "<span style=\"color:var(--text-muted); font-size:0.8rem; font-style:italic;\">No support phase required</span>") + "\n                    </td>\n                </tr>";
      });
      v927 += "</tbody></table>";
    } else {
      v927 += "<h3 style=\"margin-top:0; color:var(--primary); font-size:1rem; font-weight:800;\">Class 4-5 Continuous Evaluation (100% Formative - 2083 guidelines)</h3>";
      v927 += "<table style=\"width:100%; border-collapse:collapse; text-align:left; font-size:0.9rem;\">";
      v927 += "<thead><tr style=\"border-bottom:2px solid var(--border);\"><th style=\"padding:0.75rem 0.5rem;\">Learning Outcome / Indicator</th><th style=\"padding:0.75rem 0.5rem; width:200px; text-align:center;\">Regular Evaluation (नियमित)</th><th style=\"padding:0.75rem 0.5rem; width:200px; text-align:center;\">Support Evaluation (थप सहायता)</th></tr></thead><tbody>";
      v923.forEach(v951 => {
        const v952 = v926.find(v958 => v958.outcome_id === v951.id || v951.id.startsWith && v951.id.startsWith("fallback-") && v958.outcome_id === v951.id);
        const v953 = v952 ? v952.phase1_rating : "";
        const v954 = v952 ? v952.phase2_rating : "";
        const v955 = v953 ? parseInt(v953, 10) : null;
        const v956 = v954 ? parseInt(v954, 10) : null;
        let v957 = v956 || v955;
        if (v957) {
          v928 += v957;
          v929++;
        }
        v927 += "<tr style=\"border-bottom:1px solid #f1f5f9;\">\n                    <td style=\"padding:0.75rem 0.5rem;\">\n                        <span style=\"font-weight:700; color:var(--primary); font-size:0.75rem; display:block;\">[" + v951.indicator_code + "]</span>\n                        <span style=\"color:var(--text-main); font-weight:500;\">" + escapeHtml(v951.description) + "</span>\n                        " + ((v955 === 1 || v955 === 2) && !v956 ? "<div style=\"background:#fee2e2; color:#dc2626; padding:0.35rem; border-radius:6px; font-size:0.75rem; font-weight:700; margin-top:0.25rem;\">⚠️ Corrective teaching required! Log Phase 2 support score.</div>" : "") + "\n                    </td>\n                    <td style=\"padding:0.75rem 0.5rem; text-align:center;\">\n                        <div style=\"display:flex; gap:0.25rem; justify-content:center;\">\n                            " + [1, 2, 3, 4].map(v959 => "\n                                <button class=\"btn btn-sm " + (v955 === v959 ? "btn-primary" : "btn-ghost") + "\" style=\"width:30px; padding:0.25rem; font-weight:700;\" onclick=\"window.savePortfolioLog('" + v913 + "', '" + v951.id + "', 1, " + v959 + ", 'Regular Assessment')\">" + v959 + "</button>\n                            ").join("") + "\n                        </div>\n                    </td>\n                    <td style=\"padding:0.75rem 0.5rem; text-align:center;\">\n                        " + (v955 === 1 || v955 === 2 ? "\n                            <div style=\"display:flex; gap:0.25rem; justify-content:center;\">\n                                " + [3, 4].map(v960 => "\n                                    <button class=\"btn btn-sm " + (v956 === v960 ? "btn-primary" : "btn-ghost") + "\" style=\"width:30px; padding:0.25rem; font-weight:700;\" onclick=\"window.savePortfolioLog('" + v913 + "', '" + v951.id + "', 2, " + v960 + ", 'Remedial Support')\">" + v960 + "</button>\n                                ").join("") + "\n                            </div>\n                        " : "<span style=\"color:var(--text-muted); font-size:0.8rem; font-style:italic;\">No support needed</span>") + "\n                    </td>\n                </tr>";
      });
      v927 += "</tbody></table>";
    }
    const v930 = v929 * 4;
    const v931 = v930 > 0 ? (v928 / v930 * 100).toFixed(1) : 0;
    let v932 = "";
    if (v919 === "1-3") {
      const v961 = v929 > 0 ? (v928 / v929).toFixed(1) : "—";
      let v962 = "—";
      if (v929 > 0) {
        const v963 = Math.round(v928 / v929);
        v962 = window.CAS_CONFIG.grading["1-3"][v963]?.label || "—";
      }
      v932 = "\n                <div>\n                    <div style=\"font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;\">Evaluated Indicators</div>\n                    <div style=\"font-size:1.5rem; font-weight:800; color:var(--text-main);\">" + v929 + " <span style=\"font-size:1rem; color:var(--text-muted); font-weight:500;\">/ " + v923.length + "</span></div>\n                </div>\n                <div>\n                    <div style=\"font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;\">Average Level</div>\n                    <div style=\"font-size:1.5rem; font-weight:800; color:var(--text-main);\">" + v961 + "</div>\n                </div>\n                <div>\n                    <div style=\"font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;\">Overall Level</div>\n                    <div style=\"font-size:1.25rem; font-weight:800; color:var(--primary);\">" + v962 + "</div>\n                </div>\n            ";
    } else {
      const v964 = window.CAS_CONFIG.grading["4-5"] || [];
      const v965 = v964.find(v966 => v931 >= v966.min && v931 <= v966.max) || v964[v964.length - 1] || {};
      v932 = "\n                <div>\n                    <div style=\"font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;\">Total Score</div>\n                    <div style=\"font-size:1.5rem; font-weight:800; color:var(--text-main);\">" + v928 + " <span style=\"font-size:1rem; color:var(--text-muted); font-weight:500;\">/ " + v930 + "</span></div>\n                </div>\n                <div>\n                    <div style=\"font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;\">Achievement %</div>\n                    <div style=\"font-size:1.5rem; font-weight:800; color:var(--text-main);\">" + v931 + "%</div>\n                </div>\n                <div>\n                    <div style=\"font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;\">Grade</div>\n                    <div style=\"font-size:1.5rem; font-weight:800; color:var(--text-main);\">" + (v965.grade || "-") + "</div>\n                </div>\n                <div>\n                    <div style=\"font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;\">GPA</div>\n                    <div style=\"font-size:1.5rem; font-weight:800; color:var(--primary);\">" + (v965.gpa || "-") + "</div>\n                </div>\n            ";
    }
    v927 += "<div style=\"margin-top:1.5rem; padding:1.25rem; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0;\">\n            <div style=\"display:grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap:1rem; text-align:center; margin-bottom: 1rem;\">\n                " + v932 + "\n            </div>\n            <button class=\"btn btn-secondary btn-block\" onclick=\"window.printCASReportCard('" + v913 + "', '" + v918 + "')\" style=\"margin-top: 0.75rem; display:flex; align-items:center; justify-content:center; gap:0.5rem;\">\n                <i data-lucide=\"printer\" style=\"width:16px; height:16px;\"></i> Print / Save Report Card\n            </button>\n        </div>";
    v927 += "</div>";
    v916.innerHTML = v927;
  } catch (v967) {
    console.error("CAS Load Error:", v967);
    v916.innerHTML = "<div style=\"color:var(--error); padding:2rem; text-align:center;\">Failed to load data: " + v967.message + "</div>";
  }
};
window.savePortfolioLog = async function (v968, v969, v970, v971, v972) {
  try {
    const v973 = document.getElementById("cas-term")?.value || "First Term";
    const v974 = {
      student_id: v968,
      outcome_id: v969,
      term_id: v973,
      evaluated_by: window.currentUserProfile?.id || window.currentUser?.id,
      updated_at: new Date().toISOString()
    };
    if (v970 === 1) {
      v974.phase1_rating = v971 === "null" ? null : v971;
      v974.phase1_method = v972;
      v974.remedial_status = v971 <= 2 ? "Requires Support" : "Completed";
    } else {
      v974.phase2_rating = v971 === "null" ? null : v971;
      v974.phase2_method = v972;
      v974.remedial_status = "Completed";
      v974.phase2_date = new Date().toISOString();
    }
    const {
      data: v975
    } = await v1.from("cas_student_portfolio_log").select("*").eq("student_id", v968).eq("outcome_id", v969).eq("term_id", v973).maybeSingle();
    const {
      error: v976
    } = await v1.from("cas_student_portfolio_log").upsert({
      ...(v975 || {}),
      ...v974
    }, {
      onConflict: "student_id, outcome_id, term_id"
    });
    if (v976) {
      throw v976;
    }
    toast("Evaluation logged ✓");
    window.loadCASData();
  } catch (v977) {
    console.error("Error saving CAS:", v977);
    toast("Failed to save portfolio rating");
  }
};