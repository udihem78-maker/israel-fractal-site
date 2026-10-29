/* Read-only, source-labeled public directory. No tracking or external runtime API. */
(() => {
  "use strict";
  const root = document.getElementById("monitor");
  const base = new URL(document.body.dataset.base, location.href);
  const escape = value => String(value ?? "").replace(/[&<>"']/g, ch =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const date = value => value ? new Intl.DateTimeFormat("he-IL", {
    day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Jerusalem"
  }).format(new Date(value.length === 10 ? value + "T12:00:00Z" : value)) : "לא ידוע";
  const count = value => new Intl.NumberFormat("he-IL").format(value);
  const link = path => new URL(path, base).href;
  const safeSource = value => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && ["oknesset.org", "production.oknesset.org"].includes(url.hostname)
        ? url.href : "https://oknesset.org/";
    } catch { return "https://oknesset.org/"; }
  };
  let data, history = [], mode = "all", query = "", faction = "", page = 0;
  const pageSize = 15;
  let lastFocused;

  function render() {
    const ageDays = Math.floor((Date.now() - new Date(data.fetched_at)) / 86400000);
    const futureSnapshot = ageDays < -1;
    const members = data.people.filter(p => p.is_mk).length;
    const government = data.people.filter(p => p.is_government).length;
    root.innerHTML = `
      <div class="eyebrow">מעקב ציבורי · מקורות פתוחים · ללא דירוג מפלגתי</div>
      <div class="intro"><div><h1>מי בתפקיד.<br>מה אפשר למדוד.</h1>
      <p>חברי הכנסת, הממשלה והמערכות הציבוריות — במקום אחד. רשומות מקור, תקופות כהונה ופעילות מתועדת, עם שקיפות מלאה לגבי מה שעדיין חסר.</p></div>
      <div class="snapshot-meta">תמונת נתונים שנאספה<strong>${date(data.fetched_at)}</strong>כנסת ${escape(data.knesset)} · ממשלה ${escape(data.government)}<br>לפי המקור המשני; לא אימות עצמאי</div></div>
      <div class="notice"><strong>חשוב: זו אינה רשימה מאומתת של נבחרים חדשים.</strong><p>התפקידים מוצגים כפי שסומנו במאגר ״כנסת פתוחה״. מקור הכנסת הישיר אינו נגיש מסביבת האיסוף. תאריך סנכרון אינו אישור שהכהונה או המידע אומתו מחדש.</p></div>
      ${ageDays > 2 || futureSnapshot ? `<div class="notice"><strong>${futureSnapshot ? "יש פער בין שעון הדפדפן למועד האיסוף." : `תמונת הנתונים נאספה לפני ${ageDays} ימים.`}</strong> יש לבדוק את מועדי המקור לפני הסתמכות.</div>` : ""}
      <div class="stats">
        <div class="stat"><span class="label">חברי כנסת במקור</span><strong>${count(members)}</strong><small>כהונה המסומנת כפעילה בכנסת ${escape(data.knesset)}</small></div>
        <div class="stat"><span class="label">בעלי תפקידים בממשלה</span><strong>${count(government)}</strong><small>כולל שרים וסגני שרים · ייתכן כפל עם ח״כים</small></div>
        <div class="stat"><span class="label">משרדי ממשלה במקור</span><strong>${count(data.ministries.length)}</strong><small>מסומנים פעילים בממשלה ${escape(data.government)}</small></div>
        <div class="stat status"><span class="label">מדידת פעילות עדכנית</span><strong>עדיין חסר מקור</strong><small>נתוני הוועדות האחרונים: ${date(data.activity.latest_event_at)}</small></div>
      </div>
      <section id="directory" aria-labelledby="directory-title">
        <div class="section-heading"><div><h2 id="directory-title">מפת בעלי התפקידים</h2><p>רשימה לפי א״ב, לא דירוג ביצועים. אפשר לפתוח כרטיס לכל אדם או משרד.</p></div>
        <button class="secondary" id="reload-data">טעינה מחדש</button></div>
        <div class="directory"><div class="toolbar">
          <div class="tabs" aria-label="סינון סוג רשומה">
            <button data-mode="all" aria-pressed="${mode === "all"}">כל האנשים</button>
            <button data-mode="mks" aria-pressed="${mode === "mks"}">חברי הכנסת</button>
            <button data-mode="government" aria-pressed="${mode === "government"}">שרים וסגני שרים</button>
            <button data-mode="ministries" aria-pressed="${mode === "ministries"}">משרדי הממשלה</button>
          </div>
          <div class="filters"><label for="search">חיפוש בשם, בתפקיד או במשרד<input id="search" type="search" placeholder="למשל: שם נבחר ציבור, חינוך, בריאות…" autocomplete="off" value="${escape(query)}"></label>
          <label for="faction">סיעה לפי המקור<select id="faction"><option value="">כל הסיעות</option>${[...new Set(data.people.map(p => p.faction).filter(Boolean))].sort((a,b) => a.localeCompare(b,"he")).map(f => `<option value="${escape(f)}" ${f === faction ? "selected" : ""}>${escape(f)}</option>`).join("")}</select></label></div>
        </div>
        <div id="results"></div></div>
      </section>
      <section id="methodology" aria-labelledby="method-title">
        <div class="section-heading"><div><h2 id="method-title">נתונים לפני ציונים</h2><p>פעילות, תוצאה ואיכות הן לא אותו הדבר.</p></div></div>
        <div class="method-grid"><article class="panel"><h3>מה המדד המוצג אומר?</h3>
          <p>״תיעודי דיונים״ הוא מספר צירופי ועדה ומועד ייחודיים שבהם האדם מופיע במאגר משתתפי הוועדות, בחלון של 30 ימים המסתיים ביום הפעילות האחרון במאגר.</p>
          <ul><li>זה אינו אחוז נוכחות: אין כאן מכנה של דיונים שהאדם נדרש להשתתף בהם.</li><li>אפס תיעודים אינו הוכחת היעדרות. נתון חסר מסומן במפורש.</li><li>מספר הדיונים אינו ציון איכות, הישג או המלצת הצבעה.</li><li>נתונים ישנים לא מוצגים כמדידת תפקוד עכשווית.</li></ul>
        </article><article class="panel"><h3>מה חסר למדידה רציפה?</h3>
          <p>כעת אין מקור מחובר ועדכני להצבעות ולנוכחות, ואין מקור מחובר לביצוע תקציב, איכות שירות או עמידה ביעדים. לכן לא מוצג ציון תפקוד משוקלל.</p>
          <p>גם מנכ״לי משרדים וראשי גופים ציבוריים טרם נכללים. הרשימה אינה מכסה את כל בעלי התפקידים בדרג הארצי.</p>
          <a class="source-link" href="${escape(link("he/research.html"))}">למחקר המקורי ולמתודולוגיה ההיסטורית ←</a>
        </article></div>
      </section>
      <section aria-labelledby="coverage-title"><div class="section-heading"><div><h2 id="coverage-title">כיסוי המידע</h2><p>כל שכבה מסומנת לפי מה שחובר בפועל.</p></div></div>
        <div class="coverage-grid">
          <article class="panel"><span class="badge source">מחובר · מקור משני</span><h3>זהות ותפקידים</h3><p>חברי כנסת, תפקידי ממשלה, חברות בוועדות ומשרדים פעילים כפי שנרשמו במקור.</p></article>
          <article class="panel"><span class="badge historical">היסטורי בלבד</span><h3>פעילות בוועדות</h3><p>${date(data.activity.start)}–${date(data.activity.end)}. תאריך יצירת הקובץ אינו תאריך הפעילות.</p></article>
          <article class="panel"><span class="badge">טרם חובר</span><h3>תוצאות השירות הציבורי</h3><p>ביצוע תקציב, זמני טיפול ועמידה ביעדים; מנכ״לים וראשי גופים — נדרש מקור נוסף.</p></article>
        </div>
      </section>
      <section aria-labelledby="sources-title"><div class="section-heading"><h2 id="sources-title">מקורות והיסטוריית איסוף</h2></div>
        <div class="method-grid"><article class="panel"><h3>שרשרת המקור</h3>
          <p>מקור משני: כנסת פתוחה / הסדנא לידע ציבורי, המבוסס על ממשקי הכנסת. כל תפקיד מתייחס לרשומת המקור ואינו אישור עצמאי לנכונותה.</p>
          <a class="source-link" href="https://oknesset.org/" target="_blank" rel="noopener">תיאור המאגרים בכנסת פתוחה ↗</a>
          ${Object.entries(data.sources).map(([key,s]) => `<details><summary>${escape(({people:"אנשים",roles:"כהונות ותפקידים",positions:"סוגי תפקידים",ministries:"משרדי ממשלה",attendance:"תיעוד משתתפים בוועדות"})[key] || key)}</summary>
          <a class="source-link" href="${escape(safeSource(s.url))}" target="_blank" rel="noopener">קובץ המקור ↗</a><p class="provenance">שינוי קובץ לפי שרת המקור: ${date(s.last_modified)}<br>SHA-256: <bdi>${escape(s.sha256)}</bdi></p></details>`).join("")}
          <a class="source-link" href="${escape(link("data/national.json"))}">הורדת תמונת הנתונים (JSON)</a>
        </article><article class="panel"><h3>היסטוריית תמונות הנתונים</h3>
          <p>כל שורה היא איסוף, לא פעילות שבוצעה באותו יום. נדרשות תמונות נוספות כדי למדוד שינוי לאורך זמן.</p>
          <ul class="history-list">${history.slice(-7).reverse().map(h => `<li><span>${date(h.date)} · ${escape(h.mk_count)} ח״כים</span><span>פעילות במקור עד ${date(h.source_activity_end)}</span></li>`).join("") || "<li>היסטוריית האיסוף אינה זמינה.</li>"}</ul>
          <p>תצורת סנכרון יומי ב־GitHub Actions נכללת בהצעת השינוי. היא אינה פעילה מהתצוגה המקדימה; נדרש מיזוג לענף הראשי והפעלת Actions. הדף בודק אם פורסמה תמונת נתונים חדשה כל חמש דקות כשהוא גלוי ואינו בשימוש. בקשת טעינה מחדש כאן אינה מושכת נתונים ממקורות חיצוניים.</p>
        </article></div>
      </section>
      <dialog id="profile-dialog" aria-labelledby="profile-title"><div id="profile-content"></div></dialog>`;
    root.setAttribute("aria-busy", "false");
    bind();
    renderResults();
  }

  function bind() {
    root.querySelectorAll("[data-mode]").forEach(button => button.addEventListener("click", () => {
      mode = button.dataset.mode; page = 0;
      root.querySelectorAll("[data-mode]").forEach(b => b.setAttribute("aria-pressed", String(b === button)));
      document.getElementById("faction").disabled = mode === "ministries";
      renderResults();
    }));
    document.getElementById("search").addEventListener("input", event => {
      query = event.target.value; page = 0; renderResults();
    });
    document.getElementById("faction").addEventListener("change", event => {
      faction = event.target.value; page = 0; renderResults();
    });
    document.getElementById("reload-data").addEventListener("click", () => load(true));
    const dialog = document.getElementById("profile-dialog");
    dialog.addEventListener("close", () => {
      document.body.classList.remove("dialog-open");
      lastFocused?.focus();
    });
    dialog.addEventListener("click", event => {
      if (event.target === dialog) {
        const rect = dialog.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right ||
            event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
      }
    });
  }

  function filtered() {
    const q = query.trim().normalize("NFKC").toLocaleLowerCase("he");
    const list = mode === "ministries" ? data.ministries : data.people.filter(p =>
      (mode !== "mks" || p.is_mk) && (mode !== "government" || p.is_government) &&
      (!faction || p.faction === faction));
    return list.filter(item => {
      const text = [item.name, item.faction, ...(item.roles || []).map(r => r.title + " " + r.organization)].join(" ");
      return text.normalize("NFKC").toLocaleLowerCase("he").includes(q);
    });
  }

  function renderResults() {
    const items = filtered();
    const pages = Math.max(1, Math.ceil(items.length / pageSize));
    page = Math.min(page, pages - 1);
    const ministry = mode === "ministries";
    document.getElementById("results").innerHTML = `
      <div class="result-meta"><span role="status" aria-live="polite">${count(items.length)} רשומות · עמוד ${page + 1} מתוך ${pages}</span><span>לפי המקור · לא דירוג ביצועים</span></div>
      <div class="table-scroll" role="region" aria-label="טבלת תפקידים, ניתן לגלול אופקית בנייד" tabindex="0">
      <table><thead><tr><th scope="col">${ministry ? "משרד" : "שם"}</th><th scope="col">${ministry ? "בעלי תפקידים מקושרים" : "תפקידים במקור"}</th><th scope="col">${ministry ? "תוצאות שירות" : "סיעה"}</th><th scope="col">${ministry ? "כיסוי" : "תיעודי דיונים · היסטורי"}</th><th scope="col">פרטים</th></tr></thead>
      <tbody>${items.slice(page * pageSize, (page + 1) * pageSize).map(item => ministry ? ministryRow(item) : personRow(item)).join("")}</tbody></table>
      ${!items.length ? '<p class="empty">לא נמצאו רשומות התואמות לחיפוש. נסו שם או תפקיד אחר.</p>' : ""}</div>
      <div class="pagination"><button class="secondary" id="previous-page" ${page === 0 ? "disabled" : ""}>הקודם</button><span>${page + 1} / ${pages}</span><button class="secondary" id="next-page" ${page === pages - 1 ? "disabled" : ""}>הבא</button></div>`;
    document.getElementById("previous-page").addEventListener("click", () => { page--; renderResults(); });
    document.getElementById("next-page").addEventListener("click", () => { page++; renderResults(); });
    root.querySelectorAll("[data-person]").forEach(button => button.addEventListener("click", () => openPerson(button.dataset.person, button)));
    root.querySelectorAll("[data-ministry]").forEach(button => button.addEventListener("click", () => openMinistry(button.dataset.ministry, button)));
  }

  function personRow(p) {
    const metric = p.metrics.documented_committee_meetings;
    return `<tr><td><div class="person-name"><span class="avatar" aria-hidden="true">${escape(p.name.split(" ").map(w => w[0]).slice(0,2).join(""))}</span><div><button class="profile-button" data-person="${escape(p.id)}">${escape(p.name)}</button><span class="subtext">${p.is_mk ? `כנסת ${escape(data.knesset)}` : "תפקיד ממשלתי"}</span></div></div></td>
      <td class="role-text">${p.roles.slice(0,3).map(r => `${escape(r.title)}${r.organization ? " · " + escape(r.organization) : ""}`).join("<br>")}${p.roles.length > 3 ? `<span class="subtext">ועוד ${p.roles.length - 3} תפקידים בכרטיס</span>` : ""}</td>
      <td>${escape(p.faction || "אין שיוך זמין")}</td>
      <td>${metric?.value != null ? `<span class="metric-value">${count(metric.value)}</span><span class="badge historical">היסטורי</span><span class="subtext">${date(metric.start)}–${date(metric.end)}</span>` : '<span class="badge">אין נתון מתאים</span>'}</td>
      <td><a class="source-link" href="${escape(safeSource(p.source_url))}" target="_blank" rel="noopener" aria-label="מקור עבור ${escape(p.name)}">מקור ↗</a></td></tr>`;
  }

  function ministryRow(m) {
    const names = m.official_ids.map(id => data.people.find(p => p.id === id)?.name).filter(Boolean);
    return `<tr><td><button class="profile-button" data-ministry="${escape(m.id)}">${escape(m.name)}</button><span class="subtext">ממשלה ${escape(m.government)}</span></td>
      <td class="role-text">${escape(names.join(" · ") || "אין קישור מאומת במקור")}</td><td><span class="badge">טרם חובר מקור</span></td>
      <td><span class="subtext">מנכ״ל ויעדי ביצוע: חסרים</span></td><td><button class="secondary" data-ministry="${escape(m.id)}" aria-label="פרטי ${escape(m.name)}">פרטים</button></td></tr>`;
  }

  function dialog(title, subtitle, body, button) {
    lastFocused = button;
    document.getElementById("profile-content").innerHTML = `<div class="dialog-head"><div><h2 id="profile-title">${escape(title)}</h2><span class="subtext">${escape(subtitle)}</span></div><button class="close-button" aria-label="סגירת כרטיס">×</button></div><div class="dialog-body">${body}</div>`;
    const el = document.getElementById("profile-dialog");
    el.querySelector(".close-button").addEventListener("click", () => el.close());
    document.body.classList.add("dialog-open");
    el.showModal();
  }

  function openPerson(id, button) {
    const p = data.people.find(person => person.id === id);
    if (!p) return;
    const m = p.metrics.documented_committee_meetings;
    dialog(p.name, "רשומה ממקור משני · אין ציון תפקוד כולל", `
      <h3>כהונות המסומנות כפעילות במקור</h3>
      <ul>${p.roles.map(r => `<li><strong>${escape(r.title)}</strong> ${escape(r.organization)}<span class="subtext">מ־${date(r.start)} · שינוי רשומת מקור: ${date(r.updated_at)}</span></li>`).join("")}</ul>
      <h3>כיסוי המדידה</h3><dl>
        <div><dt>דיונים מתועדים — נתון היסטורי</dt><dd>${m?.value != null ? count(m.value) : "אין נתון מתאים"}</dd><span class="subtext">${date(m?.start)}–${date(m?.end)}</span></div>
        <div><dt>נוכחות והצבעות בתקופה הנוכחית</dt><dd>אין מקור עדכני מחובר</dd></div>
      </dl><p class="notice">תיעוד השתתפות אינו אחוז נוכחות או הערכת איכות. אין להסיק היעדרות מאפס תיעודים או מחוסר נתונים.</p>
      <h3>ועדות לפי רשומות התפקיד</h3><p>${escape(p.committees.join(" · ") || "אין חברות בוועדות במקור המסונן")}</p>
      <h3>היסטוריית כהונות במקור</h3><ul>${p.role_history.map(r => `<li>${escape(r.title)} ${escape(r.organization)}<span class="subtext">${date(r.start)}–${r.end ? date(r.end) : "לא נרשם מועד סיום"} · היעדר מועד סיום אינו אישור כהונה נוכחית</span></li>`).join("")}</ul>
      <a class="source-link" href="${escape(safeSource(p.source_url))}" target="_blank" rel="noopener">פתיחת הרשומה בכנסת פתוחה ↗</a>`, button);
  }

  function openMinistry(id, button) {
    const m = data.ministries.find(item => item.id === id);
    if (!m) return;
    const officials = m.official_ids.map(pid => data.people.find(p => p.id === pid)).filter(Boolean);
    dialog(m.name, `מסומן כפעיל במקור · ממשלה ${m.government}`, `
      <h3>בעלי תפקידים המקושרים במקור</h3><ul>${officials.map(p => `<li>${escape(p.name)} · ${escape(p.roles.filter(r => r.ministry_id === m.id).map(r => r.title).join(", "))}</li>`).join("") || "<li>אין קישור זמין</li>"}</ul>
      <h3>נתונים שטרם חוברו</h3><dl><div><dt>מנכ״ל המשרד</dt><dd>טרם אומת</dd></div><div><dt>עמידה ביעדים</dt><dd>אין מקור מחובר</dd></div><div><dt>ביצוע תקציב</dt><dd>אין מקור מחובר</dd></div><div><dt>זמני שירות</dt><dd>אין מקור מחובר</dd></div></dl>
      <p class="notice info">זהו כרטיס תפקידים וכיסוי נתונים, לא מדידת תפקוד של המשרד.</p>
      <a class="source-link" href="${escape(safeSource(data.sources.ministries.url))}" target="_blank" rel="noopener">מקור רשימת המשרדים ↗</a>
      <p class="provenance">שינוי רשומת מקור: ${date(m.source_row_updated_at)}</p>`, button);
  }

  async function load(isReload = false) {
    root.setAttribute("aria-busy", "true");
    const button = document.getElementById("reload-data");
    if (button) { button.disabled = true; button.textContent = "טוענים…"; }
    try {
      const response = await fetch(link("data/national.json"), { cache: "no-store" });
      if (!response.ok) throw new Error("snapshot unavailable");
      const next = await response.json();
      if (next.schema_version !== 1 || !Array.isArray(next.people) || !Array.isArray(next.ministries)) throw new Error("invalid schema");
      let nextHistory = [];
      try {
        const h = await fetch(link("data/history.json"), { cache: "no-store" });
        if (h.ok) { const value = await h.json(); if (Array.isArray(value)) nextHistory = value; }
      } catch { /* Directory remains usable if collection history is unavailable. */ }
      data = next; history = nextHistory;
      render();
      if (isReload) document.getElementById("reload-data").focus();
    } catch {
      root.setAttribute("aria-busy", "false");
      if (data) {
        if (button) { button.disabled = false; button.textContent = "טעינה מחדש"; }
        const notice = document.createElement("p");
        notice.className = "notice"; notice.role = "alert";
        notice.textContent = "הטעינה נכשלה. נשארה מוצגת תמונת הנתונים הקודמת; בדקו את תאריך האיסוף.";
        root.prepend(notice);
      } else {
        root.innerHTML = `<p class="notice" role="alert">לא ניתן לטעון את תמונת הנתונים. לא מוצגים מספרים חלופיים או נתוני דמה.</p><button class="secondary" id="retry-load">ניסיון נוסף</button><p><a href="${escape(link("he/research.html"))}">למחקר המקורי</a></p>`;
        document.getElementById("retry-load").addEventListener("click", () => load());
      }
    }
  }
  load();
  // Read already published snapshots, not the upstream source. Avoid interrupting
  // a profile, keyboard focus, search input or an active selection.
  setInterval(async () => {
    if (!data || document.hidden || document.querySelector("dialog[open]") ||
        root.contains(document.activeElement) || String(window.getSelection())) return;
    try {
      const response = await fetch(link("data/national.json"), { cache: "no-store" });
      if (!response.ok) return;
      const next = await response.json();
      if (next.fetched_at !== data.fetched_at) await load();
    } catch { /* Keep the dated snapshot; never replace it with mock data. */ }
  }, 5 * 60 * 1000);
})();
