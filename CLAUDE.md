# think-Inn Ecosystem

pnpm monorepo.
- **Frontend:** `artifacts/think-inn` — React 18 + Vite + TypeScript + Tailwind v4 (`@theme inline` token'ları `src/index.css`).
- **API:** `artifacts/api-server` — Express 5 + Drizzle + Neon Postgres + Gemini.
- **Paylaşılan:** `lib/db`, `lib/integrations-gemini-ai`, `lib/api-client-react`.

## Design System

**Her görsel/UI kararından (renk, tipografi, spacing, logo, ikon, bileşen, gradient) ÖNCE `DESIGN.md` oku.**
Tüm marka renkleri, fontları, gradient yönü, logo kuralları ve UI renk kodları orada tanımlı (kaynak: think-Inn Brand Guide).

- Brand token'ları: `artifacts/think-inn/src/index.css` (`@theme inline`) — `DESIGN.md` §8 ile hizalı tutulmalı.
- Logo bileşeni: `artifacts/think-inn/src/components/brand/BrandLogo.tsx` (`BrandMark` / `Wordmark` / `BrandLogo`).
- Konsept şeridi: `artifacts/think-inn/src/components/brand/ConceptStrip.tsx`.

Kurallar:
- `DESIGN.md`'den sapma yapma; gerekiyorsa önce kullanıcı onayı al.
- Logoda `Inn` her zaman **altıgen içinde**, altıgenin **6 köşe düğümü korunur** (`DESIGN.md` §4/§6).
- QA/review sırasında `DESIGN.md`'ye uymayan kodu işaretle.
