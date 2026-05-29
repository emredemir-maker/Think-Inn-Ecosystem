import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth-context";
import {
  Filter, UserPlus, Award, Heart, MessageCircle, Share2, ShieldAlert, Shield, Crown, User,
} from "lucide-react";

/* Referans "Topluluk" landing — üye leaderboard + tartışma feed + pulse.
 * Gerçek veriden türetilir: tüm space'lerin thread'leri çekilir, yazarlar
 * katkı sayısına göre sıralanır. Mevcut forum bunun ALTINDA aynen kalır. */

interface Space {
  id: number; name: string; slug: string; threadCount: number;
}
interface Thread {
  id: number; spaceId: number; title: string; body: string;
  replyCount: number; viewCount: number; lastActivityAt: string; createdAt: string;
  authorDisplayName: string; authorUsername: string; authorRole: string;
}

const ROLE_PILL: Record<string, { cls: string; label: string }> = {
  super_admin: { cls: "lead", label: "Lider" },
  moderator: { cls: "research", label: "Moderatör" },
  master: { cls: "design", label: "Master" },
  user: { cls: "eng", label: "Üye" },
};

function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return (p.length === 1 ? p[0].slice(0, 2) : p[0][0] + p[p.length - 1][0]).toUpperCase();
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "az önce";
  if (m < 60) return `${m} dk önce`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} saat önce`;
  const d = Math.floor(h / 24);
  return d === 1 ? "dün" : `${d} gün önce`;
}

const AV_COLORS = ["#1463F3", "#18C9E8", "#7A5CFF", "#20C997", "#F59E0B"];

export function CommunityOverview({ onOpenThread }: { onOpenThread?: (t: Thread) => void }) {
  // Tüm space'leri al
  const { data: spaces } = useQuery({
    queryKey: ["community-spaces"],
    queryFn: () => authFetch<Space[]>("/community/spaces"),
    staleTime: 60_000,
  });

  // Tüm space'lerin thread'lerini paralel çek
  const { data: allThreads } = useQuery({
    queryKey: ["community-all-threads", (spaces ?? []).map((s) => s.id).join(",")],
    queryFn: async () => {
      const list = spaces ?? [];
      const results = await Promise.all(
        list.map((s) =>
          authFetch<Thread[]>(`/community/spaces/${s.id}/threads`).catch(() => [] as Thread[])
        )
      );
      return results.flat();
    },
    enabled: (spaces?.length ?? 0) > 0,
    staleTime: 30_000,
  });

  const threads = allThreads ?? [];

  // Üye leaderboard — yazar bazında katkı (thread + reply sayısı), gerçek veri
  const members = useMemo(() => {
    const map = new Map<
      string,
      { name: string; username: string; role: string; contributions: number }
    >();
    for (const t of threads) {
      const key = t.authorUsername || t.authorDisplayName;
      const prev = map.get(key);
      const contrib = 1 + (t.replyCount ?? 0);
      if (prev) prev.contributions += contrib;
      else
        map.set(key, {
          name: t.authorDisplayName,
          username: t.authorUsername,
          role: t.authorRole,
          contributions: contrib,
        });
    }
    return Array.from(map.values()).sort((a, b) => b.contributions - a.contributions).slice(0, 6);
  }, [threads]);

  // Son tartışmalar — aktiviteye göre
  const recent = useMemo(
    () =>
      [...threads]
        .sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime())
        .slice(0, 5),
    [threads]
  );

  // Pulse — gerçek istatistik
  const totalThreads = threads.length;
  const totalReplies = threads.reduce((s, t) => s + (t.replyCount ?? 0), 0);
  const topMember = members[0];

  const roleIcon = (role: string) => {
    if (role === "super_admin") return <ShieldAlert size={14} className="text-primary" />;
    if (role === "moderator") return <Shield size={14} className="text-primary" />;
    if (role === "master") return <Crown size={14} className="text-secondary" />;
    return <User size={14} className="text-on-surface-variant" />;
  };

  return (
    <div className="px-10 pt-7">
      {/* Page head */}
      <div className="page-head">
        <div className="l">
          <span className="eyebrow">Ekosistem Topluluk</span>
          <h1>Topluluk</h1>
          <p>Ekosistemin canlı tarafı: kim ne katkı yapıyor, hangi konular tartışılıyor, kim hangi projeye dokunuyor.</p>
        </div>
        <div className="page-actions">
          <button className="icon-btn" aria-label="Filtre">
            <Filter size={16} />
          </button>
          <button className="flex items-center gap-2 rounded-full bg-primary px-[18px] py-2.5 text-[13px] font-semibold text-white shadow-[0_6px_18px_rgba(20,99,243,0.30)] transition-all hover:-translate-y-0.5 hover:bg-[#0e54d8]">
            <UserPlus size={16} />
            Üye Davet Et
          </button>
        </div>
      </div>

      {/* Grid: members+feed | pulse sidebar */}
      <div className="community-grid mt-4">
        <div className="flex flex-col gap-3.5">
          <div className="hub-card-title">Aktif Üyeler · {members.length}</div>
          {members.length > 0 ? (
            <div className="member-list">
              {members.map((m, idx) => {
                const pill = ROLE_PILL[m.role] ?? ROLE_PILL.user;
                return (
                  <div key={m.username || idx} className="member">
                    <div className="avatar" style={{ background: AV_COLORS[idx % AV_COLORS.length] }}>
                      {initials(m.name)}
                    </div>
                    <div>
                      <div className="name">{m.name}</div>
                      <div className="role-line flex items-center gap-1">
                        {roleIcon(m.role)} {pill.label}
                      </div>
                    </div>
                    <div className="contrib">
                      <b>{m.contributions}</b>
                      katkı
                    </div>
                    <span className={"role-pill " + pill.cls}>{pill.label}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="hub-empty">
              <div className="ico"><MessageCircle size={24} /></div>
              <div className="t">Henüz katkı yok</div>
              <div className="p">İçerik eklendikçe (araştırma/fikir/proje) topluluk thread'leri otomatik açılır ve katkı sahipleri burada sıralanır.</div>
            </div>
          )}

          {recent.length > 0 && (
            <>
              <div className="hub-card-title mt-4">Son tartışmalar</div>
              <div className="contrib-thread">
                {recent.map((t) => (
                  <div
                    key={t.id}
                    className="thread-msg cursor-pointer"
                    onClick={() => onOpenThread?.(t)}
                  >
                    <div className="h">
                      <div
                        className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold text-white"
                        style={{ background: "#1463F3", fontFamily: "Manrope, sans-serif" }}
                      >
                        {initials(t.authorDisplayName)}
                      </div>
                      <span className="name">{t.authorDisplayName}</span>
                      <span className="time">{timeAgo(t.lastActivityAt)}</span>
                    </div>
                    <div className="body line-clamp-2">{t.title}</div>
                    <div className="react">
                      <span><Heart size={14} />{t.viewCount ?? 0}</span>
                      <span><MessageCircle size={14} />{t.replyCount ?? 0}</span>
                      <span><Share2 size={14} />Paylaş</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Pulse sidebar */}
        <div className="flex flex-col gap-3.5">
          <div className="hub-card">
            <div className="hub-card-title mb-3.5">Bu hafta öne çıkan</div>
            {topMember ? (
              <div
                className="ai-insight"
                style={{ background: "linear-gradient(135deg, rgba(20,99,243,0.06), rgba(122,92,255,0.06))" }}
              >
                <div className="h flex items-center gap-2">
                  <Award size={16} className="text-primary" />
                  <span>{topMember.name}</span>
                </div>
                <div className="p">
                  {topMember.contributions} katkı ile haftanın en aktif üyesi. Topluluk tartışmalarını canlı tutuyor.
                </div>
              </div>
            ) : (
              <p className="text-[12px] text-on-surface-variant">Henüz öne çıkan üye yok.</p>
            )}
          </div>

          <div className="hub-card">
            <div className="hub-card-title mb-3.5">Topluluk pulse</div>
            <div className="flex flex-col gap-3">
              <div className="ai-insight" style={{ background: "rgba(34,197,94,0.06)", borderColor: "rgba(34,197,94,0.18)" }}>
                <div className="h">{totalThreads} tartışma · {totalReplies} yanıt</div>
                <div className="p">Ekosistemde toplam {totalThreads} aktif tartışma başlığı ve {totalReplies} yanıt var.</div>
              </div>
              <div className="ai-insight" style={{ background: "rgba(255,176,32,0.06)", borderColor: "rgba(255,176,32,0.18)" }}>
                <div className="h">{spaces?.length ?? 0} topluluk alanı</div>
                <div className="p">Araştırmalar, Fikirler ve Projeler için otomatik açılan thread'ler ilgili alanlarda toplanır.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
