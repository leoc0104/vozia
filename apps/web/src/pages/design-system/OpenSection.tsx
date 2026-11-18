import { Rule, Section } from './parts'

export function OpenSection() {
  return (
    <Section id="open" title="Still open" lead="Decisions this system does not make yet. Most of them would change the words, not the look.">
      <div className="grid gap-4 md:grid-cols-2">
        <Rule title="The words">
          The site still says &quot;in your own voice&quot;, written for people dubbing their own videos. A promise to viewers, like &quot;Watch it in your
          language. Keep the original voice.&quot;, waits for the decision about consent.
        </Rule>
        <Rule title="Voices belong to people">
          Keeping someone&apos;s voice needs their consent, and voice providers forbid cloning a voice without it. Vozia needs a clear stance, and a consent
          step in the app, before it promises more.
        </Rule>
        <Rule title="Plan names">
          &quot;Creator&quot; and &quot;Studio&quot; fit people making videos. They need a second look once the audience is decided.
        </Rule>
        <Rule title="Portuguese and other scripts">
          The interface is English only. It needs Portuguese, and probably added fonts for Japanese, Korean, Hindi, Arabic and the other scripts Geist does
          not cover. Today those use the device&apos;s fonts.
        </Rule>
        <Rule title="Risks of yellow">
          Too much black and yellow can look like a road sign, so large yellow areas stay rare. Name, logo and color still need a trademark and domain check.
        </Rule>
        <Rule title="Not designed yet">Email templates (they still use the default ones), social media images and PNG app icons for phones.</Rule>
      </div>
    </Section>
  )
}
