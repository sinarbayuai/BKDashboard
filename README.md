# BK21 Dashboard — Monitoring Finansial & Operasional Outlet

Dashboard analitik web untuk memantau kinerja outlet barbershop BK21. Data mentah
dari laporan Excel bulanan dikonsolidasikan ke SQLite, lalu disajikan sebagai KPI
dan grafik interaktif (drill-down) via browser.

Sumber spesifikasi: `BK21_Dashboard_Spec.md`.

## Struktur Proyek

```
BK/
├── BK21_Dashboard_Spec.md   # PRD / spesifikasi dashboard
├── bk21.db                  # Database SQLite (hasil ingest)
├── laporan/                 # Sumber data Excel bulanan
│   ├── 2024/  (03..12)
│   ├── 2025/  (01..12)
│   └── 2026/  (01..07)
├── app/
│   ├── __init__.py
│   ├── db.py                # Skema SQLite + koneksi
│   ├── ingest.py            # Parser Excel -> SQLite + mapping kategori biaya
│   ├── main.py              # Aplikasi FastAPI + semua endpoint API
│   └── static/
│       ├── index.html       # UI 2 halaman (KPI & Detail)
│       ├── app.js           # Logika frontend (vanilla JS + ECharts)
│       ├── style.css        # Tema "ledger & brass"
│       └── echarts.min.js   # Library chart (vendored, offline)
├── scripts/
│   └── run_ingest.py        # Entry point ingest manual
└── .venv/                   # Virtual environment Python 3.14
```

## Alur Data (Excel → SQLite → Dashboard)

1. **Ingest** (`app/ingest.py`)
   - Memindai semua `laporan/**/*.xlsx`.
   - Dari tiap file diambil 3 bagian:
     - Sheet **Cost** — transaksi pengeluaran harian (`No_Akun, Tanggal, Outlet,
       Expense, Deskripsi, Total`). Urutan kolom divariasi antar tahun (2024
       punya kolom ekstra `Jumlah/Harga`) → dibaca berdasarkan nama header.
     - Sheet **Omset** (namanya bervariasi: `Omset`, `OMZET`, `Omzet BK21`) —
       omzet harian (Total Jasa / Sales / Total Omzet).
     - Sheet **Summary** — rekap bulanan yang menjadi **sumber otoritatif KPI**:
       `Total Omzet`, `Expenses`, `NETT PROFIT`, `Total Service`, `Total Sales`.
   - Setiap baris ditandai `(source_file, row_idx)` unik → ingest **idempoten**;
     dijalankan ulang kapan pun tanpa menduplikasi data (upsert).
   - Nama outlet dinormalisasi (mis. `bk21`, `BK21_November` → `BK21`).

2. **Penyimpanan** (`app/db.py`) — tabel:
   - `cost` — baris pengeluaran harian.
   - `revenue` — omzet harian.
   - `summary` — 1 baris per file: periode (YYYY-MM dari nama file) + angka Summary.

3. **API** (`app/main.py`) — membaca SQLite, agregasi per permintaan (filter
   `from`, `to`, `outlet`).

4. **Frontend** — 2 halaman dengan filter independen:
   - **KPI**: filter dropdown tahun; 5 card + 2 line chart.
   - **Detail**: filter preset/rentang/outlet; 4 grafik dengan drill-down.

## Formulasi

| Metrik | Rumus | Sumber |
|---|---|---|
| Total Omzet | `SUM(summary.total_omzet)` | Sheet Summary |
| Total Expense | `SUM(summary.expenses)` | Sheet Summary |
| Laba Bersih | `SUM(summary.nett_profit)` | Sheet Summary (sudah memperhitungkan profit sharing) |
| Net Profit Margin | `Laba Bersih / Total Omzet × 100` | dihitung |
| Rata-rata Laba / Bulan | `Laba Bersih / jumlah bulan pada periode` | dihitung |
| Delta "vs periode lalu" | `(kini − lalu) / |lalu| × 100`; periode lalu = N bulan kalender sebelumnya | dihitung |
| Kategori biaya (Modul D) | `Expense` → 4 kategori makro sesuai spec (HPP & Bahan Baku, Operasional & Tetap, SDM & Pengembangan, Marketing & Akuisisi) + fallback kata kunci; sisanya **Lainnya** | `category_for()` |
| Spike bahan habis pakai (Modul E) | harian `Expense = "Biaya Pemakaian Bahan Habis Pakai"`; spike jika `total > mean + 2σ` | dihitung |
| Laba pada grafik Arus Kas | `omzet harian − expense harian` (bukan NETT PROFIT) | dihitung |

Catatan: angka KPI halaman KPI = angka Summary Excel. Grafik Arus Kas (Detail)
memakai data harian sehingga labanya bisa berbeda dari NETT PROFIT (yang sudah
mencakup overhead & profit sharing).

## Menjalankan

```bash
# 1. (Opsional) ingest/re-ingest Excel ke SQLite
.venv/bin/python scripts/run_ingest.py

# 2. Jalankan server (port 8321, bisa diakses dari jaringan)
.venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8321
```

Buka `http://localhost:8321` (dari komputer lain: `http://<IP-host>:8321`).
Halaman Detail: `http://localhost:8321/#detail`.

Tombol **Sync Excel** di halaman KPI menjalankan ulang ingest tanpa restart server
(`POST /api/sync`).

## Menghentikan

```bash
pkill -f "uvicorn app.main"
```

## API Ringkas

| Endpoint | Fungsi |
|---|---|
| `GET /api/meta` | daftar outlet + tahun + rentang tanggal |
| `GET /api/kpi?from&to&outlet` | 5 KPI + pembanding periode lalu (dari Summary) |
| `GET /api/monthly-profit?outlet` | omzet & laba bersih per bulan (dari Summary) |
| `GET /api/cashflow?from&to&outlet&granularity=day\|week\|month` | tren harian/mingguan/bulanan |
| `GET /api/revenue-breakdown` | jasa vs produk (dari Summary) |
| `GET /api/cost-categories` | total per kategori makro + rincian per Expense |
| `GET /api/cost-detail?expense=` | rincian per Deskripsi untuk 1 Expense |
| `GET /api/cogs-daily` | harian bahan habis pakai + ambang spike |
| `POST /api/sync` | jalankan ulang ingest |

## Catatan Data

- **Nov 2024** tidak memiliki sheet omset di Excel → omzet bulan itu kosong di DB.
- Nama sheet/kolom bervariasi antar tahun; parser menanganinya via pencocokan
  nama header, bukan posisi kolom.
- File Maret 2024 mencantumkan "BK13" di sheet Summary — diabaikan; outlet
  diambil dari nama file dan baris Cost.
