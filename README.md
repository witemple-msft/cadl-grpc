# @cadl-lang/grpc

`cadl-grpc` is a prototype emitter for [Microsoft CADL](https://github.com/Microsoft/cadl) that targets gRPC and Protobuf. Service descriptions written in CADL can be decorated with gRPC/Protobuf metadata and then compiled to a `.proto` file.

## Getting Started

**Requirements**: Node.js 14.0.0 or later and NPM.

To get started, run the following commands to install dependencies and compile the example Greeter service (`main.cadl`):

1. Enter the `cadl-grpc` subdirectory, install its dependencies, compile it, and then leave the directory.

```
$ cd cadl-grpc
$ npm install
$ npx tsc
$ cd ..
```

2. Install the dependencies of the host package.

```
$ npm install
```

3. Compile the CADL program:

```
$ npx cadl compile main.cadl --emit=cadl-grpc`
```

The result will be in `cadl-output/com/azure/greeter.proto`.

## Examples

See the `example/` directory for an implementation of a client and server for the Greeter service. Run the following commands in the directory:

1. Install dependencies.

```
$ npm install
```

2. Run the server.

```
$ node server.js
Server running at 127.0.0.1:50010
```

3. Run the example client driver program.

```
$ node client.js
```
