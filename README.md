# SiHago — React + Supabase

Website pencatatan keuangan pribadi dengan tampilan mengikuti referensi screenshot.

## Fitur
- Login dan register dengan Supabase Auth
- Dashboard saldo, pemasukan, pengeluaran, kategori
- CRUD transaksi
- CRUD anggaran
- CRUD wishlist
- Laporan ringkas
- Responsive untuk desktop dan mobile
- Row Level Security (RLS) sehingga data user terpisah

## Cara menjalankan

1. Install Node.js LTS.
2. Buat project di Supabase.
3. Buka Supabase > SQL Editor dan jalankan `supabase/schema.sql`.
4. Di folder project, salin `.env.example` menjadi `.env`.
5. Isi:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
6. Jalankan:
   ```bash
   npm install
   npm run dev
   ```
7. Buka alamat Vite yang muncul, biasanya `http://localhost:5173`.

### Catatan login
Jika Email Confirmation aktif di Supabase, setelah daftar user perlu memverifikasi email sebelum dapat masuk. Untuk development, Email Confirmation bisa dimatikan di Authentication > Providers > Email.

Jangan masukkan `service_role` key ke frontend. Gunakan hanya anon/publishable key.
