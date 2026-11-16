export type GitHubSnapshot = {
  owner: string;
  repo: string;
  url: string;
  branch: string;
  commitSha: string;
  description: string;
  snapshot: string;
  filesIncluded: number;
};

function parsePublicRepository(input: string) {
  let url: URL;
  try { url = new URL(input.trim().startsWith('http') ? input.trim() : 'https://' + input.trim()); }
  catch { throw new Error('Enter a valid GitHub repository URL.'); }
  if (url.hostname.toLowerCase() !== 'github.com') throw new Error('Only public github.com repositories are supported.');
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length < 2) throw new Error('Use a repository URL such as https://github.com/owner/repository.');
  const owner = parts[0], repo = parts[1].replace(/\.git$/i, '');
  if (!/^[A-Za-z0-9_.-]{1,100}$/.test(owner) || !/^[A-Za-z0-9_.-]{1,100}$/.test(repo)) throw new Error('The repository URL contains an invalid owner or repository name.');
  return { owner, repo, url: 'https://github.com/' + owner + '/' + repo };
}

async function githubJson(url: string) {
  const response = await fetch(url, { headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } });
  if (response.status === 404) throw new Error('Repository or branch not found. Check the public URL and branch name.');
  if (response.status === 403) throw new Error('GitHub API rate limit reached. Wait a little and try again.');
  if (!response.ok) throw new Error('GitHub request failed (' + response.status + ').');
  return response.json();
}

export async function fetchPublicGitHubSnapshot(input: string, requestedBranch = ''): Promise<GitHubSnapshot> {
  const { owner, repo, url } = parsePublicRepository(input);
  const repository = await githubJson('https://api.github.com/repos/' + encodeURIComponent(owner) + '/' + encodeURIComponent(repo));
  if (repository.private) throw new Error('This repository is private. Public repository snapshots only are enabled in this build.');
  const branch = requestedBranch.trim() || repository.default_branch;
  const commit = await githubJson('https://api.github.com/repos/' + encodeURIComponent(owner) + '/' + encodeURIComponent(repo) + '/commits/' + encodeURIComponent(branch));
  const commitSha = String(commit.sha || '');
  if (!/^[a-f0-9]{40}$/i.test(commitSha)) throw new Error('GitHub did not return a valid commit SHA.');
  const tree = await githubJson('https://api.github.com/repos/' + encodeURIComponent(owner) + '/' + encodeURIComponent(repo) + '/git/trees/' + commitSha + '?recursive=1');
  const files = (tree.tree || []).filter((entry: any) => entry.type === 'blob' && typeof entry.path === 'string')
    .filter((entry: any) => /(^README\.(md|txt|rst)$|^docs\/.*\.(md|txt|rst)$|\.(md|rst)$)/i.test(entry.path))
    .sort((a: any, b: any) => {
      const rank = (p: string) => /^README\./i.test(p) ? 0 : /^docs\//i.test(p) ? 1 : 2;
      return rank(a.path) - rank(b.path) || a.path.localeCompare(b.path);
    }).slice(0, 8);
  if (!files.length) throw new Error('No README or Markdown documentation files were found in this repository.');
  const sections: string[] = [];
  let total = 0;
  for (const entry of files) {
    if (total >= 180000) break;
    const rawUrl = 'https://raw.githubusercontent.com/' + owner + '/' + repo + '/' + commitSha + '/' + entry.path.split('/').map(encodeURIComponent).join('/');
    const response = await fetch(rawUrl);
    if (!response.ok) continue;
    const text = (await response.text()).slice(0, Math.min(40000, 180000 - total));
    if (!text.trim()) continue;
    sections.push('## Repository file: ' + entry.path + '\n\n' + text);
    total += text.length;
  }
  if (!sections.length) throw new Error('GitHub returned no readable documentation content for this commit.');
  const description = String(repository.description || 'Public GitHub repository');
  return { owner, repo, url, branch, commitSha, description, snapshot: '# GitHub snapshot: ' + owner + '/' + repo + '\nBranch: ' + branch + '\nCommit: ' + commitSha + '\n\n' + sections.join('\n\n---\n\n'), filesIncluded: sections.length };
}
