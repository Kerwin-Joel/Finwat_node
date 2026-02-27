import { saveEvent } from "../storage/index.js";

export const storeIncomingMessage = ({ from, text }) => {
  saveEvent({
    ts: new Date().toISOString(),
    user: from,
    direction: "in",
    text,
  });
};

export const storeOutgoingMessage = ({ to, text }) => {
  saveEvent({
    ts: new Date().toISOString(),
    user: to,
    direction: "out",
    text,
  });
};
