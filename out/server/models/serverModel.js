"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServerEventType = exports.ServerMode = void 0;
/**
 * Available server mode options
 */
var ServerMode;
(function (ServerMode) {
    ServerMode["HTTP"] = "HTTP";
    ServerMode["HTTPS_DEFAULT_CERTS"] = "HTTPS (default certificates)";
    ServerMode["HTTPS_CUSTOM_CERTS"] = "HTTPS (custom certificates)";
})(ServerMode || (exports.ServerMode = ServerMode = {}));
/**
 * Server event types for the event emitter
 */
var ServerEventType;
(function (ServerEventType) {
    ServerEventType["STARTED"] = "server-started";
    ServerEventType["STOPPED"] = "server-stopped";
    ServerEventType["UPDATED"] = "server-updated";
    ServerEventType["ERROR"] = "server-error";
})(ServerEventType || (exports.ServerEventType = ServerEventType = {}));
//# sourceMappingURL=serverModel.js.map