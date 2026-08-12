import { handlePrecallOptOut } from "../../src/server/precall-opt-out";

export const onRequestGet = ({ request, env }: { request: Request; env: Parameters<typeof handlePrecallOptOut>[1] }) =>
  handlePrecallOptOut(request, env);
