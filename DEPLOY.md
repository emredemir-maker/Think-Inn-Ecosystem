# Deploy — Think-Inn Production Stack

Replit dışı production setup. Üç sağlayıcı, hepsi free-tier:

| Katman | Sağlayıcı | URL | Maliyet |
|---|---|---|---|
| Frontend | Vercel | https://think-inn-ecosystem.vercel.app | $0 |
| API | Fly.io (fra region) | https://think-inn-api.fly.dev | ~$0-2/ay (allowance $5) |
| DB | Neon (eu-central-1) | `solitary-snow-89837763` | $0 (free tier) |

---

## Mimari

```
        ┌──────────────────────────────┐
        │  Browser                     │
        │  https://think-inn-          │
        │  ecosystem.vercel.app        │
        └──────────────┬───────────────┘
                       │ fetch(VITE_API_URL + /api/...)
                       ▼
        ┌──────────────────────────────┐
        │  Fly.io machine (fra)        │
        │  think-inn-api.fly.dev       │
        │  Express + Drizzle + Gemini  │
        │  auto-stop after idle        │
        └──────────────┬───────────────┘
                       │ pg connection
                       ▼
        ┌──────────────────────────────┐
        │  Neon Postgres               │
        │  ep-rough-sea-al1z7iw9       │
        │  eu-central-1                │
        └──────────────────────────────┘
```

Replit auto-deploy hâlâ aktif — `main`'e push edilen her commit hem Vercel'i hem de Replit'i tetikler.

---

## Yeniden deploy

### Frontend (otomatik)

Vercel GitHub repo'suna bağlı (`emredemir-maker/Think-Inn-Ecosystem`). `main` branch'e push edilen her commit otomatik deploy. Build kontrolü:

```bash
vercel ls think-inn-ecosystem
```

### API (manuel)

Fly.io git connect'i yok; lokalden deploy:

```bash
cd /path/to/Think-Inn-Ecosystem
~/.fly/bin/flyctl.exe deploy --app think-inn-api
```

Build esbuild ile bundle yapar, `artifacts/api-server/dist/index.mjs` üretir.

### DB şema değişikliği

```bash
DATABASE_URL='postgresql://neondb_owner:***@ep-rough-sea-al1z7iw9.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require' \
  pnpm --filter @workspace/db run push
```

`drizzle-kit push` interactive — drop column gibi destrüktif değişiklikler için `pnpm run push-force`.

---

## Environment variables

### Fly.io secrets

```bash
~/.fly/bin/flyctl.exe secrets list --app think-inn-api
```

Gerekli olanlar (hepsi zaten set):

| Key | Açıklama |
|---|---|
| `DATABASE_URL` | Neon Postgres connection string (sslmode=require) |
| `GEMINI_API_KEY` | Google AI Studio key |
| `AI_INTEGRATIONS_GEMINI_API_KEY` | Aynı key — Replit alias'ı için ikinci kopya |
| `AI_INTEGRATIONS_GEMINI_BASE_URL` | `https://generativelanguage.googleapis.com` (standart Google endpoint) |
| `JWT_SECRET` | 64-char hex rastgele |
| `RESEND_API_KEY` | E-mail invitation gönderimi için |
| `FRONTEND_URL` | `https://think-inn-ecosystem.vercel.app` (CORS allowlist) |
| `PORT` | `8080` (fly.toml içinde) |
| `NODE_ENV` | `production` (fly.toml içinde) |

Secret değiştirmek için:

```bash
~/.fly/bin/flyctl.exe secrets set KEY=value --app think-inn-api
```

Machine restart olur, ~10 sn downtime.

### Vercel env

```bash
vercel env ls
```

| Key | Scope | Değer |
|---|---|---|
| `VITE_API_URL` | Production | `https://think-inn-api.fly.dev` |

Frontend build sırasında bake edilir; değişirse yeniden deploy gerekir.

---

## Health & gözlem

| Kontrol | URL |
|---|---|
| API health | https://think-inn-api.fly.dev/api/healthz |
| Frontend | https://think-inn-ecosystem.vercel.app |
| Fly machine | `~/.fly/bin/flyctl.exe status --app think-inn-api` |
| Fly logs | `~/.fly/bin/flyctl.exe logs --app think-inn-api` |
| Neon usage | https://console.neon.tech/app/projects/solitary-snow-89837763 |
| Vercel deploys | https://vercel.com/emre-demirs-projects-1ac5e712/think-inn-ecosystem |

---

## Maliyet izleme

- **Fly.io**: $5/ay free allowance. shared-cpu-1x@512MB, auto-stop on idle → portföy trafiği için $0 beklenir. https://fly.io/dashboard/emre-demir-36/billing
- **Vercel**: Hobby plan, sınırsız static. Frontend bundle <200 KB.
- **Neon**: Free tier, 0.5 GB storage + 100 saat compute/ay. Şu anki ölçek için >10x fazla.

Eğer Fly machine sürekli aktif kalıyorsa (auto-stop tetiklenmiyorsa):
```bash
~/.fly/bin/flyctl.exe machine list --app think-inn-api
~/.fly/bin/flyctl.exe machine stop <machine-id> --app think-inn-api
```

---

## Replit'i devre dışı bırakmak

Şu an Replit hâlâ çalışıyor ve `main`'e push'ta otomatik deploy alıyor. İstersen:

1. Replit dashboard'da "Always-On" / "Deployment"'ı kapat
2. `.replit` dosyası repo'da kalsın (silmek Replit dev ortamını da bozar)

`replit.app` URL'ini Vercel/Fly altyapısına yönlendirmek için bir custom domain alıp her ikisine de bağlamak gerekir.

---

## İlk admin kullanıcısı

Admin bootstrap için `BOOTSTRAP_SECRET` env eklendi mi kontrol et. Eklemek gerekirse:

```bash
~/.fly/bin/flyctl.exe secrets set BOOTSTRAP_SECRET="$(openssl rand -hex 16)" --app think-inn-api
```

Sonra:
```bash
curl -X POST https://think-inn-api.fly.dev/api/auth/bootstrap \
  -H "Content-Type: application/json" \
  -H "x-bootstrap-secret: $BOOTSTRAP_SECRET" \
  -d '{"email":"emre.demir@infoset.app","password":"...","name":"Emre"}'
```

(Endpoint detayını `artifacts/api-server/src/routes/admin/bootstrap.ts` doğrular.)

---

## Geri dönüş planı

Bir şey kırılırsa:

1. **Vercel rollback**: Vercel dashboard → Deployments → eski "Ready" deploy'u "Promote to Production".
2. **Fly rollback**: `~/.fly/bin/flyctl.exe releases --app think-inn-api` listeden eski versiyonu seç, `flyctl deploy --image <eski-image>`.
3. **DB rollback**: Neon point-in-time restore (free tier 6 saat geçmiş tutuyor).

---

Son güncelleme: 2026-05-27 — initial cutover from Replit.
