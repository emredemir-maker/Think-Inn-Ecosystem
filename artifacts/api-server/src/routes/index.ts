import { Router, type IRouter } from "express";
import healthRouter from "./health";
import geminiConversationsRouter from "./gemini/conversations";
import geminiImageRouter from "./gemini/image";
import researchRouter from "./research";
import ideasRouter from "./ideas";
import commentsRouter from "./comments";
import votesRouter from "./votes";
import diagramsRouter from "./diagrams";
import validateConnectionRouter from "./validate-connection";
import authRouter from "./auth";
import adminUsersRouter from "./admin/users";
import backfillRouter from "./admin/backfill";
import bootstrapRouter from "./admin/bootstrap";
import departmentsRouter from "./admin/departments";
import communityRouter from "./community/index";
import { authMiddleware } from "../middlewares/auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/gemini/conversations", geminiConversationsRouter);
router.use("/gemini", geminiImageRouter);
// authMiddleware OPSİYONEL: girişliyse req.user dolar, değilse devam.
// GET handler'ları buna göre korumalı alanları (FA/teknik/skor) gizler (public vizyon).
router.use("/research", authMiddleware, researchRouter);
router.use("/ideas", authMiddleware, ideasRouter);
router.use("/comments", commentsRouter);
router.use("/votes", votesRouter);
router.use("/diagrams", diagramsRouter);
router.use("/validate-connection", validateConnectionRouter);

// Auth
router.use("/auth", authRouter);
router.use("/auth", bootstrapRouter);

// User management (admin)
router.use("/admin/users", authMiddleware, adminUsersRouter);
router.use("/admin/departments", authMiddleware, departmentsRouter);
router.use("/departments", departmentsRouter);
router.use("/admin", backfillRouter);

// Community
router.use("/community", communityRouter);

export default router;
