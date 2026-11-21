import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { z } from "zod";
import { supabase } from "./supabase.js";

const app = express();
app.use(helmet());
app.use(cors({ origin: (process.env.CLIENT_ORIGIN ?? "http://localhost:5173").split(","), credentials: true }));
app.use(express.json({ limit: "32kb" }));

app.get("/health", (_req, res) => res.json({ ok: true, service: "stocksim-api" }));

async function requireUser(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = req.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Authentication required" });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return res.status(401).json({ error: "Invalid session" });
  res.locals.user = data.user;
  next();
}

app.get("/api/market", async (_req, res) => {
  const { data, error } = await supabase.from("stocks").select("symbol,name,price,change_percent,updated_at").eq("is_active", true).order("symbol");
  if (error) return res.status(500).json({ error: error.message });
  res.json({ stocks: data });
});

app.get("/api/portfolio", requireUser, async (_req, res) => {
  const { data, error } = await supabase.rpc("get_portfolio", { p_user_id: res.locals.user.id });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ portfolio: data ?? [] });
});

app.get("/api/orders", requireUser, async (_req, res) => {
  const { data, error } = await supabase.from("orders").select("id,symbol,side,quantity,price,fee,status,created_at").order("created_at", { ascending: false }).limit(100);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ orders: data });
});

const orderSchema = z.object({
  symbol: z.string().trim().toUpperCase().regex(/^[A-Z0-9.]{1,12}$/),
  side: z.enum(["buy", "sell"]),
  quantity: z.number().int().min(1).max(100000)
});

app.post("/api/orders", requireUser, async (req, res) => {
  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid order", details: parsed.error.flatten() });
  const { data, error } = await supabase.rpc("place_market_order", {
    p_symbol: parsed.data.symbol, p_side: parsed.data.side,
    p_quantity: parsed.data.quantity, p_user_id: res.locals.user.id
  });
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json({ order: data });
});

app.get("/api/account", requireUser, async (_req, res) => {
  const { data, error } = await supabase.from("profiles").select("id,display_name,cash_balance,created_at").eq("id", res.locals.user.id).single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ account: data });
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => console.log(`StockSim API listening on :${port}`));
