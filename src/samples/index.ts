import breakout from './breakout.bas?raw';
import hello from './hello.bas?raw';
import snakeDodge from './dodger.bas?raw';

export interface SampleFile {
  name: string;
  title: string;
  text: string;
}

export const sampleFiles: SampleFile[] = [
  { name: 'hello.bas', title: 'Hello world', text: hello },
  { name: 'breakout.bas', title: 'Breakout', text: breakout },
  { name: 'dodger.bas', title: 'Dodger', text: snakeDodge },
];
