# Product Requirements Document (PRD)
**Nama Produk:** Dashboard Monitoring Finansial & Operasional Outlet BK21  
**Dokumen Status:** Draft V1.0  
**Target Pengguna:** Investor, Pemilik Bisnis, Manajemen Level Atas  
**Tanggal:** 24 Agustus 2026  

---

## 1. Latar Belakang & Objektif
Saat ini, pemantauan kinerja bisnis outlet barbershop BK21 dilakukan dengan membaca laporan pembukuan berbasis Excel (ratusan baris pencatatan transaksi harian yang mencampur tagihan operasional besar dengan pengeluaran kecil). Hal ini menyulitkan proses analisis strategis. 

**Objektif:** 
Membangun sebuah *dashboard* analitik visual yang mengkonsolidasi data mentah menjadi metrik utama (KPI). *Dashboard* ini bertujuan untuk mempercepat pengambilan keputusan investor, melacak rasio keuntungan operasional, mengontrol kebocoran bahan baku, dan memantau kinerja *upselling* produk oleh *barberman*.

---

## 2. Sumber Data & Pemetaan (Data Mapping)
*Dashboard* akan menarik data dari basis format laporan Excel bulanan (Sheet "Cost" dan "Summary"). 

**Struktur Data Referensi (Sheet Cost):**
*   `No_Akun`: Kode akun akuntansi.
*   `Tanggal`: Waktu terjadinya transaksi.
*   `Outlet`: Identitas cabang (Contoh: BK21).
*   `Expense`: Kategori besar pengeluaran/pemasukan.
*   `Deskripsi`: Detail spesifik item.
*   `Total`: Nilai nominal transaksi.

---

## 3. Fitur Utama & Spesifikasi Modul

### Modul A: Panel Indikator Utama (Top-Level KPIs)
Modul ini berada di posisi teratas halaman untuk memberikan "kesehatan bisnis" secara instan.
*   **Total Omzet (Revenue):** Akumulasi pendapatan kotor dari `Total Service` dan `Total Sales`.
*   **Laba Bersih (Net Profit):** Total Omzet dikurangi total seluruh *Expense*.
*   **Net Profit Margin (%):** Rasio persentase Laba Bersih terhadap Total Omzet.
*   **Visualisasi (UI):** *Scorecard* / *KPI Card* dengan indikator panah hijau (naik) atau merah (turun) membandingkan dengan bulan sebelumnya.

### Modul B: Analisis Struktur Pendapatan (Revenue Breakdown)
Tujuan modul ini adalah memantau keberhasilan strategi *upselling* ritel oleh *barberman*.
*   **Kebutuhan Data:** Memisahkan omzet berdasarkan jasa dan produk (mengacu pada data `Total Service` vs `Total Sales`).
*   **Visualisasi (UI):** *Donut Chart* atau *Pie Chart*.
*   **Kriteria Sukses:** Pengguna bisa melihat persentase kontribusi penjualan produk (pomade, tonik, dll) terhadap omzet secara keseluruhan.

### Modul C: Pemantauan Arus Kas & Tren Waktu
Melihat korelasi antara pendapatan dan pengeluaran dari waktu ke waktu.
*   **Kebutuhan Data:** Akumulasi *Total Omzet* dan Total *Expense* yang di-plot berdasarkan `Tanggal` (Mingguan/Bulanan).
*   **Visualisasi (UI):** *Combo Chart* (Diagram Batang untuk Omzet, Garis/Line untuk Laba Bersih).

### Modul D: Analisis Kebocoran & Distribusi Pengeluaran (Cost Analysis)
Modul untuk mengidentifikasi sektor mana yang menyerap biaya tertinggi.
*   **Kebutuhan Data:** Pengelompokan kolom `Expense` menjadi 4 kategori makro:
    1.  **HPP & Bahan Baku:** (Filter: *Biaya Pemakaian Bahan Habis Pakai*, *HPP Produk*, *HPP Minuman*).
    2.  **Operasional & Tetap:** (Filter: *Biaya Listrik, Biaya RnM, Biaya Sewa IT (Olsera), Biaya Sewa Peralatan, Biaya Telepon dan Internet, Biaya Administrasi*).
    3.  **SDM & Pengembangan:** (Filter: *Biaya SPV Visit, Biaya Model Class Development, Biaya Grading, BPJS, THR, Biaya Battle Fade*).
    4.  **Marketing & Akuisisi:** (Filter: *Biaya Iklan, Biaya Sample*).
*   **Visualisasi (UI):** *Treemap* atau *Horizontal Bar Chart* untuk membandingkan proporsi pengeluaran antar kategori. 

### Modul E: Peringatan Anomali Bahan Habis Pakai (COGS Tracker)
*   **Kebutuhan Data:** Melacak harian jumlah nilai `Total` khusus untuk filter `Expense` = "Biaya Pemakaian Bahan Habis Pakai" (misal: *Hair Curl Cream, Shampo, Thermal Paper*).
*   **Visualisasi (UI):** *Line Chart* per hari.
*   **Fungsi Khusus:** Menampilkan deteksi lonjakan (*spike*) secara visual jika pemakaian di hari tersebut melebihi rata-rata normal. Berguna untuk mendeteksi pemborosan atau kehilangan.

---

## 4. Requirement Non-Fungsional
*   **Filter Global:** Pengguna harus bisa menyaring data berdasarkan rentang waktu (Minggu Ini, Bulan Ini, Kuartal, Tahun) dan berdasarkan cabang/`Outlet` (meskipun saat ini terfokus pada BK21, harus *scalable* jika ada cabang lain).
*   **Interaktivitas:** Setiap grafik harus memiliki fitur *drill-down*. Contoh: Jika grafik "Marketing" diklik, akan memunculkan rincian `Deskripsi` seperti berapa porsi untuk Iklan vs Biaya Sample Brokil.
*   **Platform:** Berbasis web, dioptimalkan untuk tampilan *Desktop* (Monitor) karena akan digunakan untuk analisis laporan.

---


