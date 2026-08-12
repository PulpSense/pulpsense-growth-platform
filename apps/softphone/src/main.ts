import { TelnyxRTC } from "@telnyx/webrtc";

import { sendDtmfTone } from "./dialpad";
import "./style.css";

type VoiceSession = {
  actorUserWorkspaceId: string;
  callerNumber: string;
  destinationNumber: string;
  environment: string;
  personId: string;
  personName: string;
  telnyxJwt: string;
};

type TelnyxCall = {
  dtmf: (tone: string) => void;
  hangup: () => Promise<void> | void;
  muteAudio: () => void;
  state?: string;
  unmuteAudio: () => void;
};

type TelnyxNotification = {
  call?: TelnyxCall;
  type?: string;
};

const byId = <T extends HTMLElement>(id: string) => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id}`);
  return element as T;
};

const connectionPill = byId<HTMLDivElement>("connection-pill");
const personName = byId<HTMLHeadingElement>("person-name");
const personInitial = byId<HTMLDivElement>("person-initial");
const destinationNumber = byId<HTMLParagraphElement>("destination-number");
const callState = byId<HTMLDivElement>("call-state");
const callDetail = byId<HTMLDivElement>("call-detail");
const callButton = byId<HTMLButtonElement>("call-button");
const muteButton = byId<HTMLButtonElement>("mute-button");
const hangupButton = byId<HTMLButtonElement>("hangup-button");
const dialPad = byId<HTMLDivElement>("dial-pad");
const dialPadStatus = byId<HTMLParagraphElement>("dial-pad-status");
const dialPadButtons = Array.from(
  dialPad.querySelectorAll<HTMLButtonElement>("[data-dtmf]"),
);
const remoteMedia = byId<HTMLAudioElement>("remote-media");
const errorPanel = byId<HTMLElement>("error-panel");
const errorMessage = byId<HTMLParagraphElement>("error-message");

let client: TelnyxRTC | undefined;
let activeCall: TelnyxCall | undefined;
let callConnected = false;
let muted = false;
let session: VoiceSession | undefined;

const setDialPadEnabled = (enabled: boolean) => {
  callConnected = enabled;
  dialPad.dataset.enabled = String(enabled);
  dialPadButtons.forEach((button) => {
    button.disabled = !enabled;
  });
  dialPadStatus.textContent = enabled
    ? "Ready for automated menus"
    : "Available once the call connects";
};

const setConnection = (label: string, tone: "error" | "ready" | "waiting") => {
  connectionPill.textContent = label;
  connectionPill.dataset.tone = tone;
};

const showError = (message: string) => {
  errorMessage.textContent = message;
  errorPanel.hidden = false;
  callButton.disabled = true;
  muteButton.disabled = true;
  hangupButton.disabled = true;
  setDialPadEnabled(false);
  setConnection("Unavailable", "error");
  callState.textContent = "Call unavailable";
  callDetail.textContent = "The secure call session could not be prepared.";
};

const formatNumber = (value: string) =>
  value.replace(/^(\+1)(\d{3})(\d{3})(\d{4})$/u, "$1 $2 $3 $4");

const updateCallState = (state = "active") => {
  const normalized = state.toLowerCase();
  const labels: Record<string, string> = {
    active: "Call connected",
    answer: "Call connected",
    answered: "Call connected",
    destroy: "Call ended",
    hangup: "Call ended",
    held: "Call on hold",
    new: "Starting call…",
    requesting: "Starting call…",
    ringing: "Ringing…",
    trying: "Dialling…",
  };
  callState.textContent = labels[normalized] ?? `Call ${normalized}`;

  const ended = ["destroy", "hangup", "purge"].includes(normalized);
  const connected = ["active", "answer", "answered"].includes(normalized);
  callButton.disabled = !ended;
  muteButton.disabled = ended;
  hangupButton.disabled = ended;
  setDialPadEnabled(connected);
  if (ended) {
    activeCall = undefined;
    muted = false;
    muteButton.textContent = "Mute";
    callDetail.textContent = "You can close this tab or place another call.";
  }
};

const readHandoff = () => {
  const parameters = new URLSearchParams(window.location.hash.slice(1));
  const handoff = parameters.get("handoff");
  history.replaceState(
    {},
    "",
    `${window.location.pathname}${window.location.search}`,
  );
  return handoff;
};

const loadSession = async (handoff: string) => {
  const response = await fetch("/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ handoff }),
  });
  const body = (await response.json()) as VoiceSession & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "session_unavailable");
  return body;
};

const prepareClient = (voiceSession: VoiceSession) => {
  client = new TelnyxRTC({
    enableCallReports: true,
    hangupOnBeforeUnload: true,
    login_token: voiceSession.telnyxJwt,
  });

  client.on("telnyx.ready", () => {
    setConnection("Ready", "ready");
    callState.textContent = "Ready to call";
    callDetail.textContent = `The recipient will see ${formatNumber(voiceSession.callerNumber)}.`;
    callButton.disabled = false;
  });

  client.on("telnyx.notification", (notification: TelnyxNotification) => {
    if (notification.type !== "callUpdate" || !notification.call) return;
    activeCall = notification.call;
    updateCallState(notification.call.state);
  });

  client.on("telnyx.error", (error: unknown) => {
    const message =
      error instanceof Error ? error.message : "Telnyx connection failed";
    showError(message);
  });

  client.connect();
};

callButton.addEventListener("click", async () => {
  if (!client || !session) return;
  callButton.disabled = true;
  callState.textContent = "Requesting microphone…";
  callDetail.textContent =
    "Approve microphone access in your browser if prompted.";

  try {
    const permissionProbe = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });
    permissionProbe.getTracks().forEach((track) => track.stop());
    activeCall = client.newCall({
      audio: true,
      callerName: "PulpSense",
      callerNumber: session.callerNumber,
      destinationNumber: session.destinationNumber,
      remoteElement: remoteMedia,
      video: false,
    }) as TelnyxCall;
    updateCallState(activeCall.state ?? "new");
  } catch (error) {
    callButton.disabled = false;
    callState.textContent = "Microphone unavailable";
    callDetail.textContent =
      error instanceof Error
        ? error.message
        : "Microphone permission was not granted.";
  }
});

muteButton.addEventListener("click", () => {
  if (!activeCall) return;
  muted = !muted;
  if (muted) activeCall.muteAudio();
  else activeCall.unmuteAudio();
  muteButton.textContent = muted ? "Unmute" : "Mute";
});

hangupButton.addEventListener("click", () => {
  if (!activeCall) return;
  void activeCall.hangup();
  hangupButton.disabled = true;
  callState.textContent = "Ending call…";
});

dialPad.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
    "button[data-dtmf]",
  );
  const tone = button?.dataset.dtmf;
  if (!button || !tone || !activeCall || !callConnected) return;

  try {
    sendDtmfTone(activeCall, tone);
    dialPadStatus.textContent = `Tone ${tone} sent`;
  } catch {
    dialPadStatus.textContent = "Couldn’t send that tone";
  }
});

window.addEventListener("beforeunload", () => client?.disconnect());

const start = async () => {
  const handoff = readHandoff();
  if (!handoff) {
    showError("This link is missing its secure Twenty handoff.");
    return;
  }

  try {
    session = await loadSession(handoff);
    personName.textContent = session.personName || "Twenty Person";
    personInitial.textContent = (
      session.personName.trim()[0] ?? "P"
    ).toUpperCase();
    destinationNumber.textContent = formatNumber(session.destinationNumber);
    callState.textContent = "Connecting securely to Telnyx…";
    callDetail.textContent = "No call has been placed yet.";
    prepareClient(session);
  } catch (error) {
    showError(error instanceof Error ? error.message : "session_unavailable");
  }
};

void start();
