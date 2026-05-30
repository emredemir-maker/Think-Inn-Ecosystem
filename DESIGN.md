# think-Inn — Design System (Source of Truth)

> Bu dosya think-Inn'in **tasarım sistemi kaynağıdır**. Her görsel/UI kararından önce okunmalıdır.
> İçeriği marka rehberidir (think-Inn Brand Guide). Önce kodda nerede uygulandığı (Implementation Map),
> ardından tam marka rehberi yer alır.

## 0. Implementation Map (kodda karşılığı)

- **Renk & tipografi token'ları:** `artifacts/think-inn/src/index.css` → `@theme inline` bloğu
  (`--color-primary: #1463F3`, `--font-display: Poppins`, …). Marka paleti §8 ile birebir hizalı.
- **Logo:** `artifacts/think-inn/src/components/brand/BrandLogo.tsx`
  - `BrandMark` — ağ-düğüm ikonu · `Wordmark` — "think-" + **pointy-top altıgen** içinde "Inn" (6 köşe düğümü korunur, §4/§6)
  - `BrandLogo` — yatay kilit (ikon + wordmark + `AI INNOVATION ECOSYSTEM`)
  - Kullanım yerleri: sidebar (`components/layout/HUDLayout.tsx`), Auth (`pages/AuthPage.tsx`)
- **Favicon / app icon:** `artifacts/think-inn/public/favicon.svg` (koyu navy zemin, sadece `Inn` çekirdeği — §4.3)
- **Konsept şeridi ("Bir Bakışta Konsept"):** `artifacts/think-inn/src/components/brand/ConceptStrip.tsx`
  - `variant="hero"` → Dashboard hero altı · `variant="footer"` → diğer sayfaların altı
- **Gradient:** `#18C9E8 → #1463F3 → #7A5CFF` (§8.2) — ikon çizgileri, altıgen kenarları, düğümler.
- **UI içerik renk kodları (§13):** Fikir `#1463F3` · Araştırma `#18C9E8` · Proje `#7A5CFF` ·
  Topluluk `#20C997` · Risk `#FFB020` · Kritik `#EF4444` · Başarı `#22C55E`.

### Değişiklik Günlüğü
| Tarih | Karar | Gerekçe |
|---|---|---|
| 2026-05-30 | Brand guide DESIGN.md olarak eklendi; logo (pointy-top altıgen + köşe düğümleri) ve "Bir Bakışta Konsept" şeridi uygulandı | Marka rehberini kod kaynağına bağlamak |

---

## 1. Marka Özeti

**Marka adı:** think-Inn  
**Tanım:** AI destekli kurumsal inovasyon ekosistemi  
**Kategori:** AI-native SaaS / kurumsal inovasyon platformu / fikirden projeye dönüşüm sistemi  
**Ana fikir:** Kurum içindeki fikirleri, araştırmaları, topluluk katkılarını ve projeleri tek bir akıllı ekosistemde birleştirmek.

think-Inn, çalışanların fikirlerini form doldurarak değil, **chat-first** bir deneyimle ortaya çıkardığı; araştırmalarla ilişkilendirdiği; topluluk katkısıyla geliştirdiği ve sonunda projeye dönüştürdüğü bir inovasyon platformudur.

---

## 2. Marka Konumlandırması

### Konumlandırma Cümlesi

**think-Inn, kurumsal fikirleri araştırma, yapay zekâ ve topluluk katkısıyla projeye dönüştüren AI-native inovasyon ekosistemidir.**

### Kısa Tanım

**Ideas, research and projects — connected by AI.**

### Türkçe Kısa Tanım

**Fikirleri, araştırmaları ve projeleri yapay zekâ ile birbirine bağlayan inovasyon ekosistemi.**

### Marka Vaadi

Kurum içindeki dağınık fikirleri görünür, değerlendirilebilir, ilişkilendirilebilir ve uygulanabilir projelere dönüştürmek.

### Marka Karakteri

- Akıllı
- Sistematik
- Kurumsal
- Yenilikçi
- Sade
- Güvenilir
- Katılımcı
- Üretken

---

## 3. Logo Sistemi

think-Inn logosu üç ana parçadan oluşur:

1. **Başlangıç ikonu**  
   Fikir, araştırma, bağlantı ve yapay zekâ orkestrasyonunu temsil eder.

2. **think- yazısı**  
   Düşünme, üretme ve fikir geliştirme katmanını temsil eder.

3. **Inn altıgen ikonu**  
   -Inn ekosisteminin ortak imzasıdır. Platformun fikirleri, araştırmaları, ürünleri ve projeleri kapsayan merkez yapısını temsil eder.

---

## 4. Logo Varyasyonları

### 4.1 Primary Logo

**Kullanım amacı:** Web sitesi header, sunum kapakları, kurumsal dokümanlar, ürün giriş ekranı, landing page hero alanı.

**Yapı:**

- Solda bağlantı/düğüm ikonu
- Ortada `think-` yazısı
- Sağda altıgen düğüm yapısı içinde `Inn`
- Alt satırda descriptor: `AI INNOVATION ECOSYSTEM`

**Kural:**

Primary logoda yalnızca **tek bir Inn temsili** kullanılmalıdır. `think-` yazısından sonra gelen altıgen içindeki Inn markası yeterlidir. Ekstra sağ ikon, tekrar algısı yarattığı için kullanılmamalıdır.

### 4.2 Stacked Logo

**Kullanım amacı:** Kareye yakın alanlar, sunum içi bölüm geçişleri, sosyal medya görselleri, ürün kartları, dar alanlar.

**Yapı:**

- Üstte bağlantı/düğüm ikonu
- Altında `think-` + altıgen içindeki `Inn`
- En altta `AI INNOVATION ECOSYSTEM`

**Kural:**

Stacked varyantta üst ikon, primary logodaki sol ikonla aynı olmalıdır. Farklı ikon kullanılmamalıdır; bu, marka tutarlılığını bozar.

### 4.3 Favicon / App Icon

**Kullanım amacı:** Tarayıcı favicon, mobil uygulama ikonu, PWA ikonu, sidebar app markası.

**Yapı:**

- Koyu lacivert rounded-square zemin
- Merkezde altıgen düğüm yapısı
- Altıgen içinde `Inn`
- Etrafında sınırlı ve sade orbit/bağlantı hissi

**Kural:**

Favicon küçük boyutta okunabilir olmalıdır. Bu yüzden:

- `think-` yazısı favicon içinde kullanılmaz.
- Sadece `Inn` çekirdeği kullanılır.
- Orbit çizgileri fazla detaylı olmamalıdır.
- Altıgen köşelerindeki düğümler korunmalıdır.

---

## 5. Logo Anlamı

### Başlangıç İkonu

Başlangıç ikonu, think-Inn’in temel çalışma mantığını temsil eder:

- Fikirlerin doğması
- Araştırmalarla bağlantı kurulması
- AI orkestrasyon
- Topluluk katkısı
- Projeye dönüşüm

İkonun düğüm yapısı, platformdaki ilişki haritasını ve 3D mind map mantığını da destekler.

### Altıgen Inn İkonu

Altıgen, -Inn ailesinin ortak marka imzasıdır. think-Inn özelinde bu sembol:

- Ekosistem merkezini
- Ürünlerin kapsanmasını
- Fikir ve araştırma ağını
- Projeye dönüşüm çekirdeğini
- Kurumsal yapıyı

ifade eder.

Altıgenin köşelerindeki düğümler, fikir–araştırma–proje–topluluk–AI–yönetim bağlantılarını temsil eder.

---

## 6. Logo Kullanım Kuralları

### Doğru Kullanım

- Primary logo geniş alanlarda kullanılmalıdır.
- Stacked logo kare/dikey alanlarda kullanılmalıdır.
- Favicon yalnızca ikon kullanımı gereken alanlarda kullanılmalıdır.
- `Inn` kısmı her zaman altıgen yapı içinde kullanılmalıdır.
- `think-` yazısı sade ve mavi tonlarda kalmalıdır.
- Descriptor satırı ana logodan belirgin şekilde ayrılmalı, biraz aşağıda konumlanmalıdır.
- Başlangıç ikonu, ana yazı ve descriptor satırının toplam yüksekliğine göre dikey ortalanmalıdır.

### Yanlış Kullanım

- Primary logoda iki ayrı `Inn` ikonu kullanılmamalıdır.
- `Inn` düz yazı olarak bırakılmamalıdır.
- Altıgen içi gereksiz koyu/siyah doldurulmamalıdır.
- Başlangıç ikonu sadece ana yazıya hizalanmamalıdır; iki satırlı logo yapısına göre ortalanmalıdır.
- Favicon içinde uzun yazı kullanılmamalıdır.
- Logo farklı renklerle rastgele çoğaltılmamalıdır.
- Altıgen köşe düğümleri kaldırılmamalıdır.

---

## 7. Boşluk ve Hizalama Kuralları

### Primary Logo

- Başlangıç ikonu ile `think-` yazısı arasında yeterli nefes alanı bırakılmalıdır.
- `AI INNOVATION ECOSYSTEM` satırı, ana yazıya çok yaklaşmamalıdır.
- Descriptor satırı, `think-` + `Inn` toplam genişliğine göre ortalanmalıdır.
- Başlangıç ikonu, ana yazı ve descriptor satırının toplam yüksekliğine göre ortalanmalıdır.

### Minimum Güvenli Alan

Logonun çevresinde en az `Inn` harf yüksekliğinin yarısı kadar boşluk bırakılmalıdır.

### Minimum Kullanım Boyutu

- Primary logo: minimum 220 px genişlik
- Stacked logo: minimum 160 px genişlik
- Favicon/app icon: minimum 32 px, ideal 64 px ve üzeri

---

## 8. Renk Paleti

### Ana Renkler

| Rol | Renk | Hex |
|---|---:|---:|
| Primary Blue | Canlı teknoloji mavisi | `#1463F3` |
| Deep Navy | Kurumsal koyu lacivert | `#071B3A` |
| Cyan Accent | AI / bağlantı vurgusu | `#18C9E8` |
| Violet Accent | inovasyon / ağ vurgusu | `#7A5CFF` |
| Slate Text | Descriptor ve ikincil yazılar | `#33415C` |
| Soft Background | Açık zemin | `#F8FAFF` |
| Pure White | Logo iç alanı | `#FFFFFF` |

### Gradient Kullanımı

Ana gradient yönü:

`Cyan → Blue → Violet`

Önerilen gradient:

`#18C9E8 → #1463F3 → #7A5CFF`

Gradient; ikon çizgilerinde, altıgen kenarlarında ve düğümlerde kullanılabilir. Metinlerde daha kontrollü kullanılmalıdır.

---

## 9. Tipografi

think-Inn, diğer -Inn ailesi uygulamalarıyla uyumlu, modern ve okunabilir bir sans-serif karakter taşımalıdır.

### Logo Yazı Karakteri Yönü

- Geometrik
- Yuvarlatılmış
- Modern SaaS hissi veren
- Çok futuristik olmayan
- Kurumsal kullanımda güven veren

### Önerilen Font Ailesi

**Primary öneri:** Poppins  
**Alternatifler:**

- Manrope
- Inter
- Plus Jakarta Sans
- Sora
- Urbanist

### Kullanım Önerisi

| Alan | Font | Ağırlık |
|---|---|---:|
| Logo `think-` | Poppins / Manrope | 500–600 |
| Descriptor | Inter / Manrope | 500–600, geniş harf aralığı |
| UI başlıkları | Manrope / Inter | 600–700 |
| UI gövde metni | Inter | 400–500 |
| CTA / Buton | Inter / Manrope | 600 |

---

## 10. İkonografi

İkon dili, think-Inn’in ilişki ve dönüşüm mantığını taşımalıdır.

### Temel Formlar

- Düğüm noktaları
- Bağlantı çizgileri
- Altıgen yapı
- Hafif orbit/akış çizgileri
- Chat balonu
- Araştırma kartı
- Fikir kartı
- Proje kartı
- Topluluk simgesi

### Stil Kuralları

- Çizgiler yuvarlatılmış olmalıdır.
- Düğüm uçları dairesel olmalıdır.
- İkonlarda 2–3 renkli gradient kullanılabilir.
- Çok fazla detaydan kaçınılmalıdır.
- İkonlar kurumsal SaaS arayüzünde küçük boyutta da okunabilir kalmalıdır.

---

## 11. Görsel Dil

think-Inn’in görsel dili üç ana metafor üzerine kuruludur:

### 1. Chat-First Üretim

Kullanıcı form doldurmaz; yapay zekâ ile konuşarak içerik üretir.

Görsel karşılığı:

- Chat balonları
- Sohbet akışı
- Prompt alanı
- AI öneri kartları

### 2. Bağlantılı Bilgi Ağı

Fikirler, araştırmalar, projeler ve topluluk katkıları birbirine bağlıdır.

Görsel karşılığı:

- Node graph
- Mind map
- Altıgen ağ
- Bağlantı çizgileri

### 3. Fikirden Projeye Dönüşüm

Fikirler analiz edilir, olgunlaşır ve proje statüsüne geçer.

Görsel karşılığı:

- Yol haritası
- Aşama göstergeleri
- AI skor kartları
- Proje statü etiketleri

---

## 12. UI Tasarım Prensipleri

### Genel Arayüz Karakteri

- AI-native
- Temiz
- Kart bazlı
- Konuşma merkezli
- Bağlantı haritası odaklı
- Kurumsal ama yaratıcı

### Ana UI Bileşenleri

#### Chat Paneli

- Ana üretim alanı
- Kullanıcının fikir, araştırma veya sorgu girdiği merkez
- AI cevapları kartlara, önerilere ve bağlantılara dönüşür

#### Fikir Kartları

- Başlık
- Kısa özet
- Kategori
- Oy sayısı
- Bağlı araştırma sayısı
- AI güven skoru

#### Araştırma Kartları

- Otomatik başlık
- Özet
- Anahtar kelimeler
- Kategori
- Bağlı fikirler

#### Proje Kartları

- Proje durumu
- Ekip üyeleri
- Yol haritası
- Dokümantasyon linki
- AI analiz özeti

#### 3D Mind Map

- Araştırma, fikir ve projeler düğüm olarak gösterilir.
- Renk kodları net olmalıdır.
- Bağlantılar AI gerekçesiyle desteklenmelidir.

---

## 13. UI Renk Kodlama Önerisi

| İçerik Tipi | Renk | Kullanım |
|---|---:|---|
| Fikir | `#1463F3` | Ana fikir kartları ve düğümler |
| Araştırma | `#18C9E8` | Araştırma kartları ve kaynak bağlantıları |
| Proje | `#7A5CFF` | Proje kartları ve roadmap alanları |
| Topluluk | `#20C997` | Yorumlar, iş parçacıkları, katkılar |
| Risk | `#FFB020` | Risk analizleri |
| Kritik Uyarı | `#EF4444` | Çakışma, düşük güven, hata |
| Başarı | `#22C55E` | Onay, projeleşme, tamamlanma |

---

## 14. Kart Tasarım Dili

### Kart Yapısı

- Beyaz veya çok açık zemin
- Hafif gölge
- 16–24 px radius
- İnce border
- Kategori chipleri
- AI skor göstergesi
- Bağlantı sayısı göstergesi

### Kart Hiyerarşisi

1. Başlık
2. Özet
3. Metadata / kategori
4. Bağlantılar
5. Etkileşimler
6. AI aksiyonları

### Kart Aksiyonları

- Bağlantı öner
- AI analiz yap
- Projeye dönüştür
- Toplulukta tartış
- Araştırma ekle
- Benzer fikirleri göster

---

## 15. Dil ve Ton

think-Inn’in dili akıllı ama anlaşılır olmalıdır. Platform, kullanıcıyı teknik detayla yormadan yönlendirmelidir.

### Ton

- Yardımcı
- Net
- Analitik
- Teşvik edici
- Kurumsal
- Gerektiğinde yaratıcı

### Örnek Mikro Metinler

**Fikir oluşturma:**  
“Fikrini anlat, ben onu yapılandırılmış bir inovasyon kartına dönüştüreyim.”

**Araştırma içe aktarma:**  
“Araştırma metnini buraya yapıştır. Başlık, özet ve anahtar kelimeleri otomatik çıkaracağım.”

**Çakışma tespiti:**  
“Bu fikir mevcut bir fikirle benzer görünüyor. Birleştirmek ister misin?”

**Projeleşme:**  
“Bu fikir mimari analiz için yeterince olgun. Proje statüsüne taşınabilir.”

**Bağlantı önerisi:**  
“Bu araştırma, fikrini destekliyor olabilir. Uygunluk puanı: %84.”

---

## 16. Marka Mesajları

### Ana Mesaj

**Fikirlerin kaybolmasın. Araştırmalarla güçlensin, yapay zekâ ile projeye dönüşsün.**

### Alternatif Mesajlar

- Kurum içi inovasyonu konuşarak başlatın.
- Fikir, araştırma ve projeleri tek bir AI ekosisteminde birleştirin.
- Chat-first inovasyon yönetimi.
- Araştırmadan fikre, fikirden projeye.
- Kurumsal hafızayı inovasyon ağına dönüştürün.

### İngilizce Alternatifler

- Turn ideas into projects with AI.
- Connect research, ideas and people in one innovation ecosystem.
- Chat-first innovation management.
- From insight to initiative.
- Where corporate ideas become executable projects.

---

## 17. Ürün Modülleri İçin Görsel Yön

### AI Orkestratör

Sembol: merkezi düğüm + çevresel bağlantılar  
Renk: Blue / Violet  
Duygu: akıllı yönlendirme

### Fikir Yönetimi

Sembol: fikir kartı + bağlantı çizgisi  
Renk: Primary Blue  
Duygu: üretim ve katkı

### Araştırma Yönetimi

Sembol: doküman + anahtar kelime chipleri  
Renk: Cyan  
Duygu: bilgi ve kaynak

### 3D Mind Map

Sembol: node graph / küresel ağ  
Renk: Blue + Violet gradient  
Duygu: keşif ve ilişki

### İnovasyon Vitrini

Sembol: kart grid + rozet  
Renk: Blue / Navy  
Duygu: görünürlük ve seçki

### Topluluk

Sembol: yorum balonları + kullanıcılar  
Renk: Green / Cyan  
Duygu: katkı ve tartışma

### Proje Yönetimi

Sembol: roadmap / aşama çizgisi  
Renk: Violet  
Duygu: ilerleme ve uygulama

### Admin Paneli

Sembol: shield / settings / dashboard  
Renk: Slate / Navy  
Duygu: kontrol ve güven

---

## 18. Web Uygulama Ana Sayfa Yönü

### Header

- Solda think-Inn primary logo
- Sağda modüller: Fikirler, Araştırmalar, Projeler, Harita, Topluluk
- Sağ üstte kullanıcı / departman / bildirim alanı

### Ana Dashboard

- Sol: Chat-first üretim paneli
- Orta: Öne çıkan fikirler ve araştırmalar
- Sağ: AI önerileri, benzer fikir uyarıları, projeleşmeye hazır fikirler

### Ana CTA

**“Yeni fikrini anlat”**

Alternatif CTA’lar:

- Araştırma ekle
- Fikirleri keşfet
- İlişki haritasını aç
- Projeye dönüştür

---

## 19. Sunum ve Kurumsal Kullanım

### Sunum Kapakları

- Primary logo kullanılmalı
- Arka plan açık veya koyu lacivert olabilir
- Bağlantı/düğüm deseni hafif arka plan dokusu olarak kullanılabilir

### Doküman Kapakları

- Stacked logo daha uygun olabilir
- Altında kısa descriptor kullanılmalı
- Fazla renkli veya kalabalık görsellerden kaçınılmalı

### Ürün İçi Kullanım

- Sidebar’da favicon/app icon kullanılabilir
- Login ekranında stacked logo kullanılabilir
- Dashboard header’da primary logo kullanılabilir

---

## 20. Brand Guide Özeti

think-Inn markasının temel sistemi şudur:

- **think-**: düşünme, fikir üretme, keşif
- **Inn**: ekosistemin ortak çekirdeği ve -Inn ailesinin imzası
- **Altıgen**: yapı, sistem, güven, kapsayıcılık
- **Düğümler**: fikir, araştırma, proje, topluluk ve AI bağlantıları
- **Gradient**: teknolojik akış ve yapay zekâ katmanı
- **Chat-first yapı**: ürünün deneyim karakteri

Sonuç olarak think-Inn; teknik, kurumsal ve yaratıcı dengenin korunduğu, diğer -Inn ürünleriyle akraba ama kendi inovasyon ekosistemi karakterine sahip bir marka kimliği taşımalıdır.

