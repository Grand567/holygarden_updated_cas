window.fetchAndRenderWeeklyRubric = async function (v930, v931, v932, v933 = true) {
  const v934 = document.getElementById("cas-rubric-interactive-grid");
  if (!v934) {
    return;
  }
  try {
    const {
      data: v935,
      error: v936
    } = await v1.from("cas_weekly_logs").select("rubric_data").eq("student_id", v930).eq("term_id", v931).eq("week_number", v932).maybeSingle();
    if (v936) {
      throw v936;
    }
    let v937 = {};
    if (v935 && v935.rubric_data) {
      try {
        const v938 = atob(v935.rubric_data);
        v937 = JSON.parse(v938);
      } catch (v939) {
        console.warn("Failed to decompress rubric data", v939);
        v937 = v935.rubric_data;
      }
    }
    v934.innerHTML = window.views.renderRubricButtonMatrix(v937, v933);
    if (window.lucide) {
      lucide.createIcons();
    }
    await window.calculateTermAggregateCas(v930, v931);
  } catch (v940) {
    toast("Error matching rubric config parameters: " + v940.message);
  }
};
window.saveWeeklyCasRubrics = async function (v941) {
  const v942 = (window.state?.students || []).find(v952 => v952.id === v941);
  const v943 = window.getTeacherAssignments();
  const v944 = v943.assignments.some(v953 => v953.className === v942?.class && v953.isHomeroom);
  const v945 = window.currentUserProfile?.role === "admin";
  if (!v945 && !v944) {
    toast("Access denied: Only the Homeroom Teacher can save evaluations.");
    return;
  }
  const v946 = document.getElementById("cas-term-picker").value;
  const v947 = parseInt(document.getElementById("cas-week-picker").value);
  const v948 = document.getElementById("cas-submit-rubric-btn");
  v948.disabled = true;
  v948.innerHTML = "<i class=\"loader animate-spin\"></i> Synchronizing Log Entries...";
  const v949 = {};
  const v950 = document.querySelectorAll(".rubric-row");
  v950.forEach(v954 => {
    const v955 = v954.dataset.criterionId;
    const v956 = v954.querySelector(".r-btn.active");
    if (v956) {
      v949[v955] = parseInt(v956.innerText);
    }
  });
  const v951 = {
    student_id: v941,
    term_id: v946,
    week_number: v947,
    evaluated_by: window.currentUser?.id || null,
    rubric_data: v949,
    updated_at: new Date().toISOString()
  };
  try {
    const v957 = btoa(JSON.stringify(v949));
    const {
      error: v958
    } = await v1.from("cas_weekly_logs").upsert({
      ...v951,
      rubric_data: v957
    }, {
      onConflict: "student_id,term_id,week_number"
    });
    if (v958) {
      throw v958;
    }
    await logActivity("Saved Weekly CAS Rubrics", "Student: " + v941 + ", Week: " + v947 + ", Term: " + v946);
    toast("Weekly configuration parameters pushed successfully.");
    await window.calculateTermAggregateCas(v941, v946);
  } catch (v959) {
    toast("Sync failure: " + v959.message);
  } finally {
    v948.disabled = false;
    v948.innerHTML = "<i class=\"lucide-check-circle\"></i> Save Weekly Blueprint";
    if (window.lucide) {
      lucide.createIcons();
    }
  }
};
window.calculateTermAggregateCas = async function (v960, v961) {
  const v962 = document.getElementById("cas-term-summary-output");
  if (!v962) {
    return;
  }
  try {
    const {
      data: v963,
      error: v964
    } = await v1.from("cas_weekly_logs").select("rubric_data").eq("student_id", v960).eq("term_id", v961).range(0, PAGE_SIZE - 1);
    if (v964) {
      throw v964;
    }
    if (!v963 || v963.length === 0) {
      v962.innerHTML = "<div class=\"info-banner\" style=\"background: #eff6ff; color: #1e40af; border: 1px dashed #bfdbfe; padding: 1rem; border-radius: 8px; font-size: 0.8rem; text-align: center; font-weight: 600;\">No evaluation records saved for this term context yet.</div>";
      return;
    }
    const v965 = {
      attendance: 0,
      classwork: 0,
      project: 0,
      behavior: 0,
      portfolio: 0
    };
    const v966 = {
      attendance: 0,
      classwork: 0,
      project: 0,
      behavior: 0,
      portfolio: 0
    };
    v963.forEach(v973 => {
      const v974 = v973.rubric_data;
      Object.keys(window.CAS_CRITERIA).forEach(v975 => {
        window.CAS_CRITERIA[v975].forEach(v976 => {
          if (v974[v976.id]) {
            v965[v975] += v974[v976.id];
            v966[v975]++;
          }
        });
      });
    });
    const v967 = {
      attendance: 20,
      classwork: 30,
      project: 25,
      behavior: 15,
      portfolio: 10
    };
    let v968 = 0;
    let v969 = "<div class=\"term-aggregation-card\" style=\"background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.25rem; box-shadow: var(--shadow-md); margin-top: 1.25rem;\">\n            <h4 style=\"margin-top:0; margin-bottom: 0.85rem; font-size: 0.9rem; font-weight: 800; color: var(--text-main); border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5rem; display: flex; align-items: center; gap: 0.35rem;\"><i data-lucide=\"bar-chart-3\" style=\"width:16px; height:16px; color: var(--primary);\"></i> CDC Continuous Scale Evaluation Audit</h4>\n            <div style=\"overflow-x: auto;\">\n                <table class=\"cas-summary-table\" style=\"width: 100%; border-collapse: collapse; font-size: 0.8rem; text-align: left; margin-bottom: 1.25rem;\">\n                    <thead>\n                        <tr style=\"border-bottom: 2px solid #cbd5e1; color: var(--text-muted); font-weight: 800; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.02em;\">\n                            <th style=\"padding: 0.5rem 0.25rem;\">Category Dimension</th>\n                            <th style=\"padding: 0.5rem 0.25rem; text-align: center;\">4-Pt Scale Avg</th>\n                            <th style=\"padding: 0.5rem 0.25rem; text-align: right;\">CDC Weight Score</th>\n                        </tr>\n                    </thead>\n                    <tbody>";
    Object.keys(v967).forEach(v977 => {
      const v978 = v966[v977] > 0 ? v965[v977] / v966[v977] : 0;
      const v979 = v978 / 4 * v967[v977];
      v968 += v979;
      v969 += "<tr style=\"border-bottom: 1px solid #f1f5f9;\">\n                <td style=\"padding: 0.6rem 0.25rem; font-weight: 700; color: #475569;\">" + v977.toUpperCase() + "</td>\n                <td style=\"padding: 0.6rem 0.25rem; text-align: center; font-weight: 600; color: var(--text-main);\">" + v978.toFixed(2) + " / 4.00</td>\n                <td style=\"padding: 0.6rem 0.25rem; text-align: right; font-weight: 800; color: var(--primary);\">" + v979.toFixed(2) + " / " + v967[v977] + "</td>\n            </tr>";
    });
    const g = window.getCASGradeFor45(v968);
    let v970 = g.grade;
    let v971 = g.gpa;
    let v972 = "background: " + g.color + "20; color: " + g.color + ";";
    v969 += "</tbody></table>\n            </div>\n            <div class=\"cas-final-badge\" style=\"display: flex; flex-direction: column; gap: 0.6rem; border-top: 2px solid #e2e8f0; padding-top: 1rem; font-size: 0.85rem;\">\n                <span style=\"font-weight: 700; color: var(--text-main);\">Aggregate Term Marks Contribution: <strong style=\"font-size: 1rem; color: var(--primary); font-weight: 800;\">" + v968.toFixed(2) + "%</strong></span>\n                <span class=\"badge\" style=\"display: inline-flex; align-items: center; width: max-content; padding: 0.35rem 0.65rem; border-radius: 6px; font-size: 0.75rem; font-weight: 800; text-transform: uppercase; " + v972 + "\">National Grade Matrix Output: <strong>" + v970 + " (" + v971 + " GPA)</strong></span>\n            </div>\n        </div>";
    v962.innerHTML = v969;
    if (window.lucide) {
      lucide.createIcons();
    }
  } catch (v980) {
    v962.innerHTML = "<p class=\"error\" style=\"color:#dc2626; font-size: 0.8rem; font-weight: 700;\">Aggregation Anomaly: " + v980.message + "</p>";
  }
};