import express from "express";
import cors from "cors";
import whatsappRoutes from "./routes/whatsapp.routes.js";
import "dotenv/config";

const app = express();

app.use(cors());
app.use(express.json());

// 🔥 UNA sola entrada para WhatsApp
app.use("/", whatsappRoutes);
console.log("🔑 GEMINI_API_KEY =", process.env.GEMINI_API_KEY);

export default app;
// wahapsap
// EAALzWI4Xy9wBQgbOo6SImyDZCZCvhOOZC49jqotkqDy0h0lydVn0kD8ZBPJHBZCa1WQ1qRTbiDGjLg6JoaXfUpDzQD0PyoarwruRo3b5GkLBbvbr7uyNTEJclGQ4XeSSh6JcIWGNJ0CokI3utUzYYhS81yLjK0La6qLZBbgKnoGoMgSZCX1Y3PnKthNpF4ikwZDZD