
# Web App v2: Filter & Sort Data (Static) with Upload Excel/CSV support

Aplikasi web statis untuk memuat data Excel (konversi JSON/CSV) dan menampilkan tabel interaktif.
Kini dengan fitur **Upload Excel/CSV** dan opsi memilih baris header (untuk kasus header di baris ke-6 seperti file Anda).

## Cara pakai lokal
1. Buka folder `web_app_files_v2`.
2. Jalankan server static sederhana (direkomendasikan) atau buka `index.html` di browser.
   - Contoh (Python): `python -m http.server 8000` lalu buka `http://localhost:8000`

## Cara upload
1. Klik **Choose File** → pilih .xlsx/.xls/.csv
2. Masukkan nomor baris header (contoh 6 jika header ada di A6).
3. Klik **Load File** → aplikasi akan membaca sheet pertama dan menampilkan kolom.
4. Pilih kolom yang ingin ditampilkan → klik **Proses**

## Deploy ke GitHub Pages
1. Buat repo baru di GitHub.
2. Upload seluruh isi folder `web_app_files_v2` ke repo (root).
3. Pada Settings → Pages, pilih branch `main` (atau `gh-pages`) dan folder `/ (root)` lalu save.
4. Tunggu beberapa menit, situs akan tersedia di `https://<username>.github.io/<repo-name>/`

## File penting
- `index.html` - halaman utama
- `script_v2.js` - logika client-side (parse Excel/CSV, filter, search, sort, export)
- `styles.css` - gaya
- `data.json` / `data.csv` - file data hasil konversi dari Excel (opsional)

## Catatan
- Semua proses parsing dilakukan di browser. Data tidak dikirim keluar.
- Jika file sangat besar (puluhan ribu baris), browser mungkin lambat.
