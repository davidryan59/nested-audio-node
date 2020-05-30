import NestedAudioNode from '../src/NestedAudioNode';

describe('Test NestedAudioNode with empty constructor', () => {
  const tf = {};
  beforeEach(() => {
    tf.node0 = new NestedAudioNode();
  });
  test('', () => { expect(tf.node0).toBeTruthy(); });
});
