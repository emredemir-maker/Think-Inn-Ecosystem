/**
 * buildGraph.js — Üç katmanlı bilgi grafiğini ForceGraph3D formatına dönüştürür.
 *
 *   Araştırmalar → Fikirler → Projeler   (her iki bağlantı katmanı da many-to-many)
 *
 * Köprü tabloları (bridge tables) ilişkileri taşır:
 *   ideaResearch: bir fikir BİR VEYA BİRDEN FAZLA araştırmadan beslenir,
 *                 bir araştırma BİR VEYA BİRDEN FAZLA fikre bağlanır.
 *   projectIdea:  bir fikir BİR VEYA BİRDEN FAZLA projeye bağlanır,
 *                 bir proje BİR VEYA BİRDEN FAZLA fikirden doğabilir.
 *
 * Düğüm id'leri çakışmasın diye prefix kullanılır: 'r-', 'i-', 'p-'.
 */

/** Düğüm tipine göre sabit prefix */
export const PREFIX = {
  research: "r-",
  idea: "i-",
  project: "p-",
};

/**
 * @param {Object} input
 * @param {Array<{id:number|string, title:string}>} input.researches
 * @param {Array<{id:number|string, title:string}>} input.ideas
 * @param {Array<{id:number|string, title:string}>} input.projects
 * @param {Array<{ideaId:number|string, researchId:number|string}>} input.ideaResearch
 * @param {Array<{projectId:number|string, ideaId:number|string}>} input.projectIdea
 * @returns {{ nodes: Array, links: Array }}
 */
export function buildGraph({
  researches = [],
  ideas = [],
  projects = [],
  ideaResearch = [],
  projectIdea = [],
} = {}) {
  // 1) Bağlantı sayacı — her düğümün kaç bağlantısı var (val = boyut)
  const degree = new Map();
  const bump = (id) => degree.set(id, (degree.get(id) || 0) + 1);

  // 2) Link listesi — id'ler prefix'li
  const links = [];

  // ideaResearch köprüsü → research → idea yönünde kenar
  for (const { ideaId, researchId } of ideaResearch) {
    const source = PREFIX.research + researchId; // araştırma kaynak
    const target = PREFIX.idea + ideaId; // fikir hedef
    links.push({ source, target });
    bump(source);
    bump(target);
  }

  // projectIdea köprüsü → idea → project yönünde kenar
  for (const { projectId, ideaId } of projectIdea) {
    const source = PREFIX.idea + ideaId; // fikir kaynak
    const target = PREFIX.project + projectId; // proje hedef
    links.push({ source, target });
    bump(source);
    bump(target);
  }

  // 3) Düğümler — her katman kendi tipini ve prefix'li id'sini alır.
  //    val: bağlantı sayısına göre boyut (en az 1, çok bağlı düğüm daha büyük).
  const mkNode = (item, type) => {
    const id = PREFIX[type] + item.id;
    return {
      id,
      name: item.title ?? item.name ?? String(item.id),
      type,
      val: Math.max(1, degree.get(id) || 0),
      // Orijinal kaydı detay panelinde göstermek için sakla (ham veri)
      raw: item,
    };
  };

  const nodes = [
    ...researches.map((r) => mkNode(r, "research")),
    ...ideas.map((i) => mkNode(i, "idea")),
    ...projects.map((p) => mkNode(p, "project")),
  ];

  return { nodes, links };
}

/**
 * Bir düğümün doğrudan komşularını (id seti) ve ona değen linkleri döndürür.
 * Komşu vurgulama (highlight) için kullanılır — seçili düğüm + komşuları parlak,
 * gerisi soluk.
 *
 * @param {string} nodeId  prefix'li düğüm id'si
 * @param {Array} links    graph link listesi (source/target obje VEYA string olabilir)
 */
export function neighborsOf(nodeId, links) {
  const neighborIds = new Set([nodeId]);
  const linkKeys = new Set();
  for (const l of links) {
    // ForceGraph çalışırken source/target'ı obje'ye çevirir; her iki durumu da karşıla
    const s = typeof l.source === "object" ? l.source.id : l.source;
    const t = typeof l.target === "object" ? l.target.id : l.target;
    if (s === nodeId || t === nodeId) {
      neighborIds.add(s);
      neighborIds.add(t);
      linkKeys.add(`${s}->${t}`);
    }
  }
  return { neighborIds, linkKeys };
}
