import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  dedupePunches,
  deviceHealth,
  handshakeResponse,
  isValidSerial,
  localTimeToInstant,
  parseAttlog,
} from '../lib/engines/device.engine';

// Attendance devices (G3): ADMS/iclock parsing. Device time is local; the
// registered tz offset (Nepal 345) turns it into an instant.

describe('device serials and time', () => {
  it('accepts device-like serials, refuses junk', () => {
    assert.equal(isValidSerial('AEYC201260073'), true);
    assert.equal(isValidSerial('ZK-66_2026'), true);
    assert.equal(isValidSerial('ab'), false);
    assert.equal(isValidSerial('bad serial'), false);
    assert.equal(isValidSerial('-leading'), false);
  });

  it('converts device-local time to an instant with the tz offset', () => {
    // 10:00 in Kathmandu (UTC+5:45) = 04:15 UTC
    const at = localTimeToInstant('2026-10-09 10:00:00', 345)!;
    assert.equal(at.toISOString(), '2026-10-09T04:15:00.000Z');
    assert.equal(localTimeToInstant('2026-10-09T10:00:00', 345), null);
    assert.equal(localTimeToInstant('2000-01-01 00:00:00', 345), null, 'reset clocks refused');
  });
});

describe('ATTLOG parsing', () => {
  it('parses PIN + local time per line; extra fields ignored; malformed counted', () => {
    const body = [
      '101\t2026-10-09 09:58:12\t0\t1\t0\t0',
      '102\t2026-10-09 10:01:40\t1\t15',
      '',
      'garbage line',
      '103\tnot-a-time\t0',
    ].join('\n');
    const { punches, malformed } = parseAttlog(body, 345);
    assert.equal(punches.length, 2);
    assert.equal(malformed, 2);
    assert.equal(punches[0].deviceUserId, '101');
    assert.equal(punches[0].punchedAt.toISOString(), '2026-10-09T04:13:12.000Z');
    assert.equal(punches[1].raw, '102\t2026-10-09 10:01:40\t1\t15');
  });

  it('de-duplicates resent punches on (PIN, instant)', () => {
    const { punches } = parseAttlog('101\t2026-10-09 09:58:12\t0\n101\t2026-10-09 09:58:12\t0\n101\t2026-10-09 09:59:00\t0', 345);
    assert.equal(dedupePunches(punches).length, 2);
  });
});

describe('handshake and health', () => {
  it('answers the registry block with the serial and Nepal time zone', () => {
    const response = handshakeResponse('AEYC201260073');
    assert.match(response, /^GET OPTION FROM: AEYC201260073/);
    assert.match(response, /TimeZone=5\.75/);
    assert.match(response, /Realtime=1/);
  });

  it('grades device health by last-seen age', () => {
    const now = new Date('2026-10-09T06:00:00Z');
    assert.equal(deviceHealth(null, now), 'never');
    assert.equal(deviceHealth(new Date('2026-10-09T05:50:00Z'), now), 'online');
    assert.equal(deviceHealth(new Date('2026-10-09T01:00:00Z'), now), 'quiet');
    assert.equal(deviceHealth(new Date('2026-10-01T06:00:00Z'), now), 'silent');
  });
});
