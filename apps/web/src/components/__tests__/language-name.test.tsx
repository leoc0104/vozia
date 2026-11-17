import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LanguageName } from '../LanguageName'
import { LanguageSelect } from '../LanguageSelect'

describe('LanguageName', () => {
  it('shows the language in its own script, marked with its code, and the English name on hover', () => {
    render(<LanguageName code="ja" />)
    const name = screen.getByText('日本語')
    expect(name).toHaveAttribute('lang', 'ja')
    expect(name).toHaveAttribute('dir', 'ltr')
    expect(name).toHaveAttribute('title', 'Japanese')
  })

  it('sets the writing direction for right-to-left languages', () => {
    render(<LanguageName code="ar" />)
    expect(screen.getByText('العربية')).toHaveAttribute('dir', 'rtl')
  })

  it('adds no hover text when the two names are the same', () => {
    render(<LanguageName code="en" />)
    expect(screen.getByText('English')).not.toHaveAttribute('title')
  })
})

describe('LanguageSelect', () => {
  it('lists each language by its own name, with the English name beside it when they differ', () => {
    render(<LanguageSelect id="target" value="pt" onChange={() => undefined} />)
    expect(screen.getByRole('option', { name: 'Português · Portuguese' })).toHaveProperty('selected', true)
    expect(screen.getByRole('option', { name: 'English' })).toBeInTheDocument()
  })
})
