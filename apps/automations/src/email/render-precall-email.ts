import type { requiredPrecallVariables } from "./precall-copy.js";
import { precallCopyById } from "./precall-copy.js";
import type { PrecallModuleId } from "../trigger/precall-schedule.js";

export type PrecallTemplateVariables = Record<
  (typeof requiredPrecallVariables)[number],
  string
>;

export type RenderedPrecallEmail = {
  subject: string;
  preview: string;
  textContent: string;
  htmlContent: string;
};

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const interpolate = (template: string, variables: Record<string, string>) =>
  template.replace(/{{([a-z0-9_]+)}}/g, (_, key: string) => {
    const value = variables[key];
    if (value === undefined) throw new Error(`Missing pre-call variable: ${key}`);
    return value;
  });

const bodyToHtml = (body: string) =>
  body
    .split(/\n\n+/)
    .map((paragraph) => {
      const lines = paragraph.split("\n");
      if (lines.every((line) => line.startsWith("- "))) {
        return `<ul>${lines.map((line) => `<li>${line.slice(2)}</li>`).join("")}</ul>`;
      }
      return `<p>${lines.join("<br />")}</p>`;
    })
    .join("");

export const renderPrecallEmail = (
  moduleId: PrecallModuleId,
  variables: PrecallTemplateVariables,
): RenderedPrecallEmail => {
  const module = precallCopyById[moduleId];
  if (!module) throw new Error(`Unknown pre-call module: ${moduleId}`);
  const body = interpolate(module.body, variables);
  const subject = interpolate(module.subject, variables);
  const preview = interpolate(module.preview, variables);
  const footer = [
    "PulpSense",
    variables.business_postal_address,
    "",
    `Don't want the preparation emails? Stop pre-call emails: ${variables.precall_opt_out_url}`,
    "Your appointment will stay booked.",
  ].join("\n");
  const textContent = `${body}\n\n${footer}`;
  const htmlBody = bodyToHtml(escapeHtml(body));
  const htmlFooter = bodyToHtml(escapeHtml(footer));
  return {
    subject,
    preview,
    textContent,
    htmlContent: `<div style="font-family:Arial,sans-serif;line-height:1.6;max-width:600px;margin:0 auto">${htmlBody}${htmlFooter}</div>`,
  };
};
