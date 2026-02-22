"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ObservabilityPipelineHttpClientSource = void 0;
/**
 * The `http_client` source scrapes logs from HTTP endpoints at regular intervals.
 *
 * **Supported pipeline types:** logs
 */
class ObservabilityPipelineHttpClientSource {
    constructor() { }
    /**
     * @ignore
     */
    static getAttributeTypeMap() {
        return ObservabilityPipelineHttpClientSource.attributeTypeMap;
    }
}
exports.ObservabilityPipelineHttpClientSource = ObservabilityPipelineHttpClientSource;
/**
 * @ignore
 */
ObservabilityPipelineHttpClientSource.attributeTypeMap = {
    authStrategy: {
        baseName: "auth_strategy",
        type: "ObservabilityPipelineHttpClientSourceAuthStrategy",
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
    scrapeIntervalSecs: {
        baseName: "scrape_interval_secs",
        type: "number",
        format: "int64",
    },
    scrapeTimeoutSecs: {
        baseName: "scrape_timeout_secs",
        type: "number",
        format: "int64",
    },
    tls: {
        baseName: "tls",
        type: "ObservabilityPipelineTls",
    },
    type: {
        baseName: "type",
        type: "ObservabilityPipelineHttpClientSourceType",
        required: true,
    },
    additionalProperties: {
        baseName: "additionalProperties",
        type: "{ [key: string]: any; }",
    },
};
//# sourceMappingURL=ObservabilityPipelineHttpClientSource.js.map