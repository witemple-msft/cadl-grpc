// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import loader from "@grpc/proto-loader";

const GREETER_PROTO = "../cadl-output/com/azure/greeter.proto";

export const greeterPackage = await loader.load(GREETER_PROTO);

export const SERVER_URL = "127.0.0.1:50010";
