import { createPagesPostHandler } from "../../../src/server/pages-function";
import { handleTwentySalesWebhook } from "../../../src/server/twenty-sales-webhook";

export const onRequestPost = createPagesPostHandler(handleTwentySalesWebhook);
