## nested-audio-node

[![npm version](https://badge.fury.io/js/nested-audio-node.svg)](https://badge.fury.io/js/nested-audio-node)
[![Downloads per month](https://img.shields.io/npm/dy/nested-audio-node.svg?maxAge=31536000)](https://github.com/davidryan59/nested-audio-node)
[![Build status](https://travis-ci.org/davidryan59/nested-audio-node.svg?master)](https://travis-ci.org/davidryan59)

### Classes

**NestedAudioNode** - allows Tone.js (audio) nodes to be nested, and synthesisers constructed automatically from plain javascript (or JSON) objects.

### Quick start

Do `npm install nested-audio-node` in your Javascript npm project directory. Then in a Javascript file:

``` js
import { NestedAudioNode } from 'nested-audio-node'

// Make new empty node
const node1 = new NestedAudioNode()

// Make new empty node (placeholder)
const node2 = new NestedAudioNode({ library, type, init })
```

### Verbosity
