import { handleVerifyEmail } from "../../src/server/email-verification";
import { createPagesPostHandler } from "../../src/server/pages-function";

export const onRequestPost = createPagesPostHandler(handleVerifyEmail);
