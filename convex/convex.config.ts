import { defineApp } from "convex/server";

const app = defineApp();
app.install(crons);

export default app;

import crons from "./crons";
