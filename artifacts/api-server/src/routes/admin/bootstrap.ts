import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";

const router = Router();

const schema = z.object({
  secret: z.string(),
  username: z.string().min(3),
  displayName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});

router.post("/bootstrap-admin", async (req, res) => {
  const bootstrapSecret = process.env.BOOTSTRAP_SECRET;
  if (!bootstrapSecret) {
    return res.status(403).json({ success: false, error: "Bootstrap devre dışı." });
  }

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message });
  }

  const { secret, username, displayName, email, password } = parsed.data;

  if (secret !== bootstrapSecret) {
    return res.status(403).json({ success: false, error: "Geçersiz secret." });
  }

  const [{ total }] = await db
    .select({ total: count() })
    .from(usersTable)
    .where(eq(usersTable.role, "super_admin"));

  if (Number(total) > 0) {
    return res.status(409).json({ success: false, error: "Zaten bir super_admin var." });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const [user] = await db
    .insert(usersTable)
    .values({ username, displayName, email, passwordHash, role: "super_admin", isActive: true })
    .returning({ id: usersTable.id, email: usersTable.email, role: usersTable.role });

  return res.json({ success: true, data: user });
});

export default router;
