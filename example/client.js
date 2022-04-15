import grpc from "@grpc/grpc-js";
import { greeterPackage, SERVER_URL } from "./common.js";

const {
  com: {
    azure: {
      greeter: { Greeter },
    },
  },
} = grpc.loadPackageDefinition(greeterPackage);

const client = new Greeter(SERVER_URL, grpc.credentials.createInsecure());

client.sayHello({ name: "Will" }, (_, { message }) =>
  console.log("sayHello:", message)
);
client.sayHelloFrom({ name: "Will", from: "gRPC" }, (_, { message }) =>
  console.log("sayHelloFrom:", message)
);
