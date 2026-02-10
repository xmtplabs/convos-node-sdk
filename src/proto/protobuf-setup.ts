import protobuf from "protobufjs";
import Long from "long";

// Explicitly configure protobufjs with the Long library.
// protobufjs auto-detects Long via eval("require")("long"), which fails
// in Node.js ESM environments. This ensures sfixed64/int64 fields work.
protobuf.util.Long = Long;
protobuf.configure();

export { protobuf };
