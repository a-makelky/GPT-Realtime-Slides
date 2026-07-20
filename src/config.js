export const config = Object.freeze({
  app: {
    title: "GPT Realtime Slides",
    presenterLabel: "Presenter",
  },
  theme: {
    navy: "#08152f",
    blue: "#2764ff",
    teal: "#38e2c2",
    paper: "#f6f8fc",
    ink: "#12203f",
  },
  qr: {
    enabled: true,
    url: "./slides.html",
    label: "Open the audience view",
  },
  audience: {
    enabled: true,
    participantUrl: "./participate.html?phase=entrance",
    aggregateEndpoint: "/api/audience/aggregates",
  },
  realtime: {
    enabled: false,
    wakeWord: "cue",
    clientSecretEndpoint: "/api/realtime/client-secret",
  },
});
