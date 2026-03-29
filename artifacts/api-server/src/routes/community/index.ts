import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth";
import spacesRouter from "./spaces";
import threadsRouter from "./threads";
import postsRouter from "./posts";

const router = Router();

// Attach user to request for all community routes (optional auth)
router.use(authMiddleware);

router.use("/spaces", spacesRouter);
router.use("/", threadsRouter);
router.use("/", postsRouter);

export default router;
