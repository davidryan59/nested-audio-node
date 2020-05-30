import { NestedAudioNode, packageName } from '../src';

test('test NestedAudioNode in index.js', () => {
  const node1 = new NestedAudioNode();
  expect(!!node1).toBeTruthy();
});

test('test packageName in index.js', () => {
  expect(packageName).toEqual('nested-audio-node');
});
