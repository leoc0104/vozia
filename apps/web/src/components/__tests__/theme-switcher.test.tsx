import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useThemeStore } from '../../stores/theme-store'
import { ThemeSwitcher } from '../ThemeSwitcher'

beforeEach(() => {
  localStorage.clear()
  useThemeStore.setState({ preference: 'system', resolved: 'light' })
  document.documentElement.classList.remove('dark')
})

describe('ThemeSwitcher', () => {
  it('offers system, light and dark as a radio group', () => {
    render(<ThemeSwitcher />)
    const group = screen.getByRole('radiogroup', { name: 'Theme' })
    expect(group).toBeInTheDocument()
    expect(screen.getAllByRole('radio').map((r) => r.getAttribute('aria-label'))).toEqual([
      'System theme',
      'Light theme',
      'Dark theme',
    ])
    expect(screen.getByRole('radio', { name: 'System theme' })).toHaveAttribute('aria-checked', 'true')
  })

  it('switches the theme when an option is clicked', async () => {
    render(<ThemeSwitcher />)
    await userEvent.click(screen.getByRole('radio', { name: 'Dark theme' }))
    expect(useThemeStore.getState().preference).toBe('dark')
    expect(screen.getByRole('radio', { name: 'Dark theme' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'System theme' })).toHaveAttribute('aria-checked', 'false')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('moves the selection with the arrow keys', async () => {
    render(<ThemeSwitcher />)
    screen.getByRole('radio', { name: 'System theme' }).focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(useThemeStore.getState().preference).toBe('light')
    expect(screen.getByRole('radio', { name: 'Light theme' })).toHaveFocus()
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}')
    expect(useThemeStore.getState().preference).toBe('dark')
  })

  it('never submits a surrounding form', async () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault())
    render(
      <form onSubmit={onSubmit}>
        <ThemeSwitcher />
      </form>,
    )
    await userEvent.click(screen.getByRole('radio', { name: 'Light theme' }))
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
