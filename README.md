# Semangkuk Mie Ayam

Teman neduh saat abang mie ayam belum lewat. Game 2048 santai bertema warung mie ayam — geser dan gabungkan mangkuk yang sama sampai jadi semangkuk mie ayam komplit dengan es teh manis.

- Tanpa timer, dengan skor dan skor terbaik
- 3 slot simpanan, tersimpan otomatis di browser
- Koleksi mangkuk dan hitungan Semangkuk Komplit
- Kartu racikan yang bisa dibagikan saat permainan selesai
- Suara hujan dan kentongan
- PWA: bisa diinstal ke layar utama dan dimainkan offline

## Struktur

```
index.html            Game (satu file: HTML, CSS, JS)
sw.js                 Service worker untuk mode offline
manifest.webmanifest  Data aplikasi untuk instalasi PWA
assets/               Logo, ilustrasi mangkuk, ikon, dan suara
.nojekyll             Agar GitHub Pages menyajikan file apa adanya
```

## Publikasi dengan GitHub Pages

1. Upload semua isi folder ini ke root repository.
2. Buka **Settings > Pages**.
3. Di **Build and deployment**, pilih **Deploy from a branch**, branch `main`, folder `/ (root)`, lalu **Save**.
4. Tunggu 1–2 menit. Game tersedia di `https://<username>.github.io/<nama-repo>/`.

## Instal di HP

Buka alamat game sekali saat online, lalu:

- **Android (Chrome):** menu titik tiga > **Instal aplikasi**
- **iPhone (Safari):** tombol Bagikan > **Tambahkan ke Layar Utama**

Setelah itu game bisa dimainkan tanpa internet.

## Memperbarui game

Setiap kali mengubah file apa pun, naikkan `VERSION` di `sw.js` (misalnya `mieayam-v4` menjadi `mieayam-v5`). Tanpa langkah ini, pemain yang sudah menginstal bisa tetap melihat versi lama.

## Coba di komputer

```
python3 -m http.server
```

Lalu buka `http://localhost:8000`. Service worker hanya berjalan lewat `localhost` atau HTTPS, tidak lewat file yang dibuka langsung.
