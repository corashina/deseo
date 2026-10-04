import { fireEvent, render, screen } from '@testing-library/react-native';
import { Field } from './Field';

// Importance: 93. A missing label, error announcement, or submit action blocks sign-in.
describe('Field access', () => {
  it('lets a person find the input by its visible label and submit', async () => {
    let submitted = false;
    await render(<Field label="Email" onSubmitEditing={() => { submitted = true; }} />);
    await fireEvent(screen.getByLabelText('Email'), 'submitEditing');
    expect(submitted).toBe(true);
  });

  it('announces the error and associates the error with its input', async () => {
    await render(<Field label="Email" error="Enter a valid email address." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email address.');
    expect(screen.getByLabelText('Email')).toHaveProp('accessibilityHint', 'Enter a valid email address.');
  });
});
