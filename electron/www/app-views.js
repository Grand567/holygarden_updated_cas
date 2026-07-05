import { CLASS_OPTIONS, escapeHtml, getTeacherAssignments } from "./shared.js";
import { renderStudentList } from "./app-core.js";
const views = window.views = {
  dashboard: () => {
    const v1 = window.getToday();
    const v2 = window.state;
    const v3 = (v2.attendance || {})[v1] || {};
    const v4 = getTeacherAssignments();
    const v5 = v4.isAdmin ? [] : v4.assignments.filter(v14 => v14.isHomeroom).map(v15 => v15.className);
    let v6 = v2.students || [];
    if (!v4.isAdmin) {
      v6 = v6.filter(v16 => v5.includes(v16.class));
    }
    const v7 = new Set(v6.map(v17 => v17.id));
    const v8 = Object.entries(v3).filter(([v18, v19]) => v7.has(v18) && v19 === "P").length;
    const v9 = Object.entries(v3).filter(([v20, v21]) => v7.has(v20) && v21 === "A").length;
    const v10 = v6.length;
    let v11 = (v2.homework || {})[v1] || [];
    if (!v4.isAdmin) {
      v11 = v11.filter(v22 => v22.class === "All" || v5.includes(v22.class));
    }
    const v12 = v11.length;
    const v13 = window.formatDateLabel(v1);

    const v219 = v4.isAdmin ? window.CLASS_OPTIONS : v4.assignments.map(v221 => v221.className || v221.class || "");
    const v220 = v219.some(v222 => v222 && (v222.match(/grade\s*[1-5]$/i) || v222.match(/^class\s*[1-5]$/i)));

    return "<div class=\"view\">\n      <div class=\"hero-card\">\n        <p style=\"color:var(--text-muted);font-size:0.75rem;margin-bottom:0.25rem\">" + v13 + "</p>\n        <h2>Namaste, " + escapeHtml(window.currentTeacherName || "Teacher") + "!</h2>\n        <p style=\"color:var(--primary);font-weight:600;font-size:0.8rem\">Holy Garden English Secondary School</p>\n        <div class=\"stats-row\">\n          <div class=\"stat-pill\"><div class=\"num\">" + v10 + "</div><div class=\"lbl\">Students</div></div>\n          <div class=\"stat-pill\"><div class=\"num\">" + v8 + "</div><div class=\"lbl\">Present</div></div>\n          <div class=\"stat-pill\"><div class=\"num\">" + v12 + "</div><div class=\"lbl\">HW Today</div></div>\n        </div>\n      </div>\n      <h3 style=\"margin-bottom:0.85rem;color:var(--text-muted);font-size:0.8rem;text-transform:uppercase;letter-spacing:0.05em\">Quick Access</h3>\n      <div class=\"quick-grid\">\n        <div class=\"quick-card\" onclick=\"switchView('attendance')\">\n          <div class=\"quick-icon\" style=\"background:#e0e7ff\"><i data-lucide=\"calendar-check\" style=\"color:#4f46e5\"></i></div>\n          <h3>Attendance</h3><p>Mark today</p>\n        </div>\n        <div class=\"quick-card\" onclick=\"switchView('homework')\">\n          <div class=\"quick-icon\" style=\"background:#dcfce7\"><i data-lucide=\"book-open\" style=\"color:#10b981\"></i></div>\n          <h3>Homework</h3><p>Assign tasks</p>\n        </div>\n        <div class=\"quick-card\" onclick=\"switchView('students')\">\n          <div class=\"quick-icon\" style=\"background:#fef3c7\"><i data-lucide=\"users\" style=\"color:#d97706\"></i></div>\n          <h3>Students</h3><p>Manage profiles</p>\n        </div>\n        <div class=\"quick-card\" onclick=\"switchView('performance')\">\n          <div class=\"quick-icon\" style=\"background:#fce7f3\"><i data-lucide=\"bar-chart-3\" style=\"color:#ec4899\"></i></div>\n          <h3>Marks</h3><p>Enter results</p>\n        </div>\n        <div class=\"quick-card\" onclick=\"switchView('routine')\">\n          <div class=\"quick-icon\" style=\"background:#e0f2fe\"><i data-lucide=\"calendar\" style=\"color:#0369a1\"></i></div>\n          <h3>Routine</h3><p>Manage class</p>\n        </div>\n        <div class=\"quick-card\" onclick=\"switchView('leave')\">\n          <div class=\"quick-icon\" style=\"background:#fef3c7\"><i data-lucide=\"file-text\" style=\"color:#d97706\"></i></div>\n          <h3>Leave Apps</h3><p>Review requests</p>\n        </div>\n        <div class=\"quick-card\" onclick=\"switchView('practicalmarks')\">\n          <div class=\"quick-icon\" style=\"background:#e0f2fe\"><i data-lucide=\"flask-conical\" style=\"color:#0369a1\"></i></div>\n          <h3>Practical</h3><p>CDC evaluation</p>\n        </div>\n        <div class=\"quick-card\" onclick=\"switchView('messages')\">\n          <div class=\"quick-icon\" style=\"background:#e0e7ff\"><i data-lucide=\"message-square\" style=\"color:#4f46e5\"></i></div>\n          <h3>Messages</h3><p>Send notices</p>\n        </div>\n        " + (v220 ? "\n        <div class=\"quick-card\" onclick=\"switchView('cas')\">\n          <div class=\"quick-icon\" style=\"background:#e0e7ff\"><i data-lucide=\"award\" style=\"color:#4338ca\"></i></div>\n          <h3>CAS</h3><p>Class 1-5 Eval</p>\n        </div>\n        " : "") + "\n      </div>\n      " + (v9 > 0 ? "<div class=\"card\" style=\"background:#fef2f2;border-color:#fecaca;margin-top:1rem\">\n        <p style=\"color:#dc2626;font-weight:600;font-size:0.85rem\">Notice: " + v9 + " student" + (v9 > 1 ? "s" : "") + " absent today</p>\n      </div>" : "") + "\n    </div>";
  },
  students: () => {
    const v23 = window.state;
    const v24 = getTeacherAssignments();
    if (!v24.isAdmin) {
      const v27 = v24.assignments.filter(v28 => v28.isHomeroom).map(v29 => v29.className);
      if (v23.selectedStudentClass === "All" || !v24.assignments.some(v30 => v30.className === v23.selectedStudentClass)) {
        v23.selectedStudentClass = v27[0] || v24.assignments[0]?.className || "Grade 1";
      }
    }
    let v25 = v23.students || [];
    if (!v24.isAdmin) {
      const v31 = v24.assignments.map(v32 => v32.className);
      v25 = v25.filter(v33 => v31.includes(v33.class));
    }
    if (v23.selectedStudentClass && v23.selectedStudentClass !== "All") {
      v25 = v25.filter(v34 => String(v34.class || "").trim().toLowerCase() === String(v23.selectedStudentClass || "").trim().toLowerCase());
    }
    const v26 = v24.isAdmin ? ["All", ...CLASS_OPTIONS] : v24.assignments.map(v35 => v35.className);
    return "<div class=\"view\">\n      <div class=\"section-header\">\n        <div><h2>Students</h2><p>" + v25.length + " enrolled</p></div>\n        <div style=\"display:flex;gap:0.5rem\">\n          <button class=\"btn btn-secondary btn-icon\" style=\"background:#e2e8f0;color:#0f172a\" onclick=\"document.getElementById('import-students').click()\" title=\"Import Students\"><i data-lucide=\"upload\"></i></button>\n          <input type=\"file\" id=\"import-students\" style=\"display:none\" accept=\".xlsx,.xls\" onchange=\"window.importStudentsExcel(event)\">\n          <button class=\"btn btn-primary btn-icon\" onclick=\"window.openStudentForm()\"><i data-lucide=\"user-plus\"></i></button>\n        </div>\n      </div>\n      <div style=\"margin-bottom: 1rem;\">\n          <select class=\"form-input\" style=\"width: 100%; padding: 0.65rem 0.9rem;\" onchange=\"window.changeStudentClass(this.value)\">\n            " + v26.map(v36 => "<option value=\"" + v36 + "\" " + (v36 === (v23.selectedStudentClass || "All") ? "selected" : "") + ">" + v36 + "</option>").join("") + "\n          </select>\n      </div>\n      <div class=\"search-wrap\">\n        <i data-lucide=\"search\" class=\"search-icon\"></i>\n        <input class=\"search-input\" type=\"text\" placeholder=\"Search by name or roll…\" oninput=\"window.filterStudents(this.value)\">\n      </div>\n      <div id=\"student-list\">" + renderStudentList(v25) + "</div>\n    </div>";
  },
  attendance: () => {
    const v37 = window.state;
    const v38 = v37.selectedDate;
    const v39 = (v37.attendance || {})[v38] || {};
    const v40 = getTeacherAssignments();
    const v41 = v40.isAdmin ? window.CLASS_OPTIONS : v40.assignments.filter(v49 => v49.isHomeroom).map(v50 => v50.className);
    if (!v40.isAdmin && v41.length === 0) {
      return "<div class=\"view\" style=\"text-align:center;padding:3rem 1rem\">\n            <h3>Access Restricted</h3>\n            <p>You are not assigned as a Homeroom Teacher for any class. Attendance marking is restricted to Homeroom Teachers only.</p>\n            <button class=\"btn btn-primary btn-block\" style=\"margin-top:2rem\" onclick=\"window.switchView('dashboard')\">Back to Dashboard</button>\n        </div>";
    }
    if (!v40.isAdmin) {
      if (v37.selectedAttClass === "All" || !v41.includes(v37.selectedAttClass)) {
        v37.selectedAttClass = v41[0] || "All";
      }
    }
    let v42 = v37.students || [];
    if (v37.selectedAttClass !== "All") {
      v42 = v42.filter(v51 => String(v51.class || "").trim().toLowerCase() === String(v37.selectedAttClass || "").trim().toLowerCase());
    }
    let v43 = 0;
    let v44 = 0;
    let v45 = 0;
    v42.forEach(v52 => {
      if (v39[v52.id] === "P") {
        v43++;
      } else if (v39[v52.id] === "A") {
        v44++;
      } else if (v39[v52.id] === "L") {
        v45++;
      }
    });
    const v46 = v41.filter(v53 => {
      const v54 = (window.state.students || []).filter(v56 => v56.class === v53);
      if (v54.length === 0) {
        return false;
      }
      const v55 = v54.some(v57 => v39[v57.id]);
      return !v55;
    });
    let v47 = [...v46];
    if (window.state.selectedAttClass !== "All" && !v46.includes(window.state.selectedAttClass)) {
      v47.push(window.state.selectedAttClass);
    }
    const v48 = v40.isAdmin ? ["All", ...window.CLASS_OPTIONS] : v47;
    return "<div class=\"view\">\n      <div class=\"section-header\" style=\"margin-bottom:0.75rem\">\n        <h2>Attendance</h2>\n        <button class=\"btn btn-ghost btn-sm\" onclick=\"window.showAttHistory()\"><i data-lucide=\"history\" style=\"width:14px;height:14px\"></i> History</button>\n      </div>\n      <div style=\"display: flex; gap: 0.5rem; margin-bottom: 1rem;\">\n          <select class=\"form-input\" style=\"flex: 1; padding: 0.65rem 0.9rem;\" onchange=\"window.changeAttClass(this.value)\">\n            " + v48.map(v58 => "<option value=\"" + v58 + "\" " + (v58 === v37.selectedAttClass ? "selected" : "") + ">" + v58 + "</option>").join("") + "\n          </select>\n          <input type=\"text\" class=\"form-input nepali-date-picker\" value=\"" + v38 + "\" onchange=\"window.changeAttDate(this.value)\" style=\"flex:1;padding:0.65rem 0.9rem;\" readonly>\n      </div>\n      <div class=\"att-summary-bar\">\n        <div class=\"att-sum-pill pill-p\"><span id=\"att-p\">" + v43 + "</span><span>Present</span></div>\n        <div class=\"att-sum-pill pill-a\"><span id=\"att-a\">" + v44 + "</span><span>Absent</span></div>\n        <div class=\"att-sum-pill pill-l\"><span id=\"att-l\">" + v45 + "</span><span>Late</span></div>\n      </div>\n      <div class=\"att-card\" style=\"margin-bottom:1.5rem\">\n        " + v42.map(v59 => {
      const v60 = v39[v59.id] || "";
      let v61 = false;
      let v62 = "";
      let v63 = "";
      if (v37.leaveApplications) {
        const v64 = v37.leaveApplications.find(v65 => String(v65.student_id) === String(v59.id) && v38 >= v65.start_date && v38 <= v65.end_date);
        if (v64) {
          v61 = true;
          v62 = v64.status;
          v63 = v64.reason;
        }
      }
      return "<div class=\"att-row\" data-sid=\"" + v59.id + "\" style=\"padding:0.75rem 0.5rem\">\n            <div style=\"flex:1;min-width:0\">\n                <div class=\"att-name\" style=\"white-space:nowrap;overflow:hidden;text-overflow:ellipsis\">\n                    " + escapeHtml(v59.name) + "\n                    " + (v61 ? "<span style=\"font-size:0.65rem; margin-left:0.4rem; padding:0.15rem 0.4rem; border-radius:10px; background:" + (v62 === "Approved" ? "#dcfce7" : v62 === "Pending" ? "#fef3c7" : "#fee2e2") + "; color:" + (v62 === "Approved" ? "#16a34a" : v62 === "Pending" ? "#d97706" : "#dc2626") + "\" title=\"" + escapeHtml(v63) + "\">Leave " + v62 + "</span>" : "") + "\n                </div>\n                <div class=\"att-roll\">Roll: " + escapeHtml(v59.roll) + "</div>\n            </div>\n            <div class=\"att-toggle\" style=\"gap:0.35rem\">\n              <button class=\"toggle-btn p-btn " + (v60 === "P" ? "active" : "") + "\" data-status=\"P\" onclick=\"window.toggleAttendance('" + v59.id + "','P')\" style=\"min-width:40px;height:38px\">P</button>\n              <button class=\"toggle-btn a-btn " + (v60 === "A" ? "active" : "") + "\" data-status=\"A\" onclick=\"window.toggleAttendance('" + v59.id + "','A')\" style=\"min-width:40px;height:38px\">A</button>\n              <button class=\"toggle-btn l-btn " + (v60 === "L" ? "active" : "") + "\" data-status=\"L\" onclick=\"window.toggleAttendance('" + v59.id + "','L')\" style=\"min-width:40px;height:38px\">L</button>\n            </div>\n          </div>";
    }).join("") + "\n      </div>\n      <button class=\"btn btn-primary btn-block\" onclick=\"window.saveAttendance()\" style=\"margin-bottom:2rem\"><i data-lucide=\"check-circle\"></i> Save All Changes</button>\n    </div>";
  },
  homework: () => {
    const v66 = window.state;
    const v67 = window.getToday();
    const v68 = Object.keys(v66.homework || {}).sort().reverse();
    const v69 = v66.selectedHwDate || "";
    const v70 = v69 ? v68.filter(v74 => v74 === v69) : v68.slice(0, 3);
    const v71 = [];
    v70.forEach(v75 => {
      (v66.homework[v75] || []).forEach(v76 => {
        if (v66.selectedHwClass === "All" || v76.class === "All" || v76.class === v66.selectedHwClass) {
          v71.push({
            ...v76,
            dateKey: v75
          });
        }
      });
    });
    const v72 = getTeacherAssignments();
    const v73 = v72.isAdmin ? ["All", ...CLASS_OPTIONS] : v72.assignments.map(v77 => v77.className);
    if (!v72.isAdmin && (v66.selectedHwClass === "All" || !v73.includes(v66.selectedHwClass))) {
      v66.selectedHwClass = v73[0] || "All";
    }
    return "<div class=\"view\">\n      <div class=\"section-header\">\n        <div><h2>Homework</h2><p>" + v71.length + " entries shown</p></div>\n        <button class=\"btn btn-primary btn-icon\" onclick=\"window.openAddHomework()\"><i data-lucide=\"plus\"></i></button>\n      </div>\n      <div style=\"display:flex;gap:0.5rem;margin-bottom:0.75rem;\">\n        <select class=\"form-input\" style=\"flex:1;padding:0.65rem 0.9rem;\" onchange=\"window.changeHwClass(this.value)\">\n          " + v73.map(v78 => "<option value=\"" + v78 + "\" " + (v78 === v66.selectedHwClass ? "selected" : "") + ">" + v78 + "</option>").join("") + "\n        </select>\n        <input type=\"text\" class=\"form-input nepali-date-picker\" placeholder=\"Browse date…\"\n          value=\"" + v69 + "\"\n          onchange=\"window.changeHwDate(this.value)\"\n          style=\"flex:1;padding:0.65rem 0.9rem;\" readonly>\n      </div>\n      " + (v69 ? "<button class=\"btn btn-ghost btn-sm\" onclick=\"window.changeHwDate('')\" style=\"width:100%;margin-bottom:0.75rem;font-size:0.8rem;\">✕ Clear — show recent 3 days</button>" : "<p style=\"font-size:0.72rem;color:var(--text-muted);text-align:center;margin-bottom:0.75rem;\">Showing last " + v70.length + " day(s) with homework. Pick a date above to browse older records.</p>") + "\n      " + (v71.length === 0 ? "<div class=\"empty-state\"><p>No homework found" + (v69 ? " for this date" : "") + ".</p></div>" : "") + "\n      " + v70.map(v79 => {
      const v80 = (v66.homework[v79] || []).filter(v81 => v66.selectedHwClass === "All" || v81.class === "All" || v81.class === v66.selectedHwClass);
      v80.sort((v82, v83) => {
        const v84 = ["All", ...CLASS_OPTIONS];
        const v85 = v84.indexOf(v82.class || "All");
        const v86 = v84.indexOf(v83.class || "All");
        return (v85 === -1 ? 99 : v85) - (v86 === -1 ? 99 : v86);
      });
      if (!v80.length) {
        return "";
      }
      return "<div>\n          <p style=\"font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.5rem;padding-left:0.25rem\">" + (v79 === v67 ? "Today — " : "") + window.formatDateLabel(v79) + "</p>\n          " + v80.map((v87, v88) => {
        const v89 = window.SUBJECT_COLORS || [];
        const v90 = window.state.subjects.indexOf(v87.subject);
        const v91 = v89[v90 % v89.length] || "#4f46e5";
        const v92 = v87.id || v88;
        const v93 = (v66.hwStatus || {})[v92] || {};
        let v94 = 0;
        let v95 = 0;
        let v96 = 0;
        let v97 = v87.class || "All";
        if (v97 === "All" && v66.selectedHwClass && v66.selectedHwClass !== "All") {
          v97 = v66.selectedHwClass;
        }
        let v98 = v66.students || [];
        if (v97 !== "All") {
          v98 = v98.filter(v104 => String(v104.class || "").trim().toLowerCase() === String(v97 || "").trim().toLowerCase());
        }
        const v99 = new Set(v98.map(v105 => v105.id));
        let v100 = [];
        let v101 = [];
        let v102 = [];
        let v103 = [];
        Object.entries(v93).forEach(([v106, v107]) => {
          if (v99.has(v106)) {
            const v108 = (v66.students.find(v109 => v109.id === v106) || {}).name || v106;
            if (v107 === "Done") {
              v94++;
              v100.push(v108);
            } else if (v107 === "Not Done") {
              v95++;
              v101.push(v108);
            } else if (v107 === "Incomplete") {
              v96++;
              v102.push(v108);
            } else if (v107 === "Absent") {
              v103.push(v108);
            }
          }
        });
        return "<div class=\"hw-card\">\n              <div class=\"hw-header\">\n                <div>\n                  <span class=\"hw-subject\" style=\"background:" + v91 + "22;color:" + v91 + "\">" + escapeHtml(v87.subject) + "</span>\n                  <span style=\"font-size:0.7rem;color:var(--text-muted);margin-left:0.5rem;font-weight:600;\">" + escapeHtml(v97) + "</span>\n                </div>\n                <div style=\"display:flex;gap:0.4rem;align-items:center;flex-wrap:nowrap;\">\n                  <button class=\"btn btn-secondary btn-sm\" onclick=\"window.state.trackingHwId='" + v92 + "';window.state.trackingHwClass='" + escapeHtml(v97) + "';window.switchView('hwTracking')\" style=\"font-size:0.65rem;padding:0.2rem 0.45rem;height:auto;min-height:0;white-space:nowrap;\">Track</button>\n                  <button class=\"btn btn-secondary btn-sm\" onclick=\"window.openEditHomework('" + v79 + "','" + v92 + "')\" style=\"font-size:0.65rem;padding:0.2rem 0.45rem;height:auto;min-height:0;\">Edit</button>\n                  <button class=\"delete-btn\" onclick=\"window.deleteHomework('" + v79 + "','" + v92 + "')\"><i data-lucide=\"trash-2\" style=\"width:14px;height:14px\"></i></button>\n                </div>\n              </div>\n              <p class=\"hw-task\">" + escapeHtml(v87.task) + "</p>\n              " + (v87.teacher_name ? "<div style=\"display:flex;align-items:center;gap:0.3rem;margin-top:0.4rem;font-size:0.68rem;color:var(--text-muted);\"><i data-lucide=\"user\" style=\"width:11px;height:11px;flex-shrink:0;\"></i><span>Assigned by <strong>" + escapeHtml(v87.teacher_name) + "</strong></span></div>" : "") + "\n              <div style=\"display:flex;flex-direction:column;gap:0.3rem;margin-top:0.6rem;font-size:0.65rem;color:var(--text-muted);\">\n                " + (v100.length > 0 ? "<div><span style=\"color:#10b981;font-weight:700;\">Done:</span> " + v100.join(", ") + "</div>" : "") + "\n                " + (v101.length > 0 ? "<div><span style=\"color:#ef4444;font-weight:700;\">Missed:</span> " + v101.join(", ") + "</div>" : "") + "\n                " + (v102.length > 0 ? "<div><span style=\"color:#f59e0b;font-weight:700;\">Partial:</span> " + v102.join(", ") + "</div>" : "") + "\n                " + (v103.length > 0 ? "<div><span style=\"color:var(--text-muted);font-weight:700;\">Absent:</span> " + v103.join(", ") + "</div>" : "") + "\n              </div>\n            </div>";
      }).join("") + "\n        </div>";
    }).join("") + "\n    </div>";
  },
  hwTracking: () => {
    const v110 = window.state;
    const v111 = v110.trackingHwId;
    const v112 = v110.trackingHwClass;
    if (!v111) {
      return "<div class=\"view\"><p>Select homework to track.</p></div>";
    }
    let v113 = null;
    Object.values(v110.homework).forEach(v119 => {
      const v120 = v119.find(v121 => v121.id === v111);
      if (v120) {
        v113 = v120;
      }
    });
    if (!v113) {
      return "<div class=\"view\"><p>Homework not found.</p></div>";
    }
    const v114 = v110.students.filter(v122 => v112 === "All" || v122.class === v112);
    const v115 = (v110.hwStatus || {})[v111] || {};
    let v116 = 0;
    let v117 = 0;
    let v118 = 0;
    Object.values(v115).forEach(v123 => {
      if (v123 === "Done") {
        v116++;
      } else if (v123 === "Not Done") {
        v117++;
      } else if (v123 === "Incomplete") {
        v118++;
      }
    });
    return "<div class=\"view\">\n      <div class=\"back-row\" style=\"margin-bottom:1rem;\">\n        <button class=\"btn btn-ghost btn-icon\" onclick=\"switchView('homework')\"><i data-lucide=\"arrow-left\"></i></button>\n        <div style=\"flex:1;margin-left:0.5rem\">\n            <h2 style=\"font-size:1.1rem;margin:0\">" + escapeHtml(v113.subject) + "</h2>\n            <p style=\"font-size:0.75rem;color:var(--text-muted);font-weight:600\">" + escapeHtml(v112) + "</p>\n        </div>\n      </div>\n      \n      <div style=\"display:grid;grid-template-columns:repeat(4,1fr);gap:0.4rem;margin-bottom:1rem;\">\n        <div style=\"background:#dcfce7;color:#14532d;padding:0.6rem;border-radius:10px;text-align:center;\">\n          <div style=\"font-weight:800;font-size:1.1rem;\" id=\"track-done-count\">" + v116 + "</div>\n          <div style=\"font-size:0.6rem;font-weight:600;text-transform:uppercase;\">Done</div>\n        </div>\n        <div style=\"background:#fee2e2;color:#7f1d1d;padding:0.6rem;border-radius:10px;text-align:center;\">\n          <div style=\"font-weight:800;font-size:1.1rem;\" id=\"track-missed-count\">" + v117 + "</div>\n          <div style=\"font-size:0.6rem;font-weight:600;text-transform:uppercase;\">Missed</div>\n        </div>\n        <div style=\"background:#ffedd5;color:#7c2d12;padding:0.6rem;border-radius:10px;text-align:center;\">\n          <div style=\"font-weight:800;font-size:1.1rem;\" id=\"track-partial-count\">" + v118 + "</div>\n          <div style=\"font-size:0.6rem;font-weight:600;text-transform:uppercase;\">Partial</div>\n        </div>\n        <div style=\"background:#e0f2fe;color:#0369a1;padding:0.6rem;border-radius:10px;text-align:center;\">\n          <div style=\"font-weight:800;font-size:1.1rem;\" id=\"track-absent-count\">" + Object.values(v115).filter(v124 => v124 === "Absent").length + "</div>\n          <div style=\"font-size:0.6rem;font-weight:600;text-transform:uppercase;\">Absent</div>\n        </div>\n      </div>\n\n      <div class=\"card\" style=\"padding:0;overflow:hidden;\">\n        " + (v114.length === 0 ? "<p style=\"text-align:center;padding:2rem;color:var(--text-muted);\">No students found.</p>" : v114.map(v125 => {
      const v126 = v115[v125.id] || "";
      return "<div class=\"att-row\" data-sid=\"" + v125.id + "\" style=\"padding:0.75rem 1rem;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;\">\n                  <div style=\"flex:1;margin-right:0.5rem\">\n                    <div class=\"att-name\" style=\"font-weight:700;font-size:0.9rem\">" + escapeHtml(v125.name) + "</div>\n                    <div class=\"att-roll\" style=\"font-size:0.7rem;color:var(--text-muted)\">Roll: " + escapeHtml(v125.roll) + "</div>\n                  </div>\n                  <div style=\"display:flex;gap:0.3rem;flex-shrink:0;\">\n                    <button class=\"toggle-btn p-btn " + (v126 === "Done" ? "active" : "") + "\" data-status=\"Done\" onclick=\"setHwStatus('" + v111 + "','" + v125.id + "','Done',this)\" style=\"padding:0.4rem 0.6rem;font-weight:800;\">✓</button>\n                    <button class=\"toggle-btn a-btn " + (v126 === "Not Done" ? "active" : "") + "\" data-status=\"Not Done\" onclick=\"setHwStatus('" + v111 + "','" + v125.id + "','Not Done',this)\" style=\"padding:0.4rem 0.6rem;font-weight:800;\">✗</button>\n                    <button class=\"toggle-btn l-btn " + (v126 === "Incomplete" ? "active" : "") + "\" data-status=\"Incomplete\" onclick=\"setHwStatus('" + v111 + "','" + v125.id + "','Incomplete',this)\" style=\"padding:0.4rem 0.6rem;font-weight:800;\">½</button>\n                    <button class=\"toggle-btn abs-btn " + (v126 === "Absent" ? "active" : "") + "\" data-status=\"Absent\" style=\"padding:0.4rem 0.6rem;font-weight:800;background:" + (v126 === "Absent" ? "#0ea5e9" : "#f1f5f9") + ";color:" + (v126 === "Absent" ? "white" : "#64748b") + "\" onclick=\"setHwStatus('" + v111 + "','" + v125.id + "','Absent',this)\">A</button>\n                  </div>\n                </div>";
    }).join("")) + "\n      </div>\n      \n      <button class=\"btn btn-secondary btn-block\" style=\"margin-top:1.5rem;background:#f1f5f9;color:var(--text-main);\" onclick=\"window.exportHwStatus('" + v111 + "','" + escapeHtml(v113.subject) + "','" + escapeHtml(v112) + "')\">\n        <i data-lucide=\"download\" style=\"width:16px;height:16px\"></i> Export to Excel\n      </button>\n    </div>";
  },
  performance: () => {
    const v127 = window.state;
    const v128 = getTeacherAssignments();
    const v129 = v128.isAdmin ? window.CLASS_OPTIONS : v128.assignments.filter(v134 => (v134.subjects && v134.subjects.length > 0) || v134.isHomeroom === true).map(v135 => v135.className);
    if (!v128.isAdmin && v129.length === 0) {
      return "<div class=\"view\" style=\"text-align:center;padding:3rem 1rem\">\n            <h3>No Subjects Assigned</h3>\n            <p>You have not been assigned to teach any subjects. Contact Admin to assign your classes and subjects.</p>\n            <button class=\"btn btn-primary btn-block\" style=\"margin-top:2rem\" onclick=\"window.switchView('dashboard')\">Back to Dashboard</button>\n        </div>";
    }
    if (!v129.includes(v127.selectedMarksClass)) {
      v127.selectedMarksClass = v129[0] || "Grade 1";
    }
    const assignmentForClass = v128.assignments.find(v136 => v136.className === v127.selectedMarksClass);
    let v130_subjects = [];
    if (v128.isAdmin || (assignmentForClass && assignmentForClass.isHomeroom === true)) {
        const classSubs = window.state?.classSubjects?.[v127.selectedMarksClass] || [];
        const globalSubs = window.state?.subjects || [];
        v130_subjects = [...new Set([...classSubs, ...globalSubs])].filter(s => s && s.trim() !== "");
    } else {
        v130_subjects = [...new Set(v128.assignments.filter(v136 => v136.className === v127.selectedMarksClass).flatMap(v136 => v136.subjects || []))].filter(s => s && s.trim() !== "");
    }
    let v131 = v130_subjects;
    if (window.filterSubjectsByClass) {
        v131 = window.filterSubjectsByClass(v131, v127.selectedMarksClass);
    }
    if (window.sortSubjectsByStandardOrder) {
        v131 = window.sortSubjectsByStandardOrder(v131);
    }
    const v132 = v128.isAdmin ? window.CLASS_OPTIONS : v129;
    let v133 = (v127.students || []).filter(v137 => v137.class === v127.selectedMarksClass);
    v133.sort((a, b) => (parseInt(a.roll) || 999) - (parseInt(b.roll) || 999));
    return "<div class=\"view\">\n      <div class=\"section-header\">\n        <div><h2>Marks Entry</h2><p>Term assessment — out of " + (v127.selectedTerm && v127.selectedTerm.toLowerCase().includes("mid") ? "50" : "100") + "</p></div>\n        <div style=\"display:flex;gap:0.5rem\">\n          <button class=\"btn btn-ghost btn-sm\" onclick=\"document.getElementById('import-marks').click()\"><i data-lucide=\"upload\" style=\"width:14px;height:14px\"></i> Import</button>\n          <input type=\"file\" id=\"import-marks\" style=\"display:none\" accept=\".xlsx,.xls\" onchange=\"window.importMarksExcel(event)\">\n          <button class=\"btn btn-ghost btn-sm\" onclick=\"window.exportEduScoreTheory()\"><i data-lucide=\"download\" style=\"width:14px;height:14px\"></i> EduScore</button>\n          <button class=\"btn btn-ghost btn-sm\" onclick=\"window.exportData()\"><i data-lucide=\"download\" style=\"width:14px;height:14px\"></i> Export</button>\n        </div>\n      </div>\n      <div style=\"display:flex;gap:0.5rem;margin-bottom: 1rem;\">\n          <select class=\"form-input\" style=\"flex:1; padding: 0.65rem 0.9rem;\" onchange=\"window.changeMarksClass(this.value)\">\n            " + v132.map(v138 => "<option value=\"" + v138 + "\" " + (v138 === v127.selectedMarksClass ? "selected" : "") + ">" + v138 + "</option>").join("") + "\n          </select>\n          <select class=\"form-input\" style=\"flex:1; padding: 0.65rem 0.9rem;\" onchange=\"window.changeTerm(this.value)\">\n            " + window.TERMS.map(v139 => "<option value=\"" + v139 + "\" " + (v139 === v127.selectedTerm ? "selected" : "") + ">" + v139 + "</option>").join("") + "\n          </select>\n      </div>\n      " + (v133.length === 0 ? "<div class=\"empty-state\"><p>No students found for this class.</p></div>" : "") + "\n      " + v133.map(v140 => {
      const v141 = v127.marks[v127.selectedTerm] ? v127.marks[v127.selectedTerm][v140.id] || {} : {};
      
      const normalizedMarks = {};
      if (window.normalizeSubjectName) {
         Object.entries(v141).forEach(([k, v]) => {
             normalizedMarks[window.normalizeSubjectName(k)] = v;
         });
      } else {
         Object.assign(normalizedMarks, v141);
      }
      
      const v142 = v131.reduce((v145, v146) => {
          const normKey = window.normalizeSubjectName ? window.normalizeSubjectName(v146) : v146;
          return v145 + (parseInt(normalizedMarks[normKey]) || 0);
      }, 0);
      const v143 = v127.selectedTerm && v127.selectedTerm.toLowerCase().includes("mid");
      
      const enteredCount = v131.filter(v146 => {
          const normKey = window.normalizeSubjectName ? window.normalizeSubjectName(v146) : v146;
          return normalizedMarks[normKey] !== undefined && normalizedMarks[normKey] !== "";
      }).length;
      
      const v144 = enteredCount > 0 ? Math.round(v142 / enteredCount * (v143 ? 2 : 1)) : 0;
      
      return "<div class=\"card\" style=\"margin-bottom:1rem\">\n            <div style=\"display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem\">\n              <div style=\"display:flex;align-items:center;gap:0.6rem\">\n                <div class=\"avatar\" style=\"width:36px;height:36px;font-size:0.9rem\">" + (v140.photo ? "<img src=\"" + v140.photo + "\" loading=\"lazy\" decoding=\"async\">" : "" + escapeHtml(v140.name.charAt(0))) + "</div>\n                <div><h3 style=\"font-size:0.9rem\">" + escapeHtml(v140.name) + "</h3><p style=\"font-size:0.72rem\">Roll: " + escapeHtml(v140.roll) + "</p></div>\n              </div>\n              <div style=\"text-align:right\"><div style=\"font-weight:800;color:var(--primary)\">" + v144 + "%</div><div style=\"font-size:0.7rem;color:var(--text-muted)\">Avg</div></div>\n            </div>\n            <div style=\"overflow-x:auto; padding-bottom:0.25rem;\">\n                <div style=\"display:flex; gap:0.5rem; min-width:max-content\">\n                  " + v131.map((v147, v148) => {
        const v149 = window.SUBJECT_COLORS[v148 % window.SUBJECT_COLORS.length] || "#4f46e5";
        const normSubject = window.normalizeSubjectName ? window.normalizeSubjectName(v147) : v147;
        const v150 = normalizedMarks[normSubject] !== undefined ? normalizedMarks[normSubject] : "";
        return "<div style=\"text-align:center; width:75px\">\n                      <div style=\"font-size:0.65rem;color:" + v149 + ";font-weight:700;margin-bottom:3px\">" + escapeHtml(v147.substring(0, 5).toUpperCase()) + "</div>\n                      <input class=\"marks-input\" type=\"number\" min=\"0\" max=\"" + (v127.selectedTerm && v127.selectedTerm.toLowerCase().includes("mid") ? "50" : "100") + "\" value=\"" + v150 + "\" placeholder=\"—\" onchange=\"window.updateMarks('" + v140.id + "','" + v147 + "',this.value)\" style=\"border-color:" + v149 + "33; width:100%; font-size:0.9rem; text-align:center; padding:0.4rem 0;\">\n                    </div>";
      }).join("") + "\n                </div>\n            </div>\n          </div>";
    }).join("") + "\n    </div>";
  },
  messages: () => {
    const v151 = window.state;
    const v152 = v151.activeMessageTab || "inbox";
    const v153 = v151.messages || [];
    const v154 = v153.filter(v157 => v157.sender_id !== window.currentUser?.id);
    const v155 = v153.filter(v158 => v158.sender_id === window.currentUser?.id);
    const v156 = v152 === "inbox" ? v154 : v155;
    return "<div class=\"view\">\n        <div class=\"section-header\" style=\"margin-bottom:0.75rem;\">\n            <div>\n                <h2>Message Centre</h2>\n                <p>" + (v152 === "inbox" ? v154.length + " received notices" : v155.length + " sent messages") + "</p>\n            </div>\n            <button class=\"btn btn-primary btn-icon\" onclick=\"window.openComposeMessageModal()\" title=\"Compose Message\"><i data-lucide=\"plus\"></i></button>\n        </div>\n        \n        <!-- Tab Switcher -->\n        <div class=\"message-tabs\" style=\"display:flex; background:#f1f5f9; padding:0.25rem; border-radius:12px; margin-bottom:1.25rem; border:1px solid #e2e8f0;\">\n            <button onclick=\"window.switchMessageTab('inbox')\" style=\"flex:1; border:none; padding:0.6rem; font-size:0.85rem; font-weight:700; border-radius:9px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:0.4rem; transition:all 0.2s; " + (v152 === "inbox" ? "background:white; color:var(--primary); box-shadow:0 2px 4px rgba(0,0,0,0.05);" : "background:transparent; color:var(--text-muted);") + "\">\n                <i data-lucide=\"inbox\" style=\"width:16px; height:16px;\"></i>\n                <span>Admin Notices</span>\n                " + (v154.length > 0 ? "<span style=\"background:var(--primary); color:white; font-size:0.65rem; padding:0.1rem 0.4rem; border-radius:10px; font-weight:800;\">" + v154.length + "</span>" : "") + "\n            </button>\n            <button onclick=\"window.switchMessageTab('sent')\" style=\"flex:1; border:none; padding:0.6rem; font-size:0.85rem; font-weight:700; border-radius:9px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:0.4rem; transition:all 0.2s; " + (v152 === "sent" ? "background:white; color:var(--primary); box-shadow:0 2px 4px rgba(0,0,0,0.05);" : "background:transparent; color:var(--text-muted);") + "\">\n                <i data-lucide=\"send\" style=\"width:16px; height:16px;\"></i>\n                <span>Sent Messages</span>\n                " + (v155.length > 0 ? "<span style=\"background:#cbd5e1; color:#475569; font-size:0.65rem; padding:0.1rem 0.4rem; border-radius:10px; font-weight:800;\">" + v155.length + "</span>" : "") + "\n            </button>\n        </div>\n        \n        " + (v156.length === 0 ? "\n            <div class=\"empty-state\" style=\"margin-top:2rem\">\n                <div style=\"background:#f1f5f9;width:64px;height:64px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 1rem\">\n                    <i data-lucide=\"" + (v152 === "inbox" ? "megaphone" : "mail") + "\" style=\"color:#94a3b8\"></i>\n                </div>\n                <p>" + (v152 === "inbox" ? "No notices from administration yet." : "No messages sent yet. Tap + to start.") + "</p>\n            </div>\n        " : "\n            <div style=\"display:flex;flex-direction:column;gap:1rem\">\n                " + v156.map(v159 => {
      const v160 = new Date(v159.created_at);
      const v161 = v160.toLocaleTimeString("en-NP", {
        hour: "2-digit",
        minute: "2-digit"
      });
      const v162 = window.formatDateLabel(v159.created_at ? v159.created_at.split("T")[0] : "") + " " + v161;
      const v163 = v159.sender_id === window.currentUser?.id;
      const v164 = v159.target_type === "class" ? "👥" : v159.target_type === "school" ? "🏫" : "👤";
      let v165 = "Unknown";
      if (v159.target_type === "school") {
        v165 = "Whole School";
      } else if (v159.target_type === "class") {
        v165 = v159.target_value;
      } else {
        v165 = window.state.students.find(v167 => v167.id === v159.target_value)?.name || "Student";
      }
      const v166 = v159.sender_name || (v163 ? "You" : "System");
      return "\n                        <div class=\"card\" onclick=\"window.viewMessageDetail('" + v159.id + "')\" style=\"padding:1rem; border-left: 4px solid " + (v163 ? "var(--primary)" : "var(--accent)") + "; cursor:pointer; position:relative; transition:all 0.15s ease;\" onmouseover=\"this.style.transform='translateY(-2px)'; this.style.boxShadow='var(--shadow-md)';\" onmouseout=\"this.style.transform='none'; this.style.boxShadow='var(--shadow-sm)';\">\n                            <div style=\"display:flex;justify-content:space-between;margin-bottom:0.5rem\">\n                                <div style=\"display:flex; flex-direction:column; gap:0.2rem\">\n                                    <span style=\"font-size:0.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase\">From: " + escapeHtml(v166) + "</span>\n                                    <span style=\"font-size:0.7rem;font-weight:700;color:var(--primary);text-transform:uppercase\">" + v164 + " To: " + escapeHtml(v165) + "</span>\n                                </div>\n                                <span style=\"font-size:0.7rem;color:var(--text-muted)\">" + v162 + "</span>\n                            </div>\n                            <h3 style=\"font-size:0.95rem;margin-bottom:0.4rem;display:flex;align-items:center;gap:0.35rem; color:var(--text-main); font-weight:800;\">\n                                " + (!v163 ? "<span style=\"font-size:0.65rem; background:var(--accent-light); color:var(--accent); font-weight:800; padding:0.1rem 0.4rem; border-radius:4px; text-transform:uppercase; letter-spacing:0.02em;\">Admin Notice</span>" : "") + "\n                                " + escapeHtml(v159.subject) + "\n                            </h3>\n                            <p style=\"font-size:0.85rem;color:var(--text-main);white-space:pre-wrap;word-break:break-word;line-height:1.5;max-height:4.5em;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;text-overflow:ellipsis;\">" + escapeHtml(v159.body) + "</p>\n                            <div style=\"text-align:right; margin-top:0.65rem; font-size:0.72rem; color:var(--primary); font-weight:700; display:flex; align-items:center; justify-content:flex-end; gap:0.25rem;\">\n                                <span>Read Full Message</span>\n                                <i data-lucide=\"arrow-right\" style=\"width:12px; height:12px;\"></i>\n                            </div>\n                        </div>\n                    ";
    }).join("") + "\n            </div>\n        ") + "\n    </div>";
  },
  routine: () => {
    const v168 = window.state;
    const v169 = getTeacherAssignments();
    const v170 = v169.isAdmin ? window.CLASS_OPTIONS : v169.assignments.filter(v172 => v172.isHomeroom).map(v173 => v173.className);
    if (v170.length === 0) {
      return "<div class=\"view\" style=\"text-align:center;padding:3rem 1rem\">\n          <h3>Homeroom Only</h3>\n          <p>Routine management is only available to Homeroom Teachers. You don't have any homeroom classes assigned.</p>\n          <button class=\"btn btn-primary btn-block\" style=\"margin-top:2rem\" onclick=\"window.switchView('dashboard')\">Back to Dashboard</button>\n      </div>";
    }
    const v171 = v168.selectedRoutineClass || v170[0];
    v168.selectedRoutineClass = v171;
    return "<div class=\"view\">\n      <div class=\"section-header\">\n        <div><h2>Class Routine</h2><p>Manage weekly schedule</p></div>\n        <button class=\"btn btn-primary btn-icon\" onclick=\"window.openAddRoutineModal('" + v171 + "')\"><i data-lucide=\"plus\"></i></button>\n      </div>\n      <div style=\"margin-bottom:1rem\">\n        <select class=\"form-input\" style=\"width:100%\" onchange=\"window.state.selectedRoutineClass=this.value; window.switchView('routine')\">\n          " + v170.map(v174 => "<option value=\"" + v174 + "\" " + (v174 === v171 ? "selected" : "") + ">" + v174 + "</option>").join("") + "\n        </select>\n      </div>\n      <div id=\"routine-content\" style=\"margin-top:1rem\">\n        <!-- Fetched dynamically -->\n        <p style=\"text-align:center;padding:2rem;color:var(--text-muted)\">Loading routine...</p>\n      </div>\n    </div>";
  },
  leave: () => {
    const v175 = window.state;
    const v176 = getTeacherAssignments();
    const v177 = v176.isAdmin ? window.CLASS_OPTIONS : v176.assignments.filter(v178 => v178.isHomeroom).map(v179 => v179.className);
    if (v177.length === 0) {
      return "<div class=\"view\" style=\"text-align:center;padding:3rem 1rem\">\n            <h3>Homeroom Only</h3>\n            <p>Leave application management is only available to Homeroom Teachers.</p>\n            <button class=\"btn btn-primary btn-block\" style=\"margin-top:2rem\" onclick=\"window.switchView('dashboard')\">Back to Dashboard</button>\n        </div>";
    }
    return "<div class=\"view\">\n      <div class=\"back-row\" onclick=\"switchView('more')\" style=\"margin-bottom:1rem; cursor:pointer;\">\n        <i data-lucide=\"arrow-left\" style=\"width:20px;height:20px;color:var(--text-muted)\"></i>\n        <h2 style=\"font-size:1.1rem;margin:0;margin-left:0.5rem\">Leave Applications</h2>\n      </div>\n      <div id=\"leave-apps-list\" style=\"margin-top:1rem\">\n        <p style=\"text-align:center;padding:2rem;color:var(--text-muted)\">Loading applications...</p>\n      </div>\n    </div>";
  },
  practicalmarks: () => {
    const v180 = window.state;
    const v181 = getTeacherAssignments();
    const v182 = v181.isAdmin ? window.CLASS_OPTIONS : v181.assignments.filter(v192 => v192.subjects && v192.subjects.length > 0).map(v193 => v193.className);
    if (!v181.isAdmin && v182.length === 0) {
      return "<div class=\"view\" style=\"text-align:center;padding:3rem 1rem\">\n        <h3>No Subjects Assigned</h3>\n        <p>You have not been assigned to teach any subjects. Contact Admin to assign your classes and subjects.</p>\n        <button class=\"btn btn-primary btn-block\" style=\"margin-top:2rem\" onclick=\"window.switchView('dashboard')\">Back to Dashboard</button>\n      </div>";
    }
    if (!v182.includes(v180.selectedPracticalClass)) {
      v180.selectedPracticalClass = v182[0] || "Grade 1";
    }
    const v183 = v181.isAdmin ? null : v181.assignments.find(v194 => v194.className === v180.selectedPracticalClass);
    const v184 = v181.isAdmin ? v180.subjects || [] : v183?.subjects || [];
    const v185 = window.getClassLevel ? window.getClassLevel(v180.selectedPracticalClass || "") : "Basic";
    const v186 = v185 === "Basic" ? 50 : 25;
    const v187 = v184.filter(v195 => {
      const v196 = v195.toLowerCase().trim();
      const v197 = ["grammar", "moral", "g.k.", "byakaran", "drawing", "workbook", "conversation", "handwriting", "dictation", "rhymes"];
      if (v197.some(v198 => v196 === v198 || v196.includes(v198))) {
        return false;
      }
      if (v196 === "gk" || v196 === "general knowledge") {
        return false;
      }
      if (v196 === "computer science" || v196 === "computer") {
        return false;
      }
      if (v185 === "Basic" || v185 === "Primary") {
        if (v185 === "Primary" && (v196.includes("optional math") || v196.includes("opt math") || v196 === "opt. math")) {
          return false;
        }
        return true;
      } else {
        if (v196.includes("local subject") || v196.includes("local curriculum") || v196 === "lc") {
          return false;
        }
        if (v196.includes("health physical") || v196.includes("health & physical") || v196 === "hpe") {
          return false;
        }
        return true;
      }
    });
    const v188 = v181.isAdmin ? window.CLASS_OPTIONS : v182;
    let v189 = (v180.students || []).filter(v199 => v199.class === v180.selectedPracticalClass);
    v189.sort((a, b) => (parseInt(a.roll) || 999) - (parseInt(b.roll) || 999));
    const v190 = v180.practicalMarks || {};
    const v191 = v180.selectedPracticalTerm || "First Term";
    return "<div class=\"view\">\n      <div class=\"section-header\">\n        <div><h2>Practical Marks</h2><p>CDC internal assessment — out of " + v186 + " per subject</p></div>\n        <button class=\"btn btn-ghost btn-sm\" onclick=\"window.exportEduScore()\"><i data-lucide=\"download\" style=\"width:14px;height:14px\"></i> Export EduScore</button>\n      </div>\n      <div style=\"display:flex;gap:0.5rem;margin-bottom:1rem;\">\n        <select class=\"form-input\" style=\"flex:1;padding:0.65rem 0.9rem;\" onchange=\"window.changePracticalClass(this.value)\">\n          " + v188.map(v200 => "<option value=\"" + v200 + "\" " + (v200 === v180.selectedPracticalClass ? "selected" : "") + ">" + v200 + "</option>").join("") + "\n        </select>\n        <select class=\"form-input\" style=\"flex:1;padding:0.65rem 0.9rem;\" onchange=\"window.changePracticalTerm(this.value)\">\n          " + window.TERMS.filter(v201 => !v201.toLowerCase().includes("mid")).map(v202 => "<option value=\"" + v202 + "\" " + (v202 === v191 ? "selected" : "") + ">" + v202 + "</option>").join("") + "\n        </select>\n      </div>\n      <div id=\"practical-marks-status\" style=\"display:none;font-size:0.75rem;color:var(--primary);font-weight:600;text-align:center;padding:0.4rem;background:var(--primary-light);border-radius:8px;margin-bottom:0.75rem;\">Saving...</div>\n      " + (v189.length === 0 ? "<div class=\"empty-state\"><p>No students found for this class.</p></div>" : "") + "\n      " + v189.map(v203 => {
      const v204 = v190[v191] && v190[v191][v203.id] ? v190[v191][v203.id] : {};
      const v205 = v187.reduce((v208, v209) => v208 + (v204[v209] && v204[v209].total_practical_score !== undefined ? parseFloat(v204[v209].total_practical_score) : 0), 0);
      const v206 = v187.filter(v210 => v204[v210] && v204[v210].total_practical_score !== undefined);
      const v207 = v206.length > 0 ? v206.reduce((v211, v212) => v211 + parseFloat(v204[v212].total_practical_score), 0) / v206.length : 0;
      return "<div class=\"card\" style=\"margin-bottom:1rem\">\n          <div style=\"display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem\">\n            <div style=\"display:flex;align-items:center;gap:0.6rem\">\n              <div class=\"avatar\" style=\"width:36px;height:36px;font-size:0.9rem\">" + (v203.photo ? "<img src=\"" + v203.photo + "\" loading=\"lazy\" decoding=\"async\">" : "" + escapeHtml(v203.name.charAt(0))) + "</div>\n              <div><h3 style=\"font-size:0.9rem\">" + escapeHtml(v203.name) + "</h3><p style=\"font-size:0.72rem\">Roll: " + escapeHtml(v203.roll) + "</p></div>\n            </div>\n            <div style=\"text-align:right\"><div style=\"font-weight:800;color:var(--primary)\">" + v207.toFixed(1) + "/" + v186 + "</div><div style=\"font-size:0.7rem;color:var(--text-muted)\">Average</div></div>\n          </div>\n          <div style=\"overflow-x:auto;padding-bottom:0.25rem;\">\n            <div style=\"display:flex;gap:0.5rem;min-width:max-content\">\n              " + v187.map((v213, v214) => {
        const v215 = window.SUBJECT_COLORS[v214 % window.SUBJECT_COLORS.length] || "#4f46e5";
        const v216 = v204[v213] || {};
        const v217 = v216.total_practical_score !== undefined ? parseFloat(v216.total_practical_score).toFixed(1) : "—";
        return "<div style=\"text-align:center;width:75px\">\n                  <div style=\"font-size:0.65rem;color:" + v215 + ";font-weight:700;margin-bottom:3px\">" + escapeHtml(v213.substring(0, 5).toUpperCase()) + "</div>\n                  <button class=\"marks-input\" \n                    onclick=\"window.openEvaluateModal('" + v203.id + "','" + escapeHtml(v213) + "')\" \n                    style=\"border: 1px solid " + v215 + "33; width:100%; font-size:0.9rem; text-align:center; padding:0.4rem 0; background: white; border-radius: 4px; cursor: pointer; min-height: 38px;\">\n                    " + v217 + "\n                  </button>\n                </div>";
      }).join("") + "\n            </div>\n          </div>\n        </div>";
    }).join("") + "\n    </div>";
  },
  more: () => {
    const v218 = getTeacherAssignments();
    const v219 = v218.isAdmin ? window.CLASS_OPTIONS : v218.assignments.map(v221 => v221.className);
    const v220 = v219.some(v222 => v222.match(/grade\s*[1-5]$/i) || v222.match(/^class\s*[1-5]$/i) || ["PG", "Nursery", "LKG", "UKG"].includes(v222));
    return "<div class=\"view\">\n      <div class=\"section-header\">\n        <h2>More Options</h2>\n      </div>\n      <div class=\"quick-grid\" style=\"grid-template-columns: 1fr 1fr; gap:1rem;\">\n        <div class=\"quick-card\" onclick=\"switchView('students')\" style=\"padding:1.5rem 1rem; border-radius:16px;\">\n          <div class=\"quick-icon\" style=\"background:#fef3c7; width:48px; height:48px; margin-bottom:0.75rem;\"><i data-lucide=\"users\" style=\"color:#d97706; width:24px; height:24px;\"></i></div>\n          <h3 style=\"font-size:1rem; margin-bottom:0.25rem;\">Students</h3>\n          <p style=\"font-size:0.7rem; opacity:0.7;\">Profiles & Search</p>\n        </div>\n        <div class=\"quick-card\" onclick=\"switchView('performance')\" style=\"padding:1.5rem 1rem; border-radius:16px;\">\n          <div class=\"quick-icon\" style=\"background:#fce7f3; width:48px; height:48px; margin-bottom:0.75rem;\"><i data-lucide=\"bar-chart-3\" style=\"color:#ec4899; width:24px; height:24px;\"></i></div>\n          <h3 style=\"font-size:1rem; margin-bottom:0.25rem;\">Marks</h3>\n          <p style=\"font-size:0.7rem; opacity:0.7;\">Result Entry</p>\n        </div>\n        <div class=\"quick-card\" onclick=\"switchView('routine')\" style=\"padding:1.5rem 1rem; border-radius:16px;\">\n          <div class=\"quick-icon\" style=\"background:#e0f2fe; width:48px; height:48px; margin-bottom:0.75rem;\"><i data-lucide=\"calendar\" style=\"color:#0369a1; width:24px; height:24px;\"></i></div>\n          <h3 style=\"font-size:1rem; margin-bottom:0.25rem;\">Routine</h3>\n          <p style=\"font-size:0.7rem; opacity:0.7;\">Class Schedule</p>\n        </div>\n        <div class=\"quick-card\" onclick=\"switchView('leave')\" style=\"padding:1.5rem 1rem; border-radius:16px;\">\n          <div class=\"quick-icon\" style=\"background:#fef3c7; width:48px; height:48px; margin-bottom:0.75rem;\">\n            <i data-lucide=\"file-text\" style=\"color:#d97706; width:24px; height:24px;\"></i>\n            <span id=\"badge-more-leave\" class=\"badge-notify\" style=\"top:-5px; right:-5px; display:none;\"></span>\n          </div>\n          <h3 style=\"font-size:1rem; margin-bottom:0.25rem;\">Leave</h3>\n          <p style=\"font-size:0.7rem; opacity:0.7;\">Requests</p>\n        </div>\n        " + (v220 ? "\n        <div class=\"quick-card\" onclick=\"switchView('cas')\" style=\"padding:1.5rem 1rem; border-radius:16px;\">\n          <div class=\"quick-icon\" style=\"background:#e0e7ff; width:48px; height:48px; margin-bottom:0.75rem;\"><i data-lucide=\"award\" style=\"color:#4338ca; width:24px; height:24px;\"></i></div>\n          <h3 style=\"font-size:1rem; margin-bottom:0.25rem;\">CAS</h3>\n          <p style=\"font-size:0.7rem; opacity:0.7;\">Class 1-5 Eval</p>\n        </div>\n        " : "") + "\n      </div>\n      \n      <div class=\"card\" style=\"margin-top:2rem; padding:1rem; background:var(--primary-light); border:none; border-radius:12px; display:flex; align-items:center; gap:1rem;\">\n        <div style=\"background:white; width:40px; height:40px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:var(--primary);\">\n            <i data-lucide=\"info\" style=\"width:20px; height:20px;\"></i>\n        </div>\n        <div>\n            <p style=\"font-weight:700; font-size:0.85rem; color:var(--primary);\">Support & Manual</p>\n            <p style=\"font-size:0.7rem; color:var(--primary); opacity:0.8;\">Need help? Contact Admin.</p>\n        </div>\n      </div>\n\n      <div style=\"margin-top:2rem; padding:1rem 0; text-align:center; border-top:1px solid #e2e8f0;\">\n        <p style=\"font-size:0.7rem; color:var(--text-muted); font-weight:500; margin:0;\">\n          System designed & developed by<br>\n          <strong style=\"color:var(--text-main); font-weight:700;\">Rexsh K Suwal</strong>, Computer Engineer\n        </p>\n      </div>\n    </div>";
  },
  cas: () => {
    setTimeout(() => {
      if (window.initTeacherCASData) {
        window.initTeacherCASData();
      }
    }, 0);
    return `<div class="view">
        <div class="back-row" onclick="switchView('more')" style="margin-bottom:1rem; cursor:pointer;">
            <i data-lucide="arrow-left" style="width:20px;height:20px;color:var(--text-muted)"></i>
            <h2 style="font-size:1.1rem;margin:0;margin-left:0.5rem">Continuous Assessment (CAS)</h2>
        </div>
        
        <div class="tabs" style="margin-bottom: 1rem; border-bottom: 1px solid #e2e8f0; display: flex; gap: 1rem;">
            <div id="tab-cas-cdc" class="tab active" onclick="window.switchTeacherCasMode('cdc')" style="padding: 0.5rem 1rem; cursor: pointer; border-bottom: 2px solid var(--primary); font-weight: 700; color: var(--primary);">CDC Evaluation</div>
            <div id="tab-cas-weekly" class="tab" onclick="window.switchTeacherCasMode('weekly')" style="padding: 0.5rem 1rem; cursor: pointer; font-weight: 500; color: var(--text-muted);">Weekly Rubric</div>
        </div>

        <div class="card" style="margin-bottom:1rem;">
            <div style="display:flex; gap:0.5rem; margin-bottom:0.75rem;">
                <select id="cas-class" class="form-input" style="flex:1;" onchange="window.onTeacherCasClassChange()"></select>
                <select id="cas-student" class="form-input" style="flex:1;" onchange="window.loadTeacherCASData()">
                    <option value="">-- Student --</option>
                </select>
                <select id="cas-term" class="form-input" style="flex:1;" onchange="window.loadTeacherCASData()">
                    <option value="First Term">First Term</option>
                    <option value="Second Term">Second Term</option>
                    <option value="Final Term">Final Term</option>
                </select>
            </div>
            <div id="cas-cdc-filters" style="display:flex; gap:0.5rem; margin-bottom:0.75rem;">
                <select id="cas-subject" class="form-input" style="flex:1;" onchange="window.onTeacherCasSubjectChange()">
                    <option value="">-- Subject --</option>
                </select>
                <select id="cas-theme" class="form-input" style="flex:1;" onchange="window.loadTeacherCASData()">
                    <option value="">-- Theme --</option>
                </select>
            </div>
        </div>
        
        <div id="cas-content-wrap">
            <div style="text-align:center; padding:2rem; color:var(--text-muted); font-size:0.85rem;">
                Please select Class, Student, and Term to load evaluations.
            </div>
        </div>
    </div>`;
  }
};
window.openComposeMessageModal = function () {
  const v223 = getTeacherAssignments();
  const v224 = v223.isAdmin ? window.CLASS_OPTIONS : v223.assignments.map(v225 => v225.className);
  window.openModal("\n        <div class=\"modal-handle\"></div>\n        <p class=\"modal-title\">New Message</p>\n        \n        <div class=\"form-group\">\n            <label class=\"form-label\">Message Type</label>\n            <select class=\"form-input\" id=\"msg-target-type\" onchange=\"window.updateMessageTargetOptions(this.value)\">\n                <option value=\"class\">Message to Whole Class</option>\n                <option value=\"individual\">Message to Individual Student</option>\n            </select>\n        </div>\n\n        <div id=\"msg-selection-container\">\n            <!-- This will be populated by updateMessageTargetOptions -->\n        </div>\n\n        <div class=\"form-group\">\n            <label class=\"form-label\">Subject</label>\n            <input type=\"text\" class=\"form-input\" id=\"msg-subject\" placeholder=\"e.g. Tomorrow's Holiday\">\n        </div>\n\n        <div class=\"form-group\">\n            <label class=\"form-label\">Message Body</label>\n            <textarea class=\"form-input\" id=\"msg-body\" style=\"height:120px\" placeholder=\"Type your message here...\"></textarea>\n        </div>\n\n        <button class=\"btn btn-primary btn-block\" onclick=\"window.sendMessage()\">\n            <i data-lucide=\"send\"></i> Send Message\n        </button>\n    ");
  window.updateMessageTargetOptions = function (v226) {
    const v227 = document.getElementById("msg-selection-container");
    if (!v227) {
      return;
    }
    if (v226 === "class") {
      v227.innerHTML = "\n                <div class=\"form-group\">\n                    <label class=\"form-label\">Select Class</label>\n                    <select class=\"form-input\" id=\"msg-target-value\">\n                        " + v224.map(v228 => "<option value=\"" + v228 + "\">" + v228 + "</option>").join("") + "\n                    </select>\n                </div>";
    } else {
      v227.innerHTML = "\n                <div class=\"form-group\">\n                    <label class=\"form-label\">First, Select Class</label>\n                    <select class=\"form-input\" id=\"msg-temp-class\" onchange=\"window.updateStudentListForClass(this.value)\">\n                        <option value=\"\">-- Choose Class --</option>\n                        " + v224.map(v229 => "<option value=\"" + v229 + "\">" + v229 + "</option>").join("") + "\n                    </select>\n                </div>\n                <div class=\"form-group\" id=\"msg-student-selection\" style=\"display:none\">\n                    <label class=\"form-label\">Then, Select Student</label>\n                    <select class=\"form-input\" id=\"msg-target-value\">\n                        <!-- Populated dynamically -->\n                    </select>\n                </div>";
    }
    if (window.lucide) {
      lucide.createIcons();
    }
  };
  window.updateStudentListForClass = function (v230) {
    const v231 = document.getElementById("msg-student-selection");
    const v232 = document.getElementById("msg-target-value");
    if (!v230) {
      if (v231) {
        v231.style.display = "none";
      }
      return;
    }
    const v233 = window.state.students.filter(v234 => v234.class === v230);
    if (v232) {
      v232.innerHTML = v233.map(v235 => "<option value=\"" + v235.id + "\">" + escapeHtml(v235.name) + " (Roll: " + v235.roll + ")</option>").join("");
      if (v233.length === 0) {
        v232.innerHTML = "<option value=\"\">No students in this class</option>";
      }
    }
    if (v231) {
      v231.style.display = "block";
    }
  };
  window.updateMessageTargetOptions("class");
};
window.showAttHistory = function () {
  const v236 = Object.keys(window.state.attendance).sort().reverse().slice(0, 14);
  let v237 = window.state.students;
  if (window.state.selectedAttClass !== "All") {
    v237 = v237.filter(v239 => String(v239.class || "").trim().toLowerCase() === String(window.state.selectedAttClass || "").trim().toLowerCase());
  }
  const v238 = new Set(v237.map(v240 => v240.id));
  window.openModal("\n    <div class=\"modal-handle\"></div>\n    <p class=\"modal-title\">Attendance History (" + (window.state.selectedAttClass !== "All" ? escapeHtml(window.state.selectedAttClass) : "All Classes") + ")</p>\n    " + (v236.length === 0 ? "<p style=\"text-align:center;padding:2rem\">No attendance records yet.</p>" : "") + "\n    " + v236.map(v241 => {
    const v242 = window.state.attendance[v241] || {};
    let v243 = 0;
    let v244 = 0;
    let v245 = 0;
    Object.keys(v242).forEach(v246 => {
      if (v238.has(v246)) {
        if (v242[v246] === "P") {
          v243++;
        } else if (v242[v246] === "A") {
          v244++;
        } else if (v242[v246] === "L") {
          v245++;
        }
      }
    });
    if (v243 === 0 && v244 === 0 && v245 === 0) {
      return "";
    }
    return "<div style=\"display:flex;justify-content:space-between;align-items:center;padding:0.6rem 0;border-bottom:1px solid #f1f5f9\">\n        <span style=\"font-size:0.85rem;font-weight:600\">" + window.formatDateLabel(v241) + "</span>\n        <div style=\"display:flex;gap:0.4rem\">\n          " + (v243 ? "<span class=\"badge badge-p\">" + v243 + "P</span>" : "") + "\n          " + (v244 ? "<span class=\"badge badge-a\">" + v244 + "A</span>" : "") + "\n          " + (v245 ? "<span class=\"badge badge-l\">" + v245 + "L</span>" : "") + "\n        </div>\n      </div>";
  }).join("") + "\n  ");
};
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".nav-item").forEach(v260 => {
    v260.addEventListener("click", v261 => {
      v261.preventDefault();
      if (typeof window.switchView === "function") {
        window.switchView(v260.dataset.view);
      }
    });
  });
  document.querySelectorAll(".nav-icon").forEach(v262 => {
    const v263 = document.createElement("div");
    v263.className = "nav-icon-wrap";
    v262.parentNode.insertBefore(v263, v262);
    v263.appendChild(v262);
  });
  if (window.setupInstallButton) {
    window.setupInstallButton();
  }
  // Re-attach CAS panel functions that were set by cas-config.js before this
  // module ran and overwrote window.views. They are kept as direct window globals.
  if (window.casWeeklyRubricPanel) {
    window.views.casWeeklyRubricPanel = window.casWeeklyRubricPanel;
  }
  if (window.renderRubricButtonMatrix) {
    window.views.renderRubricButtonMatrix = window.renderRubricButtonMatrix;
  }
});