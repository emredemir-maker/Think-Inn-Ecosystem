import {
  UserPlus, LogIn, Upload, Database, Sparkles, Search,
  MousePointerClick, GitMerge, Share2, Send, BarChart3, FileText, Bell,
  CreditCard, MessageCircle, Activity, Eye, CheckCircle2, Wand2, User,
  Settings, Rocket, Target, ListChecks,
} from "lucide-react";

/**
 * UsageFlow — fikrin "Kullanım Akışı": son kullanıcının ürünü nasıl kullandığını anlatan
 * KÜÇÜK İNFOGRAFİK. Her adıma metnine göre anlamlı bir ikon + marka rengi atanır, adımlar
 * oklarla soldan sağa bağlanır. Sistem mimarisi DEĞİL — kullanıcı gözünden 3-5 adım.
 * Veri: idea.roadmap (kullanım akışı adımları, gerçek/AI).
 */

// Adım metnindeki anahtar kelimeye göre ikon (ilk eşleşen kazanır)
const STEP_ICONS: Array<{ re: RegExp; Icon: any }> = [
  { re: /(kaydol|üye ol|hesap aç|kayıt)/i, Icon: UserPlus },
  { re: /(giriş|oturum|login)/i, Icon: LogIn },
  { re: /(yükle|içe aktar|import|veri gir|ekle)/i, Icon: Upload },
  { re: /(veri|tablo|depola|kaydet)/i, Icon: Database },
  { re: /(ai|yapay zeka|öneri|öner|analiz|değerlendir|akıllı|tahmin|otomatik)/i, Icon: Sparkles },
  { re: /(ara|arama|keşfet|bul|filtre|sorgu)/i, Icon: Search },
  { re: /(seç|işaretle|tıkla|belirle)/i, Icon: MousePointerClick },
  { re: /(eşleştir|bağla|ilişkilendir|entegre)/i, Icon: GitMerge },
  { re: /(paylaş|yayınla)/i, Icon: Share2 },
  { re: /(gönder|ilet)/i, Icon: Send },
  { re: /(rapor|sonuç|çıktı|özet|skor|grafik)/i, Icon: BarChart3 },
  { re: /(belge|doküman|metin|içerik|form|cv)/i, Icon: FileText },
  { re: /(bildirim|uyarı|hatırlat)/i, Icon: Bell },
  { re: /(öde|satın|fatura|ücret|abonelik)/i, Icon: CreditCard },
  { re: /(sohbet|chat|konuş|yorum|mesaj|mülakat)/i, Icon: MessageCircle },
  { re: /(takip|izle|gözlem|monitör)/i, Icon: Activity },
  { re: /(görüntüle|incele|gör)/i, Icon: Eye },
  { re: /(onayla|doğrula|tamamla|kabul)/i, Icon: CheckCircle2 },
  { re: /(oluştur|üret|hazırla|yarat|tasarla)/i, Icon: Wand2 },
  { re: /(profil|kullanıcı|aday|hesap)/i, Icon: User },
  { re: /(ayar|yapılandır|kur)/i, Icon: Settings },
  { re: /(başla|lansman|yayın)/i, Icon: Rocket },
  { re: /(hedef|amaç|öncelik)/i, Icon: Target },
];
function stepIcon(text: string) {
  for (const { re, Icon } of STEP_ICONS) if (re.test(text)) return Icon;
  return ListChecks;
}

export default function UsageFlow({ steps }: { steps: string[] }) {
  if (!steps?.length) return null;
  return (
    <div className="usage-flow">
      <div className="uf-deco" aria-hidden />
      <div className="uf-sub">Kullanıcı gözünden uçtan uca akış</div>
      <div className="uf-track">
        {steps.map((s, i) => {
          const Ic = stepIcon(s);
          const last = i === steps.length - 1; // son aşama = çıktı/onay → yeşil vurgu
          return (
            <div className={"uf-step" + (last ? " final" : "")} key={i}>
              <span className="uf-num">{i + 1}</span>
              <div className="uf-ic"><Ic size={30} strokeWidth={1.9} /></div>
              <div className="uf-text">{s}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
