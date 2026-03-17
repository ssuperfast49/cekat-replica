# 📘 Panduan Lengkap Aplikasi Synka

> **Synka** adalah platform manajemen percakapan pelanggan berbasis AI yang menghubungkan WhatsApp, Telegram, dan LiveChat ke dalam satu dasbor terpadu. Dokumen ini adalah panduan lengkap untuk semua pengguna — dari pemula hingga administrator.

---

# Daftar Isi

1. [Pendahuluan & Ikhtisar](#1-pendahuluan--ikhtisar)
2. [Memulai — Login & Keamanan](#2-memulai--login--keamanan)
3. [Navigasi & Tata Letak Dasbor](#3-navigasi--tata-letak-dasbor)
4. [Profil Pengguna](#4-profil-pengguna)
5. [Chat / Inbox](#5-chat--inbox)
6. [Kontak](#6-kontak)
7. [Platform Terhubung](#7-platform-terhubung)
8. [AI Agents](#8-ai-agents)
9. [Human Agents (Agen Manusia)](#9-human-agents-agen-manusia)
10. [Analytics / Analitik](#10-analytics--analitik)
11. [Logs / Catatan Aktivitas](#11-logs--catatan-aktivitas)
12. [Permissions / Izin & Peran](#12-permissions--izin--peran)
13. [Admin Panel](#13-admin-panel)
14. [AI Wallet & Indikator Baterai](#14-ai-wallet--indikator-baterai)
15. [Notifikasi & Peringatan](#15-notifikasi--peringatan)
16. [LiveChat Widget (Untuk Pengunjung Website)](#16-livechat-widget)
17. [Sistem Kehadiran / Presence](#17-sistem-kehadiran-presence)
18. [Peran Pengguna (Roles)](#18-peran-pengguna-roles)
19. [Changelog / Riwayat Perubahan](#19-changelog--riwayat-perubahan)
20. [Tanya Jawab (FAQ)](#20-tanya-jawab-faq)

---

# 1. Pendahuluan & Ikhtisar

## Apa itu Synka?

Synka adalah aplikasi web yang membantu bisnis Anda mengelola percakapan pelanggan dari berbagai platform pesan dalam satu tempat. Bayangkan semua pesan WhatsApp, Telegram, dan LiveChat website Anda masuk ke satu kotak masuk yang sama — itulah Synka.

## Fitur Utama

| Fitur | Deskripsi |
|---|---|
| **Inbox Terpadu** | Semua pesan dari WhatsApp, Telegram, dan LiveChat masuk ke satu tempat |
| **AI Agent** | Robot pintar yang menjawab pesan pelanggan secara otomatis |
| **Human Agent** | Agen manusia yang bisa mengambil alih percakapan dari AI |
| **Kontak** | Daftar semua pelanggan yang pernah menghubungi Anda |
| **Analytics** | Grafik dan statistik performa layanan pelanggan |
| **Permissions** | Sistem izin untuk mengontrol siapa bisa mengakses apa |
| **AI Wallet** | Sistem saldo untuk mengontrol penggunaan AI |
| **Notifikasi Real-time** | Suara dan popup saat ada pesan baru masuk |

## Siapa yang Menggunakan Synka?

Synka dirancang untuk 4 jenis pengguna (disebut "peran"):

| Peran | Tugas Utama |
|---|---|
| **Master Agent** | Pemilik/admin utama. Mengontrol segalanya: keuangan, AI, agen, izin |
| **Super Agent** | Supervisor. Mengelola percakapan dan agen di bawahnya |
| **Agent** | Agen garis depan. Menjawab chat pelanggan |
| **Audit** | Pengawas. Hanya bisa melihat log dan analitik, tidak bisa mengubah |

---

# 2. Memulai — Login & Keamanan

## 2.1. Halaman Login

Saat Anda membuka Synka untuk pertama kali, Anda akan melihat halaman login.

### Elemen di Halaman Login:

| Elemen | Deskripsi |
|---|---|
| **Kolom "Email"** | Masukkan alamat email Anda |
| **Kolom "Password"** | Masukkan password Anda |
| **Ikon mata (👁)** | Klik untuk menampilkan/menyembunyikan password |
| **Tombol "Login"** | Klik untuk masuk |
| **Link "Forgot Password"** | Klik jika lupa password |
| **hCaptcha** | Verifikasi keamanan otomatis — centang "Saya bukan robot" jika diminta |
| **Nomor versi** | Di pojok bawah, menampilkan versi aplikasi |

### Langkah Login:

1. **Masukkan email** Anda di kolom "Email"
2. **Masukkan password** di kolom "Password"
3. **Selesaikan hCaptcha** jika muncul (centang atau selesaikan tantangan)
4. **Klik tombol "Login"**
5. Jika berhasil, Anda akan diarahkan ke halaman verifikasi OTP (jika 2FA aktif) atau langsung ke dasbor

### Pesan Error yang Mungkin Muncul:

| Pesan | Arti | Solusi |
|---|---|---|
| "Invalid email or password" | Email/password salah | Periksa ulang ketikan Anda |
| "Email not confirmed" | Email belum diverifikasi | Cek inbox untuk email konfirmasi |
| "Too many requests" | Terlalu banyak percobaan login | Tunggu beberapa menit, lalu coba lagi |
| "Account deactivated" | Akun dinonaktifkan | Hubungi Master Agent |

### Jika Lupa Password:

1. Klik link **"Forgot Password"** di halaman login
2. Halaman akan berubah — kolom email ditampilkan
3. Masukkan email Anda
4. Selesaikan hCaptcha jika muncul
5. Klik **"Send Reset Link"**
6. Cek inbox email untuk link reset password
7. Klik link tersebut — Anda akan dibawa ke halaman **Reset Password**
8. Klik **"← Back to Login"** untuk kembali ke form login

## 2.2. Halaman Reset Password

Setelah klik link dari email, Anda akan melihat form untuk membuat password baru.

### Persyaratan Password:

| Syarat | Contoh |
|---|---|
| Minimal 1 huruf kecil (a-z) | `a`, `b`, `z` |
| Minimal 1 huruf besar (A-Z) | `A`, `B`, `Z` |
| Minimal 1 angka (0-9) | `1`, `5`, `9` |
| Minimal 1 simbol | `!`, `@`, `#`, `$` |
| Minimal 8 karakter total | `MyPass1!` |

### Elemen di Halaman:

- **Kolom "New Password"**: Ketik password baru Anda di sini
- **Ikon mata (👁)**: Klik untuk menampilkan/menyembunyikan password
- **Kolom "Confirm Password"**: Ketik ulang password yang sama
- **Daftar centang persyaratan**: Setiap syarat akan berubah hijau ✅ saat terpenuhi
- **Tombol "Save New Password"**: Klik setelah semua syarat terpenuhi
- **Tombol "← Back to Login"**: Kembali ke halaman login

## 2.3. Halaman OTP (Verifikasi 2 Langkah)

Jika akun Anda mengaktifkan keamanan 2FA (Two-Factor Authentication), setelah login Anda akan diminta memasukkan kode verifikasi.

### Cara Verifikasi:

1. Buka email Anda — cari email dengan subjek kode verifikasi
2. Masukkan **6 digit kode** ke dalam 6 kotak yang tersedia
3. Klik tombol **"Verify"**
4. Jika berhasil, Anda akan masuk ke dasbor

### Tombol di Halaman OTP:

| Tombol | Fungsi |
|---|---|
| **6 kotak input** | Tempat memasukkan kode 6 digit dari email |
| **"Verify"** | Klik untuk memverifikasi kode |
| **"Resend code"** | Kirim ulang kode jika belum terima (batas: 1x per 30 detik) |
| **"Sign out"** | Keluar dari akun dan kembali ke login |

## 2.4. Akun Dinonaktifkan

Jika akun Anda dinonaktifkan oleh Master Agent, Anda akan melihat halaman:

> **"Akun Dinonaktifkan"**
> Akun Anda telah dinonaktifkan dan tidak dapat mengakses sistem.

Hubungi Master Agent Anda untuk mengaktifkan kembali akun.

---

# 3. Navigasi & Tata Letak Dasbor

## 3.1. Sidebar (Menu Samping Kiri)

Setelah login, Anda akan melihat dasbor utama. Di sisi kiri terdapat **sidebar** — menu navigasi utama.

### Cara Kerja Sidebar:

- **Arahkan kursor** ke sidebar → sidebar akan **melebar** menampilkan nama menu
- **Geser kursor keluar** dari sidebar → sidebar akan **menyusut** hanya menampilkan ikon
- **Klik** pada item menu untuk berpindah halaman

### Daftar Menu di Sidebar:

| Ikon | Nama Menu | Siapa yang Bisa Akses | Fungsi |
|---|---|---|---|
| ⚙️ | **Admin Panel** | Master Agent saja | Pusat kontrol utama |
| 💬 | **Chat** | Semua peran | Kotak masuk percakapan |
| 📊 | **Analytics** | Sesuai izin | Grafik dan statistik |
| 📋 | **Logs** | Sesuai izin (bukan Audit) | Catatan aktivitas pengguna |
| 👥 | **Contacts** | Sesuai izin | Daftar kontak pelanggan |
| 🔌 | **Connected Platforms** | Sesuai izin (bukan Audit) | WhatsApp, Telegram, LiveChat |
| 🤖 | **AI Agents** | Sesuai izin (bukan Agent/Audit) | Konfigurasi robot AI |
| 🛡️ | **Human Agents** | Master/Super Agent | Kelola agen manusia |
| 🔐 | **Permissions** | Master Agent saja | Kelola peran dan izin |
| 👤 | **Profile** | Semua peran | Pengaturan profil (di bagian bawah sidebar) |

> **Catatan**: Menu yang Anda lihat tergantung pada **peran** dan **izin** akun Anda. Jika Anda tidak melihat menu tertentu, itu berarti akun Anda tidak memiliki akses.

## 3.2. Header (Bilah Atas)

Di bagian atas halaman terdapat header yang menampilkan:

| Elemen | Posisi | Deskripsi |
|---|---|---|
| **Indikator Baterai AI** | Kiri | Menampilkan persentase sisa saldo AI (lihat Bab 14) |
| **Versi Aplikasi** | Kanan | Nomor versi seperti `v0.2.2` |
| **Badge "Online"** | Kanan | Status koneksi Anda (hover untuk tooltip) |
| **Toggle Tema** | Kanan | Klik untuk beralih antara mode terang ☀️ dan gelap 🌙 |
| **Nama & Email** | Kanan | Nama lengkap dan email Anda |
| **Avatar** | Kanan | Foto profil Anda. Klik untuk menu dropdown |

### Menu Dropdown Avatar:

Klik avatar Anda di kanan atas untuk membuka dropdown:

| Item | Fungsi |
|---|---|
| **Nama & email** | Menampilkan identitas Anda |
| **Profile** | Membuka popup profil (lihat Bab 4) |
| **Log out** | Keluar dari akun |

---

# 4. Profil Pengguna

Profil Anda bisa diakses dari dua tempat:
1. Klik **ikon Profile** di bagian bawah sidebar
2. Klik **avatar** di kanan atas → pilih **"Profile"**

## 4.1. Popup Profil

Saat profil dibuka, Anda akan melihat popup kecil berisi:

### Informasi Profil:

| Elemen | Deskripsi |
|---|---|
| **Avatar** | Foto profil Anda (inisial nama jika belum ada foto) |
| **Nama** | Nama lengkap yang ditampilkan |
| **Email** | Alamat email akun Anda |

### Pengaturan yang Tersedia:

| Pengaturan | Tipe | Deskripsi |
|---|---|---|
| **Display Name** | Kolom teks | Ubah nama tampilan Anda. ⚠️ **Hanya Master Agent & Super Agent** yang bisa mengubah. Agent biasa hanya bisa melihat. |
| **Online Status** | Switch On/Off | Tampilkan status online Anda (hijau = online) |
| **Notifications** | Switch On/Off | Aktifkan/nonaktifkan notifikasi suara dan popup saat ada pesan baru masuk. Pengaturan ini **tersinkronisasi di semua perangkat**. |
| **Reset Password** | Tombol 🔒 | Klik untuk pergi ke halaman reset password |
| **Log Out** | Tombol ↪️ | Keluar dari akun |

### Cara Mengubah Nama Tampilan (Master/Super Agent):

1. Klik pada nama di kolom **Display Name**
2. Ketik nama baru
3. Klik di luar kolom (blur) — nama akan tersimpan otomatis
4. Jika gagal, nama akan kembali ke semula

---

# 5. Chat / Inbox

Menu **Chat** adalah jantung dari Synka — tempat semua percakapan pelanggan ditampilkan.

## 5.1. Tata Letak Halaman Chat

Halaman Chat dibagi menjadi 3 kolom:

| Kolom | Posisi | Isi |
|---|---|---|
| **Daftar Thread** | Kiri | Semua percakapan yang ada |
| **Area Pesan** | Tengah | Isi percakapan yang sedang dipilih |
| **Detail Kontak** | Kanan | Informasi tentang pelanggan yang sedang diajak bicara |

## 5.2. Daftar Thread (Kolom Kiri)

### Tab Flow (Alur Percakapan):

Di bagian atas daftar thread ada tab-tab yang memfilter berdasarkan status:

| Tab | Deskripsi |
|---|---|
| **Semua** | Tampilkan semua percakapan |
| **Belum Ditugaskan** | Percakapan baru yang belum di-assign ke agen mana pun |
| **Ditugaskan** | Percakapan yang sudah di-assign ke agen tertentu |
| **Selesai** | Percakapan yang sudah ditandai selesai |

### Fitur Pencarian & Filter:

| Elemen | Fungsi |
|---|---|
| **Kolom pencarian** 🔍 | Ketik nama kontak atau isi pesan untuk mencari |
| **Tombol Filter** 🔽 | Buka panel filter lanjutan (lihat di bawah) |
| **Tombol Clear Filter** | Hapus semua filter aktif |

### Panel Filter Lanjutan (ChatFilter):

Klik tombol **Filter** untuk membuka panel filter lengkap:

| Filter | Tipe Input | Deskripsi |
|---|---|---|
| **Date Range** | Kalender (dari-sampai) | Filter pesan berdasarkan rentang tanggal |
| **Channel Type** | Dropdown | Pilih: All / WhatsApp / Telegram / Web |
| **Platform** | Dropdown | Pilih platform spesifik (tergantung Channel Type) |
| **Label** | Multi-pilih dengan pencarian | Filter berdasarkan label percakapan |
| **Agent** | Dropdown dengan pencarian | Filter berdasarkan agen yang ditugaskan |
| **Status** | Dropdown | Filter: Open / Resolved / All |
| **Resolved By** | Dropdown | Filter: AI / Human / All |

Di bagian bawah panel filter:
- **Tombol "Apply"** — Terapkan filter yang dipilih
- **Tombol "Reset"** — Hapus semua filter dan kembalikan ke default

### Tampilan Setiap Thread:

Setiap item di daftar thread menampilkan:

- **Avatar/Inisial** kontak
- **Nama kontak** pelanggan
- **Preview pesan** terakhir (dipotong jika terlalu panjang)
- **Waktu** pesan terakhir
- **Badge platform** (WhatsApp/Telegram/LiveChat) — dengan warna berbeda
- **Badge status** (Assigned/Unassigned/Done)
- **Indikator pesan belum dibaca** (titik biru atau angka)

## 5.3. Area Pesan (Kolom Tengah)

### Header Area Pesan:

Di bagian atas area pesan terdapat:

| Elemen | Fungsi |
|---|---|
| **Nama kontak** | Nama pelanggan yang sedang diajak bicara |
| **Badge platform** | Menunjukkan platform asal (WhatsApp/Telegram/LiveChat) |
| **Tombol "Ambil Alih"** | Untuk agen manusia mengambil alih chat dari AI |
| **Tombol pencarian pesan** 🔍 | Cari teks di dalam percakapan ini |
| **Badge status online** | Indikator apakah kontak sedang online |

### Bubble Pesan:

Setiap pesan ditampilkan sebagai "gelembung" (bubble):

| Posisi | Warna | Pengirim |
|---|---|---|
| **Kiri** | Abu-abu/putih | Pesan dari pelanggan |
| **Kanan** | Biru | Pesan dari agen/AI |

Setiap bubble menampilkan:
- **Isi pesan** (teks, gambar, file, atau link yang bisa diklik)
- **Waktu kirim** (format HH:MM)
- **Status kirim** (centang untuk terkirim, centang ganda untuk terbaca)
- **Pengirim** (nama agen atau "AI" untuk pesan otomatis)

### Fitur Markdown:

Pesan mendukung format Markdown:
- **Bold** (teks tebal)
- *Italic* (teks miring)
- Link yang bisa diklik
- Gambar yang bisa dilihat langsung

### Link Preview:

Saat pesan mengandung link URL, bubble pesan akan otomatis menampilkan preview link — seperti judul halaman dan deskripsi singkat. Link dapat diklik langsung dan akan terbuka di tab baru.

### Melihat Media (Gambar/Video/Audio):

Saat ada gambar atau video di dalam pesan, Anda bisa mengkliknya untuk membuka **Media Viewer** — modal layar penuh:

| Elemen | Fungsi |
|---|---|
| **Gambar/Video besar** | Ditampilkan di tengah layar |
| **Tombol Zoom (+/-)** | Perbesar atau perkecil gambar |
| **Tombol Download** ⬇️ | Unduh file ke komputer Anda |
| **Tombol Tutup (✕)** | Tutup media viewer |
| **Klik di luar media** | Tutup media viewer |
| **Tekan Escape** | Tutup media viewer |

Untuk audio, pemutar audio langsung ditampilkan di dalam bubble pesan dengan tombol play/pause.

### Pemisah Tanggal:

Antar pesan yang berbeda hari, terdapat pemisah tanggal:
- **"Hari ini"** — untuk pesan hari ini
- **"Kemarin"** — untuk pesan kemarin
- **Tanggal lengkap** — untuk pesan lebih lama dari kemarin

### Pencarian Pesan dalam Thread:

1. Klik ikon 🔍 di header area pesan
2. Ketik teks yang dicari
3. Pesan yang cocok akan di-highlight kuning
4. Gunakan tombol **↑ ↓** untuk berpindah antar hasil pencarian
5. Tekan **Esc** atau klik ✕ untuk menutup pencarian

### Tombol Scroll ke Bawah:

Jika Anda scroll ke atas untuk melihat pesan lama, akan muncul **tombol panah ke bawah** ⬇️ di pojok kanan bawah. Klik untuk langsung scroll ke pesan terbaru.

## 5.4. Mengirim Pesan (Kolom Tengah Bawah)

Di bagian bawah area pesan terdapat form untuk mengirim pesan:

| Elemen | Fungsi |
|---|---|
| **Kolom teks** | Ketik pesan Anda di sini. Tekan **Enter** untuk kirim, **Shift+Enter** untuk baris baru |
| **Tombol lampiran** 📎 | Klik untuk melampirkan file (gambar, dokumen) |
| **Tombol kirim** ➤ | Klik untuk mengirim pesan |

### Melampirkan File:

1. Klik ikon 📎
2. Pilih file dari komputer Anda
3. Preview file akan muncul di atas kolom teks
4. Klik ✕ pada preview untuk membatalkan

#### Jenis File yang Didukung:

| Tipe | Format |
|---|---|
| **Gambar** | JPEG, PNG, GIF, WebP |
| **Dokumen** | PDF |
| **Video** | MP4 |
| **Audio** | MP3, OGG |

> ⚠️ **Batas ukuran file**: maksimal **10 MB** per file.

#### Preview File Sebelum Kirim:

Setelah memilih file, preview akan muncul:
- **Gambar**: Thumbnail gambar ditampilkan (klik untuk memperbesar)
- **Video**: Ikon video dengan nama file
- **PDF/File lain**: Ikon file dengan nama dan ukuran
- **Audio**: Ikon audio dengan nama file
5. Klik ➤ atau tekan Enter untuk mengirim beserta file

### Mengambil Alih Chat dari AI:

Jika AI sedang menangani chat dan Anda ingin menjawab langsung:

1. Klik tombol **"Ambil Alih"** / **"Takeover"** di header
2. Chat akan berpindah dari AI ke Anda
3. Anda bisa mengirim pesan manual
4. AI tidak akan menjawab selama chat di-handle Anda

## 5.5. Detail Kontak (Kolom Kanan)

Kolom kanan menampilkan informasi tentang pelanggan:

| Informasi | Deskripsi |
|---|---|
| **Nama** | Nama kontak pelanggan |
| **Nomor Telepon/ID** | Nomor WhatsApp atau ID platform lain |
| **Platform** | Dari mana pelanggan menghubungi |
| **Label** | Tag/label yang ditempel pada percakapan |
| **Riwayat Chat** | Daftar percakapan sebelumnya dengan pelanggan ini |

---

# 6. Kontak

Menu **Contacts** menampilkan daftar semua pelanggan yang pernah menghubungi Anda.

## 6.1. Tabel Kontak

Tampilan utama berupa tabel dengan kolom:

| Kolom | Deskripsi |
|---|---|
| **☑ Checkbox** | Centang untuk memilih kontak (bisa pilih banyak) |
| **Nama** | Nama pelanggan |
| **Nomor/ID** | Nomor telepon atau ID platform |
| **Platform** | WhatsApp / Telegram / LiveChat |
| **Status Chat** | Status percakapan terakhir (Active, Resolved, dll.) |
| **Terakhir Dihubungi** | Kapan terakhir kali pelanggan mengirim pesan |

## 6.2. Fitur di Halaman Kontak

### Pencarian & Filter:

| Elemen | Fungsi |
|---|---|
| **Kolom pencarian** 🔍 | Cari berdasarkan nama atau nomor |
| **Filter Platform** | WhatsApp / Telegram / LiveChat |
| **Filter Status** | Active / Resolved / Pending |
| **Filter Tanggal** | Dari tanggal — sampai tanggal |
| **Tombol "Clear Filters"** | Hapus semua filter |
| **Tombol "Refresh"** 🔄 | Muat ulang data kontak |

### Sorting (Pengurutan):

Klik pada **header kolom** untuk mengurutkan:
- Klik 1x → urutkan naik (A-Z, terlama)
- Klik 2x → urutkan turun (Z-A, terbaru)

### Aksi pada Kontak:

Setiap baris kontak memiliki menu aksi (⋮):

| Aksi | Fungsi |
|---|---|
| **Lihat Percakapan** | Buka daftar percakapan dengan kontak ini (lihat di bawah) |
| **Lihat Detail** | Lihat informasi lengkap kontak |
| **Edit** | Ubah nama kontak |
| **Hapus** | Hapus kontak dari daftar |

### Dialog Pilih Percakapan (Contact Thread Picker):

Saat Anda klik **"Lihat Percakapan"** pada kontak yang memiliki beberapa percakapan, dialog popup akan muncul:

| Elemen | Deskripsi |
|---|---|
| **Judul** | "Percakapan dengan [Nama Kontak]" |
| **Kolom pencarian** 🔍 | Cari berdasarkan isi pesan atau platform |
| **Daftar thread** | Setiap thread menampilkan: platform (WhatsApp/Telegram/Web), status (Open/Closed), preview pesan terakhir, dan waktu |
| **Klik thread** | Langsung berpindah ke percakapan tersebut di halaman Chat |

> Jika kontak hanya memiliki 1 percakapan, Anda langsung diarahkan ke percakapan tersebut tanpa dialog.

### Aksi Massal (Bulk):

1. Centang beberapa kontak menggunakan checkbox
2. Tombol **"Hapus Terpilih"** akan muncul
3. Klik untuk menghapus semua kontak yang dicentang
4. Konfirmasi di popup dialog

---

# 7. Platform Terhubung

Menu **Connected Platforms** untuk menghubungkan dan mengelola channel komunikasi Anda.

## 7.1. Jenis Platform

Synka mendukung 3 jenis platform:

| Platform | Ikon | Cara Koneksi |
|---|---|---|
| **WhatsApp** | 💚 | Scan QR Code dari WAHA |
| **Telegram** | 💙 | Masukkan Bot Token dari BotFather |
| **LiveChat (Web)** | 🌐 | Salin kode embed ke website Anda |

## 7.2. Menambah Platform Baru

1. Klik tombol **"+ Add Platform"** atau **"Connect New"**
2. Pilih jenis platform: WhatsApp, Telegram, atau Web
3. Isi form yang muncul sesuai platform

### Form WhatsApp:

| Kolom | Deskripsi |
|---|---|
| **Session Name** | Nama untuk sesi WhatsApp ini (contoh: "CS Utama") |
| **Website ID** | ID website (contoh: "beat4d") → placeholder bawaan |

Setelah diisi:
1. Klik **"Create"**
2. Klik **"Connect"** → QR Code akan muncul
3. Buka WhatsApp di HP → Settings → Linked Devices → Link a Device
4. Scan QR Code
5. Status akan berubah menjadi **"WORKING"** = Terhubung ✅

### Form Telegram:

| Kolom | Deskripsi |
|---|---|
| **Bot Token** | Token dari BotFather Telegram |
| **Bot Name** | Nama bot Anda |
| **Website ID** | ID website |

### Form LiveChat (Web):

| Kolom | Deskripsi |
|---|---|
| **Platform Name** | Nama platform (contoh: "Website Utama") |
| **Website ID** | ID website (contoh: "beat4d") |

## 7.3. Detail Platform (Channel Details)

Setelah platform terhubung, klik pada platform untuk melihat detail:

| Informasi | Deskripsi |
|---|---|
| **Nama Platform** | Nama yang Anda berikan |
| **Tipe** | WhatsApp / Telegram / Web |
| **Status** | WORKING (aktif) / STOPPED (berhenti) |
| **Website ID** | ID website yang terhubung |
| **Assigned Agents** | Daftar AI dan Human Agent yang ditugaskan |

### Menugaskan Agen ke Platform:

1. Di bagian **"Assigned Agents"**, klik dropdown
2. Pilih satu atau beberapa AI Agent dan/atau Human Agent
3. Agen yang dipilih akan menerima pesan dari platform ini

### Kode Embed (Hanya LiveChat):

Untuk platform Web, Anda mendapatkan kode embed:

1. Salin kode HTML yang ditampilkan
2. Tempel ke website Anda sebelum tag `</body>`
3. Widget LiveChat akan muncul di sudut kanan bawah website

### Aksi pada Platform:

| Tombol | Fungsi |
|---|---|
| **Connect** | Hubungkan (scan QR untuk WhatsApp) |
| **Disconnect** | Putuskan koneksi |
| **Delete** | Hapus platform |
| **Logout** (WhatsApp) | Logout sesi WhatsApp |

---

# 8. AI Agents

Menu **AI Agents** untuk membuat dan mengonfigurasi robot AI yang menjawab pesan pelanggan.

## 8.1. Daftar AI Agent

Tampilan berupa kartu (card) untuk setiap AI Agent:

| Informasi di Kartu | Deskripsi |
|---|---|
| **Inisial/Avatar** | Huruf depan nama agent |
| **Nama** | Nama AI Agent |
| **Deskripsi** | Penjelasan singkat tentang agent |
| **Model** | Model AI yang digunakan (contoh: GPT-5.2) |
| **Provider** | Penyedia model (OpenAI, Google) |
| **Super Agent** | Supervisor yang menangani agent ini |
| **Tombol ⚙️** | Buka pengaturan agent |
| **Tombol 🗑️** | Hapus agent |

### Kartu "Create New" (+):

Di akhir daftar, terdapat kartu **"+ Create New AI Agent"** untuk membuat agent baru.

## 8.2. Membuat AI Agent Baru

1. Klik kartu **"+ Create New AI Agent"**
2. Isi form:

| Kolom | Deskripsi | Wajib? |
|---|---|---|
| **Name** | Nama AI Agent (contoh: "CS Bot") | ✅ |
| **Description** | Deskripsi singkat tentang tugas agent | Tidak |
| **Model** | Pilih model AI dari dropdown | ✅ |
| **System Prompt** | Instruksi untuk AI tentang cara menjawab | Tidak |
| **Temperature** | Tingkat kreativitas AI (0 = sangat tepat, 1 = kreatif) | Tidak |
| **Super Agent** | Supervisor yang bertanggung jawab | Tidak |

3. Klik **"Create"**

### Memahami System Prompt:

System prompt adalah instruksi yang Anda berikan ke AI. Contoh:

```
Kamu adalah customer service ramah untuk toko online XYZ.
Jawab dalam Bahasa Indonesia.
Jika ditanya tentang produk, berikan informasi dari katalog.
Jika tidak tahu jawabannya, minta pelanggan menunggu dan akan dihubungi agen manusia.
```

### Memahami Temperature:

| Nilai | Perilaku |
|---|---|
| **0.0** | Sangat konsisten, jawaban selalu mirip |
| **0.3** | Sedikit variasi, masih fokus |
| **0.7** | Cukup kreatif |
| **1.0** | Sangat kreatif, kadang tidak terduga |

> **Rekomendasi**: Gunakan **0.3 – 0.5** untuk customer service.

## 8.3. Pengaturan AI Agent (Halaman Detail)

Klik ⚙️ pada kartu agent untuk membuka halaman pengaturan lengkap. Halaman ini memiliki **2 tab utama** dan **area Chat Preview** di sisi kanan.

### Tab "General" (Umum):

Tab ini memiliki 3 bagian yang bisa dibuka/tutup (collapsible):

#### 📋 Behavior (Perilaku AI):

| Kolom | Deskripsi |
|---|---|
| **System Prompt** | Instruksi utama untuk AI. Tentukan kepribadian, gaya bahasa, dan batasan AI |
| **Guide Content** | Panduan tambahan yang bisa dirujuk AI (contoh: FAQ produk) |
| **Model** | Pilih model AI dari dropdown. Setiap model menampilkan: nama, provider, harga input/output per 1 juta token |
| **Fallback Model** | Model cadangan jika model utama gagal |
| **Temperature** | Slider 0.0 – 1.0 untuk mengatur kreativitas AI |
| **History Limit** | Berapa pesan terakhir yang AI ingat (maks 50-100 tergantung model) |
| **Context Limit** | Berapa token konteks yang digunakan (maks 40) |
| **Message Limit** | Batas pesan per sesi (maks 1000) |
| **Super Agent** | Pilih supervisor/Super Agent yang bertanggung jawab |

#### 👋 Welcome Message (Pesan Selamat Datang):

| Kolom | Deskripsi |
|---|---|
| **Welcome Message** | Pesan otomatis yang dikirim saat pelanggan pertama kali memulai chat |
| **Enable Follow-up (Unassigned)** | Aktifkan pesan tindak lanjut otomatis jika chat belum ditugaskan ke agen |
| **Follow-up Delay (Unassigned)** | Berapa detik sebelum pesan follow-up dikirim (untuk chat belum ditugaskan) |
| **Enable Follow-up (Assigned)** | Aktifkan pesan tindak lanjut jika chat sudah ditugaskan tapi belum dijawab |
| **Follow-up Delay (Assigned)** | Berapa detik sebelum pesan follow-up dikirim (untuk chat sudah ditugaskan) |
| **Follow-up Message** | Isi pesan follow-up yang akan dikirim |

#### 🔀 Transfer Conditions (Kondisi Alih):

| Kolom | Deskripsi |
|---|---|
| **Transfer Conditions** | Aturan kapan AI harus mengalihkan chat ke manusia. Contoh: "Jika pelanggan marah" atau "Jika pertanyaan tentang harga" |
| **Stop AI After Handoff** | Switch On/Off — Jika aktif, AI berhenti menjawab setelah chat dialihkan ke manusia |
| **Auto-Resolve Timer** | Berapa menit sebelum chat otomatis ditandai selesai jika tidak ada balasan (maks 24 jam / 1440 menit) |

### Tab "Knowledge" (Pengetahuan):

Tab ini memiliki **3 sub-tab** untuk menambahkan pengetahuan ke AI:

#### 📝 Sub-tab "Text":

Tulis informasi dalam format teks bebas yang bisa dirujuk AI saat menjawab.

- Ketik informasi di area teks besar
- Contoh: daftar produk, harga, kebijakan toko, jam operasional

#### 📁 Sub-tab "File":

Upload dokumen PDF sebagai sumber pengetahuan AI:

| Elemen | Fungsi |
|---|---|
| **Area drag-drop** | Seret file PDF ke area ini, atau klik untuk pilih file |
| **Daftar file** | Tabel file yang sudah diupload |
| **Toggle Enabled/Disabled** | Aktifkan/nonaktifkan file sebagai sumber pengetahuan |
| **Tombol Download** ⬇️ | Unduh file yang sudah diupload |
| **Tombol Hapus** 🗑️ | Hapus file dari daftar |
| **Tombol "Clear All"** | Hapus semua file sekaligus |
| **Status** | Ready / Processing / Error — status pemrosesan file |

> File yang diupload akan diproses dan diindeks agar AI bisa mencari informasi di dalamnya.

#### ❓ Sub-tab "Q&A" (Tanya Jawab):

Tambahkan pasangan pertanyaan-jawaban yang spesifik:

| Elemen | Fungsi |
|---|---|
| **Kolom "Question"** | Tulis pertanyaan yang sering ditanyakan |
| **Kolom "Answer"** | Tulis jawaban yang harus diberikan AI |
| **Tombol "+ Add"** | Tambah pasangan Q&A baru |
| **Tombol Hapus** 🗑️ | Hapus pasangan Q&A |

### Chat Preview (Panel Kanan):

Di sisi kanan halaman pengaturan, terdapat **sandbox chat** untuk menguji AI Agent:

| Elemen | Fungsi |
|---|---|
| **Area chat** | Tampilan percakapan uji coba |
| **Kolom input** | Ketik pesan untuk menguji respons AI |
| **Tombol kirim** | Kirim pesan uji coba |
| **Tombol "Clear Chat"** 🗑️ | Hapus semua pesan uji coba |
| **Tombol "Refresh"** 🔄 | Reset sesi uji coba ke awal |

> Chat Preview menggunakan model dan system prompt yang sedang Anda konfigurasi, sehingga Anda bisa langsung melihat bagaimana AI akan merespons.

### Tombol Aksi:

| Tombol | Fungsi |
|---|---|
| **"← Back"** | Kembali ke daftar AI Agent |
| **"Edit"** | Aktifkan mode edit (jika sedang melihat agent yang sudah ada) |
| **"Save"** | Simpan semua perubahan |
| **"Cancel"** | Batalkan perubahan dan kembali ke mode lihat |

---

# 9. Human Agents (Agen Manusia)

Menu **Human Agents** untuk mengundang dan mengelola tim customer service Anda.

## 9.1. Tab Utama

| Tab | Deskripsi |
|---|---|
| **Active** | Agen yang sudah aktif dan bisa login |
| **Pending** | Agen yang sudah diundang tapi belum membuat akun |

## 9.2. Tabel Agen Aktif

| Kolom | Deskripsi |
|---|---|
| **Avatar & Nama** | Foto profil dan nama agen |
| **Email** | Alamat email agen |
| **Peran** | Master Agent / Super Agent / Agent / Audit |
| **Status** | Aktif atau Tidak Aktif |
| **Online** | Indikator online (hijau = online, abu = offline, kuning = away) |
| **Terakhir Online** | Waktu terakhir agen terlihat online (contoh: "5 menit lalu") |
| **Aksi** | Menu untuk edit/hapus/lihat penggunaan |

### Status Online:

| Indikator | Arti |
|---|---|
| 🟢 Hijau | Sedang online saat ini |
| 🟡 Kuning | Baru saja online (kurang dari 5 menit lalu) |
| ⚫ Abu-abu | Offline |

## 9.3. Mengundang Agen Baru

1. Klik tombol **"+ Invite Agent"**
2. Isi form:

| Kolom | Deskripsi |
|---|---|
| **Email** | Email agen yang akan diundang (wajib) |
| **Full Name** | Nama lengkap agen (opsional) |
| **Role** | Pilih peran: Agent, Super Agent, Audit |

3. Klik **"Send Invite"**
4. Agen akan menerima email undangan
5. Agen klik link di email → membuat password → login

### Agen Pending (Belum Aktif):

Di tab **Pending**, Anda bisa melihat:
- Email yang sudah diundang
- Status undangan: **Invited** (menunggu) atau **Expired** (kadaluarsa)
- Tombol untuk mengirim ulang undangan atau menghapus

## 9.4. Mengelola Agen

### Mengubah Peran:

1. Cari agen di tabel
2. Klik dropdown **peran** di kolom Role
3. Pilih peran baru: Master Agent, Super Agent, Agent, atau Audit
4. Perubahan langsung berlaku

### Mengaktifkan/Menonaktifkan Agen:

1. Cari agen di tabel
2. Ubah status di kolom **Status** dari Active ke Inactive atau sebaliknya
3. Agen yang dinonaktifkan tidak bisa login

### Melihat Penggunaan Token:

1. Klik menu **⋮** → **"Usage Details"** pada agen
2. Popup muncul menampilkan:
   - Total token yang digunakan
   - Breakdown per model (GPT-5.2, Gemini-2.5-Flash, dll.)
   - Filter waktu: 7 hari / 30 hari / Bulan ini

### Mengatur Batas Token:

1. Klik menu **⋮** → **"Edit Limits"** pada Super Agent
2. Atur batas token harian dan bulanan
3. Klik **"Save"**
4. Jika agen melebihi batas, AI akan berhenti menjawab

### Menghapus Agen:

1. Klik menu **⋮** → **"Delete"**
2. Popup konfirmasi akan muncul
3. ⚠️ **Peringatan**: Jika agen adalah Master Agent terakhir, penghapusan ditolak
4. Klik **"Confirm"** untuk menghapus

## 9.5. Filter & Pencarian Agen

| Elemen | Fungsi |
|---|---|
| **Kolom pencarian** 🔍 | Cari berdasarkan nama atau email |
| **Filter Role** | Tampilkan hanya peran tertentu |
| **Filter Status** | Active / Inactive |
| **Halaman** | Navigasi antar halaman (10, 20, 50 per halaman) |

---

# 10. Analytics / Analitik

Menu **Analytics** menampilkan grafik dan statistik performa layanan pelanggan Anda.

## 10.1. Tab Analytics

| Tab | Deskripsi |
|---|---|
| **Overview** | Ikhtisar metrik utama |
| **Conversations** | Detail percakapan |
| **Agents** | Performa per agen |

## 10.2. Metrik Utama (Kartu Statistik)

Di bagian atas terdapat kartu-kartu statistik:

| Kartu | Deskripsi | Contoh |
|---|---|---|
| **Total Chats** | Jumlah total percakapan | 1,234 |
| **Containment Rate** | Persentase chat yang diselesaikan AI tanpa campur tangan manusia | 85% |
| **Handover Rate** | Persentase chat yang dialihkan dari AI ke manusia | 15% |
| **Avg Response Time** | Rata-rata waktu respons | 2.3 detik |

> **Tooltip**: Arahkan kursor ke ikon ❓ di samping setiap label untuk melihat penjelasan metrik.

## 10.3. Grafik Percakapan

Grafik garis menampilkan jumlah percakapan per hari:

- **Garis biru**: Total percakapan
- **Garis hijau**: Percakapan pertama kali (new customers)
- **Garis kuning**: Percakapan berulang (returning customers)

### Filter Tanggal:

| Elemen | Fungsi |
|---|---|
| **Tombol kalender** 📅 | Buka date picker untuk memilih rentang tanggal |
| **"From" - "To"** | Tanggal awal dan akhir |
| **Tombol "Clear"** | Hapus filter tanggal |

## 10.4. Statistik dari Database

| Metrik | Deskripsi |
|---|---|
| **Total Token Usage** | Total token AI yang digunakan |
| **Total Conversations** | Total percakapan |
| **Per-Channel Breakdown** | Pembagian per platform (WhatsApp/Telegram/LiveChat) |
| **Handover Reasons** | Alasan chat dialihkan ke manusia |
| **AI vs Human Resolution** | Persentase chat yang diselesaikan AI vs manusia |

---

# 11. Logs / Catatan Aktivitas

Menu **Logs** mencatat semua aktivitas pengguna di sistem — siapa melakukan apa, kapan, dan dari mana.

## 11.1. Tabel Log

| Kolom | Deskripsi |
|---|---|
| **Waktu** | Tanggal dan jam aktivitas terjadi |
| **User Email** | Email pengguna yang melakukan aksi |
| **Action** | Jenis aksi (contoh: login, create, update, delete) |
| **Resource** | Sumber daya yang diakses (contoh: ai_profile, channel, thread) |
| **Context** | Detail tambahan tentang aksi (IP address, browser, dll.) |

## 11.2. Filter Log

| Elemen | Fungsi |
|---|---|
| **Filter Action** | Pilih jenis aksi: create, read, update, delete, login |
| **Filter User** | Pilih pengguna tertentu |
| **Filter Resource** | Pilih sumber daya tertentu |
| **Filter Tanggal** 📅 | Pilih rentang tanggal |
| **Tombol "Clear"** | Hapus semua filter |

## 11.3. Navigasi Halaman

| Elemen | Fungsi |
|---|---|
| **"Showing X of Y"** | Jumlah log yang ditampilkan dari total |
| **Tombol ← →** | Navigasi halaman sebelum/sesudah |
| **Dropdown "per page"** | Pilih berapa log per halaman (10, 25, 50, 100) |

---

# 12. Permissions / Izin & Peran

Menu **Permissions** (hanya untuk Master Agent) untuk mengatur siapa bisa mengakses apa.

## 12.1. Daftar Peran (Roles)

Kartu untuk setiap peran menampilkan:

| Informasi | Deskripsi |
|---|---|
| **Nama Peran** | master_agent, super_agent, agent, audit |
| **Deskripsi** | Penjelasan singkat peran |
| **Jumlah Izin** | Berapa izin yang dimiliki peran ini |
| **Tombol Edit** ✏️ | Ubah nama atau deskripsi peran |
| **Tombol Hapus** 🗑️ | Hapus peran (hati-hati!) |

## 12.2. Matriks Izin (Permission Matrix)

Tabel besar yang menampilkan semua izin vs semua peran:

| | master_agent | super_agent | agent | audit |
|---|---|---|---|---|
| threads.read | ✅ | ✅ | ✅ | ❌ |
| threads.update | ✅ | ✅ | ❌ | ❌ |
| ai_profiles.create | ✅ | ❌ | ❌ | ❌ |
| ... | ... | ... | ... | ... |

### Cara Mengubah Izin:

1. Temukan izin yang ingin diubah di tabel
2. Klik **toggle/checkbox** di pertemuan baris (izin) dan kolom (peran)
3. ✅ = peran memiliki izin tersebut
4. ❌ = peran tidak memiliki izin tersebut
5. Perubahan langsung tersimpan

### Fitur Matriks Izin Detail:

| Fitur | Deskripsi |
|---|---|
| **Pencarian** 🔍 | Ketik nama resource atau aksi untuk memfilter |
| **Grup per Resource** | Izin dikelompokkan per sumber daya (threads, contacts, channels, dll.) |
| **Select All per Resource** | Tombol untuk mengaktifkan/menonaktifkan semua izin dalam satu resource sekaligus |
| **Access Level** | Untuk izin "read", pilih level akses: Read Own / Read Assigned / Read All |
| **High-Risk Warning** ⚠️ | Izin berisiko tinggi (seperti delete, manage) ditandai dengan ikon peringatan |
| **Kategori Aksi** | Izin dikelompokkan per kategori: Read, Write, Admin |

> **Peringatan**: Berhati-hati saat mengubah izin master_agent — Anda bisa mengunci diri sendiri!

## 12.3. Membuat Peran Baru

1. Klik tombol **"+ Create Role"**
2. Isi nama peran dan deskripsi
3. Klik **"Save"**
4. Peran baru akan muncul di daftar tanpa izin apa pun
5. Centang izin yang diinginkan di matriks

---

# 13. Admin Panel

Menu **Admin Panel** (hanya Master Agent) adalah pusat kontrol untuk pengaturan sistem.

## 13.1. Fitur Admin Panel

### 📊 Circuit Breaker Status:

Menampilkan kesehatan koneksi ke database:

| Metrik | Deskripsi |
|---|---|
| **Status Circuit** | CLOSED (normal ✅), OPEN (error 🔴), HALF_OPEN (recovery 🟡) |
| **Success Rate** | Persentase keberhasilan request |
| **Total Successes / Failures** | Jumlah request berhasil vs gagal sepanjang waktu |
| **Recent Failures** | Jumlah error dalam 10 detik terakhir |
| **Failure Log** | Tabel detail setiap error — termasuk endpoint, jenis operasi, pesan error, status code, timestamp, dan apakah memicu trip circuit |

#### Tombol Kontrol Circuit Breaker (Hanya Master Agent):

| Tombol | Fungsi |
|---|---|
| **"Reset Circuit"** | Reset circuit ke status CLOSED (normal) |
| **"Force Open"** | Paksa circuit ke status OPEN (semua request ditolak) |
| **"Flush Metrics"** | Hapus semua data metrik |
| **"Edit Config"** ✏️ | Ubah pengaturan circuit breaker (threshold, timeout, dll.) |
| **"Edit Adaptive Config"** | Ubah pengaturan rate limiter adaptif |

#### Grafik & Statistik Tambahan:

| Elemen | Deskripsi |
|---|---|
| **Grafik Request Rate** | Grafik garis jumlah request per waktu |
| **Grafik Error Rate** | Grafik persentase error |
| **Tabel Failure Log** | Daftar semua error yang terjadi (maks 50 entri) dengan kolom: waktu, endpoint, jenis operasi, pesan error, status code |

### 🤖 AI Auto-Response Control:

| Elemen | Fungsi |
|---|---|
| **Status** | Active ✅ atau Paused ⏸️ |
| **Tombol "Pause AI"** | Hentikan semua respons AI di seluruh organisasi |
| **Tombol "Resume AI"** | Aktifkan kembali respons AI |
| **Paused by** | Siapa yang menghentikan AI dan kapan |

> Ketika AI di-pause, **semua agen** akan melihat popup modal: **"AI Sedang Dijeda"** dengan informasi siapa yang menjeda.

### 🗑️ Data Retention (Penyimpanan Data):

| Elemen | Fungsi |
|---|---|
| **Retention Days** | Berapa hari data chat disimpan (contoh: 90 hari) |
| **Tombol "Save"** | Simpan pengaturan retensi |
| **Tombol "Preview Cleanup"** | Lihat berapa data yang akan dihapus |
| **Tombol "Execute Cleanup"** | Jalankan pembersihan data lama |

### 🔒 GDPR Deletion:

| Elemen | Fungsi |
|---|---|
| **Contact ID** | Masukkan ID kontak yang minta datanya dihapus |
| **Tombol "Delete"** | Hapus semua data kontak sesuai GDPR |

### 📦 Bulk Actions:

| Elemen | Fungsi |
|---|---|
| **Tombol "Clear All Caches"** | Bersihkan cache aplikasi |
| **Tombol "Bulk Delete"** | Hapus data secara massal |

---

# 14. AI Wallet & Indikator Baterai

Fitur **AI Wallet** melacak biaya penggunaan AI dalam format USD dan menampilkannya sebagai indikator baterai.

## 14.1. Indikator Baterai (Di Header)

Di pojok kiri atas header, Anda melihat indikator baterai:

### Tampilan:

```
🔋 85%
```

Klik untuk membuka dropdown detail.

### Warna Baterai:

| Persentase | Warna | Arti |
|---|---|---|
| 60% - 100% | 🟢 Hijau | Saldo cukup |
| 30% - 59% | 🟡 Kuning | Saldo mulai berkurang |
| 15% - 29% | 🟠 Oranye | Saldo rendah |
| 0% - 14% | 🔴 Merah | Saldo hampir habis |

## 14.2. Dropdown Baterai (Klik untuk Buka)

Saat diklik, dropdown menampilkan:

| Elemen | Deskripsi |
|---|---|
| **Ikon baterai besar** | Visual baterai dengan warna sesuai persentase |
| **Persentase** | Angka persen sisa saldo (contoh: 85%) |
| **Progress bar** | Bar visual yang berkurang seiring penggunaan |
| **Saldo USD** | Sisa saldo dalam dolar (contoh: $2.98 / $3.00) |
| **Batas Token** (Super/Master Agent) | Daftar batas token per Super Agent |

### Informasi Detail Token (untuk Super/Master Agent):

Menampilkan daftar Super Agent beserta:
- Nama Super Agent
- Token yang digunakan vs batas
- Indikator peringatan jika mendekati batas

## 14.3. Top Up Wallet (Khusus Master Agent)

Hanya Master Agent yang bisa menambah saldo:

1. Klik indikator baterai di header
2. Di dropdown, klik tombol **"Top Up Wallet"**
3. Form input muncul:
   - **Kolom USD**: Masukkan jumlah dolar (contoh: 5.00)
   - **Tombol "Submit"**: Klik untuk menambah saldo
4. Setelah berhasil, notifikasi hijau muncul: **"Wallet Topped Up"**
5. Baterai langsung reset ke **100%**

### Bagaimana Biaya Dihitung:

Setiap kali AI menjawab pesan, sistem otomatis:

1. Menghitung jumlah **token input** (pesan pelanggan) dan **output** (jawaban AI)
2. Mengalikan dengan harga model per 1 juta token
3. Mengurangi saldo wallet

Contoh untuk model GPT-5.2:
- Input: $1.75 per 1 juta token
- Output: $14.00 per 1 juta token
- 1 percakapan ≈ 2,000 token input + 200 token output ≈ $0.006

## 14.4. Peringatan Baterai Rendah (Low Battery Alert)

Saat baterai turun di bawah **20%**, popup modal muncul untuk semua pengguna:

### Untuk Master Agent:

> **⚠️ Baterai AI Hampir Habis**
>
> Baterai AI saat ini berada di **X%**.
>
> Silakan segera lakukan top up saldo AI wallet agar layanan tetap berjalan tanpa gangguan.
>
> [Mengerti]

### Untuk Agent/Super Agent/Audit:

> **⚠️ Baterai AI Hampir Habis**
>
> Baterai AI saat ini berada di **X%**.
>
> Silakan hubungi Master Agent untuk melakukan top up saldo AI wallet agar layanan tetap berjalan.
>
> [Mengerti]

- Popup muncul **setiap 10 menit** selama baterai di bawah 20%
- Klik **"Mengerti"** untuk tutup sementara
- Popup akan muncul lagi 10 menit kemudian jika belum di-top up
- Popup otomatis berhenti setelah baterai melebihi 20%

---

# 15. Notifikasi & Peringatan

## 15.1. Notifikasi Pesan Masuk

Saat ada pesan baru dari pelanggan, sistem memberikan notifikasi:

### Suara:

- Bunyi "pop" pendek saat ada pesan masuk
- Hanya berbunyi jika:
  - Anda adalah agen yang ditugaskan ke thread tersebut, ATAU
  - Anda adalah collaborator di thread tersebut
  - Notifikasi diaktifkan di profil Anda

### Toast (Popup Kecil):

| Elemen | Deskripsi |
|---|---|
| **Judul** | "New message from [Nama Kontak]" |
| **Preview** | 50 karakter pertama dari pesan |
| **Tombol "View"** | Klik untuk langsung ke percakapan |
| **Durasi** | Hilang otomatis setelah 4 detik |

> **Catatan**: Toast tidak muncul jika Anda sedang melihat thread yang sama (menghindari gangguan).

### AI Paused Modal:

Saat Master Agent menjeda semua respons AI, modal muncul untuk semua pengguna:

> **AI Sedang Dijeda**
> Dijeda oleh [Nama Master Agent] pada [tanggal/waktu]

- Klik **"Mengerti"** untuk tutup
- Modal hanya muncul 1x per sesi browser
- Otomatis hilang saat AI diaktifkan kembali

## 15.2. Toggle Tema (Terang/Gelap)

| Mode | Deskripsi |
|---|---|
| ☀️ **Terang** | Latar putih, teks hitam |
| 🌙 **Gelap** | Latar gelap, teks terang |

Klik ikon ☀️/🌙 di header untuk beralih.

---

# 16. LiveChat Widget

LiveChat adalah widget chat yang bisa ditanam di website Anda agar pengunjung bisa berkomunikasi langsung.

## 16.1. Tampilan Widget

Widget muncul sebagai:
- **Tombol chat** di sudut kanan bawah website (ikon 💬)
- Klik untuk membuka **jendela chat**

### Jendela Chat:

| Elemen | Posisi | Deskripsi |
|---|---|---|
| **Header "Live Chat"** | Atas | Judul dan tombol tutup (✕) |
| **Area pesan** | Tengah | Daftar pesan bolak-balik |
| **Kolom input** | Bawah | Ketik pesan dan tombol kirim |
| **Tombol lampiran** 📎 | Bawah kiri | Lampirkan file/gambar |
| **Tombol kirim** ➤ | Bawah kanan | Kirim pesan |

### Fitur Rate Limiting:

Jika pengunjung mengirim terlalu banyak pesan (5 pesan dalam 5 detik):
- Input dinonaktifkan selama **5 menit**
- Countdown timer ditampilkan
- Pesan: "Anda terlalu sering mengirim pesan. Silakan tunggu X menit."

## 16.2. Cara Memasang Widget

1. Buka menu **Connected Platforms**
2. Klik pada platform LiveChat (Web)
3. Salin kode embed yang ditampilkan
4. Buka file HTML website Anda
5. Tempel kode sebelum tag `</body>`
6. Simpan dan refresh website

---

# 17. Sistem Kehadiran (Presence)

Synka memiliki sistem kehadiran real-time yang menampilkan status online setiap agen.

## 17.1. Bagaimana Cara Kerja Presence?

- Saat Anda login, status Anda otomatis menjadi **Online** (🟢)
- Sistem secara berkala memperbarui status Anda ke server
- Jika Anda menutup tab atau browser, status akan berubah menjadi **Offline** setelah beberapa menit

## 17.2. Dimana Status Online Ditampilkan?

| Lokasi | Detail |
|---|---|
| **Header utama** | Badge "Online" di pojok kanan atas |
| **Tabel Human Agents** | Kolom "Online" di setiap baris agen |
| **Header chat** | Indikator online di samping nama kontak/agen |
| **Daftar thread** | Titik hijau di avatar agen yang ditugaskan |

## 17.3. Arti Indikator:

| Warna | Arti | Tooltip |
|---|---|---|
| 🟢 **Hijau** | Sedang online | "Online" |
| 🟡 **Kuning** | Baru offline (< 5 menit lalu) | "5 menit lalu" |
| ⚫ **Abu-abu** | Offline | "2 jam lalu" atau "Offline" |

> **Catatan**: Waktu "terakhir terlihat" ditampilkan dalam format relatif: "5 menit lalu", "2 jam lalu", "kemarin", dll.

---

# 18. Peran Pengguna (Roles)

## 18.1. Perbandingan Lengkap Peran

| Fitur | Master Agent | Super Agent | Agent | Audit |
|---|---|---|---|---|
| **Melihat Chat** | ✅ | ✅ | ✅ | ❌ |
| **Menjawab Chat** | ✅ | ✅ | ✅ | ❌ |
| **Melihat Semua Thread** | ✅ | ✅ (scope-nya) | ✅ (assigned saja) | ❌ |
| **Melihat Kontak** | ✅ | ✅ | ✅ | ❌ |
| **Edit Kontak** | ✅ | ✅ | ❌ | ❌ |
| **Hapus Kontak** | ✅ | ❌ | ❌ | ❌ |
| **Mengelola Platform** | ✅ | ✅ | ❌ | ❌ |
| **Membuat AI Agent** | ✅ | ✅ | ❌ | ❌ |
| **Mengundang Agen** | ✅ | ✅ | ❌ | ❌ |
| **Mengubah Peran** | ✅ | ❌ | ❌ | ❌ |
| **Mengelola Izin** | ✅ | ❌ | ❌ | ❌ |
| **Admin Panel** | ✅ | ❌ | ❌ | ❌ |
| **Melihat Analytics** | ✅ | ✅ | ❌ | ✅ |
| **Melihat Logs** | ✅ | ✅ | ❌ | ❌ |
| **Top Up AI Wallet** | ✅ | ❌ | ❌ | ❌ |
| **Menjeda AI** | ✅ | ❌ | ❌ | ❌ |
| **Ubah Nama Tampilan** | ✅ | ✅ | ❌ | ❌ |

---

# 19. Changelog / Riwayat Perubahan

Synka memiliki halaman **Changelog** yang mencatat semua perubahan dan pembaruan aplikasi.

## 19.1. Cara Mengakses:

- Kunjungi URL: `/changelog`
- Atau klik nomor versi di header (contoh: `v0.2.2`)

## 19.2. Apa yang Ditampilkan:

Setiap versi menampilkan:
- **Nomor versi** (contoh: 0.2.2)
- **Tanggal rilis** (contoh: 2026-03-17)
- **Daftar perubahan** dikelompokkan per kategori:
  - **Backend & Performance** — perbaikan di sisi server
  - **UI & Styling** — perubahan tampilan
  - **AI Wallet & Battery Tracker** — fitur pelacakan AI
  - **Notifications** — perubahan notifikasi
  - **Profile Permissions** — perubahan izin profil
  - dll.

> Halaman ini dapat diakses **tanpa login** — berguna untuk memeriksa pembaruan sebelum masuk.

---

# 20. Tanya Jawab (FAQ)

## Umum

**T: Mengapa saya tidak bisa melihat menu tertentu?**
J: Menu yang Anda lihat tergantung pada peran dan izin Anda. Hubungi Master Agent untuk mendapatkan akses.

**T: Bagaimana cara beralih antara mode terang dan gelap?**
J: Klik ikon ☀️/🌙 di header (pojok kanan atas).

## Chat

**T: Mengapa saya tidak mendengar suara saat ada pesan baru?**
J: Pastikan notifikasi diaktifkan di profil Anda (Profile → Notifications → On).

**T: Bagaimana cara mengambil alih chat dari AI?**
J: Buka percakapan yang ingin diambil alih, lalu klik tombol "Ambil Alih" / "Takeover" di header area pesan.

**T: Mengapa chat tidak muncul di daftar saya?**
J: Mungkin Anda memiliki filter aktif. Klik "Clear Filters" untuk menghapus semua filter.

## Platform

**T: QR Code WhatsApp tidak muncul?**
J: Pastikan sesi WhatsApp sudah dibuat. Klik "Connect" pada platform WhatsApp untuk memunculkan QR Code.

**T: Status WhatsApp "STOPPED"?**
J: WhatsApp mungkin terputus. Coba klik "Connect" ulang dan scan QR Code baru.

## AI Wallet

**T: Baterai AI menunjukkan 100% tapi saya sudah menggunakan AI?**
J: Jika baru top up, baterai direset ke 100%. Persentase akan turun seiring penggunaan.

**T: Berapa biaya per pesan AI?**
J: Tergantung model. Untuk GPT-5.2: sekitar $0.004 - $0.01 per pesan biasa. Percakapan panjang akan lebih mahal.

**T: Siapa yang bisa top up?**
J: Hanya Master Agent yang bisa melakukan top up melalui indikator baterai di header.

## Keamanan

**T: Saya tidak bisa login, apa yang harus dilakukan?**
J: 1) Pastikan email/password benar. 2) Jika lupa password, gunakan "Forgot Password". 3) Jika akun dinonaktifkan, hubungi Master Agent. 4) Jika hCaptcha tidak muncul, refresh halaman.

**T: Apa itu OTP?**
J: One-Time Password — kode 6 digit yang dikirim ke email Anda sebagai verifikasi tambahan keamanan saat login.

**T: Apa itu hCaptcha?**
J: hCaptcha adalah sistem keamanan yang memastikan bahwa yang login adalah manusia, bukan robot. Anda mungkin diminta mencentang kotak atau menyelesaikan tantangan gambar.

## File & Media

**T: File saya gagal diupload, kenapa?**
J: Pastikan file Anda: 1) Berukuran di bawah 10 MB. 2) Bertipe yang didukung (JPEG, PNG, GIF, WebP, PDF, MP4, MP3, OGG).

**T: Bagaimana cara mendownload file yang dikirim pelanggan?**
J: Klik gambar/file di bubble pesan → media viewer akan terbuka → klik tombol ⬇️ Download.

## Presence & Status

**T: Status saya menunjukkan offline padahal saya sedang online?**
J: Coba refresh halaman. Status online diperbarui secara berkala dan mungkin sedikit tertunda.

---

> 📌 **Versi Dokumen**: v0.2.2 — Terakhir diperbarui: 17 Maret 2026
>
> Untuk pertanyaan lebih lanjut, hubungi tim dukungan atau Master Agent organisasi Anda.
