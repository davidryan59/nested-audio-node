let id = 0;
class NestedAudioNode {
  constructor(data) {
    this.id = id;
    id += 1;
    this.data = data; // Placeholder
    Object.freeze(this);
  }
}

export default NestedAudioNode;
