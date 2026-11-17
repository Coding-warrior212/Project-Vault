import assert from 'node:assert/strict';
import test from 'node:test';
import { isVerifiedWorkspaceUser } from './geminiAuth';

const USER_ID = '2d931510-d99f-494a-8c67-87feb05e1594';

test('Gemini authorization accepts only a valid explicitly non-anonymous user', () => {
  assert.equal(isVerifiedWorkspaceUser({ id: USER_ID, is_anonymous: false }), true);
  assert.equal(isVerifiedWorkspaceUser({ id: USER_ID, is_anonymous: true }), false);
  assert.equal(isVerifiedWorkspaceUser({ id: USER_ID }), false);
  assert.equal(isVerifiedWorkspaceUser({ id: 'not-a-uuid', is_anonymous: false }), false);
  assert.equal(isVerifiedWorkspaceUser(null), false);
  assert.equal(isVerifiedWorkspaceUser(undefined), false);
});
