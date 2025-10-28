
# Web App v3: Filter & Sort Data (Header fixed row 6, mapping applied)

Versi ini otomatis membaca header di baris ke-6 (A6 = No, B6 = Nama, ...).
Semua 'Unnamed' akan diganti sesuai mapping Anda (No, Nama, NIPD, JK, ...).
Fitur export hasil filter menjadi file Excel (.xlsx) dengan kolom terpisah — bukan satu kolom gabungan.

## Cara pakai
1. Ekstrak isi zip ke folder.
2. Jalankan `python -m http.server 8000` di folder tersebut.
3. Buka `http://localhost:8000`.
4. Klik **Choose File**, pilih file .xlsx/.xls/.csv yang formatnya sama seperti file awal (header di row 6).
5. Klik **Load File** — aplikasi akan otomatis membaca header baris ke-6.
6. Pilih kolom yang ingin ditampilkan → klik **Proses**.
7. Klik **Unduh hasil filter (.xlsx)** untuk menyimpan file Excel hasil filter.

## Catatan
- Semua pemrosesan dilakukan di browser (offline).
- Jika file lebih besar dari 10k baris, browser mungkin lambat.
- Jika ingin header baris lain, minta saya ubah kembali (saat ini dipatok ke baris 6).
