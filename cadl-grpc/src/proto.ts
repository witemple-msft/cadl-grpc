/**
 * This module describes an AST for Protobuf.
 */

/**
 * A single .proto file.
 */
export interface ProtoFile {
  /**
   * The package name, if one is known.
   */
  package?: string;
  /**
   * The `option` specifiers to include in the file.
   */
  options: Partial<DefaultFileOptions>;

  /**
   * The declarations in the file.
   *
   * Only `service` and `message` declarations may exist at the root of the file.
   */
  declarations: Array<ProtoServiceDeclaration | ProtoMessageDeclaration>;
}

/**
 * The built-in options that are defined by Protobuf.
 */
export interface DefaultFileOptions {
  java_package: string;
  java_outer_classname: string;

  optimize_for: "SPEED" | "CODE_SIZE" | "LITE_RUNTIME";

  cc_enable_arenas: boolean;
}

/**
 * A declaration. One of `service`, `message`, a field within a message, `one_of`, `enum`, or an `rpc` method.
 */
export type ProtoDeclaration =
  | ProtoServiceDeclaration
  | ProtoMessageDeclaration
  | ProtoFieldDeclaration
  | ProtoOneOfDeclaration
  | ProtoEnumDeclaration
  | ProtoMethodDeclaration;

/**
 * A Protobuf scalar type.
 */
export type ScalarName =
  | ScalarIntegralName
  | "double"
  | "float"
  | "bytes"
  | "string";

/**
 * A Protobuf integral type.
 */
export type ScalarIntegralName = ScalarIntegerName | ScalarFixedName | "bool";

/**
 * A Protobuf variable-length integer type.
 */
export type ScalarIntegerName = `${"u" | "s" | ""}int${"32" | "64"}`;

/**
 * A Protobuf fixed-length integer type.
 */
export type ScalarFixedName = `${"s" | ""}fixed${"32" | "64"}`;

// Symbols for type destructuring
export const $scalar = Symbol("$scalar");
export const $ref = Symbol("$ref");
export const $map = Symbol("$map");

/**
 * A map type. Map keys can be any integral or string type (any scalar except float, double, and bytes).
 *
 * The value may be any type other than another map.
 */
export type ProtoMap = [
  typeof $map,
  ScalarIntegralName | "string",
  ProtoRef | ProtoScalar
];

/**
 * A reference to a named message type.
 */
export type ProtoRef = [typeof $ref, string];

/**
 * A scalar type.
 */
export type ProtoScalar = [typeof $scalar, ScalarName];

/**
 * A Protobuf type.
 */
export type ProtoType = ProtoScalar | ProtoRef | ProtoMap;

/**
 * Create a scalar type by name.
 */
export function scalar(t: ScalarName): ProtoScalar {
  return [$scalar, t];
}

/**
 * Create a type reference (symbol) to a named message.
 */
export function ref(t: string): ProtoRef {
  return [$ref, t];
}

/**
 * Create a map from a key type to a value type.
 */
export function map(
  k: ScalarIntegralName | "string",
  v: Exclude<ProtoType, ProtoMap>
): ProtoMap {
  return [$map, k, v];
}

/**
 * A "pattern" object with variants for each Protobuf type.
 */
export interface ProtoTypeMatchPattern<T> {
  scalar: (s: ScalarName) => T;
  ref: (r: string) => T;
  map: (k: ScalarIntegralName | "string", v: Exclude<ProtoType, ProtoMap>) => T;
}

/**
 * A helper function that matches and delegates a Protobuf type to a handler per type.
 *
 * @param type - the Protobuf type to match and delegate
 * @param pat
 * @returns
 */
export function matchType<Result>(
  type: ProtoType,
  pat: ProtoTypeMatchPattern<Result>
): Result {
  switch (type[0]) {
    case $ref:
      return pat.ref(type[1]);
    case $scalar:
      return pat.scalar(type[1]);
    case $map:
      return pat.map(type[1], type[2] as Exclude<ProtoType, ProtoMap>);
    default:
      const __exhaust: never = type[0];
      throw new Error(`Unreachable: matchType variant ${__exhaust}`); // unreachable
  }
}

/**
 * A `service` declaration.
 */
export interface ProtoServiceDeclaration {
  kind: "service";
  name: string;
  operations: ProtoMethodDeclaration[];
}

/**
 * An `rfc` method declaration.
 */
export interface ProtoMethodDeclaration {
  kind: "method";
  name: string;
  input: ProtoRef;
  returns: ProtoRef;
}

/**
 * A `message` declaration.
 */
export interface ProtoMessageDeclaration {
  kind: "message";
  name: string;
  declarations: Array<
    ProtoFieldDeclaration | ProtoMessageDeclaration | ProtoOneOfDeclaration
  >;
  reservations?: Array<string | number | [number, number]>;
}

/**
 * A field declaration within a message.
 */
export interface ProtoFieldDeclaration {
  kind: "field";
  name: string;
  /**
   * Whether or not the field is repeated (i.e. an array).
   */
  repeated?: true;
  options?: Partial<DefaultFieldOptions>;
  type: ProtoType;
  index: number;
}

/**
 * The options for fields defined by the Protobuf specification.
 */
export interface DefaultFieldOptions {
  packed: true;
  deprecated: true;
}

/**
 * A `one_of` declaration.
 */
export interface ProtoOneOfDeclaration {
  kind: "oneof";
  name: string;
  declarations: [ProtoFieldDeclaration, ...ProtoFieldDeclaration[]];
}

/**
 * An `enum` declaration.
 *
 * TODO: this node type is currently disconnected from the proto AST. Can this
 * appear anywhere other than messages? Do we need to emit it _directly_ before
 * it's used?
 */
export interface ProtoEnumDeclaration {
  kind: "enum";
  name: string;
  allowAlias?: true;
  variants: [string, number][];
}
