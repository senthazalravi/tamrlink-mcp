import { suppliers, lots, logisticsPartners } from "./data/catalog.js";

const rfqs = new Map();
const offers = new Map();
const orders = new Map();
let seq = 100;

function nextId(prefix) {
  seq += 1;
  return `${prefix}-${seq}`;
}

export function listSuppliers({ variety, country, type, minRating } = {}) {
  return suppliers.filter((s) => {
    if (variety && !s.varieties.some((v) => v.toLowerCase().includes(String(variety).toLowerCase()))) {
      return false;
    }
    if (country && s.country.toLowerCase() !== String(country).toLowerCase()) return false;
    if (type && s.type !== type) return false;
    if (minRating && s.rating < Number(minRating)) return false;
    return true;
  });
}

export function listLots({ variety, minKg, maxPriceUsdPerKg, grade } = {}) {
  return lots
    .filter((lot) => {
      if (variety && !lot.variety.toLowerCase().includes(String(variety).toLowerCase())) return false;
      if (minKg && lot.availableKg < Number(minKg)) return false;
      if (maxPriceUsdPerKg && lot.priceUsdPerKg > Number(maxPriceUsdPerKg)) return false;
      if (grade && !lot.grade.toLowerCase().includes(String(grade).toLowerCase())) return false;
      return true;
    })
    .map((lot) => ({
      ...lot,
      supplier: suppliers.find((s) => s.id === lot.supplierId),
    }));
}

function scoreMatch(rfq, lot, supplier) {
  let score = 40;
  const v = (rfq.variety || "").toLowerCase();
  if (!v || v === "any") score += 15;
  else if (lot.variety.toLowerCase().includes(v) || v.includes(lot.variety.toLowerCase())) score += 30;
  else return 0;

  if (lot.availableKg >= rfq.quantityKg) score += 20;
  else if (lot.availableKg >= rfq.quantityKg * 0.6) score += 8;
  else return 0;

  if (rfq.maxPriceUsdPerKg) {
    if (lot.priceUsdPerKg <= rfq.maxPriceUsdPerKg) score += 15;
    else if (lot.priceUsdPerKg <= rfq.maxPriceUsdPerKg * 1.12) score += 5;
    else score -= 10;
  }

  if (rfq.grade && lot.grade.toLowerCase().includes(String(rfq.grade).toLowerCase())) score += 8;
  if (supplier.rating >= 4.5) score += 6;
  if (rfq.destinationRegion) {
    const dest = String(rfq.destinationRegion).toUpperCase();
    if (supplier.exportMarkets.some((m) => dest.includes(m) || m.includes(dest))) score += 8;
  }
  if (lot.availableKg >= supplier.moqKg && rfq.quantityKg >= supplier.moqKg) score += 4;
  else if (rfq.quantityKg < supplier.moqKg) score -= 15;

  return Math.max(0, Math.min(100, score));
}

export function createRfq(input) {
  const id = nextId("rfq");
  const rfq = {
    id,
    variety: input.variety || "any",
    quantityKg: Number(input.quantityKg),
    destination: input.destination || "",
    destinationRegion: input.destinationRegion || inferRegion(input.destination),
    grade: input.grade || "",
    maxPriceUsdPerKg: input.maxPriceUsdPerKg ? Number(input.maxPriceUsdPerKg) : null,
    notes: input.notes || "",
    buyer: input.buyer || "anonymous-buyer",
    status: "open",
    createdAt: new Date().toISOString(),
  };
  rfqs.set(id, rfq);
  return rfq;
}

function inferRegion(dest = "") {
  const d = dest.toLowerCase();
  if (/(sweden|germany|france|netherlands|spain|italy|eu|europe|uk)/.test(d)) return "EU";
  if (/(usa|united states|canada|us\b)/.test(d)) return "US";
  if (/(uae|dubai|ksa|saudi|oman|qatar|kuwait|bahrain|gcc)/.test(d)) return "GCC";
  if (/(india|pakistan|bangladesh)/.test(d)) return "IN";
  return "";
}

export function matchRfq(rfqId, { limit = 5 } = {}) {
  const rfq = rfqs.get(rfqId);
  if (!rfq) throw new Error(`RFQ not found: ${rfqId}`);

  const ranked = lots
    .map((lot) => {
      const supplier = suppliers.find((s) => s.id === lot.supplierId);
      const score = scoreMatch(rfq, lot, supplier);
      return { score, lot, supplier };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  const created = ranked.map((r) => {
    const id = nextId("off");
    const offer = {
      id,
      rfqId,
      lotId: r.lot.id,
      supplierId: r.supplier.id,
      supplierName: r.supplier.name,
      variety: r.lot.variety,
      availableKg: r.lot.availableKg,
      offeredKg: Math.min(rfq.quantityKg, r.lot.availableKg),
      priceUsdPerKg: r.lot.priceUsdPerKg,
      pack: r.lot.pack,
      grade: r.lot.grade,
      incoterms: r.supplier.incoterms,
      certifications: r.supplier.certifications,
      matchScore: r.score,
      status: "quoted",
    };
    offers.set(id, offer);
    return offer;
  });

  rfq.status = created.length ? "matched" : "no_match";
  return { rfq, offers: created };
}

export function listRfqs() {
  return [...rfqs.values()];
}

export function getOffers(rfqId) {
  return [...offers.values()].filter((o) => o.rfqId === rfqId);
}

export function placeOrder({ offerId, buyer, incoterm }) {
  const offer = offers.get(offerId);
  if (!offer) throw new Error(`Offer not found: ${offerId}`);
  const rfq = rfqs.get(offer.rfqId);
  const id = nextId("ord");
  const order = {
    id,
    offerId,
    rfqId: offer.rfqId,
    buyer: buyer || rfq?.buyer,
    supplierId: offer.supplierId,
    supplierName: offer.supplierName,
    variety: offer.variety,
    quantityKg: offer.offeredKg,
    priceUsdPerKg: offer.priceUsdPerKg,
    totalUsd: Number((offer.offeredKg * offer.priceUsdPerKg).toFixed(2)),
    incoterm: incoterm || offer.incoterms[0],
    status: "pending_payment",
    createdAt: new Date().toISOString(),
    nextSteps: [
      "Buyer deposits via escrow",
      "Supplier confirms pack-out date",
      "Inspection / certificate pack",
      "Freight booking + customs",
      "Bill of lading released on payment milestone",
    ],
  };
  orders.set(id, order);
  offer.status = "accepted";
  if (rfq) rfq.status = "ordered";
  return order;
}

export function suggestLogistics(orderId) {
  const order = orders.get(orderId);
  if (!order) throw new Error(`Order not found: ${orderId}`);
  return {
    order,
    partners: logisticsPartners,
    suggested: {
      freight: logisticsPartners[0],
      warehouse: logisticsPartners[1],
      customs: logisticsPartners[2],
    },
  };
}

export function getOrder(orderId) {
  return orders.get(orderId);
}

export function catalogSummary() {
  return {
    suppliers: suppliers.length,
    lots: lots.length,
    varieties: [...new Set(lots.map((l) => l.variety))],
    openRfqs: [...rfqs.values()].filter((r) => r.status === "open" || r.status === "matched").length,
    orders: orders.size,
  };
}
