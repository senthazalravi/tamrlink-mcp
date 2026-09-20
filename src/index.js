#!/usr/bin/env node
/**
 * TamrLink MCP server
 * Tools: catalog, RFQ, AI-style matching, offers, orders, logistics.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as engine from "./engine.js";

function text(obj) {
  return { content: [{ type: "text", text: JSON.stringify(obj, null, 2) }] };
}

function createServer() {
  const server = new McpServer({
    name: "tamrlink",
    version: "0.1.0",
  });

  server.tool(
    "tamrlink_catalog_summary",
    "Overview of seeded suppliers, lots, open RFQs and orders on TamrLink.",
    {},
    async () => text(engine.catalogSummary())
  );

  server.tool(
    "tamrlink_list_suppliers",
    "List verified demo suppliers. Filter by variety, country (SA/AE), type (producer|factory|wholesaler|exporter|distributor), minRating.",
    {
      variety: z.string().optional().describe("Date variety, e.g. Ajwa, Sukkari"),
      country: z.string().optional().describe("ISO country code, e.g. SA"),
      type: z.enum(["producer", "factory", "wholesaler", "exporter", "distributor"]).optional(),
      minRating: z.number().optional(),
    },
    async (args) => text(engine.listSuppliers(args))
  );

  server.tool(
    "tamrlink_list_lots",
    "Search available date lots with supplier attached.",
    {
      variety: z.string().optional(),
      minKg: z.number().optional(),
      maxPriceUsdPerKg: z.number().optional(),
      grade: z.string().optional(),
    },
    async (args) => text(engine.listLots(args))
  );

  server.tool(
    "tamrlink_post_rfq",
    "Post a B2B buyer requirement (minimum order). Example: 10 tons Ajwa to Sweden.",
    {
      variety: z.string().describe("Variety or 'any'"),
      quantityKg: z.number().describe("Quantity in kilograms (B2B, typically >= 250)"),
      destination: z.string().describe("City/country, e.g. Gothenburg, Sweden"),
      destinationRegion: z.string().optional().describe("EU | US | GCC | IN | SEA"),
      grade: z.string().optional(),
      maxPriceUsdPerKg: z.number().optional(),
      buyer: z.string().optional(),
      notes: z.string().optional(),
    },
    async (args) => text(engine.createRfq(args))
  );

  server.tool(
    "tamrlink_match_rfq",
    "Match an RFQ to suppliers/lots and generate offers with a fit score.",
    {
      rfqId: z.string(),
      limit: z.number().optional(),
    },
    async (args) => text(engine.matchRfq(args.rfqId, { limit: args.limit || 5 }))
  );

  server.tool(
    "tamrlink_list_offers",
    "List generated offers for an RFQ.",
    { rfqId: z.string() },
    async (args) => text(engine.getOffers(args.rfqId))
  );

  server.tool(
    "tamrlink_place_order",
    "Accept an offer and create an order (pending payment + export steps).",
    {
      offerId: z.string(),
      buyer: z.string().optional(),
      incoterm: z.string().optional().describe("e.g. FOB Jeddah, CIF Gothenburg"),
    },
    async (args) => text(engine.placeOrder(args))
  );

  server.tool(
    "tamrlink_suggest_logistics",
    "Attach freight, warehouse and customs partners to an order.",
    { orderId: z.string() },
    async (args) => text(engine.suggestLogistics(args.orderId))
  );

  server.tool(
    "tamrlink_list_rfqs",
    "List all RFQs posted in this session.",
    {},
    async () => text(engine.listRfqs())
  );

  return server;
}

async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("TamrLink MCP server running on stdio");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
