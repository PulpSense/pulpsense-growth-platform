import { createPagesPostHandler } from "../../src/server/pages-function";
import { handleLeadMagnetOptIn } from "../../src/server/lead-magnet-opt-in";

export const onRequestPost = createPagesPostHandler(handleLeadMagnetOptIn);
