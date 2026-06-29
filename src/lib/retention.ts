/**
 * retention.ts — the proof metric (Risk 3 / Principle 5).
 *
 * Computes, per shop, the repeat/rebooking rate of clients whose first visit
 * was BRIEFED (via Chairside) vs. NON-BRIEFED. The whole pilot exists to
 * produce this comparison, so the math is kept simple and honest:
 *
 *   - Group a shop's visits by client.
 *   - A client's cohort = "briefed" if their FIRST visit at the shop was
 *     briefed, else "non-briefed".
 *   - A client "returned" if they have a second visit within `windowDays` of
 *     their first visit at that shop.
 *   - repeatRate = returned / cohortSize.
 *
 * Honesty note surfaced in the UI: a recent first visit hasn't had a full
 * window to produce a return yet, so small-N early numbers are noisy. We do not
 * hide that.
 */

export interface VisitLike {
  clientId: string;
  briefed: boolean;
  visitedAt: Date;
}

export interface CohortStats {
  clients: number; // cohort size (distinct clients)
  returned: number; // how many came back within the window
  repeatRate: number; // returned / clients (0 when clients === 0)
}

export interface RetentionResult {
  windowDays: number;
  briefed: CohortStats;
  nonBriefed: CohortStats;
  totalVisits: number;
  totalClients: number;
  /** briefed.repeatRate - nonBriefed.repeatRate, in points (can be negative). */
  liftPoints: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function retentionWindowDays(): number {
  const v = Number(process.env.RETENTION_WINDOW_DAYS);
  return Number.isFinite(v) && v > 0 ? Math.round(v) : 42;
}

export function computeRetention(
  visits: VisitLike[],
  windowDays: number = retentionWindowDays(),
): RetentionResult {
  const byClient = new Map<string, VisitLike[]>();
  for (const v of visits) {
    const list = byClient.get(v.clientId) ?? [];
    list.push(v);
    byClient.set(v.clientId, list);
  }

  const briefed: CohortStats = { clients: 0, returned: 0, repeatRate: 0 };
  const nonBriefed: CohortStats = { clients: 0, returned: 0, repeatRate: 0 };

  for (const list of byClient.values()) {
    const sorted = [...list].sort(
      (a, b) => a.visitedAt.getTime() - b.visitedAt.getTime(),
    );
    const first = sorted[0];
    const cohort = first.briefed ? briefed : nonBriefed;
    cohort.clients += 1;

    const returned = sorted
      .slice(1)
      .some(
        (v) =>
          v.visitedAt.getTime() - first.visitedAt.getTime() <=
          windowDays * DAY_MS,
      );
    if (returned) cohort.returned += 1;
  }

  briefed.repeatRate = rate(briefed);
  nonBriefed.repeatRate = rate(nonBriefed);

  return {
    windowDays,
    briefed,
    nonBriefed,
    totalVisits: visits.length,
    totalClients: byClient.size,
    liftPoints:
      Math.round((briefed.repeatRate - nonBriefed.repeatRate) * 1000) / 10,
  };
}

function rate(c: CohortStats): number {
  return c.clients === 0 ? 0 : c.returned / c.clients;
}

export function formatPct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}
