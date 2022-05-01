import {
  getIntrinsicModelName,
  InterfaceType,
  isIntrinsic,
  ModelType,
  ModelTypeProperty,
  NamespaceType,
  OperationType,
  Program,
  Type,
} from "@cadl-lang/compiler";
import {
  ProtoMethodDeclaration,
  ProtoFile,
  ProtoRef,
  ref,
  ProtoMessageDeclaration,
  ProtoFieldDeclaration,
  scalar,
  ProtoType,
  map,
  ScalarIntegralName,
  ProtoScalar,
} from "./proto.js";
import { serviceKey, fieldIndexKey, packageKey } from "./lib.js";
import { reportDiagnostic } from "./lib.js";

/**
 * Create a set of proto files that represent the CADL program.
 *
 * This is the meat of the emitter.
 */
export function cadlToProto(program: Program): ProtoFile[] {
  const packages = program.stateMap(packageKey) as Map<NamespaceType, string>;

  // Emit a file per package.
  return [...packages].map(
    ([namespace, packageName]) =>
      ({
        package: packageName,
        options: {},
        declarations: declarationsFromNamespace(namespace),
      } as ProtoFile)
  );

  /**
   * Recursively searches a namespace for declarations that should be reified as Protobuf.
   *
   * @param namespace - the namespace to analyze
   * @returns an array of declarations
   */
  function declarationsFromNamespace(
    namespace: NamespaceType
  ): ProtoFile["declarations"] {
    const serviceInterfaces = new Set<InterfaceType>();

    // This gadget adds all interfaces decorated with `service` that are reachable from `namespace`
    void (function recursiveAddInterfaces(namespace: NamespaceType) {
      for (const memberInterface of namespace.interfaces.values()) {
        if (program.stateSet(serviceKey).has(memberInterface)) {
          serviceInterfaces.add(memberInterface);
        }
      }

      for (const nested of namespace.namespaces.values()) {
        // !! We only want to recurse on namespaces that are not, themselves, packages.
        if (!packages.has(nested)) recursiveAddInterfaces(nested);
      }
    })(namespace);

    const declarations: ProtoFile["declarations"] = [];
    const visitedTypes = new Set<Type>();

    /**
     * Visits a model type, converting it into a message definition and adding it if it has not already been visited.
     * @param model - the model type to consider
     */
    function visitType(model: ModelType) {
      if (!visitedTypes.has(model)) {
        visitedTypes.add(model);
        declarations.push(toMessage(model));
      }
    }

    // Each interface will be reified as a `service` declaration.
    for (const iface of serviceInterfaces) {
      declarations.push({
        kind: "service",
        name: iface.name,
        // The service's methods are just projections of the interface operations.
        operations: [...iface.operations.values()].map(toMethodFromOperation),
      });
    }

    return declarations;

    /**
     * @param operation - the operation to convert
     * @returns a corresponding method declaration
     */
    function toMethodFromOperation(
      operation: OperationType
    ): ProtoMethodDeclaration {
      return {
        kind: "method",
        // TODO: I was capitalizing these. I could capitalize by default and allow overriding through a decorator.
        name: operation.name,
        input: addModelAsInput(operation.parameters),
        returns: addReturnType(operation.returnType),
      };
    }

    /**
     * Checks a parameter Model satisfies the constraints for a gRPC method input and adds it to the declarations,
     * returning a ProtoRef to the generated named message.
     *
     * @param model - the model to add
     * @returns a reference to the model's message
     */
    function addModelAsInput(model: ModelType): ProtoRef {
      const params = [...model.properties.values()];

      // !! TODO: Currently I'm just using the first parameter and ensuring there's only one, but really I'd like to
      // support `op foo(...Message): Response`, since that more closely approximates the gRPC limitations.
      if (params.length !== 1) {
        reportDiagnostic(program, {
          code: "unsupported-input-type",
          messageId: "wrong-number",
          target: model,
        });
        return ref("<unreachable>");
      }

      const [{ type: input }] = params;

      if (input.kind !== "Model") {
        reportDiagnostic(program, {
          code: "unsupported-input-type",
          messageId: "wrong-type",
          target: input,
        });
        return ref("<unreachable>");
      }

      // Visit the first parameter, converting it to a Message if it hasn't already been visited
      visitType(input);

      return ref(input.name);
    }

    /**
     * Checks that a return type is a Model and converts it to a message, adding it to the declarations and returning
     * a reference to its name.
     *
     * @param t - the model to add
     * @returns a reference to the model's message
     */
    function addReturnType(t: Type): ProtoRef {
      switch (t.kind) {
        case "Model":
          visitType(t);
          return ref(t.name);
        default:
          reportDiagnostic(program, {
            code: "unsupported-return-type",
            target: t,
          });
          return ref("<unreachable>");
      }
    }

    /**
     * Converts a CADL type to a Protobuf type, adding a corresponding message if necessary.
     * @param t - the type to add to the ProtoFile.
     * @returns a Protobuf type corresponding to the given type
     */
    function addType(t: Type): ProtoType {
      // We will handle all intrinsics separately, including maps.
      if (isIntrinsic(program, t))
        return intrinsicToProto(getIntrinsicModelName(program, t), t);

      switch (t.kind) {
        case "Model":
          visitType(t);
          return ref(t.name);
        default:
          reportDiagnostic(program, {
            code: "unsupported-field-type",
            messageId: "unconvertible",
            format: {
              type: t.kind,
            },
            target: t,
          });
          return ref("<unreachable>");
      }
    }

    function intrinsicToProto(name: string, t: Type): ProtoType {
      // Maps are considered intrinsics, so we check if the type is an instance of Cadl.Map
      if (
        t.kind === "Model" &&
        t.name === "Map" &&
        t.namespace?.name === "Cadl"
      ) {
        // Intrinsic map.
        const [keyType, valueType] = t.templateArguments ?? [];

        // This is a core compile error.
        if (!keyType || !valueType) return ref("<unreachable>");

        const keyProto = addType(keyType);

        // TODO: value type must not be another map, but we don't enforce this in the map factory function.
        return map(
          keyProto[1] as "string" | ScalarIntegralName,
          addType(valueType) as ProtoScalar | ProtoRef
        );
      }

      // TODO: there are way more scalars in proto than this? How do we expose those knobs to the API writer?
      const protoType = {
        bytes: scalar("bytes"),
        boolean: scalar("bool"),
        int32: scalar("int32"),
        int64: scalar("int64"),
        uint32: scalar("uint32"),
        uint64: scalar("uint64"),
        string: scalar("string"),
        float32: scalar("float"),
        float64: scalar("double"),
      }[name];

      if (!protoType) {
        reportDiagnostic(program, {
          code: "unsupported-field-type",
          messageId: "unknown-intrinsic",
          format: {
            name: name,
          },
          target: t,
        });
        return ref("<unreachable>");
      }

      return protoType;
    }

    /**
     * @param model - the Model to convert
     * @returns a corresponding message declaration
     */
    function toMessage(model: ModelType): ProtoMessageDeclaration {
      return {
        kind: "message",
        name: model.name,
        declarations: [...model.properties.values()].map(toField),
      };
    }

    /**
     * @param property - the ModelProperty to convert
     * @returns a corresponding field declaration
     */
    function toField(property: ModelTypeProperty): ProtoFieldDeclaration {
      // TODO: handle arrays with repeated fields.
      return {
        kind: "field",
        name: property.name,
        type: addType(property.type),
        index: program.stateMap(fieldIndexKey).get(property),
      };
    }
  }
}
