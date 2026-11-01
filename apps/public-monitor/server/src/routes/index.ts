import { Router, type IRouter } from "express";
import healthRouter from "./health";
import publicMonitorRouter from "./public-monitor";

const router: IRouter = Router();

router.use(healthRouter);
router.use(publicMonitorRouter);

export default router;
