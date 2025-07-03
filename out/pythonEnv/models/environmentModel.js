"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PackageStatus = exports.PythonEnvironmentStatus = void 0;
/**
 * Status of the Python environment
 */
var PythonEnvironmentStatus;
(function (PythonEnvironmentStatus) {
    PythonEnvironmentStatus["NOT_FOUND"] = "not_found";
    PythonEnvironmentStatus["FOUND"] = "found";
    PythonEnvironmentStatus["CREATED"] = "created";
    PythonEnvironmentStatus["ERROR"] = "error";
})(PythonEnvironmentStatus || (exports.PythonEnvironmentStatus = PythonEnvironmentStatus = {}));
/**
 * Status of a package installation
 */
var PackageStatus;
(function (PackageStatus) {
    PackageStatus["NOT_INSTALLED"] = "not_installed";
    PackageStatus["INSTALLED"] = "installed";
    PackageStatus["INSTALLED_NOW"] = "installed_now";
    PackageStatus["ERROR"] = "error";
})(PackageStatus || (exports.PackageStatus = PackageStatus = {}));
//# sourceMappingURL=environmentModel.js.map