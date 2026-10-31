import { Rule, Section } from './parts'

export function ConceptSection() {
  return (
    <Section
      id="concept"
      title="The idea"
      lead="Vozia means voz (voice) + IA (AI) in Portuguese. So the identity starts from a voice, and from the moment it goes live."
    >
      <div className="grid gap-4 md:grid-cols-3">
        <Rule title="One signal">
          Orange means live: the dub in progress, the current step, the selected choice, the one action that matters most on a page.
          Everything else stays ink and paper.
        </Rule>
        <Rule title="Voice as the shape">
          The capsule comes from a voice-level bar. It is the logo&apos;s microphone, the loading state, the live badge and the
          voiceprint that stands in for a missing thumbnail.
        </Rule>
        <Rule title="Studio precision">
          Tight type, hairline borders and monospaced timecodes. It should feel like a professional tool you can trust with your video.
        </Rule>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Rule title="Why orange">
          Recording lights are red-orange all over the world, so the color already says a voice is live. It also steps away from the
          purple and blue common in AI products.
        </Rule>
        <Rule title="Why ink buttons">
          Primary buttons are solid ink, not orange. That keeps the signal rare, and keeps the main action from looking like the red of
          a destructive one.
        </Rule>
      </div>
    </Section>
  )
}
