# Think-Inn — Kurumsal İnovasyon Ekosistemi

> **Şirketlerin fikirlerini araştırmaya, araştırmalarını projeye dönüştürdüğü, AI destekli kurumsal inovasyon platformu.**

🌐 **Canlı Uygulama:** [think-inn-ecosystem.replit.app](https://think-inn-ecosystem.replit.app)

---

## Nedir?

Think-Inn, kurumsal çalışanların fikirlerini paylaşıp geliştirebildiği, araştırmalarla ilişkilendirebildiği ve projeye dönüştürebildiği bir inovasyon ekosistemidir. Tüm içerik üretimi **Chat-First** felsefesiyle çalışır: kullanıcılar form doldurmaz, yapay zeka ile sohbet eder.

---

## Özellikler

### 🤖 AI Orkestratör (Gemini 2.5 Flash)
- Kullanıcının doğal dil mesajını analiz eder; araştırma mı, fikir mi yoksa bilgi sorgusu mu olduğunu tespit eder
- Araştırma metni yapıştırıldığında otomatik başlık, özet, kategori ve anahtar kelimeler üretir
- Yeni fikir anlatıldığında mevcut fikirlerle çakışma tespiti yapar; çakışma varsa fikirleri birleştirir
- Araştırma–fikir bağlantılarını anlamsal olarak değerlendirir (uygunluk puanı + gerekçe)
- Fikir detaylı analiz istediğinde mimari, pazar, risk ve uygulama yol haritası üretir

### 💡 Fikir Yönetimi
- Chat üzerinden fikir oluşturma (form yok)
- Oy sistemi (beğeni)
- İşbirlikçi katkıda bulunma
- Kategori sınıflandırması (8 önceden tanımlı kategori)
- Araştırmalarla ilişkilendirme

### 📚 Araştırma Yönetimi
- Araştırma metni yapıştırarak içe aktarma
- Otomatik özet ve metadata üretimi
- AI tarafından önerilen fikir bağlantıları
- Konu eşleştirme (hangi araştırma konusu hangi fikre hizmet ediyor)
- Kategori ve oy sistemi

### 🗺️ İlişki Haritası (3D Mind Map)
- React Three Fiber (WebGL) tabanlı 3D interaktif harita
- Beyaz kart bazlı düğümler (araştırma/fikir/proje renk kodlu)
- OrbitControls: döndürme, zoom, kaydırma
- Düğüm sürükleme ile konumlandırma
- Bağlantı ekleme (+ butonu) → AI doğrulama → otomatik kayıt
- Bağlantı silme (çizgiye hover → × butonu)
- Küresel mod: tüm araştırma, fikir ve projelerin tek haritada gösterimi
- Odaklı mod: seçili kartın bağlı düğümleri fibonacci küresi üzerinde düzenlenir

### 🏆 İnovasyon Vitrini
- ARAŞTIRMALAR / FİKİRLER / PROJELER sekmeleri
- Kategori filtre çipleri
- Sıralama: Popüler / Yeni / Bağlantı sayısı
- Kart üzerinde oylaşma
- Kart tıklanınca 5 sekmeli detay modal:
  - **Genel Bakış** — özet, oy, işbirlikçiler
  - **Araştırmalar** — bağlı araştırma kartları
  - **Değerlendirme** — AI güven skoru ve kategori analizi
  - **AI Analiz** — mimari, pazar, risk, yol haritası (fikir için)
  - **Topluluk** — bağlı topluluk iş parçacığı, yorum ekleme

### 🏘️ Topluluk
- Araştırmalar / Fikirler / Projeler için otomatik oluşturulan iş parçacıkları
- Yan çubukta alan (space) filtresi
- Gönderi ve yorum sistemi
- Beğeni ve moderasyon altyapısı

### 🏗️ Proje Yönetimi
- Mimari analizi tamamlanmış fikirler otomatik proje statüsüne geçer
- Proje durumu (Planlama / Geliştirme / Tamamlandı vb.)
- Ekip üyeleri yönetimi
- Proje dokümantasyon linkleri

### 👥 Kullanıcı & Yetki Sistemi
- E-posta + şifre ile kayıt / giriş (JWT tabanlı)
- Roller: `user`, `admin`, `super_admin`
- Departman seçimi (kayıt sırasında)
- Davet sistemi (Resend ile e-posta gönderimi)

### 🛠️ Admin Paneli
- Kullanıcı yönetimi (listeleme, rol değiştirme, durum)
- Departman yönetimi (ekleme, düzenleme, silme)
- Sistem istatistikleri

---

## Teknik Yığın

| Katman | Teknoloji |
|---|---|
| Frontend | React 18 + Vite, TypeScript, Tailwind CSS |
| 3D Grafik | Three.js, @react-three/fiber, @react-three/drei |
| State / Veri | TanStack Query (React Query v5) |
| Backend | Node.js, Express 5, TypeScript |
| Veritabanı | PostgreSQL + Drizzle ORM |
| AI | Google Gemini 2.5 Flash (Generative AI SDK) |
| E-posta | Resend API |
| Kimlik Doğrulama | JWT + bcrypt |
| Monorepo | pnpm workspaces |
| API Codegen | Orval (OpenAPI → React Query hooks) |
| Doğrulama | Zod v4, drizzle-zod |

---

## Proje Yapısı

```
think-inn-ecosystem/
├── artifacts/
│   ├── api-server/          # Express 5 REST API
│   │   └── src/routes/
│   │       ├── ideas.ts          # Fikir CRUD + kategori
│   │       ├── research.ts       # Araştırma CRUD + kategori
│   │       ├── gemini/           # AI sohbet + analiz endpoint'leri
│   │       ├── community/        # Topluluk (spaces, threads, posts)
│   │       └── admin/            # Kullanıcı + departman yönetimi
│   └── think-inn/           # React + Vite frontend
│       └── src/
│           ├── components/
│           │   ├── dashboard/    # VitrinePanel (ana vitrin)
│           │   ├── graph/        # RelationGraph (3D harita)
│           │   ├── modals/       # CardDetailModal, ProjectAnalysisModal
│           │   └── chat/         # AI sohbet arayüzü
│           └── pages/
│               ├── CommunityPage.tsx
│               └── admin/        # Kullanıcı & departman yönetimi
├── lib/
│   ├── db/                  # Drizzle ORM şema + bağlantı
│   ├── api-spec/            # OpenAPI 3.1 spec + Orval config
│   ├── api-client-react/    # Üretilen React Query hook'ları
│   └── api-zod/             # Üretilen Zod şemaları
└── scripts/                 # Yardımcı araçlar
```

---

## Veritabanı Şeması (Temel Tablolar)

| Tablo | Açıklama |
|---|---|
| `users` | Kullanıcılar (rol, departman, davet) |
| `departments` | Şirket departmanları |
| `research` | Araştırma kayıtları (kategori, oy, ilişkiler) |
| `ideas` | Fikirler (kategori, değerlendirme, proje alanları) |
| `community_spaces` | Topluluk alanları (Araştırmalar / Fikirler / Projeler) |
| `community_threads` | İş parçacıkları (araştırma/fikir/proje bağlantılı) |
| `community_posts` | Gönderiler ve yorumlar |
| `gemini_conversations` | AI sohbet geçmişi |

---

## Nasıl Çalışır?

### Araştırma Ekleme
1. AI sohbet kutusuna araştırma metnini yapıştırın
2. Gemini metni analiz eder → başlık, özet, kategori, anahtar kelimeler üretir
3. Kullanıcı onaylar → veritabanına kaydedilir
4. Otomatik olarak ilgili fikirler önerilir

### Fikir Oluşturma
1. "Bir fikir anlatın" ile başlayın
2. Gemini fikri değerlendirir → mevcut fikirlerle çakışma kontrolü
3. Çakışma yoksa yeni fikir kaydedilir
4. Çakışma varsa mevcut fikre özellik eklenir

### Araştırma–Fikir Bağlantısı
1. Harita'da + butonuna basın
2. Gemini bağlantıyı semantik olarak değerlendirir
3. Uygunsa otomatik kaydedilir; uygun değilse gerekçe gösterilir, yine de bağlanabilir

### Proje Dönüşümü
1. Bir fikrin "AI Analiz" sekmesinde analiz başlatın
2. Mimari, pazar, risk ve yol haritası üretilir
3. Fikir otomatik olarak proje statüsüne geçer
4. Harita'da ve Projeler sekmesinde görünür hale gelir

---

## Kurulum (Yerel Geliştirme)

```bash
# Bağımlılıkları yükle
pnpm install

# Ortam değişkenlerini ayarla
# DATABASE_URL, GEMINI_API_KEY, JWT_SECRET, RESEND_API_KEY

# Veritabanı şemasını uygula
pnpm --filter @workspace/db run push

# Geliştirme sunucularını başlat
pnpm --filter @workspace/api-server run dev   # API: :3001
pnpm --filter @workspace/think-inn run dev    # Frontend: :5173
```

---

## Planlanan / Yol Haritası

- [ ] Bildirim sistemi (yeni yorum, bağlantı onayı)
- [ ] Gelişmiş arama (semantik / vektör tabanlı)
- [ ] Harita: force-directed otomatik kümeleme
- [ ] Mobil uygulama (Expo / React Native)
- [ ] SSO / Kurumsal LDAP entegrasyonu
- [ ] Raporlama ve inovasyon metrikleri dashboard'u
- [ ] Webhook entegrasyonları (Jira, Slack, Teams)

---

## Lisans

Bu proje özel/kurumsal kullanım için geliştirilmiştir.
