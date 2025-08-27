document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('start-form');
  if (!form) return;

  const api = {
    async getChildren(accountId) {
      try {
        const resp = await fetch(`/api/children?accountid=${encodeURIComponent(accountId)}`);
        if (!resp.ok) return [];
        return await resp.json();
      } catch {
        return [];
      }
    },
    async getParent2(accountId, parent1Email) {
      try {
        const url = `/api/parent2?accountid=${encodeURIComponent(accountId)}&email=${encodeURIComponent(parent1Email)}`;
        const resp = await fetch(url);
        if (!resp.ok) return null;
        return await resp.json();
      } catch {
        return null;
      }
    }
  };

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const accountId = document.getElementById('accountId').value.trim();
    const parent1Email = document.getElementById('parent1Email').value.trim();

    const url = await route(
      { after: 'parent1', accountId, parent1Email },
      api
    );

    window.location.href = url;
  });
});

async function route(params, api) {
  const accountId = params.accountId;
  const parent1Email = params.parent1Email;

  async function decideParent2() {
    const parent2 = await api.getParent2(accountId, parent1Email);
    if (parent2) {
      return `/parent2/edit?parent2id=${parent2.contactid}`;
    }
    return `/parent2/create?accountid=${accountId}`;
  }

  if (params.after === 'parent1') {
    const children = await api.getChildren(accountId);
    if (!children || children.length === 0) {
      return await decideParent2();
    }
    const [first, ...rest] = children;
    const remaining = rest.map(c => c.contactid).join(',');
    return `/eleve?eleveid=${first.contactid}&remaining=${remaining}`;
  }

  if (params.after === 'eleve') {
    const remaining = (params.remaining || '')
      .split(',')
      .filter(Boolean);
    if (remaining.length > 0) {
      const [next, ...rest] = remaining;
      return `/eleve?eleveid=${next}&remaining=${rest.join(',')}`;
    }
    return await decideParent2();
  }

  return '/';
}
