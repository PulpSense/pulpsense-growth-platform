import { handleFunnelEvent } from "../../src/server/contact-submission";
import { createPagesPostHandler } from "../../src/server/pages-function";

export const onRequestPost = createPagesPostHandler(handleFunnelEvent);
