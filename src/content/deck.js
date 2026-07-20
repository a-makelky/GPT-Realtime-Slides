export const deck = Object.freeze({
  version: 1,
  title: "GPT Realtime Slides",
  slides: [
    {
      id: "opening",
      layout: "title",
      eyebrow: "Open-source presentation runtime",
      title: "Stay with the room.",
      body: "Run the deck by keyboard, buttons, a command sandbox, or optional silent voice control.",
      footer: "Manual first · voice optional",
      notes: {
        purpose: "Open with the audience benefit, not the implementation.",
        talkTrack: "Presenters should be able to move through a deck without breaking eye contact or surrendering control to an unpredictable agent.",
        cue: "Show the audience view from the QR control.",
      },
    },
    {
      id: "problem",
      layout: "statement",
      eyebrow: "The problem",
      title: "Most presentation software assumes the presenter is sitting at the keyboard.",
      body: "That is exactly when the audience stops feeling like the point.",
      footer: "Presentation software should serve the conversation",
      notes: {
        purpose: "Name the friction this tool removes.",
        talkTrack: "Remote clickers help with next and previous, but they do not handle direct navigation, QR moments, or speaker context.",
      },
    },
    {
      id: "one-source",
      layout: "columns",
      eyebrow: "One source, two views",
      title: "The audience sees the story. The presenter sees the controls.",
      columns: [
        {
          label: "Audience",
          title: "Clean slides",
          body: "No notes, microphone controls, or presenter console enter the audience page.",
        },
        {
          label: "Presenter",
          title: "Complete control",
          body: "Navigation, notes, QR, command testing, and voice status stay in the presenter view.",
        },
      ],
      footer: "Both modes read the same deck source",
      notes: {
        purpose: "Explain the core architecture in human terms.",
        talkTrack: "There is no second copy of the deck to drift out of sync.",
      },
    },
    {
      id: "manual-first",
      layout: "steps",
      eyebrow: "Deterministic by design",
      title: "Every path calls the same controller.",
      steps: [
        { label: "01", title: "Keyboard", body: "Arrow keys, space, home, end, and slide numbers." },
        { label: "02", title: "Buttons", body: "Visible controls for every essential action." },
        { label: "03", title: "Command", body: "A safe sandbox proves the exact command mapping." },
        { label: "04", title: "Realtime", body: "Optional voice tools call those same functions." },
      ],
      footer: "The deck never depends on AI to work",
      notes: {
        purpose: "Make the reliability argument.",
        talkTrack: "Realtime enhances control. It never becomes the only way to present.",
      },
    },
    {
      id: "voice",
      layout: "quote",
      eyebrow: "Silent voice control",
      title: "“Cue, go to slide seven.”",
      body: "The wake word is verified in the browser. One allowed tool may run. The model never improvises the deck and never speaks back.",
      footer: "Wake-word gated · one tool · no generated slide content",
      notes: {
        purpose: "Show why the Realtime layer is constrained.",
        talkTrack: "Ordinary room speech is ignored. Commands are allowlisted and dispatched through the same controller as manual input.",
        cue: "Use the command sandbox with ‘go to slide 7’.",
      },
    },
    {
      id: "customize",
      layout: "bullets",
      eyebrow: "Built to fork",
      title: "Change the content, theme, and controls without rebuilding the architecture.",
      items: [
        "Edit one deck module for slide copy and speaker notes.",
        "Change six theme tokens instead of hunting through CSS.",
        "Choose which controls and Realtime features are enabled.",
        "Deploy the static demo anywhere—or run it offline after load.",
      ],
      footer: "No framework-specific authoring language",
      notes: {
        purpose: "Make customization feel accessible.",
        talkTrack: "The starter is deliberately plain JavaScript, HTML, and CSS so a small team can understand it quickly.",
      },
    },
    {
      id: "security",
      layout: "columns",
      eyebrow: "Public by default, secrets never",
      title: "A public deck should not become a public credential broker.",
      columns: [
        {
          label: "Repository",
          title: "No keys or identity data",
          body: "The sample content is synthetic, dependencies are reviewable, and secrets are ignored.",
        },
        {
          label: "Realtime",
          title: "Bring your own backend",
          body: "Standard API keys stay server-side. The browser receives only a short-lived client secret.",
        },
      ],
      footer: "Public demo works without an API key",
      notes: {
        purpose: "State the security boundary without turning the slide into compliance theater.",
        talkTrack: "The hosted sandbox demonstrates every deterministic deck action. Realtime is activated only by a deployer who provides their own protected server endpoint.",
      },
    },
    {
      id: "closing",
      layout: "closing",
      eyebrow: "Try it now",
      title: "Open the audience view. Keep this one as the remote.",
      body: "Then fork the repo and make the deck yours.",
      footer: "MIT licensed · no account required",
      notes: {
        purpose: "End with an immediate product test.",
        talkTrack: "The QR overlay and audience view are the smallest complete proof that presenter and audience modes stay separate.",
        cue: "Show the QR overlay.",
      },
    },
  ],
});
