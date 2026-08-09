import { handleCalWebhook } from "../../../src/server/booking-webhook";
import { createPagesPostHandler } from "../../../src/server/pages-function";

export const onRequestPost = createPagesPostHandler(handleCalWebhook);
