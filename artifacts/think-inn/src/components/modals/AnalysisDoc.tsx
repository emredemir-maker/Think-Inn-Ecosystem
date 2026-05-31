import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/* ════════════════════════════════════════════════════════════════════════
   AnalysisDoc — fonksiyonel/teknik analiz gibi uzun markdown metnini RENK-KODLU,
   bölümlü, taranabilir bir belge olarak render eder. md() düz çıktısının yerine.
   accent: bölüm vurgusu rengi (functional=mavi, technical=cyan, plan=mor).
   ════════════════════════════════════════════════════════════════════════ */

const ACCENTS: Record<string, string> = {
  blue: "#1463F3",
  cyan: "#0A8FA8",
  violet: "#7A5CFF",
  mint: "#0F8C66",
};

export default function AnalysisDoc({
  markdown,
  accent = "blue",
}: {
  markdown?: string | null;
  accent?: "blue" | "cyan" | "violet" | "mint";
}) {
  if (!markdown || !String(markdown).trim()) return null;
  const c = ACCENTS[accent] || ACCENTS.blue;
  return (
    <div className="analysis-doc" style={{ ["--ad" as any]: c }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (p) => <h3 className="ad-h1" {...p} />,
          h2: (p) => <h3 className="ad-h1" {...p} />,
          h3: (p) => <h4 className="ad-h2" {...p} />,
          h4: (p) => <h5 className="ad-h3" {...p} />,
          p: (p) => <p className="ad-p" {...p} />,
          ul: (p) => <ul className="ad-ul" {...p} />,
          ol: (p) => <ol className="ad-ol" {...p} />,
          li: (p) => <li className="ad-li" {...p} />,
          strong: (p) => <strong className="ad-strong" {...p} />,
          em: (p) => <em className="ad-em" {...p} />,
          blockquote: (p) => <blockquote className="ad-quote" {...p} />,
          code: (p) => <code className="ad-code" {...p} />,
          a: (p) => <a className="ad-a" target="_blank" rel="noreferrer" {...p} />,
          hr: () => <div className="ad-hr" />,
        }}
      >
        {String(markdown)}
      </ReactMarkdown>
    </div>
  );
}
