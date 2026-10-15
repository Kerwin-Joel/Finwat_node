import express from "express";
import cors from "cors";
import whatsappRoutes from "./routes/whatsapp.routes.js";
import "dotenv/config";

const app = express();

app.use(cors());
app.use(express.json());

// 🔥 UNA sola entrada para WhatsApp
app.use("/", whatsappRoutes);

export default app;
