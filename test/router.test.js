const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { route } = require('../src/router');

let api;

beforeEach(() => {
  api = {
    getChildren: async () => [],
    getParent2: async () => null,
  };
});

test('zero children leads to parent2 creation', async () => {
  api.getChildren = async () => [];
  api.getParent2 = async () => null;

  const url = await route(
    { after: 'parent1', accountId: 'A1', parent1Email: 'p1@example.com' },
    api
  );

  assert.equal(url, '/parent2/create?accountid=A1');
});

test('multiple children routes to first child with remaining list', async () => {
  api.getChildren = async () => [
    { contactid: 'c1' },
    { contactid: 'c2' },
    { contactid: 'c3' },
  ];

  const url = await route(
    { after: 'parent1', accountId: 'A1', parent1Email: 'p1@example.com' },
    api
  );

  assert.equal(url, '/eleve?eleveid=c1&remaining=c2,c3');
});

test('existing parent2 routes to edit step', async () => {
  api.getChildren = async () => [];
  api.getParent2 = async () => ({ contactid: 'p2' });

  const url = await route(
    { after: 'parent1', accountId: 'A1', parent1Email: 'p1@example.com' },
    api
  );

  assert.equal(url, '/parent2/edit?parent2id=p2');
});

test('parent2 creation after children loop completes', async () => {
  api.getParent2 = async () => null;

  const url = await route(
    { after: 'eleve', accountId: 'A1', parent1Email: 'p1@example.com', remaining: '' },
    api
  );

  assert.equal(url, '/parent2/create?accountid=A1');
});

