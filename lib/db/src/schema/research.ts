import { pgTable, serial, text, integer, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const researchTable = pgTable("research", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  summary: text("summary").notNull().default(""),
  technicalAnalysis: text("technical_analysis").notNull().default(""),
  findings: text("findings").notNull().default(""),
  rawContent: text("raw_content").notNull().default(""),
  authorName: text("author_name").notNull(),
  coverImageB64: text("cover_image_b64"),
  coverImageMimeType: text("cover_image_mime_type"),
  tags: json("tags").$type<string[]>().notNull().default([]),
  relatedTo: json("related_to").$type<number[]>().notNull().default([]),
  voteCount: integer("vote_count").notNull().default(0),
  status: text("status", { enum: ["draft", "published", "archived"] }).notNull().default("published"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertResearchSchema = createInsertSchema(researchTable).omit({
  id: true,
  voteCount: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertResearch = z.infer<typeof insertResearchSchema>;
export type Research = typeof researchTable.$inferSelect;
