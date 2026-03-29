import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { SignJWT } from "jose";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authMiddleware, getJwtSecret } from "../middlewares/auth";

const router = Router();

const registerSchema = z.object({
  username: z
    .string()
    .min(3, "Kullanıcı adı en az 3 karakter olmalı")
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, "Sadece harf, rakam ve _ kullanılabilir"),
  displayName: z.string().min(2, "Ad en az 2 karakter olmalı").max(50),
  email: z.string().email("Geçerli bir e-posta adresi girin"),
  password: z.string().min(8, "Şifre en az 8 karakter olmalı"),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

async function signToken(userId: number, role: string) {
  return new SignJWT({ sub: String(userId), role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getJwtSecret());
}

// POST /api/auth/register
router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: parsed.error.issues[0]?.message ?? "Geçersiz veri",
    });
  }
  const { username, displayName, email, password } = parsed.data;

  const [existingEmail] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);
  if (existingEmail) {
    return res.status(409).json({ success: false, error: "Bu e-posta zaten kayıtlı" });
  }

  const [existingUsername] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.username, username))
    .limit(1);
  if (existingUsername) {
    return res.status(409).json({ success: false, error: "Bu kullanıcı adı alınmış" });
  }

  // First registered user becomes super_admin
  const [anyUser] = await db.select({ id: usersTable.id }).from(usersTable).limit(1);
  const role = anyUser ? ("user" as const) : ("super_admin" as const);

  const passwordHash = await bcrypt.hash(password, 12);
  const [user] = await db
    .insert(usersTable)
    .values({ username, displayName, email, passwordHash, role })
    .returning({
      id: usersTable.id,
      username: usersTable.username,
      displayName: usersTable.displayName,
      email: usersTable.email,
      role: usersTable.role,
      avatarUrl: usersTable.avatarUrl,
    });

  const token = await signToken(user.id, user.role);
  res.status(201).json({ success: true, data: { user, token } });
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: "Geçersiz giriş bilgileri" });
  }
  const { email, password } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);

  if (!user) {
    return res.status(401).json({ success: false, error: "E-posta veya şifre hatalı" });
  }
  if (!user.isActive) {
    return res.status(403).json({ success: false, error: "Hesabınız devre dışı bırakılmış" });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ success: false, error: "E-posta veya şifre hatalı" });
  }

  const token = await signToken(user.id, user.role);
  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
      token,
    },
  });
});

// GET /api/auth/me
router.get("/me", authMiddleware, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: "Oturum açılmamış" });
  }
  const [user] = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      displayName: usersTable.displayName,
      email: usersTable.email,
      role: usersTable.role,
      avatarUrl: usersTable.avatarUrl,
      bio: usersTable.bio,
      pageAccess: usersTable.pageAccess,
      createdAt: usersTable.createdAt,
      lastActiveAt: usersTable.lastActiveAt,
    })
    .from(usersTable)
    .where(eq(usersTable.id, req.user.id))
    .limit(1);

  res.json({ success: true, data: user });
});

// POST /api/auth/logout  (stateless — client drops the token)
router.post("/logout", (_req, res) => {
  res.json({ success: true });
});

export default router;
