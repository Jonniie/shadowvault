import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Witnesses<PS> = {
}

export type ImpureCircuits<PS> = {
  initialize(context: __compactRuntime.CircuitContext<PS>,
             ownerSecret_0: Uint8Array,
             supply_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  fundUser(context: __compactRuntime.CircuitContext<PS>,
           ownerSecret_0: Uint8Array,
           recipient_0: { bytes: Uint8Array },
           amount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  deposit(context: __compactRuntime.CircuitContext<PS>, amount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  withdraw(context: __compactRuntime.CircuitContext<PS>,
           recipient_0: { bytes: Uint8Array },
           amount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
}

export type ProvableCircuits<PS> = {
  initialize(context: __compactRuntime.CircuitContext<PS>,
             ownerSecret_0: Uint8Array,
             supply_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  fundUser(context: __compactRuntime.CircuitContext<PS>,
           ownerSecret_0: Uint8Array,
           recipient_0: { bytes: Uint8Array },
           amount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  deposit(context: __compactRuntime.CircuitContext<PS>, amount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  withdraw(context: __compactRuntime.CircuitContext<PS>,
           recipient_0: { bytes: Uint8Array },
           amount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
}

export type PureCircuits = {
}

export type Circuits<PS> = {
  initialize(context: __compactRuntime.CircuitContext<PS>,
             ownerSecret_0: Uint8Array,
             supply_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  fundUser(context: __compactRuntime.CircuitContext<PS>,
           ownerSecret_0: Uint8Array,
           recipient_0: { bytes: Uint8Array },
           amount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  deposit(context: __compactRuntime.CircuitContext<PS>, amount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  withdraw(context: __compactRuntime.CircuitContext<PS>,
           recipient_0: { bytes: Uint8Array },
           amount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
}

export type Ledger = {
  readonly token_color: Uint8Array;
  readonly initialized: boolean;
  readonly owner: Uint8Array;
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>,
               ownerSecret_0: Uint8Array): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
