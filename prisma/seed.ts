/**
 * Seed: the curated base-style library + a small demo dataset.
 *
 * ┌───────────────────────────────────────────────────────────────────────────┐
 * │ ⚠️  PLACEHOLDER SPECS — NOT GROUND TRUTH.                                   │
 * │                                                                            │
 * │ Every `default*Spec` below is scaffolding authored by a developer, not a   │
 * │ barber. Guard numbers, fade heights and top lengths are plausible but      │
 * │ UNVALIDATED. Before ANY pilot, a real barber must review and correct each  │
 * │ one — the whole product depends on these numbers being credible (the first │
 * │ wrong number a barber spots permanently destroys trust). `barberValidated` │
 * │ is set false until that review happens.                                    │
 * └───────────────────────────────────────────────────────────────────────────┘
 */

import { PrismaClient, type BaseStyle } from "@prisma/client";
import type { Spec } from "../src/lib/spec";
import { parseSpec, specToCreateData } from "../src/lib/specSerialize";

const prisma = new PrismaClient();

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.now();
const daysAgo = (n: number) => new Date(NOW - n * DAY);

// ---------------------------------------------------------------------------
// The curated library. Each `spec` is AUTHORED structured data. Validate before
// any pilot (see banner above).
// ---------------------------------------------------------------------------

interface LibraryEntry {
  name: string;
  description: string;
  tags: string[];
  spec: Spec;
}

const LIBRARY: LibraryEntry[] = [
  {
    name: "Buzz Cut",
    description: "One length all over. Low fuss, sharp, grows out evenly.",
    tags: ["short", "low_maintenance", "walk_in_to_regular"],
    spec: {
      sidesGuard: "2",
      fadeType: "none",
      fadeHeight: "low",
      topMethod: "clipper",
      topLengthMm: 6,
      topGuard: "2",
      topStyle: "buzz",
      topDirection: "none",
      neckline: "natural",
      part: "none",
      texture: "natural",
      beard: null,
    },
  },
  {
    name: "Crew Cut",
    description: "Short, tidy classic. A touch of length up front, tight sides.",
    tags: ["short", "classic", "walk_in_to_regular"],
    spec: {
      sidesGuard: "1",
      fadeType: "low",
      fadeHeight: "low",
      topMethod: "clipper",
      topLengthMm: 13,
      topGuard: "4",
      topStyle: "crop",
      topDirection: "forward",
      neckline: "tapered",
      part: "none",
      texture: "natural",
      beard: null,
    },
  },
  {
    name: "Classic Taper",
    description: "Scissor length on top, gradual taper at the sides and nape.",
    tags: ["medium", "classic", "specific_complex_style"],
    spec: {
      sidesGuard: "2",
      fadeType: "taper",
      fadeHeight: "low",
      topMethod: "scissor",
      topLengthMm: 40,
      topGuard: null,
      topStyle: "natural",
      topDirection: "to_the_side",
      neckline: "tapered",
      part: "natural",
      texture: "natural",
      beard: null,
    },
  },
  {
    name: "Low Skin Fade + Textured Crop",
    description: "Skin at the bottom, soft crop on top with a forward fringe.",
    tags: ["short", "trendy", "big_change", "specific_complex_style"],
    spec: {
      sidesGuard: "skin",
      fadeType: "skin",
      fadeHeight: "low",
      topMethod: "clipper",
      topLengthMm: 25,
      topGuard: "8",
      topStyle: "crop",
      topDirection: "forward",
      neckline: "tapered",
      part: "none",
      texture: "textured_matte",
      beard: { style: "stubble", lengthMm: 3 },
    },
  },
  {
    name: "Mid Fade Pompadour",
    description: "Mid fade with serious length on top swept up and back.",
    tags: ["medium", "statement", "big_change", "specific_complex_style"],
    spec: {
      sidesGuard: "1",
      fadeType: "mid",
      fadeHeight: "mid",
      topMethod: "scissor",
      topLengthMm: 55,
      topGuard: null,
      topStyle: "pompadour",
      topDirection: "swept_back",
      neckline: "blocked",
      part: "hard",
      texture: "textured_shine",
      beard: { style: "short_boxed", lengthMm: 6 },
    },
  },
  {
    name: "High Skin Fade + Quiff",
    description: "Bold high skin fade, voluminous quiff lifted off the forehead.",
    tags: ["medium", "statement", "big_change"],
    spec: {
      sidesGuard: "skin",
      fadeType: "skin",
      fadeHeight: "high",
      topMethod: "scissor",
      topLengthMm: 45,
      topGuard: null,
      topStyle: "quiff",
      topDirection: "up_and_textured",
      neckline: "blocked",
      part: "none",
      texture: "textured_matte",
      beard: { style: "medium_boxed", lengthMm: 10 },
    },
  },
  {
    name: "Burst Fade",
    description: "Fade curves around the ear, length kept and textured on top.",
    tags: ["short", "trendy", "specific_complex_style"],
    spec: {
      sidesGuard: "0",
      fadeType: "burst",
      fadeHeight: "mid",
      topMethod: "clipper",
      topLengthMm: 30,
      topGuard: "8",
      topStyle: "spiky",
      topDirection: "up_and_textured",
      neckline: "tapered",
      part: "none",
      texture: "textured_matte",
      beard: null,
    },
  },
  {
    name: "Drop Fade + Curls",
    description: "Fade drops behind the ear; curls kept long and defined on top.",
    tags: ["medium", "curly", "specific_complex_style", "big_change"],
    spec: {
      sidesGuard: "1",
      fadeType: "drop",
      fadeHeight: "mid",
      topMethod: "scissor",
      topLengthMm: 40,
      topGuard: null,
      topStyle: "curls",
      topDirection: "none",
      neckline: "tapered",
      part: "none",
      texture: "defined_curls",
      beard: { style: "short_boxed", lengthMm: 5 },
    },
  },
  {
    name: "Ivy League (Side Part)",
    description: "Tidy low fade, length up front, combed to a defined side part.",
    tags: ["medium", "classic", "new_barber"],
    spec: {
      sidesGuard: "2",
      fadeType: "low",
      fadeHeight: "low",
      topMethod: "scissor",
      topLengthMm: 35,
      topGuard: null,
      topStyle: "slick_back",
      topDirection: "to_the_side",
      neckline: "tapered",
      part: "hard",
      texture: "textured_shine",
      beard: null,
    },
  },
  {
    name: "Caesar Crop",
    description: "Short, even top with a blunt fringe forward; clean low fade.",
    tags: ["short", "classic", "low_maintenance", "walk_in_to_regular"],
    spec: {
      sidesGuard: "1",
      fadeType: "low",
      fadeHeight: "low",
      topMethod: "clipper",
      topLengthMm: 18,
      topGuard: "6",
      topStyle: "fringe",
      topDirection: "forward",
      neckline: "blocked",
      part: "none",
      texture: "textured_matte",
      beard: null,
    },
  },
  {
    name: "Scissor Cut Medium",
    description: "All-scissor, no clippers. Soft and natural with length to style.",
    tags: ["medium", "natural", "new_barber"],
    spec: {
      sidesGuard: "scissor",
      fadeType: "none",
      fadeHeight: "low",
      topMethod: "scissor",
      topLengthMm: 60,
      topGuard: null,
      topStyle: "natural",
      topDirection: "swept_back",
      neckline: "natural",
      part: "natural",
      texture: "natural",
      beard: null,
    },
  },
  {
    name: "Long Textured Flow",
    description: "Grown-out length kept and shaped; movement over the ears and back.",
    tags: ["long", "natural", "specific_complex_style"],
    spec: {
      sidesGuard: "scissor",
      fadeType: "none",
      fadeHeight: "low",
      topMethod: "scissor",
      topLengthMm: 95,
      topGuard: null,
      topStyle: "natural",
      topDirection: "swept_back",
      neckline: "natural",
      part: "natural",
      texture: "messy",
      beard: { style: "full", lengthMm: 18 },
    },
  },
];

async function main() {
  console.log("Resetting demo rows…");
  // Order matters for FK integrity.
  await prisma.visit.deleteMany();
  await prisma.brief.deleteMany();
  await prisma.styleSpec.deleteMany();
  await prisma.baseStyle.deleteMany();
  await prisma.barber.deleteMany();
  await prisma.client.deleteMany();
  await prisma.shop.deleteMany();

  // --- Library ---
  console.log(`Seeding ${LIBRARY.length} base styles…`);
  const baseStyles: BaseStyle[] = [];
  for (const entry of LIBRARY) {
    const spec = parseSpec(entry.spec); // validate the authored spec at seed time
    const bs = await prisma.baseStyle.create({
      data: {
        name: entry.name,
        description: entry.description,
        defaultSpecJson: JSON.stringify(spec),
        tags: entry.tags.join(","),
        // Placeholder data — flipped to true only after a real barber reviews it.
        barberValidated: false,
      },
    });
    baseStyles.push(bs);
  }
  const byName = (n: string) => baseStyles.find((b) => b.name === n)!;

  // --- Shops & barbers ---
  console.log("Seeding shops & barbers…");
  const fadeLab = await prisma.shop.create({
    data: { name: "Fade Lab", slug: "fade-lab" },
  });
  const sharpCo = await prisma.shop.create({
    data: { name: "Sharp & Co", slug: "sharp-co" },
  });
  await prisma.barber.createMany({
    data: [
      { name: "Marco", email: "marco@fadelab.example", shopId: fadeLab.id },
      { name: "Aisha", email: "aisha@sharpco.example", shopId: sharpCo.id },
    ],
  });

  // --- Helpers ---
  async function makeSpec(spec: Spec, baseStyleId: string | null) {
    return prisma.styleSpec.create({
      data: specToCreateData(spec, { baseStyleId }),
    });
  }

  async function completedBrief(opts: {
    clientId: string;
    shopId: string;
    baseName: string;
    useCase: string;
    daysAgo: number;
    briefed?: boolean;
  }) {
    const base = byName(opts.baseName);
    const spec = parseSpec(JSON.parse(base.defaultSpecJson));
    const reqSpec = await makeSpec(spec, base.id);
    const actualSpec = await makeSpec(spec, base.id);
    const brief = await prisma.brief.create({
      data: {
        clientId: opts.clientId,
        shopId: opts.shopId,
        requestedSpecId: reqSpec.id,
        actualSpecId: actualSpec.id,
        useCaseTag: opts.useCase,
        status: "completed",
        createdAt: daysAgo(opts.daysAgo + 1),
        seenAt: daysAgo(opts.daysAgo + 1),
        completedAt: daysAgo(opts.daysAgo),
      },
    });
    await prisma.visit.create({
      data: {
        clientId: opts.clientId,
        shopId: opts.shopId,
        briefId: brief.id,
        briefed: opts.briefed ?? true,
        visitedAt: daysAgo(opts.daysAgo),
      },
    });
    return brief;
  }

  async function openBrief(opts: {
    clientId: string;
    shopId: string;
    baseName: string;
    useCase: string;
    status: string;
    daysAgo: number;
    notes?: string;
  }) {
    const base = byName(opts.baseName);
    const spec = parseSpec(JSON.parse(base.defaultSpecJson));
    const reqSpec = await makeSpec(spec, base.id);
    return prisma.brief.create({
      data: {
        clientId: opts.clientId,
        shopId: opts.shopId,
        requestedSpecId: reqSpec.id,
        useCaseTag: opts.useCase,
        status: opts.status,
        notes: opts.notes ?? null,
        createdAt: daysAgo(opts.daysAgo),
        seenAt: opts.status === "seen" ? daysAgo(opts.daysAgo) : null,
      },
    });
  }

  async function manualVisit(opts: {
    clientId: string;
    shopId: string;
    daysAgo: number;
    briefed: boolean;
  }) {
    return prisma.visit.create({
      data: {
        clientId: opts.clientId,
        shopId: opts.shopId,
        briefed: opts.briefed,
        visitedAt: daysAgo(opts.daysAgo),
      },
    });
  }

  // --- Clients ---
  console.log("Seeding clients, briefs & visits…");

  // Jordan: the PORTABILITY demo — same person, two shops, history travels.
  const jordan = await prisma.client.create({
    data: {
      name: "Jordan Lee",
      contact: "jordan@example.com",
      hairType: "wavy",
      density: "thick",
      faceShape: "oval",
      createdAt: daysAgo(70),
    },
  });
  await completedBrief({ clientId: jordan.id, shopId: fadeLab.id, baseName: "Mid Fade Pompadour", useCase: "big_change", daysAgo: 56 });
  await completedBrief({ clientId: jordan.id, shopId: fadeLab.id, baseName: "Mid Fade Pompadour", useCase: "walk_in_to_regular", daysAgo: 28 });
  // …then Jordan walks into a DIFFERENT shop and is recognised with full history.
  await openBrief({ clientId: jordan.id, shopId: sharpCo.id, baseName: "High Skin Fade + Quiff", useCase: "new_barber", status: "submitted", daysAgo: 1, notes: "First time at this shop — went a bit shorter last time, happy to go bolder." });

  // Briefed cohort at Fade Lab (mostly return → high repeat rate).
  const briefedReturners = [
    { name: "Sam Carter", contact: "0400000001", hairType: "straight", density: "medium", base: "Crew Cut" },
    { name: "Priya Nair", contact: "priya@example.com", hairType: "curly", density: "thick", base: "Drop Fade + Curls" },
    { name: "Tom Hale", contact: "0400000003", hairType: "straight", density: "thin", base: "Ivy League (Side Part)" },
  ];
  for (const c of briefedReturners) {
    const client = await prisma.client.create({
      data: { name: c.name, contact: c.contact, hairType: c.hairType, density: c.density, createdAt: daysAgo(80) },
    });
    await completedBrief({ clientId: client.id, shopId: fadeLab.id, baseName: c.base, useCase: "new_barber", daysAgo: 58 });
    await manualVisit({ clientId: client.id, shopId: fadeLab.id, daysAgo: 30, briefed: true });
  }

  // Briefed but not yet returned (recent first visit; window hasn't closed).
  const devClient = await prisma.client.create({
    data: { name: "Dev Okafor", contact: "dev@example.com", hairType: "coily", density: "thick", createdAt: daysAgo(20) },
  });
  await completedBrief({ clientId: devClient.id, shopId: fadeLab.id, baseName: "Low Skin Fade + Textured Crop", useCase: "specific_complex_style", daysAgo: 12 });

  // Open queue items for the barber dashboard (various statuses).
  const queueClients = [
    { name: "Leo Martins", contact: "leo@example.com", hairType: "wavy", density: "medium", base: "High Skin Fade + Quiff", status: "submitted", useCase: "big_change", notes: "Wedding in 3 weeks — want something sharp but not too short." },
    { name: "Noah Kim", contact: "0400000010", hairType: "straight", density: "medium", base: "Caesar Crop", status: "seen", useCase: "walk_in_to_regular", notes: "" },
    { name: "Amir Hassan", contact: "amir@example.com", hairType: "curly", density: "thick", base: "Burst Fade", status: "submitted", useCase: "specific_complex_style", notes: "Keep length on top, tighten the sides a lot." },
  ];
  for (const c of queueClients) {
    const client = await prisma.client.create({
      data: { name: c.name, contact: c.contact, hairType: c.hairType, density: c.density, createdAt: daysAgo(5) },
    });
    await openBrief({ clientId: client.id, shopId: fadeLab.id, baseName: c.base, useCase: c.useCase, status: c.status, daysAgo: 2, notes: c.notes });
  }

  // Non-briefed baseline at Fade Lab (manual entry) — lower repeat rate.
  // Five came once; three of eight returned → ~38% vs briefed ~80%.
  const nonBriefed = [
    { name: "Walk-in 1", contact: "nb-0400000101", returns: true },
    { name: "Walk-in 2", contact: "nb-0400000102", returns: true },
    { name: "Walk-in 3", contact: "nb-0400000103", returns: true },
    { name: "Walk-in 4", contact: "nb-0400000104", returns: false },
    { name: "Walk-in 5", contact: "nb-0400000105", returns: false },
    { name: "Walk-in 6", contact: "nb-0400000106", returns: false },
    { name: "Walk-in 7", contact: "nb-0400000107", returns: false },
    { name: "Walk-in 8", contact: "nb-0400000108", returns: false },
  ];
  for (const c of nonBriefed) {
    const client = await prisma.client.create({
      data: { name: c.name, contact: c.contact, hairType: "straight", density: "medium", createdAt: daysAgo(80) },
    });
    await manualVisit({ clientId: client.id, shopId: fadeLab.id, daysAgo: 60, briefed: false });
    if (c.returns) {
      await manualVisit({ clientId: client.id, shopId: fadeLab.id, daysAgo: 32, briefed: false });
    }
  }

  // A small baseline at Sharp & Co too.
  for (let i = 1; i <= 3; i++) {
    const client = await prisma.client.create({
      data: { name: `Sharp Walk-in ${i}`, contact: `sc-nb-${i}`, hairType: "straight", density: "medium", createdAt: daysAgo(70) },
    });
    await manualVisit({ clientId: client.id, shopId: sharpCo.id, daysAgo: 50, briefed: false });
    if (i === 1) await manualVisit({ clientId: client.id, shopId: sharpCo.id, daysAgo: 24, briefed: false });
  }

  const counts = {
    baseStyles: await prisma.baseStyle.count(),
    shops: await prisma.shop.count(),
    clients: await prisma.client.count(),
    briefs: await prisma.brief.count(),
    visits: await prisma.visit.count(),
  };
  console.log("Seed complete:", counts);
  console.log("\nClient links:");
  console.log(`  Fade Lab:   /s/fade-lab`);
  console.log(`  Sharp & Co: /s/sharp-co`);
  console.log("Barber dashboard: /barber  (access code: BARBER_ACCESS_CODE, default 'letmein')");
  console.log("Portability demo: enter contact 'jordan@example.com' at Sharp & Co — history loads.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
