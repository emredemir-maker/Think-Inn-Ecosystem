import { Router } from "express";
import { db } from "@workspace/db";
import { conversations as conversationsTable, messages as messagesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ai } from "@workspace/integrations-gemini-ai";

const router = Router();

const THINK_INN_SYSTEM_PROMPT = `Sen Think-Inn kurumsal inovasyon ekosistemi orkestratör ajanısın. Türkçe konuşuyorsun.

Görevin:
1. Kullanıcının mesajını analiz et ve niyetini belirle
2. İlgili iş akışını başlat

INTENT TÜRLERİ:
- RESEARCH: Araştırma/makale ekleme veya düzenleme
- IDEA: Yeni fikir girişi veya mevcut fikir güncelleme  
- SEARCH: Araştırma veya fikir arama
- DIAGRAM: Diyagram oluşturma veya güncelleme
- ADMIN: Yönetim işlemleri (fikir birleştirme, arşivleme)
- GENERAL: Genel soru veya bilgi talebi

ARAŞTIRMA İŞ AKIŞI:
- Kullanıcı ham metin paylaşırsa, onu şu formata dönüştür:
  [BAŞLIK]: Makale başlığı
  [ÖZET]: Kısa özet
  [TEKNİK ANALİZ]: Teknik detaylar
  [BULGULAR]: Ana bulgular ve sonuçlar
- Ardından makale kaydedilip kapak görseli oluşturulacak

FİKİR DOĞRULAMA KURALLARI (ÇOK ÖNEMLİ):
- Her yeni fikir için önce benzerlik kontrolü yapılmalı
- Fikrin dayandığı araştırma ZORUNLU - araştırma yoksa fikir kaydedilmez
- Araştırma dayanağı yoksa: kullanıcıya araştırılması gereken konuların listesini (roadmap) ver
- Benzer fikir varsa: "Zaten [X] fikri mevcut. Sahibi [Y] ile iletişime geçmek ister misin?" de

YANIT STİLİ:
- Doğrudan, profesyonel ve yardımsever ol
- Gerekli adımları açıkça belirt
- Kullanıcıyı bir sonraki adım için yönlendir`;

router.get("/", async (req, res) => {
  try {
    const conversations = await db
      .select()
      .from(conversationsTable)
      .orderBy(conversationsTable.createdAt);
    res.json(conversations);
  } catch (err) {
    req.log.error({ err }, "Failed to list conversations");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { title } = req.body;
    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }
    const [conversation] = await db
      .insert(conversationsTable)
      .values({ title })
      .returning();
    res.status(201).json(conversation);
  } catch (err) {
    req.log.error({ err }, "Failed to create conversation");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [conversation] = await db
      .select()
      .from(conversationsTable)
      .where(eq(conversationsTable.id, id));

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const messages = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, id))
      .orderBy(messagesTable.createdAt);

    res.json({ ...conversation, messages });
  } catch (err) {
    req.log.error({ err }, "Failed to get conversation");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [deleted] = await db
      .delete(conversationsTable)
      .where(eq(conversationsTable.id, id))
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: "Conversation not found" });
    }
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete conversation");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id/messages", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const messages = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, id))
      .orderBy(messagesTable.createdAt);
    res.json(messages);
  } catch (err) {
    req.log.error({ err }, "Failed to list messages");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/messages", async (req, res) => {
  try {
    const conversationId = parseInt(req.params.id);
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: "Content is required" });
    }

    const [conversation] = await db
      .select()
      .from(conversationsTable)
      .where(eq(conversationsTable.id, conversationId));

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    await db.insert(messagesTable).values({
      conversationId,
      role: "user",
      content,
    });

    const allMessages = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, conversationId))
      .orderBy(messagesTable.createdAt);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let fullResponse = "";

    const chatMessages = [
      {
        role: "user" as const,
        parts: [{ text: THINK_INN_SYSTEM_PROMPT }],
      },
      ...allMessages.map((m) => ({
        role: (m.role === "assistant" ? "model" : "user") as "user" | "model",
        parts: [{ text: m.content }],
      })),
    ];

    const stream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: chatMessages,
      config: { maxOutputTokens: 8192 },
    });

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
        fullResponse += text;
        res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
      }
    }

    await db.insert(messagesTable).values({
      conversationId,
      role: "assistant",
      content: fullResponse,
    });

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    req.log.error({ err }, "Failed to send message");
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    } else {
      res.write(`data: ${JSON.stringify({ error: "Stream error" })}\n\n`);
      res.end();
    }
  }
});

export default router;
