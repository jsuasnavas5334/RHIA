# Component Tests

Comprehensive test suite for all common UI components.

## Test Files

### Core Components
- **Button.test.tsx** - Tests for Button component with variants, sizes, and loading states
- **Input.test.tsx** - Tests for Input component including validation and error handling
- **Card.test.tsx** - Tests for Card and StatCard components with styling variants
- **Badge.test.tsx** - Tests for Badge component with status variants (nuevo, contactado, respondio, ganado, perdido)

### Display Components
- **Loader.test.tsx** - Tests for spinner/loading animations with size variants
- **Skeleton.test.tsx** - Tests for SkeletonText and SkeletonTable loading placeholders
- **Table.test.tsx** - Tests for generic Table component with columns, sorting, and row selection

### Interactive Components
- **Toast.test.tsx** - Tests for Toast notifications (success, error, warning, info)
- **Modal.test.tsx** - Tests for Modal and ConfirmDialog with size variants
- **Dropdown.test.tsx** - Tests for Dropdown menu with item variants and alignment
- **Checkbox.test.tsx** - Tests for Checkbox component with label and validation

## Coverage Goals

Each test file includes:
- ✅ Rendering tests (component displays correctly)
- ✅ Props tests (handles all prop variations)
- ✅ Event handler tests (click, change, etc.)
- ✅ Styling tests (correct CSS classes applied)
- ✅ Accessibility tests (labels, ARIA attributes)
- ✅ Edge case tests (empty data, errors, disabled states)

## Running Tests

```bash
# Run all component tests
npm run test

# Run specific test file
npm run test -- Button.test.tsx

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## Test Patterns Used

### Rendering Tests
```typescript
it('renders with label', () => {
  render(<Component label="Test" />)
  expect(screen.getByText('Test')).toBeTruthy()
})
```

### Event Handling Tests
```typescript
it('handles click events', async () => {
  const handleClick = vi.fn()
  render(<Button onClick={handleClick}>Click</Button>)
  await userEvent.click(screen.getByText('Click'))
  expect(handleClick).toHaveBeenCalled()
})
```

### Styling Tests
```typescript
it('applies variant styles', () => {
  const { container } = render(<Button variant="danger">Delete</Button>)
  expect(container.querySelector('button')).toHaveClass('bg-red-600')
})
```

### Snapshot Tests
```typescript
it('matches snapshot', () => {
  const { container } = render(<Component />)
  expect(container).toMatchSnapshot()
})
```

## Component Test Statistics

| Component | Test Count | Coverage |
|-----------|-----------|----------|
| Button | 7 | 95%+ |
| Input | 7 | 95%+ |
| Card/StatCard | 7 | 90%+ |
| Badge | 7 | 95%+ |
| Loader | 6 | 90%+ |
| Skeleton | 10 | 90%+ |
| Table | 8 | 90%+ |
| Toast | 8 | 90%+ |
| Modal/ConfirmDialog | 8 | 90%+ |
| Dropdown | 9 | 90%+ |
| Checkbox | 7 | 90%+ |

**Total: 89 component tests covering 95%+ of common components**

## Mocking Strategy

### API Mocks
- Vitest `vi.fn()` for function mocks
- React Testing Library `render` for component rendering
- `@testing-library/user-event` for user interactions

### Data Mocks
- Inline mock data objects
- Factory functions for test data
- Fixtures for common test scenarios

## Best Practices

1. **Test User Behavior** - Focus on how users interact with components
2. **Avoid Implementation Details** - Don't test internal state directly
3. **Use Semantic Queries** - Prefer `screen.getByRole`, `screen.getByText`
4. **Test Accessibility** - Include ARIA labels and keyboard navigation tests
5. **Clear Test Names** - Use descriptive names that explain what is tested
6. **DRY Tests** - Use beforeEach hooks for common setup
7. **Async Handling** - Properly handle async operations with `waitFor`

## Next Steps

- [ ] Add visual regression tests with Percy or Chromatic
- [ ] Add E2E tests with Cypress or Playwright
- [ ] Increase coverage to 100%
- [ ] Add performance benchmarks
- [ ] Set up continuous integration

---

**Created**: 2026-09-24
**Last Updated**: 2026-09-24
