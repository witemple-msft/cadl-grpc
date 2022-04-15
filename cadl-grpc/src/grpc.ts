import {
  DecoratorContext,
  Program,
  SyntaxKind,
  Type,
  validateDecoratorParamType,
  validateDecoratorTarget,
} from "@cadl-lang/compiler";

import {
  fieldIndexKey,
  packageKey,
  reportDiagnostic,
  serviceKey,
} from "./lib.js";
import { createGrpcEmitter } from "./lower.js";

/**
 * # cadl-grpc : gRPC/Protobuf Emitter and Decorators for CADL
 *
 * This module defines an emitter and decorator library for CADL that enables specifying gRPC services and Protobuf
 * models.
 */

/**
 * The maximum field index allowed by Protocol Buffers.
 */
const MAX_FIELD_INDEX = 2 ** 29 - 1;

/**
 * The field range between 19000 and 19999 is reserved for Protobuf client implementations.
 */
const IMPLEMENTATION_RESERVED_RANGE = [19000, 19999] as const;

/**
 * Decorate a namespace as a package, indicating that it represents a single Protobuf unit (a single file with a
 * `package` declaration).
 *
 * @param param0 - decorator context
 * @param target - the decorated namespace
 * @param name - the package's name (not optional)
 */
export function $package(
  { program }: DecoratorContext,
  target: Type,
  name: string
) {
  if (
    !validateDecoratorTarget(program, target, "@package", "Namespace") ||
    !validateDecoratorParamType(program, target, name, "String")
  )
    return;

  program.stateMap(packageKey).set(target, name);
}

/**
 * Decorate an interface as a service, indicating that it represents a gRPC `service` declaration.
 *
 * @param param0 - decorator context
 * @param target - the decorated interface
 */
export function $service({ program }: DecoratorContext, target: Type) {
  if (!validateDecoratorTarget(program, target, "@service", "Interface")) {
    return;
  }

  // TODO: do we allow service interfaces to extend/compose other interfaces?

  for (const _operation of target.operations.values()) {
    // TODO: validate operations here, don't defer to $onEmit, so that we have a good editor experience.
  }

  program.stateSet(serviceKey).add(target);
}

/**
 * Decorate a model property with a field index. Field indices are required for all fields of emitted messages.
 *
 * @param param0
 * @param target
 * @param fieldIndex
 * @returns
 */
export function $field(
  { program }: DecoratorContext,
  target: Type,
  fieldIndex: number
) {
  if (
    !validateDecoratorTarget(program, target, "@field", "ModelProperty") ||
    !validateDecoratorParamType(program, target, fieldIndex, "Number")
  ) {
    return;
  }

  if (!Number.isInteger(fieldIndex) || fieldIndex <= 0) {
    reportDiagnostic(program, {
      code: "field-index",
      messageId: "invalid",
      format: {
        index: String(fieldIndex),
      },
      target,
    });
    return;
  } else if (fieldIndex > MAX_FIELD_INDEX) {
    reportDiagnostic(program, {
      code: "field-index",
      messageId: "out-of-bounds",
      format: {
        index: String(fieldIndex),
        max: String(MAX_FIELD_INDEX),
      },
      target,
    });
    return;
  } else if (
    fieldIndex >= IMPLEMENTATION_RESERVED_RANGE[0] &&
    fieldIndex <= IMPLEMENTATION_RESERVED_RANGE[1]
  ) {
    reportDiagnostic(program, {
      code: "field-index",
      messageId: "reserved",
      format: {
        index: String(fieldIndex),
      },
      target,
    });
  }

  // TODO: Attach the field indices to the parent _model_ so that we can track reservations, field overlaps, etc. in the
  // decorators and report them to LSP.
  const model = target.node.parent;
  if (model?.kind !== SyntaxKind.ModelStatement)
    throw new InternalError("model property parent is not a model");

  program.stateMap(fieldIndexKey).set(target, fieldIndex);
}

/**
 * Emitter main function.
 *
 * @param program - the program to emit
 */
export async function $onEmit(program: Program) {
  const emitter = createGrpcEmitter(program);

  await emitter(/* TODO: options? */);
}

/**
 * An error class representing an internal compiler error.
 */
class InternalError extends Error {
  constructor(...values: unknown[]) {
    super(
      `@cadl-lang/grpc: INTERNAL EMITTER ERROR - ${values
        .map(String)
        .join(" ")}`
    );
  }
}
