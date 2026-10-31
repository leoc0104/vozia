import { Rule, Section } from './parts'

export function OpenSection() {
  return (
    <Section id="open" title="Still open" lead="This is a proposal to react to. These decisions are not made yet, and some of them could change it.">
      <div className="grid gap-4 md:grid-cols-2">
        <Rule title="The voice promise">
          The site still says &quot;in your own voice&quot;, but how voices will work is undecided. The identity holds either way, because it is built on voice,
          not on cloning. Only the copy would change.
        </Rule>
        <Rule title="Audience and market">
          Neither is defined yet. The name is Portuguese and the interface is English. A clear audience could shift the tone and the personality.
        </Rule>
        <Rule title="Personality">
          The working assumption is clear, human and exact. That came from this proposal, not from a brand decision.
        </Rule>
        <Rule title="The color">
          Orange is a recommendation. Changing the signal scale in one file repaints the whole app, so trying another color takes minutes.
        </Rule>
        <Rule title="Name and logo checks">
          No trademark or domain search has been done for the name or for this logo. Do that before printing or launching anything.
        </Rule>
        <Rule title="Not designed yet">
          Email templates (they still use the default ones), social media images, photography and illustration style, and PNG app icons for phones.
        </Rule>
      </div>
    </Section>
  )
}
