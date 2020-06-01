import * as Tone from 'tone';
import isString from 'is-string';
import isObject from 'is-object';
import isArray from 'isarray';

import {
  doNothing, disp, isAudioParam, isArrayOrObject, isArrayIndex, arrayIndexPopulated, makeConstObj,
} from './helpers';

let id = 0;
class NestedAudioNode {
  constructor(data = {}) {
    // Get options from data
    const { library, type, init } = data;
    const loc = data.loc || '1';
    const verbose = data.verbose || false;
    // Setup this instance
    this.id = id;
    id += 1;
    this.loc = loc;
    this.reset();
    this.verbose = verbose;
    this.logger(`${loc}:  ----- START nested node ----- ${type}`);
    this.initialise({
      library, type, init, loc,
    });
    this.logger(`${loc}:  ~~~~~ RESULT nested node ~~~~ ${type}`);
    this.logger(this);
  }

  reset() {
    this.type = null;
    this.level = null;
    this.input = null; // Single point of entry into nested node audio graph, optional
    this.output = null; // Single point of exit from nested node audio graph, optional
    this.contents = []; // List of nested nodes. Of type NestedAudioNode or Tone.AudioNode
    this.connects = []; // Info only, human readable list of successful Tone.js internal connections
    this.params = {}; // API for Params, e.g. Oscillator.frequency
    this.consts = {}; // API for constants, e.g. Oscillator.type
  }

  // Marker for being a NestedAudioNode and not a Tone.AudioNode
  get isNested() { return true; } /* eslint-disable-line class-methods-use-this */

  toString() { return this.type; }

  logger(string) { if (this.verbose) console.log(string); } /* eslint-disable-line no-console */

  // For nested nodes call start, stop, dispose across all contents
  // If an inner node fails (esp. for start and stop) it means
  // Tone.js did not support the action which is OK.
  tryFnAcrossContents(fn, ...args) {
    this.contents.forEach((node) => {
      try { node[fn](...args); } catch (e) { doNothing(); }
    });
  }

  start(...args) { this.tryFnAcrossContents('start', ...args); }

  stop(...args) { this.tryFnAcrossContents('stop', ...args); }

  dispose(...args) { this.tryFnAcrossContents('dispose', ...args); this.reset(); }

  cancelScheduledValues() {
    // Only things that should be scheduled are parameters on the API
    // so only need to cancel these, should be able to ignore any inner nodes...
    Object.keys(this.params).forEach((key) => {
      const param = this.params[key];
      try { param.cancelScheduledValues(); } catch (e) { doNothing(); }
    });
  }

  getApiArray(label) { return [this.params[label], this.consts[label]]; }

  setConst(apiLabel, constObj) { this.consts[apiLabel] = constObj; }

  setConstValue(apiLabel, value, loc = '') {
    const item = this.consts[apiLabel];
    if (item) {
      const { node } = item;
      const { key } = item;
      if (node && key) {
        try {
          node[key] = value;
          item.value = value;
        } catch (e) {
          this.logger(`${loc}:  ERROR - Tone.js threw error when updating constant ${node}.${key} to ${disp(value)}`);
        }
      }
    }
  }

  getParam(label) { return this.params[label]; }

  setParam(label, param) { this.params[label] = param; }

  setParamValue(param, value, loc = '') {
    if (isAudioParam(param)) {
      try {
        // Using Tone.now() means later settings override earlier settings
        param.setValueAtTime(value, Tone.now());
      } catch (e) {
        this.logger(`${loc}:  ERROR - Tone.js threw error when updating Param ${param} to ${disp(value)}`);
      }
    }
  }

  updateParam(label, operation, dataArray = []) {
    if (isString(label) && isString(operation) && isArray(dataArray)) {
      const param = this.getParam(label);
      if (param) {
        const opFn = param[operation];
        if (opFn && opFn.call) {
          try {
            param[operation](...dataArray); // opFn(...dataArray) //doesn't work!
          } catch (e) {
            this.logger(`${this}:  ERROR - Tone.js threw error when moving param on ${label}, ${operation}, ${dataArray}`);
          }
        } else {
          this.logger(`${this}:  ERROR - found param ${label}, cannot call ${operation}`);
        }
      } else {
        this.logger(`${this}:  ERROR - not found param ${label}`);
      }
    } else {
      this.logger(`${this}:  ERROR - parameter update should receive (string, string, array)`);
    }
  }

  initialise({
    library, type, init, loc,
  }) {
    // Stage 1:
    // Get a template from library
    if (!isObject(library)) { this.logger(`${loc}:  ERROR - library not supplied`); return; }
    if (!isString(type)) { this.logger(`${loc}:  ERROR - type is not a string`); return; }
    const template = library[type];
    if (!isObject(template)) { this.logger(`${loc}:  ERROR - template ${type} not found in library`); return; }
    const { level } = template;
    if (!Number.isFinite(level) || level <= 0) { this.logger(`${loc}:  ERROR - level for template ${type} is not a positive number`); return; }
    this.type = type;
    this.level = level;
    this.logger(`${loc}:  Template at level ${level} found for ${type}`);

    // Stage 2:
    // Populate the nested contents
    const { contents } = template;
    if (!isArray(contents)) { this.logger(`${loc}:  ERROR - template ${type} has no contents`); return; }
    this.logger(`${loc}:  Contents of new node are ${disp(contents)}`);
    contents.forEach((addItem, idx) => {
      this.addToContents({
        library, addItem, idx, loc: `${loc}.${idx + 1}`,
      });
    });
    let err = false;
    this.contents.forEach((node) => { err = node ? err : true; });
    if (err) { this.logger(`${loc}:  ERROR - at least one nested node of template ${type} did not construct correctly`); return; }
    this.logger(`${loc}:  ${type} contents created`);

    // Stage 3:
    // Input and Output - usually Tone.AudioNode, but not Tone.Param or AudioParam,
    // so do these separately to the rest of the API,
    // since the API params should be schedulable parameters,
    // and API consts should be various constants
    const setupIO = (ioString) => {
      if (ioString !== 'input' && ioString !== 'output') {
        this.logger(`${loc}:  ERROR - ${ioString} is invalid ioString`);
        return;
      }
      const thisIdx = template[ioString];
      if (arrayIndexPopulated(this.contents, thisIdx)) {
        const item = this.contents[thisIdx];
        if (item.isNested) {
          if (item[ioString]) {
            this[ioString] = item[ioString];
          } else {
            this.logger(`${loc}:  ERROR - ${item} does not have ${ioString}`);
            return;
          }
        } else {
          this[ioString] = item;
        }
        this.logger(`${loc}:  ${this} has ${ioString} ${this[ioString]} from contents at index ${thisIdx}`);
      }
    };
    setupIO('input');
    setupIO('output');

    // Stage 4:
    // Make any internal connections
    const connections = template.connect;
    if (isArray(connections)) {
      connections.forEach((connection, idx) => {
        const tag = `${loc} c.${idx}`;
        if (isArray(connection)) {
          // Extract source and destination
          let [srcInfo, destInfo] = connection;
          if (!isArray(srcInfo)) srcInfo = [srcInfo];
          if (!isArray(destInfo)) destInfo = [destInfo];
          this.logger(`${tag}:  Connecting from source ${disp(srcInfo)} to destination ${disp(destInfo)}`);
          const [srcItem, srcErr, srcIdx] = this.getConnector(srcInfo, tag, 'source', 'output');
          const [destItem, destErr, destIdx] = this.getConnector(destInfo, tag, 'destination', 'input');
          if (srcErr || destErr) {
            this.logger(`${tag}:  ERROR - either source ${disp(srcInfo)} or destination ${disp(destInfo)} are not valid`);
          } else {
            try {
              // Try to connect using Tone.js
              srcItem.connect(destItem, srcIdx, destIdx);
              // srcItem.connect(destItem)
              this.connects.push(disp(connection));
              this.logger(`${tag}:  Successful connection from ${srcItem} to ${destItem}`);
            } catch (e) {
              this.logger(`${loc}:  ERROR - Tone.js could not connect from ${srcItem} to ${destItem}`);
            }
          }
        } else {
          this.logger(`${tag}:  ERROR - ${type}.connect.${idx} is not an array: ${disp(connection)}`);
        }
      });
    } else if (connections) {
      this.logger(`${loc}:  ERROR - ${type}.connect is not an array: ${disp(connections)}`);
    } else {
      // connect is null, do nothing.
    }

    // Stage 5:
    // Set up API for this node
    // Expose various audio parameters such as oscillator frequency
    // Expose various constants such as oscillator wave type
    const templateApiArray = template.api;
    if (isArray(templateApiArray)) {
      this.logger(`${loc}:  ${this.type} creating API from ${disp(templateApiArray)}:`);
      templateApiArray.forEach((apiItem, idx) => {
        const tag = `${loc} a.${idx}`;
        // this.logger(`${tag}:  ...Creating API from ${disp(apiItem)}...`)
        if (isArray(apiItem)) {
          const apiLabel = apiItem[0];
          const innerIdx = apiItem[1];
          const innerLabel = apiItem[2];
          if (isString(apiLabel) && isString(innerLabel)
          && arrayIndexPopulated(this.contents, innerIdx)) {
            const innerNode = this.contents[innerIdx];
            let innerParam = null;
            let innerConst = null;
            if (innerNode.isNested) {
              [innerParam, innerConst] = innerNode.getApiArray(innerLabel);
            } else {
              // inner node is Tone.js
              const innerItem = innerNode[innerLabel];
              this.logger(`${loc}:  MAKING API...`);
              this.logger(innerItem);
              if (isAudioParam(innerItem)) {
                // Its an a-rate (or possibly k-rate) audio parameter
                innerParam = innerItem;
              } else if (innerItem != null) {
                // Want any other constant parameters here
                // innerItem is not null or undefined, and could be 0
                innerConst = makeConstObj(innerNode, innerLabel, innerItem);
              } else {
                // innerLabel doesn't exist on Tone.js node, do nothing
              }
            }
            if (innerParam) {
              this.setParam(apiLabel, innerParam);
              const innerProp = (innerNode.isNested) ? '.params' : '';
              this.logger(`${tag}:  Set ${type}.params.${apiLabel} to ${innerNode}${innerProp}.${innerLabel} (${innerParam})`);
            } else if (innerConst) {
              this.setConst(apiLabel, innerConst);
              const innerProp = (innerNode.isNested) ? '.consts' : '';
              this.logger(`${tag}:  Set ${type}.consts.${apiLabel} to ${innerNode}${innerProp}.${innerLabel}`);
            } else {
              this.logger(`${tag}:  ERROR - did not find ${innerLabel} inside ${innerNode}`);
            }
          } else {
            this.logger(`${tag}:  ERROR - ${disp(apiItem)} should be String, Index, String, and index should be populated`);
          }
        } else {
          this.logger(`${tag}:  ERROR - params setup ${disp(apiItem)} was not an array`);
        }
      });
    } else {
      this.logger(`${loc}:  INFO - ${type} does not have an API - is that correct?`);
      return;
    }

    // Stage 6:
    // Final stage is to overwrite initialisation of inner nodes
    // with any initialisation from this node
    this.initialiseState({ init, loc });
  }

  // Stage 2 of initialisation
  addToContents({
    library, addItem, idx, loc,
  }) {
    // Can add:
    // A. Tone.js
    // B. another nested node

    // Can specify in any of these formats:
    // 1. String
    // 2. Array
    // 3. Object.

    // By default, don't add a node
    this.contents[idx] = null;
    let innerNode = this.contents[idx];
    let innerType = null;
    let innerInit = [];
    if (isString(addItem)) {
      // 1. String - a type label only, init stays empty
      innerType = addItem;
      this.logger(`${loc}:  String item ${innerType} with no init`);
    } else if (isArray(addItem) && isString(addItem[0])) {
      // 2. Array: [type, ...init] or [type, [init]] or [type, {init}]
      [innerType] = addItem;
      innerInit = isArrayOrObject(addItem[1]) ? addItem[1] : addItem.slice(1);
      this.logger(`${loc}:  Array item ${innerType} with init ${disp(innerInit)}`);
    } else if (isObject(addItem) && isString(addItem.type)) {
      // 3. Object: {type, init} or {type, [init]} or {type, {init}}
      innerType = addItem.type;
      innerInit = addItem.init;
      innerInit = isArrayOrObject(innerInit) ? innerInit : [innerInit];
      this.logger(`${loc}:  Object item ${innerType} with init ${disp(innerInit)}`);
    } else {
      // Otherwise not recognised
      this.logger(`${loc}:  ERROR - ${addItem} not recognised`);
      return;
    }

    // A. Deal with adding a Tone.js node:
    if (innerType === 'Tone.Master') {
      innerNode = Tone.Master;
      this.contents[idx] = innerNode;
      this.logger(`${loc}:  Node created for unique instance of ${innerType}`);
      return;
    } if (innerType === 'Tone.Transport') {
      this.logger(`${loc}:  ERROR - ${innerType} NOT YET IMPLEMENTED`);
      return;
    } if (innerType.slice(0, 5) === 'Tone.') {
      const theToneType = innerType.slice(5);
      const TheToneConstructor = Tone[theToneType];
      if (TheToneConstructor && TheToneConstructor.call) {
        try {
          innerNode = isArray(innerInit)
            ? new TheToneConstructor(...innerInit) : new TheToneConstructor(innerInit);
          this.contents[idx] = innerNode;
          this.logger(`${loc}:  Tone.js instance created for ${innerType}`);
        } catch (e) {
          this.logger(`${loc}:  ERROR - Tone.js threw error when creating instance for ${innerType}`);
        }
      } else {
        this.logger(`${loc}:  ERROR - Tone.js constructor not found ${innerType}`);
      }
      return;
    }

    // B. Deal with adding a nested node:
    if (isObject(library)) {
      const innerTemplate = library[innerType];
      if (isObject(innerTemplate)) {
        const innerLevel = innerTemplate.level;
        if (Number.isFinite(innerLevel) && innerLevel < this.level) {
          innerNode = new this.constructor({
            library, loc, type: innerType, init: innerInit, verbose: this.verbose,
          });
          if (innerNode) {
            this.contents[idx] = innerNode;
            this.logger(`${loc}:  **** SUCCESS nested node **** ${innerType}`);
          } else {
            this.logger(`${loc}:  ERROR - ${innerType} matched to library, but constructor failed`);
          }
        } else {
          this.logger(`${loc}:  ERROR - Could not add ${innerType} at level ${innerLevel} to ${this.type} at level ${this.level}`);
        }
      } else {
        this.logger(`${loc}:  ERROR - ${innerType} not found in library`);
      }
    } else {
      // Library not supplied, could not search for template
    }
  }

  // Stage 4 of initialisation
  // Function to get source and destination nodes/params
  getConnector(theInfo, theTag, helpLabel, defaultLabel) {
    let itemToConnect = null;
    let connectionError = true;
    let connectIdx = 0;
    let connectorResult = [itemToConnect, connectionError, connectIdx];
    let paramLabel = '';
    const [theIdx, theParamLabelOrConnectIndex] = theInfo;
    if (isArrayIndex(theParamLabelOrConnectIndex)) {
      connectIdx = theParamLabelOrConnectIndex;
    } else if (isString(theParamLabelOrConnectIndex)) {
      paramLabel = theParamLabelOrConnectIndex;
    } else {
      // Will connect directly to the audio node
    }
    const innerNode = this.contents[theIdx];
    if (!innerNode) {
      this.logger(`${theTag}:  ERROR - ${helpLabel} node ${disp(theInfo)} not found`);
      return connectorResult;
    }
    if (innerNode.isNested) {
      if (!paramLabel) {
        // use input or output
        if (defaultLabel === 'input') {
          itemToConnect = innerNode.input;
        } else if (defaultLabel === 'output') {
          itemToConnect = innerNode.output;
        } else {
          itemToConnect = null;
        }
      } else {
        itemToConnect = innerNode.getParam(paramLabel);
      }
      if (!itemToConnect) {
        this.logger(`${theTag}:  ERROR - ${helpLabel} ${innerNode} does not have param ${paramLabel}`);
        return connectorResult;
      }
      this.logger(`${theTag}:  ${helpLabel} from ${innerNode.type}.${paramLabel || defaultLabel} is ${itemToConnect}`);
    } else {
      // inner node is Tone.js
      if (paramLabel) {
        itemToConnect = innerNode[paramLabel];
        if (!isAudioParam(itemToConnect)) {
          this.logger(`${theTag}:  ERROR - ${paramLabel} inside ${innerNode} is not a schedulable audio parameter`);
          return connectorResult;
        }
      } else {
        itemToConnect = innerNode;
      }
      this.logger(`${theTag}:  ${helpLabel} from Tone.js node is ${itemToConnect}`);
    }
    connectionError = false;
    connectorResult = [itemToConnect, connectionError, connectIdx];
    return connectorResult;
  }

  // Stage 6 of initialisation
  initialiseState({ init, loc }) {
    if (isArray(init)) {
      if (init.length > 0) {
        this.logger(`${loc}:  ERROR - cannot initialise ${this.type} on an array ${disp(init)}, require an object instead`);
      } else {
        this.logger(`${loc}:  ${this.type} init on ${disp(init)} requires no action`);
      }
    } else if (isObject(init)) {
      this.logger(`${loc}:  ${this.type} initialisation from parent, using object ${disp(init)}:`);
      Object.keys(init).forEach((key, idx) => {
        const tag = `${loc} i.${idx}`;
        const val = init[key];
        const [innerParam, innerConst] = this.getApiArray(key);
        if (innerParam) {
          this.logger(`${tag}:  Updating ${this.type}.params.${key}.value on ${innerParam}.value to ${disp(val)}`);
          this.setParamValue(innerParam, val, tag);
        } else if (innerConst) {
          this.logger(`${tag}:  Updating ${this.type}.consts.${key} on ${innerConst.node}.${innerConst.key} from ${disp(innerConst.value)} to ${disp(val)}`);
          this.setConstValue(key, val, tag);
        } else {
          this.logger(`${tag}:  ERROR - could not find param or const for ${this.type} init of ${key} ${disp(key)} as ${disp(val)}`);
        }
      });
    } else if (init) {
      this.logger(`${loc}:  ERROR - called init of ${this.type} on ${disp(init)}, need an object instead of an array`);
    } else {
      // this.logger(`${loc}:  ${this.type} init on ${disp(init)} requires no action`)
    }
  }
}

export default NestedAudioNode;
