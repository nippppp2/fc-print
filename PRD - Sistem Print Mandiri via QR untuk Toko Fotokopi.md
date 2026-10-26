# PRD: Sistem Kirim Dokumen Mandiri via QR untuk Toko Fotokopi

**Versi:** 2.0 (Ultra-Streamlined / Simple Direct Upload)  
**Status:** Approved / Aktif  
**Arsitektur Inti:** Serverless Cloud Gratis (Next.js di Vercel + Cloudflare R2 Storage + Neon PostgreSQL)

---

## 1. Ringkasan Eksekutif

Aplikasi web *self-service* ultra-sederhana untuk toko fotokopi. Pelanggan cukup memindai kode QR di toko, membuka halaman web di ponsel pintar (*tanpa login, tanpa instalasi, dan tanpa mengisi form berbelit-belit*), memilih dokumen atau foto dari ponsel, lalu menekan **"Kirim ke Kasir"**. Dokumen langsung terunggah dan masuk ke antrean dashboard komputer kasir secara seketika, dan pelanggan langsung mendapatkan nomor antrean digital (`A-001`, `A-002`, dst).

Semua opsi cetak (warna/hitam putih, ukuran kertas A4/F4, jumlah rangkap) serta instruksi khusus (jilid/laminating) dan pembayaran dilakukan secara langsung dan fleksibel di meja kasir saat pelanggan menunjukkan nomor antreannya.

### Pernyataan Nilai (Value Proposition)
* **Bagi Pelanggan:** Mengirim dokumen ke toko fotokopi dalam waktu < 10 detik tanpa perlu menyimpan nomor WhatsApp pemilik dan tanpa antre panjang hanya untuk kirim file.
* **Bagi Pemilik Toko:** Menerima file pelanggan yang terorganisir rapi per nomor antrean di satu layar komputer, bisa diunduh dalam 1 klik, dan tidak ada lagi chat WhatsApp yang menumpuk.
* **Privasi Maksimal:** File dokumen pelanggan otomatis terhapus permanen setelah 24 jam.

---

## 2. Alur Pengguna (User Flows)

### 2.1 Alur Pelanggan (Hanya 3 Langkah Cepat)
1. **Pindai QR:** Pelanggan memindai QR fisik di meja fotokopi dengan kamera HP.
2. **Pilih Dokumen:** Halaman web terbuka instan. Pelanggan memilih 1 atau beberapa file dokumen/foto (PDF, DOCX, JPG, PNG).
3. **Kirim & Dapatkan Antrean:** Pelanggan menekan tombol **"Kirim ke Kasir"**. 
   * Dokumen langsung terunggah ke Cloudflare R2.
   * Layar HP langsung menampilkan **Nomor Antrean Besar (misal: A-017)** dan status antrean.
   * Saat kasir menandai status *Siap Diambil*, HP pelanggan otomatis bergetar dan berbunyi.
   * Pelanggan mendatangi kasir, menyebutkan nomor `A-017`, memesan instruksi cetak (warna/kertas) secara langsung, dan membayar di tempat.

### 2.2 Alur Pemilik / Kasir Toko
1. **Dashboard Komputer Kasir (`/admin`):** Layar kasir selalu terbuka di PC toko.
2. **Notifikasi Suara:** Saat ada pelanggan mengirim dokumen, komputer kasir otomatis membunyikan lonceng nada masuk (*Chime Alert*).
3. **Unduh Dokumen:** Kasir melihat nomor antrean pelanggan (`A-017`) dan daftar dokumennya, lalu mengklik tombol **"Unduh"**.
4. **Cetak & Selesai:** 
   * Kasir mencetak dokumen ke printer toko sesuai permintaan lisan pelanggan.
   * Kasir memperbarui status (*Mulai Cetak → Siap Diambil → Selesai*).
5. **Auto-Cleanup:** File di Cloudflare R2 otomatis terhapus dalam 24 jam.

---

## 3. Fitur Utama & Kebutuhan Fungsional

### 3.1 Halaman Pelanggan (`/`)
* **FR-01:** Bebas login & tanpa registrasi akun (akses instan via QR).
* **FR-02:** Pemilihan multi-dokumen (PDF, Word DOC/DOCX, Gambar JPG/PNG) hingga 25 MB per file.
* **FR-03:** *Direct Presigned Upload* ke Cloudflare R2 (Bypass batas 4.5 MB Vercel Serverless).
* **FR-04:** Progress bar pengiriman real-time.
* **FR-05:** *LocalStorage Session Recovery:* Nomor antrean otomatis tersimpan di HP pelanggan jika tab browser tertutup.
* **FR-06:** Tanpa form opsi cetak rumit, tanpa form layanan tambahan (jilid/laminating), tanpa form nama atau catatan.

### 3.2 Halaman Status Pelacakan (`/status/[code]`)
* **FR-07:** Tampilan Nomor Antrean Raksasa (format `A-001`, `A-002`, reset tiap hari).
* **FR-08:** Indikator status live: *Menunggu Giliran → Sedang Diproses → Siap Diambil → Selesai*.
* **FR-09:** *Web Audio & Vibration Alert:* HP pelanggan berbunyi dan bergetar saat dokumen siap diambil di kasir.
* **FR-10:** Tombol pembatalan mandiri sebelum kasir memproses dokumen.

### 3.3 Dashboard Kasir Toko (`/admin`)
* **FR-11:** Daftar antrean real-time (auto-polling 5 detik).
* **FR-12:** Notifikasi audio lonceng berbunyi otomatis saat ada dokumen baru masuk.
* **FR-13:** Tombol 1-klik unduh dokumen langsung per file.
* **FR-14:** Perubahan status kerja kasir: *Mulai Cetak → Tandai Siap Diambil → Selesai*.
* **FR-15:** Pencarian cepat berdasarkan nomor antrean atau nama file.

### 3.4 Pengaturan & Poster QR (`/admin/pengaturan`)
* **FR-16:** Pengaturan nama toko dan sakelar buka/tutup toko.
* **FR-17:** Pengaturan batas ukuran file dan jumlah dokumen maksimal per kiriman.
* **FR-18:** **Generator Poster QR Meja Kasir Siap Cetak:** Format A4 berisi kode QR dan petunjuk 3 langkah singkat yang siap dicetak langsung.

### 3.5 Otomatisasi Pembersihan
* **FR-19:** Route `/api/cron/cleanup` yang otomatis menghapus dokumen dari Cloudflare R2 setelah 24 jam dari waktu selesai.

---

## 4. Stack Teknis & Deployment

* **Framework:** Next.js (App Router, TypeScript) di-deploy ke **Vercel** (Hobby Free Tier).
* **Storage:** **Cloudflare R2** (10 GB gratis + bebas biaya *egress* download sepuasnya).
* **Database:** **Neon PostgreSQL** (Serverless Free Tier) dengan *In-Memory Fallback* untuk development lokal.
* **Biaya Operasional:** **Rp 0 / bulan**.
