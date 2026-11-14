import test from 'node:test';
import assert from 'node:assert/strict';
import { getScopedLocalStorageKey, setLocalStorageScope } from './db';

test('default browser storage preserves existing ProjectVault keys', () => {
  setLocalStorageScope('default');
  assert.equal(getScopedLocalStorageKey('projectvault_claims'), 'projectvault_claims');
  assert.equal(getScopedLocalStorageKey('projectvault_handover_approved'), 'projectvault_handover_approved');
});

test('judge demo browser storage uses a separate namespace', () => {
  try {
    setLocalStorageScope('judge-demo');
    assert.equal(getScopedLocalStorageKey('projectvault_claims'), 'projectvault_judge_demo_claims');
    assert.equal(getScopedLocalStorageKey('projectvault_handover_approved'), 'projectvault_judge_demo_handover_approved');
    assert.equal(getScopedLocalStorageKey('unrelated_key'), 'unrelated_key');
  } finally {
    setLocalStorageScope('default');
  }
});

test('switching out of judge demo restores the original storage namespace', () => {
  setLocalStorageScope('judge-demo');
  setLocalStorageScope('default');
  assert.equal(getScopedLocalStorageKey('projectvault_claims'), 'projectvault_claims');
});
