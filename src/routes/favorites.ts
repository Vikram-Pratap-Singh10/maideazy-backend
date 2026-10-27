import express from "express";
import { addFavoriteMaid, getFavoriteMaid, getFavoriteMaidByMaidId, getFavoriteMaidByUserId, removeFavoriteMaid } from "../controllers/favoriteController.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

router.use(authenticateToken);

router.post("/add", addFavoriteMaid);
router.post("/remove", removeFavoriteMaid);
router.get("/get-maids", getFavoriteMaid)
router.get("/get-maids-by-user/:id", getFavoriteMaidByUserId)
router.get("/get-maid-by-id/:maidId", getFavoriteMaidByMaidId)

export default router;