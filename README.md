# Dashboard: Cross-Model Residual Erasure untuk Pengelompokan Sampah Elektronik tanpa Label yang Tahan Bias Sumber Foto

**Buka aplikasi:** [https://sentrahub.tech](https://sentrahub.tech) · dashboard riset: [`#/riset`](https://sentrahub.tech/#/riset) · repositori utama (kode, hasil, reproduksi): [https://github.com/elzaff/cross-model-residual-erasure-clustering-bdc-ewaste](https://github.com/elzaff/cross-model-residual-erasure-clustering-bdc-ewaste)

## Aplikasi SENTRA (`index.html`)

SENTRA: Sistem Pengelompokan Terpadu Rongsok Alat-elektronik.

Prototipe untuk petugas bank sampah, TPS3R, dan pengepul. **Setoran** (HP): foto barang satu per satu, langsung dapat
wadah tujuan. **Batch** (laptop): unggah banyak foto, saring, konfirmasi massal. Tiap hasil bisa dikoreksi petugas dan
dicetak sebagai tanda terima atau manifest (PDF/CSV). Foto diproses oleh backend Modal (`code/product/modal_pilah.py` di
repositori utama) dengan pipeline CMRE yang sama dengan paper; sesi dan foto disimpan di perangkat (IndexedDB). Foto
sesi Setoran dan Batch juga disalin (maks. 768 px, EXIF dibuang) ke bucket privat Biznet GIO dan ditampilkan lewat URL
bertanda tangan berumur 15 menit; foto "Uji dataset sendiri" tidak pernah disimpan. Koreksi petugas dikirim ke server
untuk evaluasi. Bisa dipasang di HP sebagai PWA.

## Dashboard riset (`riset.html`)

Presentasi hasil karya ilmiah **BDC Satria Data 2026** (tim SD2026040000100): 16 kelompok e-waste yang ditemukan
tanpa label dari 3.792 foto BDC. Enam halaman:

- **Peta**: kartu foto uji dari dataset lain masuk ke peta t-SNE. Slider sebelum/sesudah CMRE bisa diputar, dijeda, dan digeser. Panel hasil memberi tiga alasan: pusat kelompok terdekat, lima foto BDC termirip, dan cek barang asing.
- **Coba sendiri**: 452 foto uji, termasuk yang ditandai sebagai barang asing.
- **16 kelompok**: galeri, penanganan, dan kestabilan tiap kelompok, lalu alasan K = 16 dipertahankan dibanding K = 17.
- **Graph kNN**: graph 15 tetangga yang dipotong spectral clustering, perbandingan potongan K = 16 dan K = 17, dan satu panel graph per cluster.
- **Cara kerja CMRE**: delapan langkah animasi yang mengikuti dua foto mouse, ditutup peta data asli.
- **Analisis**: alur, data, bukti, sumber, dan istilah.

`data.js` dibuat oleh `code/make_dashboard_data.py`, `graph.js` oleh `code/make_dashboard_graph.py`, sedangkan `demo.js` serta folder `assets/t` dan `assets/c` dibuat oleh
`code/make_dashboard_demo.py` (repositori utama). Foto yang terdeteksi memuat wajah tidak diberi thumbnail.

## Membuka

```bash
python -m http.server 8766
```

Buka `http://localhost:8766` (port 8766: backend hanya menerima permintaan dari port ini dan dari GitHub Pages). Halaman harus dibuka lewat server (bukan langsung dari file) karena memuat `data.js`.
Untuk GitHub Pages: Settings → Pages → Deploy from a branch → `main` / root.

Kode, metodologi, dan cara reproduksi: https://github.com/elzaff/cross-model-residual-erasure-clustering-bdc-ewaste

## Tim

| | |
|---|---|
| Kode kelompok / registrasi | SD2026040000100 |
| Cabang lomba | Big Data Challenge (BDC), Satria Data 2026 |

## Lisensi

Kode halaman: MIT. Foto contoh di `assets/` berasal dari set data publik yang dicantumkan di bagian Sumber pada halaman dan
tetap mengikuti lisensi aslinya; foto BDC adalah milik panitia BDC Satria Data 2026.
