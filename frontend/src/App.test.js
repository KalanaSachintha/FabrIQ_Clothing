import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

test('renders FabrIQ brand in header', () => {
  render(
    <MemoryRouter>
      <App />
    </MemoryRouter>
  );

  const brandButton = screen.getByRole('button', { name: /FabrIQ/i });
  expect(brandButton).toBeInTheDocument();
  expect(screen.getByText(/Your connected fashion hub/i)).toBeInTheDocument();
});
