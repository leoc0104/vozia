import { Rule, Section } from './parts'

export function ConceptSection() {
  return (
    <Section
      id="concept"
      title="The idea"
      lead="When you know a voice, you know who is speaking. A dub usually replaces it with a stranger's. Vozia keeps it, so what changes is the language and not the person."
    >
      <div className="grid gap-4 md:grid-cols-3">
        <Rule title="One voice">
          Yellow marks the voice itself: the voiceprint, the line being spoken, the language you chose, and the one action that matters most on a
          page. Everything else stays ink and paper.
        </Rule>
        <Rule title="Same voice, new language">
          A voiceprint is like a fingerprint. The same bars stay under every language, because the person speaking does not change.
        </Rule>
        <Rule title="Made for watching">
          A dub is something people watch, and some cannot follow subtitles at all. So strong contrast and clear type come first.
        </Rule>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Rule title="Why yellow">
          It is the classic color of subtitles, the thing you read while hearing the real voice. Vozia is what comes next. And ink on yellow is very
          easy to read: 13.5:1.
        </Rule>
        <Rule title="Why ink and paper">
          It is what manga is printed with, where you read a line and hear the voice in your head. Yellow sits on top like a highlighter.
        </Rule>
        <Rule title="Not an anime brand">
          Anime is the story that started this, but the need is universal. So no sakura, no Japan clichés and no character art. Languages and voices
          are the visuals.
        </Rule>
      </div>
    </Section>
  )
}
