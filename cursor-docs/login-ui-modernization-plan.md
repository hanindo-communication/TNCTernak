# Rencana modernisasi UI halaman Login (TNC Ternak)

## Tujuan

Mengurangi kesan “kaku”, menambah kedalaman visual dan interaksi ringan yang masih selaras dengan palet **night / neon-cyan / neon-purple** yang sudah ada di `globals.css`.

## Prinsip desain

- **Immersive background**: lapisan berurutan (mesh gradient, grid halus, noise/grain, orb lembut) agar area tidak terasa kosong tanpa mengganggu keterbacaan form.
- **Motion bermakna**: animasi singkat untuk transisi mode Login/Daftar dan kemunculan form; hindari animasi berlebihan; hormati `prefers-reduced-motion`.
- **Interaksi**: spotlight lembut mengikuti pointer di atas kartu glass (depth), tab bergeser dengan indikator “sliding”, hover/focus yang jelas pada kontrol.
- **Kursor**: pada viewport pointer halus, kursor kustom minimal (dot + ring) hanya di area login; fallback ke kursor sistem jika `prefers-reduced-motion` atau coarse pointer.
- **Tipografi**: judul memakai font display terpisah (Google Fonts via `next/font`) untuk nuansa lebih “produk digital”; body tetap konsisten dengan app.

## Perubahan file (eksekusi)

| File | Perubahan |
|------|-----------|
| `src/app/layout.tsx` | Menambah font display (mis. **Syne** atau **Outfit**) sebagai CSS variable `--font-display`. |
| `src/app/globals.css` | Keyframe tambahan (float orb, shimmer halus, fade-slide), utilitas `.login-page-bg`, `.login-noise`, `.login-grid`, kelas spotlight, override `prefers-reduced-motion`. |
| `src/app/login/login-form.tsx` | Struktur background berlapis; kartu dengan spotlight `mousemove`; toggle Login/Daftar dengan thumb geser; form dengan transisi mode; landmark/accessibility tetap. |

## Tidak dilakukan (scope)

- Tidak menambah library animasi baru (mis. Framer Motion); tetap CSS + React state.
- Tidak mengubah alur auth atau API.

## Verifikasi sebelum release

1. `npm run build` — pastikan tidak ada error TypeScript/ESLint.
2. Cek login di desktop dan mobile (spotlight + custom cursor bisa dimatikan/disederhanakan untuk touch).
3. Aktifkan “Reduce motion” di OS — animasi harus mereda atau nonaktif.

## Status implementasi

- Rencana di atas sudah diterapkan di `layout.tsx`, `globals.css`, dan `login-form.tsx`.
- `npm run build` sukses (Next.js 16.2.1).

## Referensi palet (existing)

- `--bg-deep`, `--neon-cyan`, `--neon-purple`, `--muted`, glass panel.
