export const DTMF_TONES = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "*",
  "0",
  "#",
] as const;

export type DtmfTone = (typeof DTMF_TONES)[number];

export type DtmfCall = {
  dtmf: (tone: string) => void;
};

export const isDtmfTone = (value: string): value is DtmfTone =>
  DTMF_TONES.some((tone) => tone === value);

export const sendDtmfTone = (call: DtmfCall, tone: string) => {
  if (!isDtmfTone(tone)) throw new Error("invalid_dtmf_tone");
  call.dtmf(tone);
};
