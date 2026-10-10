import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Full & final settlement (F8): the server works the statement out and freezes it;
// every step is claim-first; nobody handles the settlement of their own exit (S31);
// approval is a second person and a payroll permission; the loan and fund records are
// read, never changed, from here.

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const service = read('lib/services/settlement.service.ts');
const repo = read('lib/repositories/settlement.repository.ts');
const actions = read('app/actions/settlement.actions.ts');
const engine = read('lib/engines/settlement.engine.ts');

describe('settlement guards', () => {
  it('prepare, approve and pay all refuse one\'s own exit (DENIED_SELF)', () => {
    assert.match(service, /async function refuseOwn[\s\S]*isOwnRecord[\s\S]*DENIED_SELF/);
    const prepare = service.slice(service.indexOf('export async function prepareSettlement'), service.indexOf('async function move'));
    assert.match(prepare, /await refuseOwn\(/);
    const move = service.slice(service.indexOf('async function move'));
    assert.match(move, /await refuseOwn\(/);
  });

  it('every status move is claim-first on the current status', () => {
    const claim = repo.slice(repo.indexOf('export async function claim'), repo.indexOf('/** Pay months'));
    assert.match(claim, /eq\(exitSettlements\.status, from\)/);
  });

  it('a draft is re-prepared only while it is still a draft', () => {
    assert.match(repo, /setWhere: eq\(exitSettlements\.status, 'draft'\)/);
  });

  it('approval needs a second person (engine) and a payroll permission (action)', () => {
    assert.match(engine, /preparedBy === actor/);
    assert.match(actions, /settlementCtx\('APPROVE', 'PAYROLL_REVIEW'\)/);
    assert.match(actions, /settlementCtx\('LOCK', 'PAYROLL_REVIEW'\)/);
  });

  it('amounts are never taken from the browser', () => {
    const fns = actions.slice(actions.indexOf('export async function prepareSettlementAction'));
    assert.doesNotMatch(fns, /form\.(lines|net|earnings)/);
    assert.match(service, /buildSettlement\(/);
  });

  it('the settlement does not write loans or fund ledgers', () => {
    assert.doesNotMatch(service, /loanRepo|fundRepo|postLines|recordRepayment/);
  });

  it('the policy is only written with SYSTEM_CONTROL EDIT', () => {
    assert.match(actions, /settlementCtx\('EDIT', 'SYSTEM_CONTROL'\)/);
  });
});
