/* eslint-disable no-console */

import chalk from 'chalk';

import { NestedAudioNode } from '../src';

const arr = [];
console.log('');
console.log('');
console.log('');
console.log(chalk.magenta(`*************** Running ${chalk.bold('nested-audio-node')} examples ***************`));
console.log('');
console.log(chalk.cyan('object code'));
console.log(chalk.yellow('object.toString'));
console.log('console.log(object)');
console.log('');
console.log(chalk.cyan('new NestedAudioNode()'));
console.log(chalk.yellow(`${arr[0] = new NestedAudioNode()}`));
console.log(arr[0]);
console.log('');
console.log(chalk.magenta('**************************************************************'));
console.log('');
console.log('');
console.log('');
