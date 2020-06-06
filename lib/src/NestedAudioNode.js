import Tone from 'tone';
import chalk from 'chalk'; // Does not work in every terminal, e.g. not working in Brave, June 2020
import isString from 'is-string';
import isObject from 'is-object';
import isArray from 'isarray';

import {
  doNothing, disp, isAudioParam, isArrayOrObject, isArrayIndex, arrayIndexPopulated, makeConstObj,
} from './helpers';

let id = 0;
class NestedAudioNode {
  constructor(inputData = {}) {
    const data = isObject(inputData) ? inputData : {};
    let {
      library, type, init, verbose, loc, /* eslint-disable-line prefer-const */
    } = data;
    loc = loc || '1';
    verbose = (Number.isInteger(verbose) && verbose >= 0 && verbose <= 3) ? verbose : 2;
    this.id = id;
    id += 1;
    this.loc = loc;
    this.reset();
    this.verbose = verbose;
    this.logger({ text: `${loc}:  ----- START nested node ----- ${type}` });
    this.initialise({
      library, type, init, loc,
    });
    this.logger({ text: `${loc}:  ~~~~~ RESULT nested node ~~~~ ${type}` });
    if (this.verbose >= 2) console.log(this);/* eslint-disable-line no-console */
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

  logger(data) {
    if (!isObject(data)) return;
    // Get options from input data
    const { text, error, colour } = data;
    if (this.verbose >= 3 || (this.verbose >= 1 && !!error)) {
      const colourFn = chalk[colour];
      if (colourFn && colourFn.call) {
        console.log(colourFn(text)); /* eslint-disable-line no-console */
      } else if (error) {
        console.log(chalk.red(text)); /* eslint-disable-line no-console */
      } else {
        console.log(text); /* eslint-disable-line no-console */
      }
    }
  }

  logError(data) {
    if (!isObject(data)) return;
    this.logger({ ...data, error: true });
  }

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
          this.logError({ text: `${loc}:  ERROR - Tone.js threw error when updating constant ${node}.${key} to ${disp(value)}` });
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
        this.logError({ text: `${loc}:  ERROR - Tone.js threw error when updating Param ${param} to ${disp(value)}` });
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
            return true;
          } catch (e) {
            this.logError({ text: `${this}:  ERROR - Tone.js threw error when moving param on ${label}, ${operation}, ${dataArray}` });
          }
        } else {
          this.logError({ text: `${this}:  ERROR - found param ${label}, cannot call ${operation}` });
        }
      } else {
        this.logError({ text: `${this}:  ERROR - not found param ${label}` });
      }
    } else {
      this.logError({ text: `${this}:  ERROR - parameter update should receive (string, string, array)` });
    }
    return false;
  }

  initialise({
    library, type, init, loc,
  }) {
    // Stage 1:
    // Get a template from library
    if (!isObject(library)) { this.logError({ text: `${loc}:  ERROR - library not supplied` }); return; }
    if (!isString(type)) { this.logError({ text: `${loc}:  ERROR - type is not a string` }); return; }
    const template = library[type];
    if (!isObject(template)) { this.logError({ text: `${loc}:  ERROR - template ${type} not found in library` }); return; }
    const { level } = template;
    if (!Number.isFinite(level) || level <= 0) { this.logError({ text: `${loc}:  ERROR - level for template ${type} is not a positive number` }); return; }
    this.type = type;
    this.level = level;
    this.logger({ text: `${loc}:  Template at level ${level} found for ${type}` });

    // Stage 2:
    // Populate the nested contents
    const { contents } = template;
    if (!isArray(contents)) { this.logError({ text: `${loc}:  ERROR - template ${type} has no contents` }); return; }
    this.logger({ text: `${loc}:  Contents of new node are ${disp(contents)}` });
    contents.forEach((addItem, idx) => {
      this.addToContents({
        library, addItem, idx, loc: `${loc}.${idx + 1}`,
      });
    });
    let err = false;
    this.contents.forEach((node) => { err = node ? err : true; });
    if (err) { this.logError({ text: `${loc}:  ERROR - at least one nested node of template ${type} did not construct correctly` }); return; }
    this.logger({ text: `${loc}:  ${type} contents created` });

    // Stage 3:
    // Input and Output - usually Tone.AudioNode, but not Tone.Param or AudioParam,
    // so do these separately to the rest of the API,
    // since the API params should be schedulable parameters,
    // and API consts should be various constants
    const setupIO = (ioString) => {
      if (ioString !== 'input' && ioString !== 'output') {
        this.logError({ text: `${loc}:  ERROR - ${ioString} is invalid ioString` });
        return;
      }
      const thisIdx = template[ioString];
      if (arrayIndexPopulated(this.contents, thisIdx)) {
        const item = this.contents[thisIdx];
        if (item.isNested) {
          if (item[ioString]) {
            this[ioString] = item[ioString];
          } else {
            this.logError({ text: `${loc}:  ERROR - ${item} does not have ${ioString}` });
            return;
          }
        } else {
          this[ioString] = item;
        }
        this.logger({ text: `${loc}:  ${this} has ${ioString} ${this[ioString]} from contents at index ${thisIdx}` });
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
          this.logger({ text: `${tag}:  Connecting from source ${disp(srcInfo)} to destination ${disp(destInfo)}` });
          const [srcItem, srcErr, srcIdx] = this.getConnector(srcInfo, tag, 'source', 'output');
          const [destItem, destErr, destIdx] = this.getConnector(destInfo, tag, 'destination', 'input');
          if (srcErr || destErr) {
            this.logError({ text: `${tag}:  ERROR - either source ${disp(srcInfo)} or destination ${disp(destInfo)} are not valid` });
          } else {
            try {
              // Try to connect using Tone.js
              srcItem.connect(destItem, srcIdx, destIdx);
              // srcItem.connect(destItem)
              this.connects.push(disp(connection));
              this.logger({ text: `${tag}:  Successful connection from ${srcItem} to ${destItem}` });
            } catch (e) {
              this.logError({ text: `${loc}:  ERROR - Tone.js could not connect from ${srcItem} to ${destItem}` });
            }
          }
        } else {
          this.logError({ text: `${tag}:  ERROR - ${type}.connect.${idx} is not an array: ${disp(connection)}` });
        }
      });
    } else if (connections) {
      this.logError({ text: `${loc}:  ERROR - ${type}.connect is not an array: ${disp(connections)}` });
    } else {
      // connect is null, do nothing.
    }

    // Stage 5:
    // Set up API for this node
    // Expose various audio parameters such as oscillator frequency
    // Expose various constants such as oscillator wave type
    const templateApiArray = template.api;
    if (isArray(templateApiArray)) {
      this.logger({ text: `${loc}:  ${this.type} creating API from ${disp(templateApiArray)}:` });
      templateApiArray.forEach((apiItem, idx) => {
        const tag = `${loc} a.${idx}`;
        // this.logger({text: `${tag}:  ...Creating API from ${disp(apiItem)}...`})
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
              this.logger({ text: `${tag}:  Set ${type}.params.${apiLabel} to ${innerNode}${innerProp}.${innerLabel} (${innerParam})` });
            } else if (innerConst) {
              this.setConst(apiLabel, innerConst);
              const innerProp = (innerNode.isNested) ? '.consts' : '';
              this.logger({ text: `${tag}:  Set ${type}.consts.${apiLabel} to ${innerNode}${innerProp}.${innerLabel}` });
            } else {
              this.logError({ text: `${tag}:  ERROR - did not find ${innerLabel} inside ${innerNode}` });
            }
          } else {
            this.logError({ text: `${tag}:  ERROR - ${disp(apiItem)} should be String, Index, String, and index should be populated` });
          }
        } else {
          this.logger({ text: `${tag}:  ERROR - params setup ${disp(apiItem)} was not an array` });
        }
      });
    } else {
      this.logger({ colour: 'magenta', text: `${loc}:  INFO - ${type} does not have an API - is that correct?` });
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
      this.logger({ text: `${loc}:  String item ${innerType} with no init` });
    } else if (isArray(addItem) && isString(addItem[0])) {
      // 2. Array: [type, ...init] or [type, [init]] or [type, {init}]
      [innerType] = addItem;
      innerInit = isArrayOrObject(addItem[1]) ? addItem[1] : addItem.slice(1);
      this.logger({ text: `${loc}:  Array item ${innerType} with init ${disp(innerInit)}` });
    } else if (isObject(addItem) && isString(addItem.type)) {
      // 3. Object: {type, init} or {type, [init]} or {type, {init}}
      innerType = addItem.type;
      innerInit = addItem.init;
      innerInit = isArrayOrObject(innerInit) ? innerInit : [innerInit];
      this.logger({ text: `${loc}:  Object item ${innerType} with init ${disp(innerInit)}` });
    } else {
      // Otherwise not recognised
      this.logError({ text: `${loc}:  ERROR - ${addItem} not recognised` });
      return;
    }

    // A. Deal with adding a Tone.js node:
    if (innerType === 'Tone.Master') {
      innerNode = Tone.Master;
      this.contents[idx] = innerNode;
      this.logger({ text: `${loc}:  Node created for unique instance of ${innerType}` });
      return;
    } if (innerType === 'Tone.Transport') {
      this.logError({ text: `${loc}:  ERROR - ${innerType} NOT YET IMPLEMENTED` });
      return;
    } if (innerType.slice(0, 5) === 'Tone.') {
      const theToneType = innerType.slice(5);
      const TheToneConstructor = Tone[theToneType];
      if (TheToneConstructor && TheToneConstructor.call) {
        try {
          innerNode = isArray(innerInit)
            ? new TheToneConstructor(...innerInit) : new TheToneConstructor(innerInit);
          this.contents[idx] = innerNode;
          this.logger({ text: `${loc}:  Tone.js instance created for ${innerType}` });
        } catch (e) {
          this.logError({ text: `${loc}:  ERROR - Tone.js threw error when creating instance for ${innerType}` });
        }
      } else {
        this.logError({ text: `${loc}:  ERROR - Tone.js constructor not found ${innerType}` });
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
            this.logger({ text: `${loc}:  **** SUCCESS nested node **** ${innerType}` });
          } else {
            this.logError({ text: `${loc}:  ERROR - ${innerType} matched to library, but constructor failed` });
          }
        } else {
          this.logError({ text: `${loc}:  ERROR - Could not add ${innerType} at level ${innerLevel} to ${this.type} at level ${this.level}` });
        }
      } else {
        this.logError({ text: `${loc}:  ERROR - ${innerType} not found in library` });
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
      this.logError({ text: `${theTag}:  ERROR - ${helpLabel} node ${disp(theInfo)} not found` });
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
        this.logError({ text: `${theTag}:  ERROR - ${helpLabel} ${innerNode} does not have param ${paramLabel}` });
        return connectorResult;
      }
      this.logger({ text: `${theTag}:  ${helpLabel} from ${innerNode.type}.${paramLabel || defaultLabel} is ${itemToConnect}` });
    } else {
      // inner node is Tone.js
      if (paramLabel) {
        itemToConnect = innerNode[paramLabel];
        if (!isAudioParam(itemToConnect)) {
          this.logError({ text: `${theTag}:  ERROR - ${paramLabel} inside ${innerNode} is not a schedulable audio parameter` });
          return connectorResult;
        }
      } else {
        itemToConnect = innerNode;
      }
      this.logger({ text: `${theTag}:  ${helpLabel} from Tone.js node is ${itemToConnect}` });
    }
    connectionError = false;
    connectorResult = [itemToConnect, connectionError, connectIdx];
    return connectorResult;
  }

  // Stage 6 of initialisation
  initialiseState({ init, loc }) {
    if (isArray(init)) {
      if (init.length > 0) {
        this.logError({ text: `${loc}:  ERROR - cannot initialise ${this.type} on an array ${disp(init)}, require an object instead` });
      } else {
        this.logger({ text: `${loc}:  ${this.type} init on ${disp(init)} requires no action` });
      }
    } else if (isObject(init)) {
      this.logger({ text: `${loc}:  ${this.type} initialisation from parent, using object ${disp(init)}:` });
      Object.keys(init).forEach((key, idx) => {
        const tag = `${loc} i.${idx}`;
        const val = init[key];
        const [innerParam, innerConst] = this.getApiArray(key);
        if (innerParam) {
          this.logger({ text: `${tag}:  Updating ${this.type}.params.${key}.value on ${innerParam}.value to ${disp(val)}` });
          this.setParamValue(innerParam, val, tag);
        } else if (innerConst) {
          this.logger({ text: `${tag}:  Updating ${this.type}.consts.${key} on ${innerConst.node}.${innerConst.key} from ${disp(innerConst.value)} to ${disp(val)}` });
          this.setConstValue(key, val, tag);
        } else {
          this.logError({ text: `${tag}:  ERROR - could not find param or const for ${this.type} init of ${key} ${disp(key)} as ${disp(val)}` });
        }
      });
    } else if (init) {
      this.logError({ text: `${loc}:  ERROR - called init of ${this.type} on ${disp(init)}, need an object instead of an array` });
    } else {
      // this.logger({text: `${loc}:  ${this.type} init on ${disp(init)} requires no action`})
    }
  }
}

NestedAudioNode.Tone = Tone;

export default NestedAudioNode;
