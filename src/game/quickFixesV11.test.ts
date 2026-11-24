import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMAIN_CONFIGS } from './domainLogic.ts';
import {
  reflectVelocityOffCircularBoundary,
  stepMarjohnDomainTornadoVelocity,
} from './combatMath.ts';
import { LocalRoomSession } from './localRoomClient.ts';
import { ASCENDED_ABILITIES, type ServerMessage } from '../shared/gameData.ts';

function getLatestSnapshot(msgs: ServerMessage[]) {
  const snaps = msgs.filter(
    (m): m is Extract<ServerMessage, { type: 'game:snapshot' }> => m.type === 'game:snapshot'
  );
  return snaps[snaps.length - 1]?.snapshot;
}

test('Fix #1 & #9: Domain +5s durations (JM, Prime, Damen = 15s) and universal Ascended 20s cooldown spec', () => {
  assert.equal(DOMAIN_CONFIGS.jm.durationSec, 15);
  assert.equal(DOMAIN_CONFIGS.prime.durationSec, 15);
  assert.equal(DOMAIN_CONFIGS.damen.durationSec, 15);
  assert.equal(DOMAIN_CONFIGS.khen.durationSec, 10);
  assert.equal(DOMAIN_CONFIGS.marjohn.durationSec, 10);

  for (const fid of ['khen', 'prime', 'damen', 'marjohn', 'jm'] as const) {
    assert.equal(
      ASCENDED_ABILITIES[fid].cooldown,
      20.0,
      `Expected ${fid} Ascended Key 5 cooldown to be 20.0s`
    );
  }
});

test('Fix #2 & #3 pure math: Damen Domain circular wall reflection and Marjohn tornado far-homing -> close linear lock', () => {
  // Pure circular boundary reflection v' = v - 2(v·n)n
  const reflected = reflectVelocityOffCircularBoundary({
    x: 12.1,
    z: 0,
    vx: 20,
    vz: 8,
    centerX: 0,
    centerZ: 0,
    boundaryRadius: 12,
  });
  assert.equal(reflected.reflected, true);
  assert.ok(reflected.vx < -19, `Expected reflected vx < -19, got ${reflected.vx}`);
  assert.ok(Math.abs(reflected.vz - 8) < 0.01);
  assert.ok(Math.hypot(reflected.x, reflected.z) <= 12);

  // Pure Marjohn Domain tornado: homes gently at far range (> 6.5m)
  const farRes = stepMarjohnDomainTornadoVelocity({
    px: 0,
    pz: 0,
    vx: 10,
    vz: 0,
    tx: 12,
    tz: 6,
    speed: 10,
    turnRate: 2.2,
    dt: 0.05,
    alreadyLocked: false,
    lockRange: 6.5,
  });
  assert.equal(farRes.locked, false);
  assert.ok(farRes.vz > 0, 'Expected far-range tornado to curve toward +Z target');

  // Within medium-to-near distance (<= 6.5m), locks linear direction permanently
  const nearLock = stepMarjohnDomainTornadoVelocity({
    px: 8,
    pz: 0,
    vx: 10,
    vz: 1,
    tx: 12,
    tz: 3,
    speed: 10.05,
    turnRate: 2.2,
    dt: 0.05,
    alreadyLocked: false,
    lockRange: 6.5,
  });
  assert.equal(nearLock.locked, true);
  const lockedVx = nearLock.vx;
  const lockedVz = nearLock.vz;

  // Even if target dashes perpendicular afterward, velocity remains locked in straight line
  const afterDodge = stepMarjohnDomainTornadoVelocity({
    px: 9,
    pz: 0.1,
    vx: lockedVx,
    vz: lockedVz,
    tx: 9,
    tz: -10,
    speed: 10.05,
    turnRate: 2.2,
    dt: 0.05,
    alreadyLocked: true,
    lockRange: 6.5,
  });
  assert.equal(afterDodge.locked, true);
  assert.ok(Math.abs(afterDodge.vx - lockedVx) < 1e-6);
  assert.ok(Math.abs(afterDodge.vz - lockedVz) < 1e-6);
});

test('Fix #2 live: Damen Domain bullets are non-homing, persistent, bounce off Domain barrier, and clear on expiry', () => {
  const msgs: ServerMessage[] = [];
  const session = new LocalRoomSession({
    autoTick: false,
    onMessage: (m) => msgs.push(m),
  });
  try {
    session.send({
      type: 'room:create',
      playerName: 'DamenTester',
      isSoloPractice: false,
      isTrainingMode: true,
    });
    session.send({ type: 'room:selectFighter', fighterId: 'damen' });
    session.send({ type: 'room:startNow' });
    session.send({ type: 'game:trainingConfig', dummyEnabled: true, zeroCooldowns: false });
    session.send({ type: 'game:debug', action: 'fillDomain' });

    let t = Date.now() + 50;
    session.stepNow(t);
    session.send({ type: 'game:domainActivate' });

    // Wait for Damen 5.0s domain cast to finish
    for (let i = 0; i < 115; i++) {
      t += 50;
      session.stepNow(t);
      if (getLatestSnapshot(msgs)?.activeDomain?.fighterId === 'damen') break;
    }

    const domStartSnap = getLatestSnapshot(msgs);
    assert.equal(domStartSnap?.activeDomain?.fighterId, 'damen');
    assert.ok((domStartSnap?.activeDomain?.remaining ?? 0) > 13.5, 'Expected Damen Domain to have 15s duration');

    // Aim away from center (-Z/diagonal) and fire M1 + Skill 1 inside Damen Domain
    session.send({
      type: 'game:ability',
      seq: 1,
      slot: 0,
      aimYaw: -Math.PI * 0.5,
      aimPitch: 0,
    });
    session.send({
      type: 'game:ability',
      seq: 2,
      slot: 2,
      aimYaw: Math.PI * 0.75,
      aimPitch: 0,
    });
    for (let i = 0; i < 6; i++) {
      t += 50;
      session.stepNow(t);
    }

    const midSnap = getLatestSnapshot(msgs);
    const domProjectiles = (midSnap?.projectiles ?? []).filter((p) => p.isDomainRicochet);
    assert.ok(domProjectiles.length >= 1, 'Expected Damen Domain bullets to carry isDomainRicochet highlight');
    for (const dp of domProjectiles) {
      assert.equal(dp.isHoming, false, 'Damen Domain bullets must NEVER home');
    }
    const trackedId = domProjectiles[0].id;

    // Advance 4.0 seconds (80 ticks) — indefinite ricochet bullets must STILL be alive inside the Domain
    for (let i = 0; i < 80; i++) {
      t += 50;
      session.stepNow(t);
    }
    const laterSnap = getLatestSnapshot(msgs);
    assert.ok(laterSnap?.activeDomain, 'Damen 15s Domain should still be active');
    assert.ok(
      laterSnap?.projectiles.some((p) => p.id === trackedId),
      'Damen Domain ricochet bullet must persist indefinitely while Domain is active'
    );

    // Advance until Damen Domain expires -> ricochet bullets must clear immediately
    for (let i = 0; i < 240; i++) {
      t += 50;
      session.stepNow(t);
      if (!getLatestSnapshot(msgs)?.activeDomain) break;
    }
    const postDomSnap = getLatestSnapshot(msgs);
    assert.equal(postDomSnap?.activeDomain ?? null, null);
    assert.equal(
      (postDomSnap?.projectiles ?? []).some((p) => p.isDomainRicochet),
      false,
      'Damen Domain ricochet bullets must clear immediately when Domain ends'
    );
  } finally {
    session.dispose();
  }
});

test('Fix #3 live: Marjohn Domain tornadoes lock linear direction inside medium-to-near range', () => {
  const msgs: ServerMessage[] = [];
  const session = new LocalRoomSession({
    autoTick: false,
    onMessage: (m) => msgs.push(m),
  });
  try {
    session.send({
      type: 'room:create',
      playerName: 'MarjohnDomTester',
      isSoloPractice: false,
      isTrainingMode: true,
    });
    session.send({ type: 'room:selectFighter', fighterId: 'marjohn' });
    session.send({ type: 'room:startNow' });
    session.send({ type: 'game:trainingConfig', dummyEnabled: true, zeroCooldowns: false });
    session.send({ type: 'game:debug', action: 'fillDomain' });

    let t = Date.now() + 50;
    session.stepNow(t);
    session.send({ type: 'game:domainActivate' });

    let sawLockedTornado = false;
    for (let i = 0; i < 200; i++) {
      t += 50;
      session.stepNow(t);
      const snap = getLatestSnapshot(msgs);
      if (snap?.projectiles.some((p) => (p.kind === 'tornado' || p.kind === 'tornadoVortex') && p.homingLocked)) {
        sawLockedTornado = true;
        break;
      }
    }
    assert.equal(
      sawLockedTornado,
      true,
      'Expected Marjohn Domain tornadoes to enter linear direction-lock near enemies'
    );
  } finally {
    session.dispose();
  }
});

test('Fix #4: Marjohn Skill 2 Suction Vortex + Sky Thunder Recast & Skill 3 Typhoon Buff (Base + Awakened)', () => {
  const msgs: ServerMessage[] = [];
  const session = new LocalRoomSession({
    autoTick: false,
    onMessage: (m) => msgs.push(m),
  });
  try {
    session.send({
      type: 'room:create',
      playerName: 'MarjohnTester',
      isSoloPractice: false,
      isTrainingMode: true,
    });
    session.send({ type: 'room:selectFighter', fighterId: 'marjohn' });
    session.send({ type: 'room:startNow' });
    session.send({ type: 'game:trainingConfig', dummyEnabled: true, zeroCooldowns: false });
    session.send({ type: 'game:debug', action: 'resetCooldowns' });

    let t = Date.now() + 50;
    session.stepNow(t);
    const initialSnap = getLatestSnapshot(msgs);
    const dummy0 = initialSnap?.actors.find((a) => a.isDummy);
    assert.ok(dummy0);

    // Cast Skill 2 aimed at dummy
    const aimYaw = Math.atan2(dummy0.x - initialSnap!.actors[0].x, dummy0.z - initialSnap!.actors[0].z);
    session.send({
      type: 'game:ability',
      seq: 1,
      slot: 3,
      aimYaw,
      aimPitch: 0,
      aimX: dummy0.x,
      aimZ: dummy0.z,
    });
    for (let i = 0; i < 12; i++) {
      t += 50;
      session.stepNow(t);
    }

    const cast1Snap = getLatestSnapshot(msgs);
    const p1Stage = cast1Snap?.actors[0];
    assert.equal(p1Stage?.stage2Slot, 3);
    assert.equal(p1Stage?.stage2Label, 'THUNDER');
    assert.ok(
      cast1Snap?.zones.some((z) => z.kind === 'galeSnare'),
      'Expected Marjohn Skill 2 Cast 1 to spawn suction galeSnare vortex'
    );

    // Recast Skill 2 -> overhead lightning/thunder strike + knock-up
    session.send({
      type: 'game:ability',
      seq: 2,
      slot: 3,
      aimYaw,
      aimPitch: 0,
    });
    for (let i = 0; i < 9; i++) {
      t += 50;
      session.stepNow(t);
    }

    const sawThunder = msgs.some(
      (m) =>
        m.type === 'game:snapshot' &&
        m.events.some((e) => e.kind === 'lightning' && e.callout === 'THUNDER STRIKE!')
    );
    assert.equal(sawThunder, true, 'Expected Marjohn Skill 2 recast to call down Sky Thunder strike');

    // Cast Base Skill 3 -> buffed cat5Typhoon funnel + explosive upward launch finisher
    session.send({ type: 'game:debug', action: 'resetCooldowns' });
    t += 50;
    session.stepNow(t);
    session.send({
      type: 'game:ability',
      seq: 3,
      slot: 4,
      aimYaw,
      aimPitch: 0,
      aimX: dummy0.x,
      aimZ: dummy0.z,
    });
    for (let i = 0; i < 10; i++) {
      t += 50;
      session.stepNow(t);
    }
    const baseTyphoonSnap = getLatestSnapshot(msgs);
    const typhoonZone = baseTyphoonSnap?.zones.find((z) => z.kind === 'cat5Typhoon');
    assert.ok(typhoonZone && typhoonZone.radius >= 6.0, 'Expected Base Skill 3 to summon buffed >=6m cat5Typhoon');

    // Also test Awakened Skill 3 buffed cat5Typhoon
    session.send({ type: 'game:debug', action: 'awakenP1' });
    session.send({ type: 'game:debug', action: 'resetCooldowns' });
    for (let i = 0; i < 20; i++) {
      t += 50;
      session.stepNow(t);
    }
    session.send({
      type: 'game:ability',
      seq: 4,
      slot: 4,
      aimYaw,
      aimPitch: 0,
      aimX: dummy0.x,
      aimZ: dummy0.z,
    });
    for (let i = 0; i < 10; i++) {
      t += 50;
      session.stepNow(t);
    }
    const awkTyphoonSnap = getLatestSnapshot(msgs);
    const awkZone = awkTyphoonSnap?.zones.find((z) => z.kind === 'cat5Typhoon');
    assert.ok(awkZone && awkZone.radius >= 7.0, 'Expected Awakened Skill 3 to summon buffed >=7m cat5Typhoon');
  } finally {
    session.dispose();
  }
});

test('Fix #5: Damen Skill 2 Hold places permanent circular Solar Tripwire until triggered', () => {
  const msgs: ServerMessage[] = [];
  const session = new LocalRoomSession({
    autoTick: false,
    onMessage: (m) => msgs.push(m),
  });
  try {
    session.send({
      type: 'room:create',
      playerName: 'TrapTester',
      isSoloPractice: false,
      isTrainingMode: true,
    });
    session.send({ type: 'room:selectFighter', fighterId: 'damen' });
    session.send({ type: 'room:startNow' });
    session.send({ type: 'game:trainingConfig', dummyEnabled: true, zeroCooldowns: false });
    session.send({ type: 'game:debug', action: 'resetCooldowns' });

    let t = Date.now() + 50;
    session.stepNow(t);
    const snap0 = getLatestSnapshot(msgs);
    const p1 = snap0?.actors[0];
    assert.ok(p1);

    // Place Hold Solar Tripwire behind Damen (away from dummy at -5)
    session.send({
      type: 'game:ability',
      seq: 1,
      slot: 3,
      aimYaw: 0,
      aimPitch: 0,
      isHoldVariant: true,
      aimX: 12,
      aimZ: 12,
    });
    for (let i = 0; i < 12; i++) {
      t += 50;
      session.stepNow(t);
    }

    const trapSnap = getLatestSnapshot(msgs);
    const circleTrap = trapSnap?.zones.find((z) => z.kind === 'solarTripwire');
    assert.ok(circleTrap, 'Expected Hold Skill 2 to plant a solarTripwire zone');
    assert.equal(circleTrap.permanent, true, 'Circular Solar Tripwire must be permanent');
    assert.equal(circleTrap.endX, undefined, 'Circular Solar Tripwire uses circle radius rather than line');

    // Wait 12 full seconds (240 ticks) — trap MUST still exist permanently until stepped on
    for (let i = 0; i < 240; i++) {
      t += 50;
      session.stepNow(t);
    }
    const stillThereSnap = getLatestSnapshot(msgs);
    assert.ok(
      stillThereSnap?.zones.some((z) => z.id === circleTrap.id),
      'Circular Solar Tripwire must NEVER expire by time'
    );
  } finally {
    session.dispose();
  }
});

test('Fix #6 & #7: Khen Hold Skill 2 shoots Moon Blade + Awakened Swap works + Skill 3 Ult 2-Dash Recast', () => {
  const msgs: ServerMessage[] = [];
  const session = new LocalRoomSession({
    autoTick: false,
    onMessage: (m) => msgs.push(m),
  });
  try {
    session.send({
      type: 'room:create',
      playerName: 'KhenTester',
      isSoloPractice: false,
      isTrainingMode: true,
    });
    session.send({ type: 'room:selectFighter', fighterId: 'khen' });
    session.send({ type: 'room:startNow' });
    session.send({ type: 'game:trainingConfig', dummyEnabled: true, zeroCooldowns: false });
    session.send({ type: 'game:debug', action: 'resetCooldowns' });

    let t = Date.now() + 50;
    session.stepNow(t);

    // 1. Base Form Hold Skill 2 MUST still fire crescent Moon Blade AND allow Stage 2
    session.send({
      type: 'game:ability',
      seq: 1,
      slot: 3,
      aimYaw: 0,
      aimPitch: 0,
      isHoldVariant: true,
    });
    for (let i = 0; i < 10; i++) {
      t += 50;
      session.stepNow(t);
    }
    const baseHoldSnap = getLatestSnapshot(msgs);
    assert.ok(
      baseHoldSnap?.projectiles.some((p) => p.kind === 'crescent'),
      'Base Khen Hold Skill 2 must still shoot Moon Blade'
    );
    assert.equal(baseHoldSnap?.actors[0].stage2Slot, 3, 'Base Khen Hold Skill 2 opens Stage 2 teleport');

    // Close Base Stage 2 before testing Awakened Khen Hold Skill 2 -> Awakened Stage 2 Swap
    for (let i = 0; i < 75; i++) {
      t += 50;
      session.stepNow(t);
    }

    // 2. Awakened Form Hold Skill 2 shoots Moon Blades AND Shadow Swap teleport works cleanly
    session.send({ type: 'game:debug', action: 'awakenP1' });
    session.send({ type: 'game:debug', action: 'resetCooldowns' });
    for (let i = 0; i < 20; i++) {
      t += 50;
      session.stepNow(t);
    }

    const preAwkHold = getLatestSnapshot(msgs)!.actors[0];
    session.send({
      type: 'game:ability',
      seq: 2,
      slot: 3,
      aimYaw: 0,
      aimPitch: 0,
      isHoldVariant: true,
      aimX: preAwkHold.x,
      aimZ: preAwkHold.z + 6,
    });
    for (let i = 0; i < 10; i++) {
      t += 50;
      session.stepNow(t);
    }
    const awkHoldSnap = getLatestSnapshot(msgs)!;
    assert.ok(
      awkHoldSnap.projectiles.some((p) => p.kind === 'crescent'),
      'Awakened Khen Hold Skill 2 must shoot Moon Blade'
    );
    assert.equal(awkHoldSnap.actors[0].stage2Slot, 3, 'Awakened Khen Skill 2 must open Stage 2 teleport');

    const beforeSwapX = awkHoldSnap.actors[0].x;
    const beforeSwapZ = awkHoldSnap.actors[0].z;
    // Stage 2 Shadow Teleport
    session.send({
      type: 'game:ability',
      seq: 3,
      slot: 3,
      aimYaw: 0,
      aimPitch: 0,
    });
    for (let i = 0; i < 4; i++) {
      t += 50;
      session.stepNow(t);
    }
    const afterSwap = getLatestSnapshot(msgs)!.actors[0];
    assert.ok(
      Math.hypot(afterSwap.x - beforeSwapX, afterSwap.z - beforeSwapZ) > 2.5,
      'Awakened Khen Stage 2 teleport must blink Khen cleanly'
    );

    // 3. Skill 3 Ult 2-Dash Recast (Awakened): Cast 1 opens recast window with cooldowns[4] ~ 0, Cast 2 costs 0 Chi and dashes again then sets CD
    session.send({ type: 'game:debug', action: 'resetCooldowns' });
    t += 50;
    session.stepNow(t);
    session.send({
      type: 'game:ability',
      seq: 4,
      slot: 4,
      aimYaw: Math.PI * 0.5,
      aimPitch: 0,
    });
    for (let i = 0; i < 7; i++) {
      t += 50;
      session.stepNow(t);
    }
    const afterDash1 = getLatestSnapshot(msgs)!.actors[0];
    assert.ok(
      (afterDash1.khenUltRecastRemaining ?? 0) > 1.5,
      'Khen Ult Cast 1 must open 3s 2nd-dash recast window'
    );
    assert.equal(afterDash1.cooldowns[4], 0, 'Khen Ult cooldown stays 0 during recast window');

    const manaBeforeDash2 = afterDash1.mana;
    session.send({
      type: 'game:ability',
      seq: 5,
      slot: 4,
      aimYaw: -Math.PI * 0.5,
      aimPitch: 0,
    });
    for (let i = 0; i < 3; i++) {
      t += 50;
      session.stepNow(t);
    }
    const afterDash2 = getLatestSnapshot(msgs)!.actors[0];
    assert.ok(
      afterDash2.mana >= manaBeforeDash2 - 0.1,
      'Khen Ult 2nd dash recast must be free (0 Chi)'
    );
    assert.equal(afterDash2.khenUltRecastRemaining ?? 0, 0);
    assert.ok(afterDash2.cooldowns[4] > 5.0, 'Khen Ult enters full cooldown after 2nd dash');
  } finally {
    session.dispose();
  }
});

test('Fix #8 & #9: Damen Overhead Halo Guns (10s, auto-aim on shot with ZERO homing) & Universal 20s Post-Duration Key 5 Cooldown', () => {
  // Part A: Damen Key 5 10s overhead halo guns + paused 20s cooldown + straight-line auto-aim at fire instant
  const msgs: ServerMessage[] = [];
  const session = new LocalRoomSession({
    autoTick: false,
    onMessage: (m) => msgs.push(m),
  });
  try {
    session.send({
      type: 'room:create',
      playerName: 'DamenKey5',
      isSoloPractice: false,
      isTrainingMode: true,
    });
    session.send({ type: 'room:selectFighter', fighterId: 'damen' });
    session.send({ type: 'room:selectSkin', skinId: 'ascended' });
    session.send({ type: 'room:startNow' });
    session.send({ type: 'game:trainingConfig', dummyEnabled: true, zeroCooldowns: false });
    session.send({ type: 'game:debug', action: 'resetCooldowns' });

    let t = Date.now() + 50;
    session.stepNow(t);
    const initialSnap = getLatestSnapshot(msgs)!;
    const damenInit = initialSnap.actors.find((a) => a.fighterId === 'damen')!;
    const dummyInit = initialSnap.actors.find((a) => a.playerId !== damenInit.playerId)!;
    assert.ok(dummyInit, 'Expected training dummy');

    // Aim away (+Z, yaw=0) so if auto-aim works at fire instant, gun shots still fire toward dummy
    session.send({
      type: 'game:ability',
      seq: 1,
      slot: 7,
      aimYaw: 0,
      aimPitch: 0,
    });
    for (let i = 0; i < 30; i++) {
      t += 50;
      session.stepNow(t);
    }

    const snap1 = getLatestSnapshot(msgs)!;
    const damen = snap1.actors.find((a) => a.fighterId === 'damen')!;
    const turrets1 = snap1.turrets ?? [];
    assert.equal(turrets1.length, 3, 'Expected 3 Damen solar_gun turrets');
    for (const g of turrets1) {
      assert.ok(g.y > damen.y + 1.9, 'Expected solar_gun turrets clearly overhead above Damen head');
      assert.ok(g.remaining <= 10.0, 'Expected solar_gun 10s max lifespan');
    }
    assert.equal(damen.ascendedCooldownPaused, true, 'Key 5 cooldown must stay paused while guns are active');
    assert.equal(damen.cooldowns[7], 20, 'Paused Key 5 cooldown holds at 20.0s during active duration');

    // Check fired gun shots: aim straight toward dummy at fire instant with ZERO homing
    const gunShots = snap1.projectiles.filter((p) => p.ownerId === damen.playerId);
    assert.ok(gunShots.length > 0, 'Expected overhead gun shots fired toward nearest enemy');
    const trackedShot = gunShots[0];
    const origVx = trackedShot.vx;
    const origVy = trackedShot.vy ?? 0;
    const origVz = trackedShot.vz;
    for (const s of gunShots) {
      assert.equal(s.isHoming, false, 'Damen Key 5 halo gun bullets must never curve or home');
      // Direction from shot origin (turret fire instant) toward dummyInit must be strongly aligned
      const toDummyX = dummyInit.x - (s.originX ?? damenInit.x);
      const toDummyZ = dummyInit.z - (s.originZ ?? damenInit.z);
      const dot = s.vx * toDummyX + s.vz * toDummyZ;
      assert.ok(dot > 0, 'Overhead gun bullet must be aimed toward the nearest enemy at fire instant');
    }

    // Step forward while trackedShot is in flight -> zero curving / homing!
    session.send({ type: 'game:input', seq: 2, moveX: 0, moveZ: 0, aimYaw: 0 });
    t += 50;
    session.stepNow(t);
    const snapMidFlight = getLatestSnapshot(msgs)!;
    const stillFlying = snapMidFlight.projectiles.find((p) => p.id === trackedShot.id);
    if (stillFlying) {
      assert.equal(stillFlying.vx, origVx, 'In-flight vx must remain strictly constant (no homing)');
      assert.equal(stillFlying.vy ?? 0, origVy, 'In-flight vy must remain strictly constant (no homing)');
      assert.equal(stillFlying.vz, origVz, 'In-flight vz must remain strictly constant (no homing)');
    }

    // Advance past 10s so halo guns expire -> Key 5 cooldown begins counting down from 20s
    for (let i = 0; i < 190; i++) {
      t += 50;
      session.stepNow(t);
    }
    const postExpireSnap = getLatestSnapshot(msgs)!;
    assert.equal((postExpireSnap.turrets ?? []).length, 0, 'Damen halo guns expire after 10s');
    const damenAfter = postExpireSnap.actors.find((a) => a.fighterId === 'damen')!;
    assert.equal(damenAfter.ascendedCooldownPaused, false);
    const cd7After = damenAfter.cooldowns[7] ?? 0;
    assert.ok(
      cd7After < 19.9 && cd7After > 15.0,
      `Expected Key 5 20s cooldown to begin counting down only after 10s guns expire, got ${cd7After}`
    );
  } finally {
    session.dispose();
  }

  // Part B: Khen Abyssal Clone Key 5 holds 20s CD paused until Clone dies, while SWAP stays playable
  const msgsK: ServerMessage[] = [];
  const sessionK = new LocalRoomSession({
    autoTick: false,
    onMessage: (m) => msgsK.push(m),
  });
  try {
    sessionK.send({
      type: 'room:create',
      playerName: 'KhenKey5',
      isSoloPractice: false,
      isTrainingMode: true,
    });
    sessionK.send({ type: 'room:selectFighter', fighterId: 'khen' });
    sessionK.send({ type: 'room:selectSkin', skinId: 'ascended' });
    sessionK.send({ type: 'room:startNow' });
    sessionK.send({ type: 'game:trainingConfig', dummyEnabled: true, zeroCooldowns: false });
    sessionK.send({ type: 'game:debug', action: 'resetCooldowns' });

    let t = Date.now() + 50;
    sessionK.stepNow(t);
    sessionK.send({ type: 'game:ability', seq: 1, slot: 7, aimYaw: 0, aimPitch: 0 });
    for (let i = 0; i < 25; i++) {
      t += 50;
      sessionK.stepNow(t);
    }

    const activeSnap = getLatestSnapshot(msgsK)!;
    const clones = activeSnap.abyssalClones ?? [];
    assert.equal(clones.length, 1);
    assert.equal(activeSnap.actors[0].ascendedCloneAlive, true);
    assert.equal(activeSnap.actors[0].ascendedCooldownPaused, true);
    assert.equal(activeSnap.actors[0].cooldowns[7], 20);

    // Swap works even while cooldowns[7] is paused at 20.0!
    const xBeforeSwap = activeSnap.actors[0].x;
    const zBeforeSwap = activeSnap.actors[0].z;
    const clonePos = clones[0];
    sessionK.send({ type: 'game:ability', seq: 2, slot: 7, aimYaw: 0, aimPitch: 0 });
    t += 50;
    sessionK.stepNow(t);
    const swapped = getLatestSnapshot(msgsK)!;
    assert.ok(
      Math.hypot(swapped.actors[0].x - clonePos.x, swapped.actors[0].z - clonePos.z) < 0.8 &&
        Math.hypot(swapped.actors[0].x - xBeforeSwap, swapped.actors[0].z - zBeforeSwap) > 0.2,
      'Expected Khen Clone Swap to succeed cleanly even while Key 5 20s CD is paused'
    );
  } finally {
    sessionK.dispose();
  }
});
