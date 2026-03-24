import { pgTable, serial, text, integer, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ideasTable = pgTable("ideas", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  authorName: text("author_name").notNull(),
  collaborators: json("collaborators").$type<string[]>().notNull().default([]),
  researchIds: json("research_ids").$type<number[]>().notNull().default([]),
  relatedTo: json("related_to").$type<number[]>().notNull().default([]),
  tags: json("tags").$type<string[]>().notNull().default([]),
  voteCount: integer("vote_count").notNull().default(0),
  status: text("status", { enum: ["draft", "active", "merged", "prototype", "archived"] }).notNull().default("active"),
  masterIdeaId: integer("master_idea_id"),
  roadmap: json("roadmap").$type<string[]>().notNull().default([]),
  neededResearchTopics: json("needed_research_topics").$type<string[]>().notNull().default([]),
  optionalResearchTopics: json("optional_research_topics").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertIdeaSchema = createInsertSchema(ideasTable).omit({
  id: true,
  voteCount: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertIdea = z.infer<typeof insertIdeaSchema>;
export type Idea = typeof ideasTable.$inferSelect;
