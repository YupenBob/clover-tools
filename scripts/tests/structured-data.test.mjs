import test from 'node:test';
import assert from 'node:assert/strict';
import { structuredData, auditBreadcrumbs } from '../lib/structured-data.mjs';

const origin = 'https://test.example';
const canonical = origin + '/guides/example/';
const valid = () => ({ '@type': 'BreadcrumbList', itemListElement: [
  { '@type': 'ListItem', position: 1, name: '首页', item: origin + '/' },
  { '@type': 'ListItem', position: 2, name: '示例', item: canonical },
] });
test('breadcrumb parser accepts arrays, graph nodes and schema type arrays', () => {
  const breadcrumb = valid(); breadcrumb['@type'] = ['BreadcrumbList', 'Thing'];
  const result = structuredData(`<script type="application/ld+json">${JSON.stringify([{ '@graph': [breadcrumb] }])}</script>`);
  assert.deepEqual(result.problems, []);
  assert.deepEqual(auditBreadcrumbs(result.nodes, canonical, origin), []);
  assert.deepEqual(structuredData('<script>not JSON</script>').nodes, []);
  assert.equal(structuredData('<script type="application/ld+json">{broken</script>').problems.length, 1);
});
test('last breadcrumb can omit item; named Thing objects can provide item and name', () => {
  const breadcrumb = valid(); delete breadcrumb.itemListElement[1].item;
  assert.deepEqual(auditBreadcrumbs([breadcrumb], canonical, origin), []);
  const first = breadcrumb.itemListElement[0]; delete first.name;
  first.item = { '@id': origin + '/', name: 'Home' };
  assert.deepEqual(auditBreadcrumbs([breadcrumb], canonical, origin), []);
});
test('breadcrumbs reject missing names, duplicate positions, malformed items and foreign or mismatched URLs', () => {
  const mutations = [
    b => { b.itemListElement = []; },
    b => { b.itemListElement = null; },
    b => { b.itemListElement[0] = null; },
    b => { delete b.itemListElement[0].item; },
    b => { b.itemListElement[1].name = ''; },
    b => { b.itemListElement[1].position = 1; },
    b => { b.itemListElement[0].position = '1'; },
    b => { b.itemListElement[0]['@type'] = 'Thing'; },
    b => { b.itemListElement[0].item = '/'; },
    b => { b.itemListElement[0].item = 'https://attacker.example/'; },
    b => { b.itemListElement[1].item = origin + '/other/'; },
    b => { b.itemListElement[0].item = origin + '/?token=example'; },
    b => { b.itemListElement[0].item = { name: 'Home' }; },
  ];
  for (const mutate of mutations) {
    const breadcrumb = valid(); mutate(breadcrumb);
    assert.ok(auditBreadcrumbs([breadcrumb], canonical, origin).length, String(mutate));
  }
});
