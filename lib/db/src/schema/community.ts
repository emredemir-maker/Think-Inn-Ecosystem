import { pgTable, serial, text, boolean, timestamp, integer, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { ideasTable } from "./ideas";
import { researchTable } from "./research";

export const communitySpacesTable = pgTable("community_spaces", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull().default(""),
  icon: text("icon"),
  color: text("color"),
  isArchived: boolean("is_archived").notNull().default(false),
  threadCount: integer("thread_count").notNull().default(0),
  createdBy: integer("created_by").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const communityThreadsTable = pgTable("community_threads", {
  id: serial("id").primaryKey(),
  spaceId: integer("space_id").notNull().references(() => communitySpacesTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  authorId: integer("author_id").notNull().references(() => usersTable.id),
  isPinned: boolean("is_pinned").notNull().default(false),
  isLocked: boolean("is_locked").notNull().default(false),
  isFeatured: boolean("is_featured").notNull().default(false),
  isHidden: boolean("is_hidden").notNull().default(false),
  linkedIdeaId: integer("linked_idea_id").references(() => ideasTable.id, { onDelete: "set null" }),
  linkedResearchId: integer("linked_research_id").references(() => researchTable.id, { onDelete: "set null" }),
  replyCount: integer("reply_count").notNull().default(0),
  viewCount: integer("view_count").notNull().default(0),
  lastActivityAt: timestamp("last_activity_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const communityPostsTable = pgTable("community_posts", {
  id: serial("id").primaryKey(),
  threadId: integer("thread_id").notNull().references(() => communityThreadsTable.id, { onDelete: "cascade" }),
  authorId: integer("author_id").notNull().references(() => usersTable.id),
  content: text("content").notNull(),
  parentPostId: integer("parent_post_id"),
  isHidden: boolean("is_hidden").notNull().default(false),
  isSolution: boolean("is_solution").notNull().default(false),
  reactionCount: integer("reaction_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const communityReactionsTable = pgTable("community_reactions", {
  id: serial("id").primaryKey(),
  targetType: text("target_type", { enum: ["thread", "post"] }).notNull(),
  targetId: integer("target_id").notNull(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  emoji: text("emoji").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  unique("uq_reaction").on(table.targetType, table.targetId, table.userId, table.emoji),
]);

export const moderationActionsTable = pgTable("moderation_actions", {
  id: serial("id").primaryKey(),
  actorId: integer("actor_id").notNull().references(() => usersTable.id),
  targetType: text("target_type", { enum: ["thread", "post", "user"] }).notNull(),
  targetId: integer("target_id").notNull(),
  action: text("action", { enum: ["pin", "unpin", "hide", "unhide", "delete", "lock", "unlock", "warn", "feature", "unfeature"] }).notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type CommunitySpace = typeof communitySpacesTable.$inferSelect;
export type CommunityThread = typeof communityThreadsTable.$inferSelect;
export type CommunityPost = typeof communityPostsTable.$inferSelect;
export type CommunityReaction = typeof communityReactionsTable.$inferSelect;
export type ModerationAction = typeof moderationActionsTable.$inferSelect;
