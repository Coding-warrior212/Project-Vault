import test from 'node:test';
import assert from 'node:assert/strict';
import { assertAffectedRows } from './cloudMutation';

test('accepts a mutation result containing affected rows', () => {
  assert.doesNotThrow(() => assertAffectedRows([{ id: 'row-1' }], 'not saved'));
});

test('rejects a zero-row mutation even when PostgREST returned no error', () => {
  assert.throws(
    () => assertAffectedRows([], 'Shared handover was not saved.'),
    { message: 'Shared handover was not saved.' },
  );
});


test('accepts a batch mutation when every expected row is returned', () => {
  assert.doesNotThrow(() => assertAffectedRows(
    [{ id: 'row-1' }, { id: 'row-2' }],
    'not all rows saved',
    2,
  ));
});

test('rejects a partially applied batch mutation', () => {
  assert.throws(
    () => assertAffectedRows([{ id: 'row-1' }], 'Not all records were saved.', 2),
    { message: 'Not all records were saved.' },
  );
});

test('rejects missing mutation data', () => {
  assert.throws(
    () => assertAffectedRows(null, 'Claim was not updated.'),
    { message: 'Claim was not updated.' },
  );
});
