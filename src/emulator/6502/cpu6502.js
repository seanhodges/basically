// Vendored 6502 CPU core — see LICENSE-6502.md for attribution.
// Bundled from https://github.com/6502ts/6502.ts (MIT, © 2014–2020 Christian
// Speckner and contributors) at commit 9c59f7d01e316a290480dd432a41cbab4e0238a9.
// Generated build output (esbuild --bundle --format=esm). Do not edit by hand;
// this is the cycle-exact state-machine CPU (StateMachineCpu) taken unmodified.
// See LICENSE-6502.md for the exact vendoring command and file list.
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};

// src/machine/cpu/CpuInterface.ts
var CpuInterface;
((CpuInterface2) => {
  let ExecutionState2;
  ((ExecutionState3) => {
    ExecutionState3[ExecutionState3["boot"] = 0] = "boot";
    ExecutionState3[ExecutionState3["fetch"] = 1] = "fetch";
    ExecutionState3[ExecutionState3["execute"] = 2] = "execute";
  })(ExecutionState2 = CpuInterface2.ExecutionState || (CpuInterface2.ExecutionState = {}));
  class State {
    constructor() {
      this.a = 0;
      this.x = 0;
      this.y = 0;
      this.s = 0;
      this.p = 0;
      this.flags = 0;
      this.irq = false;
      this.nmi = false;
    }
  }
  CpuInterface2.State = State;
  let Flags2;
  ((Flags3) => {
    Flags3[Flags3["c"] = 1] = "c";
    Flags3[Flags3["z"] = 2] = "z";
    Flags3[Flags3["i"] = 4] = "i";
    Flags3[Flags3["d"] = 8] = "d";
    Flags3[Flags3["b"] = 16] = "b";
    Flags3[Flags3["e"] = 32] = "e";
    Flags3[Flags3["v"] = 64] = "v";
    Flags3[Flags3["n"] = 128] = "n";
  })(Flags2 = CpuInterface2.Flags || (CpuInterface2.Flags = {}));
})(CpuInterface || (CpuInterface = {}));

// src/machine/cpu/statemachine/StateMachineInterface.ts
var StateMachineInterface;
((StateMachineInterface2) => {
  let CycleType;
  ((CycleType2) => {
    CycleType2[CycleType2["read"] = 0] = "read";
    CycleType2[CycleType2["write"] = 1] = "write";
  })(CycleType = StateMachineInterface2.CycleType || (StateMachineInterface2.CycleType = {}));
})(StateMachineInterface || (StateMachineInterface = {}));
var StateMachineInterface_default = StateMachineInterface;

// src/machine/cpu/statemachine/ResultImpl.ts
var ResultImpl = class {
  constructor() {
    this.cycleType = StateMachineInterface_default.CycleType.read;
    this.address = 0;
    this.value = 0;
    this.pollInterrupts = false;
    this.nextStep = null;
  }
  read(nextStep, address) {
    this.cycleType = StateMachineInterface_default.CycleType.read;
    this.address = address;
    this.nextStep = nextStep;
    return this;
  }
  write(nextStep, address, value) {
    this.cycleType = StateMachineInterface_default.CycleType.write;
    this.address = address;
    this.value = value;
    this.nextStep = nextStep;
    return this;
  }
  poll(poll) {
    this.pollInterrupts = poll;
    return this;
  }
};
var ResultImpl_default = ResultImpl;

// src/tools/decorators.ts
var immutables = /* @__PURE__ */ Symbol("immutable properties");
function freezeImmutables(target) {
  const immutableProperties = target[immutables];
  if (!immutableProperties) {
    return;
  }
  for (const prop of immutableProperties) {
    Object.defineProperty(target, prop, { writable: false, configurable: false });
  }
}
function Immutable(target, prop) {
  if (!target[immutables]) {
    Object.defineProperty(target, immutables, { value: [], writable: false, enumerable: false });
  }
  target[immutables].push(prop);
}

// src/machine/cpu/statemachine/vector/boot.ts
var Boot = class {
  constructor(state) {
    this.reset = () => this._result.read(this._pre1Step, 255);
    this._pre1Step = () => this._result.read(this._pre2Step, 255);
    this._pre2Step = () => this._result.read(this._stack1Step, 256);
    this._stack1Step = () => this._result.read(this._stack2Step, 511);
    this._stack2Step = () => {
      this._state.s = 253;
      return this._result.read(this._stack3Step, 510);
    };
    this._stack3Step = () => this._result.read(this._readTargetLoStep, 65532);
    this._readTargetLoStep = (operand) => {
      this._targetAddress = operand;
      return this._result.read(this._readTargetHiStep, 65533);
    };
    this._readTargetHiStep = (operand) => {
      this._targetAddress |= operand << 8;
      this._state.p = this._targetAddress;
      return null;
    };
    this._targetAddress = 0;
    this._result = new ResultImpl_default();
    this._state = state;
    freezeImmutables(this);
  }
};
__decorateClass([
  Immutable
], Boot.prototype, "reset", 2);
__decorateClass([
  Immutable
], Boot.prototype, "_pre1Step", 2);
__decorateClass([
  Immutable
], Boot.prototype, "_pre2Step", 2);
__decorateClass([
  Immutable
], Boot.prototype, "_stack1Step", 2);
__decorateClass([
  Immutable
], Boot.prototype, "_stack2Step", 2);
__decorateClass([
  Immutable
], Boot.prototype, "_stack3Step", 2);
__decorateClass([
  Immutable
], Boot.prototype, "_readTargetLoStep", 2);
__decorateClass([
  Immutable
], Boot.prototype, "_readTargetHiStep", 2);
__decorateClass([
  Immutable
], Boot.prototype, "_result", 2);
__decorateClass([
  Immutable
], Boot.prototype, "_state", 2);
var boot = (state) => new Boot(state);

// src/machine/cpu/statemachine/vector/interrupt.ts
var Interrupt = class {
  constructor(state, defaultVector, isBrk) {
    this.reset = () => this._result.read(this._dummyRead, this._state.p);
    this._dummyRead = () => {
      if (this._isBrk) {
        this._state.p = this._state.p + 1 & 65535;
      }
      return this._result.write(this._pushPch, 256 + this._state.s, this._state.p >>> 8);
    };
    this._pushPch = () => {
      this._state.s = this._state.s - 1 & 255;
      return this._result.write(this._pushPcl, 256 + this._state.s, this._state.p & 255).poll(true);
    };
    this._pushPcl = () => {
      this._state.s = this._state.s - 1 & 255;
      this._vector = this._state.nmi ? 65530 : this._defaultVector;
      return this._result.write(
        this._pushFlags,
        256 + this._state.s,
        this._isBrk ? this._state.flags | CpuInterface.Flags.b : this._state.flags & ~CpuInterface.Flags.b
      );
    };
    this._pushFlags = () => {
      this._state.s = this._state.s - 1 & 255;
      return this._result.read(this._fetchPcl, this._vector);
    };
    this._fetchPcl = (value) => {
      this._state.flags |= CpuInterface.Flags.i;
      this._state.p = value;
      return this._result.read(this._fetchPch, ++this._vector);
    };
    this._fetchPch = (value) => {
      this._state.p = this._state.p | value << 8;
      this._state.nmi = this._state.irq = false;
      return null;
    };
    this._vector = 0;
    this._result = new ResultImpl_default();
    this._state = state;
    this._defaultVector = defaultVector;
    this._isBrk = isBrk;
    freezeImmutables(this);
  }
};
__decorateClass([
  Immutable
], Interrupt.prototype, "reset", 2);
__decorateClass([
  Immutable
], Interrupt.prototype, "_dummyRead", 2);
__decorateClass([
  Immutable
], Interrupt.prototype, "_pushPch", 2);
__decorateClass([
  Immutable
], Interrupt.prototype, "_pushPcl", 2);
__decorateClass([
  Immutable
], Interrupt.prototype, "_pushFlags", 2);
__decorateClass([
  Immutable
], Interrupt.prototype, "_fetchPcl", 2);
__decorateClass([
  Immutable
], Interrupt.prototype, "_fetchPch", 2);
__decorateClass([
  Immutable
], Interrupt.prototype, "_result", 2);
__decorateClass([
  Immutable
], Interrupt.prototype, "_state", 2);
__decorateClass([
  Immutable
], Interrupt.prototype, "_defaultVector", 2);
__decorateClass([
  Immutable
], Interrupt.prototype, "_isBrk", 2);
var brk = (state) => new Interrupt(state, 65534, true);
var irq = (state) => new Interrupt(state, 65534, false);
var nmi = (state) => new Interrupt(state, 65530, false);

// src/machine/cpu/Instruction.ts
var Instruction = class _Instruction {
  constructor(operation, addressingMode, effectiveAddressingMode = addressingMode) {
    this.operation = operation;
    this.addressingMode = addressingMode;
    this.effectiveAddressingMode = effectiveAddressingMode;
  }
  getSize() {
    switch (this.effectiveAddressingMode) {
      case _Instruction.AddressingMode.immediate:
      case _Instruction.AddressingMode.zeroPage:
      case _Instruction.AddressingMode.zeroPageX:
      case _Instruction.AddressingMode.zeroPageY:
      case _Instruction.AddressingMode.indexedIndirectX:
      case _Instruction.AddressingMode.indirectIndexedY:
      case _Instruction.AddressingMode.relative:
        return 2;
      case _Instruction.AddressingMode.absolute:
      case _Instruction.AddressingMode.absoluteX:
      case _Instruction.AddressingMode.absoluteY:
      case _Instruction.AddressingMode.indirect:
        return 3;
      default:
        return 1;
    }
  }
};
((Instruction2) => {
  let Operation;
  ((Operation2) => {
    Operation2[Operation2["adc"] = 0] = "adc";
    Operation2[Operation2["and"] = 1] = "and";
    Operation2[Operation2["asl"] = 2] = "asl";
    Operation2[Operation2["bcc"] = 3] = "bcc";
    Operation2[Operation2["bcs"] = 4] = "bcs";
    Operation2[Operation2["beq"] = 5] = "beq";
    Operation2[Operation2["bit"] = 6] = "bit";
    Operation2[Operation2["bmi"] = 7] = "bmi";
    Operation2[Operation2["bne"] = 8] = "bne";
    Operation2[Operation2["bpl"] = 9] = "bpl";
    Operation2[Operation2["brk"] = 10] = "brk";
    Operation2[Operation2["bvc"] = 11] = "bvc";
    Operation2[Operation2["bvs"] = 12] = "bvs";
    Operation2[Operation2["clc"] = 13] = "clc";
    Operation2[Operation2["cld"] = 14] = "cld";
    Operation2[Operation2["cli"] = 15] = "cli";
    Operation2[Operation2["clv"] = 16] = "clv";
    Operation2[Operation2["cmp"] = 17] = "cmp";
    Operation2[Operation2["cpx"] = 18] = "cpx";
    Operation2[Operation2["cpy"] = 19] = "cpy";
    Operation2[Operation2["dec"] = 20] = "dec";
    Operation2[Operation2["dex"] = 21] = "dex";
    Operation2[Operation2["dey"] = 22] = "dey";
    Operation2[Operation2["eor"] = 23] = "eor";
    Operation2[Operation2["inc"] = 24] = "inc";
    Operation2[Operation2["inx"] = 25] = "inx";
    Operation2[Operation2["iny"] = 26] = "iny";
    Operation2[Operation2["jmp"] = 27] = "jmp";
    Operation2[Operation2["jsr"] = 28] = "jsr";
    Operation2[Operation2["lda"] = 29] = "lda";
    Operation2[Operation2["ldx"] = 30] = "ldx";
    Operation2[Operation2["ldy"] = 31] = "ldy";
    Operation2[Operation2["lsr"] = 32] = "lsr";
    Operation2[Operation2["nop"] = 33] = "nop";
    Operation2[Operation2["ora"] = 34] = "ora";
    Operation2[Operation2["pha"] = 35] = "pha";
    Operation2[Operation2["php"] = 36] = "php";
    Operation2[Operation2["pla"] = 37] = "pla";
    Operation2[Operation2["plp"] = 38] = "plp";
    Operation2[Operation2["rol"] = 39] = "rol";
    Operation2[Operation2["ror"] = 40] = "ror";
    Operation2[Operation2["rti"] = 41] = "rti";
    Operation2[Operation2["rts"] = 42] = "rts";
    Operation2[Operation2["sbc"] = 43] = "sbc";
    Operation2[Operation2["sec"] = 44] = "sec";
    Operation2[Operation2["sed"] = 45] = "sed";
    Operation2[Operation2["sei"] = 46] = "sei";
    Operation2[Operation2["sta"] = 47] = "sta";
    Operation2[Operation2["stx"] = 48] = "stx";
    Operation2[Operation2["sty"] = 49] = "sty";
    Operation2[Operation2["tax"] = 50] = "tax";
    Operation2[Operation2["tay"] = 51] = "tay";
    Operation2[Operation2["tsx"] = 52] = "tsx";
    Operation2[Operation2["txa"] = 53] = "txa";
    Operation2[Operation2["txs"] = 54] = "txs";
    Operation2[Operation2["tya"] = 55] = "tya";
    Operation2[Operation2["dop"] = 56] = "dop";
    Operation2[Operation2["top"] = 57] = "top";
    Operation2[Operation2["alr"] = 58] = "alr";
    Operation2[Operation2["axs"] = 59] = "axs";
    Operation2[Operation2["dcp"] = 60] = "dcp";
    Operation2[Operation2["lax"] = 61] = "lax";
    Operation2[Operation2["arr"] = 62] = "arr";
    Operation2[Operation2["slo"] = 63] = "slo";
    Operation2[Operation2["aax"] = 64] = "aax";
    Operation2[Operation2["lar"] = 65] = "lar";
    Operation2[Operation2["isc"] = 66] = "isc";
    Operation2[Operation2["aac"] = 67] = "aac";
    Operation2[Operation2["atx"] = 68] = "atx";
    Operation2[Operation2["rra"] = 69] = "rra";
    Operation2[Operation2["rla"] = 70] = "rla";
    Operation2[Operation2["invalid"] = 71] = "invalid";
  })(Operation = Instruction2.Operation || (Instruction2.Operation = {}));
  let OperationMap;
  ((OperationMap2) => {
    OperationMap2[OperationMap2["adc"] = 0] = "adc";
    OperationMap2[OperationMap2["and"] = 1] = "and";
    OperationMap2[OperationMap2["asl"] = 2] = "asl";
    OperationMap2[OperationMap2["bcc"] = 3] = "bcc";
    OperationMap2[OperationMap2["bcs"] = 4] = "bcs";
    OperationMap2[OperationMap2["beq"] = 5] = "beq";
    OperationMap2[OperationMap2["bit"] = 6] = "bit";
    OperationMap2[OperationMap2["bmi"] = 7] = "bmi";
    OperationMap2[OperationMap2["bne"] = 8] = "bne";
    OperationMap2[OperationMap2["bpl"] = 9] = "bpl";
    OperationMap2[OperationMap2["brk"] = 10] = "brk";
    OperationMap2[OperationMap2["bvc"] = 11] = "bvc";
    OperationMap2[OperationMap2["bvs"] = 12] = "bvs";
    OperationMap2[OperationMap2["clc"] = 13] = "clc";
    OperationMap2[OperationMap2["cld"] = 14] = "cld";
    OperationMap2[OperationMap2["cli"] = 15] = "cli";
    OperationMap2[OperationMap2["clv"] = 16] = "clv";
    OperationMap2[OperationMap2["cmp"] = 17] = "cmp";
    OperationMap2[OperationMap2["cpx"] = 18] = "cpx";
    OperationMap2[OperationMap2["cpy"] = 19] = "cpy";
    OperationMap2[OperationMap2["dec"] = 20] = "dec";
    OperationMap2[OperationMap2["dex"] = 21] = "dex";
    OperationMap2[OperationMap2["dey"] = 22] = "dey";
    OperationMap2[OperationMap2["eor"] = 23] = "eor";
    OperationMap2[OperationMap2["inc"] = 24] = "inc";
    OperationMap2[OperationMap2["inx"] = 25] = "inx";
    OperationMap2[OperationMap2["iny"] = 26] = "iny";
    OperationMap2[OperationMap2["jmp"] = 27] = "jmp";
    OperationMap2[OperationMap2["jsr"] = 28] = "jsr";
    OperationMap2[OperationMap2["lda"] = 29] = "lda";
    OperationMap2[OperationMap2["ldx"] = 30] = "ldx";
    OperationMap2[OperationMap2["ldy"] = 31] = "ldy";
    OperationMap2[OperationMap2["lsr"] = 32] = "lsr";
    OperationMap2[OperationMap2["nop"] = 33] = "nop";
    OperationMap2[OperationMap2["ora"] = 34] = "ora";
    OperationMap2[OperationMap2["pha"] = 35] = "pha";
    OperationMap2[OperationMap2["php"] = 36] = "php";
    OperationMap2[OperationMap2["pla"] = 37] = "pla";
    OperationMap2[OperationMap2["plp"] = 38] = "plp";
    OperationMap2[OperationMap2["rol"] = 39] = "rol";
    OperationMap2[OperationMap2["ror"] = 40] = "ror";
    OperationMap2[OperationMap2["rti"] = 41] = "rti";
    OperationMap2[OperationMap2["rts"] = 42] = "rts";
    OperationMap2[OperationMap2["sbc"] = 43] = "sbc";
    OperationMap2[OperationMap2["sec"] = 44] = "sec";
    OperationMap2[OperationMap2["sed"] = 45] = "sed";
    OperationMap2[OperationMap2["sei"] = 46] = "sei";
    OperationMap2[OperationMap2["sta"] = 47] = "sta";
    OperationMap2[OperationMap2["stx"] = 48] = "stx";
    OperationMap2[OperationMap2["sty"] = 49] = "sty";
    OperationMap2[OperationMap2["tax"] = 50] = "tax";
    OperationMap2[OperationMap2["tay"] = 51] = "tay";
    OperationMap2[OperationMap2["tsx"] = 52] = "tsx";
    OperationMap2[OperationMap2["txa"] = 53] = "txa";
    OperationMap2[OperationMap2["txs"] = 54] = "txs";
    OperationMap2[OperationMap2["tya"] = 55] = "tya";
    OperationMap2[OperationMap2["dop"] = 56] = "dop";
    OperationMap2[OperationMap2["top"] = 57] = "top";
    OperationMap2[OperationMap2["alr"] = 58] = "alr";
    OperationMap2[OperationMap2["axs"] = 59] = "axs";
    OperationMap2[OperationMap2["dcp"] = 60] = "dcp";
    OperationMap2[OperationMap2["lax"] = 61] = "lax";
    OperationMap2[OperationMap2["arr"] = 62] = "arr";
    OperationMap2[OperationMap2["slo"] = 63] = "slo";
    OperationMap2[OperationMap2["aax"] = 64] = "aax";
    OperationMap2[OperationMap2["lar"] = 65] = "lar";
    OperationMap2[OperationMap2["isc"] = 66] = "isc";
    OperationMap2[OperationMap2["aac"] = 67] = "aac";
    OperationMap2[OperationMap2["atx"] = 68] = "atx";
    OperationMap2[OperationMap2["rra"] = 69] = "rra";
    OperationMap2[OperationMap2["rla"] = 70] = "rla";
    OperationMap2[OperationMap2["invalid"] = 71] = "invalid";
  })(OperationMap = Instruction2.OperationMap || (Instruction2.OperationMap = {}));
  let AddressingMode;
  ((AddressingMode2) => {
    AddressingMode2[AddressingMode2["implied"] = 0] = "implied";
    AddressingMode2[AddressingMode2["immediate"] = 1] = "immediate";
    AddressingMode2[AddressingMode2["zeroPage"] = 2] = "zeroPage";
    AddressingMode2[AddressingMode2["absolute"] = 3] = "absolute";
    AddressingMode2[AddressingMode2["indirect"] = 4] = "indirect";
    AddressingMode2[AddressingMode2["relative"] = 5] = "relative";
    AddressingMode2[AddressingMode2["zeroPageX"] = 6] = "zeroPageX";
    AddressingMode2[AddressingMode2["absoluteX"] = 7] = "absoluteX";
    AddressingMode2[AddressingMode2["indexedIndirectX"] = 8] = "indexedIndirectX";
    AddressingMode2[AddressingMode2["zeroPageY"] = 9] = "zeroPageY";
    AddressingMode2[AddressingMode2["absoluteY"] = 10] = "absoluteY";
    AddressingMode2[AddressingMode2["indirectIndexedY"] = 11] = "indirectIndexedY";
    AddressingMode2[AddressingMode2["invalid"] = 12] = "invalid";
  })(AddressingMode = Instruction2.AddressingMode || (Instruction2.AddressingMode = {}));
  Instruction2.opcodes = new Array(256);
})(Instruction || (Instruction = {}));
((Instruction2) => {
  let __init;
  ((__init2) => {
    for (let i = 0; i < 256; i++) {
      Instruction2.opcodes[i] = new Instruction2(71 /* invalid */, 12 /* invalid */);
    }
    let operation, addressingMode, opcode;
    for (let i = 0; i < 8; i++) {
      switch (i) {
        case 0:
          operation = 34 /* ora */;
          break;
        case 1:
          operation = 1 /* and */;
          break;
        case 2:
          operation = 23 /* eor */;
          break;
        case 3:
          operation = 0 /* adc */;
          break;
        case 4:
          operation = 47 /* sta */;
          break;
        case 5:
          operation = 29 /* lda */;
          break;
        case 6:
          operation = 17 /* cmp */;
          break;
        case 7:
          operation = 43 /* sbc */;
          break;
      }
      for (let j = 0; j < 8; j++) {
        switch (j) {
          case 0:
            addressingMode = 8 /* indexedIndirectX */;
            break;
          case 1:
            addressingMode = 2 /* zeroPage */;
            break;
          case 2:
            addressingMode = 1 /* immediate */;
            break;
          case 3:
            addressingMode = 3 /* absolute */;
            break;
          case 4:
            addressingMode = 11 /* indirectIndexedY */;
            break;
          case 5:
            addressingMode = 6 /* zeroPageX */;
            break;
          case 6:
            addressingMode = 10 /* absoluteY */;
            break;
          case 7:
            addressingMode = 7 /* absoluteX */;
            break;
        }
        if (operation === 47 /* sta */ && addressingMode === 1 /* immediate */) {
          addressingMode = 12 /* invalid */;
        }
        if (operation !== 71 /* invalid */ && addressingMode !== 12 /* invalid */) {
          opcode = i << 5 | j << 2 | 1;
          Instruction2.opcodes[opcode] = new Instruction2(operation, addressingMode);
        }
      }
    }
    function set(_opcode, _operation, _addressingMode, _effectiveAdressingMode) {
      if (Instruction2.opcodes[_opcode].operation !== 71 /* invalid */) {
        throw new Error("entry for opcode " + _opcode + " already exists");
      }
      Instruction2.opcodes[_opcode] = new Instruction2(_operation, _addressingMode, _effectiveAdressingMode);
    }
    set(6, 2 /* asl */, 2 /* zeroPage */);
    set(10, 2 /* asl */, 0 /* implied */);
    set(14, 2 /* asl */, 3 /* absolute */);
    set(22, 2 /* asl */, 6 /* zeroPageX */);
    set(30, 2 /* asl */, 7 /* absoluteX */);
    set(38, 39 /* rol */, 2 /* zeroPage */);
    set(42, 39 /* rol */, 0 /* implied */);
    set(46, 39 /* rol */, 3 /* absolute */);
    set(54, 39 /* rol */, 6 /* zeroPageX */);
    set(62, 39 /* rol */, 7 /* absoluteX */);
    set(70, 32 /* lsr */, 2 /* zeroPage */);
    set(74, 32 /* lsr */, 0 /* implied */);
    set(78, 32 /* lsr */, 3 /* absolute */);
    set(86, 32 /* lsr */, 6 /* zeroPageX */);
    set(94, 32 /* lsr */, 7 /* absoluteX */);
    set(102, 40 /* ror */, 2 /* zeroPage */);
    set(106, 40 /* ror */, 0 /* implied */);
    set(110, 40 /* ror */, 3 /* absolute */);
    set(118, 40 /* ror */, 6 /* zeroPageX */);
    set(126, 40 /* ror */, 7 /* absoluteX */);
    set(134, 48 /* stx */, 2 /* zeroPage */);
    set(142, 48 /* stx */, 3 /* absolute */);
    set(150, 48 /* stx */, 9 /* zeroPageY */);
    set(162, 30 /* ldx */, 1 /* immediate */);
    set(166, 30 /* ldx */, 2 /* zeroPage */);
    set(174, 30 /* ldx */, 3 /* absolute */);
    set(182, 30 /* ldx */, 9 /* zeroPageY */);
    set(190, 30 /* ldx */, 10 /* absoluteY */);
    set(198, 20 /* dec */, 2 /* zeroPage */);
    set(206, 20 /* dec */, 3 /* absolute */);
    set(214, 20 /* dec */, 6 /* zeroPageX */);
    set(222, 20 /* dec */, 7 /* absoluteX */);
    set(230, 24 /* inc */, 2 /* zeroPage */);
    set(238, 24 /* inc */, 3 /* absolute */);
    set(246, 24 /* inc */, 6 /* zeroPageX */);
    set(254, 24 /* inc */, 7 /* absoluteX */);
    set(36, 6 /* bit */, 2 /* zeroPage */);
    set(44, 6 /* bit */, 3 /* absolute */);
    set(76, 27 /* jmp */, 3 /* absolute */);
    set(108, 27 /* jmp */, 4 /* indirect */);
    set(132, 49 /* sty */, 2 /* zeroPage */);
    set(140, 49 /* sty */, 3 /* absolute */);
    set(148, 49 /* sty */, 6 /* zeroPageX */);
    set(160, 31 /* ldy */, 1 /* immediate */);
    set(164, 31 /* ldy */, 2 /* zeroPage */);
    set(172, 31 /* ldy */, 3 /* absolute */);
    set(180, 31 /* ldy */, 6 /* zeroPageX */);
    set(188, 31 /* ldy */, 7 /* absoluteX */);
    set(192, 19 /* cpy */, 1 /* immediate */);
    set(196, 19 /* cpy */, 2 /* zeroPage */);
    set(204, 19 /* cpy */, 3 /* absolute */);
    set(224, 18 /* cpx */, 1 /* immediate */);
    set(228, 18 /* cpx */, 2 /* zeroPage */);
    set(236, 18 /* cpx */, 3 /* absolute */);
    set(16, 9 /* bpl */, 5 /* relative */);
    set(48, 7 /* bmi */, 5 /* relative */);
    set(80, 11 /* bvc */, 5 /* relative */);
    set(112, 12 /* bvs */, 5 /* relative */);
    set(144, 3 /* bcc */, 5 /* relative */);
    set(176, 4 /* bcs */, 5 /* relative */);
    set(208, 8 /* bne */, 5 /* relative */);
    set(240, 5 /* beq */, 5 /* relative */);
    set(0, 10 /* brk */, 0 /* implied */);
    set(32, 28 /* jsr */, 0 /* implied */, 3 /* absolute */);
    set(64, 41 /* rti */, 0 /* implied */);
    set(96, 42 /* rts */, 0 /* implied */);
    set(8, 36 /* php */, 0 /* implied */);
    set(40, 38 /* plp */, 0 /* implied */);
    set(72, 35 /* pha */, 0 /* implied */);
    set(104, 37 /* pla */, 0 /* implied */);
    set(136, 22 /* dey */, 0 /* implied */);
    set(168, 51 /* tay */, 0 /* implied */);
    set(200, 26 /* iny */, 0 /* implied */);
    set(232, 25 /* inx */, 0 /* implied */);
    set(24, 13 /* clc */, 0 /* implied */);
    set(56, 44 /* sec */, 0 /* implied */);
    set(88, 15 /* cli */, 0 /* implied */);
    set(120, 46 /* sei */, 0 /* implied */);
    set(152, 55 /* tya */, 0 /* implied */);
    set(184, 16 /* clv */, 0 /* implied */);
    set(216, 14 /* cld */, 0 /* implied */);
    set(248, 45 /* sed */, 0 /* implied */);
    set(138, 53 /* txa */, 0 /* implied */);
    set(154, 54 /* txs */, 0 /* implied */);
    set(170, 50 /* tax */, 0 /* implied */);
    set(186, 52 /* tsx */, 0 /* implied */);
    set(202, 21 /* dex */, 0 /* implied */);
    set(234, 33 /* nop */, 0 /* implied */);
    set(26, 33 /* nop */, 0 /* implied */);
    set(58, 33 /* nop */, 0 /* implied */);
    set(90, 33 /* nop */, 0 /* implied */);
    set(122, 33 /* nop */, 0 /* implied */);
    set(218, 33 /* nop */, 0 /* implied */);
    set(250, 33 /* nop */, 0 /* implied */);
    set(4, 56 /* dop */, 2 /* zeroPage */);
    set(20, 56 /* dop */, 6 /* zeroPageX */);
    set(52, 56 /* dop */, 6 /* zeroPageX */);
    set(68, 56 /* dop */, 2 /* zeroPage */);
    set(84, 56 /* dop */, 6 /* zeroPageX */);
    set(100, 56 /* dop */, 2 /* zeroPage */);
    set(116, 56 /* dop */, 6 /* zeroPageX */);
    set(128, 56 /* dop */, 1 /* immediate */);
    set(130, 56 /* dop */, 1 /* immediate */);
    set(137, 56 /* dop */, 1 /* immediate */);
    set(194, 56 /* dop */, 1 /* immediate */);
    set(212, 56 /* dop */, 6 /* zeroPageX */);
    set(226, 56 /* dop */, 1 /* immediate */);
    set(244, 56 /* dop */, 6 /* zeroPageX */);
    set(12, 57 /* top */, 3 /* absolute */);
    set(28, 57 /* top */, 7 /* absoluteX */);
    set(60, 57 /* top */, 7 /* absoluteX */);
    set(92, 57 /* top */, 7 /* absoluteX */);
    set(124, 57 /* top */, 7 /* absoluteX */);
    set(220, 57 /* top */, 7 /* absoluteX */);
    set(252, 57 /* top */, 7 /* absoluteX */);
    set(235, 43 /* sbc */, 1 /* immediate */);
    set(75, 58 /* alr */, 1 /* immediate */);
    set(203, 59 /* axs */, 1 /* immediate */);
    set(199, 60 /* dcp */, 2 /* zeroPage */);
    set(215, 60 /* dcp */, 6 /* zeroPageX */);
    set(207, 60 /* dcp */, 3 /* absolute */);
    set(223, 60 /* dcp */, 7 /* absoluteX */);
    set(219, 60 /* dcp */, 10 /* absoluteY */);
    set(195, 60 /* dcp */, 8 /* indexedIndirectX */);
    set(211, 60 /* dcp */, 11 /* indirectIndexedY */);
    set(167, 61 /* lax */, 2 /* zeroPage */);
    set(183, 61 /* lax */, 9 /* zeroPageY */);
    set(175, 61 /* lax */, 3 /* absolute */);
    set(191, 61 /* lax */, 10 /* absoluteY */);
    set(163, 61 /* lax */, 8 /* indexedIndirectX */);
    set(179, 61 /* lax */, 11 /* indirectIndexedY */);
    set(107, 62 /* arr */, 1 /* immediate */);
    set(7, 63 /* slo */, 2 /* zeroPage */);
    set(23, 63 /* slo */, 6 /* zeroPageX */);
    set(15, 63 /* slo */, 3 /* absolute */);
    set(31, 63 /* slo */, 7 /* absoluteX */);
    set(27, 63 /* slo */, 10 /* absoluteY */);
    set(3, 63 /* slo */, 8 /* indexedIndirectX */);
    set(19, 63 /* slo */, 11 /* indirectIndexedY */);
    set(135, 64 /* aax */, 2 /* zeroPage */);
    set(151, 64 /* aax */, 9 /* zeroPageY */);
    set(131, 64 /* aax */, 8 /* indexedIndirectX */);
    set(143, 64 /* aax */, 3 /* absolute */);
    set(187, 65 /* lar */, 10 /* absoluteY */);
    set(231, 66 /* isc */, 2 /* zeroPage */);
    set(247, 66 /* isc */, 6 /* zeroPageX */);
    set(239, 66 /* isc */, 3 /* absolute */);
    set(255, 66 /* isc */, 7 /* absoluteX */);
    set(251, 66 /* isc */, 10 /* absoluteY */);
    set(227, 66 /* isc */, 8 /* indexedIndirectX */);
    set(243, 66 /* isc */, 11 /* indirectIndexedY */);
    set(11, 67 /* aac */, 1 /* immediate */);
    set(43, 67 /* aac */, 1 /* immediate */);
    set(171, 68 /* atx */, 1 /* immediate */);
    set(103, 69 /* rra */, 2 /* zeroPage */);
    set(119, 69 /* rra */, 6 /* zeroPageX */);
    set(111, 69 /* rra */, 3 /* absolute */);
    set(127, 69 /* rra */, 7 /* absoluteX */);
    set(123, 69 /* rra */, 10 /* absoluteY */);
    set(99, 69 /* rra */, 8 /* indexedIndirectX */);
    set(115, 69 /* rra */, 11 /* indirectIndexedY */);
    set(39, 70 /* rla */, 2 /* zeroPage */);
    set(55, 70 /* rla */, 6 /* zeroPageX */);
    set(47, 70 /* rla */, 3 /* absolute */);
    set(63, 70 /* rla */, 7 /* absoluteX */);
    set(59, 70 /* rla */, 10 /* absoluteY */);
    set(35, 70 /* rla */, 8 /* indexedIndirectX */);
    set(51, 70 /* rla */, 11 /* indirectIndexedY */);
  })(__init = Instruction2.__init || (Instruction2.__init = {}));
})(Instruction || (Instruction = {}));

// src/machine/cpu/statemachine/addressing/absolute.ts
var Absolute = class {
  constructor(state, next = () => null) {
    this.reset = () => this._result.read(this._fetchLo, this._state.p);
    this._fetchLo = (value) => {
      this._operand = value;
      this._state.p = this._state.p + 1 & 65535;
      return this._result.read(this._fetchHi, this._state.p);
    };
    this._fetchHi = (value) => {
      this._operand |= value << 8;
      this._state.p = this._state.p + 1 & 65535;
      return this._next(this._operand, this._state);
    };
    this._operand = 0;
    this._result = new ResultImpl_default();
    this._state = state;
    this._next = next;
    freezeImmutables(this);
  }
};
__decorateClass([
  Immutable
], Absolute.prototype, "reset", 2);
__decorateClass([
  Immutable
], Absolute.prototype, "_fetchLo", 2);
__decorateClass([
  Immutable
], Absolute.prototype, "_fetchHi", 2);
__decorateClass([
  Immutable
], Absolute.prototype, "_result", 2);
__decorateClass([
  Immutable
], Absolute.prototype, "_state", 2);
__decorateClass([
  Immutable
], Absolute.prototype, "_next", 2);
var absolute = (state, next) => new Absolute(state, next);

// src/machine/cpu/statemachine/addressing/absoluteIndexed.ts
var _AbsoluteIndexed = class _AbsoluteIndexed {
  constructor(state, indexExtractor, next = () => null, writeOp = false) {
    this.reset = () => this._result.read(this._fetchLo, this._state.p);
    this._fetchLo = (value) => {
      this._operand = value;
      this._state.p = this._state.p + 1 & 65535;
      return this._result.read(this._fetchHi, this._state.p);
    };
    this._fetchHi = (value) => {
      this._operand |= value << 8;
      this._state.p = this._state.p + 1 & 65535;
      const index = this._indexExtractor(this._state);
      this._carry = (this._operand & 255) + index > 255;
      this._operand = this._operand & 65280 | this._operand + index & 255;
      return this._carry || this._writeOp ? this._result.read(this._dereferenceAndCarry, this._operand) : this._next(this._operand, this._state);
    };
    this._dereferenceAndCarry = (value) => {
      if (this._carry) {
        this._operand = this._operand + 256 & 65535;
      }
      return this._next(this._operand, this._state);
    };
    this._operand = 0;
    this._carry = false;
    this._result = new ResultImpl_default();
    this._state = state;
    this._indexExtractor = indexExtractor;
    this._next = next;
    this._writeOp = writeOp;
    freezeImmutables(this);
  }
  static absoluteX(state, next, writeOp) {
    return new _AbsoluteIndexed(state, (s) => s.x, next, writeOp);
  }
  static absoluteY(state, next, writeOp) {
    return new _AbsoluteIndexed(state, (s) => s.y, next, writeOp);
  }
};
__decorateClass([
  Immutable
], _AbsoluteIndexed.prototype, "reset", 2);
__decorateClass([
  Immutable
], _AbsoluteIndexed.prototype, "_fetchLo", 2);
__decorateClass([
  Immutable
], _AbsoluteIndexed.prototype, "_fetchHi", 2);
__decorateClass([
  Immutable
], _AbsoluteIndexed.prototype, "_dereferenceAndCarry", 2);
__decorateClass([
  Immutable
], _AbsoluteIndexed.prototype, "_result", 2);
__decorateClass([
  Immutable
], _AbsoluteIndexed.prototype, "_state", 2);
__decorateClass([
  Immutable
], _AbsoluteIndexed.prototype, "_indexExtractor", 2);
__decorateClass([
  Immutable
], _AbsoluteIndexed.prototype, "_next", 2);
__decorateClass([
  Immutable
], _AbsoluteIndexed.prototype, "_writeOp", 2);
__decorateClass([
  Immutable
], _AbsoluteIndexed, "absoluteX", 1);
__decorateClass([
  Immutable
], _AbsoluteIndexed, "absoluteY", 1);
var AbsoluteIndexed = _AbsoluteIndexed;
var absoluteX = (state, next, writeOp) => AbsoluteIndexed.absoluteX(state, next, writeOp);
var absoluteY = (state, next, writeOp) => AbsoluteIndexed.absoluteY(state, next, writeOp);

// src/machine/cpu/statemachine/addressing/dereference.ts
var Dereference = class {
  constructor(state, next = () => null) {
    this.reset = (operand) => this._result.read(this._dereference, operand);
    this._dereference = (value) => this._next(value, this._state);
    this._result = new ResultImpl_default();
    this._next = next;
    this._state = state;
    freezeImmutables(this);
  }
};
__decorateClass([
  Immutable
], Dereference.prototype, "reset", 2);
__decorateClass([
  Immutable
], Dereference.prototype, "_dereference", 2);
__decorateClass([
  Immutable
], Dereference.prototype, "_result", 2);
__decorateClass([
  Immutable
], Dereference.prototype, "_state", 2);
__decorateClass([
  Immutable
], Dereference.prototype, "_next", 2);
var dereference = (state, next) => new Dereference(state, next);

// src/machine/cpu/statemachine/addressing/immediate.ts
var Immediate = class {
  constructor(state, next = () => null) {
    this.reset = () => this._result.read(this._fetchOperand, this._state.p);
    this._fetchOperand = (value) => {
      this._operand = value;
      this._state.p = this._state.p + 1 & 65535;
      return this._next(this._operand, this._state);
    };
    this._operand = 0;
    this._result = new ResultImpl_default();
    this._state = state;
    this._next = next;
    freezeImmutables(this);
  }
};
__decorateClass([
  Immutable
], Immediate.prototype, "reset", 2);
__decorateClass([
  Immutable
], Immediate.prototype, "_fetchOperand", 2);
__decorateClass([
  Immutable
], Immediate.prototype, "_result", 2);
__decorateClass([
  Immutable
], Immediate.prototype, "_state", 2);
__decorateClass([
  Immutable
], Immediate.prototype, "_next", 2);
var immediate = (state, next) => new Immediate(state, next);

// src/machine/cpu/statemachine/addressing/indexedIndirectX.ts
var IndexedIndirectX = class {
  constructor(state, next = () => null) {
    this.reset = () => this._result.read(this._fetchAddress, this._state.p);
    this._fetchAddress = (value) => {
      this._address = value;
      this._state.p = this._state.p + 1 & 65535;
      return this._result.read(this._addIndex, this._address);
    };
    this._addIndex = (value) => {
      this._address = this._address + this._state.x & 255;
      return this._result.read(this._fetchLo, this._address);
    };
    this._fetchLo = (value) => {
      this._operand = value;
      this._address = this._address + 1 & 255;
      return this._result.read(this._fetchHi, this._address);
    };
    this._fetchHi = (value) => {
      this._operand |= value << 8;
      return this._next(this._operand, this._state);
    };
    this._operand = 0;
    this._address = 0;
    this._result = new ResultImpl_default();
    this._state = state;
    this._next = next;
    freezeImmutables(this);
  }
};
__decorateClass([
  Immutable
], IndexedIndirectX.prototype, "reset", 2);
__decorateClass([
  Immutable
], IndexedIndirectX.prototype, "_fetchAddress", 2);
__decorateClass([
  Immutable
], IndexedIndirectX.prototype, "_addIndex", 2);
__decorateClass([
  Immutable
], IndexedIndirectX.prototype, "_fetchLo", 2);
__decorateClass([
  Immutable
], IndexedIndirectX.prototype, "_fetchHi", 2);
__decorateClass([
  Immutable
], IndexedIndirectX.prototype, "_result", 2);
__decorateClass([
  Immutable
], IndexedIndirectX.prototype, "_state", 2);
__decorateClass([
  Immutable
], IndexedIndirectX.prototype, "_next", 2);
var indexedIndirectX = (state, next) => new IndexedIndirectX(state, next);

// src/machine/cpu/statemachine/addressing/indirectIndexedY.ts
var IndexedIndirectY = class {
  constructor(state, next = () => null, writeOp) {
    this.reset = () => this._result.read(this._fetchAddress, this._state.p);
    this._fetchAddress = (value) => {
      this._address = value;
      this._state.p = this._state.p + 1 & 65535;
      return this._result.read(this._fetchLo, this._address);
    };
    this._fetchLo = (value) => {
      this._operand = value;
      this._address = this._address + 1 & 255;
      return this._result.read(this._fetchHi, this._address);
    };
    this._fetchHi = (value) => {
      this._operand |= value << 8;
      this._carry = (this._operand & 255) + this._state.y > 255;
      this._operand = this._operand & 65280 | this._operand + this._state.y & 255;
      return this._carry || this._writeOp ? this._result.read(this._dereferenceAndCarry, this._operand) : this._next(this._operand, this._state);
    };
    this._dereferenceAndCarry = (value) => {
      if (this._carry) {
        this._operand = this._operand + 256 & 65535;
      }
      return this._next(this._operand, this._state);
    };
    this._operand = 0;
    this._address = 0;
    this._carry = false;
    this._result = new ResultImpl_default();
    this._state = state;
    this._next = next;
    this._writeOp = writeOp;
    freezeImmutables(this);
  }
};
__decorateClass([
  Immutable
], IndexedIndirectY.prototype, "reset", 2);
__decorateClass([
  Immutable
], IndexedIndirectY.prototype, "_fetchAddress", 2);
__decorateClass([
  Immutable
], IndexedIndirectY.prototype, "_fetchLo", 2);
__decorateClass([
  Immutable
], IndexedIndirectY.prototype, "_fetchHi", 2);
__decorateClass([
  Immutable
], IndexedIndirectY.prototype, "_dereferenceAndCarry", 2);
__decorateClass([
  Immutable
], IndexedIndirectY.prototype, "_result", 2);
__decorateClass([
  Immutable
], IndexedIndirectY.prototype, "_state", 2);
__decorateClass([
  Immutable
], IndexedIndirectY.prototype, "_next", 2);
__decorateClass([
  Immutable
], IndexedIndirectY.prototype, "_writeOp", 2);
var indirectIndexedY = (state, next, writeOp) => new IndexedIndirectY(state, next, writeOp);

// src/machine/cpu/statemachine/addressing/zeroPage.ts
var ZeroPage = class {
  constructor(state, next = () => null) {
    this.reset = () => this._result.read(this._fetchAddress, this._state.p);
    this._fetchAddress = (value) => {
      this._operand = value;
      this._state.p = this._state.p + 1 & 65535;
      return this._next(this._operand, this._state);
    };
    this._operand = 0;
    this._result = new ResultImpl_default();
    this._state = state;
    this._next = next;
    freezeImmutables(this);
  }
};
__decorateClass([
  Immutable
], ZeroPage.prototype, "reset", 2);
__decorateClass([
  Immutable
], ZeroPage.prototype, "_fetchAddress", 2);
__decorateClass([
  Immutable
], ZeroPage.prototype, "_result", 2);
__decorateClass([
  Immutable
], ZeroPage.prototype, "_state", 2);
__decorateClass([
  Immutable
], ZeroPage.prototype, "_next", 2);
var zeroPage = (state, next) => new ZeroPage(state, next);

// src/machine/cpu/statemachine/addressing/zeroPageIndexed.ts
var _ZeroPageIndexed = class _ZeroPageIndexed {
  constructor(state, indexExtractor, next) {
    this.reset = () => this._result.read(this._fetchAddress, this._state.p);
    this._fetchAddress = (value) => {
      this._operand = value;
      this._state.p = this._state.p + 1 & 65535;
      return this._result.read(this._addIndex, this._operand);
    };
    this._addIndex = (value) => {
      this._operand = this._operand + this._indexExtractor(this._state) & 255;
      return this._next(this._operand, this._state);
    };
    this._operand = 0;
    this._result = new ResultImpl_default();
    this._state = state;
    this._indexExtractor = indexExtractor;
    this._next = next;
    freezeImmutables(this);
  }
  static zeroPageX(state, next = () => null) {
    return new _ZeroPageIndexed(state, (s) => s.x, next);
  }
  static zeroPageY(state, next = () => null) {
    return new _ZeroPageIndexed(state, (s) => s.y, next);
  }
};
__decorateClass([
  Immutable
], _ZeroPageIndexed.prototype, "reset", 2);
__decorateClass([
  Immutable
], _ZeroPageIndexed.prototype, "_fetchAddress", 2);
__decorateClass([
  Immutable
], _ZeroPageIndexed.prototype, "_addIndex", 2);
__decorateClass([
  Immutable
], _ZeroPageIndexed.prototype, "_result", 2);
__decorateClass([
  Immutable
], _ZeroPageIndexed.prototype, "_state", 2);
__decorateClass([
  Immutable
], _ZeroPageIndexed.prototype, "_next", 2);
__decorateClass([
  Immutable
], _ZeroPageIndexed.prototype, "_indexExtractor", 2);
var ZeroPageIndexed = _ZeroPageIndexed;
var zeroPageX = (state, next) => ZeroPageIndexed.zeroPageX(state, next);
var zeroPageY = (state, next) => ZeroPageIndexed.zeroPageY(state, next);

// src/machine/cpu/statemachine/instruction/branch.ts
var Branch = class {
  constructor(state, predicate) {
    this.reset = () => this._result.read(this._fetchTarget, this._state.p).poll(true);
    this._fetchTarget = (value) => {
      this._operand = value;
      this._state.p = this._state.p + 1 & 65535;
      return this._predicate(this._state.flags) ? this._result.read(this._firstDummyRead, this._state.p) : null;
    };
    this._firstDummyRead = (value) => {
      this._target = this._state.p + (this._operand & 128 ? this._operand - 256 : this._operand) & 65535;
      if ((this._target & 65280) === (this._state.p & 65280)) {
        this._state.p = this._target;
        return null;
      }
      return this._result.read(this._secondDummyRead, this._state.p & 65280 | this._target & 255).poll(true);
    };
    this._secondDummyRead = (value) => {
      this._state.p = this._target;
      return null;
    };
    this._target = 0;
    this._operand = 0;
    this._result = new ResultImpl_default();
    this._state = state;
    this._predicate = predicate;
    freezeImmutables(this);
  }
};
__decorateClass([
  Immutable
], Branch.prototype, "reset", 2);
__decorateClass([
  Immutable
], Branch.prototype, "_fetchTarget", 2);
__decorateClass([
  Immutable
], Branch.prototype, "_firstDummyRead", 2);
__decorateClass([
  Immutable
], Branch.prototype, "_secondDummyRead", 2);
__decorateClass([
  Immutable
], Branch.prototype, "_result", 2);
__decorateClass([
  Immutable
], Branch.prototype, "_state", 2);
__decorateClass([
  Immutable
], Branch.prototype, "_predicate", 2);
var branch = (state, predicate) => new Branch(state, predicate);

// src/machine/cpu/statemachine/instruction/jsr.ts
var Jsr = class {
  constructor(state) {
    this.reset = () => this._result.read(this._fetchPcl, this._state.p);
    this._fetchPcl = (value) => {
      this._addressLo = value;
      this._state.p = this._state.p + 1 & 65535;
      return this._result.read(this._dummyStackRead, 256 + this._state.s);
    };
    this._dummyStackRead = () => this._result.write(this._pushPch, 256 + this._state.s, this._state.p >>> 8);
    this._pushPch = () => {
      this._state.s = this._state.s - 1 & 255;
      return this._result.write(this._pushPcl, 256 + this._state.s, this._state.p & 255);
    };
    this._pushPcl = () => {
      this._state.s = this._state.s - 1 & 255;
      return this._result.read(this._fetchPch, this._state.p);
    };
    this._fetchPch = (value) => {
      this._state.p = this._addressLo | value << 8;
      return null;
    };
    this._addressLo = 0;
    this._result = new ResultImpl_default();
    this._state = state;
    freezeImmutables(this);
  }
};
__decorateClass([
  Immutable
], Jsr.prototype, "_fetchPcl", 2);
__decorateClass([
  Immutable
], Jsr.prototype, "_dummyStackRead", 2);
__decorateClass([
  Immutable
], Jsr.prototype, "_pushPch", 2);
__decorateClass([
  Immutable
], Jsr.prototype, "_pushPcl", 2);
__decorateClass([
  Immutable
], Jsr.prototype, "_fetchPch", 2);
__decorateClass([
  Immutable
], Jsr.prototype, "_result", 2);
__decorateClass([
  Immutable
], Jsr.prototype, "_state", 2);
var jsr = (state) => new Jsr(state);

// src/machine/cpu/statemachine/instruction/readModifyWrite.ts
var ReadModifyWrite = class {
  constructor(state, operation) {
    this.reset = (address) => {
      this._address = address;
      return this._result.read(this._read, address);
    };
    this._read = (value) => {
      this._operand = value;
      return this._result.write(this._dummyWrite, this._address, this._operand);
    };
    this._dummyWrite = (value) => this._result.write(this._write, this._address, this._operation(this._operand, this._state));
    this._write = () => null;
    this._result = new ResultImpl_default();
    this._state = state;
    this._operation = operation;
    freezeImmutables(this);
  }
};
__decorateClass([
  Immutable
], ReadModifyWrite.prototype, "reset", 2);
__decorateClass([
  Immutable
], ReadModifyWrite.prototype, "_read", 2);
__decorateClass([
  Immutable
], ReadModifyWrite.prototype, "_dummyWrite", 2);
__decorateClass([
  Immutable
], ReadModifyWrite.prototype, "_write", 2);
__decorateClass([
  Immutable
], ReadModifyWrite.prototype, "_result", 2);
__decorateClass([
  Immutable
], ReadModifyWrite.prototype, "_state", 2);
__decorateClass([
  Immutable
], ReadModifyWrite.prototype, "_operation", 2);
var readModifyWrite = (state, operation) => new ReadModifyWrite(state, operation);

// src/machine/cpu/statemachine/instruction/rts.ts
var Rts = class {
  constructor(state) {
    this.reset = () => this._result.read(this._dummyOperandRead, this._state.p);
    this._dummyOperandRead = () => this._result.read(this._dummyStackRead, 256 + this._state.s);
    this._dummyStackRead = () => {
      this._state.s = this._state.s + 1 & 255;
      return this._result.read(this._popPcl, 256 + this._state.s);
    };
    this._popPcl = (value) => {
      this._state.p = this._state.p & 65280 | value;
      this._state.s = this._state.s + 1 & 255;
      return this._result.read(this._popPch, 256 + this._state.s);
    };
    this._popPch = (value) => {
      this._state.p = this._state.p & 255 | value << 8;
      return this._result.read(this._incrementP, this._state.p);
    };
    this._incrementP = () => {
      this._state.p = this._state.p + 1 & 65535;
      return null;
    };
    this._result = new ResultImpl_default();
    this._state = state;
    freezeImmutables(this);
  }
};
__decorateClass([
  Immutable
], Rts.prototype, "reset", 2);
__decorateClass([
  Immutable
], Rts.prototype, "_dummyOperandRead", 2);
__decorateClass([
  Immutable
], Rts.prototype, "_dummyStackRead", 2);
__decorateClass([
  Immutable
], Rts.prototype, "_popPcl", 2);
__decorateClass([
  Immutable
], Rts.prototype, "_popPch", 2);
__decorateClass([
  Immutable
], Rts.prototype, "_incrementP", 2);
__decorateClass([
  Immutable
], Rts.prototype, "_result", 2);
__decorateClass([
  Immutable
], Rts.prototype, "_state", 2);
var rts = (state) => new Rts(state);

// src/machine/cpu/statemachine/instruction/nullaryOneCycle.ts
var NullaryOneCycle = class {
  constructor(state, operation) {
    this.reset = () => this._result.read(this._executeOperation, this._state.p).poll(true);
    this._executeOperation = () => {
      this._operation(this._state);
      return null;
    };
    this._result = new ResultImpl_default();
    this._state = state;
    this._operation = operation;
    freezeImmutables(this);
  }
};
__decorateClass([
  Immutable
], NullaryOneCycle.prototype, "reset", 2);
__decorateClass([
  Immutable
], NullaryOneCycle.prototype, "_executeOperation", 2);
__decorateClass([
  Immutable
], NullaryOneCycle.prototype, "_result", 2);
__decorateClass([
  Immutable
], NullaryOneCycle.prototype, "_state", 2);
__decorateClass([
  Immutable
], NullaryOneCycle.prototype, "_operation", 2);
var nullaryOneCycle = (state, operation) => new NullaryOneCycle(state, operation);

// src/machine/cpu/statemachine/instruction/pull.ts
var Pull = class {
  constructor(state, operation) {
    this.reset = () => this._result.read(this._dummyRead, this._state.p).poll(true);
    this._dummyRead = () => this._result.read(this._incrementS, 256 + this._state.s);
    this._incrementS = () => {
      this._state.s = this._state.s + 1 & 255;
      return this._result.read(this._pull, 256 + this._state.s);
    };
    this._pull = (value) => (this._operation(this._state, value), null);
    this._result = new ResultImpl_default();
    this._state = state;
    this._operation = operation;
    freezeImmutables(this);
  }
};
__decorateClass([
  Immutable
], Pull.prototype, "reset", 2);
__decorateClass([
  Immutable
], Pull.prototype, "_dummyRead", 2);
__decorateClass([
  Immutable
], Pull.prototype, "_incrementS", 2);
__decorateClass([
  Immutable
], Pull.prototype, "_pull", 2);
__decorateClass([
  Immutable
], Pull.prototype, "_result", 2);
__decorateClass([
  Immutable
], Pull.prototype, "_state", 2);
__decorateClass([
  Immutable
], Pull.prototype, "_operation", 2);
var pull = (state, operation) => new Pull(state, operation);

// src/machine/cpu/statemachine/instruction/push.ts
var Push = class {
  constructor(state, operation) {
    this.reset = () => this._result.read(this._dummyRead, this._state.p);
    this._dummyRead = () => this._result.write(this._push, 256 + this._state.s, this._operation(this._state));
    this._push = () => {
      this._state.s = this._state.s - 1 & 255;
      return null;
    };
    this._result = new ResultImpl_default();
    this._state = state;
    this._operation = operation;
    freezeImmutables(this);
  }
};
__decorateClass([
  Immutable
], Push.prototype, "reset", 2);
__decorateClass([
  Immutable
], Push.prototype, "_dummyRead", 2);
__decorateClass([
  Immutable
], Push.prototype, "_push", 2);
__decorateClass([
  Immutable
], Push.prototype, "_result", 2);
__decorateClass([
  Immutable
], Push.prototype, "_state", 2);
__decorateClass([
  Immutable
], Push.prototype, "_operation", 2);
var push = (state, operation) => new Push(state, operation);

// src/machine/cpu/statemachine/instruction/rti.ts
var Rti = class {
  constructor(state) {
    this.reset = () => this._result.read(this._dummyOperandRead, this._state.p);
    this._dummyOperandRead = () => this._result.read(this._dummyStackRead, 256 + this._state.s);
    this._dummyStackRead = () => {
      this._state.s = this._state.s + 1 & 255;
      return this._result.read(this._popP, 256 + this._state.s);
    };
    this._popP = (value) => {
      this._state.flags = (value | CpuInterface.Flags.e) & ~CpuInterface.Flags.b;
      this._state.s = this._state.s + 1 & 255;
      return this._result.read(this._popPcl, 256 + this._state.s);
    };
    this._popPcl = (value) => {
      this._state.p = this._state.p & 65280 | value;
      this._state.s = this._state.s + 1 & 255;
      return this._result.read(this._popPch, 256 + this._state.s);
    };
    this._popPch = (value) => {
      this._state.p = this._state.p & 255 | value << 8;
      return null;
    };
    this._result = new ResultImpl_default();
    this._state = state;
    freezeImmutables(this);
  }
};
__decorateClass([
  Immutable
], Rti.prototype, "reset", 2);
__decorateClass([
  Immutable
], Rti.prototype, "_dummyOperandRead", 2);
__decorateClass([
  Immutable
], Rti.prototype, "_dummyStackRead", 2);
__decorateClass([
  Immutable
], Rti.prototype, "_popP", 2);
__decorateClass([
  Immutable
], Rti.prototype, "_popPcl", 2);
__decorateClass([
  Immutable
], Rti.prototype, "_popPch", 2);
__decorateClass([
  Immutable
], Rti.prototype, "_result", 2);
__decorateClass([
  Immutable
], Rti.prototype, "_state", 2);
var rti = (state) => new Rti(state);

// src/machine/cpu/statemachine/instruction/write.ts
var Write = class {
  constructor(state, operation) {
    this.reset = (operand) => this._result.write(() => null, operand, this._operation(this._state));
    this._result = new ResultImpl_default();
    this._state = state;
    this._operation = operation;
    freezeImmutables(this);
  }
};
__decorateClass([
  Immutable
], Write.prototype, "reset", 2);
__decorateClass([
  Immutable
], Write.prototype, "_result", 2);
__decorateClass([
  Immutable
], Write.prototype, "_state", 2);
__decorateClass([
  Immutable
], Write.prototype, "_operation", 2);
var write = (state, operation) => new Write(state, operation);

// src/machine/cpu/statemachine/ops.ts
function setFlagsNZ(operand, state) {
  state.flags = state.flags & ~(CpuInterface.Flags.n | CpuInterface.Flags.z) | operand & 128 | (operand ? 0 : CpuInterface.Flags.z);
}
function genRmw(operand, state, operation) {
  const result = operation(operand);
  setFlagsNZ(result, state);
  return result;
}
function genNullary(state, operation) {
  setFlagsNZ(operation(state), state);
}
function genUnary(operand, state, operation) {
  setFlagsNZ(operation(operand, state), state);
  return null;
}
function adc(operand, state) {
  if (state.flags & CpuInterface.Flags.d) {
    const d0 = (operand & 15) + (state.a & 15) + (state.flags & CpuInterface.Flags.c), d1 = (operand >>> 4) + (state.a >>> 4) + (d0 > 9 ? 1 : 0);
    state.a = d0 % 10 | d1 % 10 << 4;
    state.flags = state.flags & ~(CpuInterface.Flags.n | CpuInterface.Flags.z | CpuInterface.Flags.c) | state.a & 128 | // negative
    (state.a ? 0 : CpuInterface.Flags.z) | // zero
    (d1 > 9 ? CpuInterface.Flags.c : 0);
  } else {
    const sum = state.a + operand + (state.flags & CpuInterface.Flags.c), result = sum & 255;
    state.flags = state.flags & ~(CpuInterface.Flags.n | CpuInterface.Flags.z | CpuInterface.Flags.c | CpuInterface.Flags.v) | result & 128 | // negative
    (result ? 0 : CpuInterface.Flags.z) | // zero
    sum >>> 8 | // carry
    (~(operand ^ state.a) & (result ^ operand) & 128) >>> 1;
    state.a = result;
  }
  return null;
}
function aslImmediate(state) {
  const old = state.a;
  state.a = state.a << 1 & 255;
  state.flags = state.flags & ~(CpuInterface.Flags.n | CpuInterface.Flags.z | CpuInterface.Flags.c) | state.a & 128 | (state.a ? 0 : CpuInterface.Flags.z) | old >>> 7;
}
function aslRmw(operand, state) {
  const result = operand << 1 & 255;
  state.flags = state.flags & ~(CpuInterface.Flags.n | CpuInterface.Flags.z | CpuInterface.Flags.c) | result & 128 | (result ? 0 : CpuInterface.Flags.z) | operand >>> 7;
  return result;
}
function bit(operand, state) {
  state.flags = state.flags & ~(CpuInterface.Flags.n | CpuInterface.Flags.v | CpuInterface.Flags.z) | operand & (CpuInterface.Flags.n | CpuInterface.Flags.v) | (operand & state.a ? 0 : CpuInterface.Flags.z);
  return null;
}
function cmp(operand, state, getRegister) {
  const diff = getRegister(state) + (~operand & 255) + 1;
  state.flags = state.flags & ~(CpuInterface.Flags.n | CpuInterface.Flags.z | CpuInterface.Flags.c) | diff & 128 | (diff & 255 ? 0 : CpuInterface.Flags.z) | diff >>> 8;
}
function sbc(operand, state) {
  if (state.flags & CpuInterface.Flags.d) {
    const d0 = (state.a & 15) - (operand & 15) - (~state.flags & CpuInterface.Flags.c), d1 = (state.a >>> 4) - (operand >>> 4) - (d0 < 0 ? 1 : 0);
    state.a = (d0 < 0 ? 10 + d0 : d0) | (d1 < 0 ? 10 + d1 : d1) << 4;
    state.flags = state.flags & ~(CpuInterface.Flags.n | CpuInterface.Flags.z | CpuInterface.Flags.c) | state.a & 128 | // negative
    (state.a ? 0 : CpuInterface.Flags.z) | // zero
    (d1 < 0 ? 0 : CpuInterface.Flags.c);
  } else {
    operand = ~operand & 255;
    const sum = state.a + operand + (state.flags & CpuInterface.Flags.c), result = sum & 255;
    state.flags = state.flags & ~(CpuInterface.Flags.n | CpuInterface.Flags.z | CpuInterface.Flags.c | CpuInterface.Flags.v) | result & 128 | // negative
    (result ? 0 : CpuInterface.Flags.z) | // zero
    sum >>> 8 | // carry / borrow
    (~(operand ^ state.a) & (result ^ operand) & 128) >>> 1;
    state.a = result;
  }
  return null;
}
function lsrImmediate(state) {
  const old = state.a;
  state.a = state.a >>> 1;
  state.flags = state.flags & ~(CpuInterface.Flags.n | CpuInterface.Flags.z | CpuInterface.Flags.c) | state.a & 128 | (state.a ? 0 : CpuInterface.Flags.z) | old & CpuInterface.Flags.c;
}
function lsrRmw(operand, state) {
  const result = operand >>> 1;
  state.flags = state.flags & ~(CpuInterface.Flags.n | CpuInterface.Flags.z | CpuInterface.Flags.c) | result & 128 | (result ? 0 : CpuInterface.Flags.z) | operand & CpuInterface.Flags.c;
  return result;
}
function rolImmediate(state) {
  const old = state.a;
  state.a = state.a << 1 & 255 | state.flags & CpuInterface.Flags.c;
  state.flags = state.flags & ~(CpuInterface.Flags.n | CpuInterface.Flags.z | CpuInterface.Flags.c) | state.a & 128 | (state.a ? 0 : CpuInterface.Flags.z) | old >>> 7;
}
function rolRmw(operand, state) {
  const result = operand << 1 & 255 | state.flags & CpuInterface.Flags.c;
  state.flags = state.flags & ~(CpuInterface.Flags.n | CpuInterface.Flags.z | CpuInterface.Flags.c) | result & 128 | (result ? 0 : CpuInterface.Flags.z) | operand >>> 7;
  return result;
}
function rorImmediate(state) {
  const old = state.a;
  state.a = state.a >>> 1 | (state.flags & CpuInterface.Flags.c) << 7;
  state.flags = state.flags & ~(CpuInterface.Flags.n | CpuInterface.Flags.z | CpuInterface.Flags.c) | state.a & 128 | (state.a ? 0 : CpuInterface.Flags.z) | old & CpuInterface.Flags.c;
}
function rorRmw(operand, state) {
  const result = operand >>> 1 | (state.flags & CpuInterface.Flags.c) << 7;
  state.flags = state.flags & ~(CpuInterface.Flags.n | CpuInterface.Flags.z | CpuInterface.Flags.c) | result & 128 | (result ? 0 : CpuInterface.Flags.z) | operand & CpuInterface.Flags.c;
  return result;
}
function arr(operand, state) {
  state.a = (state.a & operand) >>> 1 | (state.flags & CpuInterface.Flags.c ? 128 : 0);
  state.flags = state.flags & ~(CpuInterface.Flags.c | CpuInterface.Flags.n | CpuInterface.Flags.z | CpuInterface.Flags.v) | (state.a & 64) >>> 6 | (state.a ? 0 : CpuInterface.Flags.z) | state.a & 128 | state.a & 64 ^ (state.a & 32) << 1;
}
function alr(operand, state) {
  const i = state.a & operand;
  state.a = i >>> 1;
  state.flags = state.flags & ~(CpuInterface.Flags.n | CpuInterface.Flags.z | CpuInterface.Flags.c) | state.a & 128 | (state.a ? 0 : CpuInterface.Flags.z) | i & CpuInterface.Flags.c;
  return null;
}
function dcp(operand, state) {
  const result = operand + 255 & 255;
  const diff = state.a + (~result & 255) + 1;
  state.flags = state.flags & ~(CpuInterface.Flags.n | CpuInterface.Flags.z | CpuInterface.Flags.c) | diff & 128 | (diff & 255 ? 0 : CpuInterface.Flags.z) | diff >>> 8;
  return result;
}
function axs(operand, state) {
  const value = (state.a & state.x) + (~operand & 255) + 1;
  state.x = value & 255;
  state.flags = state.flags & ~(CpuInterface.Flags.n | CpuInterface.Flags.z | CpuInterface.Flags.c) | state.x & 128 | (state.x & 255 ? 0 : CpuInterface.Flags.z) | value >>> 8;
  return null;
}
function rra(operand, state) {
  const result = operand >>> 1 | (state.flags & CpuInterface.Flags.c) << 7;
  state.flags = state.flags & ~CpuInterface.Flags.c | operand & CpuInterface.Flags.c;
  adc(result, state);
  return result;
}
function rla(operand, state) {
  const result = operand << 1 & 255 | state.flags & CpuInterface.Flags.c;
  state.flags = state.flags & ~CpuInterface.Flags.c | operand >>> 7;
  setFlagsNZ(state.a &= result, state);
  return result;
}
function slo(operand, state) {
  state.flags = state.flags & ~CpuInterface.Flags.c | operand >>> 7;
  const result = operand << 1 & 255;
  state.a = state.a | result;
  setFlagsNZ(state.a, state);
  return result;
}
function aax(state) {
  const result = state.a & state.x;
  setFlagsNZ(result, state);
  return result;
}
function isc(operand, state) {
  const result = operand + 1 & 255;
  sbc(result, state);
  return result;
}
function aac(operand, state) {
  state.a &= operand;
  setFlagsNZ(state.a, state);
  state.flags = state.flags & ~CpuInterface.Flags.c | (state.a & 128) >>> 7;
  return null;
}

// src/machine/cpu/statemachine/addressing/indirect.ts
var Indirect = class {
  constructor(state, next = () => null) {
    this.reset = () => this._result.read(this._fetchAddressLo, this._state.p);
    this._fetchAddressLo = (value) => {
      this._address = value;
      this._state.p = this._state.p + 1 & 65535;
      return this._result.read(this._fetchAddressHi, this._state.p);
    };
    this._fetchAddressHi = (value) => {
      this._address |= value << 8;
      this._state.p = this._state.p + 1 & 65535;
      return this._result.read(this._fetchLo, this._address);
    };
    this._fetchLo = (value) => {
      this._operand = value;
      if ((this._address & 255) === 255) {
        this._address &= 65280;
      } else {
        this._address = this._address + 1 & 65535;
      }
      return this._result.read(this._fetchHi, this._address);
    };
    this._fetchHi = (value) => {
      this._operand |= value << 8;
      return this._next(this._operand, this._state);
    };
    this._operand = 0;
    this._address = 0;
    this._result = new ResultImpl_default();
    this._state = state;
    this._next = next;
    freezeImmutables(this);
  }
};
__decorateClass([
  Immutable
], Indirect.prototype, "reset", 2);
__decorateClass([
  Immutable
], Indirect.prototype, "_fetchAddressLo", 2);
__decorateClass([
  Immutable
], Indirect.prototype, "_fetchAddressHi", 2);
__decorateClass([
  Immutable
], Indirect.prototype, "_fetchLo", 2);
__decorateClass([
  Immutable
], Indirect.prototype, "_fetchHi", 2);
__decorateClass([
  Immutable
], Indirect.prototype, "_result", 2);
__decorateClass([
  Immutable
], Indirect.prototype, "_state", 2);
__decorateClass([
  Immutable
], Indirect.prototype, "_next", 2);
var indirect = (state, next) => new Indirect(state, next);

// src/machine/cpu/statemachine/Compiler.ts
var Compiler = class {
  constructor(_state) {
    this._state = _state;
  }
  compile(op) {
    const instruction = Instruction.opcodes[op];
    switch (instruction.operation) {
      case Instruction.Operation.adc:
        return this._createAddressing(instruction.addressingMode, adc, {
          deref: true
        });
      case Instruction.Operation.and:
        return this._createAddressing(
          instruction.addressingMode,
          (o, s) => genUnary(o, s, (operand, state) => state.a = state.a & operand),
          {
            deref: true
          }
        );
      case Instruction.Operation.asl:
        return instruction.addressingMode === Instruction.AddressingMode.implied ? nullaryOneCycle(this._state, aslImmediate) : this._createAddressing(
          instruction.addressingMode,
          readModifyWrite(this._state, aslRmw).reset,
          { writeOp: true }
        );
      case Instruction.Operation.bit:
        return this._createAddressing(instruction.addressingMode, bit, {
          deref: true
        });
      case Instruction.Operation.brk:
        return brk(this._state);
      case Instruction.Operation.cmp:
        return this._createAddressing(
          instruction.addressingMode,
          (o, s) => (cmp(o, s, (state) => state.a), null),
          {
            deref: true
          }
        );
      case Instruction.Operation.cpx:
        return this._createAddressing(
          instruction.addressingMode,
          (o, s) => (cmp(o, s, (state) => state.x), null),
          {
            deref: true
          }
        );
      case Instruction.Operation.cpy:
        return this._createAddressing(
          instruction.addressingMode,
          (o, s) => (cmp(o, s, (state) => state.y), null),
          {
            deref: true
          }
        );
      case Instruction.Operation.dec:
        return this._createAddressing(
          instruction.addressingMode,
          readModifyWrite(this._state, (s, o) => genRmw(s, o, (x) => x - 1 & 255)).reset,
          {
            writeOp: true
          }
        );
      case Instruction.Operation.dex:
        return nullaryOneCycle(this._state, (s) => genNullary(s, (state) => state.x = state.x - 1 & 255));
      case Instruction.Operation.dey:
        return nullaryOneCycle(this._state, (s) => genNullary(s, (state) => state.y = state.y - 1 & 255));
      case Instruction.Operation.inc:
        return this._createAddressing(
          instruction.addressingMode,
          readModifyWrite(this._state, (s, o) => genRmw(s, o, (x) => x + 1 & 255)).reset,
          {
            writeOp: true
          }
        );
      case Instruction.Operation.inx:
        return nullaryOneCycle(this._state, (s) => genNullary(s, (state) => state.x = state.x + 1 & 255));
      case Instruction.Operation.iny:
        return nullaryOneCycle(this._state, (s) => genNullary(s, (state) => state.y = state.y + 1 & 255));
      case Instruction.Operation.eor:
        return this._createAddressing(
          instruction.addressingMode,
          (o, s) => genUnary(o, s, (operand, state) => state.a = state.a ^ operand),
          {
            deref: true
          }
        );
      case Instruction.Operation.jmp:
        return this._createAddressing(instruction.addressingMode, (o, s) => (s.p = o, null));
      case Instruction.Operation.jsr:
        return jsr(this._state);
      case Instruction.Operation.lda:
        return this._createAddressing(
          instruction.addressingMode,
          (o, s) => genUnary(o, s, (operand, state) => state.a = operand),
          {
            deref: true
          }
        );
      case Instruction.Operation.ldx:
        return this._createAddressing(
          instruction.addressingMode,
          (o, s) => genUnary(o, s, (operand, state) => state.x = operand),
          {
            deref: true
          }
        );
      case Instruction.Operation.ldy:
        return this._createAddressing(
          instruction.addressingMode,
          (o, s) => genUnary(o, s, (operand, state) => state.y = operand),
          {
            deref: true
          }
        );
      case Instruction.Operation.lsr:
        return instruction.addressingMode === Instruction.AddressingMode.implied ? nullaryOneCycle(this._state, lsrImmediate) : this._createAddressing(
          instruction.addressingMode,
          readModifyWrite(this._state, lsrRmw).reset,
          { writeOp: true }
        );
      case Instruction.Operation.nop:
        return nullaryOneCycle(this._state, () => void 0);
      case Instruction.Operation.ora:
        return this._createAddressing(
          instruction.addressingMode,
          (o, s) => genUnary(o, s, (operand, state) => state.a |= operand),
          { deref: true }
        );
      case Instruction.Operation.pha:
        return push(this._state, (s) => s.a);
      case Instruction.Operation.php:
        return push(this._state, (s) => s.flags | CpuInterface.Flags.b);
      case Instruction.Operation.pla:
        return pull(this._state, (s, o) => genNullary(s, (state) => state.a = o));
      case Instruction.Operation.plp:
        return pull(this._state, (s, o) => s.flags = (o | CpuInterface.Flags.e) & ~CpuInterface.Flags.b);
      case Instruction.Operation.rol:
        return instruction.addressingMode === Instruction.AddressingMode.implied ? nullaryOneCycle(this._state, rolImmediate) : this._createAddressing(
          instruction.addressingMode,
          readModifyWrite(this._state, rolRmw).reset,
          { writeOp: true }
        );
      case Instruction.Operation.ror:
        return instruction.addressingMode === Instruction.AddressingMode.implied ? nullaryOneCycle(this._state, rorImmediate) : this._createAddressing(
          instruction.addressingMode,
          readModifyWrite(this._state, rorRmw).reset,
          { writeOp: true }
        );
      case Instruction.Operation.rti:
        return rti(this._state);
      case Instruction.Operation.rts:
        return rts(this._state);
      case Instruction.Operation.sbc:
        return this._createAddressing(instruction.addressingMode, sbc, {
          deref: true
        });
      case Instruction.Operation.stx:
        return this._createAddressing(instruction.addressingMode, write(this._state, (s) => s.x).reset, {
          writeOp: true
        });
      case Instruction.Operation.sty:
        return this._createAddressing(instruction.addressingMode, write(this._state, (s) => s.y).reset, {
          writeOp: true
        });
      case Instruction.Operation.tax:
        return nullaryOneCycle(this._state, (s) => genNullary(s, (state) => state.x = state.a));
      case Instruction.Operation.tay:
        return nullaryOneCycle(this._state, (s) => genNullary(s, (state) => state.y = state.a));
      case Instruction.Operation.tsx:
        return nullaryOneCycle(this._state, (s) => genNullary(s, (state) => state.x = state.s));
      case Instruction.Operation.txa:
        return nullaryOneCycle(this._state, (s) => genNullary(s, (state) => state.a = state.x));
      case Instruction.Operation.txs:
        return nullaryOneCycle(this._state, (s) => s.s = s.x);
      case Instruction.Operation.tya:
        return nullaryOneCycle(this._state, (s) => genNullary(s, (state) => state.a = state.y));
      // Bramches
      case Instruction.Operation.bcc:
        return branch(this._state, (flags) => (flags & CpuInterface.Flags.c) === 0);
      case Instruction.Operation.bcs:
        return branch(this._state, (flags) => (flags & CpuInterface.Flags.c) > 0);
      case Instruction.Operation.bne:
        return branch(this._state, (flags) => (flags & CpuInterface.Flags.z) === 0);
      case Instruction.Operation.beq:
        return branch(this._state, (flags) => (flags & CpuInterface.Flags.z) > 0);
      case Instruction.Operation.bpl:
        return branch(this._state, (flags) => (flags & CpuInterface.Flags.n) === 0);
      case Instruction.Operation.bmi:
        return branch(this._state, (flags) => (flags & CpuInterface.Flags.n) > 0);
      case Instruction.Operation.bvc:
        return branch(this._state, (flags) => (flags & CpuInterface.Flags.v) === 0);
      case Instruction.Operation.bvs:
        return branch(this._state, (flags) => (flags & CpuInterface.Flags.v) > 0);
      // Flags
      case Instruction.Operation.sec:
        return nullaryOneCycle(this._state, (s) => s.flags |= CpuInterface.Flags.c);
      case Instruction.Operation.sed:
        return nullaryOneCycle(this._state, (s) => s.flags |= CpuInterface.Flags.d);
      case Instruction.Operation.sei:
        return nullaryOneCycle(this._state, (s) => s.flags |= CpuInterface.Flags.i);
      case Instruction.Operation.sta:
        return this._createAddressing(instruction.addressingMode, write(this._state, (s) => s.a).reset, {
          writeOp: true
        });
      case Instruction.Operation.clc:
        return nullaryOneCycle(this._state, (s) => s.flags &= ~CpuInterface.Flags.c);
      case Instruction.Operation.cld:
        return nullaryOneCycle(this._state, (s) => s.flags &= ~CpuInterface.Flags.d);
      case Instruction.Operation.cli:
        return nullaryOneCycle(this._state, (s) => s.flags &= ~CpuInterface.Flags.i);
      case Instruction.Operation.clv:
        return nullaryOneCycle(this._state, (s) => s.flags &= ~CpuInterface.Flags.v);
      // Undocumented opcodes
      case Instruction.Operation.dop:
      case Instruction.Operation.top:
        return this._createAddressing(instruction.addressingMode, () => null, { deref: true });
      case Instruction.Operation.aac:
        return this._createAddressing(instruction.addressingMode, aac);
      case Instruction.Operation.aax:
        return this._createAddressing(instruction.addressingMode, write(this._state, aax).reset, {
          writeOp: true
        });
      case Instruction.Operation.alr:
        return this._createAddressing(instruction.addressingMode, alr, {
          deref: true
        });
      case Instruction.Operation.arr:
        return this._createAddressing(instruction.addressingMode, (o, s) => (arr(o, s), null), {
          deref: true
        });
      case Instruction.Operation.axs:
        return this._createAddressing(instruction.addressingMode, axs, {
          deref: true
        });
      case Instruction.Operation.atx:
        return this._createAddressing(
          instruction.addressingMode,
          (o, s) => genUnary(o, s, (operand, state) => state.x = state.a = state.a & operand),
          {
            deref: true
          }
        );
      case Instruction.Operation.dcp:
        return this._createAddressing(instruction.addressingMode, readModifyWrite(this._state, dcp).reset, {
          writeOp: true
        });
      case Instruction.Operation.isc:
        return this._createAddressing(instruction.addressingMode, readModifyWrite(this._state, isc).reset, {
          writeOp: true
        });
      case Instruction.Operation.lax:
        return this._createAddressing(
          instruction.addressingMode,
          (o, s) => genUnary(o, s, (operand, state) => state.a = state.x = operand),
          {
            deref: true
          }
        );
      case Instruction.Operation.lar:
        return this._createAddressing(
          instruction.addressingMode,
          (o, s) => genUnary(o, s, (operand, state) => state.s = state.x = state.a = state.s & operand),
          { deref: true }
        );
      case Instruction.Operation.rla:
        return this._createAddressing(instruction.addressingMode, readModifyWrite(this._state, rla).reset, {
          writeOp: true
        });
      case Instruction.Operation.rra:
        return this._createAddressing(instruction.addressingMode, readModifyWrite(this._state, rra).reset, {
          writeOp: true
        });
      case Instruction.Operation.slo:
        return this._createAddressing(instruction.addressingMode, readModifyWrite(this._state, slo).reset, {
          writeOp: true
        });
      default:
        return null;
    }
  }
  _createAddressing(addressingMode, next, { deref = false, writeOp = false } = {}) {
    if (deref && addressingMode !== Instruction.AddressingMode.immediate) {
      next = dereference(this._state, next).reset;
    }
    switch (addressingMode) {
      case Instruction.AddressingMode.immediate:
        return immediate(this._state, next);
      case Instruction.AddressingMode.zeroPage:
        return zeroPage(this._state, next);
      case Instruction.AddressingMode.absolute:
        return absolute(this._state, next);
      case Instruction.AddressingMode.zeroPageX:
        return zeroPageX(this._state, next);
      case Instruction.AddressingMode.zeroPageY:
        return zeroPageY(this._state, next);
      case Instruction.AddressingMode.absoluteX:
        return absoluteX(this._state, next, writeOp);
      case Instruction.AddressingMode.absoluteY:
        return absoluteY(this._state, next, writeOp);
      case Instruction.AddressingMode.indexedIndirectX:
        return indexedIndirectX(this._state, next);
      case Instruction.AddressingMode.indirectIndexedY:
        return indirectIndexedY(this._state, next, writeOp);
      case Instruction.AddressingMode.indirect:
        return indirect(this._state, next);
      default:
        throw new Error(`invalid addressing mode ${addressingMode}`);
    }
  }
};
var Compiler_default = Compiler;

// src/machine/cpu/StateMachineCpu.ts
var StateMachineCpu = class {
  constructor(_bus, _rng) {
    this._bus = _bus;
    this._rng = _rng;
    this.executionState = CpuInterface.ExecutionState.boot;
    this.state = new CpuInterface.State();
    this._invalidInstructionCallback = null;
    this._interruptPending = false;
    this._nmiPending = false;
    this._halt = false;
    this._pollInterruptsAfterLastInstruction = false;
    this._lastInstructionPointer = 0;
    this._operations = new Array(255);
    this._opBoot = boot(this.state);
    this._opIrq = irq(this.state);
    this._opNmi = nmi(this.state);
    const compiler = new Compiler_default(this.state);
    for (let op = 0; op < 256; op++) {
      this._operations[op] = compiler.compile(op);
    }
    this.reset();
  }
  reset() {
    this.state.a = this._rng ? this._rng.int(255) : 0;
    this.state.x = this._rng ? this._rng.int(255) : 0;
    this.state.y = this._rng ? this._rng.int(255) : 0;
    this.state.s = 253;
    this.state.p = this._rng ? this._rng.int(65535) : 0;
    this.state.flags = (this._rng ? this._rng.int(255) : 0) | CpuInterface.Flags.i | CpuInterface.Flags.e | CpuInterface.Flags.b;
    this.state.irq = false;
    this.state.nmi = false;
    this.executionState = CpuInterface.ExecutionState.boot;
    this._interruptPending = false;
    this._nmiPending = false;
    this._halt = false;
    this._lastResult = this._opBoot.reset(void 0);
    this._lastInstructionPointer = 0;
    return this;
  }
  setInterrupt(i) {
    this._interruptPending = i;
    return this;
  }
  isInterrupt() {
    return this._interruptPending;
  }
  nmi() {
    this._nmiPending = true;
    return this;
  }
  halt() {
    this._halt = true;
    return this;
  }
  resume() {
    this._halt = false;
    return this;
  }
  isHalt() {
    return this._halt;
  }
  setInvalidInstructionCallback(callback) {
    this._invalidInstructionCallback = callback;
    return this;
  }
  getInvalidInstructionCallback() {
    return this._invalidInstructionCallback;
  }
  getLastInstructionPointer() {
    return this._lastInstructionPointer;
  }
  cycle() {
    if (this._halt && (!this._lastResult || this._lastResult.cycleType === StateMachineInterface_default.CycleType.read)) {
      return this;
    }
    if (this.executionState === CpuInterface.ExecutionState.fetch) {
      this._fetch();
      return this;
    }
    let value;
    switch (this._lastResult.cycleType) {
      case StateMachineInterface_default.CycleType.read:
        value = this._bus.read(this._lastResult.address);
        break;
      case StateMachineInterface_default.CycleType.write:
        value = this._lastResult.value;
        this._bus.write(this._lastResult.address, value);
        break;
      default:
        throw new Error("invalid cycle type");
    }
    if (this._lastResult.pollInterrupts) {
      this._pollInterrupts();
      this._lastResult.pollInterrupts = false;
      this._pollInterruptsAfterLastInstruction = false;
    }
    this._lastResult = this._lastResult.nextStep(value);
    if (this._lastResult === null) {
      this.executionState = CpuInterface.ExecutionState.fetch;
    }
    return this;
  }
  _fetch() {
    if (this._pollInterruptsAfterLastInstruction) {
      this._pollInterrupts();
    }
    this._lastInstructionPointer = this.state.p;
    let operation;
    const opcode = this._bus.read(this.state.p);
    if (this.state.nmi) {
      operation = this._opNmi;
      this._pollInterruptsAfterLastInstruction = false;
    } else if (this.state.irq) {
      operation = this._opIrq;
      this._pollInterruptsAfterLastInstruction = false;
    } else {
      operation = this._operations[opcode];
      this.state.p = this.state.p + 1 & 65535;
      this._pollInterruptsAfterLastInstruction = true;
    }
    if (!operation) {
      if (this._invalidInstructionCallback) {
        this._invalidInstructionCallback(this);
      }
      return;
    }
    this.executionState = CpuInterface.ExecutionState.execute;
    this._lastResult = operation.reset(void 0);
  }
  _pollInterrupts() {
    this.state.irq = false;
    if (this._nmiPending) {
      this.state.nmi = true;
      this._nmiPending = false;
      return;
    }
    if (this._interruptPending && !this.state.nmi && !(this.state.flags & CpuInterface.Flags.i)) {
      this.state.irq = true;
    }
  }
};
var StateMachineCpu_default = StateMachineCpu;

// entry.ts
var Flags = {
  c: 1,
  // carry
  z: 2,
  // zero
  i: 4,
  // interrupt disable
  d: 8,
  // decimal mode
  b: 16,
  // break
  e: 32,
  // reserved (expansion)
  v: 64,
  // overflow
  n: 128
  // sign / negative
};
var ExecutionState = {
  boot: 0,
  fetch: 1,
  execute: 2
};
export {
  ExecutionState,
  Flags,
  StateMachineCpu_default as StateMachineCpu
};
