# Akun Instan — Aplikasi Android

Aplikasi Android ini membungkus situs live **https://accounter.my.id** ke dalam
sebuah APK (WebView), jadi setiap perubahan di web langsung ikut di aplikasi
tanpa perlu build ulang.

## Fitur

- Buka situs langsung tanpa address bar
- Tarik ke bawah untuk memuat ulang
- Tombol kembali mengikuti riwayat halaman
- Login tersimpan (cookie & penyimpanan lokal aktif)
- Tautan luar (WhatsApp, dsb.) dibuka di aplikasi lain
- Upload file & unduhan didukung
- Deep link: tautan `https://accounter.my.id` bisa dibuka langsung di aplikasi

## Build APK lewat GitHub Actions

1. Buat tag versi, contoh:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
2. Workflow **Build Android APK** berjalan otomatis dan melampirkan
   `akun-instan-1.0.0.apk` ke GitHub Release.
3. Bisa juga jalan manual: tab **Actions → Build Android APK → Run workflow**.
   Hasilnya tersedia sebagai artifact.

## Keystore (penting untuk update)

Agar APK versi berikutnya bisa menimpa versi lama, gunakan keystore tetap.
Buat sekali di komputer:

```bash
keytool -genkeypair -v -keystore release.jks -alias akuninstan \
  -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 release.jks > release.txt
```

Lalu simpan di **Settings → Secrets and variables → Actions**:

| Secret | Isi |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | isi `release.txt` |
| `ANDROID_KEYSTORE_PASSWORD` | password keystore |
| `ANDROID_KEY_ALIAS` | `akuninstan` |
| `ANDROID_KEY_PASSWORD` | password key |

Tanpa secret ini, workflow tetap jalan dengan keystore sementara (APK bisa
dipasang, tapi update berikutnya harus uninstall dulu).

## Ubah alamat situs / nama aplikasi

- Alamat: `app/src/main/java/id/akuninstan/app/MainActivity.java` → `START_URL`
- Nama aplikasi: `app/src/main/res/values/strings.xml`
- Warna & ikon: `res/values/colors.xml`, `res/drawable/ic_launcher.xml`
