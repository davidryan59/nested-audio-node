// import { NestedAudioNode, packageName } from '../src';
import { packageName } from '../src';

// Currently Tone does not run in Terminal...
// ...going to have to do browser-based tests
// like in the Tone.js module itself.

// test('test NestedAudioNode in index.js', () => {
//   const node1 = new NestedAudioNode();
//   expect(!!node1).toBeTruthy();
// });

test('test packageName in index.js', () => {
  expect(packageName).toEqual('nested-audio-node');
});
