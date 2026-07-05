import v1 from "./supabase.js";
import { validateSession, logout, openModal, closeModal, toast, escapeHtml, sortClassList, formatDateLabel, getLocalToday, initNepaliDatePicker } from "./shared.js";
window.supabaseClient = v1;
let allStudents = [];
let allFees = [];
let allParents = [];
let allTransactions = [];
let allExpenditures = [];
let currentTab = "dashboard";
document.addEventListener("DOMContentLoaded", async () => {
  const v2 = await validateSession();
  if (!v2) {
    return;
  }
  window.currentUserId = v2.user.id;
  try {
    const v3 = v2.user.id;
    const v4 = window.currentUserProfile || (await v1.from("profiles").select("role").eq("id", v3).single()).data;
    if (!v4 || v4.role !== "accountant" && v4.role !== "admin") {
      toast("Access denied: Accountant role required.");
      setTimeout(() => window.location.href = "login.html", 1500);
      return;
    }
    setupTabSwitching();
    window.switchTab("dashboard", false);
    history.replaceState({
      tab: "dashboard"
    }, "");
    const v5 = document.getElementById("splash-screen");
    if (v5) {
      v5.style.opacity = "0";
      setTimeout(() => v5.remove(), 300);
    }
    loadInitialData();
    if (window.initNepaliDatePicker) {
      window.initNepaliDatePicker(".nepali-date-picker");
    }
    setTimeout(() => {
      if (window.updateNotificationBadges) {
        window.updateNotificationBadges();
      }
      if (window.initNotificationSubscription) {
        window.initNotificationSubscription();
      }
    }, 1000);
    lucide.createIcons();
  } catch (v6) {
    console.error("Initialization error:", v6);
    toast("Error connecting to server.");
    const v7 = document.getElementById("splash-screen");
    if (v7) {
      v7.remove();
    }
  }
});
async function safeQuery(v8) {
  try {
    const {
      data: v9,
      error: v10
    } = await v8;
    if (v10) {
      throw v10;
    }
    return v9 || [];
  } catch (v11) {
    console.error("safeQuery failed:", v11);
    return [];
  }
}
async function loadInitialData() {
  try {
    const [v12, v13, v14, v15, v16] = await Promise.all([safeQuery(v1.from("students").select("id, name, class, roll")), safeQuery(v1.from("fees").select("id, student_id, term_or_month, total_fee, paid_amount, status, due_date, bill_no, created_at").order("created_at", {
      ascending: false
    }).limit(500)), safeQuery(v1.from("transactions").select("id, student_id, fee_id, amount, payment_method, description, voucher_no, created_at").order("created_at", {
      ascending: false
    }).limit(200)), safeQuery(v1.from("expenditures").select("id, category, amount, description, paid_to, payment_method, date, recorded_by").order("date", {
      ascending: false
    }).limit(200)), v1.from("profiles").select("id, full_name, mobile, assigned_classes, can_view_portal, can_view_marks").eq("role", "parent").then(v17 => v17.data || [])]);
    allStudents = v12;
    allFees = v13;
    allTransactions = v14;
    allExpenditures = v15;
    allParents = v16;
    renderCurrentTab();
    document.getElementById("student-search")?.addEventListener("input", renderStudents);
    document.getElementById("parent-search")?.addEventListener("input", renderParents);
  } catch (v18) {
    console.error("Load error:", v18);
    toast("Failed to load some data.");
  }
}
window.renderCurrentTab = function () {
  if (currentTab === "dashboard") {
    renderDashboard();
  }
  if (currentTab === "fees") {
    renderStudents();
  }
  if (currentTab === "expenses") {
    renderExpenditure();
  }
  if (currentTab === "salary") {
    window.renderSalaryGrid();
  }
  if (currentTab === "parents") {
    renderParents();
  }
  if (currentTab === "messages") {
    renderMessages();
  }
  if (currentTab === "reports") {
    window.loadAuditLedger();
  }
  lucide.createIcons();
};
window.switchTab = function (v19, v20 = true) {
  if (v20 && currentTab !== v19) {
    history.pushState({
      tab: v19
    }, "");
  }
  currentTab = v19;
  const v21 = document.getElementById("nav-item-more");
  const v22 = v21 && window.getComputedStyle(v21).display !== "none";
  const v23 = v22 && ["parents", "reports", "more"].includes(v19) ? "more" : v19;
  document.querySelectorAll(".nav-item").forEach(v26 => {
    v26.classList.toggle("active", v26.dataset.tab === v23);
  });
  document.querySelectorAll(".tab-content").forEach(v27 => {
    v27.classList.toggle("active", v27.id === "tab-" + v19);
  });
  const v24 = {
    dashboard: "Accountant Dashboard",
    fees: "Student Fees & Collections",
    expenses: "Expenditure Ledger",
    salary: "Salary Distribution Voucher",
    messages: "School Announcements",
    parents: "Parent Accounts",
    reports: "Financial Reports",
    more: "More Options"
  };
  const v25 = document.getElementById("view-title");
  if (v25) {
    v25.textContent = v24[v19] || "Accountant Portal";
  }
  if (v19 === "messages") {
    const v28 = document.getElementById("badge-messages");
    if (v28) {
      v28.style.display = "none";
    }
    if (window.currentUserId) {
      localStorage.setItem("msg_last_read_" + window.currentUserId, new Date().toISOString());
    }
  }
  renderCurrentTab();
};
window.addEventListener("popstate", v29 => {
  if (window.ignoreNextPopstate) {
    window.ignoreNextPopstate = false;
    return;
  }
  const v30 = document.getElementById("modal-overlay");
  if (v30 && v30.classList.contains("open")) {
    return;
  }
  const v31 = v29.state;
  if (v31 && v31.tab) {
    window.switchTab(v31.tab, false);
  } else {
    window.switchTab("dashboard", false);
  }
});
function setupTabSwitching() {
  document.querySelectorAll(".nav-item").forEach(v32 => {
    v32.addEventListener("click", v33 => {
      v33.preventDefault();
      const v34 = v32.dataset.tab;
      window.switchTab(v34);
    });
  });
}
function isSystemConfigRow(v35) {
  if (!v35) {
    return false;
  }
  const v36 = v35.paid_to === "Global Manual Staff List";
  const v37 = v35.category === "Staff Config" || v35.paid_to === "Staff Profiles Configuration" || v35.description && v35.description.startsWith("[Staff Profiles Config]");
  const v38 = Number(v35.amount) === 0 && (v35.category === "Staff Config" || v35.category === "Salary");
  return v36 || v37 || v38;
}
function renderDashboard() {
  const v39 = new Date().toISOString().split("T")[0];
  const v40 = allTransactions.filter(v52 => v52.created_at.startsWith(v39)).reduce((v53, v54) => v53 + Number(v54.amount || 0), 0);
  const v41 = new Date();
  v41.setDate(1);
  const v42 = v41.toISOString().split("T")[0];
  const v43 = allTransactions.filter(v55 => v55.created_at >= v42).reduce((v56, v57) => v56 + Number(v57.amount || 0), 0);
  const v44 = allExpenditures.filter(v58 => {
    const v59 = Number(v58.amount) === 300;
    return !isSystemConfigRow(v58) && !v59;
  });
  const v45 = v44.filter(v60 => v60.date >= v42).reduce((v61, v62) => v61 + Number(v62.amount || 0), 0);
  const v46 = allFees.reduce((v63, v64) => v63 + ((v64.total_fee || 0) - (v64.paid_amount || 0)), 0);
  const v47 = document.getElementById("today-collection");
  if (v47) {
    v47.innerText = "Rs. " + v40.toLocaleString();
  }
  const v48 = document.getElementById("month-collection");
  if (v48) {
    v48.innerText = "Rs. " + v43.toLocaleString();
  }
  const v49 = document.getElementById("month-expenditure");
  if (v49) {
    if (v45 > 0) {
      v49.innerText = "Rs. " + v45.toLocaleString();
      v49.style.display = "";
    } else {
      v49.innerText = "";
      v49.style.display = "none";
    }
  }
  const v50 = document.getElementById("total-outstanding");
  if (v50) {
    v50.innerText = "Rs. " + v46.toLocaleString();
  }
  const v51 = document.getElementById("recent-transactions-list");
  if (v51) {
    if (allTransactions.length === 0) {
      v51.innerHTML = "<tr><td colspan=\"5\" style=\"padding:2rem; text-align:center; color:var(--text-muted);\">No transactions recorded yet.</td></tr>";
    } else {
      v51.innerHTML = allTransactions.slice(0, 3).map(v65 => {
        const v66 = allStudents.find(v67 => v67.id === v65.student_id);
        return "\n                    <tr style=\"border-bottom:1px solid #f1f5f9;\">\n                        <td style=\"padding:0.75rem 1rem;\">" + formatDateLabel(v65.created_at.split("T")[0]) + "</td>\n                        <td style=\"padding:0.75rem 1rem; font-weight:600;\">" + escapeHtml(v66?.name || "Unknown") + "</td>\n                        <td style=\"padding:0.75rem 1rem;\" class=\"hide-mobile\"><span style=\"background:#f1f5f9; padding:0.2rem 0.5rem; border-radius:4px; font-family:monospace;\">VCH-" + (v65.voucher_no || "000") + "</span></td>\n                        <td style=\"padding:0.75rem 1rem; text-align:right; font-weight:700; color:#16a34a;\">Rs. " + v65.amount + "</td>\n                        <td style=\"padding:0.75rem 1rem; text-align:right;\">\n                            <button class=\"btn btn-secondary btn-icon\" style=\"width:28px; height:28px; padding:0; display:inline-flex; align-items:center; justify-content:center;\" onclick=\"window.printReceipt('" + v65.fee_id + "', '" + v65.student_id + "', '" + v65.id + "')\" title=\"Print Receipt\">\n                                <i data-lucide=\"printer\" style=\"width:12px; height:12px;\"></i>\n                            </button>\n                        </td>\n                    </tr>\n                ";
      }).join("");
    }
  }
}
function renderExpenditure() {
  const v68 = document.getElementById("expenditure-list");
  if (!v68) {
    return;
  }
  const v69 = allExpenditures.filter(v70 => !isSystemConfigRow(v70));
  if (v69.length === 0) {
    v68.innerHTML = "<tr><td colspan=\"4\" style=\"padding:2rem; text-align:center; color:var(--text-muted);\">No expenses recorded yet.</td></tr>";
    return;
  }
  v68.innerHTML = v69.map(v71 => {
    let v72 = escapeHtml(v71.description || "-");
    let v73 = "";
    if (v71.category === "Salary" && v71.description && v71.description.startsWith("[Salary Voucher:")) {
      const v74 = v71.description.split(" JSON:")[0];
      const v75 = v74.replace("[", "").replace("]", "");
      v72 = "<span style=\"display:inline-flex; align-items:center; gap:0.4rem; font-weight:600; color:var(--primary);\"><i data-lucide=\"wallet\" style=\"width:14px; height:14px; margin-right:4px;\"></i> " + escapeHtml(v75) + "</span>";
      v73 = "\n                <button class=\"btn btn-secondary btn-icon\" style=\"width:26px; height:26px; padding:0; display:inline-flex; align-items:center; justify-content:center; margin-right:4px;\" onclick=\"window.reprintSalaryVoucher('" + v71.id + "')\" title=\"Print Salary Voucher\">\n                    <i data-lucide=\"printer\" style=\"width:12px; height:12px;\"></i>\n                </button>\n            ";
    }
    return "\n            <tr style=\"border-bottom:1px solid #f1f5f9;\">\n                <td style=\"padding:0.75rem 1rem;\">" + formatDateLabel(v71.date) + "</td>\n                <td style=\"padding:0.75rem 1rem;\"><span style=\"background:var(--primary-light); color:var(--primary); padding:0.2rem 0.5rem; border-radius:4px; font-size:0.75rem; font-weight:600;\">" + escapeHtml(v71.category) + "</span></td>\n                <td style=\"padding:0.75rem 1rem;\">\n                    <div style=\"display:flex; align-items:center; justify-content:space-between; gap: 0.5rem;\">\n                        <span>" + v72 + "</span>\n                        <div style=\"display:flex; align-items:center; gap:0.25rem;\">\n                            " + v73 + "\n                            <button class=\"btn btn-secondary btn-icon\" style=\"width:26px; height:26px; padding:0; display:inline-flex; align-items:center; justify-content:center; color:var(--error); background:var(--error-light); border:none;\" onclick=\"window.deleteExpense('" + v71.id + "')\" title=\"Erase Expense\">\n                                <i data-lucide=\"trash-2\" style=\"width:12px; height:12px;\"></i>\n                            </button>\n                        </div>\n                    </div>\n                </td>\n                <td style=\"padding:0.75rem 1rem; text-align:right; font-weight:700; color:#dc2626;\">Rs. " + Number(v71.amount || 0).toLocaleString() + "</td>\n            </tr>\n        ";
  }).join("");
  lucide.createIcons();
}
window.deleteExpense = async function (v76) {
  if (!confirm("Are you sure you want to erase this expense record? This action cannot be undone.")) {
    return;
  }
  try {
    toast("Erasing expense record...");
    const {
      error: v77
    } = await v1.from("expenditures").delete().eq("id", v76);
    if (v77) {
      throw v77;
    }
    toast("✅ Expense record erased successfully!");
    await loadInitialData();
  } catch (v78) {
    console.error("Delete expense error:", v78);
    toast("Error erasing expense: " + v78.message);
  }
};
window.reprintSalaryVoucher = function (v79) {
  const v80 = allExpenditures.find(v81 => v81.id === v79);
  if (!v80 || !v80.description) {
    return;
  }
  try {
    const v82 = v80.description.substring(v80.description.indexOf("JSON:") + 5);
    const v83 = JSON.parse(v82);
    if (v83 && v83.rows) {
      salaryState.rows = v83.rows.filter(v88 => {
        const v89 = (v88.name || "").toLowerCase();
        const v90 = (v88.post || "").toLowerCase();
        return !v89.includes("super admin") && !v89.includes("administrator") && !v89.includes("admin account") && !v89.includes("accountant") && !v90.includes("admin") && !v90.includes("accountant");
      });
      const v84 = v80.description.split(" JSON:")[0];
      const v85 = v84.replace("[", "").replace("]", "").split(" ");
      salaryState.year = v85[2] || "2083";
      salaryState.month = v85[3] || "Baisakh";
      const v86 = document.getElementById("salary-year");
      const v87 = document.getElementById("salary-month");
      if (v86) {
        v86.value = salaryState.year;
      }
      if (v87) {
        v87.value = salaryState.month;
      }
      window.printSalaryVoucher();
    }
  } catch (v91) {
    console.error("Reprint error:", v91);
    toast("Failed to parse salary details: " + v91.message);
  }
};
window.openAddExpenseModal = function () {
  const v92 = ["Salary", "Rent", "Utilities", "Stationery", "Maintenance", "Marketing", "Miscellaneous"];
  openModal("\n        <div class=\"modal-handle\"></div>\n        <p class=\"modal-title\">Record New Expense</p>\n        <div class=\"form-group\">\n            <label class=\"form-label\">Category</label>\n            <select id=\"exp-category\" class=\"form-input\">\n                " + v92.map(v93 => "<option value=\"" + v93 + "\">" + v93 + "</option>").join("") + "\n            </select>\n        </div>\n        <div class=\"form-group\">\n            <label class=\"form-label\">Amount (Rs.)</label>\n            <input type=\"number\" id=\"exp-amount\" class=\"form-input\" placeholder=\"0.00\">\n        </div>\n        <div class=\"form-group\">\n            <label class=\"form-label\">Description</label>\n            <input type=\"text\" id=\"exp-desc\" class=\"form-input\" placeholder=\"Details about expense...\">\n        </div>\n        <div class=\"form-group\">\n            <label class=\"form-label\">Paid To</label>\n            <input type=\"text\" id=\"exp-paid-to\" class=\"form-input\" placeholder=\"Recipient name...\">\n        </div>\n        <button class=\"btn btn-primary btn-block\" onclick=\"window.submitExpense()\">Save Expense</button>\n        <button class=\"btn btn-ghost btn-block\" style=\"margin-top:0.5rem\" onclick=\"closeModal()\">Cancel</button>\n    ");
};
window.submitExpense = async function () {
  const v94 = document.getElementById("exp-category").value;
  const v95 = Number(document.getElementById("exp-amount").value);
  const v96 = document.getElementById("exp-desc").value;
  const v97 = document.getElementById("exp-paid-to").value;
  if (!v95 || v95 <= 0) {
    toast("Please enter a valid amount.");
    return;
  }
  try {
    toast("Saving expense...");
    const {
      error: v98
    } = await v1.from("expenditures").insert({
      category: v94,
      amount: v95,
      description: v96,
      paid_to: v97,
      recorded_by: window.currentUserProfile?.id
    });
    if (v98) {
      throw v98;
    }
    toast("✅ Expense recorded!");
    closeModal();
    await loadInitialData();
  } catch (v99) {
    toast("Error: " + v99.message);
  }
};
window.loadAuditLedger = function () {
  const v100 = document.getElementById("audit-ledger-list");
  if (!v100) {
    return;
  }
  let v101 = document.getElementById("audit-start-date").value;
  let v102 = document.getElementById("audit-end-date").value;
  if (!v101 && !v102) {
    if (window.NepaliFunctions) {
      const v105 = window.NepaliFunctions.BS.GetCurrentDate();
      const v106 = String(v105.month).padStart(2, "0");
      const v107 = String(window.NepaliFunctions.BS.GetDaysInMonth(v105.year, v105.month)).padStart(2, "0");
      v101 = v105.year + "-" + v106 + "-01";
      v102 = v105.year + "-" + v106 + "-" + v107;
    } else {
      const v108 = new Date();
      v101 = new Date(v108.getFullYear(), v108.getMonth(), 1).toISOString().split("T")[0];
      v102 = new Date(v108.getFullYear(), v108.getMonth() + 1, 0).toISOString().split("T")[0];
    }
    document.getElementById("audit-start-date").value = v101;
    document.getElementById("audit-end-date").value = v102;
  }
  let v103 = v101;
  let v104 = v102;
  if (window.NepaliFunctions) {
    v103 = window.NepaliFunctions.BS2AD(v101, "YYYY-MM-DD", "YYYY-MM-DD") || v101;
    v104 = window.NepaliFunctions.BS2AD(v102, "YYYY-MM-DD", "YYYY-MM-DD") || v102;
  }
  v100.innerHTML = "<tr><td colspan=\"6\" style=\"padding:2rem; text-align:center; color:var(--text-muted);\">Generating Audit Ledger...</td></tr>";
  setTimeout(() => {
    let v109 = [];
    let v110 = 0;
    let v111 = 0;
    const v112 = allTransactions.filter(v116 => {
      const v117 = v116.created_at.split("T")[0];
      return (!v103 || v117 >= v103) && (!v104 || v117 <= v104);
    });
    v112.forEach(v118 => {
      const v119 = allStudents.find(v122 => v122.id === v118.student_id);
      const v120 = allFees.find(v123 => v123.id === v118.fee_id);
      const v121 = Number(v118.amount || 0);
      v110 += v121;
      v109.push({
        date: v118.created_at,
        dateStr: v118.created_at.split("T")[0],
        ref: "VCH-" + (v118.voucher_no || "N/A"),
        particulars: "Fee Collection: " + (v119?.name || "Unknown") + " (" + (v120?.term_or_month || "N/A") + ") via " + v118.payment_method,
        income: v121,
        expense: 0
      });
    });
    const v113 = allExpenditures.filter(v124 => {
      const v125 = v124.date.split("T")[0];
      if (isSystemConfigRow(v124)) {
        return false;
      }
      return (!v103 || v125 >= v103) && (!v104 || v125 <= v104);
    });
    v113.forEach(v126 => {
      const v127 = Number(v126.amount || 0);
      v111 += v127;
      v109.push({
        date: v126.date,
        dateStr: v126.date.split("T")[0],
        ref: "EXP-" + v126.id.substring(0, 6).toUpperCase(),
        particulars: "Expense [" + v126.category + "]: " + (v126.description || "-") + " (Paid to: " + (v126.paid_to || "-") + ")",
        income: 0,
        expense: v127
      });
    });
    v109.sort((v128, v129) => new Date(v128.date) - new Date(v129.date));
    if (v109.length === 0) {
      v100.innerHTML = "<tr><td colspan=\"6\" style=\"padding:2rem; text-align:center; color:var(--text-muted);\">No transactions found for the selected date range.</td></tr>";
    } else {
      let v130 = 0;
      v109.forEach(v132 => {
        v130 += v132.income;
        v130 -= v132.expense;
        v132.runningBalance = v130;
      });
      const v131 = [...v109].reverse();
      v100.innerHTML = v131.map(v133 => {
        return "\n                    <tr style=\"border-bottom:1px solid #f1f5f9;\">\n                        <td style=\"padding:0.75rem 1rem; font-size:0.8rem;\">" + formatDateLabel(v133.dateStr) + "</td>\n                        <td style=\"padding:0.75rem 1rem; font-family:monospace; color:var(--text-muted);\">" + v133.ref + "</td>\n                        <td style=\"padding:0.75rem 1rem; max-width:250px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;\" title=\"" + escapeHtml(v133.particulars) + "\">" + escapeHtml(v133.particulars) + "</td>\n                        <td style=\"padding:0.75rem 1rem; text-align:right; font-weight:600; color:#16a34a;\">" + (v133.income > 0 ? "Rs. " + v133.income.toLocaleString() : "-") + "</td>\n                        <td style=\"padding:0.75rem 1rem; text-align:right; font-weight:600; color:#ef4444;\">" + (v133.expense > 0 ? "Rs. " + v133.expense.toLocaleString() : "-") + "</td>\n                        <td style=\"padding:0.75rem 1rem; text-align:right; font-weight:700;\">Rs. " + v133.runningBalance.toLocaleString() + "</td>\n                    </tr>\n                ";
      }).join("");
    }
    document.getElementById("audit-total-income").innerText = "Rs. " + v110.toLocaleString();
    document.getElementById("audit-total-expense").innerText = "Rs. " + v111.toLocaleString();
    const v114 = v110 - v111;
    const v115 = document.getElementById("audit-net-balance");
    v115.innerText = "Rs. " + v114.toLocaleString();
    v115.style.color = v114 >= 0 ? "#3b82f6" : "#ef4444";
  }, 100);
};
window.exportAuditLedger = function () {
  toast("Generating Audit Ledger...");
  let v134 = document.getElementById("audit-start-date").value;
  let v135 = document.getElementById("audit-end-date").value;
  let v136 = v134;
  let v137 = v135;
  if (window.NepaliFunctions) {
    v136 = window.NepaliFunctions.BS2AD(v134, "YYYY-MM-DD", "YYYY-MM-DD") || v134;
    v137 = window.NepaliFunctions.BS2AD(v135, "YYYY-MM-DD", "YYYY-MM-DD") || v135;
  }
  let v138 = [];
  allTransactions.filter(v144 => {
    const v145 = v144.created_at.split("T")[0];
    return (!v136 || v145 >= v136) && (!v137 || v145 <= v137);
  }).forEach(v146 => {
    const v147 = allStudents.find(v149 => v149.id === v146.student_id);
    const v148 = allFees.find(v150 => v150.id === v146.fee_id);
    v138.push({
      date: v146.created_at,
      Date: new Date(v146.created_at).toLocaleDateString(),
      "Ref / Voucher": "VCH-" + (v146.voucher_no || "N/A"),
      Particulars: "Fee Collection: " + (v147?.name || "Unknown") + " (" + (v148?.term_or_month || "N/A") + ")",
      "Income (Dr)": Number(v146.amount || 0),
      "Expense (Cr)": 0
    });
  });
  allExpenditures.filter(v151 => {
    const v152 = v151.date.split("T")[0];
    if (isSystemConfigRow(v151)) {
      return false;
    }
    return (!v136 || v152 >= v136) && (!v137 || v152 <= v137);
  }).forEach(v153 => {
    v138.push({
      date: v153.date,
      Date: new Date(v153.date).toLocaleDateString(),
      "Ref / Voucher": "EXP-" + v153.id.substring(0, 6).toUpperCase(),
      Particulars: "Expense [" + v153.category + "]: " + (v153.description || "-"),
      "Income (Dr)": 0,
      "Expense (Cr)": Number(v153.amount || 0)
    });
  });
  v138.sort((v154, v155) => new Date(v154.date) - new Date(v155.date));
  let v139 = 0;
  const v140 = v138.map(v156 => {
    v139 += v156["Income (Dr)"];
    v139 -= v156["Expense (Cr)"];
    return {
      Date: v156.Date,
      "Ref / Voucher": v156["Ref / Voucher"],
      Particulars: v156.Particulars,
      "Income (Dr)": v156["Income (Dr)"] || null,
      "Expense (Cr)": v156["Expense (Cr)"] || null,
      Balance: v139
    };
  });
  if (v140.length === 0) {
    toast("No data available for export in the selected date range.");
    return;
  }
  const v141 = XLSX.utils.book_new();
  const v142 = XLSX.utils.json_to_sheet(v140);
  XLSX.utils.book_append_sheet(v141, v142, "Audit Ledger");
  const v143 = "Audit_Ledger_" + (v134 || "All") + "_to_" + (v135 || "All") + ".xlsx";
  XLSX.writeFile(v141, v143);
  toast("✅ Audit Ledger Exported!");
};
window.exportMonthlyReport = function () {
  toast("Generating Monthly Balance Sheet...");
  const v157 = allTransactions.map(v163 => {
    const v164 = allStudents.find(v166 => v166.id === v163.student_id);
    const v165 = allFees.find(v167 => v167.id === v163.fee_id);
    return {
      Date: new Date(v163.created_at).toLocaleDateString(),
      Type: "Income (Fee)",
      "Student/Category": v164?.name || "Unknown",
      Class: v164?.class ? v164.class.replace("Grade ", "") : "-",
      "Voucher No": "VCH-" + v163.voucher_no,
      Description: v165 ? v165.term_or_month : v163.description || "Fee Collection",
      "Paid To": "-",
      Method: v163.payment_method,
      "Amount (Rs.)": v163.amount
    };
  });
  const v158 = allExpenditures.filter(v168 => !isSystemConfigRow(v168)).map(v169 => ({
    Date: new Date(v169.date).toLocaleDateString(),
    Type: "Expense",
    "Student/Category": v169.category || "Expense",
    Class: "-",
    "Voucher No": "-",
    Description: v169.description || "-",
    "Paid To": v169.paid_to || "-",
    Method: v169.payment_method,
    "Amount (Rs.)": v169.amount
  }));
  const v159 = [...v157, ...v158].sort((v170, v171) => new Date(v171.Date) - new Date(v170.Date));
  const v160 = XLSX.utils.book_new();
  const v161 = XLSX.utils.json_to_sheet(v159);
  XLSX.utils.book_append_sheet(v160, v161, "Monthly Ledger");
  const v162 = "HolyGarden_BalanceSheet_" + (new Date().getMonth() + 1) + "_" + new Date().getFullYear() + ".xlsx";
  XLSX.writeFile(v160, v162);
  toast("✅ Download started!");
};
window.exportOutstandingReport = function () {
  toast("Generating Dues Report...");
  const v172 = allFees.filter(v175 => v175.total_fee - v175.paid_amount > 0).map(v176 => {
    const v177 = allStudents.find(v178 => v178.id === v176.student_id);
    return {
      "Student Name": v177?.name || "Unknown",
      Class: v177?.class || "-",
      "Roll No": v177?.roll || "-",
      "Bill Description": v176.term_or_month,
      "Total Bill (Rs.)": v176.total_fee,
      "Paid (Rs.)": v176.paid_amount,
      "Due (Rs.)": v176.total_fee - v176.paid_amount,
      "Due Date": v176.due_date || "-"
    };
  });
  const v173 = XLSX.utils.book_new();
  const v174 = XLSX.utils.json_to_sheet(v172);
  XLSX.utils.book_append_sheet(v173, v174, "Outstanding Dues");
  XLSX.writeFile(v173, "School_Dues_List_" + new Date().toISOString().split("T")[0] + ".xlsx");
  toast("✅ Dues report generated!");
};
function renderStudents() {
  const v179 = document.getElementById("students-list");
  if (!v179) {
    return;
  }
  const v180 = document.getElementById("student-search")?.value.toLowerCase() || "";
  const v181 = allStudents.filter(v182 => v182.name.toLowerCase().includes(v180) || v182.class.toLowerCase().includes(v180));
  v179.innerHTML = v181.map(v183 => {
    const v184 = allFees.filter(v186 => v186.student_id === v183.id);
    const v185 = v184.reduce((v187, v188) => v187 + ((v188.total_fee || 0) - (v188.paid_amount || 0)), 0);
    return "\n            <div class=\"card\" style=\"padding:1.25rem; display:flex; justify-content:space-between; align-items:center;\">\n                <div>\n                    <div style=\"font-weight:700; font-size:1.05rem; margin-bottom:0.25rem;\">" + escapeHtml(v183.name) + "</div>\n                    <div style=\"font-size:0.75rem; color:var(--text-muted); font-weight:600;\">\n                        Class " + escapeHtml(v183.class.replace("Grade ", "")) + " | Roll: " + v183.roll + "\n                    </div>\n                </div>\n                <div style=\"text-align:right;\">\n                    <div style=\"font-size:0.7rem; font-weight:800; color:" + (v185 > 0 ? "#dc2626" : "#10b981") + "; text-transform:uppercase;\">Due: Rs. " + v185 + "</div>\n                    <button class=\"btn btn-secondary btn-sm\" style=\"margin-top:0.5rem;\" onclick=\"window.openStudentLedgerModal('" + v183.id + "')\">\n                        <i data-lucide=\"book-open\" style=\"width:14px; height:14px; margin-right:4px;\"></i> Ledger\n                    </button>\n                </div>\n            </div>\n        ";
  }).join("");
  lucide.createIcons();
}
window.openStudentLedgerModal = async function (v189) {
  const v190 = allStudents.find(v194 => v194.id === v189);
  if (!v190) {
    return;
  }
  const {
    data: v191
  } = await v1.from("transactions").select("*").eq("student_id", v189).order("created_at", {
    ascending: false
  });
  const v192 = allFees.filter(v195 => v195.student_id === v189);
  const v193 = v192.reduce((v196, v197) => v196 + ((v197.total_fee || 0) - (v197.paid_amount || 0)), 0);
  openModal("\n        <div class=\"modal-handle\"></div>\n        <div style=\"display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.5rem;\">\n            <div>\n                <h2 style=\"color:var(--primary); margin-bottom:0.25rem;\">" + escapeHtml(v190.name) + "</h2>\n                <p style=\"font-size:0.85rem; color:var(--text-muted);\">Class " + v190.class.replace("Grade ", "") + " | Roll " + v190.roll + "</p>\n            </div>\n            <div style=\"text-align:right;\">\n                <div style=\"font-size:0.7rem; font-weight:800; color:var(--text-muted); text-transform:uppercase;\">Current Balance</div>\n                <div style=\"font-size:1.5rem; font-weight:900; color:" + (v193 > 0 ? "#dc2626" : "#16a34a") + ";\">Rs. " + v193 + "</div>\n            </div>\n        </div>\n\n        <div style=\"display:flex; gap:0.5rem; margin-bottom:1.5rem;\">\n            <button class=\"btn btn-primary\" style=\"flex:1\" onclick=\"window.openCollectPaymentModal('" + v189 + "')\">\n                <i data-lucide=\"plus\" style=\"width:16px; height:16px; margin-right:4px;\"></i> Collect Payment\n            </button>\n            <button class=\"btn btn-secondary\" style=\"flex:1\" onclick=\"window.openBillStudentModal('" + v189 + "')\">\n                <i data-lucide=\"file-plus\" style=\"width:16px; height:16px; margin-right:4px;\"></i> Create Bill\n            </button>\n        </div>\n\n        <div style=\"max-height:400px; overflow-y:auto;\">\n            <table style=\"width:100%; border-collapse:collapse; font-size:0.85rem;\">\n                <thead style=\"background:#f8fafc; border-bottom:1px solid #e2e8f0; position:sticky; top:0;\">\n                    <tr>\n                        <th style=\"padding:0.6rem; text-align:left;\">Date</th>\n                        <th style=\"padding:0.6rem; text-align:left;\">Description</th>\n                        <th style=\"padding:0.6rem; text-align:right;\">Debit</th>\n                        <th style=\"padding:0.6rem; text-align:right;\">Credit</th>\n                        <th style=\"padding:0.6rem; text-align:right;\">Action</th>\n                    </tr>\n                </thead>\n                <tbody>\n                    " + v192.map(v198 => "\n                        <tr style=\"border-bottom:1px solid #f1f5f9;\">\n                            <td style=\"padding:0.6rem;\">" + formatDateLabel(v198.created_at.split("T")[0]) + "</td>\n                            <td style=\"padding:0.6rem;\">" + escapeHtml(v198.term_or_month) + "</td>\n                            <td style=\"padding:0.6rem; text-align:right; font-weight:700;\">Rs. " + v198.total_fee + "</td>\n                            <td style=\"padding:0.6rem; text-align:right;\">-</td>\n                            <td style=\"padding:0.6rem; text-align:right;\">\n                                <button class=\"btn btn-secondary btn-icon\" style=\"width:24px; height:24px; padding:0; display:inline-flex; align-items:center; justify-content:center;\" onclick=\"window.printReceipt('" + v198.id + "', '" + v189 + "')\" title=\"Print Invoice\">\n                                    <i data-lucide=\"printer\" style=\"width:11px; height:11px;\"></i>\n                                </button>\n                                " + (v198.paid_amount === 0 ? "\n                                <button class=\"btn btn-secondary btn-icon\" style=\"width:24px; height:24px; padding:0; display:inline-flex; align-items:center; justify-content:center; color:var(--error); margin-left:4px;\" onclick=\"window.deleteBill('" + v198.id + "', '" + v189 + "')\" title=\"Delete Bill\">\n                                    <i data-lucide=\"trash-2\" style=\"width:11px; height:11px;\"></i>\n                                </button>\n                                " : "") + "\n                            </td>\n                        </tr>\n                    ").join("") + "\n                    " + (v191 || []).map(v199 => "\n                        <tr style=\"border-bottom:1px solid #f1f5f9; background:#f0fdf4;\">\n                            <td style=\"padding:0.6rem;\">" + formatDateLabel(v199.created_at.split("T")[0]) + "</td>\n                            <td style=\"padding:0.6rem; font-style:italic; color:#15803d;\">Payment: " + escapeHtml(v199.description || "N/A") + "</td>\n                            <td style=\"padding:0.6rem; text-align:right;\">-</td>\n                            <td style=\"padding:0.6rem; text-align:right; font-weight:700; color:#16a34a;\">Rs. " + v199.amount + "</td>\n                            <td style=\"padding:0.6rem; text-align:right;\">\n                                <button class=\"btn btn-secondary btn-icon\" style=\"width:24px; height:24px; padding:0; display:inline-flex; align-items:center; justify-content:center;\" onclick=\"window.printReceipt('" + v199.fee_id + "', '" + v189 + "', '" + v199.id + "')\" title=\"Print Receipt\">\n                                    <i data-lucide=\"printer\" style=\"width:11px; height:11px;\"></i>\n                                </button>\n                                <button class=\"btn btn-secondary btn-icon\" style=\"width:24px; height:24px; padding:0; display:inline-flex; align-items:center; justify-content:center; color:var(--error); margin-left:4px;\" onclick=\"window.deleteTransaction('" + v199.id + "', '" + v199.fee_id + "', '" + v189 + "')\" title=\"Delete Transaction\">\n                                    <i data-lucide=\"trash-2\" style=\"width:11px; height:11px;\"></i>\n                                </button>\n                            </td>\n                        </tr>\n                    ").join("") + "\n                </tbody>\n            </table>\n        </div>\n    ");
  lucide.createIcons();
};

window.deleteBill = async function (vBillId, vStudentId) {
  if (!confirm("Are you sure you want to delete this bill?")) return;
  try {
    toast("Deleting bill...");
    const { error: vErr } = await v1.from("fees").delete().eq("id", vBillId);
    if (vErr) throw vErr;
    toast("✅ Bill deleted successfully!");
    await loadInitialData();
    window.openStudentLedgerModal(vStudentId);
  } catch (vErr) {
    toast("Error: " + vErr.message);
  }
};

window.deleteTransaction = async function (vTxId, vFeeId, vStudentId) {
  if (!confirm("Are you sure you want to delete this transaction? This will adjust the bill paid amount.")) return;
  try {
    toast("Deleting transaction...");
    const { data: vTx, error: vTxErr } = await v1.from("transactions").select("*").eq("id", vTxId).single();
    if (vTxErr) throw vTxErr;
    if (!vTx) {
      toast("Transaction not found.");
      return;
    }
    const vAmount = Number(vTx.amount || 0);

    const { error: vDelErr } = await v1.from("transactions").delete().eq("id", vTxId);
    if (vDelErr) throw vDelErr;

    const { data: vFee, error: vFeeErr } = await v1.from("fees").select("*").eq("id", vFeeId).single();
    if (vFeeErr) throw vFeeErr;

    if (vFee) {
      const vNewPaid = Math.max(0, (vFee.paid_amount || 0) - vAmount);
      const vNewStatus = vNewPaid >= vFee.total_fee ? "Paid" : (vNewPaid > 0 ? "Partial" : "Pending");
      await v1.from("fees").update({
        paid_amount: vNewPaid,
        status: vNewStatus
      }).eq("id", vFeeId);
    }

    toast("✅ Transaction deleted and bill updated!");
    await loadInitialData();
    window.openStudentLedgerModal(vStudentId);
  } catch (vErr) {
    toast("Error: " + vErr.message);
  }
};
window.openCollectPaymentModal = function (v200) {
  const v201 = allStudents.find(v203 => v203.id === v200);
  const v202 = allFees.filter(v204 => v204.student_id === v200 && v204.total_fee - v204.paid_amount > 0);
  if (v202.length === 0) {
    toast("No pending bills.");
    return;
  }
  openModal("\n        <div class=\"modal-handle\"></div>\n        <p class=\"modal-title\">Collect Payment: " + escapeHtml(v201.name) + "</p>\n        <div class=\"form-group\">\n            <label class=\"form-label\">Select Bill</label>\n            <select id=\"pay-fee-id\" class=\"form-input\" onchange=\"window.updateCollectPaymentFields()\">\n                " + v202.map(v205 => "<option value=\"" + v205.id + "\">" + v205.term_or_month + " (Due: Rs. " + (v205.total_fee - v205.paid_amount) + ")</option>").join("") + "\n            </select>\n        </div>\n        <div class=\"form-group\">\n            <label class=\"form-label\">Bill Number</label>\n            <input type=\"text\" id=\"pay-bill-no\" class=\"form-input\" placeholder=\"e.g. 409\" value=\"" + (v202[0].bill_no || "") + "\">\n        </div>\n        <div class=\"form-group\">\n            <label class=\"form-label\">Amount (Rs.)</label>\n            <input type=\"number\" id=\"pay-amount\" class=\"form-input\" value=\"" + (v202[0].total_fee - v202[0].paid_amount) + "\">\n        </div>\n        <div class=\"form-group\">\n            <label class=\"form-label\">Method</label>\n            <select id=\"pay-method\" class=\"form-input\">\n                <option value=\"Cash\">Cash</option>\n                <option value=\"eSewa\">eSewa</option>\n                <option value=\"Bank Transfer\">Bank Transfer</option>\n            </select>\n        </div>\n        <button class=\"btn btn-primary btn-block\" onclick=\"window.submitPayment('" + v200 + "')\">Confirm Payment</button>\n        <button class=\"btn btn-ghost btn-block\" style=\"margin-top:0.5rem\" onclick=\"window.openStudentLedgerModal('" + v200 + "')\">Cancel</button>\n    ");
  lucide.createIcons();
};
window.updateCollectPaymentFields = function () {
  const v206 = document.getElementById("pay-fee-id").value;
  const v207 = allFees.find(v208 => v208.id === v206);
  if (v207) {
    document.getElementById("pay-amount").value = v207.total_fee - v207.paid_amount;
    document.getElementById("pay-bill-no").value = v207.bill_no || "";
  }
};
window.submitPayment = async function (v209) {
  const v210 = document.getElementById("pay-fee-id").value;
  const v211 = Number(document.getElementById("pay-amount").value);
  const v212 = document.getElementById("pay-method").value;
  const v213 = document.getElementById("pay-bill-no").value.trim();
  try {
    toast("Saving...");
    const v214 = allFees.find(v218 => v218.id === v210);
    const v215 = (v214.total_fee || 0) - (v214.paid_amount || 0);
    if (v211 <= 0) {
      toast("Please enter a valid amount.");
      return;
    }
    if (v211 > v215) {
      toast("⚠️ Amount exceeds balance due (Rs. " + v215 + "). Please correct.");
      return;
    }
    const v216 = (v214.paid_amount || 0) + v211;
    await v1.from("transactions").insert({
      student_id: v209,
      fee_id: v210,
      amount: v211,
      payment_method: v212,
      received_by: window.currentUserProfile?.id
    });
    const v217 = {
      paid_amount: v216,
      status: v216 >= v214.total_fee ? "Paid" : "Partial"
    };
    if (v213) {
      v217.bill_no = v213;
    }
    await v1.from("fees").update(v217).eq("id", v210);
    toast("✅ Success!");
    await loadInitialData();
    window.openStudentLedgerModal(v209);
  } catch (v219) {
    toast("Error: " + v219.message);
  }
};
window.openBillStudentModal = function (v220) {
  const v221 = allStudents.find(v222 => v222.id === v220);
  if (!v221) {
    return;
  }
  openModal("\n        <div class=\"modal-handle\"></div>\n        <p class=\"modal-title\">Create Bill: " + escapeHtml(v221.name) + "</p>\n        <div class=\"form-group\">\n            <label class=\"form-label\">Description</label>\n            <input type=\"text\" id=\"bill-desc\" class=\"form-input\" placeholder=\"e.g. Monthly Fee (May)\" required>\n        </div>\n        <div class=\"form-group\">\n            <label class=\"form-label\">Total Amount</label>\n            <input type=\"number\" id=\"bill-amount\" class=\"form-input\" placeholder=\"Rs.\" required>\n        </div>\n        <button class=\"btn btn-primary btn-block\" onclick=\"window.submitBill('" + v220 + "')\">Generate Bill</button>\n        <button class=\"btn btn-ghost btn-block\" style=\"margin-top:0.5rem\" onclick=\"window.openStudentLedgerModal('" + v220 + "')\">Cancel</button>\n    ");
  lucide.createIcons();
};
window.submitBill = async function (v223) {
  const v224 = document.getElementById("bill-desc").value.trim();
  const v225 = Number(document.getElementById("bill-amount").value);
  if (!v224 || isNaN(v225) || v225 <= 0) {
    toast("⚠️ Please fill in all details with a valid amount.");
    return;
  }
  try {
    const v226 = {
      student_id: v223,
      term_or_month: v224,
      total_fee: v225,
      paid_amount: 0,
      status: "Pending"
    };
    const {
      error: v227
    } = await v1.from("fees").insert(v226);
    if (v227) {
      throw v227;
    }
    toast("✅ Bill Created!");
    await loadInitialData();
    window.openStudentLedgerModal(v223);
  } catch (v228) {
    toast("Error: " + v228.message);
  }
};
async function loadParents() {
  try {
    const {
      data: v229,
      error: v230
    } = await v1.from("profiles").select("id, full_name, mobile, assigned_classes").eq("role", "parent");
    if (v230) {
      throw v230;
    }
    allParents = v229 || [];
  } catch (v231) {
    console.error("Parents load error:", v231);
  }
}
function renderParents() {
  const v232 = document.getElementById("parents-list");
  if (!v232) {
    return;
  }
  const v233 = document.getElementById("parent-search")?.value.toLowerCase() || "";
  const v234 = allParents.filter(v235 => {
    const v236 = [];
    try {
      const v239 = typeof v235.assigned_classes === "string" ? JSON.parse(v235.assigned_classes) : v235.assigned_classes;
      if (Array.isArray(v239)) {
        v236.push(...v239);
      } else if (v239?.studentIds) {
        v236.push(...v239.studentIds);
      }
    } catch (v240) {}
    const v237 = allStudents.filter(v241 => v236.includes(v241.id));
    const v238 = v237.map(v242 => v242.name.toLowerCase()).join(" ");
    return v235.full_name.toLowerCase().includes(v233) || v238.includes(v233);
  });
  v232.innerHTML = v234.map(v243 => {
    let v244 = [];
    try {
      const v247 = typeof v243.assigned_classes === "string" ? JSON.parse(v243.assigned_classes) : v243.assigned_classes;
      if (Array.isArray(v247)) {
        v244 = v247;
      } else if (v247) {
        v244 = v247.studentIds || [];
      }
    } catch (v248) {}
    const v245 = allStudents.filter(v249 => v244.includes(v249.id));
    const v246 = v245.map(v250 => v250.name).join(", ") || "No children linked";
    return "\n            <div class=\"card\" style=\"padding:1.25rem; display:flex; justify-content:space-between; align-items:center;\">\n                <div style=\"flex:1;\">\n                    <div style=\"font-weight:700; color:var(--primary); font-size:1.1rem; margin-bottom:0.25rem;\">" + escapeHtml(v243.full_name) + "</div>\n                    <div style=\"font-size:0.8rem; color:var(--text-muted);\">\n                        <i data-lucide=\"users\" style=\"width:12px; height:12px; vertical-align:middle; margin-right:4px;\"></i>\n                        " + escapeHtml(v246) + "\n                    </div>\n                </div>\n                <button class=\"btn btn-secondary\" onclick=\"window.generateParentStatement('" + v243.id + "')\">\n                    <i data-lucide=\"file-text\" style=\"width:16px; height:16px; margin-right:4px;\"></i> Statement\n                </button>\n            </div>\n        ";
  }).join("");
  lucide.createIcons();
}
window.generateParentStatement = function (v251) {
  const v252 = allParents.find(v258 => v258.id === v251);
  if (!v252) {
    return;
  }
  let v253 = [];
  try {
    const v259 = typeof v252.assigned_classes === "string" ? JSON.parse(v252.assigned_classes) : v252.assigned_classes;
    if (Array.isArray(v259)) {
      v253 = v259;
    } else if (v259) {
      v253 = v259.studentIds || [];
    }
  } catch (v260) {}
  const v254 = allStudents.filter(v261 => v253.includes(v261.id));
  let v255 = 0;
  const v256 = v254.map(v262 => {
    const v263 = allFees.filter(v265 => v265.student_id === v262.id);
    const v264 = v263.reduce((v266, v267) => v266 + ((v267.total_fee || 0) - (v267.paid_amount || 0)), 0);
    v255 += v264;
    return "\n            <div style=\"margin-bottom:1.5rem; border:1px solid #e2e8f0; border-radius:0.75rem; overflow:hidden;\">\n                <div style=\"background:var(--primary-light); padding:0.75rem 1rem; display:flex; justify-content:space-between; align-items:center;\">\n                    <strong style=\"color:var(--primary);\">" + escapeHtml(v262.name) + " (Class " + escapeHtml(v262.class.replace("Grade ", "")) + ")</strong>\n                    <span style=\"font-weight:700; color:" + (v264 > 0 ? "#dc2626" : "#10b981") + ";\">Due: Rs. " + v264 + "</span>\n                </div>\n                <table style=\"width:100%; border-collapse:collapse; font-size:0.85rem;\">\n                    <thead>\n                        <tr style=\"text-align:left; background:#f8fafc; border-bottom:1px solid #e2e8f0;\">\n                            <th style=\"padding:0.5rem 1rem;\">Description</th>\n                            <th style=\"padding:0.5rem 1rem; text-align:right;\">Total</th>\n                            <th style=\"padding:0.5rem 1rem; text-align:right;\">Paid</th>\n                            <th style=\"padding:0.5rem 1rem; text-align:right;\">Actions</th>\n                        </tr>\n                    </thead>\n                    <tbody>\n                        " + (v263.length === 0 ? "<tr><td colspan=\"4\" style=\"padding:1rem; text-align:center; color:var(--text-muted);\">No fee records</td></tr>" : v263.map(v268 => {
      const v269 = (v268.total_fee || 0) - (v268.paid_amount || 0);
      return "\n                                <tr style=\"border-bottom:1px solid #f1f5f9;\">\n                                    <td style=\"padding:0.5rem 1rem;\">" + escapeHtml(v268.term_or_month) + "</td>\n                                    <td style=\"padding:0.5rem 1rem; text-align:right;\">Rs. " + v268.total_fee + "</td>\n                                    <td style=\"padding:0.5rem 1rem; text-align:right; font-weight:700; color:#16a34a;\">Rs. " + v268.paid_amount + "</td>\n                                    <td style=\"padding:0.5rem 1rem; text-align:right;\">\n                                        <div style=\"display:flex; gap:0.3rem; justify-content:flex-end;\">\n                                            <button class=\"btn btn-secondary btn-icon\" style=\"width:28px; height:28px; padding:0;\" onclick=\"window.printReceipt('" + v268.id + "', '" + v262.id + "')\" title=\"Print Receipt\">\n                                                <i data-lucide=\"printer\" style=\"width:12px; height:12px;\"></i>\n                                            </button>\n                                        </div>\n                                    </td>\n                                </tr>\n                            ";
    }).join("")) + "\n                    </tbody>\n                </table>\n            </div>\n        ";
  }).join("");
  const v257 = "\n        <div style=\"text-align:center; margin-bottom:1.5rem;\">\n            <h2 style=\"color:var(--primary); margin-bottom:0.25rem;\">Account Statement</h2>\n            <p style=\"font-size:0.85rem; color:var(--text-muted);\">Parent: <strong>" + escapeHtml(v252.full_name) + "</strong></p>\n        </div>\n        \n        <div style=\"max-height:60vh; overflow-y:auto; margin-bottom:1.5rem; padding-right:0.5rem;\">\n            " + v256 + "\n        </div>\n\n        <div style=\"background:#f8fafc; padding:1.25rem; border-radius:0.75rem; display:flex; justify-content:space-between; align-items:center; border:2px solid " + (v255 > 0 ? "#fee2e2" : "#dcfce7") + ";\">\n            <div>\n                <div style=\"font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:800; letter-spacing:0.05em;\">Total Parent Outstanding</div>\n                <div style=\"font-size:1.5rem; font-weight:900; color:" + (v255 > 0 ? "#dc2626" : "#16a34a") + ";\">Rs. " + v255 + "</div>\n            </div>\n            <button class=\"btn btn-primary\" onclick=\"window.printStatement('" + v252.id + "')\" style=\"padding:0.75rem 1.25rem;\">\n                <i data-lucide=\"printer\" style=\"width:18px; height:18px; margin-right:6px;\"></i> Print / Save\n            </button>\n        </div>\n        <button class=\"btn btn-ghost btn-block\" style=\"margin-top:1rem;\" onclick=\"closeModal()\">Close</button>\n    ";
  openModal(v257);
  lucide.createIcons();
};
window.printStatement = async function (v270) {
  const v271 = allParents.find(v275 => v275.id === v270);
  if (!v271) {
    return;
  }
  let v272 = [];
  try {
    const v276 = typeof v271.assigned_classes === "string" ? JSON.parse(v271.assigned_classes) : v271.assigned_classes;
    if (Array.isArray(v276)) {
      v272 = v276;
    } else if (v276) {
      v272 = v276.studentIds || [];
    }
  } catch (v277) {}
  const v273 = allStudents.filter(v278 => v272.includes(v278.id));
  if (window.Capacitor && window.Capacitor.isNativePlatform()) {
    try {
      const {
        Share: v279
      } = window.Capacitor.Plugins;
      if (v279) {
        let v280 = "🧾 *Account Statement - Holy Garden School*\n";
        v280 += "Parent: *" + v271.full_name + "*\n";
        v280 += "Date: " + formatDateLabel(getLocalToday()) + "\n";
        v280 += "--------------------------------\n\n";
        let v281 = 0;
        for (const v282 of v273) {
          const v283 = allFees.filter(v285 => v285.student_id === v282.id);
          const v284 = v283.reduce((v286, v287) => v286 + ((v287.total_fee || 0) - (v287.paid_amount || 0)), 0);
          v281 += v284;
          v280 += "👤 *" + v282.name + "* (Class " + v282.class.replace("Grade ", "") + ")\n";
          if (v283.length === 0) {
            v280 += "  No fee records\n";
          } else {
            v283.forEach(v288 => {
              v280 += "  • " + v288.term_or_month + ": Rs. " + v288.total_fee + " (Paid: Rs. " + v288.paid_amount + ", Due: Rs. " + (v288.total_fee - v288.paid_amount) + ")\n";
            });
          }
          v280 += "  *Student Total Due:* Rs. " + v284 + "\n\n";
        }
        v280 += "--------------------------------\n";
        v280 += "*GRAND TOTAL OUTSTANDING:* Rs. " + v281 + "\n";
        await v279.share({
          title: v271.full_name + " Statement",
          text: v280,
          dialogTitle: "Share or Save Statement"
        });
        toast("✅ Statement shared successfully!");
        return;
      }
    } catch (v289) {
      console.error("Statement Share failed:", v289);
      toast("❌ Failed to share statement.");
    }
  }
  toast("Preparing statement for printing...");
  const v274 = document.getElementById("print-area");
  if (v274) {
    let v290 = document.getElementById("receipt-print-template");
    let v291 = document.getElementById("statement-print-template");
    if (v290) {
      v290.style.display = "none";
    }
    if (v291) {
      v291.style.display = "block";
    }
    const v292 = document.getElementById("st-print-parent-name");
    if (v292) {
      v292.innerText = v271.full_name;
    }
    const v293 = document.getElementById("st-print-date");
    if (v293) {
      v293.innerText = "Date: " + formatDateLabel(getLocalToday());
    }
    const v294 = document.getElementById("st-print-children-details");
    if (v294) {
      let v295 = 0;
      let v296 = v273.map(v298 => {
        const v299 = allFees.filter(v302 => v302.student_id === v298.id);
        const v300 = v299.reduce((v303, v304) => v303 + ((v304.total_fee || 0) - (v304.paid_amount || 0)), 0);
        v295 += v300;
        const v301 = v299.map(v305 => "\n                    <tr style=\"border-bottom: 1px solid #f1f5f9;\">\n                        <td style=\"padding: 8px;\">" + escapeHtml(v305.term_or_month) + "</td>\n                        <td style=\"padding: 8px; text-align: right;\">Rs. " + v305.total_fee + "</td>\n                        <td style=\"padding: 8px; text-align: right; color:#16a34a; font-weight:700;\">Rs. " + v305.paid_amount + "</td>\n                        <td style=\"padding: 8px; text-align: right; color:#dc2626; font-weight:700;\">Rs. " + (v305.total_fee - v305.paid_amount) + "</td>\n                    </tr>\n                ").join("");
        return "\n                    <div style=\"margin-bottom: 1.5rem; border: 1px solid #eee; border-radius: 6px; overflow: hidden;\">\n                        <div style=\"background: #f8fafc; padding: 10px; font-weight: 700; border-bottom: 1px solid #eee; display: flex; justify-content: space-between;\">\n                            <span>" + escapeHtml(v298.name) + " (Class " + escapeHtml(v298.class.replace("Grade ", "")) + ")</span>\n                            <span style=\"color: " + (v300 > 0 ? "#dc2626" : "#10b981") + ";\">Due: Rs. " + v300 + "</span>\n                        </div>\n                        <table style=\"width: 100%; border-collapse: collapse; font-size: 0.8rem;\">\n                            <thead>\n                                <tr style=\"text-align: left; background: #fafafa; border-bottom: 1px solid #eee;\">\n                                    <th style=\"padding: 8px;\">Description</th>\n                                    <th style=\"padding: 8px; text-align: right;\">Total</th>\n                                    <th style=\"padding: 8px; text-align: right;\">Paid</th>\n                                    <th style=\"padding: 8px; text-align: right;\">Due</th>\n                                </tr>\n                            </thead>\n                            <tbody>\n                                " + (v299.length === 0 ? "<tr><td colspan=\"4\" style=\"padding:10px; text-align:center; color:#999;\">No fee records</td></tr>" : v301) + "\n                            </tbody>\n                        </table>\n                    </div>\n                ";
      }).join("");
      v294.innerHTML = v296;
      const v297 = document.getElementById("st-print-total-due");
      if (v297) {
        v297.innerText = "Rs. " + v295;
      }
    }
  }
  setTimeout(() => {
    window.print();
  }, 500);
};
window.printReceipt = function (v306, v307, v308 = null) {
  const v309 = allFees.find(v318 => v318.id === v306);
  const v310 = allStudents.find(v319 => v319.id === v307);
  if (!v309 || !v310) {
    return;
  }
  let v311 = "VCH-" + v309.id.substring(0, 6).toUpperCase();
  let v312 = v309.bill_no ? "BILL-" + v309.bill_no : "BILL-";
  let v313 = v309.paid_amount || 0;
  let v314 = v309.term_or_month;
  let v315 = formatDateLabel(getLocalToday());
  if (v308) {
    const v320 = allTransactions.find(v321 => v321.id === v308);
    if (v320) {
      v311 = "VCH-" + (v320.voucher_no || "000");
      v313 = v320.amount || 0;
      v315 = formatDateLabel(v320.created_at.split("T")[0]);
    }
  } else {
    const v322 = allTransactions.find(v323 => v323.fee_id === v309.id);
    if (v322) {
      v311 = "VCH-" + (v322.voucher_no || "000");
    }
  }
  const v316 = v309.total_fee || 0;
  const v317 = Math.max(0, v316 - v313);
  openModal("\n        <div class=\"modal-handle\"></div>\n        <div style=\"text-align:center; margin-bottom:1.5rem;\">\n            <h2 style=\"color:var(--primary); margin:0;\">Receipt Print Preview</h2>\n            <p style=\"font-size:0.8rem; color:var(--text-muted);\">Review receipt details before printing</p>\n        </div>\n        <div style=\"border:1px solid #e2e8f0; border-radius:0.75rem; padding:1.5rem; background:white; font-family:'Inter', sans-serif; color:#334155; margin-bottom:1.5rem; box-shadow:inset 0 2px 4px rgba(0,0,0,0.02);\">\n            <!-- School Header -->\n            <div style=\"text-align:center; border-bottom:2px solid var(--primary); padding-bottom:0.75rem; margin-bottom:1rem;\">\n                <h4 style=\"margin:0; color:var(--primary); font-size:1.1rem;\">Holy Garden English Secondary School</h4>\n                <p style=\"margin:2px 0 0 0; font-size:0.75rem; color:var(--text-muted);\">Official Payment Receipt</p>\n            </div>\n            <!-- Details Grid -->\n            <div style=\"display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom:1rem; line-height:1.4;\">\n                <div>\n                    <strong style=\"color:var(--text-muted); font-size:0.7rem; text-transform:uppercase;\">Student Details</strong>\n                    <div style=\"font-weight:700; color:var(--primary); margin-top:2px;\">" + v310.name + "</div>\n                    <div style=\"font-size:0.75rem; color:var(--text-muted);\">Class " + v310.class.replace("Grade ", "") + " | Roll " + v310.roll + "</div>\n                </div>\n                <div style=\"text-align:right;\">\n                    <strong style=\"color:var(--text-muted); font-size:0.7rem; text-transform:uppercase;\">Receipt Details</strong>\n                    <div style=\"font-weight:700; margin-top:2px;\">Date: " + v315 + "</div>\n                    <div>Receipt #: <strong style=\"font-family:monospace;\">" + v311 + "</strong></div>\n                    <div>Bill #: <strong style=\"font-family:monospace;\">" + v312 + "</strong></div>\n                </div>\n            </div>\n            <!-- Payment details table -->\n            <table style=\"width:100%; border-collapse:collapse; font-size:0.8rem; margin-top:1rem; border-top:1px solid #e2e8f0;\">\n                <thead>\n                    <tr style=\"text-align:left; background:#f8fafc; border-bottom:1px solid #e2e8f0;\">\n                        <th style=\"padding:0.5rem; color:var(--text-muted);\">Description</th>\n                        <th style=\"padding:0.5rem; text-align:right; color:var(--text-muted);\">Total Bill</th>\n                        <th style=\"padding:0.5rem; text-align:right; color:var(--text-muted);\">Paid</th>\n                        <th style=\"padding:0.5rem; text-align:right; color:var(--text-muted);\">Due</th>\n                    </tr>\n                </thead>\n                <tbody>\n                    <tr>\n                        <td style=\"padding:0.75rem 0.5rem; font-weight:600;\">" + v314 + "</td>\n                        <td style=\"padding:0.75rem 0.5rem; text-align:right;\">Rs. " + v316 + "</td>\n                        <td style=\"padding:0.75rem 0.5rem; text-align:right; color:#16a34a; font-weight:700;\">Rs. " + v313 + "</td>\n                        <td style=\"padding:0.75rem 0.5rem; text-align:right; color:#dc2626; font-weight:700;\">Rs. " + (v316 - v313) + "</td>\n                    </tr>\n                </tbody>\n            </table>\n        </div>\n        <div style=\"display:flex; gap:0.5rem;\">\n            <button class=\"btn btn-primary\" style=\"flex:1\" onclick=\"window.triggerReceiptPrint('" + v306 + "', '" + v307 + "', '" + v311 + "', '" + v312 + "', " + v313 + ", '" + v314.replace(/'/g, "\\'") + "', " + v316 + ", " + (v316 - v313) + ")\">\n                <i data-lucide=\"printer\" style=\"width:16px; height:16px; margin-right:6px;\"></i> Print Receipt\n            </button>\n            <button class=\"btn btn-ghost\" style=\"flex:1; border:1px solid #e2e8f0;\" onclick=\"closeModal()\">Cancel</button>\n        </div>\n    ");
  lucide.createIcons();
};
window.triggerReceiptPrint = async function (v324, v325, v326, v327, v328, v329, v330, v331) {
  const v332 = allStudents.find(v345 => v345.id === v325);
  if (!v332) {
    return;
  }
  if (window.Capacitor && window.Capacitor.isNativePlatform()) {
    try {
      const {
        Share: v346
      } = window.Capacitor.Plugins;
      if (v346) {
        const v347 = "🧾 *Holy Garden Secondary School*\n--------------------------------\n*OFFICIAL PAYMENT RECEIPT*\n\n*Student Details:*\nName: " + v332.name + "\nClass: " + v332.class.replace("Grade ", "") + " | Roll: " + v332.roll + "\n\n*Receipt Details:*\nDate: " + formatDateLabel(getLocalToday()) + "\nReceipt #: " + v326 + "\nBill #: " + v327 + "\n\n*Transaction Summary:*\nFee Name: " + v329 + "\nTotal Bill: Rs. " + v330 + "\nPaid Amount: Rs. " + v328 + "\nBalance Due: Rs. " + v331 + "\n\nThank you for your payment!";
        await v346.share({
          title: "Receipt " + v326,
          text: v347,
          dialogTitle: "Share or Print Payment Receipt"
        });
        toast("✅ Receipt shared successfully!");
        closeModal();
        return;
      }
    } catch (v348) {
      console.error("Capacitor Share failed:", v348);
      toast("❌ Failed to share receipt.");
    }
  }
  const v333 = document.getElementById("print-area");
  if (!v333) {
    toast("Print area not found!");
    return;
  }
  let v334 = document.getElementById("receipt-print-template");
  let v335 = document.getElementById("statement-print-template");
  if (v334) {
    v334.style.display = "block";
  }
  if (v335) {
    v335.style.display = "none";
  }
  const v336 = document.getElementById("print-student-name");
  if (v336) {
    v336.innerText = v332.name;
  }
  const v337 = document.getElementById("print-student-class");
  if (v337) {
    v337.innerText = "Class: " + v332.class.replace("Grade ", "") + " | Roll: " + v332.roll;
  }
  const v338 = document.getElementById("print-date");
  if (v338) {
    v338.innerText = formatDateLabel(getLocalToday());
  }
  const v339 = document.getElementById("print-receipt-id");
  if (v339) {
    v339.innerText = v326;
  }
  const v340 = document.getElementById("print-bill-id");
  if (v340) {
    v340.innerText = v327;
  }
  const v341 = document.getElementById("print-description");
  if (v341) {
    v341.innerText = v329;
  }
  const v342 = document.getElementById("print-total");
  if (v342) {
    v342.innerText = "Rs. " + v330;
  }
  const v343 = document.getElementById("print-paid");
  if (v343) {
    v343.innerText = "Rs. " + v328;
  }
  const v344 = document.getElementById("print-due");
  if (v344) {
    v344.innerText = "Rs. " + v331;
  }
  window.print();
};
async function renderMessages() {
  const v349 = document.getElementById("messages-list");
  if (!v349) {
    return;
  }
  try {
    const {
      data: v350,
      error: v351
    } = await v1.from("messages").select("*").eq("target_type", "school").order("created_at", {
      ascending: false
    }).limit(20);
    if (v351) {
      throw v351;
    }
    if (!v350 || v350.length === 0) {
      v349.innerHTML = "<div class=\"empty-state\"><p>No messages found.</p></div>";
      return;
    }
    v349.innerHTML = v350.map(v352 => "\n            <div class=\"card\" style=\"padding:1rem; border-left:4px solid var(--primary);\">\n                <div style=\"display:flex; justify-content:space-between; margin-bottom:0.5rem;\">\n                    <span style=\"font-size:0.7rem; font-weight:700; color:var(--primary); text-transform:uppercase;\">📢 Announcement</span>\n                    <span style=\"font-size:0.7rem; color:var(--text-muted);\">" + formatDateLabel(v352.created_at.split("T")[0]) + "</span>\n                </div>\n                <h3 style=\"font-size:0.95rem; margin-bottom:0.4rem;\">" + escapeHtml(v352.subject) + "</h3>\n                <p style=\"font-size:0.85rem; color:var(--text-main); white-space:pre-wrap;\">" + escapeHtml(v352.body) + "</p>\n            </div>\n        ").join("");
  } catch (v353) {
    v349.innerHTML = "<p style=\"text-align:center; padding:1rem; color:var(--error);\">Error loading messages.</p>";
  }
}
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
  try {
    if (!window.currentUserId) {
      return;
    }
    const v354 = localStorage.getItem("msg_last_read_" + window.currentUserId) || "1970-01-01";
    const {
      data: v355,
      error: v356
    } = await v1.from("messages").select("id, created_at").eq("target_type", "school");
    if (!v356 && v355) {
      const v357 = v355.filter(v359 => v359.created_at > v354).length;
      const v358 = document.getElementById("badge-messages");
      if (v358) {
        if (v357 > 0 && currentTab !== "messages") {
          v358.textContent = v357 > 9 ? "9+" : v357;
          v358.style.display = "flex";
        } else {
          v358.style.display = "none";
        }
      }
    }
  } catch (v360) {}
}
window.initNotificationSubscription = function () {
  if (window.notifChannel) {
    v1.removeChannel(window.notifChannel);
  }
  window.notifChannel = v1.channel("accountant-notifications").on("postgres_changes", {
    event: "INSERT",
    schema: "public",
    table: "messages",
    filter: "target_type=eq.school"
  }, () => {
    window.updateNotificationBadges();
  }).subscribe();
};
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (window.notifChannel) {
      v1.removeChannel(window.notifChannel);
      window.notifChannel = null;
    }
  } else {
    window.initNotificationSubscription();
    window.updateNotificationBadges();
  }
});
window.logout = async function () {
  try {
    v1.removeAllChannels();
    window.notifChannel = null;
  } catch (v361) {}
  await logout();
};
window.closeModal = closeModal;
window.escapeHtml = escapeHtml;
window.renderParents = renderParents;
let salaryState = {
  year: "2083",
  month: "Baisakh",
  rows: []
};
window.renderSalaryGrid = async function () {
  const v362 = document.getElementById("salary-rows-container");
  if (!v362) {
    return;
  }
  if (!salaryState.rows || salaryState.rows.length === 0) {
    v362.innerHTML = "<tr><td colspan=\"15\" style=\"padding:2rem; text-align:center; color:var(--text-muted);\"><div class=\"spinner\" style=\"margin:0 auto 1rem;\"></div>Loading salary records...</td></tr>";
    await window.loadSalaryData();
    return;
  }
  renderSalaryRows();
};
window.loadSalaryData = async function () {
  const v363 = document.getElementById("salary-year");
  const v364 = document.getElementById("salary-month");
  if (v363) {
    salaryState.year = v363.value;
  }
  if (v364) {
    salaryState.month = v364.value;
  }
  const v365 = "[Salary Voucher: " + salaryState.year + " " + salaryState.month + "]";
  const v366 = allExpenditures.find(v371 => v371.category === "Salary" && v371.description && v371.description.startsWith(v365));
  let v367 = false;
  if (v366) {
    try {
      const v372 = v366.description.substring(v366.description.indexOf("JSON:") + 5);
      const v373 = JSON.parse(v372);
      if (v373 && v373.rows) {
        salaryState.rows = v373.rows.filter(v374 => {
          const v375 = (v374.name || "").toLowerCase();
          const v376 = (v374.post || "").toLowerCase();
          return !v375.includes("super admin") && !v375.includes("administrator") && !v375.includes("admin account") && !v375.includes("accountant") && !v376.includes("admin") && !v376.includes("accountant");
        });
        v367 = true;
        toast("Loaded recorded salary voucher for " + salaryState.month + " " + salaryState.year);
      }
    } catch (v377) {
      console.error("Error parsing saved salary voucher JSON:", v377);
    }
  }
  if (!v367) {
    try {
      const {
        data: v378,
        error: v379
      } = await v1.from("profiles").select("id, full_name, role").eq("role", "teacher");
      if (v379) {
        throw v379;
      }
      const v380 = (v378 || []).filter(v382 => {
        const v383 = (v382.role || "").toLowerCase();
        const v384 = (v382.full_name || "").toLowerCase();
        return v383 !== "admin" && v383 !== "accountant" && !v384.includes("super admin") && !v384.includes("administrator") && !v384.includes("admin account") && !v384.includes("accountant");
      });
      const v381 = v380.sort((v385, v386) => {
        if (v385.full_name.includes("Shree Krishna")) {
          return -1;
        }
        if (v386.full_name.includes("Shree Krishna")) {
          return 1;
        }
        return v385.full_name.localeCompare(v386.full_name);
      });
      salaryState.rows = v381.map((v387, v388) => {
        const v389 = localStorage.getItem("staff_basic_salary_" + v387.id);
        const v390 = v389 ? Number(v389) : v387.full_name.includes("Shree Krishna") ? 21000 : 10000;
        const v391 = localStorage.getItem("staff_mahangi_" + v387.id);
        const v392 = v391 ? Number(v391) : 0;
        const v393 = localStorage.getItem("staff_tax_settings_" + v387.id);
        const v394 = v393 ? JSON.parse(v393) : {
          isMarried: false,
          isFemale: false,
          ssfEnrolled: false,
          pfEnrolled: false,
          citEnrolled: false,
          autoCalculateRetirement: false,
          retirementContribution: 0,
          lifeInsurance: 0,
          healthInsurance: 0,
          buildingInsurance: 0,
          remoteAreaClass: "none",
          medicalExpenses: 0,
          dashainAllowanceAnnual: v390,
          dressAllowanceAnnual: 0
        };
        const v395 = Math.round((v390 + v392) * 100) / 100;
        let v396 = v394.retirementContribution || 0;
        let v397 = 0;
        if (v394.autoCalculateRetirement) {
          if (v394.ssfEnrolled) {
            v396 = Math.round(v390 * 0.11 * 100) / 100;
            v397 = Math.round(v390 * 0.2 * 100) / 100;
          } else if (v394.pfEnrolled) {
            v396 = Math.round(v390 * 0.1 * 100) / 100;
            v397 = Math.round(v390 * 0.1 * 100) / 100;
          }
        } else if (v394.ssfEnrolled) {
          v397 = Math.round(v390 * 0.2 * 100) / 100;
        } else if (v394.pfEnrolled) {
          v397 = Math.round(v390 * 0.1 * 100) / 100;
        }
        const v398 = {
          id: v387.id,
          post: v387.role === "admin" || v387.full_name.includes("Shree Krishna") ? "Principal" : "Teacher",
          name: v387.full_name,
          basic: v390,
          mahangi: v392,
          advance: 0,
          deduction: 0,
          dashain: 0,
          extra: 0,
          leaveSaveDays: 0,
          leaveLossDays: 0,
          leaveSaveAmount: 0,
          leaveLossAmount: 0,
          grossEarnings: v395,
          grandTotal: v395,
          isMarried: v394.isMarried || false,
          isFemale: v394.isFemale || false,
          ssfEnrolled: v394.ssfEnrolled || false,
          pfEnrolled: v394.pfEnrolled || false,
          citEnrolled: v394.citEnrolled || false,
          autoCalculateRetirement: v394.autoCalculateRetirement || false,
          retirementContribution: v396,
          employerContribution: v397,
          lifeInsurance: v394.lifeInsurance || 0,
          healthInsurance: v394.healthInsurance || 0,
          buildingInsurance: v394.buildingInsurance || 0,
          remoteAreaClass: v394.remoteAreaClass || "none",
          medicalExpenses: v394.medicalExpenses || 0,
          dashainAllowanceAnnual: v394.dashainAllowanceAnnual !== undefined ? v394.dashainAllowanceAnnual : v390,
          dressAllowanceAnnual: v394.dressAllowanceAnnual || 0,
          tax: 0,
          taxBreakdown: null,
          netAmount: 0,
          isManual: false
        };
        const v399 = getRemoteAreaAnnualDeduction(v398.remoteAreaClass);
        const v400 = calculateIRDTax(v398.basic + v398.mahangi, v398.isMarried, v398.ssfEnrolled, v398.citEnrolled, v398.pfEnrolled || false, v398.retirementContribution, v398.lifeInsurance, v398.healthInsurance, v398.buildingInsurance, v399, v398.medicalExpenses, v398.isFemale, v398.dashainAllowanceAnnual, v398.dressAllowanceAnnual, 0);
        v398.tax = Math.round(v400.monthlyTax * 100) / 100;
        v398.taxBreakdown = v400.breakdown;
        v398.netAmount = Math.round((v398.grandTotal - v398.tax - v398.retirementContribution) * 100) / 100;
        return v398;
      });
    } catch (v401) {
      console.error("Error loading teachers:", v401);
      toast("Failed to load staff profiles: " + v401.message);
      return;
    }
  }
  let v368 = [];
  try {
    const {
      data: v402,
      error: v403
    } = await v1.from("expenditures").select("description").eq("category", "Salary").eq("paid_to", "Global Manual Staff List").limit(1).maybeSingle();
    if (!v403 && v402 && v402.description) {
      const v404 = JSON.parse(v402.description);
      if (v404 && v404.rows) {
        v368 = v404.rows;
        localStorage.setItem("manual_staff_members", JSON.stringify(v368));
      }
    } else {
      const v405 = localStorage.getItem("manual_staff_members");
      if (v405) {
        v368 = JSON.parse(v405);
      }
    }
    v368.forEach(v406 => {
      if (v406) {
        v406.mahangi = v406.mahangi || 0;
        v406.isMarried = v406.isMarried || false;
        v406.isFemale = v406.isFemale || false;
        v406.ssfEnrolled = v406.ssfEnrolled || false;
        v406.pfEnrolled = v406.pfEnrolled || false;
        v406.citEnrolled = v406.citEnrolled || false;
        v406.autoCalculateRetirement = v406.autoCalculateRetirement || false;
        v406.retirementContribution = v406.retirementContribution || 0;
        v406.lifeInsurance = v406.lifeInsurance || 0;
        v406.healthInsurance = v406.healthInsurance || 0;
        v406.buildingInsurance = v406.buildingInsurance || 0;
        v406.remoteAreaClass = v406.remoteAreaClass || "none";
        v406.medicalExpenses = v406.medicalExpenses || 0;
        v406.leaveSaveAmount = v406.leaveSaveAmount || 0;
        v406.leaveLossAmount = v406.leaveLossAmount || 0;
        v406.dashainAllowanceAnnual = v406.dashainAllowanceAnnual !== undefined ? v406.dashainAllowanceAnnual : v406.basic;
        v406.dressAllowanceAnnual = v406.dressAllowanceAnnual || 0;
        if (v406.autoCalculateRetirement) {
          if (v406.ssfEnrolled) {
            v406.retirementContribution = Math.round(v406.basic * 0.11 * 100) / 100;
            v406.employerContribution = Math.round(v406.basic * 0.2 * 100) / 100;
          } else if (v406.pfEnrolled) {
            v406.retirementContribution = Math.round(v406.basic * 0.1 * 100) / 100;
            v406.employerContribution = Math.round(v406.basic * 0.1 * 100) / 100;
          }
        } else if (v406.ssfEnrolled) {
          v406.employerContribution = Math.round(v406.basic * 0.2 * 100) / 100;
        } else if (v406.pfEnrolled) {
          v406.employerContribution = Math.round(v406.basic * 0.1 * 100) / 100;
        } else {
          v406.employerContribution = v406.employerContribution || 0;
        }
        v406.grossEarnings = v406.basic + v406.mahangi + v406.dashain + v406.extra + v406.leaveSaveAmount - v406.leaveLossAmount;
        v406.grossEarnings = Math.round(v406.grossEarnings * 100) / 100;
        v406.grandTotal = v406.grossEarnings - v406.advance - v406.deduction;
        v406.grandTotal = Math.round(v406.grandTotal * 100) / 100;
        const v407 = getRemoteAreaAnnualDeduction(v406.remoteAreaClass);
        const v408 = v406.basic + v406.mahangi;
        const v409 = v406.extra + v406.leaveSaveAmount - v406.leaveLossAmount;
        const v410 = v406.dashain > 0 ? v406.dashain : v406.dashainAllowanceAnnual !== undefined ? v406.dashainAllowanceAnnual : v406.basic;
        const v411 = calculateIRDTax(v408, v406.isMarried, v406.ssfEnrolled, v406.citEnrolled, v406.pfEnrolled || false, v406.retirementContribution, v406.lifeInsurance, v406.healthInsurance, v406.buildingInsurance, v407, v406.medicalExpenses, v406.isFemale, v410, v406.dressAllowanceAnnual, v409);
        v406.tax = Math.round(v411.monthlyTax * 100) / 100;
        v406.taxBreakdown = v411.breakdown;
        v406.netAmount = Math.round((v406.grandTotal - v406.tax - v406.retirementContribution) * 100) / 100;
        v406.isManual = true;
      }
    });
  } catch (v412) {
    console.error("Error reading manual staff from Supabase/cache:", v412);
  }
  const v369 = new Set(salaryState.rows.map(v413 => v413.id));
  const v370 = v368.filter(v414 => v414 && v414.id && !v369.has(v414.id));
  salaryState.rows = [...salaryState.rows, ...v370];
  renderSalaryRows();
};
async function syncManualStaffToSupabase() {
  const v415 = salaryState.rows.filter(v416 => v416.isManual);
  localStorage.setItem("manual_staff_members", JSON.stringify(v415));
  try {
    const v417 = window.currentUserProfile?.id;
    const {
      data: v418
    } = await v1.from("expenditures").select("id").eq("category", "Salary").eq("paid_to", "Global Manual Staff List").limit(1).maybeSingle();
    const v419 = {
      category: "Salary",
      amount: 0,
      description: JSON.stringify({
        rows: v415
      }),
      paid_to: "Global Manual Staff List",
      recorded_by: v417
    };
    if (v418) {
      await v1.from("expenditures").update(v419).eq("id", v418.id);
    } else {
      await v1.from("expenditures").insert(v419);
    }
  } catch (v420) {
    console.error("Failed to sync manual staff to database:", v420);
  }
}
function renderSalaryRows() {
  const v421 = document.getElementById("salary-rows-container");
  if (!v421) {
    return;
  }
  if (!salaryState.rows || salaryState.rows.length === 0) {
    v421.innerHTML = "<tr><td colspan=\"17\" style=\"padding:2rem; text-align:center; color:var(--text-muted);\">No staff records available. Click + to add manual rows.</td></tr>";
    updateSalaryTotals();
    return;
  }
  v421.innerHTML = salaryState.rows.map((v422, v423) => "\n        <tr data-id=\"" + v422.id + "\" style=\"border-bottom:1px solid #f1f5f9;\">\n            <td style=\"padding:0.4rem; text-align:center; font-weight:600; color:var(--text-muted);\">" + (v423 + 1) + "</td>\n            <td style=\"padding:0.4rem;\">\n                <input type=\"text\" class=\"form-input row-post\" value=\"" + escapeHtml(v422.post) + "\" style=\"padding:0.35rem 0.5rem; font-size:0.75rem;\" oninput=\"window.updateSalaryRowCalculation('" + v422.id + "')\">\n            </td>\n            <td style=\"padding:0.4rem; font-weight:500;\">\n                <div style=\"display:flex; justify-content:space-between; align-items:center; gap:0.25rem;\">\n                    " + (v422.isManual ? "<input type=\"text\" class=\"form-input row-name\" value=\"" + escapeHtml(v422.name) + "\" style=\"padding:0.35rem 0.5rem; font-size:0.75rem; flex:1;\" oninput=\"window.updateSalaryRowCalculation('" + v422.id + "')\">" : "<span>" + escapeHtml(v422.name) + "</span>") + "\n                    <div style=\"display:inline-flex; gap:0.15rem; flex-shrink:0;\">\n                        <button class=\"btn btn-ghost btn-icon btn-sm\" onclick=\"window.openTaxSettingsModal('" + v422.id + "')\" title=\"Tax &amp; Deductions Settings\" style=\"color:var(--primary); padding:0.1rem; width:20px; height:20px;\">\n                            <i data-lucide=\"settings\" style=\"width:12px; height:12px;\"></i>\n                        </button>\n                        <button class=\"btn btn-ghost btn-icon btn-sm\" onclick=\"window.openTaxBreakdownModal('" + v422.id + "')\" title=\"View Tax Breakdown\" style=\"color:#d97706; padding:0.1rem; width:20px; height:20px;\">\n                            <i data-lucide=\"bar-chart-2\" style=\"width:12px; height:12px;\"></i>\n                        </button>\n                    </div>\n                </div>\n                <!-- IRD status badges -->\n                <div style=\"display:flex; gap:0.2rem; flex-wrap:wrap; margin-top:2px;\">\n                    " + (v422.isMarried ? "<span class=\"ird-badge badge-green\">Married</span>" : "") + "\n                    " + (v422.isFemale ? "<span class=\"ird-badge badge-pink\">Female</span>" : "") + "\n                    " + (v422.ssfEnrolled ? "<span class=\"ird-badge badge-blue\">SSF</span>" : "") + "\n                    " + (v422.pfEnrolled ? "<span class=\"ird-badge badge-teal\">PF</span>" : "") + "\n                    " + (v422.citEnrolled ? "<span class=\"ird-badge badge-orange\">CIT</span>" : "") + "\n                    " + (v422.remoteAreaClass && v422.remoteAreaClass !== "none" ? "<span class=\"ird-badge badge-gray\">Remote-" + escapeHtml(v422.remoteAreaClass) + "</span>" : "") + "\n                    " + (v422.lifeInsurance > 0 || v422.healthInsurance > 0 || v422.buildingInsurance > 0 ? "<span class=\"ird-badge badge-purple\">Insured</span>" : "") + "\n                </div>\n            </td>\n            <td style=\"padding:0.4rem;\">\n                <input type=\"number\" class=\"form-input row-basic\" value=\"" + v422.basic + "\" style=\"padding:0.35rem 0.5rem; font-size:0.75rem; text-align:right;\" oninput=\"window.updateSalaryRowCalculation('" + v422.id + "')\">\n            </td>\n            <td style=\"padding:0.4rem;\">\n                <input type=\"number\" class=\"form-input row-mahangi\" value=\"" + (v422.mahangi || 0) + "\" style=\"padding:0.35rem 0.5rem; font-size:0.75rem; text-align:right;\" oninput=\"window.updateSalaryRowCalculation('" + v422.id + "')\">\n            </td>\n            <td style=\"padding:0.4rem;\">\n                <input type=\"number\" class=\"form-input row-advance\" value=\"" + v422.advance + "\" style=\"padding:0.35rem 0.5rem; font-size:0.75rem; text-align:right;\" oninput=\"window.updateSalaryRowCalculation('" + v422.id + "')\">\n            </td>\n            <td style=\"padding:0.4rem;\">\n                <input type=\"number\" class=\"form-input row-deduction\" value=\"" + v422.deduction + "\" style=\"padding:0.35rem 0.5rem; font-size:0.75rem; text-align:right;\" oninput=\"window.updateSalaryRowCalculation('" + v422.id + "')\">\n            </td>\n            <td style=\"padding:0.4rem;\">\n                <input type=\"number\" class=\"form-input row-dashain\" value=\"" + v422.dashain + "\" style=\"padding:0.35rem 0.5rem; font-size:0.75rem; text-align:right;\" oninput=\"window.updateSalaryRowCalculation('" + v422.id + "')\">\n            </td>\n            <td style=\"padding:0.4rem;\">\n                <input type=\"number\" class=\"form-input row-extra\" value=\"" + v422.extra + "\" style=\"padding:0.35rem 0.5rem; font-size:0.75rem; text-align:right;\" oninput=\"window.updateSalaryRowCalculation('" + v422.id + "')\">\n            </td>\n            <td style=\"padding:0.4rem; display:flex; gap:0.25rem; align-items:center; justify-content:center;\">\n                <input type=\"number\" class=\"form-input row-leave-save\" value=\"" + (v422.leaveSaveDays || 0) + "\" placeholder=\"Save\" style=\"padding:0.35rem 0.5rem; font-size:0.75rem; text-align:center; width:55px; border-color:#86efac;\" oninput=\"window.updateSalaryRowCalculation('" + v422.id + "')\">\n                <input type=\"number\" class=\"form-input row-leave-loss\" value=\"" + (v422.leaveLossDays || 0) + "\" placeholder=\"Loss\" style=\"padding:0.35rem 0.5rem; font-size:0.75rem; text-align:center; width:55px; border-color:#fca5a5;\" oninput=\"window.updateSalaryRowCalculation('" + v422.id + "')\">\n            </td>\n            <td style=\"padding:0.4rem; text-align:right; font-weight:600; color:#16a34a;\" class=\"row-leavesave-amt\">Rs. " + v422.leaveSaveAmount.toFixed(2) + "</td>\n            <td style=\"padding:0.4rem; text-align:right; font-weight:600; color:#dc2626;\" class=\"row-leaveloss-amt\">Rs. " + v422.leaveLossAmount.toFixed(2) + "</td>\n            <td style=\"padding:0.4rem; text-align:right; font-weight:700; background:#f8fafc; color:var(--primary);\" class=\"row-gross\">Rs. " + v422.grossEarnings.toFixed(2) + "</td>\n            <td style=\"padding:0.4rem; text-align:right; font-weight:700; background:#f8fafc;\" class=\"row-grand\">Rs. " + v422.grandTotal.toFixed(2) + "</td>\n            <td style=\"padding:0.4rem; text-align:right; color:#ef4444;\" class=\"row-tax\">Rs. " + v422.tax.toFixed(2) + "</td>\n            <td style=\"padding:0.4rem; text-align:right; color:#7c3aed; font-weight:600;\" class=\"row-retirement\">Rs. " + (v422.retirementContribution || 0).toFixed(2) + "</td>\n            <td style=\"padding:0.4rem; text-align:right; font-weight:800; background:#f0f9ff; color:#0369a1;\" class=\"row-net\">Rs. " + v422.netAmount.toFixed(2) + "</td>\n            <td style=\"padding:0.4rem; text-align:center;\">\n                <div style=\"display:inline-flex; gap:0.2rem; align-items:center; justify-content:center;\">\n                    <button class=\"btn btn-ghost btn-icon btn-sm\" onclick=\"window.moveSalaryRowUp(" + v423 + ")\" title=\"Move Up\" style=\"color:var(--text-muted); padding:0.1rem; width:22px; height:22px;\">\n                        <i data-lucide=\"chevron-up\" style=\"width:14px; height:14px;\"></i>\n                    </button>\n                    <button class=\"btn btn-ghost btn-icon btn-sm\" onclick=\"window.moveSalaryRowDown(" + v423 + ")\" title=\"Move Down\" style=\"color:var(--text-muted); padding:0.1rem; width:22px; height:22px;\">\n                        <i data-lucide=\"chevron-down\" style=\"width:14px; height:14px;\"></i>\n                    </button>\n                    " + (v422.isManual ? "<button class=\"btn btn-ghost btn-icon btn-sm\" onclick=\"window.deleteSalaryRow('" + v422.id + "')\" title=\"Delete Row\" style=\"color:var(--error); padding:0.1rem; width:22px; height:22px;\"><i data-lucide=\"trash-2\" style=\"width:14px; height:14px;\"></i></button>" : "<span style=\"width:22px; display:inline-block;\"></span>") + "\n                </div>\n            </td>\n        </tr>\n    ").join("");
  lucide.createIcons();
  updateSalaryTotals();
}
window.openTaxSettingsModal = function (v424) {
  const v425 = salaryState.rows.find(v428 => v428.id === v424);
  if (!v425) {
    return;
  }
  const v426 = [{
    value: "none",
    label: "None (No Remote Allowance)"
  }, {
    value: "A",
    label: "Class A — Rs. 10,000 / year"
  }, {
    value: "B",
    label: "Class B — Rs. 20,000 / year"
  }, {
    value: "C",
    label: "Class C — Rs. 30,000 / year"
  }, {
    value: "D",
    label: "Class D — Rs. 40,000 / year"
  }, {
    value: "E",
    label: "Class E — Rs. 50,000 / year"
  }];
  const v427 = v425.ssfEnrolled ? "ssf" : v425.pfEnrolled ? "pf" : v425.citEnrolled ? "cit" : "none";
  openModal("\n        <div class=\"modal-handle\"></div>\n        <p class=\"modal-title\">⚙️ IRD Tax &amp; Deduction Settings</p>\n        <p style=\"font-size:0.8rem; color:var(--text-muted); margin-bottom:1rem;\">Configure tax brackets and IRD deductions for <strong>" + escapeHtml(v425.name) + "</strong></p>\n\n        <div style=\"display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; margin-bottom:0.75rem;\">\n            <div class=\"form-group\" style=\"margin:0;\">\n                <label class=\"form-label\">Filing Status</label>\n                <select id=\"tax-status\" class=\"form-input\">\n                    <option value=\"single\"  " + (!v425.isMarried ? "selected" : "") + ">Single (5L slab)</option>\n                    <option value=\"married\" " + (v425.isMarried ? "selected" : "") + ">Married/Couple (6L slab)</option>\n                </select>\n            </div>\n            <div class=\"form-group\" style=\"margin:0;\">\n                <label class=\"form-label\">Gender</label>\n                <select id=\"tax-gender\" class=\"form-input\">\n                    <option value=\"male\"   " + (!v425.isFemale ? "selected" : "") + ">Male</option>\n                    <option value=\"female\" " + (v425.isFemale ? "selected" : "") + ">Female (10% tax rebate)</option>\n                </select>\n            </div>\n        </div>\n\n        <div class=\"form-group\">\n            <label class=\"form-label\">Retirement Fund Enrolment</label>\n            <select id=\"tax-retirement-type\" class=\"form-input\" onchange=\"window.toggleTaxRetirementFields()\">\n                <option value=\"none\" " + (v427 === "none" ? "selected" : "") + ">None</option>\n                <option value=\"ssf\"  " + (v427 === "ssf" ? "selected" : "") + ">SSF (Social Security Fund) — Employee: 11% | Employer: 20%</option>\n                <option value=\"pf\"   " + (v427 === "pf" ? "selected" : "") + ">PF / EPF (Provident Fund) — Employee: 10% | Employer: 10%</option>\n                <option value=\"cit\"  " + (v427 === "cit" ? "selected" : "") + ">CIT / Sanchaya Kosh (manual amount)</option>\n            </select>\n        </div>\n\n        <div id=\"tax-retirement-contrib-group\" style=\"display:" + (v427 !== "none" ? "block" : "none") + "; margin-bottom:0.75rem;\">\n            <div style=\"display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;\">\n                <div class=\"form-group\" style=\"margin:0;\">\n                    <label class=\"form-label\">Auto-Calculate Contribution</label>\n                    <select id=\"tax-auto-calc\" class=\"form-input\" onchange=\"window.toggleAutoCalcField()\">\n                        <option value=\"yes\" " + (v425.autoCalculateRetirement ? "selected" : "") + ">Yes — auto by % of basic</option>\n                        <option value=\"no\"  " + (!v425.autoCalculateRetirement ? "selected" : "") + ">No — enter manual amount</option>\n                    </select>\n                </div>\n                <div class=\"form-group\" style=\"margin:0;\" id=\"tax-manual-amount-group\" style=\"display:" + (v425.autoCalculateRetirement ? "none" : "block") + ";\">\n                    <label class=\"form-label\">Monthly Contribution (Rs.)</label>\n                    <input type=\"number\" id=\"tax-retirement-contribution\" class=\"form-input\" value=\"" + (v425.retirementContribution || 0) + "\" min=\"0\" step=\"100\">\n                    <span style=\"font-size:0.65rem; color:var(--text-muted); display:block; margin-top:2px;\">Max deductible: lower of Rs. 5L/yr or 1/3 of gross</span>\n                </div>\n            </div>\n        </div>\n\n        <div style=\"display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; margin-bottom:0.75rem;\">\n            <div class=\"form-group\" style=\"margin:0;\">\n                <label class=\"form-label\">Life Insurance Premium (Rs./yr)</label>\n                <input type=\"number\" id=\"tax-life-insurance\" class=\"form-input\" value=\"" + (v425.lifeInsurance || 0) + "\" min=\"0\" step=\"500\">\n                <span style=\"font-size:0.65rem; color:var(--text-muted); display:block; margin-top:2px;\">Max deductible: Rs. 40,000 / year</span>\n            </div>\n            <div class=\"form-group\" style=\"margin:0;\">\n                <label class=\"form-label\">Health Insurance Premium (Rs./yr)</label>\n                <input type=\"number\" id=\"tax-health-insurance\" class=\"form-input\" value=\"" + (v425.healthInsurance || 0) + "\" min=\"0\" step=\"500\">\n                <span style=\"font-size:0.65rem; color:var(--text-muted); display:block; margin-top:2px;\">Max deductible: Rs. 20,000 / year</span>\n            </div>\n        </div>\n\n        <div style=\"display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; margin-bottom:0.75rem;\">\n            <div class=\"form-group\" style=\"margin:0;\">\n                <label class=\"form-label\">Building Insurance Premium (Rs./yr)</label>\n                <input type=\"number\" id=\"tax-building-insurance\" class=\"form-input\" value=\"" + (v425.buildingInsurance || 0) + "\" min=\"0\" step=\"100\">\n                <span style=\"font-size:0.65rem; color:var(--text-muted); display:block; margin-top:2px;\">Max deductible: Rs. 5,000 / year</span>\n            </div>\n            <div class=\"form-group\" style=\"margin:0;\">\n                <label class=\"form-label\">Medical Expenses (Rs./yr)</label>\n                <input type=\"number\" id=\"tax-medical-expenses\" class=\"form-input\" value=\"" + (v425.medicalExpenses || 0) + "\" min=\"0\" step=\"100\">\n                <span style=\"font-size:0.65rem; color:var(--text-muted); display:block; margin-top:2px;\">Tax credit = min(Rs. 750, 15% of expenses)</span>\n            </div>\n        </div>\n\n        <div style=\"background:#f8fafc; border:1px solid var(--border); border-radius:8px; padding:0.75rem; margin-bottom:0.75rem;\">\n            <p style=\"font-size:0.75rem; font-weight:700; color:var(--primary); margin-bottom:0.5rem; text-transform:uppercase; letter-spacing:0.02em;\">🇳🇵 Annual Taxable Allowances (IRD Nepal)</p>\n            <div style=\"display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;\">\n                <div class=\"form-group\" style=\"margin:0;\">\n                    <label class=\"form-label\">Annual Dashain Allowance (Rs.)</label>\n                    <input type=\"number\" id=\"tax-dashain-allowance\" class=\"form-input\" value=\"" + (v425.dashainAllowanceAnnual !== undefined ? v425.dashainAllowanceAnnual : v425.basic) + "\" placeholder=\"Default: 1 month basic\">\n                </div>\n                <div class=\"form-group\" style=\"margin:0;\">\n                    <label class=\"form-label\">Annual Dress Allowance (Rs.)</label>\n                    <input type=\"number\" id=\"tax-dress-allowance\" class=\"form-input\" value=\"" + (v425.dressAllowanceAnnual || 0) + "\" placeholder=\"e.g. 10000\">\n                </div>\n            </div>\n        </div>\n\n        <div class=\"form-group\">\n            <label class=\"form-label\">Remote Area Classification (IRD Sec. 12)</label>\n            <select id=\"tax-remote-area\" class=\"form-input\">\n                " + v426.map(v429 => "<option value=\"" + v429.value + "\" " + ((v425.remoteAreaClass || "none") === v429.value ? "selected" : "") + ">" + v429.label + "</option>").join("") + "\n            </select>\n        </div>\n\n        <button class=\"btn btn-primary btn-block\" onclick=\"window.saveTaxSettings('" + v425.id + "')\">\n            <i data-lucide=\"check\" style=\"width:16px; height:16px;\"></i> Save Tax Settings\n        </button>\n        <button class=\"btn btn-ghost btn-block\" style=\"margin-top:0.5rem\" onclick=\"window.openTaxBreakdownModal('" + v425.id + "')\">📊 View Tax Breakdown</button>\n        <button class=\"btn btn-ghost btn-block\" style=\"margin-top:0.5rem\" onclick=\"closeModal()\">Cancel</button>\n    ");
  lucide.createIcons();
};
window.toggleTaxRetirementFields = function () {
  const v430 = document.getElementById("tax-retirement-type").value;
  const v431 = document.getElementById("tax-retirement-contrib-group");
  if (v431) {
    v431.style.display = v430 !== "none" ? "block" : "none";
    if (v430 === "none") {
      const v432 = document.getElementById("tax-retirement-contribution");
      if (v432) {
        v432.value = 0;
      }
    }
  }
  window.toggleAutoCalcField();
};
window.toggleAutoCalcField = function () {
  const v433 = document.getElementById("tax-retirement-type")?.value;
  const v434 = document.getElementById("tax-auto-calc")?.value;
  const v435 = document.getElementById("tax-manual-amount-group");
  if (v435) {
    v435.style.display = v434 === "yes" && v433 !== "cit" ? "none" : "block";
  }
};
window.saveTaxSettings = function (v436) {
  const v437 = salaryState.rows.find(v451 => v451.id === v436);
  if (!v437) {
    return;
  }
  const v438 = document.getElementById("tax-status").value;
  const v439 = document.getElementById("tax-gender").value;
  const v440 = document.getElementById("tax-retirement-type").value;
  const v441 = document.getElementById("tax-auto-calc")?.value || "no";
  const v442 = Number(document.getElementById("tax-retirement-contribution")?.value) || 0;
  const v443 = Number(document.getElementById("tax-life-insurance").value) || 0;
  const v444 = Number(document.getElementById("tax-health-insurance").value) || 0;
  const v445 = Number(document.getElementById("tax-building-insurance").value) || 0;
  const v446 = Number(document.getElementById("tax-medical-expenses").value) || 0;
  const v447 = document.getElementById("tax-remote-area").value;
  const v448 = Number(document.getElementById("tax-dashain-allowance").value);
  const v449 = Number(document.getElementById("tax-dress-allowance").value) || 0;
  v437.isMarried = v438 === "married";
  v437.isFemale = v439 === "female";
  v437.ssfEnrolled = v440 === "ssf";
  v437.pfEnrolled = v440 === "pf";
  v437.citEnrolled = v440 === "cit";
  v437.autoCalculateRetirement = v441 === "yes" && v440 !== "cit" && v440 !== "none";
  v437.retirementContribution = v437.autoCalculateRetirement ? v437.ssfEnrolled ? Math.round(v437.basic * 0.11 * 100) / 100 : Math.round(v437.basic * 0.1 * 100) / 100 : v442;
  v437.lifeInsurance = v443;
  v437.healthInsurance = v444;
  v437.buildingInsurance = v445;
  v437.medicalExpenses = v446;
  v437.remoteAreaClass = v447;
  v437.dashainAllowanceAnnual = isNaN(v448) ? v437.basic : v448;
  v437.dressAllowanceAnnual = v449;
  if (v437.ssfEnrolled) {
    v437.employerContribution = Math.round(v437.basic * 0.2 * 100) / 100;
  } else if (v437.pfEnrolled) {
    v437.employerContribution = Math.round(v437.basic * 0.1 * 100) / 100;
  } else {
    v437.employerContribution = 0;
  }
  const v450 = {
    isMarried: v437.isMarried,
    isFemale: v437.isFemale,
    ssfEnrolled: v437.ssfEnrolled,
    pfEnrolled: v437.pfEnrolled,
    citEnrolled: v437.citEnrolled,
    autoCalculateRetirement: v437.autoCalculateRetirement,
    retirementContribution: v437.retirementContribution,
    lifeInsurance: v437.lifeInsurance,
    healthInsurance: v437.healthInsurance,
    buildingInsurance: v437.buildingInsurance,
    medicalExpenses: v437.medicalExpenses,
    remoteAreaClass: v437.remoteAreaClass,
    dashainAllowanceAnnual: v437.dashainAllowanceAnnual,
    dressAllowanceAnnual: v437.dressAllowanceAnnual
  };
  if (!v437.isManual) {
    localStorage.setItem("staff_tax_settings_" + v437.id, JSON.stringify(v450));
  } else {
    syncManualStaffToSupabase();
  }
  closeModal();
  window.updateSalaryRowCalculation(v436);
  renderSalaryRows();
  toast("✅ Tax settings saved for " + v437.name);
};
window.openTaxBreakdownModal = function (v452) {
  const v453 = salaryState.rows.find(v460 => v460.id === v452);
  if (!v453) {
    return;
  }
  const v454 = v453.taxBreakdown;
  if (!v454) {
    toast("No tax breakdown available. Save tax settings first.");
    return;
  }
  const v455 = v461 => "Rs. " + Math.round(v461).toLocaleString();
  const v456 = v462 => "Rs. " + Number(v462 || 0).toFixed(2);
  const v457 = [v454.retirementExemption > 0 && "<tr><td style=\"padding:0.4rem 0.6rem;\">Retirement Fund (SSF/PF/CIT)</td><td style=\"padding:0.4rem 0.6rem; text-align:right; color:#dc2626;\">− " + v455(v454.retirementExemption) + "</td></tr>", v454.lifeExemption > 0 && "<tr><td style=\"padding:0.4rem 0.6rem;\">Life Insurance Premium</td><td style=\"padding:0.4rem 0.6rem; text-align:right; color:#dc2626;\">− " + v455(v454.lifeExemption) + "</td></tr>", v454.healthExemption > 0 && "<tr><td style=\"padding:0.4rem 0.6rem;\">Health Insurance Premium</td><td style=\"padding:0.4rem 0.6rem; text-align:right; color:#dc2626;\">− " + v455(v454.healthExemption) + "</td></tr>", v454.buildingExemption > 0 && "<tr><td style=\"padding:0.4rem 0.6rem;\">Building Insurance Premium</td><td style=\"padding:0.4rem 0.6rem; text-align:right; color:#dc2626;\">− " + v455(v454.buildingExemption) + "</td></tr>", v454.remoteExemption > 0 && "<tr><td style=\"padding:0.4rem 0.6rem;\">Remote Area Allowance</td><td style=\"padding:0.4rem 0.6rem; text-align:right; color:#dc2626;\">− " + v455(v454.remoteExemption) + "</td></tr>"].filter(Boolean).join("");
  const v458 = v454.slabs.map(v463 => "\n        <tr>\n            <td style=\"padding:0.4rem 0.6rem; color:var(--text-muted);\">" + v463.label + "</td>\n            <td style=\"padding:0.4rem 0.6rem; text-align:right; font-weight:600; color:#d97706;\">" + v456(v463.tax) + "</td>\n        </tr>\n    ").join("");
  const v459 = [v454.femaleRebate > 0 && "<tr><td style=\"padding:0.4rem 0.6rem;\">Female Tax Rebate (10%)</td><td style=\"padding:0.4rem 0.6rem; text-align:right; color:#16a34a;\">− " + v456(v454.femaleRebate) + "</td></tr>", v454.medicalCredit > 0 && "<tr><td style=\"padding:0.4rem 0.6rem;\">Medical Tax Credit</td><td style=\"padding:0.4rem 0.6rem; text-align:right; color:#16a34a;\">− " + v456(v454.medicalCredit) + "</td></tr>"].filter(Boolean).join("");
  openModal("\n        <div class=\"modal-handle\"></div>\n        <p class=\"modal-title\">📊 Tax Breakdown — " + escapeHtml(v453.name) + "</p>\n        <p style=\"font-size:0.72rem; color:var(--text-muted); margin-bottom:1rem;\">IRD Nepal FY 2081/82 — Income Tax Computation</p>\n        <div style=\"max-height:65vh; overflow-y:auto;\">\n\n          <!-- Earnings & Deductions -->\n          <div style=\"background:#f8fafc; border-radius:8px; overflow:hidden; margin-bottom:0.75rem; border:1px solid #e2e8f0;\">\n            <div style=\"background:var(--primary); color:white; padding:0.5rem 0.75rem; font-size:0.78rem; font-weight:700;\">ANNUAL EARNINGS &amp; DEDUCTIONS</div>\n            <table style=\"width:100%; border-collapse:collapse; font-size:0.8rem;\">\n              <tr style=\"background:#f0f9ff;\"><td style=\"padding:0.5rem 0.6rem; font-weight:600;\">Gross Annual Earnings</td><td style=\"padding:0.5rem 0.6rem; text-align:right; font-weight:700; color:var(--primary);\">" + v455(v454.annualGross) + "</td></tr>\n              " + (v454.dashainAllowanceAnnual > 0 ? "<tr><td style=\"padding:0.3rem 0.6rem; font-size:0.75rem; color:var(--text-muted); padding-left:1.5rem;\">↳ Annual Dashain Allowance</td><td style=\"padding:0.3rem 0.6rem; text-align:right; font-size:0.75rem; color:var(--text-muted); font-weight:600;\">+ " + v455(v454.dashainAllowanceAnnual) + "</td></tr>" : "") + "\n              " + (v454.dressAllowanceAnnual > 0 ? "<tr><td style=\"padding:0.3rem 0.6rem; font-size:0.75rem; color:var(--text-muted); padding-left:1.5rem;\">↳ Annual Dress Allowance</td><td style=\"padding:0.3rem 0.6rem; text-align:right; font-size:0.75rem; color:var(--text-muted); font-weight:600;\">+ " + v455(v454.dressAllowanceAnnual) + "</td></tr>" : "") + "\n              " + (v454.nonRecurringEarnings && Math.abs(v454.nonRecurringEarnings) > 0 ? "<tr><td style=\"padding:0.3rem 0.6rem; font-size:0.75rem; color:var(--text-muted); padding-left:1.5rem;\">↳ Non-Recurring Earnings (Extra, Leave Adj)</td><td style=\"padding:0.3rem 0.6rem; text-align:right; font-size:0.75rem; color:var(--text-muted); font-weight:600;\">" + (v454.nonRecurringEarnings >= 0 ? "+ " : "− ") + v455(Math.abs(v454.nonRecurringEarnings)) + "</td></tr>" : "") + "\n              " + (v457 || "<tr><td colspan=\"2\" style=\"padding:0.4rem 0.6rem; color:var(--text-muted);\">No deductions configured</td></tr>") + "\n              <tr style=\"border-top:2px solid #e2e8f0; background:#f8fafc;\"><td style=\"padding:0.5rem 0.6rem; font-weight:700;\">Taxable Income</td><td style=\"padding:0.5rem 0.6rem; text-align:right; font-weight:700;\">" + v455(v454.taxableIncome) + "</td></tr>\n            </table>\n          </div>\n\n          <!-- Tax Slabs -->\n          <div style=\"background:#f8fafc; border-radius:8px; overflow:hidden; margin-bottom:0.75rem; border:1px solid #e2e8f0;\">\n            <div style=\"background:#d97706; color:white; padding:0.5rem 0.75rem; font-size:0.78rem; font-weight:700;\">TAX COMPUTATION (PROGRESSIVE SLABS)</div>\n            <table style=\"width:100%; border-collapse:collapse; font-size:0.8rem;\">\n              " + (v458 || "<tr><td colspan=\"2\" style=\"padding:0.4rem 0.6rem; color:var(--text-muted);\">No tax (income within exempt threshold)</td></tr>") + "\n              <tr style=\"border-top:2px solid #e2e8f0; background:#fff7ed;\"><td style=\"padding:0.5rem 0.6rem; font-weight:600;\">Gross Annual Tax</td><td style=\"padding:0.5rem 0.6rem; text-align:right; font-weight:700; color:#d97706;\">" + v456(v454.grossAnnualTax) + "</td></tr>\n            </table>\n          </div>\n\n          " + (v454.femaleRebate > 0 || v454.medicalCredit > 0 ? "\n          <!-- Tax Credits -->\n          <div style=\"background:#f8fafc; border-radius:8px; overflow:hidden; margin-bottom:0.75rem; border:1px solid #e2e8f0;\">\n            <div style=\"background:#16a34a; color:white; padding:0.5rem 0.75rem; font-size:0.78rem; font-weight:700;\">TAX CREDITS</div>\n            <table style=\"width:100%; border-collapse:collapse; font-size:0.8rem;\">\n              " + v459 + "\n            </table>\n          </div>" : "") + "\n\n          <!-- Final TDS -->\n          <div style=\"background:linear-gradient(135deg,#4f46e5,#6366f1); border-radius:8px; padding:1rem; color:white; text-align:center;\">\n            <div style=\"font-size:0.72rem; font-weight:700; opacity:0.85; text-transform:uppercase; letter-spacing:0.05em;\">Monthly TDS (Tax Deducted at Source)</div>\n            <div style=\"font-size:1.8rem; font-weight:900; margin:0.25rem 0;\">" + v456(v454.monthlyTDS) + "</div>\n            <div style=\"font-size:0.72rem; opacity:0.75;\">Annual TDS: " + v456(v454.netAnnualTax) + "</div>\n          </div>\n\n        </div>\n        <button class=\"btn btn-ghost btn-block\" style=\"margin-top:1rem;\" onclick=\"closeModal()\">Close</button>\n    ");
  lucide.createIcons();
};
function getRemoteAreaAnnualDeduction(v464) {
  const v465 = {
    A: 10000,
    B: 20000,
    C: 30000,
    D: 40000,
    E: 50000
  };
  return v465[(v464 || "").toUpperCase()] || 0;
}
function calculateIRDTax(v466, v467 = false, v468 = false, v469 = false, v470 = false, v471 = 0, v472 = 0, v473 = 0, v474 = 0, v475 = 0, v476 = 0, v477 = false, v478 = 0, v479 = 0, v480 = 0) {
  const v481 = (Number(v466) || 0) * 12 + (Number(v478) || 0) + (Number(v479) || 0) + (Number(v480) || 0);
  const v482 = (Number(v471) || 0) * 12;
  const v483 = v468 || v469 || v470;
  const v484 = v468 ? 500000 : 300000;
  const v485 = Math.min(v484, v481 / 3);
  const v486 = v483 ? Math.min(v482, v485) : 0;
  const v487 = Math.min(Number(v472) || 0, 40000);
  const v488 = Math.min(Number(v473) || 0, 20000);
  const v489 = Math.min(Number(v474) || 0, 5000);
  const v490 = Number(v475) || 0;
  const v491 = v486 + v487 + v488 + v489 + v490;
  const v492 = Math.max(0, v481 - v491);
  const v493 = v467 ? 600000 : 500000;
  const v494 = v468 ? 0 : 0.01;
  let v495 = 0;
  const v496 = [];
  if (v492 <= v493) {
    const v502 = v492 * v494;
    v495 += v502;
    v496.push({
      label: "Slab 1 (" + (v494 * 100).toFixed(0) + "% on Rs. " + Math.round(v492).toLocaleString() + ")",
      tax: v502
    });
  } else {
    const v503 = v493 * v494;
    v495 += v503;
    v496.push({
      label: "Slab 1 (" + (v494 * 100).toFixed(0) + "% on Rs. " + v493.toLocaleString() + ")",
      tax: v503
    });
    let v504 = v492 - v493;
    if (v504 > 0) {
      const v505 = Math.min(v504, 200000);
      const v506 = v505 * 0.1;
      v495 += v506;
      v496.push({
        label: "Slab 2 (10% on Rs. " + Math.round(v505).toLocaleString() + ")",
        tax: v506
      });
      v504 -= v505;
    }
    if (v504 > 0) {
      const v507 = Math.min(v504, 300000);
      const v508 = v507 * 0.2;
      v495 += v508;
      v496.push({
        label: "Slab 3 (20% on Rs. " + Math.round(v507).toLocaleString() + ")",
        tax: v508
      });
      v504 -= v507;
    }
    if (v504 > 0) {
      const v509 = Math.min(v504, 1000000);
      const v510 = v509 * 0.3;
      v495 += v510;
      v496.push({
        label: "Slab 4 (30% on Rs. " + Math.round(v509).toLocaleString() + ")",
        tax: v510
      });
      v504 -= v509;
    }
    if (v504 > 0) {
      const v511 = Math.min(v504, 3000000);
      const v512 = v511 * 0.36;
      v495 += v512;
      v496.push({
        label: "Slab 5 (36% on Rs. " + Math.round(v511).toLocaleString() + ")",
        tax: v512
      });
      v504 -= v511;
    }
    if (v504 > 0) {
      const v513 = v504 * 0.39;
      v495 += v513;
      v496.push({
        label: "Slab 6 (39% on Rs. " + Math.round(v504).toLocaleString() + ")",
        tax: v513
      });
    }
  }
  const v497 = v495;
  const v498 = v477 ? Math.round(v495 * 0.1 * 100) / 100 : 0;
  v495 -= v498;
  const v499 = Math.min(750, Math.round((Number(v476) || 0) * 0.15 * 100) / 100);
  v495 = Math.max(0, v495 - v499);
  const v500 = v495;
  const v501 = v500 / 12;
  return {
    monthlyTax: v501,
    breakdown: {
      annualGross: v481,
      dashainAllowanceAnnual: Number(v478) || 0,
      dressAllowanceAnnual: Number(v479) || 0,
      nonRecurringEarnings: Number(v480) || 0,
      retirementExemption: v486,
      lifeExemption: v487,
      healthExemption: v488,
      buildingExemption: v489,
      remoteExemption: v490,
      totalDeductions: v491,
      taxableIncome: v492,
      slabs: v496,
      grossAnnualTax: v497,
      femaleRebate: v498,
      medicalCredit: v499,
      netAnnualTax: v500,
      monthlyTDS: v501
    }
  };
}
window.updateSalaryRowCalculation = function (v514) {
  const v515 = document.querySelector("tr[data-id=\"" + v514 + "\"]");
  if (!v515) {
    return;
  }
  const v516 = salaryState.rows.find(v523 => v523.id === v514);
  if (!v516) {
    return;
  }
  v516.post = v515.querySelector(".row-post").value;
  if (v516.isManual) {
    v516.name = v515.querySelector(".row-name").value;
  }
  v516.basic = Number(v515.querySelector(".row-basic").value) || 0;
  v516.mahangi = Number(v515.querySelector(".row-mahangi").value) || 0;
  v516.advance = Number(v515.querySelector(".row-advance").value) || 0;
  v516.deduction = Number(v515.querySelector(".row-deduction").value) || 0;
  v516.dashain = Number(v515.querySelector(".row-dashain").value) || 0;
  v516.extra = Number(v515.querySelector(".row-extra").value) || 0;
  v516.leaveSaveDays = Number(v515.querySelector(".row-leave-save").value) || 0;
  v516.leaveLossDays = Number(v515.querySelector(".row-leave-loss").value) || 0;
  if (!v516.isManual) {
    localStorage.setItem("staff_basic_salary_" + v516.id, v516.basic);
    localStorage.setItem("staff_mahangi_" + v516.id, v516.mahangi);
  } else {
    syncManualStaffToSupabase();
  }
  v516.leaveSaveAmount = Math.round(v516.leaveSaveDays * (v516.basic / 30) * 100) / 100;
  v516.leaveLossAmount = Math.round(v516.leaveLossDays * (v516.basic / 30) * 100) / 100;
  v516.grossEarnings = v516.basic + v516.mahangi + v516.dashain + v516.extra + v516.leaveSaveAmount - v516.leaveLossAmount;
  v516.grossEarnings = Math.round(v516.grossEarnings * 100) / 100;
  v516.grandTotal = v516.grossEarnings - v516.advance - v516.deduction;
  v516.grandTotal = Math.round(v516.grandTotal * 100) / 100;
  if (v516.autoCalculateRetirement) {
    if (v516.ssfEnrolled) {
      v516.retirementContribution = Math.round(v516.basic * 0.11 * 100) / 100;
      v516.employerContribution = Math.round(v516.basic * 0.2 * 100) / 100;
    } else if (v516.pfEnrolled) {
      v516.retirementContribution = Math.round(v516.basic * 0.1 * 100) / 100;
      v516.employerContribution = Math.round(v516.basic * 0.1 * 100) / 100;
    }
  } else if (v516.ssfEnrolled) {
    v516.employerContribution = Math.round(v516.basic * 0.2 * 100) / 100;
  } else if (v516.pfEnrolled) {
    v516.employerContribution = Math.round(v516.basic * 0.1 * 100) / 100;
  } else {
    v516.employerContribution = 0;
  }
  const v517 = getRemoteAreaAnnualDeduction(v516.remoteAreaClass || "none");
  const v518 = v516.basic + v516.mahangi;
  const v519 = v516.extra + v516.leaveSaveAmount - v516.leaveLossAmount;
  const v520 = v516.dashain > 0 ? v516.dashain : v516.dashainAllowanceAnnual !== undefined ? v516.dashainAllowanceAnnual : v516.basic;
  const v521 = v516.dressAllowanceAnnual || 0;
  const v522 = calculateIRDTax(v518, v516.isMarried, v516.ssfEnrolled, v516.citEnrolled, v516.pfEnrolled || false, v516.retirementContribution || 0, v516.lifeInsurance || 0, v516.healthInsurance || 0, v516.buildingInsurance || 0, v517, v516.medicalExpenses || 0, v516.isFemale || false, v520, v521, v519);
  v516.tax = Math.round(v522.monthlyTax * 100) / 100;
  v516.taxBreakdown = v522.breakdown;
  v516.netAmount = Math.round((v516.grandTotal - v516.tax - (v516.retirementContribution || 0)) * 100) / 100;
  v515.querySelector(".row-leavesave-amt").textContent = "Rs. " + v516.leaveSaveAmount.toFixed(2);
  v515.querySelector(".row-leaveloss-amt").textContent = "Rs. " + v516.leaveLossAmount.toFixed(2);
  v515.querySelector(".row-gross").textContent = "Rs. " + v516.grossEarnings.toFixed(2);
  v515.querySelector(".row-grand").textContent = "Rs. " + v516.grandTotal.toFixed(2);
  v515.querySelector(".row-tax").textContent = "Rs. " + v516.tax.toFixed(2);
  v515.querySelector(".row-retirement").textContent = "Rs. " + (v516.retirementContribution || 0).toFixed(2);
  v515.querySelector(".row-net").textContent = "Rs. " + v516.netAmount.toFixed(2);
  updateSalaryTotals();
};
function updateSalaryTotals() {
  let v524 = 0;
  let v525 = 0;
  let v526 = 0;
  let v527 = 0;
  let v528 = 0;
  let v529 = 0;
  let v530 = 0;
  let v531 = 0;
  let v532 = 0;
  let v533 = 0;
  let v534 = 0;
  let v535 = 0;
  let v536 = 0;
  salaryState.rows.forEach(v538 => {
    v524 += v538.basic || 0;
    v525 += v538.mahangi || 0;
    v526 += v538.advance || 0;
    v527 += v538.deduction || 0;
    v528 += v538.dashain || 0;
    v529 += v538.extra || 0;
    v530 += v538.leaveSaveAmount || 0;
    v531 += v538.leaveLossAmount || 0;
    v532 += v538.grossEarnings || 0;
    v533 += v538.grandTotal || 0;
    v534 += v538.tax || 0;
    v535 += v538.retirementContribution || 0;
    v536 += v538.netAmount || 0;
  });
  const v537 = v539 => "Rs. " + v539.toFixed(2);
  document.getElementById("salary-total-basic").textContent = v537(v524);
  if (document.getElementById("salary-total-mahangi")) {
    document.getElementById("salary-total-mahangi").textContent = v537(v525);
  }
  document.getElementById("salary-total-advance").textContent = v537(v526);
  document.getElementById("salary-total-deduction").textContent = v537(v527);
  document.getElementById("salary-total-dashain").textContent = v537(v528);
  document.getElementById("salary-total-extra").textContent = v537(v529);
  document.getElementById("salary-total-leavesave").textContent = v537(v530);
  document.getElementById("salary-total-leaveloss").textContent = v537(v531);
  document.getElementById("salary-total-gross").textContent = v537(v532);
  document.getElementById("salary-total-grand").textContent = v537(v533);
  document.getElementById("salary-total-tax").textContent = v537(v534);
  if (document.getElementById("salary-total-retirement")) {
    document.getElementById("salary-total-retirement").textContent = v537(v535);
  }
  document.getElementById("salary-total-net").textContent = v537(v536);
}
window.addManualSalaryRow = function () {
  openModal("\n        <div class=\"modal-handle\"></div>\n        <p class=\"modal-title\">➕ Add Staff / Teacher</p>\n        <div class=\"form-group\">\n            <label class=\"form-label\">Full Name <span style=\"color:#ef4444;\">*</span></label>\n            <input type=\"text\" id=\"new-staff-name\" class=\"form-input\" placeholder=\"e.g. Ram Bahadur Shrestha\" autofocus autocomplete=\"off\">\n        </div>\n        <div class=\"form-group\">\n            <label class=\"form-label\">Post / Designation</label>\n            <select id=\"new-staff-post\" class=\"form-input\">\n                <option value=\"Teacher\">Teacher</option>\n                <option value=\"Principal\">Principal</option>\n                <option value=\"Assistant Teacher\">Assistant Teacher</option>\n                <option value=\"Accountant\">Accountant</option>\n                <option value=\"Support Staff\">Support Staff</option>\n                <option value=\"Helper\">Helper</option>\n            </select>\n        </div>\n        <div class=\"form-group\">\n            <label class=\"form-label\">Basic Salary (Rs.) <span style=\"color:#ef4444;\">*</span></label>\n            <input type=\"number\" id=\"new-staff-salary\" class=\"form-input\" placeholder=\"e.g. 15000\" min=\"1000\" step=\"500\" value=\"15000\">\n        </div>\n        <div style=\"background:#f0f9ff; border:1px solid #bae6fd; border-radius:0.5rem; padding:0.75rem; margin-bottom:1rem; font-size:0.78rem; color:#0369a1;\">\n            <strong>💡 IRD Tax Auto-Calculated:</strong> Tax will be calculated automatically based on Nepal IRD income tax brackets.\n        </div>\n        <button class=\"btn btn-primary btn-block\" onclick=\"window._confirmAddStaff()\">\n            <i data-lucide=\"user-plus\" style=\"width:16px; height:16px;\"></i> Add to Salary Sheet\n        </button>\n        <button class=\"btn btn-ghost btn-block\" style=\"margin-top:0.5rem\" onclick=\"closeModal()\">Cancel</button>\n    ");
  lucide.createIcons();
  setTimeout(() => document.getElementById("new-staff-name")?.focus(), 100);
};
window._confirmAddStaff = function () {
  const v540 = (document.getElementById("new-staff-name")?.value || "").trim();
  const v541 = document.getElementById("new-staff-post")?.value || "Teacher";
  const v542 = Number(document.getElementById("new-staff-salary")?.value || 0);
  if (!v540) {
    toast("⚠️ Please enter the staff name.");
    document.getElementById("new-staff-name")?.focus();
    return;
  }
  if (!v542 || v542 < 100) {
    toast("⚠️ Please enter a valid basic salary (min Rs. 100).");
    document.getElementById("new-staff-salary")?.focus();
    return;
  }
  const v543 = calculateIRDTax(v542, false, false, false, false, 0, 0, 0, 0, 0, 0, false, v542, 0, 0);
  const v544 = Math.round(v543.monthlyTax * 100) / 100;
  const v545 = v542;
  const v546 = Math.round((v545 - v544) * 100) / 100;
  const v547 = "manual-" + Date.now() + "-" + Math.random().toString(36).substr(2, 6);
  salaryState.rows.push({
    id: v547,
    post: v541,
    name: v540,
    basic: v542,
    mahangi: 0,
    advance: 0,
    deduction: 0,
    dashain: 0,
    extra: 0,
    leaveSaveDays: 0,
    leaveLossDays: 0,
    leaveSaveAmount: 0,
    leaveLossAmount: 0,
    grossEarnings: v545,
    grandTotal: v545,
    isMarried: false,
    isFemale: false,
    ssfEnrolled: false,
    pfEnrolled: false,
    citEnrolled: false,
    autoCalculateRetirement: false,
    retirementContribution: 0,
    employerContribution: 0,
    lifeInsurance: 0,
    healthInsurance: 0,
    buildingInsurance: 0,
    remoteAreaClass: "none",
    medicalExpenses: 0,
    dashainAllowanceAnnual: v542,
    dressAllowanceAnnual: 0,
    tax: v544,
    taxBreakdown: v543.breakdown,
    netAmount: v546,
    isManual: true
  });
  syncManualStaffToSupabase();
  closeModal();
  renderSalaryRows();
  toast("✅ " + v540 + " added to salary sheet!");
};
window.deleteSalaryRow = function (v548) {
  const v549 = salaryState.rows.find(v552 => v552.id === v548);
  if (!v549) {
    return;
  }
  const v550 = v549.isManual;
  const v551 = v549.name || "this staff member";
  openModal("\n        <div class=\"modal-handle\"></div>\n        <div style=\"text-align:center; padding:0.5rem 0 1rem;\">\n            <div style=\"width:56px; height:56px; background:#fee2e2; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 1rem;\">\n                <i data-lucide=\"trash-2\" style=\"width:24px; height:24px; color:#ef4444;\"></i>\n            </div>\n            <h3 style=\"margin-bottom:0.5rem; color:#1e293b;\">Remove " + escapeHtml(v551) + "?</h3>\n            <p style=\"font-size:0.8rem; color:#64748b; margin-bottom:1.5rem;\">\n                " + (v550 ? "This will permanently remove this staff member from the salary sheet and local storage." : "This will remove this teacher from the current salary sheet only. They can be reloaded next time.") + "\n            </p>\n        </div>\n        <button class=\"btn btn-danger btn-block\" onclick=\"window._confirmDeleteRow('" + v548 + "')\">\n            <i data-lucide=\"trash-2\" style=\"width:16px; height:16px;\"></i> Yes, Remove\n        </button>\n        <button class=\"btn btn-ghost btn-block\" style=\"margin-top:0.5rem\" onclick=\"closeModal()\">Cancel</button>\n    ");
  lucide.createIcons();
};
window._confirmDeleteRow = function (v553) {
  salaryState.rows = salaryState.rows.filter(v554 => v554.id !== v553);
  syncManualStaffToSupabase();
  closeModal();
  renderSalaryRows();
  toast("Staff member removed from salary sheet.");
};
window.saveSalaryVoucher = async function () {
  if (!salaryState.rows || salaryState.rows.length === 0) {
    toast("No salary records to record.");
    return;
  }
  const v555 = salaryState.rows.reduce((v558, v559) => v558 + v559.netAmount, 0);
  const v556 = "[Salary Voucher: " + salaryState.year + " " + salaryState.month + "]";
  const v557 = v556 + " JSON:" + JSON.stringify({
    rows: salaryState.rows
  });
  try {
    toast("Saving salary distribution voucher...");
    const v560 = window.currentUserProfile?.id;
    const v561 = allExpenditures.find(v563 => v563.category === "Salary" && v563.description && v563.description.startsWith(v556));
    let v562;
    if (v561) {
      v562 = await v1.from("expenditures").update({
        amount: v555,
        description: v557,
        paid_to: "Staff Payroll (" + salaryState.rows.length + " members)",
        recorded_by: v560
      }).eq("id", v561.id);
    } else {
      v562 = await v1.from("expenditures").insert({
        category: "Salary",
        amount: v555,
        description: v557,
        paid_to: "Staff Payroll (" + salaryState.rows.length + " members)",
        recorded_by: v560
      });
    }
    if (v562.error) {
      throw v562.error;
    }
    toast("✅ Staff payroll recorded successfully for " + salaryState.month + " " + salaryState.year + "!");
    await loadInitialData();
  } catch (v564) {
    console.error("Save error:", v564);
    toast("Failed to save payroll voucher: " + v564.message);
  }
};
window.exportSalaryToExcel = function () {
  toast("Generating Excel salary distribution sheet...");
  const v565 = salaryState.rows.map((v570, v571) => ({
    "S.N.": v571 + 1,
    Post: v570.post,
    Name: v570.name,
    "Basic Salary": v570.basic,
    "Mahangi Bhatta": v570.mahangi || 0,
    "Advance (-)": v570.advance,
    "Other Deduction (-)": v570.deduction,
    "Dashain Allowance": v570.dashain,
    "Extra Class": v570.extra,
    "Leave Save (+)": v570.leaveSaveAmount,
    "Leave Loss (-)": v570.leaveLossAmount,
    "Taxable Gross": v570.grossEarnings,
    "Grand Total": v570.grandTotal,
    "TDS / Income Tax (-)": v570.tax,
    "Emp. PF/SSF/CIT (-)": v570.retirementContribution || 0,
    "Net Payable": v570.netAmount
  }));
  const v566 = v572 => salaryState.rows.reduce((v573, v574) => v573 + (v574[v572] || 0), 0);
  const v567 = {
    "S.N.": "Total",
    Post: "",
    Name: "",
    "Basic Salary": v566("basic"),
    "Mahangi Bhatta": v566("mahangi"),
    "Advance (-)": v566("advance"),
    "Other Deduction (-)": v566("deduction"),
    "Dashain Allowance": v566("dashain"),
    "Extra Class": v566("extra"),
    "Leave Save (+)": v566("leaveSaveAmount"),
    "Leave Loss (-)": v566("leaveLossAmount"),
    "Taxable Gross": v566("grossEarnings"),
    "Grand Total": v566("grandTotal"),
    "TDS / Income Tax (-)": v566("tax"),
    "Emp. PF/SSF/CIT (-)": v566("retirementContribution"),
    "Net Payable": v566("netAmount")
  };
  v565.push(v567);
  const v568 = XLSX.utils.json_to_sheet(v565);
  const v569 = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(v569, v568, "Salary Distribution");
  v568["!cols"] = [{
    wch: 5
  }, {
    wch: 14
  }, {
    wch: 26
  }, {
    wch: 12
  }, {
    wch: 12
  }, {
    wch: 12
  }, {
    wch: 14
  }, {
    wch: 14
  }, {
    wch: 12
  }, {
    wch: 12
  }, {
    wch: 12
  }, {
    wch: 14
  }, {
    wch: 14
  }, {
    wch: 18
  }, {
    wch: 18
  }, {
    wch: 14
  }];
  XLSX.writeFile(v569, "Salary_Distribution_Voucher_" + salaryState.month + "_" + salaryState.year + ".xlsx");
};
window.printSalaryVoucher = function () {
  const v575 = "Salary Distribution Voucher For The Month Of " + salaryState.month + " " + salaryState.year;
  const v576 = salaryState.rows.map((v589, v590) => "\n        <tr style=\"border-bottom: 1px solid #e2e8f0; font-size:0.7rem;\">\n            <td style=\"padding: 6px; text-align: center; border: 1px solid #cbd5e1;\">" + (v590 + 1) + "</td>\n            <td style=\"padding: 6px; border: 1px solid #cbd5e1;\">" + escapeHtml(v589.post) + "</td>\n            <td style=\"padding: 6px; border: 1px solid #cbd5e1; font-weight: 500;\">" + escapeHtml(v589.name) + "</td>\n            <td style=\"padding: 6px; text-align: right; border: 1px solid #cbd5e1;\">" + v589.basic.toFixed(2) + "</td>\n            <td style=\"padding: 6px; text-align: right; border: 1px solid #cbd5e1;\">" + (v589.mahangi || 0).toFixed(2) + "</td>\n            <td style=\"padding: 6px; text-align: right; border: 1px solid #cbd5e1;\">" + v589.advance.toFixed(2) + "</td>\n            <td style=\"padding: 6px; text-align: right; border: 1px solid #cbd5e1;\">" + v589.deduction.toFixed(2) + "</td>\n            <td style=\"padding: 6px; text-align: right; border: 1px solid #cbd5e1;\">" + v589.dashain.toFixed(2) + "</td>\n            <td style=\"padding: 6px; text-align: right; border: 1px solid #cbd5e1;\">" + v589.extra.toFixed(2) + "</td>\n            <td style=\"padding: 6px; text-align: right; border: 1px solid #cbd5e1;\">" + v589.leaveSaveAmount.toFixed(2) + "</td>\n            <td style=\"padding: 6px; text-align: right; border: 1px solid #cbd5e1;\">" + v589.leaveLossAmount.toFixed(2) + "</td>\n            <td style=\"padding: 6px; text-align: right; border: 1px solid #cbd5e1; font-weight:bold; color:var(--primary);\">" + v589.grossEarnings.toFixed(2) + "</td>\n            <td style=\"padding: 6px; text-align: right; border: 1px solid #cbd5e1; font-weight:bold;\">" + v589.grandTotal.toFixed(2) + "</td>\n            <td style=\"padding: 6px; text-align: right; border: 1px solid #cbd5e1; color:#ef4444;\">" + v589.tax.toFixed(2) + "</td>\n            <td style=\"padding: 6px; text-align: right; border: 1px solid #cbd5e1; font-weight:bold; background:#f0f9ff; color:#0369a1;\">" + v589.netAmount.toFixed(2) + "</td>\n        </tr>\n    ").join("");
  let v577 = 0;
  let v578 = 0;
  let v579 = 0;
  let v580 = 0;
  let v581 = 0;
  let v582 = 0;
  let v583 = 0;
  let v584 = 0;
  let v585 = 0;
  let v586 = 0;
  let v587 = 0;
  let v588 = 0;
  salaryState.rows.forEach(v591 => {
    v577 += v591.basic || 0;
    v578 += v591.mahangi || 0;
    v579 += v591.advance || 0;
    v580 += v591.deduction || 0;
    v581 += v591.dashain || 0;
    v582 += v591.extra || 0;
    v583 += v591.leaveSaveAmount || 0;
    v584 += v591.leaveLossAmount || 0;
    v585 += v591.grossEarnings || 0;
    v586 += v591.grandTotal || 0;
    v587 += v591.tax || 0;
    v588 += v591.netAmount || 0;
  });
  openModal("\n        <div class=\"modal-handle\"></div>\n        <div style=\"text-align:center; margin-bottom:1rem;\">\n            <h2 style=\"color:var(--primary); margin:0; font-size:1.15rem;\">Salary Voucher Print Preview</h2>\n            <p style=\"font-size:0.75rem; color:var(--text-muted);\">Review details before printing</p>\n        </div>\n        \n        <div style=\"max-height: 50vh; overflow-x: auto; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 0.75rem; padding: 1rem; background: white; margin-bottom: 1.25rem; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);\">\n            <div style=\"min-width: 950px; font-family:'Inter', sans-serif;\">\n                <!-- Header -->\n                <div style=\"text-align: center; margin-bottom: 1rem; border-bottom: 2px solid #000; padding-bottom: 0.5rem;\">\n                    <h3 style=\"margin: 0; color: #000; font-size: 1.2rem; font-weight:800;\">Holy Garden English Secondary School</h3>\n                    <p style=\"margin: 2px 0; font-size: 0.7rem; color: #444;\">Byasi, Bhaktapur-2 | Tel: 016616748</p>\n                    <h4 style=\"margin: 4px 0 0 0; font-size: 0.9rem; text-transform: uppercase; font-weight:700;\">" + v575 + "</h4>\n                </div>\n                \n                <!-- Table -->\n                <table style=\"width: 100%; border-collapse: collapse; font-size: 0.65rem; border: 1px solid #cbd5e1;\">\n                    <thead>\n                        <tr style=\"background: #f8fafc; border-bottom: 1px solid #cbd5e1; font-weight:700;\">\n                            <th style=\"padding: 6px; text-align: center; border: 1px solid #cbd5e1;\">S.N.</th>\n                            <th style=\"padding: 6px; text-align: left; border: 1px solid #cbd5e1;\">Post</th>\n                            <th style=\"padding: 6px; text-align: left; border: 1px solid #cbd5e1;\">Name</th>\n                            <th style=\"padding: 6px; text-align: right; border: 1px solid #cbd5e1;\">Basic</th>\n                            <th style=\"padding: 6px; text-align: right; border: 1px solid #cbd5e1;\">Mahangi</th>\n                            <th style=\"padding: 6px; text-align: right; border: 1px solid #cbd5e1;\">Advance</th>\n                            <th style=\"padding: 6px; text-align: right; border: 1px solid #cbd5e1;\">Deduction</th>\n                            <th style=\"padding: 6px; text-align: right; border: 1px solid #cbd5e1;\">Dashain</th>\n                            <th style=\"padding: 6px; text-align: right; border: 1px solid #cbd5e1;\">Extra</th>\n                            <th style=\"padding: 6px; text-align: right; border: 1px solid #cbd5e1;\">Leave (+)</th>\n                            <th style=\"padding: 6px; text-align: right; border: 1px solid #cbd5e1;\">Leave (-)</th>\n                            <th style=\"padding: 6px; text-align: right; border: 1px solid #cbd5e1; color:var(--primary);\">Gross</th>\n                            <th style=\"padding: 6px; text-align: right; border: 1px solid #cbd5e1;\">Grand</th>\n                            <th style=\"padding: 6px; text-align: right; border: 1px solid #cbd5e1;\">Tax</th>\n                            <th style=\"padding: 6px; text-align: right; border: 1px solid #cbd5e1;\">Net</th>\n                        </tr>\n                    </thead>\n                    <tbody>\n                        " + v576 + "\n                    </tbody>\n                    <tfoot style=\"font-weight:bold; background:#f8fafc;\">\n                        <tr style=\"border-top: 1px solid #cbd5e1;\">\n                            <td colspan=\"3\" style=\"padding: 6px; text-align: right; border: 1px solid #cbd5e1;\">Total:</td>\n                            <td style=\"padding: 6px; text-align: right; border: 1px solid #cbd5e1;\">" + v577.toFixed(2) + "</td>\n                            <td style=\"padding: 6px; text-align: right; border: 1px solid #cbd5e1;\">" + v578.toFixed(2) + "</td>\n                            <td style=\"padding: 6px; text-align: right; border: 1px solid #cbd5e1;\">" + v579.toFixed(2) + "</td>\n                            <td style=\"padding: 6px; text-align: right; border: 1px solid #cbd5e1;\">" + v580.toFixed(2) + "</td>\n                            <td style=\"padding: 6px; text-align: right; border: 1px solid #cbd5e1;\">" + v581.toFixed(2) + "</td>\n                            <td style=\"padding: 6px; text-align: right; border: 1px solid #cbd5e1;\">" + v582.toFixed(2) + "</td>\n                            <td style=\"padding: 6px; text-align: right; border: 1px solid #cbd5e1;\">" + v583.toFixed(2) + "</td>\n                            <td style=\"padding: 6px; text-align: right; border: 1px solid #cbd5e1;\">" + v584.toFixed(2) + "</td>\n                            <td style=\"padding: 6px; text-align: right; border: 1px solid #cbd5e1; color:var(--primary);\">" + v585.toFixed(2) + "</td>\n                            <td style=\"padding: 6px; text-align: right; border: 1px solid #cbd5e1;\">" + v586.toFixed(2) + "</td>\n                            <td style=\"padding: 6px; text-align: right; border: 1px solid #cbd5e1;\">" + v587.toFixed(2) + "</td>\n                            <td style=\"padding: 6px; text-align: right; border: 1px solid #cbd5e1; color:#0369a1;\">" + v588.toFixed(2) + "</td>\n                        </tr>\n                    </tfoot>\n                </table>\n            </div>\n        </div>\n\n        <div style=\"display:flex; gap:0.5rem;\">\n            <button class=\"btn btn-primary\" style=\"flex:1\" onclick=\"window.triggerSalaryPrint('" + v575.replace(/'/g, "\\'") + "', '" + v576.replace(/'/g, "\\'").replace(/\n/g, "") + "', " + v577 + ", " + v578 + ", " + v579 + ", " + v580 + ", " + v581 + ", " + v582 + ", " + v583 + ", " + v584 + ", " + v585 + ", " + v586 + ", " + v587 + ", " + v588 + ")\">\n                <i data-lucide=\"printer\" style=\"width:16px; height:16px; margin-right:6px;\"></i> Print Voucher\n            </button>\n            <button class=\"btn btn-ghost\" style=\"flex:1; border:1px solid #e2e8f0;\" onclick=\"closeModal()\">Cancel</button>\n        </div>\n    ");
  lucide.createIcons();
};
window.triggerSalaryPrint = function (v592, v593, v594, v595, v596, v597, v598, v599, v600, v601, v602, v603, v604, v605) {
  const v606 = document.getElementById("print-salary-title");
  if (v606) {
    v606.textContent = v592;
  }
  const v607 = document.getElementById("print-salary-rows");
  if (!v607) {
    return;
  }
  v607.innerHTML = salaryState.rows.map((v608, v609) => "\n        <tr style=\"border-bottom: 1px solid #000;\">\n            <td style=\"padding: 6px; text-align: center; border: 1px solid #000;\">" + (v609 + 1) + "</td>\n            <td style=\"padding: 6px; border: 1px solid #000;\">" + escapeHtml(v608.post) + "</td>\n            <td style=\"padding: 6px; border: 1px solid #000; font-weight: 500;\">" + escapeHtml(v608.name) + "</td>\n            <td style=\"padding: 6px; text-align: right; border: 1px solid #000;\">" + v608.basic.toFixed(2) + "</td>\n            <td style=\"padding: 6px; text-align: right; border: 1px solid #000;\">" + (v608.mahangi || 0).toFixed(2) + "</td>\n            <td style=\"padding: 6px; text-align: right; border: 1px solid #000;\">" + v608.advance.toFixed(2) + "</td>\n            <td style=\"padding: 6px; text-align: right; border: 1px solid #000;\">" + v608.deduction.toFixed(2) + "</td>\n            <td style=\"padding: 6px; text-align: right; border: 1px solid #000;\">" + v608.dashain.toFixed(2) + "</td>\n            <td style=\"padding: 6px; text-align: right; border: 1px solid #000;\">" + v608.extra.toFixed(2) + "</td>\n            <td style=\"padding: 6px; text-align: right; border: 1px solid #000;\">" + v608.leaveSaveAmount.toFixed(2) + "</td>\n            <td style=\"padding: 6px; text-align: right; border: 1px solid #000;\">" + v608.leaveLossAmount.toFixed(2) + "</td>\n            <td style=\"padding: 6px; text-align: right; border: 1px solid #000; font-weight:bold; color:var(--primary);\">" + v608.grossEarnings.toFixed(2) + "</td>\n            <td style=\"padding: 6px; text-align: right; border: 1px solid #000; font-weight:bold;\">" + v608.grandTotal.toFixed(2) + "</td>\n            <td style=\"padding: 6px; text-align: right; border: 1px solid #000; color:#ef4444;\">" + v608.tax.toFixed(2) + "</td>\n            <td style=\"padding: 6px; text-align: right; border: 1px solid #000; font-weight:bold; background:#f8fafc;\">" + v608.netAmount.toFixed(2) + "</td>\n        </tr>\n    ").join("");
  document.getElementById("print-salary-total-basic").textContent = v594.toFixed(2);
  if (document.getElementById("print-salary-total-mahangi")) {
    document.getElementById("print-salary-total-mahangi").textContent = v595.toFixed(2);
  }
  document.getElementById("print-salary-total-advance").textContent = v596.toFixed(2);
  document.getElementById("print-salary-total-deduction").textContent = v597.toFixed(2);
  document.getElementById("print-salary-total-dashain").textContent = v598.toFixed(2);
  document.getElementById("print-salary-total-extra").textContent = v599.toFixed(2);
  document.getElementById("print-salary-total-leavesave").textContent = v600.toFixed(2);
  document.getElementById("print-salary-total-leaveloss").textContent = v601.toFixed(2);
  document.getElementById("print-salary-total-gross").textContent = v602.toFixed(2);
  document.getElementById("print-salary-total-grand").textContent = v603.toFixed(2);
  document.getElementById("print-salary-total-tax").textContent = v604.toFixed(2);
  document.getElementById("print-salary-total-net").textContent = v605.toFixed(2);
  document.getElementById("receipt-print-template").style.display = "none";
  document.getElementById("statement-print-template").style.display = "none";
  document.getElementById("salary-print-template").style.display = "block";
  window.print();
};
window.moveSalaryRowUp = function (v610) {
  if (v610 <= 0 || !salaryState.rows || v610 >= salaryState.rows.length) {
    return;
  }
  const v611 = salaryState.rows[v610];
  salaryState.rows[v610] = salaryState.rows[v610 - 1];
  salaryState.rows[v610 - 1] = v611;
  renderSalaryRows();
};
window.moveSalaryRowDown = function (v612) {
  if (!salaryState.rows || v612 < 0 || v612 >= salaryState.rows.length - 1) {
    return;
  }
  const v613 = salaryState.rows[v612];
  salaryState.rows[v612] = salaryState.rows[v612 + 1];
  salaryState.rows[v612 + 1] = v613;
  renderSalaryRows();
};
if (typeof document !== "undefined") {
  document.addEventListener("keydown", function (v614) {
    const v615 = document.activeElement;
    if (!v615 || !v615.closest("#salary-table") || v615.tagName !== "INPUT") {
      return;
    }
    const v616 = v615;
    const v617 = v616.closest("tr");
    if (!v617) {
      return;
    }
    const v618 = [".row-post", ".row-name", ".row-basic", ".row-advance", ".row-deduction", ".row-dashain", ".row-extra", ".row-leave-save", ".row-leave-loss"];
    let v619 = null;
    for (const v622 of v618) {
      if (v616.classList.contains(v622.substring(1))) {
        v619 = v622;
        break;
      }
    }
    if (!v619) {
      return;
    }
    const v620 = Array.from(v617.parentNode.children);
    const v621 = v620.indexOf(v617);
    if (v614.key === "ArrowDown" || v614.key === "Enter") {
      if (v621 < v620.length - 2) {
        const v623 = v620[v621 + 1];
        const v624 = v623.querySelector(v619);
        if (v624) {
          v614.preventDefault();
          v624.focus();
          v624.select();
        }
      }
    } else if (v614.key === "ArrowUp") {
      if (v621 > 0) {
        const v625 = v620[v621 - 1];
        const v626 = v625.querySelector(v619);
        if (v626) {
          v614.preventDefault();
          v626.focus();
          v626.select();
        }
      }
    } else if (v614.key === "ArrowRight") {
      const v627 = v618.indexOf(v619);
      if (v627 < v618.length - 1) {
        for (let v628 = v627 + 1; v628 < v618.length; v628++) {
          const v629 = v617.querySelector(v618[v628]);
          if (v629) {
            v614.preventDefault();
            v629.focus();
            v629.select();
            break;
          }
        }
      }
    } else if (v614.key === "ArrowLeft") {
      const v630 = v618.indexOf(v619);
      if (v630 > 0) {
        for (let v631 = v630 - 1; v631 >= 0; v631--) {
          const v632 = v617.querySelector(v618[v631]);
          if (v632) {
            v614.preventDefault();
            v632.focus();
            v632.select();
            break;
          }
        }
      }
    }
  });
}