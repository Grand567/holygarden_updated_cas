import v1 from "./supabase.js";
export const CLASS_OPTIONS = ["Grade 12", "Grade 11", "Grade 10", "Grade 9", "Grade 8", "Grade 7", "Grade 6", "Grade 5", "Grade 4", "Grade 3", "Grade 2", "Grade 1", "UKG", "LKG", "Nursery", "PG"];
export const TERMS = ["First Mid Term", "First Term", "Second Mid Term", "Second Term", "Third Mid Term", "Final Term"];
export const SUBJECT_COLORS = ["#4f46e5", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899"];
export const DEFAULT_SUBJECTS = ["Math", "English", "Science", "Nepali", "Social", "Computer", "G.K.", "Drawing", "Health"];
export const CACHE_DURATION = 300000;
export const TERM_DATE_MAP = {
  "First Mid Term": {
    start: "2024-04-14",
    end: "2024-06-15"
  },
  "First Term": {
    start: "2024-06-16",
    end: "2024-08-15"
  },
  "Second Mid Term": {
    start: "2024-08-16",
    end: "2024-10-15"
  },
  "Second Term": {
    start: "2024-10-16",
    end: "2024-12-15"
  },
  "Third Mid Term": {
    start: "2024-12-16",
    end: "2025-02-15"
  },
  "Final Term": {
    start: "2025-03-16",
    end: "2025-04-13"
  }
};
export function shouldFetch(v2, v3, v4 = false, v5 = CACHE_DURATION) {
  if (v4) {
    return true;
  }
  const v6 = Date.now();
  return !v3[v2] || v6 - v3[v2] > v5;
}
function compressImage(v7, v8 = 250) {
  return new Promise((v9, v10) => {
    const v11 = new FileReader();
    v11.onload = v12 => {
      const v13 = new Image();
      v13.onload = () => {
        const v14 = document.createElement("canvas");
        let v15 = v13.width;
        let v16 = v13.height;
        if (v15 > v16) {
          if (v15 > v8) {
            v16 = Math.round(v16 * v8 / v15);
            v15 = v8;
          }
        } else if (v16 > v8) {
          v15 = Math.round(v15 * v8 / v16);
          v16 = v8;
        }
        v14.width = v15;
        v14.height = v16;
        const v17 = v14.getContext("2d");
        v17.drawImage(v13, 0, 0, v15, v16);
        v14.toBlob(v18 => {
          if (v18) {
            v9(v18);
          } else {
            v10(new Error("Canvas toBlob returned null"));
          }
        }, "image/jpeg", 0.7);
      };
      v13.onerror = v10;
      v13.src = v12.target.result;
    };
    v11.onerror = v10;
    v11.readAsDataURL(v7);
  });
}
export async function uploadStudentPhoto(v19, v20) {
  if (!v19) {
    return null;
  }
  let v21 = v19;
  try {
    v21 = await compressImage(v19, 250);
  } catch (v26) {
    console.warn("Image compression failed, uploading original:", v26);
  }
  const v22 = v20 + "-" + Date.now() + ".jpg";
  const v23 = "photos/" + v22;
  const {
    error: v24
  } = await v1.storage.from("student-photos").upload(v23, v21, {
    contentType: "image/jpeg"
  });
  if (v24) {
    console.error("Upload error:", v24);
    return null;
  }
  const {
    data: v25
  } = v1.storage.from("student-photos").getPublicUrl(v23);
  return v25.publicUrl;
}
export async function validateSession() {
  const v27 = async () => {
    try {
      const v30 = new AbortController();
      const v31 = setTimeout(() => v30.abort(), 2000);
      const v32 = await fetch("./build.json?cb=" + Date.now(), {
        signal: v30.signal
      });
      clearTimeout(v31);
      if (!v32.ok) {
        return;
      }
      const v33 = await v32.json();
      if (v33 && v33.version) {
        const v34 = String(v33.version);
        const v35 = localStorage.getItem("app_build_version");
        if (v35 && v35 !== v34) {
          console.warn("Update detected: " + v34 + ". Cleaning...");
          const v36 = await caches.keys();
          await Promise.all(v36.map(v37 => caches.delete(v37)));
          localStorage.setItem("app_build_version", v34);
          window.location.replace(window.location.pathname);
          return true;
        } else if (!v35) {
          localStorage.setItem("app_build_version", v34);
        }
      }
    } catch (v38) {
      console.warn("Version check skipped:", v38.message);
    }
    return false;
  };
  const [v28, v29] = await Promise.allSettled([v27(), v1.auth.getSession().catch(() => ({
    data: {
      session: null
    },
    error: new Error("getSession failed")
  }))]);
  if (v28.status === "fulfilled" && v28.value === true) {
    return null;
  }
  try {
    const {
      data: {
        session: v40
      },
      error: v39
    } = v29.value || {
      data: {
        session: null
      },
      error: null
    };
    const v41 = 900000;
    let v42 = null;
    try {
      const v50 = localStorage.getItem("userProfile");
      if (v50) {
        const v51 = JSON.parse(v50);
        const v52 = Date.now() - (v51._cachedAt || 0);
        if (v51 && v51.id && v52 < v41) {
          v42 = v51;
        } else if (v51 && v51.id && v52 >= v41) {
          localStorage.removeItem("userProfile");
        }
      }
    } catch (v53) {}
    if ((v39 || !v40) && !v42) {
      window.location.href = "login.html";
      return null;
    }
    const v43 = v40 ? v40.user.id : v42 ? v42.id : null;
    if (!v42 && v43) {
      const {
        data: v54
      } = await v1.from("profiles").select("*").eq("id", v43).single();
      v42 = v54;
      if (v42) {
        localStorage.setItem("userProfile", JSON.stringify({
          ...v42,
          _cachedAt: Date.now()
        }));
      }
    } else if (v43) {
      v1.from("profiles").select("*").eq("id", v43).single().then(({
        data: v55
      }) => {
        if (v55) {
          localStorage.setItem("userProfile", JSON.stringify({
            ...v55,
            _cachedAt: Date.now()
          }));
        }
      }).catch(() => {});
    }
    if (!v42) {
      window.location.href = "login.html";
      return null;
    }
    window.currentUserProfile = v42;
    const v44 = window.location.pathname;
    const v45 = v44.split("/").pop() || "index.html";
    const v46 = v42.role;
    const v47 = {
      admin: "admin.html",
      accountant: "accountant.html",
      teacher: "index.html",
      parent: "parent.html"
    };
    const v48 = v47[v46];
    const v49 = Object.values(v47).filter(v56 => v56 !== v48);
    if (v49.includes(v45)) {
      console.warn("Unauthorized portal access for " + v46 + ". Redirecting to " + v48);
      window.location.href = v48;
      return null;
    }
    return v40 || { user: { id: v42.id } };
  } catch (v57) {
    console.error("Session/Role check failed", v57);
    window.location.href = "login.html";
    return null;
  }
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    validateSession();
  }
});
const _GRADE_RANK = {
  PG: -1,
  Nursery: 0,
  LKG: 1,
  UKG: 2
};
function _gradeRank(v58) {
  const v59 = String(v58).trim();
  if (_GRADE_RANK[v59] !== undefined) {
    return _GRADE_RANK[v59];
  }
  const v60 = parseInt(v59.replace(/^grade\s*/i, ""));
  if (isNaN(v60)) {
    return 999;
  } else {
    return v60 + 3;
  }
}
export function sortClassList(v61) {
  return [...v61].sort((v62, v63) => _gradeRank(v62) - _gradeRank(v63));
}
export function sortStudentsList(students) {
  return [...students].sort((a, b) => {
    const rankA = _gradeRank(a.class);
    const rankB = _gradeRank(b.class);
    if (rankA !== rankB) {
      return rankA - rankB;
    }
    const rollA = parseInt(a.roll) || 999;
    const rollB = parseInt(b.roll) || 999;
    if (rollA !== rollB) {
      return rollA - rollB;
    }
    return (a.name || "").localeCompare(b.name || "");
  });
}
export function getLocalToday() {
  if (window.NepaliFunctions) {
    const v68 = window.NepaliFunctions.BS.GetCurrentDate();
    const v69 = String(v68.month).padStart(2, "0");
    const v70 = String(v68.day).padStart(2, "0");
    return v68.year + "-" + v69 + "-" + v70;
  }
  const v64 = new Date();
  const v65 = v64.getFullYear();
  const v66 = String(v64.getMonth() + 1).padStart(2, "0");
  const v67 = String(v64.getDate()).padStart(2, "0");
  return v65 + "-" + v66 + "-" + v67;
}
export function initNepaliDatePicker(v71 = ".nepali-date-picker") {
  if (!window.NepaliFunctions) {
    return;
  }
  const v72 = document.querySelectorAll(v71);
  v72.forEach(v73 => {
    if (v73.classList.contains("ndp-initialized")) {
      return;
    }
    v73.readOnly = true;
    v73.setAttribute("inputmode", "none");
    v73.nepaliDatePicker({
      ndpYear: true,
      ndpMonth: true,
      ndpYearCount: 200,
      readOnlyInput: true,
      onSelect: () => {
        v73.dispatchEvent(new Event("change", {
          bubbles: true
        }));
        if (v73.onchange && typeof v73.onchange === "function") {
          v73.onchange();
        } else {
          const v75 = v73.getAttribute("onchange");
          if (v75) {
            try {
              new Function(v75).call(v73);
            } catch (v76) {
              console.error("Error executing inline onchange:", v76);
            }
          }
        }
      }
    });
    v73.classList.add("ndp-initialized");
    const v74 = () => {
      if (v73.focus) {
        v73.focus();
      }
    };
    v73.addEventListener("click", v74);
    v73.addEventListener("touchstart", v74, {
      passive: true
    });
  });
}
export function formatDateLabel(v77) {
  if (!v77) {
    return "";
  }
  if (window.NepaliFunctions) {
    try {
      let v79 = v77;
      const v80 = parseInt(v77.split("-")[0]);
      if (v80 < 2050) {
        v79 = window.NepaliFunctions.AD2BS(v77, "YYYY-MM-DD", "YYYY-MM-DD");
      }
      const v81 = window.NepaliFunctions.ConvertToDateObject(v79, "YYYY-MM-DD");
      if (v81 && v81.year && v81.month && v81.day) {
        return window.NepaliFunctions.BS.GetFullDate(v81, false);
      }
    } catch (v82) {}
  }
  const v78 = new Date(v77);
  if (isNaN(v78.getTime())) {
    return v77;
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(v78);
}
if (typeof MutationObserver !== "undefined" && typeof document !== "undefined") {
  const observer = new MutationObserver(v83 => {
    let v84 = false;
    for (const v85 of v83) {
      if (v85.addedNodes.length) {
        v84 = true;
        break;
      }
    }
    if (v84) {
      setTimeout(() => initNepaliDatePicker(".nepali-date-picker"), 200);
    }
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}
export function escapeHtml(v86) {
  if (!v86) {
    return "";
  }
  if (typeof v86 === "object") {
    v86 = v86.en || v86.np || v86.nepali || v86.english || JSON.stringify(v86);
  }
  const v87 = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  };
  return String(v86).replace(/[&<>"']/g, v88 => v87[v88]);
}
window.isModalTriggeredPopstate = false;
window.ignoreNextPopstate = false;
if (typeof window !== "undefined") {
  window.addEventListener("popstate", v89 => {
    if (window.ignoreNextPopstate) {
      window.ignoreNextPopstate = false;
      v89.stopImmediatePropagation();
      return;
    }
    const v90 = document.getElementById("modal-overlay");
    if (v90 && v90.classList.contains("open")) {
      window.isModalTriggeredPopstate = true;
      v90.classList.remove("open");
      v89.stopImmediatePropagation();
    }
  }, true);
}
export function openModal(v91) {
  const v92 = document.getElementById("modal-overlay");
  const v93 = document.getElementById("modal-content");
  if (v92 && v93) {
    const v94 = v92.classList.contains("open");
    v93.innerHTML = v91;
    v92.classList.add("open");
    if (window.lucide) {
      window.lucide.createIcons();
    }
    if (!v94 && !window.isModalTriggeredPopstate) {
      history.pushState({
        modalOpen: true
      }, "");
    }
  }
}
export function closeModal() {
  const v95 = document.getElementById("modal-overlay");
  if (v95 && v95.classList.contains("open")) {
    v95.classList.remove("open");
    if (!window.isModalTriggeredPopstate) {
      window.ignoreNextPopstate = true;
      history.back();
    }
  }
  window.isModalTriggeredPopstate = false;
}
export async function checkNewFeatures() {
  try {
    const v96 = localStorage.getItem("app_version");
    const v97 = localStorage.getItem("last_seen_version");
    if (v96 && v97 && v96 !== v97) {
      openModal("\n                <div style=\"text-align:center; padding:1rem;\">\n                    <div style=\"width:60px; height:60px; background:var(--primary-light); color:var(--primary); border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 1rem;\">\n                        <i data-lucide=\"sparkles\"></i>\n                    </div>\n                    <h2 style=\"margin-bottom:0.5rem;\">App Updated!</h2>\n                    <p style=\"color:var(--text-muted); margin-bottom:1.5rem;\">We've updated the app to v" + v96 + " with improvements.</p>\n                    <button class=\"btn btn-primary btn-block\" onclick=\"closeModal()\">Awesome!</button>\n                </div>\n            ");
      localStorage.setItem("last_seen_version", v96);
      return;
    } else if (!v97) {
      localStorage.setItem("last_seen_version", v96 || "1.0.0");
    }
    try {
      const {
        data: v98,
        error: v99
      } = await v1.from("notifications").select("*").order("created_at", {
        ascending: false
      }).limit(1).maybeSingle();
      if (!v99 && v98) {
        const v100 = localStorage.getItem("last_notif_id");
        if (v98.id !== v100) {
          openModal("\n                        <div style=\"text-align:center; padding:1rem;\">\n                            <div style=\"width:60px; height:60px; background:var(--primary-light); color:var(--primary); border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 1rem;\">\n                                <i data-lucide=\"megaphone\"></i>\n                            </div>\n                            <h2 style=\"margin-bottom:0.5rem;\">" + escapeHtml(v98.title) + "</h2>\n                            <div style=\"color:var(--text-muted); margin-bottom:1.5rem; font-size:0.9rem;\">" + escapeHtml(v98.content) + "</div>\n                            <button class=\"btn btn-primary btn-block\" onclick=\"closeModal()\">Got it!</button>\n                        </div>\n                    ");
          localStorage.setItem("last_notif_id", v98.id);
        }
      }
    } catch (v101) {}
  } catch (v102) {
    console.warn("New features check failed", v102);
  }
}
export function toast(v103, v104 = 2500) {
  const v105 = document.getElementById("toast");
  if (v105) {
    v105.textContent = v103;
    v105.classList.add("show");
    clearTimeout(v105._t);
    v105._t = setTimeout(() => v105.classList.remove("show"), v104);
  }
}
export async function logout() {
  try {
    v1.removeAllChannels();
    await Promise.race([v1.auth.signOut(), new Promise(v107 => setTimeout(v107, 1500))]).catch(v108 => console.warn("Background sign out error", v108));
  } catch (v109) {
    console.warn("Sign out error", v109);
  }
  console.log("Keys in localStorage before clean:", Object.keys(localStorage));
  const v106 = Object.keys(localStorage).filter(v110 => {
    return v110 && !v110.includes("version") && !v110.includes("build") && !v110.includes("manual_staff");
  });
  console.log("Keys to remove from localStorage:", v106);
  v106.forEach(v111 => localStorage.removeItem(v111));
  console.log("Keys in localStorage after clean:", Object.keys(localStorage));
  if (window.Capacitor && window.Capacitor.isNativePlatform()) {
    window.location.replace("./login.html");
  } else {
    window.location.href = "login.html";
  }
}
export const SUBJECT_ALIASES = {
  // Mathematics
  math: "Mathematics",
  maths: "Mathematics",
  mathematics: "Mathematics",
  "c math": "Mathematics",
  "c. math": "Mathematics",
  "c maths": "Mathematics",
  "c. maths": "Mathematics",
  "compulsory math": "Mathematics",
  "compulsory mathematics": "Mathematics",
  "compulsory maths": "Mathematics",
  "compulsory math.": "Mathematics",
  "compulsory mathematics.": "Mathematics",
  "c. mathematics": "Mathematics",
  "c.mathematics": "Mathematics",
  "c.maths": "Mathematics",
  "c.math": "Mathematics",
  "comp. math": "Mathematics",
  "comp.math": "Mathematics",
  "comp. maths": "Mathematics",
  "comp.maths": "Mathematics",
  "compulsory math/mathematics": "Mathematics",
  "math/mathematics": "Mathematics",
  
  // Optional Mathematics
  "opt math": "Optional Mathematics",
  "opt maths": "Optional Mathematics",
  "opt. maths": "Optional Mathematics",
  "opt. math": "Optional Mathematics",
  "opt mathematics": "Optional Mathematics",
  "optional mathematics": "Optional Mathematics",
  "optional math": "Optional Mathematics",
  "opt.mathematics": "Optional Mathematics",
  "opt.maths": "Optional Mathematics",
  "opt.math": "Optional Mathematics",
  "o math": "Optional Mathematics",
  "o maths": "Optional Mathematics",
  "o. math": "Optional Mathematics",
  "o. maths": "Optional Mathematics",
  "o.math": "Optional Mathematics",
  "o.maths": "Optional Mathematics",
  "optional maths": "Optional Mathematics",
  optionalmaths: "Optional Mathematics",
  optionalmath: "Optional Mathematics",
  optmath: "Optional Mathematics",
  optmaths: "Optional Mathematics",

  // English
  eng: "English",
  english: "English",
  "english language": "English",
  "compulsory english": "English",
  "c. english": "English",
  "c.english": "English",

  // Nepali
  nep: "Nepali",
  nepali: "Nepali",
  "nepali language": "Nepali",
  "compulsory nepali": "Nepali",
  "c. nepali": "Nepali",
  "c.nepali": "Nepali",

  // Science & Technology
  sci: "Science & Technology",
  science: "Science & Technology",
  "science and technology": "Science & Technology",
  "science & technology": "Science & Technology",
  "science & tech": "Science & Technology",
  "science tech": "Science & Technology",
  "science and tech": "Science & Technology",
  "science/technology": "Science & Technology",
  "science & technologies": "Science & Technology",
  technologies: "Science & Technology",
  technology: "Science & Technology",
  scotech: "Science & Technology",
  "sci & tech": "Science & Technology",
  "sci and tech": "Science & Technology",
  "sci. & tech.": "Science & Technology",
  "sci. & tech": "Science & Technology",
  "sci. and tech.": "Science & Technology",
  "sci. and tech": "Science & Technology",

  // Social Studies
  soc: "Social Studies",
  social: "Social Studies",
  "social studies": "Social Studies",
  "social studies/studies": "Social Studies",
  "social science": "Social Studies",
  "social sciences": "Social Studies",
  socialstudies: "Social Studies",
  samajik: "Social Studies",
  "samajik adhyayan": "Social Studies",
  "samajik siksha": "Social Studies",
  "social studies and population": "Social Studies",
  "social/sero-fero": "Social Studies",

  // Hamro Serofero
  "hamro serofero": "Social Studies",
  "mero serofero": "Social Studies",
  "sero fero": "Social Studies",
  serofero: "Social Studies",
  "hamro sero fero": "Social Studies",
  hamroserofero: "Social Studies",
  "sero-fero": "Social Studies",
  "serofero/social": "Social Studies",
  "hamro serofero/social": "Social Studies",

  // Computer Science
  comp: "Computer Science",
  computer: "Computer Science",
  "computer sci": "Computer Science",
  "computer science": "Computer Science",
  "comp. science": "Computer Science",
  "comp.science": "Computer Science",
  "comp. sci.": "Computer Science",
  "comp.sci.": "Computer Science",
  "comp.sci": "Computer Science",

  // Health, Physical & Creative Arts
  hp: "Health, Physical & Creative Arts",
  "health physical & creative": "Health, Physical & Creative Arts",
  "health phys": "Health, Physical & Creative Arts",
  "health phys.": "Health, Physical & Creative Arts",
  "health, phys.": "Health, Physical & Creative Arts",
  "health, phys": "Health, Physical & Creative Arts",
  "health & creative": "Health, Physical & Creative Arts",
  "health & creative arts": "Health, Physical & Creative Arts",
  "health physical & creative arts": "Health, Physical & Creative Arts",
  hpe: "Health, Physical & Creative Arts",
  health: "Health, Physical & Creative Arts",
  "health & physical": "Health, Physical & Creative Arts",
  "health & population": "Health, Physical & Creative Arts",
  "health physical and creative": "Health, Physical & Creative Arts",
  "health, physical & creative arts": "Health, Physical & Creative Arts",
  "health and physical education": "Health, Physical & Creative Arts",
  "physical education": "Health, Physical & Creative Arts",
  "creative art": "Health, Physical & Creative Arts",
  "creative arts": "Health, Physical & Creative Arts",
  "health physical": "Health, Physical & Creative Arts",
  "hpe & creative": "Health, Physical & Creative Arts",
  "hpe & creative arts": "Health, Physical & Creative Arts",
  "h.p.e.": "Health, Physical & Creative Arts",
  "h.p.": "Health, Physical & Creative Arts",
  "healtha and phy. and creative": "Health, Physical & Creative Arts",
  "health and phy. and creative": "Health, Physical & Creative Arts",
  "health and physical and creative": "Health, Physical & Creative Arts",
  "health, physical and creative arts": "Health, Physical & Creative Arts",
  "health, phys & creative": "Health, Physical & Creative Arts",
  "health phys & creative": "Health, Physical & Creative Arts",
  "health, phys. & creative": "Health, Physical & Creative Arts",
  "health phys. & creative": "Health, Physical & Creative Arts",
  "health, phys and creative": "Health, Physical & Creative Arts",
  "health phys and creative": "Health, Physical & Creative Arts",
  "health, phys. and creative": "Health, Physical & Creative Arts",
  "health phys. and creative": "Health, Physical & Creative Arts",
  "health, physical education": "Health, Physical & Creative Arts",
  "health physical education": "Health, Physical & Creative Arts",
  "health and physical": "Health, Physical & Creative Arts",
  "health & physical education": "Health, Physical & Creative Arts",
  "health & physical education & creative": "Health, Physical & Creative Arts",
  "health and physical education & creative": "Health, Physical & Creative Arts",
  "health, physical and creative": "Health, Physical & Creative Arts",
  "health physical and creative arts": "Health, Physical & Creative Arts",

  // Local Subject
  lc: "Local Subject",
  "local subject": "Local Subject",
  "local curriculum": "Local Subject",
  "local curriculum (lc)": "Local Subject",
  "local subjects": "Local Subject",
  "local curricula": "Local Subject",
  "local subject/curriculum": "Local Subject",
  "local subject (lc)": "Local Subject",
  "localsubject": "Local Subject",
  "स्थानीय विषय": "Local Subject",

  // Optional Accountancy
  account: "Optional Accountancy",
  accounts: "Optional Accountancy",
  accountancy: "Optional Accountancy",
  optionalaccountancy: "Optional Accountancy",
  optionalaccount: "Optional Accountancy",
  "optional accountancy": "Optional Accountancy",
  "optional account": "Optional Accountancy",
  acc: "Optional Accountancy",
  acct: "Optional Accountancy",
  "opt. accountancy": "Optional Accountancy",
  "opt. account": "Optional Accountancy",
  "opt.account": "Optional Accountancy",
  "opt.accountancy": "Optional Accountancy",
  "o. account": "Optional Accountancy",
  "o. accountancy": "Optional Accountancy",
  "o.account": "Optional Accountancy",
  "o.accountancy": "Optional Accountancy",
  "opt account": "Optional Accountancy",
  "opt accountancy": "Optional Accountancy",
  "o account": "Optional Accountancy",
  "o accountancy": "Optional Accountancy",

  // Economics
  eco: "Economics",
  economics: "Economics",
  "opt. economics": "Economics",
  "optional economics": "Economics",

  // GK
  gk: "GK",
  "g.k.": "GK",
  "general knowledge": "GK",
  "g. k.": "GK",
  "g.k": "GK",

  // Other subjects
  grammar: "Grammar",
  "english grammar": "Grammar",
  moral: "Moral",
  "moral education": "Moral",
  "moral science": "Moral",
  byakaran: "Byakaran",
  "nepali byakaran": "Byakaran",
  physics: "Physics",
  phy: "Physics",
  chemistry: "Chemistry",
  che: "Chemistry",
  biology: "Biology",
  bio: "Biology",
  geography: "Geography",
  geo: "Geography",
  history: "History",
  his: "History",
  environment: "Environment",
  evs: "Environment",
  art: "Art",
  music: "Music",
  
  // Preschool & Kindergarten subjects
  drawing: "Drawing",
  "art & craft": "Drawing",
  "art and craft": "Drawing",
  "creative drawing": "Drawing",
  rhymes: "Rhymes",
  "nepali rhymes": "Rhymes",
  "english rhymes": "Rhymes",
  conversation: "Conversation",
  "english conversation": "Conversation",
  handwriting: "Handwriting",
  "english handwriting": "Handwriting",
  "nepali handwriting": "Handwriting",
  writing: "Handwriting",
  dictation: "Dictation",
  "english dictation": "Dictation",
  "nepali dictation": "Dictation",
  spelling: "Dictation",
  workbook: "Workbook",
  "english workbook": "Workbook",
  "math workbook": "Workbook",
  "nepali workbook": "Workbook",
  "nepali skill": "Nepali",
  "nepali skills": "Nepali",
  "english skill": "English",
  "english skills": "English",
  "mathematics skill": "Mathematics",
  "mathematics skills": "Mathematics",
  "math skill": "Mathematics",
  "math skills": "Mathematics",
  "maths skill": "Mathematics",
  "maths skills": "Mathematics",
  "nepali oral": "Nepali Oral",
  "english oral": "English Oral",
  "mathematics oral": "Mathematics Oral",
  "math oral": "Mathematics Oral",
  "maths oral": "Mathematics Oral",
  "hygiene": "Hygiene",
  "rhyme": "Rhymes"
};

export function filterSubjectsByClass(subjects, className) {
    if (!subjects || !Array.isArray(subjects)) return [];
    let filtered = [...subjects].filter(s => s && s.trim() !== "");
    
    if (!className) return filtered;
    
    const isPreSchool = ["PG", "Nursery", "LKG", "UKG"].includes(className);
    if (isPreSchool) {
        const allowedPreSchool = ["english", "nepali", "mathematics", "math", "maths", "english oral", "nepali oral", "mathematics oral", "maths oral", "math oral", "rhymes", "drawing", "conversation", "handwriting", "dictation", "workbook", "english workbook", "nepali workbook", "math workbook", "hygiene", "english skills", "nepali skills", "mathematics skills", "maths skills", "math skills", "english skill", "nepali skill", "mathematics skill", "maths skill", "math skill"];
        return filtered.filter(sub => {
            const ls = sub.toLowerCase().trim();
            return allowedPreSchool.includes(ls);
        });
    }

    const cLevel = className.match(/\d+/)?.[0];
    if (cLevel) {
        const gradeNum = parseInt(cLevel, 10);
        return filtered.filter(sub => {
            const ls = sub.toLowerCase().trim();
            // Exclude high school subjects for Grade 1-5
            if (gradeNum <= 5) {
                if (ls.includes("optional") || ls.includes("opt.") || ls.includes("opt ") || ls.includes("account") || ls.includes("eco") || ls.includes("opt math") || ls.includes("population")) return false;
            }
            // Exclude high school subjects for Grade 6-8
            if (gradeNum >= 6 && gradeNum <= 8) {
                if (ls.includes("account") || ls.includes("eco")) return false;
            }
            // Exclude primary subjects for Grade 9-10
            if (gradeNum >= 9) {
                if (ls.includes("hamro") || ls.includes("mero") || ls.includes("drawing") || ls.includes("art") || ls.includes("rhymes") || ls.includes("hygiene") || ls.includes("conversation") || ls.includes("handwriting") || ls.includes("dictation")) return false;
            }
            return true;
        });
    }
    
    return filtered;
}
window.filterSubjectsByClass = filterSubjectsByClass;

export const STANDARD_SUBJECT_ORDER = [
    "Nepali",
    "English",
    "Mathematics",
    "Science",
    "Science & Technology",
    "Social Studies",
    "Health, Physical & Creative Arts",
    "Health",
    "Local Subject",
    "Computer Science",
    "Moral",
    "G.K.",
    "Drawing"
];

export function sortSubjectsByStandardOrder(subjects) {
    if (!subjects || !Array.isArray(subjects)) return [];
    
    return [...subjects].sort((a, b) => {
        const getSubjectName = (item) => {
            if (typeof item === 'string') return item;
            if (item && typeof item === 'object' && item.subject) return item.subject;
            if (item && typeof item === 'object' && item.name) return item.name;
            return String(item);
        };

        const normA = normalizeSubjectName(getSubjectName(a));
        const normB = normalizeSubjectName(getSubjectName(b));
        
        let idxA = STANDARD_SUBJECT_ORDER.findIndex(s => s.toLowerCase() === normA.toLowerCase());
        let idxB = STANDARD_SUBJECT_ORDER.findIndex(s => s.toLowerCase() === normB.toLowerCase());
        
        if (idxA === -1) idxA = 999;
        if (idxB === -1) idxB = 999;
        
        if (idxA !== idxB) {
            return idxA - idxB;
        }
        return normA.localeCompare(normB);
    });
}
window.sortSubjectsByStandardOrder = sortSubjectsByStandardOrder;

export function normalizeSubjectName(v112) {
  if (!v112) {
    return "";
  }
  const v113 = String(v112).trim().toLowerCase();
  return SUBJECT_ALIASES[v113] || String(v112).trim();
}
window.normalizeSubjectName = normalizeSubjectName;
export function safeParseAssignments(v114) {
  if (!v114) {
    return [];
  }
  try {
    let v115 = v114;
    while (typeof v115 === "string") {
      v115 = JSON.parse(v115);
    }
    let v116 = [];
    if (v115 && v115.assignments && Array.isArray(v115.assignments)) {
      v116 = v115.assignments;
    } else if (Array.isArray(v115)) {
      v116 = v115.map(v117 => ({
        className: v117,
        isHomeroom: true,
        subjects: []
      }));
    }
    v116.forEach(v118 => {
      if (v118.subjects && Array.isArray(v118.subjects)) {
        v118.subjects = [...new Set(v118.subjects.map(v119 => normalizeSubjectName(v119)))];
      }
    });
    return v116;
  } catch (v120) {
    console.warn("Failed to parse assignments:", v120);
  }
  return [];
}
export const getTeacherAssignments = () => {
  const v121 = window.currentUserProfile;
  if (v121 && v121.role === "admin") {
    return {
      isAdmin: true,
      teacherId: v121.id
    };
  }
  if (!v121) {
    return {
      isAdmin: false,
      assignments: [],
      teacherId: null
    };
  }
  const v122 = safeParseAssignments(v121.assigned_classes);
  return {
    isAdmin: false,
    assignments: v122,
    teacherId: v121.id
  };
};
export async function saveExcel(v123, v124) {
  try {
    const v125 = await ensureXlsxLoaded();
    if (!v125) {
      throw new Error("Could not load Excel library. Please check your internet connection.");
    }
    const v126 = XLSX.write(v123, {
      type: "base64",
      bookType: "xlsx"
    });
    const v127 = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem;
    if (v127) {
      const {
        Filesystem: v128,
        Share: v129
      } = window.Capacitor.Plugins;
      const v130 = await v128.writeFile({
        path: v124,
        data: v126,
        directory: "CACHE",
        recursive: true
      });
      const v131 = await v128.getUri({
        directory: "CACHE",
        path: v124
      });
      if (v129) {
        await v129.share({
          title: v124,
          text: "Here is your exported Excel file.",
          url: v131.uri,
          dialogTitle: "Save or Share Excel File"
        });
        toast("Export completed!", 3000);
      } else {
        toast("Exported to: " + v131.uri, 6000);
      }
      return v131.uri;
    } else {
      XLSX.writeFile(v123, v124);
      toast("Downloaded as " + v124, 4000);
      return v124;
    }
  } catch (v132) {
    console.error("Export failed", v132);
    XLSX.writeFile(v123, v124);
    toast("Exported as " + v124, 4000);
    return v124;
  }
}
window.openModal = openModal;
window.closeModal = closeModal;
window.logout = logout;
window.toast = toast;
window.showToast = toast;
window.escapeHtml = escapeHtml;
window.CLASS_OPTIONS = CLASS_OPTIONS;
window.TERMS = TERMS;
window.sortStudentsList = sortStudentsList;
window.SUBJECT_COLORS = SUBJECT_COLORS;
window.DEFAULT_SUBJECTS = DEFAULT_SUBJECTS;
window.getTeacherAssignments = getTeacherAssignments;
window.safeParseAssignments = safeParseAssignments;
window.getLocalToday = getLocalToday;
window.initNepaliDatePicker = initNepaliDatePicker;
window.formatDateLabel = formatDateLabel;
window.saveExcel = saveExcel;
window.checkNewFeatures = checkNewFeatures;
window.TERM_DATE_MAP = TERM_DATE_MAP;
window.loadExternalScript = loadExternalScript;
window.ensureXlsxLoaded = ensureXlsxLoaded;
window.ensureCryptoJsLoaded = ensureCryptoJsLoaded;
window.fetchProfileMap = fetchProfileMap;
export async function fetchProfileMap(v133) {
  if (!v133 || v133.length === 0) {
    return {};
  }
  const v134 = [...new Set(v133)].filter(Boolean);
  try {
    const {
      data: v135,
      error: v136
    } = await v1.from("profiles").select("id, full_name, role").in("id", v134);
    if (v136) {
      throw v136;
    }
    const v137 = {};
    v135.forEach(v138 => {
      if (v138.role === "admin") {
        v137[v138.id] = "School Administration";
      } else {
        v137[v138.id] = v138.full_name || "User";
      }
    });
    return v137;
  } catch (v139) {
    console.error("Error fetching profiles:", v139);
    return {};
  }
}
export function loadExternalScript(v140) {
  return new Promise((v141, v142) => {
    const v143 = document.querySelector("script[src=\"" + v140 + "\"]");
    if (v143) {
      if (v143.dataset.loaded === "true") {
        return v141();
      }
      v143.addEventListener("load", v141);
      v143.addEventListener("error", v142);
      return;
    }
    const v144 = document.createElement("script");
    v144.src = v140;
    v144.async = true;
    v144.onload = () => {
      v144.dataset.loaded = "true";
      v141();
    };
    v144.onerror = () => v142(new Error("Failed to load script: " + v140));
    document.head.appendChild(v144);
  });
}
export async function ensureXlsxLoaded() {
  if (window.XLSX) {
    return true;
  }
  const v145 = "libs/xlsx.full.min.js";
  try {
    await loadExternalScript(v145);
    return true;
  } catch (v146) {
    console.error("Failed to load XLSX library", v146);
    return false;
  }
}
export async function ensureCryptoJsLoaded() {
  if (window.CryptoJS) return true;
  try {
    await loadExternalScript("libs/crypto-js.min.js");
    return true;
  } catch (v148) {
    console.warn("Failed to load crypto-js.min.js:", v148);
    return false;
  }
}

export async function fetchAllPaginated(queryBuilder) {
  let allData = [];
  let start = 0;
  const step = 1000;
  let fetchMore = true;
  while (fetchMore) {
    const { data, error } = await queryBuilder(start, start + step - 1);
    if (error) throw error;
    if (data && data.length > 0) {
      allData = allData.concat(data);
      start += step;
      if (data.length < step) fetchMore = false;
    } else {
      fetchMore = false;
    }
  }
  return allData;
}
window.fetchAllPaginated = fetchAllPaginated;
window.switchStudentSubTab = async function (v149, v150) {
  const v151 = document.getElementById("student-subtab-content");
  if (!v151) {
    return;
  }
  if (v149 === "cas") {
    const v152 = (window.state?.students || window.allStudents || []).find(v157 => String(v157.id) === String(v150));
    const v153 = typeof window.getTeacherAssignments === 'function' ? window.getTeacherAssignments() : { isAdmin: window.currentUserProfile?.role === "admin", assignments: [] };
    const v154 = v153.isAdmin ? true : (v153.assignments || []).some(v158 => v158.className === v152?.class && v158.isHomeroom);
    const v155 = window.currentUserProfile?.role === "admin";
    const v156 = v155 || v154;
    // Use the direct window global which survives app-views.js overwriting window.views
    const panelFn = window.casWeeklyRubricPanel || window.views?.casWeeklyRubricPanel;
    if (!panelFn) {
      v151.innerHTML = "<div style=\"color:var(--error);padding:2rem;text-align:center;\">CAS module not loaded. Please refresh the page.</div>";
      return;
    }
    v151.innerHTML = panelFn(v150, 1, "First Term", v156);
    if (typeof window.fetchAndRenderWeeklyRubric === "function") {
      await window.fetchAndRenderWeeklyRubric(v150, "First Term", 1, v156);
    }
  } else {
    v151.innerHTML = "<div class=\"info-panel\">Loading regular navigation data configurations...</div>";
  }
};
window.formatParentsName = function(parentsStr) {
  if (!parentsStr) return "-";
  if (parentsStr.trim().startsWith("{")) {
    try {
      const details = JSON.parse(parentsStr);
      const names = [];
      if (details.fatherName) names.push(details.fatherName);
      if (details.motherName) names.push(details.motherName);
      return names.join(" & ") || "-";
    } catch(e) {}
  }
  return parentsStr;
};

window.getCasDetailsCollapsible = function(parentsStr) {
  let details = {
    fatherName: "", fatherOccupation: "", fatherMobile: "",
    motherName: "", motherOccupation: "", motherMobile: "",
    homeAddress: "", admissionDate: "",
    motherTongue: "", homeLanguage: "", nepaliProficiency: "",
    weight: "", height: "", specialDisease: "", disability: ""
  };
  
  if (parentsStr && parentsStr.trim().startsWith("{")) {
    try {
      details = Object.assign(details, JSON.parse(parentsStr));
    } catch(e) {}
  } else if (parentsStr) {
    const parts = parentsStr.split(/\s*(?:&|and|,|\/)\s*/i);
    if (parts.length >= 2) {
      details.fatherName = parts[0];
      details.motherName = parts[1];
    } else {
      details.fatherName = parentsStr;
    }
  }

  return `
    <details class="form-group" style="border:1px solid #cbd5e1; border-radius:8px; padding:0.75rem; margin-top:1rem;">
      <summary style="font-weight:700; font-size:0.85rem; color:#4f46e5; display:flex; align-items:center; justify-content:space-between; outline:none; list-style:none; cursor:pointer;">
        <span>📋 Detailed CAS & Health Record</span>
        <span style="font-size:0.75rem; color:#64748b;">(Click to Expand)</span>
      </summary>
      <div style="margin-top:0.75rem; display:flex; flex-direction:column; gap:0.75rem;">
        
        <div style="font-weight:700; font-size:0.8rem; border-bottom:1px solid #e2e8f0; padding-bottom:0.25rem; margin-top:0.25rem; color:#1e293b;">👨‍👩‍👦 Family & Address</div>
        
        <div class="form-group" style="margin-bottom:0.5rem;">
          <label class="form-label" style="font-size:0.75rem; margin-bottom:0.2rem;">Father's Name</label>
          <input class="form-input" id="dfn" value="${escapeHtml(details.fatherName)}" placeholder="Father's full name">
        </div>
        <div class="form-group" style="margin-bottom:0.5rem;">
          <label class="form-label" style="font-size:0.75rem; margin-bottom:0.2rem;">Father's Occupation</label>
          <input class="form-input" id="dfo" value="${escapeHtml(details.fatherOccupation)}" placeholder="e.g. Businessman">
        </div>
        <div class="form-group" style="margin-bottom:0.5rem;">
          <label class="form-label" style="font-size:0.75rem; margin-bottom:0.2rem;">Father's Contact</label>
          <input class="form-input" id="dfm" value="${escapeHtml(details.fatherMobile)}" placeholder="Father's mobile number">
        </div>
        
        <div class="form-group" style="margin-bottom:0.5rem;">
          <label class="form-label" style="font-size:0.75rem; margin-bottom:0.2rem;">Mother's Name</label>
          <input class="form-input" id="dmn" value="${escapeHtml(details.motherName)}" placeholder="Mother's full name">
        </div>
        <div class="form-group" style="margin-bottom:0.5rem;">
          <label class="form-label" style="font-size:0.75rem; margin-bottom:0.2rem;">Mother's Occupation</label>
          <input class="form-input" id="dmo" value="${escapeHtml(details.motherOccupation)}" placeholder="e.g. Housewife">
        </div>
        <div class="form-group" style="margin-bottom:0.5rem;">
          <label class="form-label" style="font-size:0.75rem; margin-bottom:0.2rem;">Mother's Contact</label>
          <input class="form-input" id="dmm" value="${escapeHtml(details.motherMobile)}" placeholder="Mother's mobile number">
        </div>
        
        <div class="form-group" style="margin-bottom:0.5rem;">
          <label class="form-label" style="font-size:0.75rem; margin-bottom:0.2rem;">Home Address (घरको ठेगाना)</label>
          <input class="form-input" id="dha" value="${escapeHtml(details.homeAddress)}" placeholder="e.g. Byasi, Bhaktapur">
        </div>

        <div style="font-weight:700; font-size:0.8rem; border-bottom:1px solid #e2e8f0; padding-bottom:0.25rem; margin-top:0.5rem; color:#1e293b;">🗣️ Languages & Schooling</div>
        
        <div class="form-group" style="margin-bottom:0.5rem;">
          <label class="form-label" style="font-size:0.75rem; margin-bottom:0.2rem;">Mother Tongue (मातृभाषा)</label>
          <input class="form-input" id="dmt" value="${escapeHtml(details.motherTongue)}" placeholder="e.g. Newari, Tamang, Nepali">
        </div>
        <div class="form-group" style="margin-bottom:0.5rem;">
          <label class="form-label" style="font-size:0.75rem; margin-bottom:0.2rem;">Home Language (घरमा बोल्ने भाषा)</label>
          <input class="form-input" id="dhl" value="${escapeHtml(details.homeLanguage)}" placeholder="e.g. Nepali">
        </div>
        <div class="form-group" style="margin-bottom:0.5rem;">
          <label class="form-label" style="font-size:0.75rem; margin-bottom:0.2rem;">Nepali Proficiency (नेपाली दक्षता)</label>
          <input class="form-input" id="dnp" value="${escapeHtml(details.nepaliProficiency)}" placeholder="e.g. High / Medium / Low">
        </div>
        <div class="form-group" style="margin-bottom:0.5rem;">
          <label class="form-label" style="font-size:0.75rem; margin-bottom:0.2rem;">Admission Date (भर्ना मिति)</label>
          <input class="form-input" id="dad" value="${escapeHtml(details.admissionDate)}" placeholder="e.g. 2078 Baishakh 05">
        </div>

        <div style="font-weight:700; font-size:0.8rem; border-bottom:1px solid #e2e8f0; padding-bottom:0.25rem; margin-top:0.5rem; color:#1e293b;">🏥 Health details (२. स्वास्थ्यसम्बन्धी विवरण)</div>
        
        <div class="form-group" style="margin-bottom:0.5rem;">
          <label class="form-label" style="font-size:0.75rem; margin-bottom:0.2rem;">Weight (तौल in KG)</label>
          <input class="form-input" id="dwt" value="${escapeHtml(details.weight)}" placeholder="e.g. 24">
        </div>
        <div class="form-group" style="margin-bottom:0.5rem;">
          <label class="form-label" style="font-size:0.75rem; margin-bottom:0.2rem;">Height (उचाइ in CM)</label>
          <input class="form-input" id="dht" value="${escapeHtml(details.height)}" placeholder="e.g. 125">
        </div>
        <div class="form-group" style="margin-bottom:0.5rem;">
          <label class="form-label" style="font-size:0.75rem; margin-bottom:0.2rem;">Special Disease (विशेष रोग)</label>
          <input class="form-input" id="dsd" value="${escapeHtml(details.specialDisease)}" placeholder="e.g. None">
        </div>
        <div class="form-group" style="margin-bottom:0.5rem;">
          <label class="form-label" style="font-size:0.75rem; margin-bottom:0.2rem;">Disability (अपाङ्गता)</label>
          <input class="form-input" id="ddb" value="${escapeHtml(details.disability)}" placeholder="e.g. None">
        </div>
      </div>
    </details>
  `;
};

window.serializeCasDetails = function(fallbackParents) {
  const ids = [
    "dfn", "dfo", "dfm", "dmn", "dmo", "dmm", "dha", "dad", 
    "dmt", "dhl", "dnp", "dwt", "dht", "dsd", "ddb"
  ];
  const hasDetailedFields = ids.some(id => {
    const el = document.getElementById(id);
    return el && el.value.trim() !== "";
  });

  if (hasDetailedFields) {
    const details = {};
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        const keyMap = {
          dfn: "fatherName", dfo: "fatherOccupation", dfm: "fatherMobile",
          dmn: "motherName", dmo: "motherOccupation", dmm: "motherMobile",
          dha: "homeAddress", dad: "admissionDate",
          dmt: "motherTongue", dhl: "homeLanguage", dnp: "nepaliProficiency",
          dwt: "weight", dht: "height", dsd: "specialDisease", ddb: "disability"
        };
        details[keyMap[id]] = el.value.trim();
      }
    });
    return JSON.stringify(details);
  }
  return fallbackParents || "";
};