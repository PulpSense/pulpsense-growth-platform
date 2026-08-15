import { defineLeadMagnet } from "../define-lead-magnet";

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
  renderEmail(firstName) {
    const safeName = escapeHtml(firstName);
    return {
      subject: "Your Meta Offer Intelligence agent skill",
      text: `Hi ${firstName},

Here it is:

Get the Meta Offer Intelligence skill: ${githubUrl}

This skill gives an AI agent a repeatable process for:

- researching large collections of Meta ads;
- identifying the offers worth studying;
- preserving the ads, landing pages, and supporting evidence;
- building a qualified competitor offer archive;
- knowing when to stop researching and turn the findings into an offer.

The easiest way to install it

Send the GitHub link to your agent and say:

Install this agent skill for me and tell me what you need to run it:
${githubUrl}

The skill works out of the box with Hermes Agent and can be adapted to other agents like Claude Code. You’ll need a ScrapeCreators API key when you’re ready to run the research.

Want it built around your business?

The skill gives you the research workflow. The bigger opportunity is connecting agents like this to the sales, marketing, and operational workflows already inside your company.

If you want us to design and build those agents for you, book a quick chat: ${bookingUrl}

—Santi
PulpSense`,
      html: `<p>Hi ${safeName},</p>
<p>Here it is:</p>
<p><a href="${githubUrl}"><strong>Get the Meta Offer Intelligence skill</strong></a></p>
<p>This skill gives an AI agent a repeatable process for:</p>
<ul><li>researching large collections of Meta ads;</li><li>identifying the offers worth studying;</li><li>preserving the ads, landing pages, and supporting evidence;</li><li>building a qualified competitor offer archive;</li><li>knowing when to stop researching and turn the findings into an offer.</li></ul>
<h3>The easiest way to install it</h3>
<p>Send the GitHub link to your agent and say:</p>
<blockquote>Install this agent skill for me and tell me what you need to run it:<br><a href="${githubUrl}">${githubUrl}</a></blockquote>
<p>The skill works out of the box with Hermes Agent and can be adapted to other agents like Claude Code. You’ll need a ScrapeCreators API key when you’re ready to run the research.</p>
<h3>Want it built around your business?</h3>
<p>The skill gives you the research workflow. The bigger opportunity is connecting agents like this to the sales, marketing, and operational workflows already inside your company.</p>
<p>If you want us to design and build those agents for you, <a href="${bookingUrl}">book a quick chat</a>.</p>
<p>—Santi<br>PulpSense</p>`,
    };
  },
});
