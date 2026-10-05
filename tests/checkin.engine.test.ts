import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkLocation, decideClock, distanceMeters, ipInNetworks, nextKind, parseLocation, parseNetwork, type BranchPlace } from '../lib/engines/checkin.engine';

// Web clock-in (4.5c): office networks (IPv4 / IPv6), distance and accuracy,
// every branch rule, and in / out from today's punches.

describe('Office networks', () => {
  it('addresses and ranges, IPv4 and IPv6', () => {
    assert.ok(parseNetwork('103.10.28.5'));
    assert.ok(parseNetwork('103.10.28.0/24'));
    assert.ok(parseNetwork('2400:1a00:b020::/48'));
    for (const bad of ['103.10.28', '256.1.1.1', '10.0.0.0/33', 'abc', '2400:::1', '10.0.0.1/8/1']) assert.equal(parseNetwork(bad), null, bad);
  });
  it('matches inside a range only; IPv4 and IPv6 never mix; bad entries never match', () => {
    const nets = ['103.10.28.0/24', '2400:1a00:b020::/48', 'junk'];
    assert.ok(ipInNetworks('103.10.28.200', nets));
    assert.ok(!ipInNetworks('103.10.29.1', nets));
    assert.ok(ipInNetworks('2400:1a00:b020:12::7', nets));
    assert.ok(!ipInNetworks('2400:1a00:b021::7', nets));
    assert.ok(ipInNetworks('::ffff:103.10.28.9', nets), 'IPv4-mapped address');
    assert.ok(ipInNetworks('103.10.28.5', ['103.10.28.5']), 'a single address');
    assert.ok(!ipInNetworks('unknown', nets));
  });
});

describe('Location', () => {
  it('distance: one degree of latitude is about 111.2 km; 0.001° about 111 m', () => {
    assert.ok(Math.abs(distanceMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 }) - 111195) < 5);
    assert.ok(Math.abs(distanceMeters({ lat: 27.7, lng: 85.3 }, { lat: 27.701, lng: 85.3 }) - 111.2) < 1);
  });
  it('inside counts up to 50 m of accuracy; worse than 500 m is too rough', () => {
    assert.equal(checkLocation(140, 10, 150), 'inside');
    assert.equal(checkLocation(190, 80, 150), 'inside');
    assert.equal(checkLocation(210, 80, 150), 'outside');
    assert.equal(checkLocation(100, 600, 150), 'too_rough');
  });
  it('only real coordinates are accepted', () => {
    assert.deepEqual(parseLocation({ lat: 27.7172453, lng: 85.324, accuracy: 12.4 }), { lat: 27.717245, lng: 85.324, accuracy: 12 });
    assert.equal(parseLocation({ lat: 95, lng: 85, accuracy: 10 }), null);
    assert.equal(parseLocation({ lat: '27.7', lng: null, accuracy: 5 }), null);
    assert.equal(parseLocation(null), null);
  });
});

describe('Deciding a clock-in', () => {
  const office = { lat: 27.7, lng: 85.3 };
  const near = { lat: 27.7005, lng: 85.3, accuracy: 15 }; // about 56 m
  const far = { lat: 27.72, lng: 85.3, accuracy: 15 }; // about 2.2 km
  const branch = (over: Partial<BranchPlace> = {}): BranchPlace => ({ name: 'Head Office', rule: 'network_or_location', networks: ['103.10.28.0/24'], point: office, radiusM: 150, ...over });
  const decide = (over: Partial<Parameters<typeof decideClock>[0]> = {}) => decideClock({ companyEnabled: true, branch: branch(), ip: '1.2.3.4', location: null, exception: false, ...over });

  it('off for the company or the branch', () => {
    assert.equal(decide({ companyEnabled: false }).outcome, 'off');
    assert.equal(decide({ branch: branch({ rule: 'off' }) }).outcome, 'off');
  });
  it('anywhere, and the allowed-anywhere list', () => {
    assert.equal(decide({ branch: branch({ rule: 'anywhere' }) }).place, 'anywhere');
    assert.equal(decide({ exception: true }).place, 'exception');
  });
  it('network', () => {
    assert.equal(decide({ branch: branch({ rule: 'network' }), ip: '103.10.28.7' }).place, 'network');
    const out = decide({ branch: branch({ rule: 'network' }), location: near });
    assert.equal(out.outcome, 'remote');
    assert.match(out.reason, /not on Head Office's office network/);
  });
  it('location: inside, outside (with the distance), not shared, too rough, not set', () => {
    assert.equal(decide({ branch: branch({ rule: 'location' }), location: near }).place, 'location');
    const out = decide({ branch: branch({ rule: 'location' }), location: far });
    assert.equal(out.outcome, 'remote');
    assert.match(out.reason, /2\.2 km from Head Office \(allowed 150 m\)/);
    assert.match(decide({ branch: branch({ rule: 'location' }) }).reason, /not shared/);
    assert.match(decide({ branch: branch({ rule: 'location' }), location: { ...near, accuracy: 900 } }).reason, /too rough/);
    assert.match(decide({ branch: branch({ rule: 'location', point: null }), location: near }).reason, /not set yet/);
  });
  it('network or location: either is enough', () => {
    assert.equal(decide({ ip: '103.10.28.7' }).place, 'network');
    assert.equal(decide({ location: near }).place, 'location');
    assert.equal(decide({ location: far }).outcome, 'remote');
  });
  it('network and location: both needed', () => {
    const both = branch({ rule: 'network_and_location' });
    assert.equal(decide({ branch: both, ip: '103.10.28.7', location: near }).outcome, 'punch');
    assert.equal(decide({ branch: both, ip: '103.10.28.7', location: far }).outcome, 'remote');
    const noNet = decide({ branch: both, location: near });
    assert.equal(noNet.outcome, 'remote');
    assert.match(noNet.reason, /office network\.$/);
  });
  it('in, out, in, out from today\'s punches', () => {
    assert.deepEqual([0, 1, 2, 3].map(nextKind), ['in', 'out', 'in', 'out']);
  });
});
