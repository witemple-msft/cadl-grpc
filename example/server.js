// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// A simple server that implements the Greeter service.

import grpc from "@grpc/grpc-js";
import { greeterPackage, SERVER_URL } from "./common.js";

const {
  com: {
    azure: {
      greeter: { Greeter },
    },
  },
} = grpc.loadPackageDefinition(greeterPackage);

const server = new grpc.Server();

server.addService(Greeter.service, {
  sayHello: ({ request }, callback) => {
    callback(null, { message: `Hello, ${request.name}!` });
  },
  sayHelloFrom: ({ request }, callback) => {
    callback(null, {
      message: `Hello, ${request.name}! From: ${request.from}.`,
    });
  },
});

server.bindAsync(SERVER_URL, grpc.ServerCredentials.createInsecure(), () => {
  console.log(`Server running at ${SERVER_URL}`);
  server.start();
});
