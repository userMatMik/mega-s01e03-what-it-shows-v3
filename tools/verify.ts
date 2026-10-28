// Checks the evidence, the ticket drafts, the signed page and its render against the export.
// Run after `node tools/analyze.ts` and `vite build`: node tools/verify.ts
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Report, Tenant } from '../src/lib/kb/causes.ts';
import { causeOf } from '../src/lib/kb/causes.ts';
import { deskRef } from '../src/lib/kb/desk-ref.ts';
import { splitTicket, TICKETS } from '../src/lib/kb/split.ts';

const root = join(import.meta.dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const data = 'src/lib/data';
const reports: Report[] = JSON.parse(read(`${data}/reports-4471.json`));
const tenants: Tenant[] = readdirSync(join(root, data, 'tenants')).map((f) => JSON.parse(read(`${data}/tenants/${f}`)));
const byHandle = new Map(tenants.map((t) => [t.handle, t]));
const notes = JSON.parse(read(`${data}/desk-notes.json`));
const split = splitTicket(reports, (r) => byHandle.get(r.tenant), notes.oneDayMove);
const [parser, hint] = split.groups;

let failed = 0;
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) failed++;
};

// The export, the desk's way.
check(split.rawRows === 427 && split.uniqueIds === 412 && split.exportedTwice.length === 15, 'export: 427 rows, 412 reports, 15 listed twice');
check(split.merged === 412 && split.owner === 'parser', 'all 412 merged into #4471; its own row is parser');
check(split.groups.length === 2 && parser.ids.length === 379 && hint.ids.length === 33, 'two tickets, one per desk row: parser 379, hint 33');
check(parser.ids.every((id) => !hint.ids.includes(id)) && parser.ids.length + hint.ids.length === 412, 'parser and hint split the 412 with no overlap');
check(parser.reports.every((r) => causeOf(r, byHandle.get(r.tenant)) === 'parser') && hint.reports.every((r) => causeOf(r, byHandle.get(r.tenant)) === 'hint'), 'every report sits in the row causes.ts gives it');
check(parser.readAsOneDayMove.length === 5 && hint.readAsOneDayMove.length === 0 && notes.oneDayMove.every((id: string) => parser.ids.includes(id)), 'the 5 one-day notes all sit in parser and are counted there');

// The ticket drafts.
const files = readdirSync(join(root, 'issues')).sort();
check(JSON.stringify(files) === JSON.stringify(['1-parser.md', '2-hint.md']), 'exactly two ticket drafts');
const drafts = { parser: 'issues/1-parser.md', hint: 'issues/2-hint.md' } as const;
for (const g of split.groups) {
  const n = TICKETS[g.cause].number;
  const text = read(drafts[g.cause]);
  const title = text.split('\n')[0];
  const listed = (text.match(/<details>[\s\S]*<\/details>/)?.[0].match(/R-\d{5}/g) ?? []).sort();
  check(title === `# ${TICKETS[g.cause].title} (${g.ids.length} reports)`, `#${n} title carries ${g.ids.length}`);
  check(text.includes(`**Covers ${g.ids.length} reports**`), `#${n} body states ${g.ids.length}`);
  check(JSON.stringify(listed) === JSON.stringify(g.ids), `#${n} lists exactly its ${g.ids.length} ids`);
  check(!/duplicate|same problem|same flip|same bug/i.test(text), `#${n} never calls itself a duplicate of another ticket`);
}
check(read(drafts.parser).includes(`${notes.oneDayMove.length} of these (${notes.oneDayMove.join(', ')}) the desk read as a one-day move`), '#1 names the 5 one-day reports in one sentence, counted under parser');

// No trace of a third ticket or a 374 count anywhere we publish.
const published = [drafts.parser, drafts.hint, 'src/routes/kb/incidents/4471-split/+page.svx', 'src/lib/kb/split.ts', 'src/lib/kb/SplitTable.svelte', 'SOLUTION.md', 'evidence/split.json'];
const stale = /#3\b|\b374\b|third (problem|ticket)|separate (one-day )?ticket|ticket of (their|its) own, #|oneDayMove'|3-one-day/i;
const hits = published.filter((p) => stale.test(read(p)));
check(hits.length === 0, `no reference to a third ticket or 374${hits.length ? ` (found in ${hits.join(', ')})` : ''}`);

// The signed page and its render.
const page = read('src/routes/kb/incidents/4471-split/+page.svx');
const signature = page.match(/^signature: '([^']+)'$/m)?.[1] ?? '';
const payload = JSON.parse(Buffer.from(signature.split('.')[1] ?? '', 'base64url').toString() || '{}');
check(/^v1\.[\w-]+\.[\w-]+$/.test(signature) && payload.aud === 'challenge:what-it-shows', 'page is signed with the course ticket for what-it-shows');
check(page.trimEnd().endsWith('<RenderStamp {signature} />'), 'page ends with RenderStamp');
const html = existsSync(join(root, 'rendered/kb/incidents/4471-split.html')) ? read('rendered/kb/incidents/4471-split.html') : '';
check(html.includes(deskRef(signature)), `render shows desk ref ${deskRef(signature)}`);
const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
check(text.includes('parser 379') && text.includes('hint 33') && text.includes('5 reports read as a one-day move'), "render shows the desk's own table");
check(text.includes('379 11') && text.includes('33 3') && text.includes('2 tickets') && !/#3\b/.test(text), 'render shows two tickets: 379 #1, 33 #2, no #3');

console.log(failed ? `${failed} check(s) failed` : 'all checks passed');
process.exit(failed ? 1 : 0);
