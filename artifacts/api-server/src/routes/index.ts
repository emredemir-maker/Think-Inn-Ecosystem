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
import communityRouter from "./community/index";
import { authMiddleware } from "../middlewares/auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/gemini/conversations", geminiConversationsRouter);
router.use("/gemini", geminiImageRouter);
router.use("/research", researchRouter);
router.use("/ideas", ideasRouter);
router.use("/comments", commentsRouter);
router.use("/votes", votesRouter);
router.use("/diagrams", diagramsRouter);
router.use("/validate-connection", validateConnectionRouter);

// Auth
router.use("/auth", authRouter);

// User management (admin)
router.use("/admin/users", authMiddleware, adminUsersRouter);
router.use("/admin", backfillRouter);

// Community
router.use("/community", communityRouter);

export default router;
