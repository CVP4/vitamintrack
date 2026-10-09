import assert from 'node:assert/strict';
import test from 'node:test';
import { isScheduled, millisecondsUntilNextDay, todayISO } from '../src/lib/dates.js';

test('today follows Moscow midnight independently of the computer timezone', () => {
  assert.equal(todayISO(new Date('2026-10-08T20:59:59.999Z')), '2026-10-08');
  assert.equal(todayISO(new Date('2026-10-08T21:00:00.000Z')), '2026-10-09');
});

test('the date update waits for the next Moscow midnight across month and year boundaries', () => {
  assert.equal(millisecondsUntilNextDay(new Date('2026-10-08T20:59:59.999Z')), 1);
  assert.equal(millisecondsUntilNextDay(new Date('2026-10-08T21:00:00.000Z')), 86400000);
  assert.equal(millisecondsUntilNextDay(new Date('2026-10-31T20:59:59.000Z')), 1000);
  assert.equal(millisecondsUntilNextDay(new Date('2026-12-31T20:59:59.000Z')), 1000);
});

test('only active courses within their inclusive date boundaries enter the daily plan', () => {
  const course = { status: 'active', startDate: '2026-10-09', endDate: '2026-10-11' };
  assert.equal(isScheduled(course, '2026-10-08'), false);
  assert.equal(isScheduled(course, '2026-10-09'), true);
  assert.equal(isScheduled(course, '2026-10-11'), true);
  assert.equal(isScheduled(course, '2026-10-12'), false);
  assert.equal(isScheduled({ ...course, status: 'paused' }, '2026-10-10'), false);
  assert.equal(isScheduled({ ...course, endDate: '' }, '2027-01-01'), true);
});
