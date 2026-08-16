import { defineLeadMagnet } from "../define-lead-magnet.js";

const githubUrl = "https://github.com/PulpSense/meta-offer-intelligence-skill";
const bookingUrl = "https://cal.com/santileoni/quick-chat";
const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

export default defineLeadMagnet({
  id: "meta-offer-intelligence-skill",
  slug: "meta-offer-intelligence-skill",
  seo: {
    title: "Meta Offer Intelligence Agent Skill | PulpSense",
    description:
      "Give your AI agent a repeatable workflow for researching Meta ads and building a qualified competitor offer archive.",
  },
  page: {
    eyebrow: "Free agent skill",
    headline: "Find the Meta offers",
    accent: "worth studying.",
    description:
      "Give your AI agent a repeatable research process for turning large collections of ads into a qualified competitor offer archive.",
    benefits: [
      "Research and preserve ads, landing pages, and evidence",
      "Separate useful offers from the noise",
      "Know when to stop researching and start building",
    ],
    compatibility: "Built for Hermes Agent · Adaptable to Claude Code",
    cardEyebrow: "Get instant access",
    cardTitle: "Meta Offer Intelligence skill",
    cardDescription:
      "Enter your details and we’ll send the skill straight to your inbox.",
    buttonLabel: "Send me the skill",
    successTitle: "Check your inbox",
    successDescription: "We’ve sent you the Meta Offer Intelligence skill.",
  },
  renderEmail(firstName: string) {
    const safeFirstName = escapeHtml(firstName);
    return {
      subject: "Your Meta Offer Intelligence agent skill",
      text: `Hey ${firstName},

Here’s your Meta Offer Intelligence skill.

The easiest way to install it

Send the skill to your agent with this instruction:

Install this agent skill for me and tell me what you need to run it.

${githubUrl}

Built for Hermes Agent and adaptable to tools like Claude Code. You’ll need a ScrapeCreators API key when you’re ready to run the research.

Want it adapted to your business?

The skill provides the research workflow. The bigger opportunity is connecting agents like this to the sales, marketing, and operational workflows already inside your company.

Book a quick chat: ${bookingUrl}

Talk soon,
Santi
PulpSense`,
      html: `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f5f7;color:#202124;font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your Meta Offer Intelligence skill is ready.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f5f7;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e4e7ec;border-radius:12px;">
<tr><td style="padding:40px 40px 36px;font-size:16px;line-height:1.6;">
<p style="margin:0 0 18px;">Hey ${safeFirstName},</p>
<p style="margin:0 0 28px;">Here’s your Meta Offer Intelligence skill.</p>
<h2 style="margin:0 0 12px;font-size:19px;line-height:1.35;">The easiest way to install it</h2>
<p style="margin:0 0 14px;">Send the skill to your agent with this instruction:</p>
<div style="margin:0 0 28px;padding:16px 18px;background:#f7f8fa;border:1px solid #dfe3e8;border-left:4px solid #1769e0;border-radius:6px;">Install this agent skill for me and tell me what you need to run it.<div style="margin-top:12px;color:#1769e0;word-break:break-all;">${githubUrl}</div></div>
<p style="margin:0 0 30px;color:#4f5660;">Built for Hermes Agent and adaptable to tools like Claude Code. You’ll need a ScrapeCreators API key when you’re ready to run the research.</p>
<div style="border-top:1px solid #e4e7ec;padding-top:28px;">
<h2 style="margin:0 0 12px;font-size:19px;line-height:1.35;">Want it adapted to your business?</h2>
<p style="margin:0 0 18px;">The skill provides the research workflow. The bigger opportunity is connecting agents like this to the sales, marketing, and operational workflows already inside your company.</p>
<p style="margin:0 0 30px;"><a href="${bookingUrl}" style="color:#1769e0;font-weight:700;">Book a quick chat</a></p>
</div>
<p style="margin:0;">Talk soon,<br>Santi<br><span style="color:#667085;">PulpSense</span></p>
</td></tr></table>
</td></tr></table></body></html>`,
    };
  },
});
