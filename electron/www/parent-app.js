import v1 from "./supabase.js";
import { validateSession, openModal, closeModal, toast, logout, escapeHtml, getLocalToday, TERMS, checkNewFeatures, safeParseAssignments, CACHE_DURATION, shouldFetch, initNepaliDatePicker, formatDateLabel, fetchProfileMap } from "./shared.js";
import { IS_PRODUCTION, ESEWA_CONFIG } from "./config.js";
window.supabaseClient = v1;
let currentParent = null;
let myChildren = [];
let selectedChild = null;
let currentTab = "attendance";
let selectedRoutineType = "Class";
let selectedRoutineTerm = "Regular";
const lastFetch = {};
const tabDataCache = {};
function hideSplashScreen() {
  const v2 = document.getElementById("splash-screen");
  if (v2) {
    v2.classList.add("hidden");
    setTimeout(() => v2.remove(), 500);
  }
}
const globalSplashTimeout = setTimeout(() => hideSplashScreen(), 8000);
async function initParentPortal() {
  const v3 = await validateSession();
  if (!v3) {
    return;
  }
  try {
    const v4 = window.currentUserProfile;
    if (!v4 || v4.role !== "parent") {
      window.location.href = "login.html";
      return;
    }
    currentParent = v4;
    let v5 = v4.can_view_portal !== false;
    let v6 = v4.can_view_marks !== false;
    let v_cas = true;
    try {
      const v8 = typeof v4.assigned_classes === "string" ? JSON.parse(v4.assigned_classes) : v4.assigned_classes;
      if (v8 && !Array.isArray(v8)) {
        if (v8.can_view_marks === true) {
          v6 = true;
        } else if (v8.can_view_marks === false) {
          v6 = false;
        }
        if (v8.can_view_cas === true) {
          v_cas = true;
        } else if (v8.can_view_cas === false) {
          v_cas = false;
        }
        if (v8.can_view_portal === true) {
          v5 = true;
        }
      }
    } catch (v9) {}
    currentParent.can_view_marks = v6;
    currentParent.can_view_portal = v5;
    currentParent.can_view_cas = v_cas;
    if (!currentParent.can_view_portal) {
      document.body.innerHTML = "\n                <div style=\"display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; text-align:center; padding:2rem;\">\n                    <h2 style=\"color:#dc2626\">Access Restricted</h2>\n                    <p>Your portal is currently disabled. Please contact the office.</p>\n                    <button class=\"btn btn-primary\" onclick=\"window.logout()\">Logout</button>\n                </div>";
      return;
    }
    const v7 = document.getElementById("view-title");
    if (v7 && currentParent.full_name) {
      v7.textContent = currentParent.full_name;
    }
    try {
      const {
        data: v10
      } = await v1.from("subjects").select("*");
      if (v10) {
        window.subjectsDb = v10;
      }
    } catch (v11) {}
    hideSplashScreen();
    await loadChildren();
    renderDashboard();
    setupTabs();
    history.replaceState({
      level: 0
    }, "");
    if (myChildren.length === 1) {
      window.viewChild(myChildren[0].id, false);
      history.replaceState({
        level: 1,
        childId: myChildren[0].id
      }, "");
    }
    initRealtime();
    updateBadges();
    checkNewFeatures();
    verifyEsewaPayment();
  } catch (v12) {
    console.error("Portal Init Error", v12);
    if (!window.location.pathname.includes("login.html")) {
      window.location.href = "login.html";
    }
  } finally {
    if (typeof globalSplashTimeout !== "undefined") {
      clearTimeout(globalSplashTimeout);
    }
    const v13 = document.getElementById("splash-screen");
    if (v13) {
      v13.style.opacity = "0";
      setTimeout(() => v13.remove(), 300);
    }
  }
}
async function loadChildren(v14 = false) {
  try {
    const v15 = "children";
    if (!shouldFetch(v15, lastFetch, v14)) {
      return;
    }
    let v16 = [];
    const v17 = typeof currentParent.assigned_classes === "string" ? JSON.parse(currentParent.assigned_classes) : currentParent.assigned_classes;
    if (Array.isArray(v17)) {
      v16 = v17;
    } else if (v17?.studentIds) {
      v16 = v17.studentIds;
    }
    if (v16.length === 0) {
      return;
    }
    const {
      data: v18,
      error: v19
    } = await v1.from("students").select("id, name, roll, class, photo").in("id", v16);
    if (!v19) {
      myChildren = v18 || [];
      lastFetch[v15] = Date.now();
    } else {
      throw v19;
    }
  } catch (v20) {
    console.error("Load children error", v20);
    toast("Error loading child profiles.");
  }
}
function renderDashboard() {
  const v21 = document.getElementById("children-list");
  if (!v21) {
    return;
  }
  v21.innerHTML = "\n        <div style=\"padding:1rem;\">\n            <h2 style=\"margin-bottom:1rem; font-weight:800;\">My Children</h2>\n            <div class=\"children-grid\">\n                " + myChildren.map(v22 => "\n                    <div class=\"card\" onclick=\"window.viewChild('" + v22.id + "')\" style=\"display:flex; justify-content:space-between; align-items:center; padding:1.25rem; cursor:pointer; position:relative;\">\n                        <div>\n                            <h3 style=\"color:var(--primary); margin:0; display:flex; align-items:center; gap:0.5rem;\">\n                                " + escapeHtml(v22.name) + "\n                                <span id=\"dot-" + v22.id + "\" class=\"notif-dot\" style=\"display:none; width:8px; height:8px; background:#ef4444; border-radius:50%;\"></span>\n                            </h3>\n                            <div style=\"margin-top:0.25rem; font-size:0.8rem; color:var(--text-muted);\">\n                                Class " + escapeHtml(v22.class) + " • Roll " + v22.roll + "\n                            </div>\n                        </div>\n                        <i data-lucide=\"chevron-right\" style=\"color:var(--primary)\"></i>\n                    </div>\n                ").join("") + "\n            </div>\n        </div>\n    ";
  lucide.createIcons();
}
async function fetchHomeroomTeacher(v23) {
  const v24 = "homeroom_" + v23;
  const v25 = sessionStorage.getItem(v24);
  if (v25 && v25 !== "null" && v25 !== "undefined") {
    try {
      return JSON.parse(v25);
    } catch (v26) {}
  }
  try {
    const {
      data: v27,
      error: v28
    } = await v1.from("profiles").select("id, full_name, assigned_classes, mobile, description").eq("role", "teacher");
    if (v28) {
      throw v28;
    }
    for (const v29 of v27 || []) {
      const v30 = safeParseAssignments(v29.assigned_classes);
      const v31 = v30.some(v32 => v32.className && v23 && v32.className.trim().toLowerCase() === v23.trim().toLowerCase() && (v32.isHomeroom === true || v32.isHomeroom === "true" || v32.isHomeroom === 1 || v32.isHomeroom === "1"));
      if (v31) {
        sessionStorage.setItem(v24, JSON.stringify(v29));
        return v29;
      }
    }
  } catch (v33) {
    console.warn("Error fetching homeroom teacher:", v33);
  }
  return null;
}
window.viewChild = async function (v34, v35 = true) {
  selectedChild = myChildren.find(v41 => v41.id === v34);
  if (v35) {
    history.pushState({
      level: 1,
      childId: v34
    }, "");
  }
  document.getElementById("children-list").style.display = "none";
  document.getElementById("child-details").style.display = "block";
  const v36 = await fetchHomeroomTeacher(selectedChild.class);
  const v37 = v36 ? v36.full_name : "Not Assigned";
  window.currentHomeroomTeacher = v36;
  document.getElementById("child-profile-header").innerHTML = "\n        <div class=\"card\" style=\"margin:1rem; background:linear-gradient(135deg, var(--primary), #4338ca); color:white; padding:1.5rem; border-radius:1.5rem; display:flex; align-items:center; gap:1.25rem;\">\n            <div style=\"width:64px; height:64px; background:rgba(255,255,255,0.2); border:2px solid white; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:2rem; font-weight:800; overflow:hidden;\">\n                " + (selectedChild.photo ? "<img src=\"" + selectedChild.photo + "\" style=\"width:100%; height:100%; object-fit:cover; object-position:top;\">" : "" + selectedChild.name.charAt(0)) + "\n            </div>\n            <div style=\"flex:1\">\n                <h2 style=\"margin:0; font-size:1.5rem;\">" + escapeHtml(selectedChild.name) + "</h2>\n                <p style=\"opacity:0.9; margin:0.25rem 0 0 0; font-size:0.85rem;\">Class " + escapeHtml(selectedChild.class) + " • Roll " + selectedChild.roll + "</p>\n                <div style=\"margin-top:0.75rem; padding-top:0.75rem; border-top:1px solid rgba(255,255,255,0.2); display:flex; align-items:center; gap:0.5rem; font-size:0.8rem;\">\n                    <i data-lucide=\"user-check\" style=\"width:14px; height:14px;\"></i>\n                    <span style=\"cursor: pointer;\" onclick=\"window.viewTeacherProfile()\">Homeroom Teacher: <strong style=\"text-decoration: underline;\">" + escapeHtml(v37) + "</strong></span>\n                </div>\n            </div>\n        </div>\n    ";
  if (window.lucide) {
    lucide.createIcons();
  }
  const v38 = document.querySelector("#child-vertical-nav .nav-btn:last-child span");
  if (v38) {
    v38.textContent = myChildren.length > 1 ? "Other Child" : "Dashboard";
  }
  const v39 = document.querySelector("#child-vertical-nav .nav-btn[data-tab=\"marks\"]");
  if (v39) {
    v39.style.display = currentParent.can_view_marks ? "flex" : "none";
  }
  const v40 = document.getElementById("nav-btn-cas");
  if (v40) {
    const v42 = selectedChild && selectedChild.class && (selectedChild.class.match(/grade\s*[1-5]$/i) || selectedChild.class.match(/^class\s*[1-5]$/i));
    v40.style.display = (v42 && currentParent.can_view_cas !== false) ? "flex" : "none";
  }
  if (typeof initRealtime === "function") {
    initRealtime();
    updateBadges();
  }
  renderChildDashboard();
};
function renderChildDashboard() {
  const v43 = document.getElementById("child-tab-content");
  const v44 = currentParent.can_view_marks ? "\n            <div class=\"grid-card\" onclick=\"window.switchTab('marks')\">\n                <i data-lucide=\"graduation-cap\"></i>\n                <span>Exam Marks</span>\n            </div>\n    " : "";
  const v45 = selectedChild && selectedChild.class && (selectedChild.class.match(/grade\s*[1-5]$/i) || selectedChild.class.match(/^class\s*[1-5]$/i));
  const v46 = (v45 && currentParent.can_view_cas !== false) ? "\n            <div class=\"grid-card\" onclick=\"window.switchTab('cas')\">\n                <i data-lucide=\"award\" style=\"color: var(--primary);\"></i>\n                <span>CAS Evaluations</span>\n            </div>\n    " : "";
  v43.innerHTML = "\n        <div class=\"dashboard-header\" style=\"padding: 1rem;\">\n            <h2 style=\"font-size: 1.5rem; font-weight: 800;\">Hello, " + escapeHtml(selectedChild.name) + "</h2>\n            <p style=\"color: var(--text-muted);\">Quick Access</p>\n        </div>\n\n        <div class=\"dashboard-grid\">\n            <div class=\"grid-card\" onclick=\"window.switchTab('attendance')\">\n                <i data-lucide=\"calendar-check\"></i>\n                <span>Attendance</span>\n            </div>\n            " + v44 + "\n            " + v46 + "\n            <div class=\"grid-card\" onclick=\"window.switchTab('homework')\">\n                <i data-lucide=\"book-open\"></i>\n                <span>Homework</span>\n            </div>\n            <div class=\"grid-card\" onclick=\"window.switchTab('account')\">\n                <i data-lucide=\"wallet\"></i>\n                <span>Fees</span>\n            </div>\n            <div class=\"grid-card\" onclick=\"window.switchTab('messages')\" style=\"position: relative;\">\n                <i data-lucide=\"megaphone\"></i>\n                <span>Notices</span>\n                <span id=\"dash-msg-badge-" + selectedChild.id + "\" class=\"grid-badge\" style=\"display:none; position:absolute; top:8px; right:8px; width:8px; height:8px; background:#ef4444; border-radius:50%; box-shadow: 0 0 0 2px white;\"></span>\n            </div>\n            <div class=\"grid-card\" onclick=\"window.switchTab('routine')\">\n                <i data-lucide=\"clock\"></i>\n                <span>Routine</span>\n            </div>\n            <div class=\"grid-card\" onclick=\"window.switchTab('receipts')\">\n                <i data-lucide=\"file-text\"></i>\n                <span>Receipts</span>\n            </div>\n            <div class=\"grid-card\" onclick=\"window.switchTab('leave')\" style=\"position: relative;\">\n                <i data-lucide=\"clipboard-list\"></i>\n                <span>Leave</span>\n                <span id=\"dash-leave-badge-" + selectedChild.id + "\" class=\"grid-badge\" style=\"display:none; position:absolute; top:8px; right:8px; width:8px; height:8px; background:#ef4444; border-radius:50%; box-shadow: 0 0 0 2px white;\"></span>\n            </div>\n            <div class=\"grid-card\" onclick=\"window.backToDashboard()\">\n                <i data-lucide=\"refresh-cw\" style=\"color: var(--text-muted);\"></i>\n                <span>Switch Child</span>\n            </div>\n        </div>\n    ";
  lucide.createIcons();
  updateBadges();
}
window.switchTab = function (v47, v48 = true) {
  currentTab = v47;
  if (v48 && selectedChild) {
    history.pushState({
      level: 2,
      childId: selectedChild.id,
      tab: v47
    }, "");
  }
  document.getElementById("child-vertical-nav").style.display = "none";
  document.getElementById("child-profile-header").style.display = "none";
  const v49 = document.getElementById("child-content-area");
  v49.classList.add("full-screen-view");
  if (v47 === "messages") {
    document.getElementById("msg-badge").style.display = "none";
    markMessagesAsRead();
  }
  if (v47 === "leave") {
    document.getElementById("leave-badge").style.display = "none";
    markLeaveAsRead();
  }
  loadTabContent();
};
window.backToDashboard = function (v50 = true) {
  if (myChildren.length === 1) {
    window.viewChild(myChildren[0].id, v50);
    return;
  }
  if (v50) {
    history.pushState({
      level: 0
    }, "");
  }
  document.getElementById("children-list").style.display = "block";
  document.getElementById("child-details").style.display = "none";
  selectedChild = null;
  renderDashboard();
};
function setupTabs() {
  document.querySelectorAll(".nav-btn").forEach(v51 => {
    if (!v51.dataset.tab) {
      return;
    }
    v51.addEventListener("click", () => {
      window.switchTab(v51.dataset.tab, true);
    });
  });
}
async function loadTabContent() {
  const v52 = document.getElementById("child-tab-content");
  const v53 = "\n        <div class=\"view-header\" style=\"display:flex; align-items:center; gap:1rem; padding:1rem; background:white; position:sticky; top:0; z-index:100; border-bottom:1px solid #eee;\">\n            <button class=\"btn btn-ghost btn-icon\" onclick=\"window.closePageView()\">\n                <i data-lucide=\"arrow-left\"></i>\n            </button>\n            <h2 style=\"font-size:1.1rem; margin:0; text-transform:capitalize;\">" + currentTab + "</h2>\n        </div>\n    ";
  v52.innerHTML = v53 + "<div class=\"spinner-wrap\"><div class=\"spinner\"></div></div>";
  try {
    let v54 = "";
    if (currentTab === "attendance") {
      v54 = await renderAttendance();
    } else if (currentTab === "homework") {
      v54 = await renderHomework();
    } else if (currentTab === "marks") {
      v54 = await renderMarks();
    } else if (currentTab === "cas") {
      v54 = await renderCAS();
    } else if (currentTab === "messages") {
      v54 = await renderMessages();
    } else if (currentTab === "routine") {
      v54 = await renderRoutine();
    } else if (currentTab === "leave") {
      v54 = await renderLeave();
    } else if (currentTab === "account") {
      v54 = await renderAccount();
    } else if (currentTab === "receipts") {
      v54 = await renderReceipts();
    }
    v52.innerHTML = v53 + v54;
    if (currentTab === "leave") {
      const v55 = document.getElementById("leave-form");
      if (v55) {
        v55.onsubmit = handleLeaveSubmit;
      }
    }
    lucide.createIcons();
    if (window.initNepaliDatePicker) {
      window.initNepaliDatePicker(".nepali-date-picker");
    }
  } catch (v56) {
    v52.innerHTML = v53 + "<p class=\"error\" style=\"padding:2rem;text-align:center;\">Error loading records.</p>";
  }
}
window.closePageView = function () {
  document.getElementById("child-vertical-nav").style.display = "flex";
  document.getElementById("child-profile-header").style.display = "block";
  document.getElementById("child-content-area").classList.remove("full-screen-view");
  renderChildDashboard();
  lucide.createIcons();
  if (selectedChild) {
    history.replaceState({
      level: 1,
      childId: selectedChild.id
    }, "");
  }
};
window.addEventListener("popstate", v57 => {
  if (window.ignoreNextPopstate) {
    window.ignoreNextPopstate = false;
    return;
  }
  if (window.isModalTriggeredPopstate) {
    window.isModalTriggeredPopstate = false;
    return;
  }
  const v58 = document.getElementById("modal-overlay");
  if (v58 && v58.classList.contains("open")) {
    return;
  }
  const v59 = v57.state;
  if (!v59) {
    window.backToDashboard(false);
    return;
  }
  if (v59.level === 0) {
    window.backToDashboard(false);
  } else if (v59.level === 1) {
    if (selectedChild && selectedChild.id === v59.childId) {
      document.getElementById("child-vertical-nav").style.display = "flex";
      document.getElementById("child-profile-header").style.display = "block";
      document.getElementById("child-content-area").classList.remove("full-screen-view");
      renderChildDashboard();
      lucide.createIcons();
    } else {
      window.viewChild(v59.childId, false);
    }
  } else if (v59.level === 2) {
    if (!selectedChild || selectedChild.id !== v59.childId) {
      window.viewChild(v59.childId, false);
    }
    window.switchTab(v59.tab, false);
  }
});
async function renderAttendance() {
  const {
    data: v60
  } = await v1.from("attendance").select("*").eq("student_id", selectedChild.id).order("date", {
    ascending: false
  }).limit(30);
  const uniqueAttendance = [];
  const seenDates = new Set();
  (v60 || []).forEach(record => {
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
      const finalKey = bsDateStr || record.date.split('T')[0].split(' ')[0];
      if (!seenDates.has(finalKey)) {
        seenDates.add(finalKey);
        uniqueAttendance.push(record);
      }
    }
  });
  const v61 = uniqueAttendance;
  return "\n        <div class=\"card\" style=\"margin:1rem; padding:0; overflow:hidden;\">\n            " + (v61.length ? v61.map(v62 => "\n                <div style=\"padding:1rem; border-bottom:1px solid #f1f5f9; display:flex; justify-content:space-between; align-items:center;\">\n                    <span style=\"font-weight:600;\">" + formatDateLabel(v62.date) + "</span>\n                    <span class=\"badge " + (v62.status === "P" ? "badge-success" : "badge-error") + "\" style=\"font-size:0.7rem;\">" + (v62.status === "P" ? "PRESENT" : "ABSENT") + "</span>\n                </div>\n            ").join("") : "<p style=\"padding:2rem; text-align:center; color:var(--text-muted);\">No records found.</p>") + "\n        </div>\n    ";
}
async function renderHomework(v63 = null) {
  const v64 = getLocalToday();
  const v65 = new Date();
  v65.setDate(v65.getDate() - 1);
  const v66 = window.NepaliFunctions ? window.NepaliFunctions.AD2BS(v65.toISOString().split("T")[0], "YYYY-MM-DD", "YYYY-MM-DD") : v65.toISOString().split("T")[0];
  const v67 = v63 || v66;
  try {
    let v68 = v64;
    let v69 = v67;
    if (window.NepaliFunctions) {
      v68 = window.NepaliFunctions.BS2AD(v64, "YYYY-MM-DD", "YYYY-MM-DD") || v64;
      v69 = window.NepaliFunctions.BS2AD(v67, "YYYY-MM-DD", "YYYY-MM-DD") || v67;
    }
    const {
      data: v70,
      error: v71
    } = await v1.from("homework").select("*").eq("class", selectedChild.class).or("date.eq." + v68 + ",date.eq." + v69).order("date", {
      ascending: false
    });
    if (v71) {
      throw v71;
    }
    const {
      data: v72
    } = await v1.from("hw_status").select("*").eq("student_id", selectedChild.id);
    const v73 = {};
    (v72 || []).forEach(v79 => v73[v79.hw_id] = v79.status);
    const v74 = [...new Set((v70 || []).map(v80 => v80.teacher_id).filter(Boolean))];
    const v75 = v74.length > 0 ? await fetchProfileMap(v74) : {};
    const v76 = v70.filter(v81 => v81.date === v68);
    const v77 = v70.filter(v82 => v82.date === v69);
    const v78 = (v83, v84 = false) => {
      const v85 = v73[v83.id] || "NOT TRACKED";
      const v86 = {
        DONE: "#10b981",
        "NOT DONE": "#ef4444",
        INCOMPLETE: "#f59e0b",
        "NOT TRACKED": "#94a3b8"
      };
      const v87 = v86[v85.toUpperCase()] || "#94a3b8";
      const v88 = v83.teacher_id ? v75[v83.teacher_id] || null : null;
      return "\n                <div class=\"card\" style=\"padding:1rem; margin-bottom:0.75rem; border-left:4px solid " + (v84 ? v87 : "var(--primary)") + "\">\n                    <div style=\"display:flex; justify-content:space-between; align-items:flex-start;\">\n                        <h4 style=\"margin:0; color:var(--text-main);\">" + escapeHtml(v83.subject) + "</h4>\n                        " + (v84 ? "<span style=\"font-size:0.65rem; font-weight:800; color:" + v87 + "; background:" + v87 + "11; padding:2px 6px; border-radius:4px; border:1px solid " + v87 + "33;\">" + v85 + "</span>" : "") + "\n                    </div>\n                    <p style=\"font-size:0.85rem; color:var(--text-muted); margin:0.5rem 0;\">" + escapeHtml(v83.task) + "</p>\n                    <div style=\"font-size:0.7rem; color:var(--text-muted); font-weight:600;\">Due: " + window.formatDateLabel(v83.due || v83.date) + "</div>\n                    " + (v88 ? "<div style=\"display:flex;align-items:center;gap:0.3rem;margin-top:0.4rem;font-size:0.68rem;color:var(--text-muted);\"><i data-lucide=\"user\" style=\"width:11px;height:11px;flex-shrink:0;\"></i><span>Assigned by <strong>" + escapeHtml(v88) + "</strong></span></div>" : "") + "\n                </div>";
    };
    return "\n            <div style=\"padding:1rem;\">\n                <h3 style=\"font-size:0.9rem; color:var(--primary); margin-bottom:1rem; display:flex; align-items:center; gap:0.5rem;\">\n                    <i data-lucide=\"calendar-days\" style=\"width:18px;\"></i> Today's Assignments\n                </h3>\n                " + (v76.length ? v76.map(v89 => v78(v89, false)).join("") : "<p style=\"font-size:0.85rem; color:var(--text-muted); padding:1rem; text-align:center; background:#f8fafc; border-radius:1rem;\">No homework assigned today.</p>") + "\n\n                <div style=\"margin-top:2rem; padding-top:1.5rem; border-top:1px solid #eee;\">\n                    <div style=\"display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;\">\n                        <h3 style=\"font-size:0.9rem; color:var(--text-main); margin:0;\">Past Records</h3>\n                        <input type=\"text\" id=\"history-date-picker\" class=\"form-input nepali-date-picker\" value=\"" + v67 + "\" \n                            style=\"width:auto; padding:0.4rem; font-size:0.8rem;\" onchange=\"window._filterHwHistory(this.value)\" readonly>\n                    </div>\n                    <p style=\"font-size:0.7rem; color:var(--text-muted); margin-bottom:1rem;\">Showing status for: <strong>" + (v67 === v66 ? "Yesterday" : formatDateLabel(v67)) + "</strong></p>\n                    \n                    " + (v77.length ? v77.map(v90 => v78(v90, true)).join("") : "<p style=\"font-size:0.85rem; color:var(--text-muted); text-align:center; padding:1rem;\">No records found for this date.</p>") + "\n                </div>\n            </div>\n        ";
  } catch (v91) {
    return "<p class=\"error\">Failed to load homework records.</p>";
  }
}
window._filterHwHistory = async v92 => {
  const v93 = document.getElementById("child-tab-content");
  const v94 = v93.querySelector(".view-header").outerHTML;
  v93.innerHTML = v94 + "<div class=\"spinner-wrap\"><div class=\"spinner\"></div></div>";
  const v95 = await renderHomework(v92);
  v93.innerHTML = v94 + v95;
  lucide.createIcons();
};
async function renderMarks(v96 = null) {
  if (!currentParent.can_view_marks) {
    return "\n            <div style=\"padding:3rem 2rem; text-align:center;\">\n                <div style=\"width:56px; height:56px; background:#fff7ed; border:1px solid #fed7aa; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 1.25rem;\">\n                    <i data-lucide=\"lock\" style=\"width:24px; height:24px; color:#c2410c;\"></i>\n                </div>\n                <h3 style=\"font-weight:800; color:#4338ca; margin:0 0 0.5rem 0;\">Exam Marks Locked</h3>\n                <p style=\"font-size:0.8rem; color:var(--text-muted); max-width:280px; margin:0 auto; line-height:1.4;\">\n                    Your child's assessment marks have not been released yet or access is restricted for this account.\n                </p>\n            </div>\n        ";
  }
  const {
    data: v97
  } = await v1.from("marks").select("*").eq("student_id", selectedChild.id);
  const {
    data: v98
  } = await v1.from("student_practical_marks").select("*").eq("student_id", selectedChild.id);
  if ((!v97 || !v97.length) && (!v98 || !v98.length)) {
    return "<p style=\"padding:2rem; text-align:center;\">Marks not released.</p>";
  }
  const v99 = new Set();
  v97?.forEach(v105 => v99.add(v105.term));
  v98?.forEach(v106 => {
    let v107 = v106.term_id;
    if (v107 === "First Term") {
      v107 = "First Mid Term";
    } else if (v107 === "Second Term") {
      v107 = "Second Mid Term";
    } else if (v107 === "Third Term" || v107 === "Final Term") {
      v107 = "Third Mid Term";
    }
    v99.add(v107);
  });
  const v100 = [...v99].sort();
  const v101 = v96 || v100[0];
  let v102 = (v97 || []).filter(v108 => v108.term === v101);
  const gpaPush = v102.find(v => v.subject && v.subject.startsWith('FINAL_GPA_'));
  v102 = v102.filter(v => !(v.subject && v.subject.startsWith('FINAL_GPA_')));
  if (window.sortSubjectsByStandardOrder) {
      v102 = window.sortSubjectsByStandardOrder(v102);
  }
  let v103 = v101;
  if (v101 === "First Mid Term") {
    v103 = "First Term";
  } else if (v101 === "Second Mid Term") {
    v103 = "Second Term";
  } else if (v101 === "Third Mid Term") {
    v103 = "Third Term";
  }
  const v104 = (v98 || []).filter(v109 => v109.term_id === v103 || v109.term_id === v101);
    function getFallbackSubjectConfig(subjectName, cls) {
        const sub = (subjectName || "").toLowerCase().trim();
        const clsLower = (cls || "").toLowerCase();
        
        const isNurseryUKG = clsLower.includes("nursery") || clsLower.includes("lkg") || clsLower.includes("ukg") || clsLower.includes("pg");
        const isClass1to3 = clsLower.includes("grade 1") || clsLower.includes("grade 2") || clsLower.includes("grade 3") || clsLower.includes("class 1") || clsLower.includes("class 2") || clsLower.includes("class 3");
        const isClass4to8 = clsLower.includes("grade 4") || clsLower.includes("grade 5") || clsLower.includes("grade 6") || clsLower.includes("grade 7") || clsLower.includes("grade 8") || clsLower.includes("class 4") || clsLower.includes("class 5") || clsLower.includes("class 6") || clsLower.includes("class 7") || clsLower.includes("class 8");
        const isClass1to8 = isClass1to3 || isClass4to8;

        let thFull = 75, prFull = 25, credit = 4;

        if (isNurseryUKG) {
            thFull = 100; prFull = 0; 
            if (sub.includes("oral") || sub.includes("rhyme") || sub.includes("draw") || sub.includes("hygiene") || sub === "dra") {
                thFull = 50; prFull = 0; credit = 2;
            }
        } else if (isClass1to3) {
            thFull = 100; prFull = 0; 
            if (sub.includes("local") || sub === "lc" || sub === "loc") {
                thFull = 50; prFull = 0; credit = 3;
            } else if (sub.includes("computer") || sub === "com" || sub.includes("gk") || sub.includes("g.k") || sub.includes("general knowledge") || sub.includes("moral") || sub === "mor") {
                thFull = 50; prFull = 0; credit = 2;
            } else if (sub.includes("oral") || sub.includes("draw") || sub.includes("rhyme") || sub.includes("hygiene") || sub === "dra") {
                thFull = 50; prFull = 0; credit = 2;
            }
        } else {
            if (isClass4to8 && (sub.includes("computer") || sub === "com" || sub.includes("gk") || sub.includes("g.k") || sub.includes("general knowledge") || sub.includes("moral") || sub === "mor")) {
                thFull = 50; prFull = 0; credit = 2;
            } else if (sub.includes("oral") || sub.includes("moral") || sub.includes("gk") || sub.includes("g.k") || sub.includes("general knowledge") || sub.includes("drawing") || sub.includes("rhyme") || sub.includes("hygiene") || sub === "mor" || sub === "dra") {
                thFull = 50; prFull = 0; credit = 2;
            } else if (sub === "math" || sub === "mathematics" || sub === "mat" || sub.includes("o.math") || sub.includes("opt. math") || sub.includes("optional math") || sub.includes("opt math") || sub.includes("account")) {
                thFull = 100; prFull = 0; credit = 4;
            } else if (sub.includes("grammar")) {
                thFull = 50; prFull = 50; credit = 2;
            } else if (sub.includes("health") || sub.includes("physical") || sub.includes("creative") || sub.includes("hpe") || sub === "hea") {
                thFull = 75; prFull = 25; credit = 3;
            } else {
                thFull = 75; prFull = 25; credit = 4;
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

  let totalWeightedGpa = 0;
  let totalCreditHours = 0;
  let subjectCount = 0;
  let ngCount = 0;
  
  let rowsHtml = v102.map(v111 => {
    const v112 = v111.term && (
      v111.term.toLowerCase().includes("mid")
    );
    let v113 = parseFloat(v111.value) || 0;
    let v114 = 0;
    let v115 = false;
    
    const s = v111.subject.toLowerCase().trim();
    const subjectObj = window.subjectsDb?.find(sub => (window.normalizeSubjectName ? window.normalizeSubjectName(sub.name) : sub.name).toLowerCase().trim() === s) || { name: v111.subject };

    if (!v112) {
      const v122 = window.normalizeSubjectName(v111.subject).toLowerCase();
      const v123 = v104.find(v124 => {
        const v125 = window.subjectsDb?.find(v127 => v127.id === v124.subject_id)?.name || v124.subject_id;
        const v126 = window.normalizeSubjectName(v125).toLowerCase();
        return v126 === v122;
      });
      if (v123) {
        v114 = parseFloat(v123.total_practical_score) || 0;
        v115 = true;
      }
    }
    
    const fm = v112 ? getMidTermSubjectFullMarks(subjectObj, selectedChild.class) : getSubjectFullMarks(subjectObj, selectedChild.class);
    const thFull = fm.thFull;
    const prFull = fm.prFull;
    
    let thCh = getSubjectTheoryCredit(subjectObj, selectedChild.class);
    let prCh = getSubjectPracticalCredit(subjectObj, selectedChild.class);
    if (v112 && prFull === 0) {
        thCh = thCh + prCh;
        prCh = 0;
    }

    const thPercentage = thFull > 0 ? (v113 / thFull) * 100 : 0;
    const prPercentage = prFull > 0 ? (v114 / prFull) * 100 : 0;
    
    let thPass = thFull > 0 ? thPercentage >= 35 : true;
    let prPass = prFull > 0 ? prPercentage >= 35 : true;
    
    let thGradeData = getGradeFromPercentage(thPercentage);
    let prGradeData = getGradeFromPercentage(prPercentage);
    
    if(!thPass) { thGradeData = { grade: 'NG', point: 0.0 }; }
    if(!prPass) { prGradeData = { grade: 'NG', point: 0.0 }; }
    if(!thPass || !prPass) { ngCount++; }
    
    if(thFull > 0) { totalWeightedGpa += (thGradeData.point * thCh); totalCreditHours += thCh; }
    if(prFull > 0) { totalWeightedGpa += (prGradeData.point * prCh); totalCreditHours += prCh; }

    subjectCount++;

    const v116 = v113 + v114;
    const v117 = thFull + prFull;
    const totalPercentage = v117 > 0 ? (v116 / v117) * 100 : 0;
    const v119 = (!thPass || !prPass) ? "NG" : (totalPercentage >= 90 ? "A+" : totalPercentage >= 80 ? "A" : totalPercentage >= 70 ? "B+" : totalPercentage >= 60 ? "B" : totalPercentage >= 50 ? "C+" : totalPercentage >= 40 ? "C" : totalPercentage >= 35 ? "D" : "NG");
    const v120 = totalPercentage >= 80 ? "#10b981" : totalPercentage >= 60 ? "#2563eb" : totalPercentage >= 40 ? "#d97706" : "#dc2626";

    let v121 = "<div style=\"font-weight:700; color:var(--text-main);\">" + v116 + "/" + v117 + "</div>";
    if (v115) {
      v121 = "\n                            <div style=\"font-weight:700; color:var(--text-main);\">" + v116 + "/" + v117 + "</div>\n                            <div style=\"font-size:0.65rem; color:var(--text-muted); margin-top:0.2rem;\">TH: " + v113 + " | PR: " + v114 + "</div>\n                        ";
    }
    return "\n                        <div style=\"padding:1rem; border-top:1px solid #f1f5f9; display:flex; align-items:center;\">\n                            <span style=\"flex:2; font-weight:600;\">" + escapeHtml(v111.subject) + "</span>\n                            <div style=\"flex:1; text-align:center;\">" + v121 + "</div>\n                            <span style=\"flex:1; text-align:right; font-weight:800; color:" + v120 + ";\">" + v119 + "</span>\n                        </div>\n                    ";
  }).join("");

  let finalGpaDisplay = "";
  const isNG = ngCount > 3;
  if (gpaPush !== undefined) {
      let finalGpaStr = gpaPush.subject.replace('FINAL_GPA_', '');
      let finalGpa = (parseInt(finalGpaStr) / 100).toFixed(2);
      if (parseInt(finalGpaStr) === 0 && isNG) finalGpa = 'NG';
      finalGpaDisplay = `
          <div style="padding:1rem; border-top:2px solid #e2e8f0; display:flex; align-items:center; background:#f8fafc;">
              <span style="flex:2; font-weight:800; color:var(--primary);">TOTAL GPA</span>
              <div style="flex:1; text-align:center;"></div>
              <span style="flex:1; text-align:right; font-weight:900; font-size:1.1rem; color:var(--text-main);">${finalGpa}</span>
          </div>
      `;
  }

  return "\n        <div style=\"padding:1rem;\">\n            <select class=\"form-input\" onchange=\"window.switchMarksTerm(this.value)\">\n                " + v100.map(v110 => "<option " + (v110 === v101 ? "selected" : "") + ">" + v110 + "</option>").join("") + "\n            </select>\n            \n            <div style=\"margin-top:1.5rem; font-weight:800; color:var(--primary); font-size:0.8rem; text-transform:uppercase; margin-bottom:0.5rem; display:flex; align-items:center; gap:0.4rem;\">\n                <i data-lucide=\"book-open\" style=\"width:16px; height:16px;\"></i> Academic Performance\n            </div>\n            <div class=\"card\" style=\"padding:0; overflow:hidden;\">\n                <div style=\"background:#f8fafc; padding:0.75rem 1rem; display:flex; font-size:0.7rem; font-weight:800; color:var(--text-muted);\">\n                    <span style=\"flex:2;\">SUBJECT</span>\n                    <span style=\"flex:1; text-align:center;\">SCORE</span>\n                    <span style=\"flex:1; text-align:right;\">GRADE</span>\n                </div>\n                " + rowsHtml + finalGpaDisplay + "\n            </div>\n        </div>\n    ";
}
window.switchMarksTerm = async function (v128) {
  const v129 = document.getElementById("child-tab-content");
  const v130 = v129.querySelector(".view-header")?.outerHTML || "";
  v129.innerHTML = v130 + "<div class=\"spinner-wrap\"><div class=\"spinner\"></div></div>";
  const v131 = await renderMarks(v128);
  v129.innerHTML = v130 + v131;
  if (window.lucide) {
    lucide.createIcons();
  }
};
async function renderMessages() {
  const {
    data: v132,
    error: v133
  } = await v1.from("messages").select("*").or("target_type.eq.school,and(target_type.eq.class,target_value.eq.\"" + selectedChild.class + "\"),and(target_type.eq.individual,target_value.eq.\"" + selectedChild.id + "\")").order("created_at", {
    ascending: false
  }).limit(30);
  if (v133) {
    console.error("Load messages error:", v133);
    return "<p style=\"padding:2rem; text-align:center; color:var(--text-muted);\">Error loading messages.</p>";
  }
  if (!v132 || !v132.length) {
    return "<p style=\"padding:2rem; text-align:center; color:var(--text-muted);\">No notices found.</p>";
  }
  window.parentMessages = v132;
  const v134 = [...new Set(v132.map(v136 => v136.sender_id).filter(Boolean))];
  const v135 = v134.length > 0 ? await fetchProfileMap(v134) : {};
  return "<div style=\"padding:1rem; display:flex; flex-direction:column; gap:1rem;\">\n        " + v132.map(v137 => {
    const v138 = v135[v137.sender_id] || "School Office";
    const v139 = window.formatDateLabel(v137.created_at.split("T")[0]) + " " + new Date(v137.created_at).toLocaleTimeString("en-NP", {
      hour: "2-digit",
      minute: "2-digit"
    });
    return "\n                <div class=\"card\" onclick=\"window.viewParentMessageDetail('" + v137.id + "')\" style=\"padding:1.25rem; border-left:4px solid var(--primary); cursor:pointer; position:relative; transition:all 0.15s ease;\" onmouseover=\"this.style.transform='translateY(-2px)'; this.style.boxShadow='var(--shadow-md)';\" onmouseout=\"this.style.transform='none'; this.style.boxShadow='var(--shadow-sm)';\">\n                    <div style=\"display:flex; justify-content:space-between; margin-bottom:0.5rem; flex-wrap:wrap; gap:0.25rem;\">\n                        <span style=\"font-size:0.65rem; font-weight:800; color:var(--text-muted); text-transform:uppercase;\">From: " + escapeHtml(v138) + "</span>\n                        <span style=\"font-size:0.65rem; color:var(--text-muted);\">" + v139 + "</span>\n                    </div>\n                    <h4 style=\"margin:0.25rem 0; font-weight:800; color:var(--text-main);\">" + escapeHtml(v137.subject) + "</h4>\n                    <p style=\"font-size:0.85rem; color:var(--text-main); margin-top:0.5rem; white-space:pre-wrap; word-break:break-word; line-height:1.5; max-height:4.5em; display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical; overflow:hidden; text-overflow:ellipsis;\">" + escapeHtml(v137.body) + "</p>\n                    <div style=\"text-align:right; margin-top:0.65rem; font-size:0.72rem; color:var(--primary); font-weight:700; display:flex; align-items:center; justify-content:flex-end; gap:0.25rem;\">\n                        <span>Read Full Message</span>\n                        <i data-lucide=\"arrow-right\" style=\"width:12px; height:12px;\"></i>\n                    </div>\n                </div>\n            ";
  }).join("") + "\n    </div>";
}
window.viewParentMessageDetail = function (v140) {
  if (!window.parentMessages) {
    return;
  }
  const v141 = window.parentMessages.find(v146 => String(v146.id) === String(v140));
  if (!v141) {
    return;
  }
  const v142 = new Date(v141.created_at);
  const v143 = v142.toLocaleTimeString("en-NP", {
    hour: "2-digit",
    minute: "2-digit"
  });
  const v144 = formatDateLabel(v141.created_at ? v141.created_at.split("T")[0] : "") + " " + v143;
  let v145 = "School Office";
  try {
    const v147 = document.querySelector("[onclick=\"window.viewParentMessageDetail('" + v140 + "')\"]");
    if (v147) {
      const v148 = v147.querySelector("span");
      if (v148) {
        v145 = v148.innerText.replace(/^From:\s*/i, "").trim();
      }
    }
  } catch (v149) {}
  openModal("\n        <div class=\"message-detail-modal\" style=\"padding: 0.25rem;\">\n            <div style=\"display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #e2e8f0; padding-bottom:0.75rem; margin-bottom:1rem; flex-wrap:wrap; gap:0.5rem;\">\n                <h2 style=\"font-size:1.15rem; font-weight:800; margin:0; color:var(--text-main);\">Notice Details</h2>\n                \n                <!-- Dynamic Font Zoom Controls -->\n                <div class=\"zoom-controls\" style=\"display:flex; gap:0.35rem; align-items:center; background:#f1f5f9; padding:0.25rem 0.5rem; border-radius:20px; box-shadow:inset 0 1px 2px rgba(0,0,0,0.05);\">\n                    <span style=\"font-size:0.7rem; font-weight:700; color:var(--text-muted); margin-right:4px;\">Zoom:</span>\n                    <button class=\"btn btn-ghost\" onclick=\"window.zoomParentMessageBody(-15)\" style=\"width:26px; height:26px; padding:0; border-radius:50%; background:white; font-weight:800; font-size:0.85rem; min-height:0; display:flex; align-items:center; justify-content:center; border:1px solid #e2e8f0; color:var(--text-main);\" title=\"Zoom Out\">-</button>\n                    <span id=\"parent-zoom-level-text\" style=\"font-size:0.75rem; font-weight:700; color:var(--primary); min-width:36px; text-align:center;\">100%</span>\n                    <button class=\"btn btn-ghost\" onclick=\"window.zoomParentMessageBody(15)\" style=\"width:26px; height:26px; padding:0; border-radius:50%; background:white; font-weight:800; font-size:0.85rem; min-height:0; display:flex; align-items:center; justify-content:center; border:1px solid #e2e8f0; color:var(--text-main);\" title=\"Zoom In\">+</button>\n                    <button class=\"btn btn-ghost\" onclick=\"window.resetParentMessageZoom()\" style=\"font-size:0.65rem; font-weight:700; padding:0 0.5rem; height:26px; border-radius:13px; background:white; border:1px solid #e2e8f0; color:var(--text-muted); min-height:0; display:flex; align-items:center; justify-content:center; margin-left:4px;\" title=\"Reset font size\">Reset</button>\n                </div>\n            </div>\n            \n            <div style=\"background:#f8fafc; padding:0.75rem; border-radius:12px; margin-bottom:1rem; border:1px solid #e2e8f0;\">\n                <div style=\"display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;\">\n                    <div>\n                        <div style=\"font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;\">From: " + escapeHtml(v145) + "</div>\n                    </div>\n                    <div style=\"font-size:0.7rem; color:var(--text-muted); font-weight:500;\">" + v144 + "</div>\n                </div>\n            </div>\n            \n            <h3 style=\"font-size:1.1rem; font-weight:800; margin-bottom:0.75rem; color:var(--text-main); line-height:1.4;\">" + escapeHtml(v141.subject) + "</h3>\n            \n            <div id=\"parent-msg-detail-body\" style=\"font-size:0.95rem; color:var(--text-main); white-space:pre-wrap; word-break:break-word; line-height:1.6; padding:0.75rem; border:1px solid #e2e8f0; border-radius:8px; background:white; transition: font-size 0.1s ease-out; box-shadow:inset 0 1px 2px rgba(0,0,0,0.02);\">" + escapeHtml(v141.body) + "</div>\n        </div>\n    ");
  window.currentParentMsgZoom = 100;
  window.zoomParentMessageBody = function (v150) {
    const v151 = document.getElementById("parent-msg-detail-body");
    const v152 = document.getElementById("parent-zoom-level-text");
    if (!v151) {
      return;
    }
    window.currentParentMsgZoom = Math.min(220, Math.max(70, window.currentParentMsgZoom + v150));
    v151.style.fontSize = window.currentParentMsgZoom / 100 * 0.95 + "rem";
    if (v152) {
      v152.innerText = window.currentParentMsgZoom + "%";
    }
  };
  window.resetParentMessageZoom = function () {
    const v153 = document.getElementById("parent-msg-detail-body");
    const v154 = document.getElementById("parent-zoom-level-text");
    if (!v153) {
      return;
    }
    window.currentParentMsgZoom = 100;
    v153.style.fontSize = "0.95rem";
    if (v154) {
      v154.innerText = "100%";
    }
  };
};
async function renderRoutine() {
  const v155 = "\n        <div style=\"padding: 1rem; background: #f1f5f9; margin-bottom: 1rem; border-radius: 0.75rem;\">\n            <label class=\"form-label\" style=\"font-size: 0.7rem;\">Routine Type</label>\n            <select id=\"parent-routine-type\" class=\"form-input\" onchange=\"window._changeParentRoutine(this.value)\">\n                <option value=\"Class\" " + (selectedRoutineType === "Class" ? "selected" : "") + ">Standard Class Routine</option>\n                <option value=\"Exam\" " + (selectedRoutineType === "Exam" ? "selected" : "") + ">Exam Schedule</option>\n            </select>\n        </div>\n    ";
  try {
    let v156 = v1.from("routines").select("*").eq("class", selectedChild.class).eq("routine_type", selectedRoutineType);
    const {
      data: v157,
      error: v158
    } = await v156.order("created_at", {
      ascending: false
    });
    if (v158) {
      throw v158;
    }
    let v159 = "";
    if (!v157 || v157.length === 0) {
      v159 = "<p style=\"text-align:center; padding:2rem; color:var(--text-muted);\">No " + selectedRoutineType + " routine uploaded for Class " + selectedChild.class + ".</p>";
    } else {
      v159 = v157.map(v160 => {
        const v161 = v160.routine_data || {};
        let v162;
        if (v160.routine_type === "Exam") {
          const v163 = Object.keys(v161).filter(v164 => v161[v164] && v161[v164].length > 0);
          if (v163.length > 0) {
            const v165 = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
            v162 = v163.sort((v166, v167) => {
              const v168 = parseInt(v166.replace("Day ", ""));
              const v169 = parseInt(v167.replace("Day ", ""));
              if (!isNaN(v168) && !isNaN(v169)) {
                return v168 - v169;
              }
              const v170 = v165.indexOf(v166);
              const v171 = v165.indexOf(v167);
              if (v170 !== -1 && v171 !== -1) {
                return v170 - v171;
              }
              return v166.localeCompare(v167);
            });
          } else {
            v162 = Array.from({
              length: 15
            }, (v172, v173) => "Day " + (v173 + 1));
          }
        } else {
          v162 = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
        }
        return "\n                    <div class=\"card\" style=\"margin-bottom: 1.5rem; padding: 1.25rem;\">\n                        <h3 style=\"color:var(--primary); margin:0;\">" + escapeHtml(v160.title) + "</h3>\n                        <p style=\"font-size: 0.75rem; color: var(--text-muted); margin-bottom: 1rem;\">" + v160.term + "</p>\n                        \n                        " + v162.map(v174 => {
          const v175 = v161[v174] || [];
          if (v175.length === 0) {
            return "";
          }
          return "\n                                <div style=\"margin-bottom: 0.75rem;\">\n                                    <strong style=\"font-size: 0.8rem; text-transform: uppercase;\">" + v174 + "</strong>\n                                    <div style=\"display:flex; flex-wrap:wrap; gap:0.4rem; margin-top:0.25rem;\">\n                                        " + v175.map(v176 => {
            let v177 = v176;
            if (v176.includes(" | ")) {
              const v178 = v176.split(" | ");
              const v179 = v178[0];
              const v180 = v178[1] || "";
              const v181 = v178[2] || "";
              let v182 = "";
              if (v180 && window.NepaliFunctions) {
                try {
                  v182 = window.NepaliFunctions.BS.GetFullDay(v180) || "";
                } catch (v183) {
                  console.error(v183);
                }
              }
              v177 = v179;
              if (v180) {
                v177 += " | " + v180;
                if (v182) {
                  v177 += " (" + v182 + ")";
                }
              }
              if (v181) {
                v177 += " | " + v181;
              }
            }
            return "<span style=\"background:#eef2ff; padding:4px 8px; border-radius:6px; font-size:0.8rem; border:1px solid #e0e7ff;\">" + escapeHtml(v177) + "</span>";
          }).join("") + "\n                                    </div>\n                                </div>";
        }).join("") + "\n                    </div>";
      }).join("");
    }
    return v155 + v159;
  } catch (v184) {
    return "<p class=\"error\">Failed to load routine.</p>";
  }
}
window._changeParentRoutine = async v185 => {
  selectedRoutineType = v185;
  const v186 = document.getElementById("child-tab-content");
  const v187 = v186.querySelector(".view-header").outerHTML;
  v186.innerHTML = v187 + (await renderRoutine());
  lucide.createIcons();
};
async function renderLeave() {
  const {
    data: v188
  } = await v1.from("leave_applications").select("*").eq("student_id", selectedChild.id).order("created_at", {
    ascending: false
  }).limit(5);
  const v189 = "\n        <div style=\"margin-top:2rem;\">\n            <h3 style=\"margin-bottom:1rem; font-size:1.1rem; font-weight:700;\">Application History</h3>\n            " + ((v188 || []).map(v191 => {
    const v192 = {
      Pending: "#f59e0b",
      Approved: "#10b981",
      Rejected: "#ef4444"
    };
    const v193 = v192[v191.status] || "#94a3b8";
    return "\n                    <div class=\"card\" style=\"margin-bottom:0.75rem; border-left:4px solid " + v193 + "; padding: 1rem;\">\n                        <div style=\"display:flex; justify-content:space-between; align-items:flex-start;\">\n                            <div style=\"flex:1; margin-right: 1rem;\">\n                                <div style=\"font-weight:700; font-size:0.9rem;\">" + formatDateLabel(v191.start_date) + " to " + formatDateLabel(v191.end_date) + "</div>\n                                <div style=\"font-size:0.8rem; color:var(--text-muted); margin-top:0.4rem; line-height:1.4;\">" + escapeHtml(v191.reason) + "</div>\n                            </div>\n                            <span style=\"font-size:0.65rem; font-weight:800; color:" + v193 + "; background:" + v193 + "11; padding:4px 8px; border-radius:6px; border:1px solid " + v193 + "33;\">" + v191.status.toUpperCase() + "</span>\n                        </div>\n                    </div>\n                ";
  }).join("") || "<p style=\"text-align:center; color:var(--text-muted); font-size:0.85rem; padding:2rem; background:#f8fafc; border-radius:1rem;\">No previous applications.</p>") + "\n        </div>\n    ";
  const v190 = "\n        <div style=\"padding:1rem;\">\n            <h3 style=\"font-size:1.1rem; font-weight:700;\">Request Leave</h3>\n            <form id=\"leave-form\" class=\"card\" style=\"padding:1.5rem; margin-top:1rem;\">\n                <div class=\"form-group\">\n                    <label class=\"form-label\">Start Date</label>\n                    <input type=\"text\" id=\"l-start\" class=\"form-input nepali-date-picker\" required readonly>\n                </div>\n                <div class=\"form-group\">\n                    <label class=\"form-label\">End Date</label>\n                    <input type=\"text\" id=\"l-end\" class=\"form-input nepali-date-picker\" required readonly>\n                </div>\n                <div class=\"form-group\">\n                    <label class=\"form-label\">Reason</label>\n                    <textarea id=\"l-reason\" class=\"form-input\" placeholder=\"Why is this leave required?\" required style=\"min-height:100px;\"></textarea>\n                </div>\n                <button type=\"submit\" class=\"btn btn-primary btn-block\">Submit Application</button>\n            </form>\n            " + v189 + "\n        </div>\n    ";
  return v190;
}
async function handleLeaveSubmit(v194) {
  v194.preventDefault();
  const v195 = document.getElementById("l-start").value;
  const v196 = document.getElementById("l-end").value;
  const v197 = document.getElementById("l-reason").value;
  try {
    toast("Finding Homeroom Teacher...", 3000);
    const v198 = await fetchHomeroomTeacher(selectedChild.class);
    if (!v198) {
      toast("No Homeroom Teacher assigned to this class yet.");
      return;
    }
    const v199 = window.NepaliFunctions ? window.NepaliFunctions.BS2AD(v195) : v195;
    const v200 = window.NepaliFunctions ? window.NepaliFunctions.BS2AD(v196) : v196;
    const {
      error: v201
    } = await v1.from("leave_applications").insert({
      student_id: selectedChild.id,
      parent_id: currentParent.id,
      target_teacher_id: v198.id,
      start_date: v199,
      end_date: v200,
      reason: v197,
      status: "Pending"
    });
    if (v201) {
      throw v201;
    }
    toast("✅ Application sent!");
    loadTabContent();
  } catch (v202) {
    console.error("Leave Request Error:", v202);
    toast("Failed: " + (v202.message || "Submission error"));
  }
}
async function renderAccount() {
  const {
    data: v203
  } = await v1.from("fees").select("*").eq("student_id", selectedChild.id).order("created_at", {
    ascending: false
  }).limit(30);
  let v204 = 0;
  v203?.forEach(v205 => {
    v204 += (v205.total_fee || 0) - (v205.paid_amount || 0);
  });
  return "\n        <div style=\"padding:1rem;\">\n            <div class=\"card\" style=\"background:var(--primary-light); text-align:center; padding:2rem; border-radius:1.5rem;\">\n                <div style=\"font-weight:800; font-size:0.75rem; color:var(--primary); text-transform:uppercase;\">TOTAL OUTSTANDING</div>\n                <h1 style=\"font-size:2.5rem; margin:0.5rem 0; color:#dc2626;\">Rs. " + v204 + "</h1>\n            </div>\n            \n            <h4 style=\"margin:1.5rem 0 0.75rem 0;\">Fee History</h4>\n            " + (v203 || []).map(v206 => "\n                <div class=\"card\" style=\"margin-bottom:0.75rem; padding:1rem; border-left:4px solid " + (v206.total_fee - v206.paid_amount > 0 ? "#ef4444" : "#10b981") + ";\">\n                    <div style=\"display:flex; justify-content:space-between; align-items:center;\">\n                        <div>\n                            <div style=\"font-weight:700;\">" + escapeHtml(v206.term_or_month) + "</div>\n                            <small style=\"color:var(--text-muted);\">Due: " + (v206.due_date ? formatDateLabel(v206.due_date) : "N/A") + "</small>\n                        </div>\n                        <div style=\"text-align:right;\">\n                            <div style=\"font-weight:800;\">Rs. " + (v206.total_fee - v206.paid_amount) + "</div>\n                            <small style=\"color:var(--text-muted);\">Total: " + v206.total_fee + "</small>\n                        </div>\n                    </div>\n                </div>\n            ").join("") + "\n\n\n            " + (v204 > 0 ? "\n                <div style=\"margin-top:1.5rem; background:#fef3c7; border:1px solid #fcd34d; border-radius:1rem; padding:1.5rem; text-align:center;\">\n                    <div style=\"font-weight:800; color:#92400e; font-size:1rem; margin-bottom:1rem;\">Pay Online via QR</div>\n                    <img src=\"./fonepay_qr.jpg\" style=\"width:200px; max-width:100%; height:auto; border-radius:12px; box-shadow:0 4px 6px -1px rgba(0,0,0,0.1); border:4px solid white; margin:0 auto;\" alt=\"Fonepay QR\">\n                    <div style=\"font-size:0.8rem; color:#78350f; margin-top:1rem; line-height:1.4;\">\n                        Please scan the QR code to clear your outstanding due of <strong>Rs. " + v204 + "</strong>.\n                        <br><br>\n                        <em>Note: Please save the payment screenshot and send it to the school office for immediate bill clearance.</em>\n                    </div>\n                </div>\n            " : "<div class=\"badge-success\" style=\"text-align:center; padding:1rem; border-radius:1rem; margin-top:1rem;\">All dues are clear!</div>") + "\n        </div>\n    ";
}
window._payWithEsewa = function (v207) {
  toast("Online payment is not available yet. Please pay at the school office.");
};
function verifyEsewaPayment() {}
async function renderReceipts() {
  const {
    data: v208
  } = await v1.from("fees").select("*").eq("student_id", selectedChild.id).order("created_at", {
    ascending: false
  });
  const v209 = (v208 || []).filter(v210 => v210.paid_amount > 0);
  return "\n        <div style=\"padding:1rem;\">\n            <h3 style=\"margin-top:0;\">Payment Receipts</h3>\n            " + (v209.length ? v209.map(v211 => "\n                <div class=\"card\" style=\"margin-bottom:1rem; padding:1.25rem; border:2px dashed #cbd5e1; background:#fdfdfd;\">\n                    <div style=\"display:flex; justify-content:space-between; align-items:center;\">\n                        <div>\n                            <div style=\"font-weight:800; color:var(--primary);\">" + v211.term_or_month + "</div>\n                            <small style=\"color:var(--text-muted);\">" + formatDateLabel(v211.created_at.split("T")[0]) + "</small>\n                        </div>\n                        <div style=\"text-align:right;\">\n                            <div style=\"font-size:1.2rem; font-weight:900; color:#16a34a;\">Rs. " + v211.paid_amount + "</div>\n                            <div style=\"font-size:0.6rem; font-weight:800; color:#10b981; background:#dcfce7; padding:2px 6px; border-radius:4px; display:inline-block;\">PAID</div>\n                        </div>\n                    </div>\n                </div>\n            ").join("") : "<p style=\"text-align:center; color:var(--text-muted); padding:2rem;\">No paid receipts found.</p>") + "\n        </div>\n    ";
}
let notifChannel = null;
async function updateBadges() {
  if (!currentParent) {
    return;
  }
  try {
    const v212 = myChildren.map(v227 => v227.id);
    const v213 = [...new Set(myChildren.map(v228 => v228.class))];
    if (v212.length === 0) {
      return;
    }
    const v214 = localStorage.getItem("msg_last_read_" + currentParent.id) || "1970-01-01";
    let v215 = "target_type.eq.school";
    if (v213.length > 0) {
      v215 += ",and(target_type.eq.class,target_value.in.(" + v213.map(v229 => "\"" + v229 + "\"").join(",") + "))";
    }
    if (v212.length > 0) {
      v215 += ",and(target_type.eq.individual,target_value.in.(" + v212.map(v230 => "\"" + v230 + "\"").join(",") + "))";
    }
    const {
      data: v216
    } = await v1.from("messages").select("id, target_type, target_value, created_at").or(v215);
    const v217 = (v216 || []).filter(v231 => v231.created_at > v214);
    const v218 = document.getElementById("msg-badge");
    if (v218) {
      v218.style.display = v217.length > 0 ? "block" : "none";
    }
    myChildren.forEach(v232 => {
      const v233 = document.getElementById("dot-" + v232.id);
      if (v233) {
        const v234 = v217.some(v235 => v235.target_type === "school" || v235.target_type === "class" && v235.target_value === v232.class || v235.target_type === "individual" && v235.target_value === v232.id);
        v233.style.display = v234 ? "block" : "none";
      }
    });
    const v219 = localStorage.getItem("leave_last_read_" + currentParent.id) || "1970-01-01";
    const {
      data: v220
    } = await v1.from("leave_applications").select("id, student_id, created_at").in("student_id", v212);
    const v221 = (v220 || []).filter(v236 => v236.created_at > v219);
    const v222 = document.getElementById("leave-badge");
    if (v222) {
      v222.style.display = v221 && v221.length > 0 ? "block" : "none";
    }
    if (selectedChild) {
      const v237 = v217.some(v241 => v241.target_type === "school" || v241.target_type === "class" && v241.target_value === selectedChild.class || v241.target_type === "individual" && v241.target_value === selectedChild.id);
      const v238 = document.getElementById("dash-msg-badge-" + selectedChild.id);
      if (v238) {
        v238.style.display = v237 ? "block" : "none";
      }
      const v239 = v221.some(v242 => v242.student_id === selectedChild.id);
      const v240 = document.getElementById("dash-leave-badge-" + selectedChild.id);
      if (v240) {
        v240.style.display = v239 ? "block" : "none";
      }
    }
    const v223 = localStorage.getItem("global_notif_last_read_" + currentParent.id) || "1970-01-01";
    let v224 = "target_type.eq.school";
    const selectedClasses = selectedChild ? [selectedChild.class] : [];
    const selectedIds = selectedChild ? [selectedChild.id] : [];
    if (selectedClasses.length > 0) {
      v224 += ",and(target_type.eq.class,target_value.eq.\"" + selectedChild.class + "\")";
    }
    if (selectedIds.length > 0) {
      v224 += ",and(target_type.eq.individual,target_value.eq.\"" + selectedChild.id + "\")";
    }
    const {
      count: v225
    } = await v1.from("notifications").select("*", {
      count: "exact",
      head: true
    }).or(v224).gt("created_at", v223);
    const v226 = document.getElementById("global-notif-badge");
    if (v226) {
      v226.style.display = v225 > 0 ? "block" : "none";
    }
  } catch (v245) {
    console.warn("updateBadges error", v245);
  }
}
async function markMessagesAsRead() {
  try {
    localStorage.setItem("msg_last_read_" + currentParent.id, new Date().toISOString());
    updateBadges();
  } catch (v246) {
    console.error("Failed to mark messages as read", v246);
  }
}
async function markLeaveAsRead() {
  try {
    localStorage.setItem("leave_last_read_" + currentParent.id, new Date().toISOString());
    updateBadges();
  } catch (v247) {
    console.error("Failed to mark leave as read", v247);
  }
}
function initRealtime() {
  if (notifChannel) {
    v1.removeChannel(notifChannel);
  }
  const v248 = selectedChild ? [selectedChild.id] : [];
  const v249 = selectedChild ? [selectedChild.class] : [];
  notifChannel = v1.channel("parent-notifications").on("postgres_changes", {
    event: "INSERT",
    schema: "public",
    table: "messages"
  }, v252 => {
    const v253 = v252.new;
    const v254 = v253.target_type === "school" || (v253.target_type === "class" && v249.includes(v253.target_value)) || (v253.target_type === "individual" && v248.includes(v253.target_value));
    if (v254) {
      lastFetch.messages = 0;
      toast("🔔 New Notice: " + v253.subject);
      updateBadges();
      if (currentTab === "messages") {
        loadTabContent();
      }
    }
  }).on("postgres_changes", {
    event: "UPDATE",
    schema: "public",
    table: "leave_applications"
  }, v255 => {
    const v256 = v255.new;
    if (v248.includes(v256.student_id)) {
      lastFetch.leave = 0;
      toast("📋 Leave Application Updated: " + v256.status.toUpperCase());
      const v257 = document.getElementById("leave-badge");
      if (v257) {
        v257.style.display = "block";
      }
      if (currentTab === "leave") {
        loadTabContent();
      }
    }
  }).subscribe();
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden" && notifChannel) {
    v1.removeChannel(notifChannel);
    notifChannel = null;
  } else if (document.visibilityState === "visible" && myChildren.length > 0) {
    initRealtime();
    updateBadges();
  }
});
window.openChangePasswordModal = function () {
  openModal("\n        <h2 style=\"margin-bottom: 1.5rem;\">Change Password</h2>\n        <form id=\"change-password-form\">\n            <div class=\"form-group\">\n                <label class=\"form-label\">New Password</label>\n                <input type=\"password\" id=\"new-password\" class=\"form-input\" required minlength=\"6\">\n            </div>\n            <div class=\"form-group\">\n                <label class=\"form-label\">Confirm Password</label>\n                <input type=\"password\" id=\"confirm-password\" class=\"form-input\" required minlength=\"6\">\n            </div>\n            <button type=\"submit\" class=\"btn btn-primary btn-block\">Update Password</button>\n        </form>\n    ");
  document.getElementById("change-password-form").onsubmit = async v258 => {
    v258.preventDefault();
    const v259 = document.getElementById("new-password").value;
    const v260 = document.getElementById("confirm-password").value;
    if (v259 !== v260) {
      toast("Passwords do not match!");
      return;
    }
    try {
      const {
        error: v261
      } = await v1.auth.updateUser({
        password: v259
      });
      if (v261) {
        throw v261;
      }
      toast("✅ Password updated successfully!");
      closeModal();
    } catch (v262) {
      console.error(v262);
      toast("Update failed: " + v262.message);
    }
  };
};
window.logout = async function () {
  try {
    if (notifChannel) {
      v1.removeChannel(notifChannel);
      notifChannel = null;
    }
  } catch (v263) {}
  await logout();
};
window.closeModal = closeModal;
window.viewTeacherProfile = function () {
  const v264 = window.currentHomeroomTeacher;
  if (!v264) {
    toast("Homeroom teacher not assigned yet.");
    return;
  }
  const v265 = safeParseAssignments(v264.assigned_classes);
  const v266 = v265.map(v267 => v267.className).join(", ");
  openModal("\n        <div class=\"modal-handle\"></div>\n        <div style=\"text-align: center; padding: 1rem 0;\">\n            <div style=\"width: 80px; height: 80px; background: #eef2ff; color: #4338ca; border-radius: 50%; margin: 0 auto 1rem; display: flex; align-items: center; justify-content: center; font-size: 2.5rem; font-weight: 800; border: 4px solid white; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);\">\n                " + v264.full_name.charAt(0) + "\n            </div>\n            <h2 style=\"margin: 0; font-size: 1.4rem; color: #1e293b;\">" + escapeHtml(v264.full_name) + "</h2>\n            <p style=\"color: #64748b; font-size: 0.9rem; margin-top: 0.25rem;\">Homeroom Teacher</p>\n        </div>\n\n        " + (v264.description ? "\n        <div class=\"card\" style=\"padding: 1rem; background: #f8fafc; border: 1px solid #e2e8f0; margin-bottom: 1.5rem;\">\n            <p style=\"font-size: 0.7rem; color: #64748b; margin: 0 0 0.5rem 0; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;\">About Teacher</p>\n            <p style=\"font-size: 0.85rem; color: #334155; margin: 0; line-height: 1.5;\">" + escapeHtml(v264.description) + "</p>\n        </div>\n        " : "") + "\n\n        <div style=\"margin-top: 1rem; display: flex; flex-direction: column; gap: 1rem;\">\n            <div class=\"card\" style=\"padding: 1rem; display: flex; align-items: center; gap: 1rem; margin-bottom: 0;\">\n                <div style=\"background: #ecfdf5; color: #10b981; width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center;\">\n                    <i data-lucide=\"book\" style=\"width: 20px; height: 20px;\"></i>\n                </div>\n                <div>\n                    <p style=\"font-size: 0.75rem; color: #64748b; margin: 0; font-weight: 600; text-transform: uppercase;\">Classes</p>\n                    <p style=\"font-size: 0.95rem; color: #1e293b; margin: 0.1rem 0 0 0; font-weight: 700;\">" + escapeHtml(v266 || "Not specified") + "</p>\n                </div>\n            </div>\n\n            <div class=\"card\" style=\"padding: 1rem; display: flex; align-items: center; gap: 1rem; margin-bottom: 0;\">\n                <div style=\"background: #eff6ff; color: #3b82f6; width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center;\">\n                    <i data-lucide=\"mail\" style=\"width: 20px; height: 20px;\"></i>\n                </div>\n                <div>\n                    <p style=\"font-size: 0.75rem; color: #64748b; margin: 0; font-weight: 600; text-transform: uppercase;\">Email</p>\n                    <p style=\"font-size: 0.95rem; color: #1e293b; margin: 0.1rem 0 0 0; font-weight: 700;\">" + escapeHtml(v264.email || "Not available") + "</p>\n                </div>\n            </div>\n\n            " + (v264.mobile ? "\n            <a href=\"tel:" + v264.mobile + "\" class=\"card\" style=\"padding: 1rem; display: flex; align-items: center; gap: 1rem; margin-bottom: 0; text-decoration: none; color: inherit;\">\n                <div style=\"background: #fff7ed; color: #f97316; width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center;\">\n                    <i data-lucide=\"phone\" style=\"width: 20px; height: 20px;\"></i>\n                </div>\n                <div style=\"flex: 1;\">\n                    <p style=\"font-size: 0.75rem; color: #64748b; margin: 0; font-weight: 600; text-transform: uppercase;\">Mobile</p>\n                    <p style=\"font-size: 0.95rem; color: #1e293b; margin: 0.1rem 0 0 0; font-weight: 700;\">" + escapeHtml(v264.mobile) + "</p>\n                </div>\n                <i data-lucide=\"chevron-right\" style=\"color: #94a3b8; width: 16px; height: 16px;\"></i>\n            </a>\n            " : "") + "\n        </div>\n\n        <button class=\"btn btn-primary btn-block\" style=\"margin-top: 2rem;\" onclick=\"closeModal()\">Close</button>\n    ");
  lucide.createIcons();
};
async function renderCAS() {
  if (currentParent.can_view_cas === false) {
    return "\n            <div style=\"padding:3rem 2rem; text-align:center;\">\n                <div style=\"width:56px; height:56px; background:#eff6ff; border:1px solid #bfdbfe; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 1.25rem;\">\n                    <i data-lucide=\"lock\" style=\"width:24px; height:24px; color:var(--primary);\"></i>\n                </div>\n                <h3 style=\"font-weight:800; color:#4338ca; margin:0 0 0.5rem 0;\">CAS Evaluations Locked</h3>\n                <p style=\"font-size:0.8rem; color:var(--text-muted); max-width:280px; margin:0 auto; line-height:1.4;\">\n                    Your child's Continuous Assessment (CAS) evaluations have not been released yet or access is restricted for this account.\n                </p>\n            </div>\n        ";
  }
  const v268 = selectedChild.class;

  // --- Subject name normalization map ---
  // Maps admin-side subject names to CAS config subject keys.
  // Handles abbreviations, English names, and mixed-case variants.
  const isClass13 = !!(v268.match(/grade\s*[1-3]$/i) || v268.match(/^class\s*[1-3]$/i) || ["PG", "Nursery", "LKG", "UKG"].includes(v268));
  const SUBJECT_NAME_MAP = {
    // Mathematics
    "math": "Mathematics",
    "maths": "Mathematics",
    "mathematics": "Mathematics",
    "गणित": "Mathematics",
    // English
    "english": "English",
    "अंग्रेजी": "English",
    "eng": "English",
    // Nepali
    "nepali": "नेपाली",
    "नेपाली": "नेपाली",
    "np": "नेपाली",
    // Social Studies — class 1-3 uses "हाम्रो सेरोफेरो", class 4-5 uses "सामाजिक अध्ययन"
    "social": isClass13 ? "हाम्रो सेरोफेरो" : "सामाजिक अध्ययन",
    "social studies": isClass13 ? "हाम्रो सेरोफेरो" : "सामाजिक अध्ययन",
    "ss": isClass13 ? "हाम्रो सेरोफेरो" : "सामाजिक अध्ययन",
    "soc": isClass13 ? "हाम्रो सेरोफेरो" : "सामाजिक अध्ययन",
    "हाम्रो सेरोफेरो": "हाम्रो सेरोफेरो",
    "सामाजिक अध्ययन": "सामाजिक अध्ययन",
    // Local Curriculum / Local Subject
    "lc": "Local Subject",
    "local": "Local Subject",
    "local subject": "Local Subject",
    "local curriculum": "Local Subject",
    "स्थानीय विषय": "Local Subject",
    // Science
    "science": "Science & Technology",
    "science & technology": "Science & Technology",
    "sci": "Science & Technology",
    "विज्ञान": "Science & Technology",
    // Health, Physical & Creative Arts
    "health": "Health, Physical & Creative Arts",
    "hp": "Health, Physical & Creative Arts",
    "hpca": "Health, Physical & Creative Arts",
    "health, physical & creative arts": "Health, Physical & Creative Arts",
    "health, physical and creative arts": "Health, Physical & Creative Arts",
    "health physical & creative": "Health, Physical & Creative Arts",
    "health physical and creative": "Health, Physical & Creative Arts",
    "health physical & creative arts": "Health, Physical & Creative Arts",
    "health physical and creative arts": "Health, Physical & Creative Arts",
    "health phys": "Health, Physical & Creative Arts",
    "health phys.": "Health, Physical & Creative Arts",
    "health, phys.": "Health, Physical & Creative Arts",
    "health, phys": "Health, Physical & Creative Arts",
    "health & creative": "Health, Physical & Creative Arts",
    "health & creative arts": "Health, Physical & Creative Arts",
    "health and physical": "Health, Physical & Creative Arts",
    "health & physical": "Health, Physical & Creative Arts",
    "creative arts": "Health, Physical & Creative Arts",
    "creative art": "Health, Physical & Creative Arts",
    "स्वास्थ्य": "Health, Physical & Creative Arts",
  };

  // Resolve an admin subject name to its CAS config key
  function resolveAdminSubjectToCAS(adminSub) {
    if (!adminSub) return null;
    const key = adminSub.trim().toLowerCase();
    return SUBJECT_NAME_MAP[key] || null;
  }

  // Fetch all teachers to find the ones assigned to this class and their subjects.
  // IMPORTANT: Students/teachers store class as "Grade N" (from CLASS_OPTIONS),
  // but CAS config uses "Class N". We normalize BOTH sides to "Class N" for comparison.
  let teacherAssignedSubjects = [];
  try {
    const { data: teacherProfiles } = await v1.from("profiles").select("id, full_name, assigned_classes").eq("role", "teacher");
    // Normalize child's class to CAS "Class N" format (Grade 1 → Class 1, Class 1 → Class 1)
    const childClassNormalized = v268.trim().replace(/^grade\s*/i, "Class ").replace(/\s+/g, " ").trim();
    (teacherProfiles || []).forEach(tp => {
      const assignments = safeParseAssignments(tp.assigned_classes);
      assignments.forEach(asgn => {
        if (asgn.className) {
          // Normalize teacher's className the same way (Grade 1 → Class 1, Class 1 → Class 1)
          const teacherClassNormalized = asgn.className.trim().replace(/^grade\s*/i, "Class ").replace(/\s+/g, " ").trim();
          if (teacherClassNormalized.toLowerCase() === childClassNormalized.toLowerCase()) {
            if (Array.isArray(asgn.subjects)) {
              asgn.subjects.forEach(sub => {
                if (sub && !teacherAssignedSubjects.includes(sub)) {
                  teacherAssignedSubjects.push(sub);
                }
              });
            }
          }
        }
      });
    });
  } catch (e) {
    console.warn("Could not fetch teacher subject assignments:", e);
  }


  let v269 = [];
  if (window.CAS_CONFIG && window.CAS_CONFIG.subjects) {
    const normalizedForCAS = v268.trim().replace(/^grade\s*/i, "Class ").replace(/\s+/g, " ").trim();
    const allCASSubjects = Object.keys(window.CAS_CONFIG.subjects).filter(v271 => {
      const v272 = window.CAS_CONFIG.subjects[v271];
      if (v272.classes && v272.classes.length > 0) {
        return v272.classes.includes(normalizedForCAS);
      }
      return true;
    });

    // Resolve teacher-assigned admin subject names → CAS subject keys, preserving order
    const resolvedTeacherSubjects = [];
    teacherAssignedSubjects.forEach(adminSub => {
      // First try direct match (in case admin already stores CAS-exact name)
      if (allCASSubjects.includes(adminSub)) {
        if (!resolvedTeacherSubjects.includes(adminSub)) {
          resolvedTeacherSubjects.push(adminSub);
        }
      } else {
        // Try normalization map
        const casSub = resolveAdminSubjectToCAS(adminSub);
        if (casSub && allCASSubjects.includes(casSub) && !resolvedTeacherSubjects.includes(casSub)) {
          resolvedTeacherSubjects.push(casSub);
        }
      }
    });

    // Sort: teacher-assigned subjects first (resolved), then remaining CAS subjects
    if (resolvedTeacherSubjects.length > 0) {
      const remaining = allCASSubjects.filter(sub => !resolvedTeacherSubjects.includes(sub));
      v269 = [...resolvedTeacherSubjects, ...remaining];
    } else {
      v269 = allCASSubjects;
    }
  }

  if (window.sortSubjectsByStandardOrder) {
      v269 = window.sortSubjectsByStandardOrder(v269);
  }

  const v270 = v269[0] || "";
  setTimeout(() => {
    window.onParentCASSubjectChange();
  }, 100);
  return "\n        <div style=\"padding:1rem;\">\n            <div style=\"display:flex; gap:0.5rem; margin-bottom:1rem; flex-wrap:wrap;\">\n                <div style=\"flex:1; min-width:120px;\">\n                    <label style=\"font-size:0.75rem; font-weight:700; color:var(--text-muted); display:block; margin-bottom:0.25rem;\">Term</label>\n                    <select id=\"parent-cas-term\" class=\"form-input\" onchange=\"window.loadParentCASData()\">\n                        <option value=\"First Term\">First Term</option>\n                        <option value=\"Second Term\">Second Term</option>\n                        <option value=\"Final Term\">Final Term</option>\n                    </select>\n                </div>\n                <div style=\"flex:1; min-width:120px;\">\n                    <label style=\"font-size:0.75rem; font-weight:700; color:var(--text-muted); display:block; margin-bottom:0.25rem;\">Subject</label>\n                    <select id=\"parent-cas-subject\" class=\"form-input\" onchange=\"window.onParentCASSubjectChange()\">\n                        " + v269.map(v274 => "<option value=\"" + escapeHtml(v274) + "\" " + (v274 === v270 ? "selected" : "") + ">" + escapeHtml(v274) + "</option>").join("") + "\n                    </select>\n                </div>\n                <div style=\"flex:1; min-width:120px;\">\n                    <label style=\"font-size:0.75rem; font-weight:700; color:var(--text-muted); display:block; margin-bottom:0.25rem;\">Theme</label>\n                    <select id=\"parent-cas-theme\" class=\"form-input\" onchange=\"window.loadParentCASData()\">\n                        <option value=\"\">-- Theme --</option>\n                    </select>\n                </div>\n            </div>\n            \n            <div id=\"parent-cas-content-wrap\">\n                <div style=\"text-align:center; padding:2rem; color:var(--text-muted); font-size:0.85rem;\">Please select Subject and Theme to load evaluations.</div>\n            </div>\n        </div>\n    ";
}
window.onParentCASSubjectChange = function () {
  const v275 = document.getElementById("parent-cas-subject")?.value;
  const v276 = document.getElementById("parent-cas-theme");
  const v277 = selectedChild?.class;
  if (!v275 || !window.CAS_CONFIG || !window.CAS_CONFIG.subjects[v275]) {
    if (v276) {
      v276.innerHTML = "<option value=\"\">-- Theme --</option>";
    }
    return;
  }
  const v278 = window.getCASSubjectConfig(v275, v277 || "");
  if (v276 && v278 && v278.themes) {
    v276.innerHTML = v278.themes.map(v279 => "<option value=\"" + escapeHtml(v279) + "\">" + escapeHtml(v279) + "</option>").join("");
  }
  window.loadParentCASData();
};
window.loadParentCASData = async function () {
  const v280 = selectedChild?.id;
  const v281 = document.getElementById("parent-cas-subject")?.value;
  const v282 = document.getElementById("parent-cas-theme")?.value;
  const v283 = document.getElementById("parent-cas-content-wrap");
  const v284 = selectedChild?.class;
  if (!v283) {
    return;
  }
  if (!v280 || !v281 || !v282 || !v284) {
    v283.innerHTML = "<div style=\"text-align:center; padding:2rem; color:var(--text-muted); font-size:0.85rem;\">Please select Subject and Theme to load evaluations.</div>";
    return;
  }
  const v285 = v284.match(/grade\s*[1-3]$/i) || v284.match(/^class\s*[1-3]$/i) ? "1-3" : "4-5";
  const v286 = window.getCASSubjectConfig(v281, v284);
  if (!v286) {
    return;
  }
  v283.innerHTML = "<div style=\"text-align:center; padding:2rem;\"><div class=\"spinner\" style=\"margin:0 auto\"></div><p style=\"color:var(--text-muted);margin-top:0.5rem;\">Loading CAS...</p></div>";
  try {
    const v287 = document.getElementById("parent-cas-term")?.value || "First Term";
    const {
      data: v288,
      error: v289
    } = await v1.from("cas_learning_outcomes").select("*").eq("subject", v281).eq("class_level", v285).eq("theme", v282);
    if (v289) {
      throw v289;
    }
    let v290 = v288 || [];
    
    // Grade-based indicator filtering (Class 1, 2, 3, 4, 5 client-side prefix matching)
    const gradeMatch = v284.match(/\d+/);
    const gradeNum = gradeMatch ? gradeMatch[0] : null;
    if (gradeNum) {
      v290 = v290.filter(item => {
        const parts = item.indicator_code.split('-');
        if (parts.length >= 2) {
          return parts[1] === gradeNum;
        }
        return true;
      });
    }

    if (v290.length === 0) {
      v290 = v286.criteria
        .filter(c => !c.skill || c.skill === v282 || c.theme === v282)
        .map((v300, v301) => ({
          id: "fallback-" + v301,
          indicator_code: v300.code || "IND-" + (v301 + 1),
          description: v300.desc || v300
        }));
    }
    const {
      data: v291,
      error: v292
    } = await v1.from("cas_student_portfolio_log").select("*").eq("student_id", v280).eq("term_id", v287);
    if (v292) {
      throw v292;
    }
    const v293 = v291 || [];
    
    // Read Student Portfolio (Karyasanchayika) metadata logs from logs array
    const portfolioMeta = v293.find(log => log.outcome_id === "portfolio-metadata-" + v282) || {};
    const representativeWorks = portfolioMeta.phase1_method || "";
    const parentInformed = portfolioMeta.phase1_rating === 1;
    const parentInformedDate = portfolioMeta.phase2_date ? portfolioMeta.phase2_date.substring(0, 10) : "";

    let v294 = "<div class=\"card\" style=\"padding:1.5rem; overflow-x:auto;\">";
    let v295 = 0;
    let v296 = 0;
    if (v285 === "1-3") {
      v294 += "<h3 style=\"margin-top:0; color:var(--primary); font-size:1rem; font-weight:800;\">Class 1-3 Continuous Monitoring</h3>";
      v294 += "<table style=\"width:100%; border-collapse:collapse; text-align:left; font-size:0.9rem; margin-bottom:1.5rem;\">";
      v294 += "<thead><tr style=\"border-bottom:2px solid var(--border);\"><th style=\"padding:0.75rem 0.5rem;\">Learning Outcome / Indicator</th><th style=\"padding:0.75rem 0.5rem; width:140px; text-align:center;\">Regular Rating</th><th style=\"padding:0.75rem 0.5rem; width:140px; text-align:center;\">Support Rating</th></tr></thead><tbody>";
      v290.forEach(v302 => {
        const v303 = v293.find(v310 => v310.outcome_id === v302.id || v302.id.startsWith && v302.id.startsWith("fallback-") && v310.outcome_id === v302.id);
        const v304 = v303 ? v303.phase1_rating : "";
        const v305 = v303 ? v303.phase2_rating : "";
        const v306 = v303 ? v303.remedial_status : "";
        const v307 = v304 ? parseInt(v304, 10) : null;
        const v308 = v305 ? parseInt(v305, 10) : null;
        let v309 = "";
        if (v308) {
          v309 = v308;
        } else if (v307 && v307 >= 3) {
          v309 = v307;
        }
        if (v309) {
          v295 += parseInt(v309, 10);
          v296++;
        }
        v294 += "<tr style=\"border-bottom:1px solid #f1f5f9;\">\n                    <td style=\"padding:0.75rem 0.5rem;\">\n                        <span style=\"font-weight:700; color:var(--primary); font-size:0.75rem; display:block;\">[" + v302.indicator_code + "]</span>\n                        <span style=\"color:var(--text-main); font-weight:500;\">" + escapeHtml(v302.description) + "</span>\n                        " + (v306 === "Requires Support" ? "<span class=\"badge badge-a\" style=\"margin-left:0.5rem; background:#fee2e2; color:#dc2626; padding:2px 6px; border-radius:4px; font-size:0.7rem; font-weight:700;\">Requires Support</span>" : "") + "\n                    </td>\n                    <td style=\"padding:0.75rem 0.5rem; text-align:center; font-weight:700; color:var(--primary);\">" + (v304 || "—") + "</td>\n                    <td style=\"padding:0.75rem 0.5rem; text-align:center; font-weight:700; color:var(--success);\">" + (v305 || "—") + "</td>\n                </tr>";
      });
      v294 += "</tbody></table>";
    } else {
      v294 += "<h3 style=\"margin-top:0; color:var(--primary); font-size:1rem; font-weight:800;\">Class 4-5 Continuous Evaluation (2083)</h3>";
      v294 += "<table style=\"width:100%; border-collapse:collapse; text-align:left; font-size:0.9rem; margin-bottom:1.5rem;\">";
      v294 += "<thead><tr style=\"border-bottom:2px solid var(--border);\"><th style=\"padding:0.75rem 0.5rem;\">Learning Outcome / Indicator</th><th style=\"padding:0.75rem 0.5rem; width:140px; text-align:center;\">Regular Evaluation</th><th style=\"padding:0.75rem 0.5rem; width:140px; text-align:center;\">Support Evaluation</th></tr></thead><tbody>";
      v290.forEach(v311 => {
        const v312 = v293.find(v318 => v318.outcome_id === v311.id || v311.id.startsWith && v311.id.startsWith("fallback-") && v318.outcome_id === v311.id);
        const v313 = v312 ? v312.phase1_rating : "";
        const v314 = v312 ? v312.phase2_rating : "";
        const v315 = v313 ? parseInt(v313, 10) : null;
        const v316 = v314 ? parseInt(v314, 10) : null;
        let v317 = v316 || v315;
        if (v317) {
          v295 += v317;
          v296++;
        }
        v294 += "<tr style=\"border-bottom:1px solid #f1f5f9;\">\n                    <td style=\"padding:0.75rem 0.5rem;\">\n                        <span style=\"font-weight:700; color:var(--primary); font-size:0.75rem; display:block;\">[" + v311.indicator_code + "]</span>\n                        <span style=\"color:var(--text-main); font-weight:500;\">" + escapeHtml(v311.description) + "</span>\n                        " + ((v315 === 1 || v315 === 2) && !v316 ? "<div style=\"background:#fee2e2; color:#dc2626; padding:0.35rem; border-radius:6px; font-size:0.75rem; font-weight:700; margin-top:0.25rem;\">⚠️ Additional support pending.</div>" : "") + "\n                    </td>\n                    <td style=\"padding:0.75rem 0.5rem; text-align:center; font-weight:700; color:var(--primary);\">" + (v313 || "—") + "</td>\n                    <td style=\"padding:0.75rem 0.5rem; text-align:center; font-weight:700; color:var(--success);\">" + (v314 || "—") + "</td>\n                </tr>";
      });
      v294 += "</tbody></table>";
    }
    const v297 = v296 * 4;
    const v298 = v297 > 0 ? (v295 / v297 * 100).toFixed(1) : 0;
    
    // Inject read-only Student Portfolio (Karyasanchayika) summary card if Class 1-3
    if (v285 === "1-3") {
      const statusBadge = parentInformed 
        ? `<span style="background:#d1fae5; color:#065f46; padding:3px 8px; border-radius:12px; font-size:0.7rem; font-weight:700; display:inline-flex; align-items:center; gap:0.25rem; vertical-align:middle; line-height:1.2;">
             <i data-lucide="check-circle" style="width:12px; height:12px;"></i> Informed
           </span>`
        : `<span style="background:#fee2e2; color:#991b1b; padding:3px 8px; border-radius:12px; font-size:0.7rem; font-weight:700; display:inline-flex; align-items:center; gap:0.25rem; vertical-align:middle; line-height:1.2;">
             <i data-lucide="alert-circle" style="width:12px; height:12px;"></i> Pending
           </span>`;
      
      v294 += `
        <div style="margin-top:1rem; padding:1.25rem; background:#eff6ff; border-radius:8px; border:1px solid #bfdbfe; margin-bottom:1rem;">
            <h4 style="margin-top:0; color:#1e40af; font-size:0.85rem; font-weight:800; display:flex; align-items:center; gap:0.4rem; margin-bottom:0.75rem;">
                <i data-lucide="folder-open" style="width:16px; height:16px;"></i> Student Portfolio (कार्यसञ्चयिका) & Parental Log
            </h4>
            <div style="font-size:0.8rem; color:#1e3a8a; margin-bottom:0.6rem; line-height:1.5;">
                <strong>Representative Works / Tasks (प्रतिनिधि कार्यहरू):</strong> <br/>
                <span style="color:var(--text-main); font-weight:500; display:block; margin-top:0.2rem; background:#ffffff; padding:0.5rem; border-radius:6px; border:1px solid #dbeafe; white-space:pre-wrap;">${escapeHtml(representativeWorks) || "No representative works logged for this theme yet."}</span>
            </div>
            <div style="display:flex; align-items:center; gap:0.5rem; font-size:0.8rem; color:#1e3a8a; flex-wrap:wrap;">
                <strong>Communication Status:</strong>
                ${statusBadge}
                ${parentInformedDate ? `<span style="color:var(--text-muted); font-size:0.75rem; font-weight:700; margin-left:0.25rem;">(मिति: ${escapeHtml(window.formatDateLabel ? window.formatDateLabel(parentInformedDate) : parentInformedDate)})</span>` : ""}
            </div>
        </div>
      `;
    }

    let v299 = "";
    const g = window.getCASGradeFor45 ? window.getCASGradeFor45(v298) : (window.CAS_CONFIG.grading["4-5"] || []).find(v324 => v298 >= v324.min && v298 <= v324.max) || (window.CAS_CONFIG.grading["4-5"] || [])[(window.CAS_CONFIG.grading["4-5"] || []).length - 1] || {};
    v299 = "\n                <div>\n                    <div style=\"font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;\">Total Score</div>\n                    <div style=\"font-size:1.5rem; font-weight:800; color:var(--text-main);\">" + v295 + " <span style=\"font-size:1rem; color:var(--text-muted); font-weight:500;\">/ " + v297 + "</span></div>\n                </div>\n                <div>\n                    <div style=\"font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;\">Achievement %</div>\n                    <div style=\"font-size:1.5rem; font-weight:800; color:var(--text-main);\">" + v298 + "%</div>\n                </div>\n                <div>\n                    <div style=\"font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;\">Grade</div>\n                    <div style=\"font-size:1.5rem; font-weight:800; color:var(--text-main);\">" + (g.grade || "-") + "</div>\n                </div>\n                <div>\n                    <div style=\"font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;\">GPA</div>\n                    <div style=\"font-size:1.5rem; font-weight:800; color:var(--primary);\">" + (g.gpa || "-") + "</div>\n                </div>\n            ";
    v294 += "<div style=\"margin-top:1.5rem; padding:1.25rem; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0;\">\n            <div style=\"display:grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap:1rem; text-align:center; margin-bottom:1rem;\">\n                " + v299 + "\n            </div>\n            <button class=\"btn btn-secondary btn-block\" onclick=\"window.printCASReportCard('" + v280 + "', '" + v287 + "')\" style=\"margin-top:0.75rem; display:flex; align-items:center; justify-content:center; gap:0.5rem;\">\n                <i data-lucide=\"printer\" style=\"width:16px; height:16px;\"></i> Print / Save Report Card\n            </button>\n        </div>";
    v294 += "</div>";
    // Add Weekly CAS Rubric container below the CDC evaluation
    v294 += `<div style="margin-top:2rem;">
        <h3 style="margin-top:0; color:var(--primary); font-size:1.1rem; font-weight:800; border-bottom: 2px solid #e2e8f0; padding-bottom:0.5rem; margin-bottom:1rem;">
            Weekly CAS Rubric & GPA Overview
        </h3>
        <div id="parent-weekly-cas-container"></div>
    </div>`;
    v283.innerHTML = v294;
    
    // Render the interactive (read-only) Weekly CAS Rubric
    const weeklyCasContainer = document.getElementById("parent-weekly-cas-container");
    if (weeklyCasContainer && window.views && window.views.casWeeklyRubricPanel) {
        weeklyCasContainer.innerHTML = window.views.casWeeklyRubricPanel(selectedChild.id, 1, v287, false);
        if (window.fetchAndRenderWeeklyRubric) {
            window.fetchAndRenderWeeklyRubric(selectedChild.id, v287, 1, false);
        }
    }
    
    if (window.lucide) {
      window.lucide.createIcons();
    }
  } catch (v325) {
    console.error("CAS Load Error:", v325);
    v283.innerHTML = "<div style=\"color:var(--error); padding:2rem; text-align:center;\">Failed to load data: " + v325.message + "</div>";
  }
};
initParentPortal();
window.openNotificationsFeed = async function () {
  openModal("<div style=\"padding:2rem;text-align:center;\"><div class=\"spinner\"></div><p style=\"margin-top:1rem;color:var(--text-muted)\">Loading notifications...</p></div>");
  try {
    const v326 = selectedChild ? [selectedChild.id] : [];
    const v327 = selectedChild ? [selectedChild.class] : [];
    let v328 = "target_type.eq.school";
    if (v327.length > 0) {
      v328 += ",and(target_type.eq.class,target_value.eq.\"" + selectedChild.class + "\")";
    }
    if (v326.length > 0) {
      v328 += ",and(target_type.eq.individual,target_value.eq.\"" + selectedChild.id + "\")";
    }
    const {
      data: v329,
      error: v330
    } = await v1.from("notifications").select("*").or(v328).order("created_at", {
      ascending: false
    }).limit(30);
    if (v330) {
      throw v330;
    }
    localStorage.setItem("global_notif_last_read_" + currentParent.id, new Date().toISOString());
    if (window.updateBadges) {
      updateBadges();
    }
    let v331 = "<div style=\"padding:0.5rem;\"><div style=\"display:flex;align-items:center;gap:0.5rem;margin-bottom:1.25rem;\"><div style=\"background:#f1f5f9;color:#475569;width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;\"><i data-lucide=\"bell\" style=\"width:20px;height:20px;\"></i></div><h2 style=\"font-size:1.15rem;font-weight:800;margin:0;\">Notifications</h2></div>";
    if (!v329 || v329.length === 0) {
      v331 += "<p style=\"text-align:center;color:var(--text-muted);padding:2rem;\">No recent notifications.</p>";
    } else {
      v331 += "<div style=\"max-height:60vh;overflow-y:auto;padding-right:0.5rem;\">" + v329.map(v336 => {
        const v337 = new Date(v336.created_at);
        const v338 = v337.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit"
        });
        const v339 = window.formatDateLabel(v336.created_at.split("T")[0]) + " " + v338;
        let v340 = "bell";
        if (v336.type === "mark") {
          v340 = "graduation-cap";
        } else if (v336.type === "routine") {
          v340 = "calendar";
        } else if (v336.type === "homework") {
          v340 = "book-open";
        } else if (v336.type === "notice") {
          v340 = "megaphone";
        } else if (v336.type === "message") {
          v340 = "mail";
        }
        return "<div class=\"card\" style=\"padding:1rem;margin-bottom:0.75rem;display:flex;gap:1rem;align-items:flex-start;\"><div style=\"background:var(--primary-light);color:var(--primary);width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;\"><i data-lucide=\"" + v340 + "\" style=\"width:16px;height:16px;\"></i></div><div style=\"flex:1;\"><h4 style=\"margin:0 0 0.25rem 0;font-size:0.9rem;font-weight:800;color:var(--text-main);\">" + escapeHtml(v336.title) + "</h4><p style=\"margin:0;font-size:0.8rem;color:var(--text-muted);line-height:1.4;\">" + escapeHtml(v336.body) + "</p><div style=\"margin-top:0.5rem;font-size:0.65rem;color:var(--text-muted);font-weight:700;\">" + v339 + "</div></div></div>";
      }).join("") + "</div>";
    }
    v331 += "</div>";
    openModal(v331);
    lucide.createIcons();
  } catch (v341) {
    console.error(v341);
    openModal("<div style=\"padding:2rem;text-align:center;color:var(--error)\">Failed to load notifications. Please check connection.</div>");
  }
};