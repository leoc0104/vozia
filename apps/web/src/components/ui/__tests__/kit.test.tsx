import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Badge, Button, Callout, Field, Input, ProgressBar, SelectNative } from '../index'

describe('Button', () => {
  it('defaults to type="button" so it never submits a form by accident', async () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault())
    render(
      <form onSubmit={onSubmit}>
        <Button>Cancel</Button>
        <Button type="submit">Save</Button>
      </form>,
    )
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveAttribute('type', 'button')
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onSubmit).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('is busy and disabled while loading, and keeps its label', () => {
    render(<Button isLoading>Delete</Button>)
    const button = screen.getByRole('button', { name: /delete/i })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
  })

  it('supports sizes and the destructive variant', () => {
    render(
      <>
        <Button size="lg">Big</Button>
        <Button variant="destructive">Remove</Button>
      </>,
    )
    expect(screen.getByRole('button', { name: 'Big' }).className).toContain('h-11')
    expect(screen.getByRole('button', { name: 'Remove' }).className).toContain('bg-red-600')
  })
})

describe('ProgressBar', () => {
  it('clamps the value and exposes its accessible name', () => {
    render(<ProgressBar value={140} aria-label="Dub progress" />)
    const bar = screen.getByRole('progressbar', { name: 'Dub progress' })
    expect(bar).toHaveAttribute('aria-valuenow', '100')
    expect(bar).toHaveAttribute('aria-valuemin', '0')
    expect(bar).toHaveAttribute('aria-valuemax', '100')
  })

  it('has a default accessible name', () => {
    render(<ProgressBar value={10} />)
    expect(screen.getByRole('progressbar', { name: 'Progress' })).toHaveAttribute('aria-valuenow', '10')
  })
})

describe('Callout', () => {
  it('announces errors as alerts and other messages as status updates', () => {
    render(
      <>
        <Callout variant="error">Could not log in</Callout>
        <Callout variant="success" title="Saved">
          Profile saved.
        </Callout>
      </>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Could not log in')
    expect(screen.getByRole('status')).toHaveTextContent('Profile saved.')
    expect(screen.getByText('Saved')).toBeInTheDocument()
  })
})

describe('Badge', () => {
  it('uses the brand colour by default and blue for info', () => {
    render(
      <>
        <Badge>Brand</Badge>
        <Badge variant="info">Info</Badge>
      </>,
    )
    expect(screen.getByText('Brand').className).toContain('bg-brand-50')
    expect(screen.getByText('Info').className).toContain('bg-blue-50')
  })
})

describe('SelectNative', () => {
  it('renders its options with a decorative chevron', () => {
    const { container } = render(
      <SelectNative aria-label="Language" defaultValue="pt">
        <option value="en">English</option>
        <option value="pt">Portuguese</option>
      </SelectNative>,
    )
    expect(screen.getByRole('combobox', { name: 'Language' })).toHaveValue('pt')
    expect(container.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
  })
})

describe('Field', () => {
  it('links its label to the control and shows the hint', () => {
    render(
      <Field label="Email" htmlFor="email" hint="We never share it.">
        <Input id="email" />
      </Field>,
    )
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByText('We never share it.')).toBeInTheDocument()
  })

  it('shows an error instead of the hint', () => {
    render(
      <Field label="Email" htmlFor="email" hint="We never share it." error="Enter an email.">
        <Input id="email" hasError />
      </Field>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Enter an email.')
    expect(screen.queryByText('We never share it.')).not.toBeInTheDocument()
  })
})
