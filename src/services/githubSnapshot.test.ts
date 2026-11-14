import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchPublicGitHubSnapshot } from './githubSnapshot';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test('public GitHub snapshot pins the selected branch to a commit and includes docs', async () => {
  const calls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input); calls.push(url);
    if (url.endsWith('/repos/example/project')) return new Response(JSON.stringify({ private:false, default_branch:'main', description:'Example project' }), {status:200});
    if (url.endsWith('/commits/main')) return new Response(JSON.stringify({ sha:'a'.repeat(40) }), {status:200});
    if (url.includes('/git/trees/')) return new Response(JSON.stringify({ tree:[
      {type:'blob',path:'README.md'},{type:'blob',path:'docs/design.md'},{type:'blob',path:'src/index.ts'}
    ] }), {status:200});
    if (url.includes('/README.md')) return new Response('# Example\nPublic readme', {status:200});
    if (url.includes('/docs/design.md')) return new Response('# Design\nArchitecture notes', {status:200});
    return new Response('not found', {status:404});
  }) as typeof fetch;

  const result = await fetchPublicGitHubSnapshot('https://github.com/example/project', 'main');
  assert.equal(result.owner, 'example');
  assert.equal(result.repo, 'project');
  assert.equal(result.commitSha, 'a'.repeat(40));
  assert.equal(result.filesIncluded, 2);
  assert.match(result.snapshot, /Public readme/);
  assert.match(result.snapshot, /Architecture notes/);
  assert.ok(calls.some((url) => url.includes('/git/trees/' + 'a'.repeat(40))));
});

test('private GitHub repositories fail closed without a credentialed connector', async () => {
  globalThis.fetch = (async () => new Response(JSON.stringify({ private:true, default_branch:'main' }), {status:200})) as typeof fetch;
  await assert.rejects(
    () => fetchPublicGitHubSnapshot('https://github.com/example/private-project'),
    /Private repositories/
  );
});
