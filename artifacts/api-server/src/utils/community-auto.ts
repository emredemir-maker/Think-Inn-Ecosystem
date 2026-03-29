/**
 * Automatically creates community spaces and threads when ideas / research are added.
 *
 * – Ensures "Fikirler" and "Araştırmalar" spaces exist (idempotent).
 * – Ensures a "Think-Inn Bot" system user exists to author these threads (idempotent).
 * – Creates one thread per idea / research, linked via linkedIdeaId / linkedResearchId.
 *   Subsequent calls for the same entity are no-ops.
 */

import { db } from "@workspace/db";
import {
  usersTable,
  communitySpacesTable,
  communityThreadsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";

// ── System user ──────────────────────────────────────────────────────────────

let systemUserId: number | null = null;

async function getSystemUserId(): Promise<number> {
  if (systemUserId) return systemUserId;

  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.username, "think_inn_bot"))
    .limit(1);

  if (existing) {
    systemUserId = existing.id;
    return systemUserId;
  }

  // Create system bot user (role = master so it can create spaces)
  const passwordHash = await bcrypt.hash(crypto.randomUUID(), 12);
  const [created] = await db
    .insert(usersTable)
    .values({
      username: "think_inn_bot",
      displayName: "Think-Inn Bot",
      email: "bot@think-inn.internal",
      passwordHash,
      role: "master",
      isActive: true,
    })
    .returning({ id: usersTable.id });

  systemUserId = created.id;
  return systemUserId;
}

// ── Space helpers ─────────────────────────────────────────────────────────────

const spaceIdCache: Record<string, number> = {};

async function getOrCreateSpace(
  slug: string,
  name: string,
  color: string,
  icon: string,
  botId: number,
): Promise<number> {
  if (spaceIdCache[slug]) return spaceIdCache[slug];

  const [existing] = await db
    .select({ id: communitySpacesTable.id })
    .from(communitySpacesTable)
    .where(eq(communitySpacesTable.slug, slug))
    .limit(1);

  if (existing) {
    spaceIdCache[slug] = existing.id;
    return existing.id;
  }

  const [created] = await db
    .insert(communitySpacesTable)
    .values({ slug, name, color, icon, createdBy: botId, description: "" })
    .returning({ id: communitySpacesTable.id });

  spaceIdCache[slug] = created.id;
  return created.id;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function autoCreateIdeaThread(idea: {
  id: number;
  title: string;
  description: string;
}): Promise<void> {
  try {
    // No-op if thread already exists
    const [existing] = await db
      .select({ id: communityThreadsTable.id })
      .from(communityThreadsTable)
      .where(eq(communityThreadsTable.linkedIdeaId, idea.id))
      .limit(1);
    if (existing) return;

    const botId = await getSystemUserId();
    const spaceId = await getOrCreateSpace(
      "fikirler",
      "Fikirler",
      "#6366f1",
      "Lightbulb",
      botId,
    );

    await db.insert(communityThreadsTable).values({
      spaceId,
      authorId: botId,
      title: idea.title,
      body: idea.description
        ? idea.description.slice(0, 500) + (idea.description.length > 500 ? "…" : "")
        : "",
      linkedIdeaId: idea.id,
    });

    // Bump space thread count
    db.update(communitySpacesTable)
      .set({ threadCount: sql`${communitySpacesTable.threadCount} + 1`, updatedAt: new Date() })
      .where(eq(communitySpacesTable.id, spaceId))
      .catch(() => {});
  } catch {
    // Non-blocking — never crash the main request
  }
}

export async function autoCreateResearchThread(research: {
  id: number;
  title: string;
  summary: string;
}): Promise<void> {
  try {
    const [existing] = await db
      .select({ id: communityThreadsTable.id })
      .from(communityThreadsTable)
      .where(eq(communityThreadsTable.linkedResearchId, research.id))
      .limit(1);
    if (existing) return;

    const botId = await getSystemUserId();
    const spaceId = await getOrCreateSpace(
      "arastirmalar",
      "Araştırmalar",
      "#34d399",
      "BookOpen",
      botId,
    );

    await db.insert(communityThreadsTable).values({
      spaceId,
      authorId: botId,
      title: research.title,
      body: research.summary
        ? research.summary.slice(0, 500) + (research.summary.length > 500 ? "…" : "")
        : "",
      linkedResearchId: research.id,
    });

    db.update(communitySpacesTable)
      .set({ threadCount: sql`${communitySpacesTable.threadCount} + 1`, updatedAt: new Date() })
      .where(eq(communitySpacesTable.id, spaceId))
      .catch(() => {});
  } catch {
    // Non-blocking
  }
}
