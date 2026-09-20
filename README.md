# TamrLink MCP

Model Context Protocol server for the **TamrLink** B2B dates marketplace.

Flow the tools implement:

`Buyer RFQ → match lots/suppliers → offers → order → logistics partners`

Seed data is **demo inventory** inspired by real Saudi origins (Madinah, Qassim, Al-Ahsa). It is not an official supplier roster.

## Tools

| Tool | What it does |
| --- | --- |
| `tamrlink_catalog_summary` | Counts of suppliers, lots, RFQs |
| `tamrlink_list_suppliers` | Filter factories / farms / exporters |
| `tamrlink_list_lots` | Live demo lots with price & pack |
| `tamrlink_post_rfq` | Post B2B demand (kg, variety, destination) |
| `tamrlink_match_rfq` | Score lots and generate offers |
| `tamrlink_list_offers` | Offers for one RFQ |
| `tamrlink_place_order` | Accept an offer |
| `tamrlink_suggest_logistics` | Freight / store / customs |
| `tamrlink_list_rfqs` | Session RFQs |

## Install

```bash
git clone https://github.com/senthazalravi/tamrlink-mcp.git
cd tamrlink-mcp
npm install
```

## Run (stdio)

```bash
node src/index.js
```

### Claude Desktop / Cursor

Add to MCP config:

```json
{
  "mcpServers": {
    "tamrlink": {
      "command": "node",
      "args": ["/ABS/PATH/tamrlink-mcp/src/index.js"]
    }
  }
}
```

## Example session

1. `tamrlink_post_rfq`  
   variety=`Ajwa Al-Madina`, quantityKg=`10000`, destination=`Gothenburg, Sweden`, maxPriceUsdPerKg=`13`
2. `tamrlink_match_rfq` with the returned `rfqId`
3. `tamrlink_place_order` on the best `offerId`, incoterm=`CIF Gothenburg`
4. `tamrlink_suggest_logistics` on the `orderId`

## Notes

- In-memory store: RFQs/orders reset when the process exits.
- Matching is rules-based (variety, volume, price, certs, export region, MOQ). Swap in an LLM later if you want.
- Node 18+.
