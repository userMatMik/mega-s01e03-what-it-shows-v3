// How a merged ticket splits into one ticket per problem. Counts are the desk's own view (CauseTable):
// one report per id, placed by causes.ts. The page and tools/analyze.ts both run this file.
import { groupByCause, readAs, ticketCause, uniqueById, type Cause, type Report, type Tenant } from './causes.ts';

// The tickets filed for #4471's problems, in the order they were opened: one per cause the desk places.
export const TICKETS: Record<Cause, { number: number; title: string }> = {
  parser: { number: 1, title: 'Dates are parsed month first, so day-first tenants get day and month flipped' },
  hint: { number: 2, title: 'booking-v3 form hint says MM/DD/YYYY but the form reads day first' },
};

export type ProblemGroup = {
  cause: Cause;
  reports: Report[];
  ids: string[];
  tenants: string[];
  channels: Record<string, number>;
  taggedAs: Record<string, number>;
  firstSeen: string;
  lastSeen: string;
  // Reports in this group the desk read differently (desk-notes.json): counted here, kept as evidence.
  readAsOneDayMove: Report[];
};

export type Split = {
  ticket: number;
  rawRows: number;
  uniqueIds: number;
  exportedTwice: string[];
  merged: number;
  owner: string | null;
  groups: ProblemGroup[];
};

const tally = (rs: Report[], key: (r: Report) => string) =>
  rs.reduce<Record<string, number>>((n, r) => ({ ...n, [key(r)]: (n[key(r)] ?? 0) + 1 }), {});

export function splitTicket(
  rows: Report[],
  tenantOf: (r: Report) => Tenant | undefined,
  oneDayMove: readonly string[],
  ticket = 4471,
): Split {
  // An id exported twice must be the same report both times, or the export is not one snapshot.
  const first = new Map<string, string>();
  const exportedTwice = new Set<string>();
  for (const r of rows) {
    const seen = first.get(r.id);
    if (seen !== undefined && seen !== JSON.stringify(r)) throw new Error(`${r.id} is exported twice with different data`);
    if (seen !== undefined) exportedTwice.add(r.id);
    first.set(r.id, JSON.stringify(r));
  }
  const unique = uniqueById(rows);
  const merged = unique.filter((r) => r.mergedInto === ticket);
  const causes = groupByCause(merged, tenantOf);
  const unplaced = causes.find((g) => g.cause === 'unplaced');
  if (unplaced) throw new Error(`${unplaced.reports.length} reports merged into #${ticket} have no cause: check the tenant directory`);
  const missing = oneDayMove.filter((id) => !merged.some((r) => r.id === id));
  if (missing.length) throw new Error(`desk notes name reports not merged into #${ticket}: ${missing.join(', ')}`);

  const groups = (Object.keys(TICKETS) as Cause[]).map((cause): ProblemGroup => {
    const g = causes.find((c) => c.cause === cause);
    if (!g) throw new Error(`#${ticket} no longer has the desk row ${cause}`);
    const days = g.reports.map((r) => r.receivedAt.slice(0, 10)).sort();
    return {
      cause,
      reports: g.reports,
      ids: g.reports.map((r) => r.id).sort(),
      tenants: [...new Set(g.reports.map((r) => r.tenant))].sort(),
      channels: tally(g.reports, (r) => r.channel),
      taggedAs: tally(g.reports, (r) => r.meta.intakeTag),
      firstSeen: days[0],
      lastSeen: days[days.length - 1],
      readAsOneDayMove: readAs(g, oneDayMove) ? g.reports.filter((r) => oneDayMove.includes(r.id)) : [],
    };
  });

  return {
    ticket,
    rawRows: rows.length,
    uniqueIds: unique.length,
    exportedTwice: [...exportedTwice].sort(),
    merged: merged.length,
    owner: ticketCause(causes, ticket),
    groups,
  };
}
