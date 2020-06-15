// Currently Tone.js does not run in Terminal, e.g. it is
// impossible to make a Gain or Signal node.
// Therefore, will need to redo these tests in a
// browser-based testing utility.


// import isObject from 'is-object'

// import NestedAudioNode from '../src/NestedAudioNode';

// import testLibrary from './library'

// describe('Test NestedAudioNode with empty constructor', () => {
//   const tf = {};
//   beforeEach(() => {
//     tf.node0 = new NestedAudioNode();
//   });
//   // test('', () => { console.log(tf.node0);});
//   test('', () => { expect(tf.node0).toBeTruthy();  });
//   test('', () => { expect(isObject(tf.node0)).toBeTruthy();  });
//   test('', () => { expect(tf.node0.isNested).toBeTruthy();  });
//   test('', () => { expect(tf.node0.tag).toEqual('1') });
//   test('', () => { expect(tf.node0.type).toBeNull() });
//   test('', () => { expect(tf.node0.level).toBeNull() });
//   test('', () => { expect(tf.node0.input).toBeNull() });
//   test('', () => { expect(tf.node0.output).toBeNull() });
//   test('', () => { expect(tf.node0.contents).toEqual([]) });
//   test('', () => { expect(tf.node0.connects).toEqual([]) });
//   test('', () => { expect(tf.node0.params).toEqual({}) });
//   test('', () => { expect(tf.node0.consts).toEqual({}) });
//   test('', () => { expect(tf.node0.verbose).toBeFalsy() });
// });
//
// describe('Test verbose NestedAudioNode constructor', () => {
//   const tf = {};
//   beforeEach(() => {
//     tf.node0 = new NestedAudioNode({type: 'verbose',verbose:true});
//   });
//   // test('', () => { console.log(tf.node0);});
//   test('', () => { expect(tf.node0.verbose).toBeTruthy() });
// });
//
// describe('Test making synth from library', () => {
//   const tf = {};
//   beforeEach(() => {
//     tf.node0 = new NestedAudioNode({
//       library: testLibrary,
//       type: 'Synth4Voices',
//       verbose: false
//     });
//   });
//   test('', () => { console.log(tf.node0);});
//   // test('', () => { expect(tf.node0.verbose).toBeTruthy() });
// });

test('', () => { 'dummy test'; });
