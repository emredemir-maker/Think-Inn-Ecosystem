import { pgTable, serial, text, integer, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export interface DiagramNode {
  id: string;
  label: string;
  x: number;
  y: number;
  type: string;
}

export interface DiagramEdge {
  from: string;
  to: string;
  label?: string;
}

export const diagramsTable = pgTable("diagrams", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  type: text("type", { enum: ["flowchart", "hierarchy", "system", "custom"] }).notNull().default("flowchart"),
  svgData: text("svg_data").notNull().default(""),
  nodes: json("nodes").$type<DiagramNode[]>().notNull().default([]),
  edges: json("edges").$type<DiagramEdge[]>().notNull().default([]),
  relatedIdeaId: integer("related_idea_id"),
  relatedResearchId: integer("related_research_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDiagramSchema = createInsertSchema(diagramsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDiagram = z.infer<typeof insertDiagramSchema>;
export type Diagram = typeof diagramsTable.$inferSelect;
