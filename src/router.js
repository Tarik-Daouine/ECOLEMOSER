/**
 * Routing utility for the Pré-inscription flow.
 *
 * The function implements the algorithm described in README.md. It inspects
 * query parameters and uses the provided API helper to determine the next
 * page to navigate to. The API helper is expected to expose two async
 * functions:
 *   - getChildren(accountId): resolves to an array of children contacts.
 *   - getParent2(accountId, parent1Email): resolves to a contact or null.
 *
 * The function returns the URL (path + query string) of the next step.
 *
 * @param {Object} params - query string parameters from the current request.
 * @param {Object} api - API helper with getChildren and getParent2 functions.
 * @returns {Promise<string>} next route URL
 */
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
      return decideParent2();
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
    return decideParent2();
  }

  // Default: if no routing info, stay on current page
  return '/';
}

module.exports = { route };

