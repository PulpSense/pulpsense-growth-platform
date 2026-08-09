import { handleFormSubmit } from "../../src/server/lifecycle-events";
import { createPagesPostHandler } from "../../src/server/pages-function";

export const onRequestPost = createPagesPostHandler(handleFormSubmit);
