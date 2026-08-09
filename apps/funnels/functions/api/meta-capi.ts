import { handleMetaCapi } from "../../src/server/meta-conversions";
import { createPagesPostHandler } from "../../src/server/pages-function";

export const onRequestPost = createPagesPostHandler(handleMetaCapi);
