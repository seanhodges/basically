// Vendored 6502 CPU core — see LICENSE-6502.md for attribution and local patches.
// Bundled from https://github.com/jyelewis/cpu-6502-emulator (ISC, © Jye Lewis).
// Generated build output (esbuild). Do not edit by hand; the local patches live
// in the upstream-style TypeScript source and are documented in LICENSE-6502.md.

// src/types.ts
var ProcessorStatus = /* @__PURE__ */ ((ProcessorStatus2) => {
  ProcessorStatus2[ProcessorStatus2["negative"] = 128] = "negative";
  ProcessorStatus2[ProcessorStatus2["overflow"] = 64] = "overflow";
  ProcessorStatus2[ProcessorStatus2["const"] = 32] = "const";
  ProcessorStatus2[ProcessorStatus2["brk"] = 16] = "brk";
  ProcessorStatus2[ProcessorStatus2["decimalMode"] = 8] = "decimalMode";
  ProcessorStatus2[ProcessorStatus2["disableIrqb"] = 4] = "disableIrqb";
  ProcessorStatus2[ProcessorStatus2["zero"] = 2] = "zero";
  ProcessorStatus2[ProcessorStatus2["carry"] = 1] = "carry";
  return ProcessorStatus2;
})(ProcessorStatus || {});
var ClockMode = /* @__PURE__ */ ((ClockMode2) => {
  ClockMode2[ClockMode2["paused"] = 0] = "paused";
  ClockMode2[ClockMode2["running"] = 1] = "running";
  ClockMode2[ClockMode2["waitForInterrupt"] = 2] = "waitForInterrupt";
  return ClockMode2;
})(ClockMode || {});
var ReadWrite = /* @__PURE__ */ ((ReadWrite2) => {
  ReadWrite2[ReadWrite2["read"] = 0] = "read";
  ReadWrite2[ReadWrite2["write"] = 1] = "write";
  return ReadWrite2;
})(ReadWrite || {});

// src/util.ts
function convertToSignedValue(value) {
  if (value >= 128) {
    return value - 256;
  }
  return value;
}

// src/cpuOperations.ts
var cpuOperations = {
  0: {
    name: "BRK",
    dataBytes: 1,
    // one ghost operand, doesn't do anything but the processor treats is as if it does
    func: (cpu) => {
      cpu.triggerIRQB(true);
    }
  },
  8: {
    name: "PHP",
    dataBytes: 0,
    func: (cpu) => {
      cpu._push8BitValueToStack(cpu.processorStatus);
    }
  },
  40: {
    name: "PLP",
    dataBytes: 0,
    func: (cpu) => {
      cpu.processorStatus = cpu._pull8BitValueFromStack();
    }
  },
  24: {
    name: "CLC",
    // clear carry
    dataBytes: 0,
    func: (cpu) => {
      cpu.processorStatus = cpu.processorStatus & ~1 /* carry */;
    }
  },
  32: {
    name: "JSR abs",
    dataBytes: 2,
    func: (cpu, address) => {
      cpu._push16BitValueToStack(cpu.programCounter);
      cpu.programCounter = address;
    }
  },
  36: {
    name: "BIT zp",
    dataBytes: 1,
    func: (cpu, zpAddress) => {
      const memValue = cpu._read8BitValue(zpAddress);
      const zero = (cpu.reg_a & memValue) === 0;
      cpu.processorStatus = cpu.processorStatus & 61 | memValue & 192 | (zero ? 2 : 0);
    }
  },
  44: {
    name: "BIT abs",
    dataBytes: 2,
    func: (cpu, address) => {
      const memValue = cpu._read8BitValue(address);
      const zero = (cpu.reg_a & memValue) === 0;
      cpu.processorStatus = cpu.processorStatus & 61 | memValue & 192 | (zero ? 2 : 0);
    }
  },
  96: {
    name: "RTS",
    dataBytes: 0,
    func: (cpu) => {
      cpu.programCounter = cpu._pull16BitValueFromStack();
    }
  },
  186: {
    name: "TSX",
    dataBytes: 0,
    func: (cpu) => {
      cpu.reg_x = cpu._convertValueTo8BitAndSetStatusFlags(cpu.stackPointer);
    }
  },
  154: {
    name: "TXS",
    dataBytes: 0,
    func: (cpu) => {
      cpu.stackPointer = cpu.reg_x;
    }
  },
  138: {
    name: "TXA",
    dataBytes: 0,
    func: (cpu) => {
      cpu.reg_a = cpu._convertValueTo8BitAndSetStatusFlags(cpu.reg_x);
    }
  },
  152: {
    name: "TYA",
    dataBytes: 0,
    func: (cpu) => {
      cpu.reg_a = cpu._convertValueTo8BitAndSetStatusFlags(cpu.reg_y);
    }
  },
  168: {
    name: "TAY",
    dataBytes: 0,
    func: (cpu) => {
      cpu.reg_y = cpu._convertValueTo8BitAndSetStatusFlags(cpu.reg_a);
    }
  },
  170: {
    name: "TAX",
    dataBytes: 0,
    func: (cpu) => {
      cpu.reg_x = cpu._convertValueTo8BitAndSetStatusFlags(cpu.reg_a);
    }
  },
  216: {
    name: "CLD",
    dataBytes: 0,
    func: () => {
    }
  },
  72: {
    name: "PHA",
    dataBytes: 0,
    func: (cpu) => {
      cpu._push8BitValueToStack(cpu.reg_a);
    }
  },
  104: {
    name: "PLA",
    dataBytes: 0,
    func: (cpu) => {
      cpu.reg_a = cpu._convertValueTo8BitAndSetStatusFlags(
        cpu._pull8BitValueFromStack()
      );
    }
  },
  56: {
    name: "SEC",
    dataBytes: 0,
    func: (cpu) => {
      cpu.processorStatus |= 1 /* carry */;
    }
  },
  // branch
  16: {
    name: "BPL rel",
    // branch if plus (negative is not set)
    dataBytes: 1,
    func: (cpu, relativeAddress) => {
      if ((cpu.processorStatus & 128 /* negative */) !== 0) {
        return;
      }
      cpu.programCounter = cpu.programCounter + convertToSignedValue(relativeAddress);
    }
  },
  144: {
    name: "BCC rel",
    // branch if carry clear
    dataBytes: 1,
    func: (cpu, relativeAddress) => {
      if ((cpu.processorStatus & 1 /* carry */) !== 0) {
        return;
      }
      cpu.programCounter = cpu.programCounter + convertToSignedValue(relativeAddress);
    }
  },
  176: {
    name: "BCS rel",
    // branch if carry set
    dataBytes: 1,
    func: (cpu, relativeAddress) => {
      if ((cpu.processorStatus & 1 /* carry */) === 0) {
        return;
      }
      cpu.programCounter = cpu.programCounter + convertToSignedValue(relativeAddress);
    }
  },
  240: {
    name: "BEQ rel",
    // branch if equal (branch if result zero)
    dataBytes: 1,
    func: (cpu, relativeAddress) => {
      if ((cpu.processorStatus & 2 /* zero */) === 0) {
        return;
      }
      cpu.programCounter = cpu.programCounter + convertToSignedValue(relativeAddress);
    }
  },
  48: {
    name: "BMI rel",
    // branch if minus (branch if negative bit is set)
    dataBytes: 1,
    func: (cpu, relativeAddress) => {
      if ((cpu.processorStatus & 128 /* negative */) === 0) {
        return;
      }
      cpu.programCounter = cpu.programCounter + convertToSignedValue(relativeAddress);
    }
  },
  208: {
    name: "BNE rel",
    // branch if not zero
    dataBytes: 1,
    func: (cpu, relativeAddress) => {
      if ((cpu.processorStatus & 2 /* zero */) !== 0) {
        return;
      }
      cpu.programCounter = cpu.programCounter + convertToSignedValue(relativeAddress);
    }
  },
  80: {
    name: "BVC rel",
    // branch if overflow clear
    dataBytes: 1,
    func: (cpu, relativeAddress) => {
      if ((cpu.processorStatus & 64 /* overflow */) !== 0) {
        return;
      }
      cpu.programCounter = cpu.programCounter + convertToSignedValue(relativeAddress);
    }
  },
  112: {
    name: "BVS rel",
    // branch if overflow set
    dataBytes: 1,
    func: (cpu, relativeAddress) => {
      if ((cpu.processorStatus & 64 /* overflow */) === 0) {
        return;
      }
      cpu.programCounter = cpu.programCounter + convertToSignedValue(relativeAddress);
    }
  },
  // toggle system register bits
  // inc/dec xy
  232: {
    name: "INX",
    dataBytes: 0,
    func: (cpu) => {
      cpu.reg_x = (cpu.reg_x + 1) % 256;
      cpu._convertValueTo8BitAndSetStatusFlags(cpu.reg_x);
    }
  },
  200: {
    name: "INY",
    dataBytes: 0,
    func: (cpu) => {
      cpu.reg_y = (cpu.reg_y + 1) % 256;
      cpu._convertValueTo8BitAndSetStatusFlags(cpu.reg_y);
    }
  },
  202: {
    name: "DEX",
    dataBytes: 0,
    func: (cpu) => {
      cpu.reg_x--;
      if (cpu.reg_x === -1) {
        cpu.reg_x = 255;
      }
      cpu._convertValueTo8BitAndSetStatusFlags(cpu.reg_x);
    }
  },
  136: {
    name: "DEY",
    dataBytes: 0,
    func: (cpu) => {
      cpu.reg_y--;
      if (cpu.reg_y === -1) {
        cpu.reg_y = 255;
      }
      cpu._convertValueTo8BitAndSetStatusFlags(cpu.reg_y);
    }
  },
  76: {
    name: "JMP abs",
    dataBytes: 2,
    func: (cpu, absAddress) => {
      cpu.programCounter = absAddress;
    }
  },
  234: {
    name: "NOP",
    dataBytes: 0,
    func: (cpu, value) => {
    }
  }
};
var operationsWithMultipleAddressingModes = [
  {
    name: "LDA",
    addressingModes: {
      169: "#",
      165: "zp",
      181: "zp,x",
      173: "abs",
      189: "abs,x",
      185: "abs,y",
      161: "(ind,x)",
      177: "(ind),y"
    },
    func: (cpu, value) => {
      cpu.reg_a = cpu._convertValueTo8BitAndSetStatusFlags(value);
    }
  },
  {
    name: "STA",
    addressingModes: {
      133: "zp",
      149: "zp,x",
      141: "abs",
      157: "abs,x",
      153: "abs,y",
      129: "(ind,x)",
      145: "(ind),y"
    },
    func: (cpu) => {
      return cpu.reg_a;
    }
  },
  {
    name: "LDX",
    addressingModes: {
      162: "#",
      166: "zp",
      182: "zp,y",
      174: "abs",
      190: "abs,y"
    },
    func: (cpu, value) => {
      cpu.reg_x = cpu._convertValueTo8BitAndSetStatusFlags(value);
    }
  },
  {
    name: "STX",
    addressingModes: {
      134: "zp",
      150: "zp,y",
      142: "abs"
    },
    func: (cpu, value) => {
      return cpu.reg_x;
    }
  },
  {
    name: "LDY",
    addressingModes: {
      160: "#",
      164: "zp",
      180: "zp,x",
      172: "abs",
      188: "abs,x"
    },
    func: (cpu, value) => {
      cpu.reg_y = cpu._convertValueTo8BitAndSetStatusFlags(value);
    }
  },
  {
    name: "STY",
    addressingModes: {
      132: "zp",
      148: "zp,x",
      140: "abs"
    },
    func: (cpu, value) => {
      return cpu.reg_y;
    }
  },
  {
    name: "ORA",
    addressingModes: {
      9: "#",
      5: "zp",
      21: "zp,x",
      13: "abs",
      29: "abs,x",
      25: "abs,y",
      1: "(ind,x)",
      17: "(ind),y"
    },
    func: (cpu, value) => {
      cpu.reg_a = cpu._convertValueTo8BitAndSetStatusFlags(cpu.reg_a | value);
    }
  },
  {
    name: "ASL",
    addressingModes: {
      10: "a",
      6: "zp",
      22: "zp,x",
      14: "abs",
      30: "abs,x"
    },
    func: (cpu, value) => {
      return cpu._convertValueTo8BitAndSetStatusFlags(value << 1, true);
    }
  },
  {
    name: "ROL",
    addressingModes: {
      42: "a",
      38: "zp",
      54: "zp,x",
      46: "abs",
      62: "abs,x"
    },
    func: (cpu, value) => {
      const carrySet = (cpu.processorStatus & 1 /* carry */) === 1 /* carry */;
      value = value << 1;
      if (carrySet) {
        value = value | 1;
      }
      value = cpu._convertValueTo8BitAndSetStatusFlags(value, true);
      return value;
    }
  },
  {
    name: "ROR",
    addressingModes: {
      106: "a",
      102: "zp",
      118: "zp,x",
      110: "abs",
      126: "abs,x"
    },
    func: (cpu, value) => {
      const carrySet = (cpu.processorStatus & 1 /* carry */) === 1 /* carry */;
      const willWrap = (value & 1) === 1;
      value = value >> 1;
      if (willWrap) {
        value = value | 256;
      }
      if (carrySet) {
        value = value | 128;
      }
      value = cpu._convertValueTo8BitAndSetStatusFlags(value, true);
      return value;
    }
  },
  {
    name: "ADC",
    addressingModes: {
      105: "#",
      101: "zp",
      117: "zp,x",
      109: "abs",
      125: "abs,x",
      121: "abs,y",
      97: "(ind,x)",
      113: "(ind),y"
    },
    func: (cpu, value) => {
      const carry = (cpu.processorStatus & 1 /* carry */) === 0 ? 0 : 1;
      const sum = value + cpu.reg_a + carry;
      const cappedSum = cpu._convertValueTo8BitAndSetStatusFlags(sum, true);
      const overflow = (value ^ cappedSum) & (cpu.reg_a ^ cappedSum) & 128;
      if (overflow) {
        cpu.processorStatus |= 64 /* overflow */;
      } else {
        cpu.processorStatus &= ~64 /* overflow */;
      }
      cpu.reg_a = cappedSum;
    }
  },
  {
    name: "AND",
    addressingModes: {
      41: "#",
      37: "zp",
      53: "zp,x",
      45: "abs",
      61: "abs,x",
      57: "abs,y",
      33: "(ind,x)",
      49: "(ind),y"
    },
    func: (cpu, value) => {
      cpu.reg_a = cpu._convertValueTo8BitAndSetStatusFlags(cpu.reg_a & value);
    }
  },
  {
    name: "INC",
    addressingModes: {
      230: "zp",
      246: "zp,x",
      238: "abs",
      254: "abs,x"
    },
    func: (cpu, value) => {
      value = (value + 1) % 256;
      cpu._convertValueTo8BitAndSetStatusFlags(value);
      return value;
    }
  },
  {
    name: "DEC",
    addressingModes: {
      198: "zp",
      214: "zp,x",
      206: "abs",
      222: "abs,x"
    },
    func: (cpu, value) => {
      value = value - 1;
      if (value === -1) {
        value = 255;
      }
      cpu._convertValueTo8BitAndSetStatusFlags(value);
      return value;
    }
  },
  {
    name: "CMP",
    addressingModes: {
      201: "#",
      197: "zp",
      213: "zp,x",
      205: "abs",
      221: "abs,x",
      217: "abs,y",
      193: "(ind,x)",
      209: "(ind),y"
    },
    func: (cpu, value) => {
      const result = cpu.reg_a - value;
      cpu._convertValueTo8BitAndSetStatusFlags(result);
      if (cpu.reg_a >= value) {
        cpu.processorStatus |= 1 /* carry */;
      } else {
        cpu.processorStatus &= ~1 /* carry */;
      }
    }
  },
  {
    name: "CPX",
    addressingModes: {
      224: "#",
      228: "zp",
      236: "abs"
    },
    func: (cpu, value) => {
      const result = cpu.reg_x - value;
      cpu._convertValueTo8BitAndSetStatusFlags(result);
      if (cpu.reg_x >= value) {
        cpu.processorStatus |= 1 /* carry */;
      } else {
        cpu.processorStatus &= ~1 /* carry */;
      }
    }
  },
  {
    name: "CPY",
    addressingModes: {
      192: "#",
      196: "zp",
      204: "abs"
    },
    func: (cpu, value) => {
      const result = cpu.reg_y - value;
      cpu._convertValueTo8BitAndSetStatusFlags(result);
      if (cpu.reg_y >= value) {
        cpu.processorStatus |= 1 /* carry */;
      } else {
        cpu.processorStatus &= ~1 /* carry */;
      }
    }
  },
  {
    name: "SBC",
    addressingModes: {
      233: "#",
      229: "zp",
      245: "zp,x",
      237: "abs",
      253: "abs,x",
      249: "abs,y",
      225: "(ind,x)",
      241: "(ind),y"
    },
    func: (cpu, value) => {
      const carry = (cpu.processorStatus & 1 /* carry */) === 1 /* carry */ ? 1 : 0;
      const result = cpu.reg_a - value - (1 - carry);
      if (result >= 0) {
        cpu.processorStatus |= 1 /* carry */;
      } else {
        cpu.processorStatus &= ~1 /* carry */;
      }
      const overflow = (cpu.reg_a & 1e7) != (result & 1e7);
      if (overflow) {
        cpu.processorStatus |= 64 /* overflow */;
      } else {
        cpu.processorStatus &= ~64 /* overflow */;
      }
      cpu.reg_a = cpu._convertValueTo8BitAndSetStatusFlags(result);
    }
  },
  {
    name: "EOR",
    addressingModes: {
      73: "#",
      69: "zp",
      85: "zp,x",
      77: "abs",
      93: "abs,x",
      89: "abs,y",
      65: "(ind,x)",
      81: "(ind),y"
    },
    func: (cpu, value) => {
      const result = cpu.reg_a ^ value;
      cpu.reg_a = cpu._convertValueTo8BitAndSetStatusFlags(result);
    }
  }
];
var addressingModes = {
  "#": {
    dataBytes: 1,
    fetchValue: (cpu, v) => v,
    storeValue: () => {
      throw new Error("Cannot store to immediate value");
    }
  },
  a: {
    dataBytes: 0,
    fetchValue: (cpu) => cpu.reg_a,
    storeValue: (cpu, address, value) => cpu.reg_a = value
  },
  zp: {
    dataBytes: 1,
    fetchValue: (cpu, address) => cpu._read8BitValue(address),
    storeValue: (cpu, address, value) => cpu._write8BitValue(address, value)
  },
  "zp,x": {
    dataBytes: 1,
    fetchValue: (cpu, address) => cpu._read8BitValue(address + cpu.reg_x),
    storeValue: (cpu, address, value) => cpu._write8BitValue(address + cpu.reg_x, value)
  },
  "zp,y": {
    dataBytes: 1,
    fetchValue: (cpu, address) => cpu._read8BitValue(address + cpu.reg_y),
    storeValue: (cpu, address, value) => cpu._write8BitValue(address + cpu.reg_y, value)
  },
  abs: {
    dataBytes: 2,
    fetchValue: (cpu, address) => cpu._read8BitValue(address),
    storeValue: (cpu, address, value) => cpu._write8BitValue(address, value)
  },
  "abs,x": {
    dataBytes: 2,
    fetchValue: (cpu, address) => cpu._read8BitValue(address + cpu.reg_x),
    storeValue: (cpu, address, value) => cpu._write8BitValue(address + cpu.reg_x, value)
  },
  "abs,y": {
    dataBytes: 2,
    fetchValue: (cpu, address) => cpu._read8BitValue(address + cpu.reg_y),
    storeValue: (cpu, address, value) => cpu._write8BitValue(address + cpu.reg_y, value)
  },
  "(ind,x)": {
    dataBytes: 1,
    fetchValue: (cpu, indirectAddress) => {
      const address = cpu._read16BitValue(indirectAddress + cpu.reg_x);
      return cpu._read8BitValue(address);
    },
    storeValue: (cpu, indirectAddress, value) => {
      const address = cpu._read16BitValue(indirectAddress + cpu.reg_x);
      cpu._write8BitValue(address, value);
    }
  },
  "(ind),y": {
    dataBytes: 1,
    fetchValue: (cpu, indirectAddress) => {
      const address = cpu._read16BitValue(indirectAddress) + cpu.reg_y;
      return cpu._read8BitValue(address);
    },
    storeValue: (cpu, indirectAddress, value) => {
      const address = cpu._read16BitValue(indirectAddress) + cpu.reg_y;
      cpu._write8BitValue(address, value);
    }
  }
};
operationsWithMultipleAddressingModes.forEach((operation) => {
  Object.keys(operation.addressingModes).forEach((opcodeStr) => {
    const opcode = parseInt(opcodeStr, 10);
    const addressingModeLabel = operation.addressingModes[opcode];
    const addressingMode = addressingModes[addressingModeLabel];
    cpuOperations[opcode] = {
      name: `${operation.name} ${addressingModeLabel}`,
      dataBytes: addressingMode.dataBytes,
      // how meta can we get
      func: (cpu, param) => {
        const inputValue = addressingMode.fetchValue(cpu, param);
        const outputValue = operation.func(cpu, inputValue);
        if (outputValue !== void 0) {
          addressingMode.storeValue(cpu, param, outputValue);
        }
      }
    };
  });
});

// src/CPU6502.ts
var CPU6502 = class {
  // constructor
  constructor({
    accessMemory,
    logInstructions,
    maxInstructions
  }) {
    // configuration
    this.instructionsPerEventLoopBreathe = 1e4;
    this.logInstructions = false;
    this.logInternalState = false;
    this.maxInstructions = void 0;
    // internal CPU state
    // 3 primary registers
    this.reg_a = 0;
    // accumulator (8 bit)
    this.reg_x = 0;
    // x index register (8 bit)
    this.reg_y = 0;
    // y index register (8 bit)
    // internal registers
    this.programCounter = 0;
    // (16 bit)
    this.stackPointer = 85;
    // (8 bit, implicit stack page 0001)
    this.processorStatus = 32 /* const */;
    // (8 bit)
    // internal states
    this.clockMode = 0 /* paused */;
    this.interruptPending = false;
    this.isExecuting = false;
    this.instructionsExecuted = 0;
    // delegates
    this.accessMemory = () => {
      throw new Error("accessMemory function not configured");
    };
    if (accessMemory) {
      this.accessMemory = accessMemory;
    }
    if (logInstructions) {
      this.logInstructions = logInstructions;
    }
    if (maxInstructions) {
      this.maxInstructions = maxInstructions;
    }
  }
  // public functions
  reset() {
    this.interruptPending = "RESB";
    this.clockMode = 1 /* running */;
  }
  triggerIRQB(setBrk) {
    if (setBrk) {
      this.processorStatus = this.processorStatus | 16 /* brk */;
    } else {
      this.processorStatus = this.processorStatus & ~16 /* brk */;
    }
    this.interruptPending = "IRQB";
    if (this.clockMode === 2 /* waitForInterrupt */) {
      this.clockMode = 1 /* running */;
    }
  }
  triggerNMIB() {
    this.interruptPending = "NMIB";
    if (this.clockMode === 2 /* waitForInterrupt */) {
      this.clockMode = 1 /* running */;
    }
  }
  startClock() {
    this.clockMode = 1 /* running */;
    this.ensureExecutingIfNotPaused();
  }
  pauseClock() {
    this.clockMode = 0 /* paused */;
  }
  // micro-basic-ide patch: synchronous single-instruction step.
  // The upstream core only runs via the async setTimeout clock
  // (executeNextInstruction). A frame-driven host (e.g. an emulated machine
  // calling runFrame) needs to advance the CPU one instruction at a time,
  // synchronously, so this method executes exactly one instruction — servicing
  // any pending interrupt first — without touching the async clock. The
  // optional debug logging (logInstructions / logInternalState) only applies to
  // the async clock path and is intentionally omitted here. See LICENSE-6502.md.
  step() {
    if (this.interruptPending) {
      if (this.interruptPending === "IRQB") {
        this.execInterruptIRQB();
      }
      if (this.interruptPending === "NMIB") {
        this.execInterruptNMIB();
      }
      if (this.interruptPending === "RESB") {
        this.execInterruptReset();
      }
    }
    const instructionOpCode = this._read8BitValue(this.programCounter);
    this.programCounter++;
    const instruction = cpuOperations[instructionOpCode];
    if (instruction === void 0) {
      throw new Error(`Invalid opcode ${instructionOpCode.toString(16)}`);
    }
    let instructionParam = void 0;
    if (instruction.dataBytes === 1) {
      instructionParam = this._read8BitValue(this.programCounter);
      this.programCounter++;
    }
    if (instruction.dataBytes === 2) {
      instructionParam = this._read16BitValue(this.programCounter);
      this.programCounter += 2;
    }
    instruction.func(this, instructionParam);
    this.instructionsExecuted++;
  }
  // private functions -----------------------------------------------------------------
  executeNextInstruction() {
    for (let i = 0; i < this.instructionsPerEventLoopBreathe; i++) {
      if (this.clockMode !== 1 /* running */) {
        this.isExecuting = false;
        return;
      }
      if (this.interruptPending) {
        if (this.interruptPending === "IRQB") {
          this.execInterruptIRQB();
        }
        if (this.interruptPending === "NMIB") {
          this.execInterruptNMIB();
        }
        if (this.interruptPending === "RESB") {
          this.execInterruptReset();
        }
      }
      const instructionAddress = this.programCounter;
      const instructionOpCode = this._read8BitValue(instructionAddress);
      this.programCounter++;
      const instruction = cpuOperations[instructionOpCode];
      if (instruction === void 0) {
        throw new Error(`Invalid opcode ${instructionOpCode.toString(16)}`);
      }
      let instructionParam = void 0;
      if (instruction.dataBytes === 1) {
        instructionParam = this._read8BitValue(this.programCounter);
        this.programCounter++;
      }
      if (instruction.dataBytes === 2) {
        instructionParam = this._read16BitValue(this.programCounter);
        this.programCounter += 2;
      }
      if (this.logInternalState) {
        const dataStack = `${this._read8BitValue(16384 - 8).toString(
          16
        )}|${this._read8BitValue(16384 - 7).toString(
          16
        )}|${this._read8BitValue(16384 - 5).toString(
          16
        )}|${this._read8BitValue(16384 - 5).toString(
          16
        )}|${this._read8BitValue(16384 - 4).toString(
          16
        )}|${this._read8BitValue(16384 - 3).toString(
          16
        )}|${this._read8BitValue(16384 - 2).toString(
          16
        )}|${this._read8BitValue(16384 - 1).toString(
          16
        )}|${this._read8BitValue(16384).toString(16)}`;
        const hwStack = `${this._read8BitValue(511 - 15).toString(
          16
        )}|${this._read8BitValue(511 - 14).toString(
          16
        )}|${this._read8BitValue(511 - 13).toString(
          16
        )}|${this._read8BitValue(511 - 12).toString(
          16
        )}|${this._read8BitValue(511 - 11).toString(
          16
        )}|${this._read8BitValue(511 - 10).toString(
          16
        )}|${this._read8BitValue(511 - 9).toString(
          16
        )}|${this._read8BitValue(511 - 8).toString(
          16
        )}|${this._read8BitValue(511 - 7).toString(
          16
        )}|${this._read8BitValue(511 - 5).toString(
          16
        )}|${this._read8BitValue(511 - 5).toString(
          16
        )}|${this._read8BitValue(511 - 4).toString(
          16
        )}|${this._read8BitValue(511 - 3).toString(
          16
        )}|${this._read8BitValue(511 - 2).toString(
          16
        )}|${this._read8BitValue(511 - 1).toString(
          16
        )}|${this._read8BitValue(511).toString(16)}`;
        const carry = (this.processorStatus & 1 /* carry */) === 0 ? 0 : 1;
        console.log(
          `                                        a: ${this.reg_a.toString(
            16
          )} x: ${this.reg_x.toString(16)} y: ${this.reg_y.toString(
            16
          )} hwsp: ${this.stackPointer.toString(
            16
          )} dsp: ${this._read16BitValue(0).toString(
            16
          )} carry: ${carry} dataStack: ${dataStack} hwStack: ${hwStack}`
        );
      }
      if (this.logInstructions) {
        console.log(
          `${instructionAddress.toString(16)}: ${instruction.name}${instructionParam !== void 0 ? " [" + instructionParam.toString(16) + "]" : ""} - ${this.reg_a}`
        );
      }
      instruction.func(this, instructionParam);
      this.instructionsExecuted++;
      if (this.maxInstructions && this.instructionsExecuted >= this.maxInstructions) {
        console.warn(
          `Reached max instructions of ${this.maxInstructions}, pausing`
        );
        this.clockMode = 0 /* paused */;
      }
    }
    setTimeout(() => this.executeNextInstruction(), 1);
  }
  ensureExecutingIfNotPaused() {
    if (!this.isExecuting || this.clockMode !== 0 /* paused */) {
      this.executeNextInstruction();
    }
  }
  execInterruptReset() {
    this.reg_a = 0;
    this.reg_x = 0;
    this.reg_y = 0;
    this.stackPointer = 0;
    this.processorStatus = 32 /* const */;
    const resetVector = this._read16BitValue(65532);
    this.programCounter = resetVector;
    this.interruptPending = false;
  }
  execInterruptIRQB() {
    if ((this.processorStatus & 4 /* disableIrqb */) === 4 /* disableIrqb */) {
      return;
    }
    this._push16BitValueToStack(this.programCounter);
    this._push8BitValueToStack(this.processorStatus);
    this.processorStatus = this.processorStatus & 4 /* disableIrqb */;
    const irqbVector = this._read16BitValue(65534);
    this.programCounter = irqbVector;
    this.interruptPending = false;
  }
  execInterruptNMIB() {
    this._push16BitValueToStack(this.programCounter);
    this._push8BitValueToStack(this.processorStatus);
    const nmibVector = this._read16BitValue(65534);
    this.programCounter = nmibVector;
    this.interruptPending = false;
  }
  // private, utility functions --------------------------------------------------------
  // we don't use 'private' because the op code functions may make use of these internal methods
  _read8BitValue(address) {
    const value = this.accessMemory(0 /* read */, address);
    if (value < 0 || value > 255) {
      throw new Error(`Invalid 8 bit value ${value}`);
    }
    return value;
  }
  _write8BitValue(address, value) {
    if (value < 0 || value > 255) {
      throw new Error(`Invalid 8 bit value ${value}`);
    }
    this.accessMemory(1 /* write */, address, value);
  }
  _read16BitValue(address) {
    const lowByte = this._read8BitValue(address);
    const highByte = this._read8BitValue(address + 1);
    const value = (highByte << 8) + lowByte;
    if (value < 0 || value > 65535) {
      throw new Error(`Invalid 16 bit value ${value}`);
    }
    return value;
  }
  _write16BitValue(address, value) {
    if (value < 0 || value > 65535) {
      throw new Error(`Invalid 16 bit value ${value}`);
    }
    const highByte = value >> 8;
    const lowByte = value & 255;
    this._write8BitValue(address, lowByte);
    this._write8BitValue(address + 1, highByte);
  }
  _push8BitValueToStack(value) {
    const fullStackAddress = 256 + this.stackPointer;
    this._write8BitValue(fullStackAddress, value);
    this._decSP();
  }
  _pull8BitValueFromStack() {
    this._incSP();
    const fullStackAddress = 256 + this.stackPointer;
    const value = this._read8BitValue(fullStackAddress);
    return value;
  }
  _push16BitValueToStack(value) {
    if (value < 0 || value > 65535) {
      throw new Error(`Invalid 16 bit value ${value}`);
    }
    const highByte = value >> 8;
    const lowByte = value & 255;
    this._push8BitValueToStack(highByte);
    this._push8BitValueToStack(lowByte);
  }
  _pull16BitValueFromStack() {
    const lowByte = this._pull8BitValueFromStack();
    const highByte = this._pull8BitValueFromStack();
    const value = (highByte << 8) + lowByte;
    return value;
  }
  _decSP() {
    this.stackPointer--;
    if (this.stackPointer === -1) {
      this.stackPointer = 255;
    }
  }
  _incSP() {
    this.stackPointer++;
    if (this.stackPointer === 256) {
      this.stackPointer = 0;
    }
  }
  _convertValueTo8BitAndSetStatusFlags(value, checkCarry = false) {
    if (checkCarry) {
      const carry = (value & 256) === 256;
      if (carry) {
        this.processorStatus |= 1 /* carry */;
      } else {
        this.processorStatus &= ~1 /* carry */;
      }
    }
    const negative = (value & 128) === 128;
    if (negative) {
      this.processorStatus |= 128 /* negative */;
    } else {
      this.processorStatus &= ~128 /* negative */;
    }
    const zero = value === 0;
    if (zero) {
      this.processorStatus |= 2 /* zero */;
    } else {
      this.processorStatus &= ~2 /* zero */;
    }
    value = value & 255;
    return value;
  }
};
export {
  CPU6502,
  ClockMode,
  ProcessorStatus,
  ReadWrite
};
