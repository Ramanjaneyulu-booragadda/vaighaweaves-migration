"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ObservabilityPipelineHttpServerSource = void 0;
/**
 * The `http_server` source collects logs over HTTP POST from external services.
 *
 * **Supported pipeline types:** logs
 */
class ObservabilityPipelineHttpServerSource {
    constructor() { }
    /**
     * @ignore
     */
    static getAttributeTypeMap() {
        return ObservabilityPipelineHttpServerSource.attributeTypeMap;
    }
}
exports.ObservabilityPipelineHttpServerSource = ObservabilityPipelineHttpServerSource;
/**
 * @ignore
 */
ObservabilityPipelineHttpServerSource.attributeTypeMap = {
    authStrategy: {
        baseName: "auth_strategy",
        type: "ObservabilityPipelineHttpServerSourceAuthStrategy",
        required: true,
    },
    decoding: {
        baseName: "decoding",
        type: "ObservabilityPipelineDecoding",
        required: true,
    },
    id: {
        baseName: "id",
        type: "string",
        required: true,
    },
    tls: {
        baseName: "tls",
        type: "ObservabilityPipelineTls",
    },
    type: {
        baseName: "type",
        type: "ObservabilityPipelineHttpServerSourceType",
        required: true,
    },
    additionalProperties: {
        baseName: "additionalProperties",
        type: "{ [key: string]: any; }",
    },
};
//# sourceMappingURL=ObservabilityPipelineHttpServerSource.js.map