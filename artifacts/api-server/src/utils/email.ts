import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const PLATFORM_URL = process.env.PLATFORM_URL || "https://think-inn-ecosystem.replit.app";
// Default: Resend's shared test sender (no domain verification needed)
// To use your own domain: set RESEND_FROM_EMAIL env var after verifying domain on resend.com
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Think-Inn <onboarding@resend.dev>";

export async function sendInvitationEmail(opts: {
  to: string;
  displayName: string;
  username: string;
  temporaryPassword: string;
  role: string;
}) {
  const roleLabels: Record<string, string> = {
    super_admin: "Süper Yönetici",
    moderator: "Moderatör",
    master: "Uzman",
    user: "Kullanıcı",
  };
  const roleLabel = roleLabels[opts.role] || opts.role;

  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Think-Inn Davet</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);padding:36px 40px;text-align:center;">
              <div style="display:inline-flex;align-items:center;gap:10px;">
                <span style="font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">Think-Inn</span>
                <span style="font-size:10px;font-weight:700;color:#c4b5fd;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.2);padding:3px 8px;border-radius:20px;letter-spacing:1px;text-transform:uppercase;">Beta</span>
              </div>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.75);font-size:13px;">Kurumsal İnovasyon Ekosistemi</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 20px;font-size:22px;font-weight:700;color:#0f172a;">Hoş Geldiniz, ${opts.displayName}! 👋</p>
              <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.7;">
                Think-Inn kurumsal inovasyon platformuna davet edildiniz. Aşağıdaki bilgilerle giriş yapabilir ve fikir üretimine katkıda bulunmaya başlayabilirsiniz.
              </p>

              <!-- Credentials box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin:24px 0;">
                <tr>
                  <td style="padding:24px 28px;">
                    <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#94a3b8;letter-spacing:1px;text-transform:uppercase;">Rolünüz</p>
                    <p style="margin:0 0 20px;font-size:15px;font-weight:600;color:#4f46e5;">${roleLabel}</p>

                    <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#94a3b8;letter-spacing:1px;text-transform:uppercase;">Kullanıcı Adı</p>
                    <p style="margin:0 0 20px;font-size:16px;font-weight:700;color:#0f172a;font-family:monospace;">${opts.username}</p>

                    <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#94a3b8;letter-spacing:1px;text-transform:uppercase;">Geçici Şifre</p>
                    <p style="margin:0;font-size:16px;font-weight:700;color:#0f172a;font-family:monospace;background:#fff;border:1px dashed #cbd5e1;border-radius:6px;padding:8px 12px;display:inline-block;">${opts.temporaryPassword}</p>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 24px;">
                    <a href="${PLATFORM_URL}" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 40px;border-radius:8px;letter-spacing:0.3px;">
                      Platforma Giriş Yap →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.6;text-align:center;">
                Güvenliğiniz için lütfen ilk girişinizde şifrenizi değiştirin.<br/>
                Sorun yaşarsanız yöneticinizle iletişime geçin.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94a3b8;">
                Bu e-posta Think-Inn tarafından otomatik gönderilmiştir.<br/>
                <a href="${PLATFORM_URL}" style="color:#4f46e5;text-decoration:none;">think-inn-ecosystem.replit.app</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: opts.to,
    subject: "Think-Inn Platformuna Davet Edildiniz",
    html,
  });

  if (error) {
    console.error("[Email] Davet maili gönderilemedi:", error);
    throw error;
  }

  console.log(`[Email] Davet maili gönderildi: ${opts.to} (id: ${data?.id})`);
  return data;
}
