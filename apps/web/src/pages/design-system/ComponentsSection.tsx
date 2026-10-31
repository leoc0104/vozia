import { useId, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { ThemeSwitcher } from '../../components/ThemeSwitcher'
import {
  Badge,
  Button,
  Callout,
  Card,
  Divider,
  EmptyState,
  Field,
  Input,
  ProgressBar,
  RadioCardGroup,
  RadioCardIndicator,
  RadioCardItem,
  SelectNative,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRoot,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from '../../components/ui'
import { Block, Mono, Section, ThemePanes } from './parts'

function Caption({ children }: { children: string }) {
  return (
    <p className="mb-2">
      <Mono>{children}</Mono>
    </p>
  )
}

function Buttons() {
  return (
    <div className="space-y-5">
      <div>
        <Caption>variants</Caption>
        <div className="flex flex-wrap gap-2">
          <Button>
            <Plus className="size-4" aria-hidden="true" /> Primary
          </Button>
          <Button variant="accent">Signal</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="light">Light</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
        </div>
      </div>
      <div>
        <Caption>sizes</Caption>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </div>
      </div>
      <div>
        <Caption>states</Caption>
        <div className="flex flex-wrap gap-2">
          <Button isLoading loadingText="Starting…">
            Start dubbing
          </Button>
          <Button disabled>Disabled</Button>
          <Button variant="secondary" disabled>
            Disabled
          </Button>
        </div>
      </div>
    </div>
  )
}

function Fields() {
  const id = useId()
  return (
    <div className="space-y-4">
      <Field label="Email" htmlFor={`${id}-email`} hint="We only use it to sign you in.">
        <Input id={`${id}-email`} type="email" placeholder="you@example.com" />
      </Field>
      <Field label="Password" htmlFor={`${id}-password`} error="Use at least 8 characters.">
        <Input id={`${id}-password`} type="password" defaultValue="short" hasError />
      </Field>
      <Field label="Search" htmlFor={`${id}-search`}>
        <Input id={`${id}-search`} type="search" placeholder="Find a video" />
      </Field>
      <Field label="Dub into" htmlFor={`${id}-language`}>
        <SelectNative id={`${id}-language`} defaultValue="pt">
          <option value="pt">Portuguese</option>
          <option value="es">Spanish</option>
        </SelectNative>
      </Field>
      <Field label="Notes" htmlFor={`${id}-notes`}>
        <Textarea id={`${id}-notes`} placeholder="Anything to remember about this video" />
      </Field>
      <Field label="Disabled" htmlFor={`${id}-disabled`}>
        <Input id={`${id}-disabled`} disabled defaultValue="demo@example.com" />
      </Field>
    </div>
  )
}

function Choices() {
  const [voice, setVoice] = useState('clone')
  return (
    <div className="space-y-6">
      <RadioCardGroup aria-label="Voice" value={voice} onValueChange={setVoice} className="grid-cols-1 gap-3 sm:grid-cols-2">
        {[
          ['clone', 'Option one', 'The signal marks the current choice.'],
          ['stock', 'Option two', 'Click to compare the two looks.'],
        ].map(([value, title, body]) => (
          <RadioCardItem key={value} value={value!}>
            <div className="flex items-start gap-3">
              <RadioCardIndicator className="mt-0.5" />
              <div>
                <span className="block text-sm font-semibold text-gray-900 dark:text-gray-50">{title}</span>
                <span className="mt-1 block text-xs text-gray-600 dark:text-gray-400">{body}</span>
              </div>
            </div>
          </RadioCardItem>
        ))}
      </RadioCardGroup>
      <Tabs defaultValue="upload">
        <TabsList variant="solid">
          <TabsTrigger value="upload">Upload</TabsTrigger>
          <TabsTrigger value="youtube">YouTube link</TabsTrigger>
        </TabsList>
        <TabsContent value="upload" className="mt-3 text-sm text-gray-600 dark:text-gray-400">
          Solid tabs switch between two ways of doing one thing.
        </TabsContent>
        <TabsContent value="youtube" className="mt-3 text-sm text-gray-600 dark:text-gray-400">
          The second tab.
        </TabsContent>
      </Tabs>
      <Tabs defaultValue="dubs">
        <TabsList>
          <TabsTrigger value="dubs">Dubs</TabsTrigger>
          <TabsTrigger value="transcript">Transcript</TabsTrigger>
        </TabsList>
        <TabsContent value="dubs" className="mt-3 text-sm text-gray-600 dark:text-gray-400">
          Line tabs organize a page into views.
        </TabsContent>
        <TabsContent value="transcript" className="mt-3 text-sm text-gray-600 dark:text-gray-400">
          The second view.
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Status() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Badge variant="live">Translating</Badge>
        <Badge variant="neutral">Queued</Badge>
        <Badge variant="success">Completed</Badge>
        <Badge variant="error">Failed</Badge>
        <Badge variant="warning">Warning</Badge>
        <Badge variant="info">Info</Badge>
        <Badge>Most popular</Badge>
      </div>
      <div className="space-y-3">
        <ProgressBar value={60} label="60%" aria-label="Live progress" />
        <ProgressBar value={30} variant="neutral" aria-label="Neutral progress" />
        <ProgressBar value={100} variant="success" aria-label="Finished progress" />
        <ProgressBar value={45} variant="error" aria-label="Failed progress" />
      </div>
      <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
        <Spinner /> Loading
      </div>
      <div className="space-y-3">
        <Callout variant="success">Your profile was saved.</Callout>
        <Callout variant="error" title="Dubbing failed while translating.">
          The provider did not respond. Your minutes were not charged.
        </Callout>
        <Callout variant="warning">You have 1 dubbing minute left.</Callout>
        <Callout variant="neutral">Links expire after one hour.</Callout>
      </div>
    </div>
  )
}

function Surfaces() {
  return (
    <div className="space-y-5">
      <Card>
        <h4 className="text-base font-semibold text-gray-900 dark:text-gray-50">Card</h4>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">The basic surface for grouped content.</p>
      </Card>
      <Divider>or</Divider>
      <EmptyState title="No videos yet" description="Empty places show quiet levels: no signal yet." action={<Button size="sm">Create your first dub</Button>} />
      <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
        <TableRoot>
          <Table className="border-b-0">
            <TableHead>
              <TableRow>
                <TableHeaderCell>Language</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell>Portuguese</TableCell>
                <TableCell>
                  <Badge variant="success">Completed</Badge>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Japanese</TableCell>
                <TableCell>
                  <Badge variant="live">Translating</Badge>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableRoot>
      </div>
    </div>
  )
}

export function ComponentsSection() {
  return (
    <Section id="components" title="Components" lead="The kit used across the app, in both themes at once. These are the real components, so what you see here is what ships.">
      <Block title="Buttons" note="Ink is the default. Use the signal button at most once per page, and red only to confirm something destructive.">
        <ThemePanes>
          <Buttons />
        </ThemePanes>
      </Block>
      <Block title="Fields" note="Labels are always visible. Errors say what to do next.">
        <ThemePanes>
          <Fields />
        </ThemePanes>
      </Block>
      <Block title="Choices and tabs">
        <ThemePanes>
          <Choices />
        </ThemePanes>
      </Block>
      <Block title="Status and feedback" note="Live work is the only thing that moves. Failed work uses crimson, never the signal.">
        <ThemePanes>
          <Status />
        </ThemePanes>
      </Block>
      <Block title="Surfaces">
        <ThemePanes>
          <Surfaces />
        </ThemePanes>
      </Block>
      <Block title="Dialog and theme switch" note="Destructive actions stay quiet until the last step: the button that starts one is secondary, and only the confirmation is red.">
        <div className="flex flex-wrap items-center gap-4 rounded-lg border border-gray-200 p-5 dark:border-gray-800">
          <ConfirmDialog
            trigger={
              <Button variant="secondary">
                <Trash2 className="size-4" aria-hidden="true" /> Delete
              </Button>
            }
            title="Delete this video?"
            description="This is only a demonstration. Nothing will be deleted."
            confirmLabel="Delete"
            onConfirm={() => undefined}
          />
          <ThemeSwitcher />
        </div>
      </Block>
    </Section>
  )
}
