const $ = (s) => document.querySelector(s);
const pages = {
  kpi: { state: { year: "all", outlet: "" } },
  detail: { state: { from: null, to: null, outlet: "" } },
  pemodal: { state: {} },
  investasi: { state: { page: 1, pageSize: 10 } },
};
let activePage = "kpi";

const fmtRp = new Intl.NumberFormat("id-ID", {
  style: "currency", currency: "IDR", maximumFractionDigits: 0,
});
const fmtShort = (v) => {
  if (Math.abs(v) >= 1e9) return "Rp " + (v / 1e9).toFixed(2) + " M";
  if (Math.abs(v) >= 1e6) return "Rp " + (v / 1e6).toFixed(1) + " jt";
  if (Math.abs(v) >= 1e3) return "Rp " + (v / 1e3).toFixed(0) + " rb";
  return "Rp " + v;
};

async function api(path, params = {}, page = activePage) {
  const st = pages[page].state;
  const q = new URLSearchParams();
  if (st.from) q.set("from", st.from);
  if (st.to) q.set("to", st.to);
  if (page === "kpi" && st.year !== "all") {
    q.set("from", `${st.year}-01-01`);
    q.set("to", `${st.year}-12-31`);
  }
  if (st.outlet) q.set("outlet", st.outlet);
  for (const [k, v] of Object.entries(params)) q.set(k, v);
  const res = await fetch(`${path}?${q}`);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

/* ---------- header statis: modal awal & payback (tanpa filter) ---------- */
const MODAL_AWAL = 607049223;

function renderStaticKpis(totalNett) {
  $("#hkpi-modal").textContent = fmtRp.format(MODAL_AWAL);
  $("#hkpi-payback").textContent =
    (totalNett / MODAL_AWAL * 100).toFixed(1) + "%";
  $("#hkpi-nett").textContent = fmtRp.format(totalNett);
}

/* ---------- halaman KPI ---------- */
function renderKpis(d) {
  const cards = [
    { key: "omzet", label: "Total Omzet" },
    { key: "expense", label: "Total Expense" },
    { key: "net_profit", label: "Laba Bersih", cls: "profit" },
    { key: "margin_pct", label: "Net Profit Margin", suffix: "%" },
    { key: "avg_net_profit", label: "Rata-rata Laba Bersih / Bulan", cls: "profit" },
  ];
  $("#kpis").innerHTML = cards.map((c) => {
    const cur = d.current[c.key];
    const dl = d.deltas[c.key];
    const arrow = dl == null ? "" : dl >= 0 ? "▲" : "▼";
    const cls = dl == null ? "" : dl >= 0 ? "up" : "down";
    const txt = c.suffix ? cur.toFixed(1) + "%" : fmtRp.format(cur);
    const deltaTxt = dl == null ? "" : `${arrow} ${Math.abs(dl)}% vs periode lalu`;
    return `<div class="kpi ${c.cls || ""}">
      <div class="label"><span>${c.label}</span>
        <span class="delta ${cls}">${deltaTxt}</span></div>
      <div class="value">${txt}</div>
      <div class="ruler"></div>
    </div>`;
  }).join("");
}

/* ---------- line chart laba bersih per tahun (halaman KPI) ---------- */
const YEAR_COLORS = () => ({ 2024: C().blue, 2025: C().pos, 2026: C().brass });
const yearColor = (y) => YEAR_COLORS()[y] || "#b06ab3";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

async function renderProfitYear() {
  const st = pages.kpi.state;
  const data = await api("/api/monthly-profit", {}, "kpi");
  const byYear = {};
  for (const r of data) (byYear[r.year] ||= [])[r.month - 1] = r.nett_profit;
  const years = st.year === "all" ? Object.keys(byYear).sort() : [st.year];
  chart("chart-profit-year").setOption({
    tooltip: { ...TOOLTIP(), trigger: "axis",
      valueFormatter: (v) => fmtRp.format(v) },
    legend: { top: 0, textStyle: { color: C().text } },
    grid: { left: 76, right: 20, top: 34, bottom: 30 },
    xAxis: { type: "category", boundaryGap: false, data: MONTHS, ...AXIS() },
    yAxis: { type: "value", ...AXIS(), axisLabel: { ...AXIS().axisLabel, formatter: fmtShort } },
    series: years.map((y) => ({
      name: y, type: "line", smooth: false, symbolSize: 5,
      data: byYear[y] ?? [],
      lineStyle: { color: yearColor(y), width: 2 },
      itemStyle: { color: yearColor(y) },
      connectNulls: true,
    })),
  });
}

async function renderOmzetProfit() {
  const st = pages.kpi.state;
  let data = await api("/api/monthly-profit", {}, "kpi");
  if (st.year !== "all") data = data.filter((r) => r.year === Number(st.year));
  const labels = data.map((r) => r.period.slice(5) + r.period.slice(2, 4));
  chart("chart-omzet-profit").setOption({
    tooltip: { ...TOOLTIP(), trigger: "axis", valueFormatter: (v) => fmtRp.format(v) },
    legend: { top: 0, textStyle: { color: C().text } },
    grid: { left: 76, right: 20, top: 34, bottom: 34 },
    xAxis: { type: "category", boundaryGap: false, data: labels, ...AXIS(),
      axisLabel: { ...AXIS().axisLabel, rotate: 45 } },
    yAxis: { type: "value", ...AXIS(), axisLabel: { ...AXIS().axisLabel, formatter: fmtShort } },
    series: [
      { name: "Omzet", type: "line", smooth: false, symbolSize: 4,
        data: data.map((r) => r.omzet),
        lineStyle: { color: C().brass, width: 2 },
        itemStyle: { color: C().brass } },
      { name: "Laba Bersih", type: "line", smooth: false, symbolSize: 4,
        data: data.map((r) => r.nett_profit),
        lineStyle: { color: C().pos, width: 2 },
        itemStyle: { color: C().pos } },
    ],
  });
}

/* ---------- halaman Pemodal ---------- */
const INVESTORS = [
  {
    name: "Papah",
    modal: 100000000,
    details: [
      { label: "Pendaftaran", value: 99000000 },
      { label: "Ruko", value: 1000000 },
    ],
  },
  {
    name: "Guntur",
    modal: 229700000,
    details: [
      { label: "Ruko", value: 229000000 },
      { label: "Notaris", value: 700000 },
    ],
  },
  {
    name: "Bayu",
    modal: 277349223,
    details: [
      { label: "Renovasi", value: 234270227 },
      { label: "Modal Kerja", value: 25000000 },
      { label: "Promosi", value: 4890000 },
      { label: "Selisih Kurang Renovasi", value: 11538996 },
      { label: "Renov Tiang", value: 1650000 },
    ],
  },
];

async function renderPemodal() {
  const monthly = await fetch("/api/monthly-profit").then((r) => r.json());
  const totalNett = monthly.reduce((s, r) => s + r.nett_profit, 0);
  const totalModal = INVESTORS.reduce((s, i) => s + i.modal, 0);
  $("#investors").innerHTML = INVESTORS.map((i) => {
    const pct = i.modal / totalModal * 100;
    const returned = totalNett * i.modal / totalModal;
    const payback = returned / i.modal * 100;
    return `<div class="kpi investor">
      <div class="label"><span>${i.name}</span></div>
      <div class="value">${fmtRp.format(i.modal)}</div>
      <div class="inv-rows">
        <div><span>Kepemilikan</span><b>${pct.toFixed(1)}%</b></div>
        <div><span>Modal Terkembalikan</span>
          <b>${fmtRp.format(returned)} · ${payback.toFixed(1)}%</b></div>
      </div>
      <div class="ruler"></div>
    </div>`;
  }).join("");

  // Render detail table
  // Build header
  const thead = $("#pemodal-thead");
  thead.innerHTML = `<th>Detail</th>` + INVESTORS.map((i) =>
    `<th class="num">${i.name}</th>`).join("") + `<th class="num">Total</th>`;

  // Collect all unique detail labels
  const allLabels = [...new Set(INVESTORS.flatMap((i) => i.details.map((d) => d.label)))];

  // Build rows
  const detailRows = allLabels.map((label) => {
    let rowTotal = 0;
    const cells = INVESTORS.map((i) => {
      const d = i.details.find((x) => x.label === label);
      if (d) { rowTotal += d.value; return `<td class="num">${fmtRp.format(d.value)}</td>`; }
      return `<td class="num">–</td>`;
    }).join("");
    return `<tr><td>${label}</td>${cells}<td class="num">${fmtRp.format(rowTotal)}</td></tr>`;
  }).join("");

  // Total row
  const totalCells = INVESTORS.map((i) => {
    const sub = i.details.reduce((s, d) => s + d.value, 0);
    return `<td class="num">${fmtRp.format(sub)}</td>`;
  }).join("");
  const grandTotal = INVESTORS.reduce((s, i) => s + i.details.reduce((ss, d) => ss + d.value, 0), 0);
  const totalRow = `<tr class="total-row"><td>Total</td>${totalCells}<td class="num">${fmtRp.format(grandTotal)}</td></tr>`;

  $("#investor-details").innerHTML = detailRows + totalRow;
}

/* ---------- halaman Investasi (CRUD) ---------- */
const TIPE_LABEL = { Emas: "Emas", Sukuk: "Sukuk", Reksadana: "Reksadana" };

async function renderInvestments() {
  const list = await fetch("/api/investments").then((r) => r.json());
  const uangInvest = list.reduce((s, i) => s + i.dana, 0);
  const monthly = await fetch("/api/monthly-profit").then((r) => r.json());
  const totalNett = monthly.reduce((s, r) => s + r.nett_profit, 0);
  const kas = totalNett - uangInvest;
  $("#inv-cards").innerHTML = [
    { label: "Kas", value: kas, cls: kas >= 0 ? "profit" : "" },
    { label: "Uang Invest", value: uangInvest },
  ].map((c) => `<div class="kpi ${c.cls}">
      <div class="label"><span>${c.label}</span></div>
      <div class="value">${fmtRp.format(c.value)}</div>
      <div class="ruler"></div>
    </div>`).join("");
  const kasVal = Math.max(kas, 0);
  const tot = kasVal + uangInvest;
  chart("chart-kas").setOption({
    tooltip: { ...TOOLTIP(), trigger: "item",
      formatter: (p) => `${p.name}<br/>${fmtRp.format(p.value)} (${p.percent}%)` },
    legend: { bottom: 0, textStyle: { color: C().text } },
    series: [{
      type: "pie", radius: ["46%", "70%"], center: ["50%", "46%"],
      itemStyle: { borderRadius: 10, borderColor: C().panel, borderWidth: 2 },
      label: { show: false },
      data: [
        { name: "Kas", value: kasVal, itemStyle: { color: C().pos } },
        { name: "Uang Invest", value: uangInvest, itemStyle: { color: C().brass } },
      ],
    }],
    graphic: [{
      type: "text", left: "center", top: "42%",
      style: { text: tot ? (kasVal / tot * 100).toFixed(0) + "% kas" : "–",
        fill: C().text, fontSize: 13, fontFamily: "IBM Plex Mono" },
    }],
  });

  const byTipe = {};
  for (const i of list) byTipe[i.tipe] = (byTipe[i.tipe] || 0) + i.dana;
  const TIPE_COLORS = { Emas: C().brass, Sukuk: C().blue, Reksadana: C().pos };
  chart("chart-tipe").setOption({
    tooltip: { ...TOOLTIP(), trigger: "item",
      formatter: (p) => `${p.name}<br/>${fmtRp.format(p.value)} (${p.percent}%)` },
    legend: { bottom: 0, textStyle: { color: C().text } },
    series: [{
      type: "pie", roseType: "radius", radius: ["14%", "70%"],
      center: ["50%", "46%"],
      itemStyle: { borderRadius: 6, borderColor: C().panel, borderWidth: 2 },
      label: { color: C().text, formatter: "{b}\n{d}%" },
      data: Object.entries(byTipe).map(([t, v]) => ({
        name: t, value: v, itemStyle: { color: TIPE_COLORS[t] || "#b06ab3" },
      })),
    }],
  });

  const byLokasi = {};
  for (const i of list) byLokasi[i.lokasi || "(tanpa lokasi)"] =
    (byLokasi[i.lokasi || "(tanpa lokasi)"] || 0) + i.dana;
  const lokEntries = Object.entries(byLokasi).sort((a, b) => b[1] - a[1]);
  const LOC_COLORS = [
    C().brass, C().blue, C().pos, C().neg, "#b06ab3", "#8a8378", "#e8a87c"
  ];
  chart("chart-lokasi").setOption({
    tooltip: { ...TOOLTIP(), trigger: "item",
      formatter: (p) => `${p.name}<br/>${fmtRp.format(p.value)} (${p.percent}%)` },
    grid: { left: 110, right: 40, top: 10, bottom: 10 },
    xAxis: { type: "value", ...AXIS(),
      axisLabel: { ...AXIS().axisLabel, formatter: fmtShort } },
    yAxis: { type: "category", inverse: true,
      data: lokEntries.map(([l]) => l), ...AXIS(),
      axisLabel: { color: cssVar("--text"), fontSize: 12 } },
    series: [{
      type: "bar", cursor: "pointer",
      data: lokEntries.map(([, v]) => v),
      itemStyle: {
        borderRadius: [0, 4, 4, 0],
        color: (p) => LOC_COLORS[p.dataIndex % LOC_COLORS.length]
      },
      label: { show: true, position: "right", color: C().text,
        fontFamily: "IBM Plex Mono", fontSize: 11,
        formatter: (p) => fmtShort(p.value) },
    }],
  });

  const tbody = $("#inv-tbody");
  const st = pages.investasi.state;
  const total = list.length;
  const totalPages = Math.ceil(total / st.pageSize) || 1;
  if (st.page > totalPages) st.page = totalPages;
  const start = (st.page - 1) * st.pageSize;
  const pageList = list.slice(start, start + st.pageSize);

  if (!total) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty">
      Belum ada investasi. Klik "Tambah Investasi" untuk memulai.</td></tr>`;
    $("#inv-pager").innerHTML = "";
    return;
  }
  tbody.innerHTML = pageList.map((i) => `<tr>
    <td>${i.tanggal_beli}</td>
    <td><span class="tipe-badge tipe-${i.tipe}">${TIPE_LABEL[i.tipe] || i.tipe}</span></td>
    <td>${i.nama_aset}</td>
    <td>${i.lokasi || "–"}</td>
    <td class="num">${fmtRp.format(i.dana)}</td>
    <td class="num">${i.unit.toLocaleString("id-ID")}</td>
    <td class="num"><span class="row-actions">
      <button class="icon-sm" data-edit="${i.id}">Edit</button>
      <button class="icon-sm danger" data-del="${i.id}">Hapus</button>
    </span></td>
  </tr>`).join("");
  tbody.querySelectorAll("[data-edit]").forEach((b) =>
    b.addEventListener("click", () => openInvForm(list.find((x) => x.id === Number(b.dataset.edit)))));
  tbody.querySelectorAll("[data-del]").forEach((b) =>
    b.addEventListener("click", async () => {
      if (!confirm("Hapus investasi ini?")) return;
      await fetch(`/api/investments/${b.dataset.del}`, { method: "DELETE" });
      renderInvestments();
    }));

  const pager = $("#inv-pager");
  let html = "";
  html += `<select class="pager-size" id="pager-size">`;
  [5, 10, 20, 50].forEach((sz) =>
    html += `<option value="${sz}" ${st.pageSize === sz ? "selected" : ""}>${sz} per halaman</option>`);
  html += `</select>`;
  html += `<button class="pager-btn" id="pager-prev" ${st.page === 1 ? "disabled" : ""}>‹ Prev</button>`;
  for (let p = 1; p <= totalPages; p++) {
    html += `<button class="pager-btn ${p === st.page ? "active" : ""}" data-page="${p}">${p}</button>`;
  }
  html += `<button class="pager-btn" id="pager-next" ${st.page === totalPages ? "disabled" : ""}>Next ›</button>`;
  html += `<span class="pager-info">Hal ${st.page} dari ${totalPages} (${total} data)</span>`;
  pager.innerHTML = html;

  pager.querySelector("#pager-size").addEventListener("change", (e) => {
    st.pageSize = parseInt(e.target.value);
    st.page = 1;
    renderInvestments();
  });
  pager.querySelector("#pager-prev").addEventListener("click", () => {
    if (st.page > 1) { st.page--; renderInvestments(); }
  });
  pager.querySelector("#pager-next").addEventListener("click", () => {
    if (st.page < totalPages) { st.page++; renderInvestments(); }
  });
  pager.querySelectorAll("[data-page]").forEach((b) =>
    b.addEventListener("click", () => {
      st.page = parseInt(b.dataset.page);
      renderInvestments();
    }));
}

let editingId = null;
function openInvForm(item = null) {
  editingId = item ? item.id : null;
  $("#inv-modal-title").textContent = item ? "Edit Investasi" : "Tambah Investasi";
  const f = $("#inv-form");
  f.tipe.value = item ? item.tipe : "Emas";
  f.nama_aset.value = item ? item.nama_aset : "";
  f.lokasi.value = item ? item.lokasi : "Ajaib";
  f.dana.value = item ? item.dana : "";
  f.tanggal_beli.value = item ? item.tanggal_beli : "";
  f.unit.value = item ? item.unit : "";
  $("#inv-modal").classList.remove("hidden");
  f.nama_aset.focus();
}
function closeInvForm() {
  $("#inv-modal").classList.add("hidden");
  editingId = null;
}
$("#btn-add-inv").addEventListener("click", () => openInvForm());
$("#inv-modal-close").addEventListener("click", closeInvForm);
$("#inv-cancel").addEventListener("click", closeInvForm);
$("#inv-modal").addEventListener("click", (e) => e.target === e.currentTarget && closeInvForm());
$("#inv-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  const body = {
    tipe: f.tipe.value,
    nama_aset: f.nama_aset.value.trim(),
    lokasi: f.lokasi.value,
    dana: parseFloat(f.dana.value),
    tanggal_beli: f.tanggal_beli.value,
    unit: parseFloat(f.unit.value),
  };
  const url = editingId ? `/api/investments/${editingId}` : "/api/investments";
  await fetch(url, {
    method: editingId ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  closeInvForm();
  renderInvestments();
});

/* ---------- charts (halaman Detail) ---------- */
const charts = {};
const cssVar = (name) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const C = () => ({
  text: cssVar("--muted"), line: cssVar("--line"), grid: cssVar("--line"),
  panel: cssVar("--panel"), brass: cssVar("--brass"), pos: cssVar("--pos"),
  blue: cssVar("--blue"), neg: cssVar("--neg"),
});
function chart(id) {
  if (!charts[id]) charts[id] = echarts.init($("#" + id), null, { renderer: "canvas" });
  charts[id].resize();
  return charts[id];
}
window.addEventListener("resize", () => Object.values(charts).forEach((c) => c.resize()));

const AXIS = () => ({
  axisLabel: { color: C().text, fontSize: 11 },
  axisLine: { lineStyle: { color: C().line } },
  splitLine: { lineStyle: { color: C().grid } },
});
const TOOLTIP = () => ({
  backgroundColor: cssVar("--panel-2"), borderColor: C().line,
  textStyle: { color: cssVar("--text"), fontFamily: "IBM Plex Mono" },
});

async function renderCashflow() {
  const st = pages.detail.state;
  const g = st.from && st.to &&
    (new Date(st.to) - new Date(st.from)) / 86400000 > 120 ? "month" : "week";
  const data = await api("/api/cashflow", { granularity: g }, "detail");
  chart("chart-cashflow").setOption({
    tooltip: { ...TOOLTIP(), trigger: "axis" },
    legend: { textStyle: { color: C().text }, top: 0 },
    grid: { left: 70, right: 20, top: 34, bottom: 30 },
    xAxis: { type: "category", data: data.map((r) => r.bucket), ...AXIS() },
    yAxis: { type: "value", ...AXIS(), axisLabel: { ...AXIS().axisLabel, formatter: fmtShort } },
    series: [
      { name: "Omzet", type: "bar", data: data.map((r) => r.omzet),
        itemStyle: { color: C().brass, borderRadius: [3, 3, 0, 0] } },
      { name: "Expense", type: "bar", data: data.map((r) => r.expense),
        itemStyle: { color: C().blue, borderRadius: [3, 3, 0, 0] } },
      { name: "Laba Bersih", type: "line", data: data.map((r) => r.profit),
        lineStyle: { color: C().pos, width: 2 },
        itemStyle: { color: C().pos }, symbolSize: 5 },
    ],
  }, true);
}

async function renderRevenue() {
  const d = await api("/api/revenue-breakdown", {}, "detail");
  chart("chart-revenue").setOption({
    tooltip: { ...TOOLTIP(), trigger: "item",
      formatter: (p) => `${p.name}<br/>${fmtRp.format(p.value)} (${p.percent}%)` },
    legend: { bottom: 0, textStyle: { color: C().text } },
    series: [{
      type: "pie", radius: ["52%", "76%"], center: ["50%", "46%"],
      itemStyle: { borderColor: C().panel, borderWidth: 2 },
      label: { show: false },
      data: [
        { name: "Jasa (Service)", value: d.service.total, itemStyle: { color: C().brass } },
        { name: "Produk (Sales)", value: d.sales.total, itemStyle: { color: C().pos } },
      ],
    }],
    graphic: [{
      type: "text", left: "center", top: "42%",
      style: { text: (d.service.pct).toFixed(0) + "% jasa",
        fill: C().text, fontSize: 13, fontFamily: "IBM Plex Mono" },
    }],
  });
}

async function renderCost() {
  const d = await api("/api/cost-categories", {}, "detail");
  const cats = d.categories;
  const c = chart("chart-cost");
  c.setOption({
    tooltip: { ...TOOLTIP(), trigger: "item", formatter: (p) =>
      `${p.name}<br/>${fmtRp.format(p.value)} (${p.percent}% dari total)` },
    grid: { left: 160, right: 60, top: 10, bottom: 10 },
    xAxis: { type: "value", ...AXIS(), axisLabel: { ...AXIS().axisLabel, formatter: fmtShort } },
    yAxis: { type: "category", inverse: true,
      data: cats.map((x) => x.category), ...AXIS(),
      axisLabel: { color: cssVar("--text"), fontSize: 12 } },
    series: [{
      type: "bar", cursor: "pointer",
      data: cats.map((x) => ({ value: x.total, name: x.category, items: x.items })),
      itemStyle: { borderRadius: [0, 4, 4, 0],
        color: (p) => [C().brass, C().blue, C().pos, "#b06ab3", "#8a8378"][p.dataIndex % 5] },
      label: { show: true, position: "right", color: C().text,
        fontFamily: "IBM Plex Mono", fontSize: 11, formatter: (p) => fmtShort(p.value) },
    }],
  });
  c.off("click");
  c.on("click", (p) => p.data && drillCategory(p.data.name, p.data.items));
}

async function renderCogs() {
  const d = await api("/api/cogs-daily", {}, "detail");
  const days = d.days;
  chart("chart-cogs").setOption({
    tooltip: { ...TOOLTIP(), trigger: "axis",
      formatter: (ps) => {
        const p = ps[0];
        return `${p.axisValue}<br/>${fmtRp.format(p.value)}` +
          (days[p.dataIndex] && days[p.dataIndex].spike ? "<br/>⚠ lonjakan" : "");
      } },
    grid: { left: 66, right: 16, top: 16, bottom: 42 },
    xAxis: { type: "category", data: days.map((x) => x.tanggal.slice(5)), ...AXIS(),
      axisLabel: { ...AXIS().axisLabel, rotate: 45 } },
    yAxis: { type: "value", ...AXIS(), axisLabel: { ...AXIS().axisLabel, formatter: fmtShort } },
    series: [
      { name: "Habis Pakai", type: "line", data: days.map((x) => x.total),
        lineStyle: { color: C().blue, width: 1.6 },
        itemStyle: { color: C().blue }, symbolSize: 4, smooth: false },
      { name: "Lonjakan", type: "scatter",
        data: days.map((x, i) => x.spike ? [i, x.total] : null).filter(Boolean),
        itemStyle: { color: C().neg }, symbolSize: 9, z: 5 },
      { name: "Ambang normal", type: "line", data: days.map(() => d.threshold),
        symbol: "none", lineStyle: { color: C().neg,
          type: "dashed", opacity: .55, width: 1 },
        tooltip: { show: false }, silent: true },
    ],
  });
}

/* ---------- drill-down modal ---------- */
let modalState = null;
function openModal(title) {
  $("#modal-title").textContent = title;
  $("#modal").classList.remove("hidden");
}
function closeModal() {
  $("#modal").classList.add("hidden");
  modalState = null;
}
$("#modal-close").addEventListener("click", closeModal);
$("#modal").addEventListener("click", (e) => e.target === e.currentTarget && closeModal());
document.addEventListener("keydown", (e) => e.key === "Escape" && closeModal());

function rowsHtml(items, clickable) {
  if (!items.length) return `<p class="empty">Tidak ada transaksi pada rentang ini.</p>`;
  const max = Math.max(...items.map((i) => i.total));
  return items.map((it) => {
    const inner = `
      <span class="name">${it.name}</span>
      <span class="meta">${it.meta || ""}</span>
      <span class="amt">${fmtRp.format(it.total)}</span>`;
    const bar = `<div class="bar-track"><div class="bar-fill" style="width:${(it.total / max * 100).toFixed(1)}%"></div></div>`;
    return clickable
      ? `<button class="drill-row" data-expense="${encodeURIComponent(it.name)}">${inner}${bar}</button>`
      : `<div class="drill-row">${inner}${bar}</div>`;
  }).join("");
}

async function drillCategory(catName, items) {
  modalState = { type: "category", catName };
  openModal(`Rincian · ${catName}`);
  $("#modal-body").innerHTML =
    `<button class="back-link hidden"></button>` + rowsHtml(
      items.map((x) => ({ name: x.expense, total: x.total,
        meta: x.pct_of_category + "% kategori" })), true);
  $("#modal-body").querySelectorAll("[data-expense]").forEach((el) =>
    el.addEventListener("click", () => drillExpense(decodeURIComponent(el.dataset.expense))));
}

async function drillExpense(expense) {
  modalState = { type: "expense", expense };
  openModal(expense);
  const d = await api("/api/cost-detail", { expense }, "detail");
  $("#modal-body").innerHTML =
    `<button class="back-link">← Kembali ke kategori</button>` +
    rowsHtml(d.items.map((x) => ({
      name: x.deskripsi, total: x.total,
      meta: x.count + " transaksi",
    })), false);
  $(".back-link").addEventListener("click", async () => {
    const dd = await api("/api/cost-categories", {}, "detail");
    const cat = dd.categories.find((c) =>
      c.items.some((i) => i.expense === modalState.expense));
    if (cat) drillCategory(cat.category, cat.items);
  });
}

/* ---------- filter per halaman ---------- */
function setRange(page, from, to) {
  pages[page].state.from = from;
  pages[page].state.to = to;
  $(`#${page}-from`).value = from || "";
  $(`#${page}-to`).value = to || "";
}

function presetRange(kind, maxDate) {
  const end = new Date(maxDate);
  const iso = (d) => d.toISOString().slice(0, 10);
  const start = new Date(end);
  switch (kind) {
    case "week": start.setDate(end.getDate() - 6); break;
    case "month": start.setDate(1); break;
    case "quarter":
      start.setMonth(Math.floor(end.getMonth() / 3) * 3, 1); break;
    case "year": start.setMonth(0, 1); break;
    default: return { from: null, to: null };
  }
  return { from: iso(start), to: iso(end) };
}

function wireFilters(page) {
  const root = $(`#page-${page}`);
  if (page === "kpi") {
    $(`#kpi-year`).addEventListener("change", (e) => {
      pages.kpi.state.year = e.target.value;
      refreshPage("kpi");
    });
    $(`#kpi-outlet`).addEventListener("change", (e) => {
      pages.kpi.state.outlet = e.target.value;
      refreshPage("kpi");
    });
    return;
  }
  root.querySelectorAll(".preset").forEach((btn) =>
    btn.addEventListener("click", () => {
      root.querySelectorAll(".preset").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const r = presetRange(btn.dataset.preset, window.__maxDate);
      setRange(page, r.from, r.to);
      refreshPage(page);
    }));
  $(`#${page}-from`).addEventListener("change", (e) => {
    pages[page].state.from = e.target.value || null;
    root.querySelectorAll(".preset").forEach((b) => b.classList.remove("active"));
    refreshPage(page);
  });
  $(`#${page}-to`).addEventListener("change", (e) => {
    pages[page].state.to = e.target.value || null;
    root.querySelectorAll(".preset").forEach((b) => b.classList.remove("active"));
    refreshPage(page);
  });
  $(`#${page}-outlet`).addEventListener("change", (e) => {
    pages[page].state.outlet = e.target.value;
    refreshPage(page);
  });
}

async function refreshPage(page) {
  try {
    if (page === "kpi") {
      renderKpis(await api("/api/kpi", {}, "kpi"));
      await Promise.all([renderProfitYear(), renderOmzetProfit()]);
    } else if (page === "pemodal") {
      await renderPemodal();
    } else if (page === "investasi") {
      await renderInvestments();
    } else {
      await Promise.all([renderCashflow(), renderRevenue(), renderCost(), renderCogs()]);
    }
  } catch (err) { console.error(err); }
}

/* ---------- navigasi halaman ---------- */
document.querySelectorAll(".tab").forEach((tab) =>
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    activePage = tab.dataset.page;
    document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
    $(`#page-${activePage}`).classList.add("active");
    refreshPage(activePage);
  }));

$("#btn-sync").addEventListener("click", async (e) => {
  e.target.disabled = true;
  await fetch("/api/sync", { method: "POST" });
  e.target.disabled = false;
  location.reload();
});

/* ---------- tema (dark default) ---------- */
const ICONS = {
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>',
};
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  $("#theme-toggle").innerHTML = theme === "dark" ? ICONS.sun : ICONS.moon;
  $("#theme-toggle").title = theme === "dark" ? "Mode terang" : "Mode gelap";
}
$("#theme-toggle").addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  localStorage.setItem("bk21-theme", next);
  applyTheme(next);
  refreshPage(activePage);
});
  const urlTheme = new URLSearchParams(location.search).get("theme");
  applyTheme(urlTheme || localStorage.getItem("bk21-theme") || "dark");
  fetch("/api/monthly-profit").then((r) => r.json()).then((monthly) =>
    renderStaticKpis(monthly.reduce((s, r) => s + r.nett_profit, 0)));

(async function boot() {
  const meta = await fetch("/api/meta").then((r) => r.json());
  window.__maxDate = meta.max_date;
  const options = meta.outlets.map((o) => `<option>${o}</option>`).join("");
  $("#kpi-outlet").innerHTML = options;
  const years = [...new Set(meta.periods || [])];
  $("#kpi-year").innerHTML += years.map((y) => `<option>${y}</option>`).join("");
  wireFilters("kpi");
  wireFilters("detail");
  $("#detail-outlet").innerHTML = options;
  const r = presetRange("month", meta.max_date);
  setRange("detail", r.from, r.to);
  document.querySelector('#page-detail [data-preset="month"]').classList.add("active");
  const initial = location.hash.slice(1);
  document.querySelector(
    `.tab[data-page="${["kpi", "detail", "pemodal", "investasi"].includes(initial) ? initial : "kpi"}"]`
  ).click();
})();
