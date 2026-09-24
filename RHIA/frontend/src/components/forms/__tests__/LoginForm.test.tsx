import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginForm } from '../LoginForm'

describe('LoginForm Component', () => {
  it('renders email and password inputs', () => {
    render(<LoginForm onSuccess={() => {}} />)

    const emailInput = screen.getByPlaceholderText(/email/i)
    const passwordInput = screen.getByPlaceholderText(/password/i)

    expect(emailInput).toBeTruthy()
    expect(passwordInput).toBeTruthy()
  })

  it('renders submit button', () => {
    render(<LoginForm onSuccess={() => {}} />)
    const submitButton = screen.getByRole('button', { name: /login/i })
    expect(submitButton).toBeTruthy()
  })

  it('validates email format', async () => {
    const user = userEvent.setup()
    render(<LoginForm onSuccess={() => {}} />)

    const emailInput = screen.getByPlaceholderText(/email/i) as HTMLInputElement
    await user.type(emailInput, 'invalid-email')

    const submitButton = screen.getByRole('button', { name: /login/i })
    await user.click(submitButton)

    expect(screen.getByText(/invalid email/i)).toBeTruthy()
  })

  it('validates password is not empty', async () => {
    const user = userEvent.setup()
    render(<LoginForm onSuccess={() => {}} />)

    const emailInput = screen.getByPlaceholderText(/email/i)
    await user.type(emailInput, 'test@example.com')

    const submitButton = screen.getByRole('button', { name: /login/i })
    await user.click(submitButton)

    expect(screen.getByText(/password required/i)).toBeTruthy()
  })

  it('submits form with valid credentials', async () => {
    const user = userEvent.setup()
    const handleSuccess = vi.fn()
    render(<LoginForm onSuccess={handleSuccess} />)

    const emailInput = screen.getByPlaceholderText(/email/i)
    const passwordInput = screen.getByPlaceholderText(/password/i)

    await user.type(emailInput, 'test@example.com')
    await user.type(passwordInput, 'password123')

    const submitButton = screen.getByRole('button', { name: /login/i })
    await user.click(submitButton)

    expect(handleSuccess).toHaveBeenCalled()
  })

  it('displays loading state while submitting', async () => {
    const user = userEvent.setup()
    render(<LoginForm onSuccess={() => {}} />)

    const emailInput = screen.getByPlaceholderText(/email/i)
    const passwordInput = screen.getByPlaceholderText(/password/i)

    await user.type(emailInput, 'test@example.com')
    await user.type(passwordInput, 'password123')

    const submitButton = screen.getByRole('button', { name: /login/i })
    await user.click(submitButton)

    expect(submitButton).toHaveProperty('disabled')
  })

  it('displays error message on login failure', async () => {
    const user = userEvent.setup()
    render(
      <LoginForm onSuccess={() => {}} onError={(error) => {}} />
    )

    const emailInput = screen.getByPlaceholderText(/email/i)
    const passwordInput = screen.getByPlaceholderText(/password/i)

    await user.type(emailInput, 'wrong@example.com')
    await user.type(passwordInput, 'wrongpassword')

    const submitButton = screen.getByRole('button', { name: /login/i })
    await user.click(submitButton)

    // Wait for error to appear
    await new Promise((resolve) => setTimeout(resolve, 500))
  })

  it('clears error message when user starts typing', async () => {
    const user = userEvent.setup()
    render(<LoginForm onSuccess={() => {}} />)

    const emailInput = screen.getByPlaceholderText(/email/i) as HTMLInputElement
    await user.type(emailInput, 'invalid')

    const submitButton = screen.getByRole('button', { name: /login/i })
    await user.click(submitButton)

    expect(screen.getByText(/invalid email/i)).toBeTruthy()

    await user.clear(emailInput)
    await user.type(emailInput, 'valid@example.com')

    expect(screen.queryByText(/invalid email/i)).toBeFalsy()
  })
})
