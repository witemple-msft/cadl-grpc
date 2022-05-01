import {
  getServiceNamespaceString,
  Program,
  resolvePath,
} from "@cadl-lang/compiler";
import { writeProtoFile } from "./write.js";
import { cadlToProto } from "./transform.js";

/**
 * Options that the gRPC emitter accepts.
 */
interface GrpcEmitterOptions {
  /**
   * The directory where the emitter will write the Protobuf output tree.
   */
  outDir: string;
}

// Default options
const DEFAULT_GRPC_EMITTER_OPTIONS: GrpcEmitterOptions = {
  // TODO: shouldn't this be configured by default?
  outDir: "./cadl-output/",
};

/**
 * Create a worker function that converts the CADL program to Protobuf and writes it to the file system.
 */
export function createGrpcEmitter(
  program: Program
): (emitterOptions?: Partial<GrpcEmitterOptions>) => Promise<void> {
  return async function doEmit(emitterOptions) {
    const options = {
      ...DEFAULT_GRPC_EMITTER_OPTIONS,
      ...emitterOptions,
    };

    const outDir = resolvePath(options.outDir);

    // Convert the program to a set of proto files.
    const files = cadlToProto(program);

    if (!program.compilerOptions.noEmit && !program.hasError()) {
      for (const file of files) {
        // If the file has a package, emit it to a path that is shaped like the package name. Otherwise emit to
        // main.proto
        // TODO: What do we do if there are multiple files without packages, or multiple files with the same package?
        const packageSlug = file.package?.split(".") ?? ["main"];
        const filePath = resolvePath(outDir, ...packageSlug.slice(0, -1));

        await program.host.mkdirp(filePath);
        await program.host.writeFile(
          resolvePath(filePath, packageSlug.at(-1) + ".proto"),
          writeProtoFile(file)
        );
      }
    }
  };
}
