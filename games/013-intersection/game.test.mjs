import test from 'node:test'; import assert from 'node:assert/strict';
import { scriptsOf, redactCity, commonWord } from './game.js';
import { findJunctions } from './build/build.mjs';
test('scripts', () => {
  assert.deepEqual(scriptsOf(['长安街', '王府井大街']), ['汉字']);
  assert.match(scriptsOf(['Rue de Rivoli', 'Avenue de l’Opéra'])[0], /é/);
  assert.ok(scriptsOf(['Тверская улица']).includes('西里尔字母'));
  assert.match(scriptsOf(['Oxford Street'])[0], /无变音/);
});
test('redact', () => { assert.equal(redactCity('Rue de Paris', { city: 'Paris', zh: '巴黎' }), 'Rue de ▇▇▇'); });
test('common word', () => {
  assert.deepEqual(commonWord(['Rue A', 'Rue B', 'Foo']), { word: 'Rue', count: 2 });
  assert.equal(commonWord(['A one', 'B two']), null);
});
test('junctions', () => {
  const w = (n, g) => ({ n, g });
  const c = [0, 0];
  const J = findJunctions([w('A', [c, [1, 1]]), w('B', [c, [1, 2]]), w('C', [c, [2, 2]]), w('D', [[3, 3], c]), w('E', [[5, 5], [6, 6]])]);
  assert.equal(J.length, 1); assert.equal(J[0].names.size, 4);
});
