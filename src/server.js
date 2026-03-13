import dotenv from "dotenv";
import { startScheduler } from './services/scheduler.service.js';
dotenv.config();

import app from "./app.js";

const PORT = process.env.PORT || 3000;

startScheduler();
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});