import { Router, type IRouter } from "express";
import healthRouter from "./health";
import geminiConversationsRouter from "./gemini/conversations";
import geminiImageRouter from "./gemini/image";
import researchRouter from "./research";
import ideasRouter from "./ideas";
import commentsRouter from "./comments";
import votesRouter from "./votes";
import diagramsRouter from "./diagrams";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/gemini/conversations", geminiConversationsRouter);
router.use("/gemini", geminiImageRouter);
router.use("/research", researchRouter);
router.use("/ideas", ideasRouter);
router.use("/comments", commentsRouter);
router.use("/votes", votesRouter);
router.use("/diagrams", diagramsRouter);

export default router;
