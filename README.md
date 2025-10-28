
# Web App: Filter & Sort Data (Static)

Aplikasi web statis untuk memuat data Excel (konversi JSON/CSV) dan menampilkan tabel interaktif.
Anda dapat memilih kolom mana yang ingin ditampilkan, mencari, menyortir, dan mengekspor hasil filter.

## Cara pakai lokal
1. Buka folder `web_app_files`.
2. Jalankan server static sederhana (direkomendasikan) atau buka `index.html` di browser.
   - Contoh (Python): `python -m http.server 8000` lalu buka `http://localhost:8000`

## Deploy ke GitHub Pages
1. Buat repo baru di GitHub.
2. Upload seluruh isi folder `web_app_files` ke repo (root).
3. Pada Settings → Pages, pilih branch `main` (atau `gh-pages`) dan folder `/ (root)` lalu save.
4. Tunggu beberapa menit, situs akan tersedia di `https://<username>.github.io/<repo-name>/`

## File penting
- `index.html` - halaman utama
- `script.js` - logika client-side (filter, search, sort, export)
- `styles.css` - gaya
- `data.json` / `data.csv` - file data hasil konversi dari Excel

## Catatan
- Script membaca `data.json`. Pastikan file tetap bernama `data.json`.
- Untuk performa, tabel menampilkan maksimal 5000 baris diantar muka.
