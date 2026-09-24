import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { Navigation } from '../Navigation'

describe('Navigation Component', () => {
  const renderWithRouter = (component: React.ReactElement) => {
    return render(<BrowserRouter>{component}</BrowserRouter>)
  }

  it('renders navigation bar', () => {
    renderWithRouter(<Navigation />)
    const nav = screen.getByRole('navigation')
    expect(nav).toBeTruthy()
  })

  it('renders app name/logo', () => {
    renderWithRouter(<Navigation />)
    const logo = screen.getByText('RHIA')
    expect(logo).toBeTruthy()
  })

  it('renders navigation links', () => {
    renderWithRouter(<Navigation />)
    expect(screen.getByText(/Dashboard/i)).toBeTruthy()
    expect(screen.getByText(/Leads/i)).toBeTruthy()
  })

  it('renders user menu', () => {
    renderWithRouter(<Navigation />)
    const userButton = screen.getByRole('button', { name: /menu/i })
    expect(userButton).toBeTruthy()
  })

  it('has responsive design classes', () => {
    const { container } = renderWithRouter(<Navigation />)
    const nav = container.querySelector('nav')
    expect(nav).toHaveClass('bg-white', 'dark:bg-slate-900')
  })

  it('renders logout button in user menu', async () => {
    const user = (await import('@testing-library/user-event')).default
    renderWithRouter(<Navigation />)

    const menuButton = screen.getByRole('button', { name: /menu/i })
    await user.click(menuButton)

    expect(screen.getByText(/Logout/i)).toBeTruthy()
  })
})
